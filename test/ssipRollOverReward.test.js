const { expect } = require("chai")
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

describe("SingleSidedInsurancePool RollOverReward", function () {
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
    this.MockOraclePriceFeed = await ethers.getContractFactory("MockOraclePriceFeed")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
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
    await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("5000000000000"), { from: this.signers[2].address })
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
      this.signers[0].address
    )

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);

    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")

    this.capitalAgent = await upgrades.deployProxy(
      this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUNO.target,
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
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      this.signers[0].address,
      this.signers[0].address,
      this.escalationManager.target,
      "0x07865c6E87B9F70255377e024ace6630C1Eaa37F",
      this.optimisticOracleV3.target
    ]
    );

    await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.capitalAgent.ADMIN_ROLE()), this.signers[0].address);
    await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.BOT_ROLE()), this.signers[1].address);

    await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool.target)).wait()
    await this.singleSidedInsurancePool.createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )

    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(await this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))).wait()
  })

  describe("SingleSidedInsurancePool RollOverReward Actions", function () {
    beforeEach(async function () {
      await this.singleSidedInsurancePool.createRiskPool(
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        getBigNumber("1"),
        getBigNumber("10", 6),
      )
      await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
      await this.mockUNO
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })
      await this.mockUNO
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(getBigNumber("1"))
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()
      await this.singleSidedInsurancePool.connect(this.signers[2]).enterInPool(getBigNumber("1000"), { from: this.signers[2].address })
    })

    describe("SingleSidedInsurancePool RollOverReward", function () {
      it("should roll over reward to self address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        expect(await this.rewarder.currency()).equal(await riskPool.currency())

        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

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

        await (await this.singleSidedInsurancePool.connect(this.signers[1]).rollOverReward([this.signers[0].address, this.signers[1].address],
          { from: this.signers[1].address })).wait()

        const pendingUnoRewardAfterRollOverReward1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterRollOverReward2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log(
          "[pendingUnoRewardAfterRollOverReward]",
          getNumber(pendingUnoRewardAfterRollOverReward1),
          getNumber(pendingUnoRewardAfterRollOverReward2),
        )
      })
    })
  })
})
