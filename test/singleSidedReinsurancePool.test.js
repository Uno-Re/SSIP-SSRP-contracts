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

describe("SingleSidedReinsurancePool", function () {
  before(async function () {
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.SingleSidedReinsurancePool = await ethers.getContractFactory("SingleSidedReinsurancePool")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.SyntheticSSRPFactory = await ethers.getContractFactory("SyntheticSSRPFactory")
    this.MockUNO = await ethers.getContractFactory("MockUNO")
    this.MockUSDT = await ethers.getContractFactory("MockUSDT")
    this.MockOraclePriceFeed = await ethers.getContractFactory("MockOraclePriceFeed")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000";
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
  })

  beforeEach(async function () {
    // this.mockUNO = this.MockUNO.attach(UNO.rinkeby)
    // this.mockUSDT = this.MockUSDT.attach(USDT.rinkeby)
    this.mockUNO = await this.MockUNO.deploy()
    this.mockUSDT = await this.MockUSDT.deploy()
    await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000"), { from: this.signers[0].address })
    await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("500000", 6), { from: this.signers[0].address })
    await this.mockUNO.connect(this.signers[1]).faucetToken(getBigNumber("500000000"), { from: this.signers[1].address })
    await this.mockUSDT.connect(this.signers[1]).faucetToken(getBigNumber("500000", 6), { from: this.signers[1].address })
    await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("500000000"), { from: this.signers[2].address })
    await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000", 6), { from: this.signers[2].address })
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSRPFactory = await this.SyntheticSSRPFactory.deploy()

    //     const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]

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

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);

    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.rinkeby,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multisig.address,
      getBigNumber("60")
    )

    this.singleSidedReinsurancePool = await upgrades.deployProxy(
      this.SingleSidedReinsurancePool, [
      this.signers[0].address,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
    ]
    );

    await this.singleSidedReinsurancePool.grantRole((await this.singleSidedReinsurancePool.CLAIM_ASSESSOR_ROLE()), this.claimAssessor);

    await this.singleSidedReinsurancePool.createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )

    this.rewarderAddress = await this.singleSidedReinsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(this.rewarder.target).equal(await this.singleSidedReinsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))).wait()

    await this.singleSidedReinsurancePool.setStakingStartTime(Math.round(timestamp / 1000 - 3600 * 7))
    console.log(Math.round(timestamp / 1000 - 3600 * 7))
  })

  describe("SingleSidedReinsurancePool Basic", function () {
    it("Should not allow others to create risk pool", async function () {
      await expect(
        this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .createRiskPool("UNO-LP", "UNO-LP", this.riskPoolFactory.target, this.mockUNO.target, getBigNumber("1"), {
            from: this.signers[1].address,
          }),
      ).to.be.revertedWithCustomError(this.singleSidedReinsurancePool, "AccessControlUnauthorizedAccount")
    })
    it("Should create Risk Pool", async function () {
      await this.singleSidedReinsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        getBigNumber("1"),
      )
      const poolInfo = await this.singleSidedReinsurancePool.poolInfo()
      expect(poolInfo.accUnoPerShare).equal(0)
    })
    it("Should set uno multiplier factor", async function () {
      await this.singleSidedReinsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        getBigNumber("1"),
      )
      const poolInfoBefore = await this.singleSidedReinsurancePool.poolInfo()
      expect(poolInfoBefore.unoMultiplierPerBlock).equal(getBigNumber("1"))
      await this.singleSidedReinsurancePool.setRewardMultiplier(getBigNumber("2"))
      const poolInfoAfter = await this.singleSidedReinsurancePool.poolInfo()
      expect(poolInfoAfter.unoMultiplierPerBlock).equal(getBigNumber("2"))
    })
  })

  describe("SingleSidedReinsurancePool Actions", function () {
    beforeEach(async function () {
      await this.singleSidedReinsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        getBigNumber("1"),
      )
      await this.mockUNO.approve(this.singleSidedReinsurancePool.target, getBigNumber("1000000"))
      await this.mockUNO
        .connect(this.signers[1])
        .approve(this.singleSidedReinsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })

      await this.mockUNO
        .connect(this.signers[2])
        .approve(this.singleSidedReinsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedReinsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(getBigNumber("1"))
      this.poolAddress = await this.singleSidedReinsurancePool.riskPool()
    })

    describe("SingleSidedReinsurancePool Staking", function () {
      it("Should enter in pool and check pending reward after generate 10000 blocks", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        let pendingUnoRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore.toString())
        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))
        let beforeBlockNumber = await ethers.provider.getBlockNumber()
        let poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("10000"))
        pendingUnoRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore.toString())
        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))
        beforeBlockNumber = await ethers.provider.getBlockNumber()
        poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("20000"))
        await advanceBlockTo(beforeBlockNumber + 10000);
        let afterBlockNumber = await ethers.provider.getBlockNumber();
        let pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.be.not.equal(pendingUnoRewardAfter);
        await advanceBlockTo(beforeBlockNumber + 10000)
        afterBlockNumber = await ethers.provider.getBlockNumber()
        pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        console.log("[pendingUnoRewardAfter]", pendingUnoRewardAfter.toString(), getNumber(pendingUnoRewardAfter))
        expect(pendingUnoRewardBefore).to.be.not.equal(pendingUnoRewardAfter)
      })
      it("Should enter in pool by multiple users and check pending reward after generate 10000 blocks", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.equal(0)
        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))
        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("10000"))
        await advanceBlockTo(beforeBlockNumber + 10000)
        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter))
        // another one will deposit in pool with the same amount
        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
        const pendingUnoRewardAfter1 = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedReinsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter1,2]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gte(pendingUnoRewardAfter)
        expect(pendingUnoRewardAfter2).to.be.not.equal(0)
      })
    })

    describe("SingleSidedReinsurancePool withdraw", function () {
      beforeEach(async function () {

        await this.singleSidedReinsurancePool.connect(this.signers[0]).enterInPool(getBigNumber("10000"), { from: this.signers[0].address })

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // another one will deposit in pool with the same amount
        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
      })
      it("emergency withdraw", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)

        expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        // signer 0 emergency Withdraw
        await this.singleSidedReinsurancePool.emergencyWithdraw()
        const userinfo = await this.singleSidedReinsurancePool.userInfo(this.signers[0].address);
        expect(userinfo.amount).to.equal(0);
      })
      it("Sould withdraw 1000 UNO and then will be this WR in pending but block reward will be transferred at once", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        // const riskPool = this.RiskPool.attach(this.poolAddress)
        // const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        // const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        // expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        // const pendingUnoRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        // expect(pendingUnoRewardBefore).to.gt(0);
        // signer 0 submit WR for the 1000 UNO
        // await this.singleSidedReinsurancePool.connect(this.signers[2]).leaveFromPoolInPending(getBigNumber("1000"), { from: this.signers[2].address })
        // // check the uno and risk pool LP token balance of the singer 0 after withdraw
        // const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        // const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        // expect(lpBalanceAfter).to.equal(getBigNumber("10000"))
        // expect(unoBalanceBefore).to.lt(unoBalanceAfter)

        // const pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        // expect(pendingUnoRewardAfter).to.equal(0);

        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .leaveFromPoolInPending(getBigNumber("1000"), { from: this.signers[1].address })

        const pendingWithdrawRequest1 = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
        const pendingWithdrawRequest2 = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        const totalPendingWithdrawAmount = await this.singleSidedReinsurancePool.getTotalWithdrawPendingAmount()
        console.log(pendingWithdrawRequest1["pendingAmount"].toString(), pendingWithdrawRequest1["pendingAmountInUno"].toString())
        expect(pendingWithdrawRequest1["pendingAmountInUno"]).to.equal(0)
        expect(pendingWithdrawRequest2["pendingAmountInUno"]).to.equal(getBigNumber("1000"))
        expect(totalPendingWithdrawAmount).to.equal(getBigNumber("1000"))

      })

      it("Sould not claim within 10 days since WR", async function () {
        await this.singleSidedReinsurancePool.setLockTime(3600 * 24 * 10);
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate = new Date()
        const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
        const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 submit claim after 5 days since WR
        await expect(this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPending(getBigNumber("1000"))).to.be.revertedWith("UnoRe: Locked time")
      })

      it("Should claim after 10 days since last WR in the case of repetitive WR", async function () {
        await this.singleSidedReinsurancePool.setLockTime(3600 * 24 * 10)

        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[1].address)
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[1].address)
        expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        const pendingUnoReward1 = await this.singleSidedReinsurancePool.pendingUno(this.signers[1].address)
        // console.log("[pendingUnoReward1]", pendingUnoReward1.toString(), getNumber(pendingUnoReward1));
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate = new Date()
        const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
        const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // after 10000 blocks
        const currentBlock = await ethers.provider.getBlockNumber()
        await advanceBlockTo(currentBlock + 10000)
        const pendingUnoReward2 = await this.singleSidedReinsurancePool.pendingUno(this.signers[1].address)
        // console.log("[pendingUnoReward2]", pendingUnoReward2.toString(), getNumber(pendingUnoReward2))
        // signer 0 submit WR for the 1000 UNO again
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))
        const afterTenDays = new Date(afterFiveDays.setDate(currentDate.getDate() + 11))
        const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 can claim after 10 days since the last WR
        // await this.singleSidedReinsurancePool.leaveFromPending()
        await expect(this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPending(getBigNumber("2000")))
          .to.emit(riskPool, "LogLeaveFromPending")
          .withArgs(this.signers[1].address, getBigNumber("2000"), getBigNumber("2000"))
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[1].address)
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[1].address)
        // expected uno blance after claim
        const expectedUnoBalance = unoBalanceBefore + pendingUnoReward1 + pendingUnoReward2 + (getBigNumber("2000"))
        expect(lpBalanceAfter).to.equal(getBigNumber("8000"))
        expect(getNumber(expectedUnoBalance)).to.gte(getNumber(unoBalanceAfter))
      })

      it("Should harvest", async function () {
        // signer's uno balance before harvest
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[1].address)
        await this.singleSidedReinsurancePool.connect(this.signers[1]).harvest(this.signers[1].address)
        // signer's uno balance after harvest
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[1].address)
        expect(unoBalanceAfter - (unoBalanceBefore)).to.gt(0)
      })

      it("Should cancel withdraw request", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("5000"))
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[1].address)
        const withdrawRequestBefore = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("5000"))
        expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("5000"))
        await this.singleSidedReinsurancePool.connect(this.signers[1]).cancelWithdrawRequest()
        const withdrawRequestAfter = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("0"))
        expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("0"))
      })
    })

    describe("SingleSidedReinsurancePool Claim", function () {
      beforeEach(async function () {
        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)

        // another one will deposit in pool with the same amount
        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
      })

      it("Should not allow others to claim", async function () {
        await expect(this.singleSidedReinsurancePool.connect(this.signers[2]).policyClaim(this.signers[1].address, getBigNumber("10000"))).to.be.revertedWithCustomError(this.singleSidedReinsurancePool, "AccessControlUnauthorizedAccount");
      })

      it("Should claim by claimAssessor and then check LP token worth", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const lpPriceBefore = await riskPool.lpPriceUno()
        expect(lpPriceBefore).to.equal(getBigNumber("1"))

        await this.singleSidedReinsurancePool
          .connect(this.signers[3])
          .policyClaim(this.signers[5].address, getBigNumber("10000"), { from: this.signers[3].address })

        const lpTotalSupply = await riskPool.totalSupply()
        const unoBalancePool = await this.mockUNO.balanceOf(this.poolAddress)

        const expectedLpPrice = (getBigNumber("1") * (unoBalancePool)) / (lpTotalSupply)

        const lpPriceAfter = await riskPool.lpPriceUno()
        expect(expectedLpPrice).to.equal(lpPriceAfter)
      })

      it("Should check staking Amount after claim", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const stakingStatusBefore1 = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[0].address)
        expect(stakingStatusBefore1["unoAmount"]).to.equal(getBigNumber("10000"))
        expect(stakingStatusBefore1["lpAmount"]).to.equal(getBigNumber("10000"))
        const stakingStatusBefore2 = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        expect(stakingStatusBefore2["unoAmount"]).to.equal(getBigNumber("10000"))
        expect(stakingStatusBefore2["lpAmount"]).to.equal(getBigNumber("10000"))

        await this.singleSidedReinsurancePool
          .connect(this.signers[3])
          .policyClaim(this.signers[5].address, getBigNumber("10000"), { from: this.signers[3].address })

        const stakingStatusAfter1 = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[0].address)
        expect(stakingStatusAfter1["lpAmount"]).to.equal(getBigNumber("10000"))
        expect(stakingStatusAfter1["unoAmount"]).to.equal(getBigNumber("5000"))
        const stakingStatusAfter2 = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        expect(stakingStatusAfter2["lpAmount"]).to.equal(getBigNumber("10000"))
        expect(stakingStatusAfter2["unoAmount"]).to.equal(getBigNumber("5000"))
      })

      it("Should check withdrawRequest Amount after claim", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        // signer 0 submit WR for the 1000 UNO again
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))

        const withdrawRequestBefore = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("1000"))
        expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("1000"))

        await this.singleSidedReinsurancePool
          .connect(this.signers[3])
          .policyClaim(this.signers[5].address, getBigNumber("10000"), { from: this.signers[3].address })

        const withdrawRequestAfter = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("500"))
        expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("1000"))
      })

      it("Should claim withdraw request less than initial request amount after policy claim", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedReinsurancePool.setLockTime(1);
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[1].address)

        const withdrawRequestBefore = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("1000"))
        expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("1000"))

        await this.singleSidedReinsurancePool
          .connect(this.signers[3])
          .policyClaim(this.signers[5].address, getBigNumber("10000"), { from: this.signers[3].address })

        const withdrawRequestAfter = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)
        expect(withdrawRequestAfter["pendingAmountInUno"]).to.equal(getBigNumber("500"))
        expect(withdrawRequestAfter["pendingAmount"]).to.equal(getBigNumber("1000"))

        const currentDate = new Date()
        const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
        const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
        await network.provider.send("evm_mine")

        // submit claim request after 10 days from WR
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPending(getBigNumber("1000"))
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[1].address)

        // will get less(500) than initial request amount(1000) because of policy claim
        expect(unoBalanceAfter).to.equal(unoBalanceBefore + (getBigNumber("500")))
      })

      it("Should not claim all capital of pool even though the claim amount is larger than uno balance of pool", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))

        const stakingStatusBefore = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        expect(stakingStatusBefore["unoAmount"]).to.equal(getBigNumber("10000"))

        const unoBalanceBefore = await this.mockUNO.balanceOf(this.poolAddress)
        expect(unoBalanceBefore).to.equal(getBigNumber("20000"))

        await this.singleSidedReinsurancePool
          .connect(this.signers[3])
          .policyClaim(this.signers[5].address, getBigNumber("30000"), { from: this.signers[3].address })
        console.log(unoBalanceBefore);
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.poolAddress)
        console.log(unoBalanceAfter)
        expect(unoBalanceAfter).to.equal(getBigNumber("10", 6))

        const stakingStatusAfter = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        expect(stakingStatusAfter["unoAmount"]).to.equal(getBigNumber("5", 6))
      })
    })

    describe("RiskPool LP Token Tranfer", function () {
      beforeEach(async function () {
        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // // pending reward after 10000 blocks
        // const pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter))

        // another one will deposit in pool with the same amount
        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        // pending reward of the signer 0 and 1 after another 10000 blocks
        const afterBlockNumber1 = await ethers.provider.getBlockNumber()
        await advanceBlockTo(afterBlockNumber1 + 10000)
      })

      // it("Should check staking amount and pending reward of the new address after transfer LP token", async function () {
      // const riskPool = this.RiskPool.attach(this.poolAddress);
      // const lpBalanceBeforeForSigner1 = await riskPool.balanceOf(this.signers[1].address);
      // const lpBalanceBeforeForSigner2 = await riskPool.balanceOf(this.signers[3].address);
      // expect(lpBalanceBeforeForSigner2).to.equal(0);

      // const stakingStatusBefore = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
      // expect(stakingStatusBefore["lpAmount"]).to.equal(getBigNumber("10000"))

      // const pendingRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[3].address);
      // console.log(pendingRewardBefore.toString())

      // // await(await riskPool.transfer(this.signers[1].address, getBigNumber("1000"))).wait();

      // const lpBalanceAfterForSigner1 = await riskPool.balanceOf(this.signers[1].address);
      // expect(lpBalanceAfterForSigner1).to.equal(lpBalanceBeforeForSigner1 - (getBigNumber("1000")));
      // const lpBalanceAfterForSigner2 = await riskPool.balanceOf(this.signers[3].address);
      // expect(lpBalanceAfterForSigner2).to.equal(getBigNumber("1000"));

      // beforeBlockNumber = await ethers.provider.getBlockNumber()

      // await advanceBlockTo(beforeBlockNumber + 10000)

      // const pendingRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[3].address);
      // console.log(pendingRewardAfter.toString())

      // const stakingStatusAfter = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
      // expect(stakingStatusAfter["lpAmount"]).to.equal(getBigNumber("9000"))
      // })

      it("Should not allow transfer risk pool LP token when greater than the blance - WR", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress);

        const pendingRewardBefore = await this.singleSidedReinsurancePool.pendingUno(this.signers[3].address);
        console.log(pendingRewardBefore.toString())

        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))

        await expect(riskPool.connect(this.signers[1]).transfer(this.signers[1].address, getBigNumber("50000"))).to.be.revertedWith("ERC20: transfer amount exceeds balance or pending WR");
      })
    })

    describe("SingleSidedReinsurancePool migrate", function () {
      beforeEach(async function () {
        this.Migrate = await ethers.getContractFactory("MigrationMock")
        this.migrate = await this.Migrate.deploy()

        await this.singleSidedReinsurancePool.setMigrateTo(this.migrate.target)

        await this.singleSidedReinsurancePool.enterInPool(getBigNumber("10000"))

        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedReinsurancePool.pendingUno(this.signers[0].address)

        // another one will deposit in pool with the same amount
        await this.singleSidedReinsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        await this.singleSidedReinsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("1000"))
      })

      it("Should check staking and wr amount after migrate", async function () {
        const stakedAmountBefore = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        const wrAmountBefore = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)

        expect(stakedAmountBefore["lpAmount"]).to.equal(getBigNumber("10000"))
        expect(wrAmountBefore["pendingAmount"]).to.equal(getBigNumber("1000"))
        expect(stakedAmountBefore["unoAmount"]).to.equal(getBigNumber("10000"))
        expect(wrAmountBefore["pendingAmountInUno"]).to.equal(getBigNumber("1000"))

        await this.singleSidedReinsurancePool.connect(this.signers[1]).migrate()

        const stakedAmountAfter = await this.singleSidedReinsurancePool.getStakedAmountPerUser(this.signers[1].address)
        const wrAmountAfter = await this.singleSidedReinsurancePool.getWithdrawRequestPerUser(this.signers[1].address)

        expect(stakedAmountAfter["lpAmount"]).to.equal(getBigNumber("0"))
        expect(wrAmountAfter["pendingAmount"]).to.equal(getBigNumber("0"))
        expect(stakedAmountAfter["unoAmount"]).to.equal(getBigNumber("0"))
        expect(wrAmountAfter["pendingAmountInUno"]).to.equal(getBigNumber("0"))

        const unobalanceInMigrate = await this.mockUNO.balanceOf(this.migrate.target)
        expect(unobalanceInMigrate).to.equal(getBigNumber("10000"))
      })
    })
  })
})
