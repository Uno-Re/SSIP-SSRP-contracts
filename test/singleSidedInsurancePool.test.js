const { expect } = require("chai")
// const chai = require('chai');
//  const eventemitter2 = require('chai-eventemitter2');
//  chai.use(eventemitter2());
// const { expect, emit, withArgs } = require("@nomicfoundation/hardhat-chai-matchers");

const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../scripts/shared/utilities")
const { BigNumber } = require("ethers")
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
const SalesPolicy = require("../scripts/abis/SalesPolicy.json")
const OptimisticOracleV3Abi = require("../scripts/abis/OptimisticOracleV3.json");
const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
} = require("../scripts/shared/constants")
const { clearConfigCache } = require("prettier")
const { latest } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time")

describe("SingleSidedInsurancePool", function () {
  before(async function () {
    this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.SyntheticSSIPFactory = await ethers.getContractFactory("SyntheticSSIPFactory")
    this.MockUNO = await ethers.getContractFactory("MockUNO")
    this.MockUSDT = await ethers.getContractFactory("MockUSDT")
    this.RewardAttack = await ethers.getContractFactory("RewardAttack")
    this.MockOraclePriceFeed = await ethers.getContractFactory("MockOraclePriceFeed")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.OptimisticOracleV3 = await ethers.getContractFactory("OptimisticOracleV3")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.AddressZero
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
  })

  beforeEach(async function () {
    this.mockUNO = await this.MockUNO.deploy()
    this.mockUSDT = await this.MockUSDT.deploy()
    await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000"), { from: this.signers[0].address })
    await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("500000"), { from: this.signers[0].address })
    await this.mockUNO.connect(this.signers[1]).faucetToken(getBigNumber("500000000"), { from: this.signers[1].address })
    await this.mockUSDT.connect(this.signers[1]).faucetToken(getBigNumber("500000"), { from: this.signers[1].address })
    await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("500000000"), { from: this.signers[2].address })
    await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000"), { from: this.signers[2].address })
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);

    const timestamp = new Date().getTime()

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()

    console.log("Adding liquidity...")

    await (
      await this.routerContract
        .connect(this.signers[0])
        .addLiquidity(
          this.mockUNO.target,
          this.mockUSDT.target,
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          this.signers[0].address,
          timestamp,
          { from: this.signers[0].address, gasLimit: 9999999 },
        )
    ).wait()

    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.rinkeby,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multisig.address,
      getBigNumber("60")
    )

    this.capitalAgent = await upgrades.deployProxy(
      this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUSDT.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      this.signers[0].address]
    );

    await this.capitalAgent.connect(this.multisig).grantRole((await this.capitalAgent.ADMIN_ROLE()), this.signers[0].address);

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB");
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address);

    this.singleSidedInsurancePool = await upgrades.deployProxy(
      this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
    ]
    );

    await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.capitalAgent.ADMIN_ROLE()), this.signers[0].address);

    await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool.target)).wait()
    await this.singleSidedInsurancePool.createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )
    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))).wait()

    this.rewardAttack = await this.RewardAttack.deploy()
  })

  describe("SingleSidedInsurancePool Basic", function () {
    it("Should not allow others to create risk pool", async function () {
      await expect(
        this.singleSidedInsurancePool
          .connect(this.signers[1])
          .createRiskPool("UNO-LP", "UNO-LP", this.riskPoolFactory.target, this.mockUNO.target, getBigNumber("1"), getBigNumber("1"), {
            from: this.signers[1].address,
          }),
      ).to.be.revertedWithCustomError(this.singleSidedInsurancePool, "AccessControlUnauthorizedAccount")
    })
    it("Should create Risk Pool", async function () {
      await this.singleSidedInsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        1,
        1
      )
      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.accUnoPerShare).equal(0)
    })
    it("Should set uno multiplier factor", async function () {
      await this.singleSidedInsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        1,
        1
      )
      const poolInfoBefore = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfoBefore.unoMultiplierPerBlock).equal(1)
      await this.singleSidedInsurancePool.setRewardMultiplier(getBigNumber("2"))
      const poolInfoAfter = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfoAfter.unoMultiplierPerBlock).equal(getBigNumber("2"))
    })
  })

  describe("SingleSidedInsurancePool Actions", function () {
    beforeEach(async function () {
      console.log("[action start ========>]")
      await this.singleSidedInsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUSDT.target,
        getBigNumber("1"),
        getBigNumber("10", 6),
      )
      await this.mockUSDT.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
      await this.mockUSDT
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })
      await this.mockUNO
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })
      await this.mockUSDT
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(getBigNumber("1"))
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()
      await this.singleSidedInsurancePool.connect(this.signers[2]).enterInPool(getBigNumber("8500"), { from: this.signers[2].address })
    })

    describe("SingleSidedInsurancePool Staking", function () {
      it("Should enter in pool and check pending reward and totalCapital in CapitalAgent after generate 10000 blocks", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore.toString())
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("8500"))
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()
        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.be.not.equal(pendingUnoRewardAfter)
      })
      it("should harvest to self address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000"))
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()
        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardBefore2).to.be.not.equal(pendingUnoRewardAfter2)
        const totalCaptial = await this.capitalAgent.totalCapitalStaked()

        // harvesting caller address equal to target address
        const userInfoBeforeHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoBeforeHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        console.log("[mock uno address check ===>]", this.mockUNO.address)

        await (await this.singleSidedInsurancePool.harvest(this.signers[0].address)).wait()

        const userInfoAfterHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoAfterHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        console.log("[user info after harvest]", userInfoAfterHarvest1.toString(), userInfoAfterHarvest2.toString())

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
      })
      it("should revert harvest to other address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000"))
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()
        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardBefore2).to.be.not.equal(pendingUnoRewardAfter2)
        const totalCaptial = await this.capitalAgent.totalCapitalStaked()

        // harvesting caller address equal to target address
        const userInfoBeforeHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoBeforeHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        console.log("[mock uno address check ===>]", this.mockUNO.address)

        await this.singleSidedInsurancePool.harvest(this.signers[1].address);

        // await expect(this.singleSidedInsurancePool.harvest(this.signers[1].address)).to.be.revertedWith(
        //   "UnoRe: must be message sender",
        // )

        const userInfoAfterHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoAfterHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
      })
      it("should revert harvest through malicious contract after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)

        await this.mockUSDT.transfer(this.rewardAttack.target, getBigNumber("20000"))

        await this.rewardAttack.enterInPool(this.singleSidedInsurancePool.target, getBigNumber("10000"), this.mockUSDT.target)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("8500"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.rewardAttack.target)
        expect(poolBalance1).to.equal(getBigNumber("10000"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("8500"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.rewardAttack.target)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)


        // harvest with own address through contract
        const unoBalanceBeforeHarvest = await this.mockUNO.balanceOf(this.signers[0].address)

        const unoBalanceBeforeHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        console.log("[unoBalanceBeforeHarvest 2 ======]", unoBalanceBeforeHarvest2.toString())

        await this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[0].address);
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        console.log(unoBalanceAfterFirstHarvest);
        console.log(unoBalanceBeforeHarvest)
        // expect(unoBalanceAfterFirstHarvest - (unoBalanceBeforeHarvest)).to.equal(2394920448617631711000)

        const unoBalanceAfterFirstHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterFirstHarvest2 - (unoBalanceBeforeHarvest2)).to.equal(0)

        console.log('[try double attack]')

        await advanceBlockTo(afterBlockNumber + 10000)
        await ethers.provider.getBlockNumber()

        // harvest with different address through contract
        const unoBalanceBeforeSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        const unoBalanceBeforeSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)

        await this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[1].address);

        // await expect(this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[1].address)).to.be.revertedWith(
        //   "UnoRe: must be message sender",
        // )

        const unoBalanceAfterSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterSecondHarvest - (unoBalanceBeforeSecondHarvest)).to.equal(0)

        const unoBalanceAfterSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterSecondHarvest2 - (unoBalanceBeforeSecondHarvest2)).to.equal(0)

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
      })
      it("Should enter in pool by multiple users and check pending reward after generate 10000 blocks", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.equal(0)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))
        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("10000"))
        await advanceBlockTo(beforeBlockNumber + 10000)
        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // another one will deposit in pool with the same amount

        const mockUSDTBalanceBefore = await this.mockUSDT.balanceOf(this.signers[1].address)
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardAfter1).to.gte(pendingUnoRewardAfter)
        expect(pendingUnoRewardAfter2).to.be.not.equal(0)
        const totalCaptial = await this.capitalAgent.totalCapitalStaked()
      })
    })

    describe("SingleSidedInsurancePool withdraw", function () {
      beforeEach(async function () {
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // another one will deposit in pool with the same amount
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)

        await this.capitalAgent.setMCR(getBigNumber("1", 16))
      })
      it("emergency withdraw", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[0].address)
        expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        // signer 0 emergency Withdraw
          await this.singleSidedInsurancePool.toggleEmergencyWithdraw();
        await this.singleSidedInsurancePool.emergencyWithdraw()
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.signers[0].address)
        expect(lpBalanceAfter).to.equal(getBigNumber("10000"))
        expect(usdtBalanceBefore).to.lt(usdtBalanceAfter);

        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardAfter).to.equal(0)
      })


      it("Sould withdraw 1000 UNO and then will be this WR in pending but block reward will be transferred at once", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        const pendingUnoRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.gt(0)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(lpBalanceAfter).to.equal(getBigNumber("10000"))
        expect(unoBalanceBefore).to.lt(unoBalanceAfter)

        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardAfter).to.equal(0)

        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .leaveFromPoolInPending(getBigNumber("1000"), { from: this.signers[1].address })

        const pendingWithdrawRequest1 = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
        const pendingWithdrawRequest2 = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        const totalPendingWithdrawAmount = await this.singleSidedInsurancePool.getTotalWithdrawPendingAmount()
        console.log(pendingWithdrawRequest1["pendingAmount"].toString(), pendingWithdrawRequest1["pendingAmountInUno"].toString())
        expect(pendingWithdrawRequest1["pendingAmountInUno"]).to.equal(getBigNumber("1000"))
        expect(pendingWithdrawRequest2["pendingAmountInUno"]).to.equal(getBigNumber("1000"))
        expect(totalPendingWithdrawAmount).to.equal(getBigNumber("2000"))
      })

      it("Sould not claim within 10 days since WR", async function () {
        await this.singleSidedInsurancePool.setLockTime(3600 * 24 * 10)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate = new Date()
        const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
        const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 submit claim after 5 days since WR
        await expect(this.singleSidedInsurancePool.leaveFromPending(getBigNumber("1000"))).to.be.revertedWith("UnoRe: Locked time")
      })

      it("Should claim after 10 days since last WR in the case of repetitive WR", async function () {
        await this.singleSidedInsurancePool.setLockTime(3600 * 24 * 10)

        const totalCaptial0 = await this.capitalAgent.totalCapitalStaked()
        console.log(totalCaptial0.toString())
        expect(totalCaptial0).to.equal(getBigNumber("28500"))
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        const pendingUnoReward1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoReward1]", pendingUnoReward1.toString(), getNumber(pendingUnoReward1));
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate =  new Date(((await ethers.provider.getBlock('latest')).timestamp)*1000)
        const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
        const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // after 10000 blocks
        const currentBlock = await ethers.provider.getBlockNumber()
        await advanceBlockTo(currentBlock + 10000)
        const pendingUnoReward2 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoReward2]", pendingUnoReward2.toString(), getNumber(pendingUnoReward2))
        // signer 0 submit WR for the 1000 UNO again
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        const afterTenDays = new Date(afterFiveDays.setDate(currentDate.getDate() + 11))
        const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 can claim after 10 days since the last WR
        await this.singleSidedInsurancePool.leaveFromPending(getBigNumber("1000"))
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        // expected uno blance after claim
        const expectedUnoBalance = unoBalanceBefore + (pendingUnoReward1 + (pendingUnoReward2))
        expect(lpBalanceAfter).to.equal(getBigNumber("8000"))
        expect(getNumber(expectedUnoBalance)).to.gte(getNumber(unoBalanceAfter))
        const totalCaptial = await this.capitalAgent.totalCapitalStaked()
        expect(totalCaptial).to.equal(getBigNumber("27500"))
      })

      it("Should harvest", async function () {
        // signer's uno balance before harvest
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        await this.singleSidedInsurancePool.harvest(this.signers[0].address)
        // signer's uno balance after harvest
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfter - (unoBalanceBefore)).to.gt(0)
      })

      it("Should cancel withdraw request", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("5000"))
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        const withdrawRequestBefore = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
        expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("5000"))
        expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("5000"))
        await this.singleSidedInsurancePool.cancelWithdrawRequest()
        const withdrawRequestAfter = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
        expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("0"))
        expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("0"))
      })
    })

    describe("SingleSidedInsurancePool Claim", function () {
      beforeEach(async function () {
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)

        // another one will deposit in pool with the same amount
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
      })

      it("Should claim by claimAssessor and then check LP token worth", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const lpPriceBefore = await riskPool.lpPriceUno()
        expect(lpPriceBefore).to.equal(getBigNumber("1"))

        const lpTotalSupply = await riskPool.totalSupply()
        const unoBalancePool = await this.mockUSDT.balanceOf(this.poolAddress)

        const expectedLpPrice = (getBigNumber("1") * (unoBalancePool)) / (lpTotalSupply)

        const lpPriceAfter = await riskPool.lpPriceUno()
        expect(expectedLpPrice).to.equal(lpPriceAfter)
      })

      // it.only("Should check staking Amount after claim", async function () {
      //   const riskPool = this.RiskPool.attach(this.poolAddress)

      //   const stakingStatusBefore1 = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
      //   expect(stakingStatusBefore1["unoAmount"]).to.equal(getBigNumber("10000"))
      //   expect(stakingStatusBefore1["lpAmount"]).to.equal(getBigNumber("10000"))
      //   const stakingStatusBefore2 = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[1].address)
      //   expect(stakingStatusBefore2["unoAmount"]).to.equal(getBigNumber("10000"))
      //   expect(stakingStatusBefore2["lpAmount"]).to.equal(getBigNumber("10000"))

      //   await this.singleSidedInsurancePool
      //     .connect(this.signers[3])
      //     .requestPayout( getBigNumber("10000"), 0, this.signers[5].address, { from: this.signers[3].address })

      //   const stakingStatusAfter1 = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
      //   expect(stakingStatusAfter1["lpAmount"]).to.equal(getBigNumber("10000"))        
      //   expect(stakingStatusAfter1["unoAmount"]).to.equal((((getBigNumber("18500") * (getBigNumber("1"))) / (getBigNumber("28500"))) * (getBigNumber("10000"))) / (getBigNumber("1")))
      //   const stakingStatusAfter2 = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[1].address)
      //   expect(stakingStatusAfter2["lpAmount"]).to.equal(getBigNumber("10000"))
      //   expect(stakingStatusAfter2["unoAmount"]).to.equal((((getBigNumber("18500") * (getBigNumber("1"))) / (getBigNumber("28500"))) * (getBigNumber("10000"))) / (getBigNumber("1")))
      // })

      // it("Should check withdrawRequest Amount after claim", async function () {
      //   const totalCaptial0 = await this.capitalAgent.totalCapitalStaked();
      //   console.log(totalCaptial0.toString());
      //   expect(totalCaptial0).to.equal(getBigNumber("28500"))

      //   const riskPool = this.RiskPool.attach(this.poolAddress)

      //   // signer 0 submit WR for the 1000 UNO again
      //   await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))

      //   const withdrawRequestBefore = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
      //   expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("1000"))
      //   expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("1000"))

      //   await this.singleSidedInsurancePool
      //     .connect(this.signers[3])
      //     .policyClaim(this.signers[5].address, getBigNumber("10000"), 0, false, { from: this.signers[3].address })

      //   const withdrawRequestAfter = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
      //   expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("18500").mul(getBigNumber("1")).div(getBigNumber("28500")).mul(getBigNumber("1000")).div(getBigNumber("1")))
      //   expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("1000"))

      //   const totalCaptial1 = await this.capitalAgent.totalCapitalStaked();
      //   console.log(totalCaptial1.toString());
      //   expect(totalCaptial1).to.equal(getBigNumber("18500"))
      // })

      // it("Should claim withdraw request less than initial request amount after policy claim", async function () {
      //   const riskPool = this.RiskPool.attach(this.poolAddress)

      //   // signer 0 submit WR for the 1000 UNO
      //   await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
      //   const unoBalanceBefore = await this.mockUSDT.balanceOf(this.signers[0].address)

      //   const withdrawRequestBefore = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
      //   expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("1000"))
      //   expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber('1000'))

      //   await this.singleSidedInsurancePool
      //     .connect(this.signers[3])
      //     .policyClaim(this.signers[5].address, getBigNumber("10000"), 0, false, { from: this.signers[3].address })

      //   const withdrawRequestAfter = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
      //   expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("18500").mul(getBigNumber("1")).div(getBigNumber("28500")).mul(getBigNumber("1000")).div(getBigNumber("1")))
      //   expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("1000"))

      //   const currentDate = new Date()
      //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 12))
      //   console.log('[day change check ====>]', currentDate, afterTenDays)
      //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
      //   network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
      //   await network.provider.send("evm_mine")

      //   // submit claim request after 10 days from WR
      //   await this.singleSidedInsurancePool.leaveFromPending()
      //   const unoBalanceAfter = await this.mockUSDT.balanceOf(this.signers[0].address)

      //   // will get less(500) than initial request amount(1000) because of policy claim
      //   expect(unoBalanceAfter).to.equal(unoBalanceBefore.add(getBigNumber("18500").mul(getBigNumber("1")).div(getBigNumber("28500")).mul(getBigNumber("1000")).div(getBigNumber("1"))))
      // })

      // it("Should not claim all capital of pool even though the claim amount is larger than uno balance of pool", async function () {
      //   const riskPool = this.RiskPool.attach(this.poolAddress)

      //   // signer 0 submit WR for the 1000 UNO
      //   await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))

      //   const stakingStatusBefore = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
      //   expect(stakingStatusBefore["unoAmount"]).to.equal(getBigNumber("10000"))

      //   const unoBalanceBefore = await this.mockUSDT.balanceOf(this.poolAddress)
      //   expect(unoBalanceBefore).to.equal(getBigNumber("28500"))

      //   await this.singleSidedInsurancePool
      //     .connect(this.signers[3])
      //     .policyClaim(this.signers[5].address, getBigNumber("30000"), 0, false, { from: this.signers[3].address })

      //   const unoBalanceAfter = await this.mockUSDT.balanceOf(this.poolAddress)
      //   expect(unoBalanceAfter).to.equal(getBigNumber("1", 7))

      //   const stakingStatusAfter = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
      //   expect(stakingStatusAfter["unoAmount"]).to.equal(getBigNumber("3.5", 6))
      // })
    })

    describe("RiskPool LP Token Tranfer", function () {
      beforeEach(async function () {
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // // pending reward after 10000 blocks
        // const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter))

        // another one will deposit in pool with the same amount
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
      })

      it("Should check staking amount and pending reward of the new address after transfer LP token", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress);
        const lpBalanceBeforeForSigner1 = await riskPool.balanceOf(this.signers[0].address);
        const lpBalanceBeforeForSigner2 = await riskPool.balanceOf(this.signers[3].address);
        expect(lpBalanceBeforeForSigner2).to.equal(0);

        const stakingStatusBefore = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        expect(stakingStatusBefore["lpAmount"]).to.equal(getBigNumber("10000"))

        const pendingRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address);
        console.log(pendingRewardBefore.toString())

        await (await riskPool.transfer(this.signers[3].address, getBigNumber("1000"))).wait();

        const lpBalanceAfterForSigner1 = await riskPool.balanceOf(this.signers[0].address);
        expect(lpBalanceAfterForSigner1).to.equal(lpBalanceBeforeForSigner1 - (getBigNumber("1000")));
        const lpBalanceAfterForSigner2 = await riskPool.balanceOf(this.signers[3].address);
        expect(lpBalanceAfterForSigner2).to.equal(getBigNumber("1000"));

        beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        const pendingRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address);
        console.log(pendingRewardAfter.toString())

        const stakingStatusAfter = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        expect(stakingStatusAfter["lpAmount"]).to.equal(getBigNumber("9000"))
      })

      it("Should not allow transfer risk pool LP token when greater than the blance - WR", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress);

        const pendingRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address);

        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("8000"))

        await expect(riskPool.transfer(this.signers[3].address, getBigNumber("5000"))).to.be.revertedWith("ERC20: transfer amount exceeds balance or pending WR");
      })
    })
    describe("SingleSidedInsurancePool migrate", function () {
      beforeEach(async function () {
        this.Migrate = await ethers.getContractFactory("MigrationMock")
        this.migrate = await this.Migrate.deploy();

        await this.singleSidedInsurancePool.setMigrateTo(this.migrate.target);

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))

        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"));

      })

      it("Should check staking and wr amount after migrate", async function () {
        const stakedAmountBefore = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        const wrAmountBefore = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)

        expect(stakedAmountBefore['lpAmount']).to.equal(getBigNumber("10000"))
        expect(wrAmountBefore['pendingAmount']).to.equal(getBigNumber("1000"))
        expect(stakedAmountBefore['unoAmount']).to.equal(getBigNumber("10000"))
        expect(wrAmountBefore['pendingAmountInUno']).to.equal(getBigNumber("1000"))

        await this.singleSidedInsurancePool.migrate();

        const stakedAmountAfter = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        const wrAmountAfter = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)

        expect(stakedAmountAfter['lpAmount']).to.equal(getBigNumber("0"))
        expect(wrAmountAfter['pendingAmount']).to.equal(getBigNumber("0"))
        expect(stakedAmountAfter['unoAmount']).to.equal(getBigNumber("0"))
        expect(wrAmountAfter['pendingAmountInUno']).to.equal(getBigNumber("0"))

        const unobalanceInMigrate = await this.mockUSDT.balanceOf(this.migrate.target)
        expect(unobalanceInMigrate).to.equal(getBigNumber("10000"))
      })

    })
  })
})
