const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlockTo } = require("../../../scripts/shared/utilities")

const UniswapV2Router = require("../../../scripts/abis/UniswapV2Router.json")

const OptimisticOracleV3Abi = require("../../../scripts/abis/OptimisticOracleV3.json")
const SingleSidedInsurancePoolAbi = require("../../../scripts/abis/SingleSidedInsurancePool.json")
const mockOracleAbi = require("../../../scripts/abis/mockOracle.json")
const mockWSYS = require("../../../scripts/abis/WETH9.json")
const mockUnoAbi = require("../../../scripts/abis/MockUNO.json")
const CapitalAgentAbi = require("../../../artifacts/contracts/CapitalAgent.sol/CapitalAgent.json").abi
const exchangeAgentAbi = require("../../../artifacts/contracts/ExchangeAgent.sol/ExchangeAgent.json").abi

const { WETH_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } = require("../../../scripts/shared/constants")

describe("SSIP Reward attack", function () {
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
    this.RewardAttack = await ethers.getContractFactory("RewardAttack")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000"
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.sepolia,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
  })

  beforeEach(async function () {
    // I'm using PSYS as uno for the tests since we don't have uno on Chain
    this.mockUNO = await ethers.getContractAt(mockUnoAbi, "0x553A7E44043C98eAaAc71334d49Ecbec92916c36")
    // Staking asset for the test.
    this.stakingAsset = await ethers.getContractAt(mockWSYS, "0x4200000000000000000000000000000000000006")
    this.multisig = await ethers.getSigner("0x15E18e012cb6635b228e0DF0b6FC72627C8b2429")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x15E18e012cb6635b228e0DF0b6FC72627C8b2429"],
    })

    this.USDCMillionaire = await ethers.getSigner("0x8894E0a0c962CB723c1976a4421c95949bE2D4E3")

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8894E0a0c962CB723c1976a4421c95949bE2D4E3"],
    })

    // Account that has enought tokens to transfer all test account a bunch of times
    this.stakingAssetMillionaire = await ethers.getSigner("0x3F0e40bC7e9cb5f46E906dAEd18651Fb6212Aa8E")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x3F0e40bC7e9cb5f46E906dAEd18651Fb6212Aa8E"],
    })
    await network.provider.send("hardhat_setBalance", [
      "0x3F0e40bC7e9cb5f46E906dAEd18651Fb6212Aa8E",
      "0x900000000000000000000000000000000000",
    ])

    await this.stakingAssetMillionaire.sendTransaction({ to: this.stakingAsset, value: getBigNumber("50000000") })
    console.log(await this.stakingAsset.balanceOf(this.stakingAssetMillionaire.address))
    this.UNOMillionaire = await ethers.getSigner("0xBB6Ae6BaE1356226cfFE33d131EE66194FE4E0aD")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBB6Ae6BaE1356226cfFE33d131EE66194FE4E0aD"],
    })

    await this.stakingAssetMillionaire.sendTransaction({
      to: this.UNOMillionaire.address,
      value: ethers.parseUnits("1", "ether"),
    })

    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[0], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[1], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[2], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[3], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[4], getBigNumber("500000"))
    await this.stakingAssetMillionaire.sendTransaction({ to: this.multisig, value: getBigNumber("5000") })

    await this.mockUNO.connect(this.signers[0]).mint(getBigNumber("50000"), { from: this.signers[0] })
    await this.mockUNO.connect(this.signers[1]).mint(getBigNumber("50000"), { from: this.signers[1] })
    await this.mockUNO.connect(this.signers[2]).mint(getBigNumber("50000"), { from: this.signers[2] })

    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    const assetArray = [this.stakingAsset.address, this.mockUNO.address, this.zeroAddress]

    // const timestamp = new Date().getTime()
    const timestamp = (await ethers.provider.getBlock("latest")).timestamp + 100

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.stakingAsset
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()

    console.log("Adding liquidity...")

    await (
      await this.routerContract
        .connect(this.signers[0])
        .addLiquidity(
          this.mockUNO.target,
          this.stakingAsset.target,
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          getBigNumber("3000000"),
          getBigNumber("3000", 6),
          this.signers[0].address,
          timestamp,
          { from: this.signers[0].address, gasLimit: 9999999 },
        )
    ).wait()

    this.mockOraclePriceFeed = await ethers.getContractAt(mockOracleAbi, "0x14eF9C6cD5A8C78af407cEcCA3E4668e466F2B18")

    this.exchangeAgent = await ethers.getContractAt(exchangeAgentAbi, "0x83f618d714B9464C8e63F1d95592BaAa2d51a54E")

    this.capitalAgent = await ethers.getContractAt(CapitalAgentAbi, "0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30")

    await this.capitalAgent.connect(this.multisig).grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x570baA32dB74279a50491E88D712C957F4C9E409")
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address)
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863"],
    })
    this.admin = await ethers.getSigner("0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863")

    this.singleSidedInsurancePool = await ethers.getContractAt(
      SingleSidedInsurancePoolAbi,
      "0x3B61743180857c9D898c336b1604f4742887aa74",
    )

    await this.singleSidedInsurancePool
      .connect(this.multisig)
      .grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)
    await this.singleSidedInsurancePool.createRewarder(this.signers[0].address, this.rewarderFactory.target, this.mockUNO.target)
    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(await this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("10000"))).wait()

    this.rewardAttack = await this.RewardAttack.deploy()
  })

  describe("SingleSidedInsurancePool Harvest Attack Actions", function () {
    beforeEach(async function () {
      await this.stakingAsset.approve(this.singleSidedInsurancePool, getBigNumber("1000000"))
      await this.stakingAsset
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool, getBigNumber("1000000"), { from: this.signers[1].address })
      await this.stakingAsset
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()

      await this.singleSidedInsurancePool
        .connect(this.signers[2])
        .enterInPool(getBigNumber("1000"), { from: this.signers[2].address })
    })

    describe("SingleSidedInsurancePool harvest attack", function () {
      it("should harvest to self address after 50000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500"))
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 50000)
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
      it("should revert harvest to other address after 100000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())
        let initBalance0 = await riskPool.balanceOf(this.signers[0].address)
        let initBalance1 = await riskPool.balanceOf(this.signers[1].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500") + initBalance0)
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000") + initBalance1)

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 100000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)

        // await expect(this.singleSidedInsurancePool.harvest(this.signers[1].address)).to.be.revertedWith(
        //   "UnoRe: must be message sender",
        // )

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log(
          "[pendingUnoRewardAfterHarvest]",
          getNumber(pendingUnoRewardAfterHarvest1),
          getNumber(pendingUnoRewardAfterHarvest2),
        )
      })
      it("should revert harvest through malicious contract after 300000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore1.toString(), pendingUnoRewardBefore2.toString())

        await this.stakingAsset.transfer(this.rewardAttack.target, getBigNumber("20000"))
        let initBalance0 = await riskPool.balanceOf(this.rewardAttack.target)
        let initBalance1 = await riskPool.balanceOf(this.signers[1].address)
        await this.rewardAttack.enterInPool(this.singleSidedInsurancePool.target, getBigNumber("10000"), this.stakingAsset.target)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("8500"), { from: this.signers[1].address })

        const poolBalance1 = await riskPool.balanceOf(this.rewardAttack.target)
        expect(poolBalance1).to.equal(getBigNumber("10000") + initBalance0)
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("8500") + initBalance1)

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 300000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.rewardAttack.target)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)

        // harvest with own address through contract
        const unoBalanceBeforeHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        console.log("[unoBalanceBeforeHarvest]", unoBalanceBeforeHarvest.toString())

        const unoBalanceBeforeHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        console.log("[unoBalanceBeforeHarvest 2 ======]", unoBalanceBeforeHarvest2.toString())

        // await this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[0].address);
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterFirstHarvest - unoBalanceBeforeHarvest).to.equal(0)

        const unoBalanceAfterFirstHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterFirstHarvest2 - unoBalanceBeforeHarvest2).to.equal(0)

        console.log("[try double attack]")

        await advanceBlockTo(afterBlockNumber + 10000)
        await ethers.provider.getBlockNumber()

        // harvest with different address through contract
        const unoBalanceBeforeSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        const unoBalanceBeforeSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)

        // await expect(this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[1].address)).to.be.revertedWith(
        //   "UnoRe: must be message sender",
        // )

        const unoBalanceAfterSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterSecondHarvest - unoBalanceBeforeSecondHarvest).to.equal(0)

        const unoBalanceAfterSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterSecondHarvest2 - unoBalanceBeforeSecondHarvest2).to.equal(0)

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
        await this.singleSidedInsurancePool.harvest(this.zeroAddress)
        const unoBalanceAfterZeroHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterZeroHarvest - unoBalanceBeforeHarvest).to.equal(0)

        // // double harvest with its self address
        await this.singleSidedInsurancePool.harvest(this.signers[0].address)
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterFirstHarvest - unoBalanceAfterZeroHarvest).to.gt(0)

        // // trying harvest with zero address
        await this.singleSidedInsurancePool.harvest(this.zeroAddress)
        const unoBalanceAfterZeroHarvest2 = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterZeroHarvest2 - unoBalanceAfterFirstHarvest).to.equal(0)
      })
    })
  })
})
