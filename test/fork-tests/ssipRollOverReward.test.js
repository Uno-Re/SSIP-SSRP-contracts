const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlockTo } = require("../../scripts/shared/utilities")

const UniswapV2Router = require("../../scripts/abis/UniswapV2Router.json")
const OptimisticOracleV3Abi = require("../../scripts/abis/OptimisticOracleV3.json")
const mockUSDCAbi = require("../../scripts/abis/MockUSDC.json")
const mockUnoAbi = require("../../scripts/abis/Uno.json")

const SingleSidedInsurancePoolAbi =
  require("../../artifacts/contracts/SingleSidedInsurancePool.sol/SingleSidedInsurancePool.json").abi

const { WETH_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } = require("../../scripts/shared/constants")

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
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.AddressZero
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.sepolia,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
  })

  beforeEach(async function () {
    this.mockUNO = await ethers.getContractAt(mockUnoAbi, "0x474021845C4643113458ea4414bdb7fB74A01A77")
    this.mockUSDT = await ethers.getContractAt(mockUSDCAbi, "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d")
    this.USDCMillionaire = await ethers.getSigner("0x8894E0a0c962CB723c1976a4421c95949bE2D4E3")
    this.UNOMinter = await ethers.getSigner("0x4A3a510a01513126d81b471279669EaC1bC83aED")

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"],
    })
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x4A3a510a01513126d81b471279669EaC1bC83aED"],
    })
    await this.USDCMillionaire.sendTransaction({
      to: this.UNOMinter.address,
      value: ethers.parseUnits("1", "ether"),
    })
    await this.mockUNO.connect(this.UNOMinter).mint(this.signers[0], getBigNumber("500000"), { from: this.UNOMinter })
    await this.mockUNO.connect(this.UNOMinter).mint(this.signers[1], getBigNumber("500000"), { from: this.UNOMinter })
    await this.mockUNO.connect(this.UNOMinter).mint(this.signers[2], getBigNumber("500000"), { from: this.UNOMinter })

    await this.mockUSDT.connect(this.USDCMillionaire).transfer(this.signers[0], getBigNumber("500000"))
    await this.mockUSDT.connect(this.USDCMillionaire).transfer(this.signers[1], getBigNumber("500000"))
    await this.mockUSDT.connect(this.USDCMillionaire).transfer(this.signers[2], getBigNumber("500000"))

    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    // const timestamp = new Date().getTime()
    const timestamp = (await ethers.provider.getBlock("latest")).timestamp + 100

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
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

    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.signers[0].address)

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e"],
    })

    await network.provider.send("hardhat_setBalance", [
      "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e",
      "0x1000000000000000000000000000000000",
    ])

    this.multisig = await ethers.getSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.sepolia,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.sepolia,
      UNISWAP_FACTORY_ADDRESS.sepolia,
      this.multisig.address,
      getBigNumber("60"),
    )

    this.capitalAgent = await upgrades.deployProxy(this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUSDT.target,
      "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e",
      this.signers[0].address,
    ])

    await this.capitalAgent.connect(this.multisig).grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB")
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8c0f1b5c01a7146259d51f798a114f4f8dc0177e"],
    })
    this.admin = await ethers.getSigner("0x8c0f1b5c01a7146259d51f798a114f4f8dc0177e")

    this.singleSidedInsurancePool = await ethers.getContractAt(
      SingleSidedInsurancePoolAbi,
      "0xa64D680DdDFb738c7681ED18CA1E289fB0e6b24f",
    )
    await this.singleSidedInsurancePool.connect(this.admin).revivePool()

    await this.singleSidedInsurancePool
      .connect(this.admin)
      .grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)
    await this.singleSidedInsurancePool
      .connect(this.admin)
      .grantRole(await this.singleSidedInsurancePool.BOT_ROLE(), this.signers[1].address)

    await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool.target)).wait()
    await this.singleSidedInsurancePool.createRewarder(this.signers[0].address, this.rewarderFactory.target, this.mockUNO.target)

    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(await this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))).wait()
  })

  describe("SingleSidedInsurancePool RollOverReward Actions", function () {
    beforeEach(async function () {
      await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
      await this.mockUNO
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })
      await this.mockUNO
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(1)
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()
      await this.singleSidedInsurancePool
        .connect(this.signers[2])
        .enterInPool(getBigNumber("100"), { from: this.signers[2].address })
    })

    describe("SingleSidedInsurancePool RollOverReward", function () {
      it("should roll over reward to self address after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        expect(await this.rewarder.currency()).equal(await riskPool.currency())

        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())
        const poolBalance1Before = await riskPool.balanceOf(this.signers[0].address)
        const poolBalance2Before = await riskPool.balanceOf(this.signers[1].address)
        await this.singleSidedInsurancePool
          .connect(this.signers[0])
          .enterInPool(getBigNumber("8500"), { from: this.signers[0].address })
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500") + poolBalance1Before)
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000") + poolBalance2Before)

        await this.singleSidedInsurancePool.connect(this.multisig).setRewardMultiplier(2000, { from: this.multisig })

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 1000)

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter2).to.gt(pendingUnoRewardBefore2)

        await (
          await this.singleSidedInsurancePool
            .connect(this.signers[1])
            .rollOverReward([this.signers[0].address, this.signers[1].address], { from: this.signers[1].address })
        ).wait()

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
