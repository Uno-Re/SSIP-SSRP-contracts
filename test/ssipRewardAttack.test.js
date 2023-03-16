const { expect } = require("chai")
const { ethers, network } = require("hardhat")
const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../scripts/shared/utilities")
const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
} = require("../scripts/shared/constants")

describe("SingleSidedInsurancePool", function () {
  before(async function () {
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
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.constants.AddressZero
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
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]

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
          this.mockUNO.address,
          this.mockUSDT.address,
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          this.signers[0].address,
          timestamp,
          { from: this.signers[0].address, gasLimit: 9999999 },
        )
    ).wait()

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.address,
      WETH_ADDRESS.rinkeby,
      TWAP_ORACLE_PRICE_FEED_FACTORY.rinkeby,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.signers[0].address,
    )

    this.capitalAgent = await this.CapitalAgent.deploy(
      this.exchangeAgent.address,
      this.mockUNO.address,
      this.mockUSDT.address,
      this.signers[0].address,
      this.signers[0].address,
    )

    this.singleSidedInsurancePool = await this.SingleSidedInsurancePool.deploy(
      this.claimAssessor,
      this.exchangeAgent.address,
      this.capitalAgent.address,
      this.signers[0].address,
    )
    await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool.address)).wait()
    await this.singleSidedInsurancePool.createRewarder(
      this.signers[0].address,
      this.rewarderFactory.address,
      this.mockUNO.address,
    )
    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(this.rewarder.address).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.address, getBigNumber("100000"))).wait()

    this.rewardAttack = await this.RewardAttack.deploy()
  })

  describe("SingleSidedInsurancePool Actions", function () {
    beforeEach(async function () {
      await this.singleSidedInsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.address,
        this.mockUSDT.address,
        getBigNumber("1"),
        getBigNumber("10", 6),
      )
      await this.mockUSDT.approve(this.singleSidedInsurancePool.address, getBigNumber("1000000"))
      await this.mockUSDT
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.address, getBigNumber("1000000"), { from: this.signers[1].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(getBigNumber("1"))
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()
    })

    describe("SingleSidedInsurancePool Staking", function () {
      it("should harvest to self address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("10000"), {from: this.signers[1].address})

        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)

        // harvesting caller address equal to target address
        await (await this.singleSidedInsurancePool.harvest(this.signers[0].address)).wait()

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log(
          "[pendingUnoRewardAfterHarvest]",
          getNumber(pendingUnoRewardAfterHarvest1),
          getNumber(pendingUnoRewardAfterHarvest2),
        )
      })
      it("should revert harvest to other address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("10000"), {from: this.signers[1].address})

        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)

        
        await expect(this.singleSidedInsurancePool.harvest(this.signers[1].address)).to.be.revertedWith(
          "UnoRe: must be message sender",
        )

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log(
          "[pendingUnoRewardAfterHarvest]",
          getNumber(pendingUnoRewardAfterHarvest1),
          getNumber(pendingUnoRewardAfterHarvest2),
        )
      })
      it("should revert harvest through malicious contract after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.mockUSDT.transfer(this.rewardAttack.address, getBigNumber("20000"))

        await this.rewardAttack.enterInPool(this.singleSidedInsurancePool.address, getBigNumber("10000"), this.mockUSDT.address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("8500"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.rewardAttack.address)
        expect(poolBalance1).to.equal(getBigNumber("10000"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("8500"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.rewardAttack.address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)


        // harvest with own address through contract
        const unoBalanceBeforeHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        console.log("[unoBalanceBeforeHarvest]", unoBalanceBeforeHarvest.toString())

        const unoBalanceBeforeHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.address)
        console.log("[unoBalanceBeforeHarvest 2 ======]", unoBalanceBeforeHarvest2.toString())

        await expect(this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.address, this.signers[0].address)).to.be.revertedWith(
          "UnoRe: updated rewarddebt incorrectly",
        )
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterFirstHarvest.sub(unoBalanceBeforeHarvest)).to.equal(0)

        const unoBalanceAfterFirstHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.address)
        expect(unoBalanceAfterFirstHarvest2.sub(unoBalanceBeforeHarvest2)).to.equal(0)

        console.log('[try double attack]')

        await advanceBlockTo(afterBlockNumber + 10000)
        await ethers.provider.getBlockNumber()

        // harvest with different address through contract
        const unoBalanceBeforeSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        const unoBalanceBeforeSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.address)

        await expect(this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.address, this.signers[1].address)).to.be.revertedWith(
          "UnoRe: must be message sender",
        )

        const unoBalanceAfterSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterSecondHarvest.sub(unoBalanceBeforeSecondHarvest)).to.equal(0)

        const unoBalanceAfterSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.address)
        expect(unoBalanceAfterSecondHarvest2.sub(unoBalanceBeforeSecondHarvest2)).to.equal(0)

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log(
          "[pendingUnoRewardAfterHarvest]",
          getNumber(pendingUnoRewardAfterHarvest1),
          getNumber(pendingUnoRewardAfterHarvest2),
        )
      })
      it("Should revert double harvest after attack with zero address", async function () {
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const unoBalanceBeforeHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        console.log("[unoBalanceBeforeHarvest]", unoBalanceBeforeHarvest.toString())

        // trying harvest with zero address
        await this.singleSidedInsurancePool.harvest(ethers.constants.AddressZero)
        const unoBalanceAfterZeroHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterZeroHarvest.sub(unoBalanceBeforeHarvest)).to.equal(0)

        // double harvest with its self address
        await this.singleSidedInsurancePool.harvest(this.signers[0].address)
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterFirstHarvest.sub(unoBalanceAfterZeroHarvest)).to.gt(0)

        // trying harvest with zero address
        await this.singleSidedInsurancePool.harvest(ethers.constants.AddressZero)
        const unoBalanceAfterZeroHarvest2 = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterZeroHarvest2.sub(unoBalanceAfterFirstHarvest)).to.equal(0)

        // double harvest with its own address
        await expect(this.singleSidedInsurancePool.harvest(this.signers[0].address)).to.be.revertedWith("UnoRe: invalid reward amount")
        const unoBalanceAfterSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterSecondHarvest.sub(unoBalanceAfterZeroHarvest2)).to.equal(0)
      })
    })
  })
})
