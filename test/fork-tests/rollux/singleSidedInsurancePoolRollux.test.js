const { expect } = require("chai")

const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlockTo } = require("../../../scripts/shared/utilities")

const UniswapV2Router = require("../../../scripts/abis/UniswapV2Router.json")

const OptimisticOracleV3Abi = require("../../../scripts/abis/OptimisticOracleV3.json")
const mockERC20 = require("../../../scripts/abis/ERC20.json")
const mockWSYS = require("../../../scripts/abis/WETH9.json")
const mockUnoAbi = require("../../../scripts/abis/MockUNO.json")
const SingleSidedInsurancePoolAbi =
  require("../../../artifacts/contracts/SingleSidedInsurancePool.sol/SingleSidedInsurancePool.json").abi
const CapitalAgentAbi = require("../../../artifacts/contracts/CapitalAgent.sol/CapitalAgent.json").abi
const { WETH_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } = require("../../../scripts/shared/constants")
const { getBigInt } = require("ethers")

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
    this.stakingAsset = await ethers.getContractFactory("MockUSDT")
    this.RewardAttack = await ethers.getContractFactory("RewardAttack")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.OptimisticOracleV3 = await ethers.getContractFactory("OptimisticOracleV3")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.AddressZero
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.sepolia,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
    this.owners = [
      this.signers[0].address,
      this.signers[1].address,
      this.signers[2].address,
      this.signers[3].address,
      this.signers[4].address,
    ]

    this.numConfirmationsRequired = 2
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
    await this.mockUNO.connect(this.signers[0]).mint(getBigNumber("50000"), { from: this.signers[0] })
    await this.mockUNO.connect(this.signers[1]).mint(getBigNumber("50000"), { from: this.signers[1] })
    await this.mockUNO.connect(this.signers[2]).mint(getBigNumber("50000"), { from: this.signers[2] })

    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[0], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[1], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[2], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[3], getBigNumber("500000"))
    await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[4], getBigNumber("500000"))
    await this.stakingAssetMillionaire.sendTransaction({ to: this.multisig, value: getBigNumber("5000") })

    // Used for staking assets that are not wsys
    // await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[0], getBigNumber("500000"))
    // await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[1], getBigNumber("500000"))
    // await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[2], getBigNumber("500000"))
    // await this.stakingAsset.connect(this.stakingAssetMillionaire).transfer(this.signers[4], getBigNumber("500000"))

    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.rewarderFactory = await this.RewarderFactory.deploy()
    this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.deploy()

    await network.provider.send("hardhat_setBalance", [
      "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e",
      "0x1000000000000000000000000000000000",
    ])

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

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")
    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.stakingAsset.target,
      WETH_ADDRESS.sepolia,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.sepolia,
      UNISWAP_FACTORY_ADDRESS.sepolia,
      this.multisig.address,
      getBigNumber("60"),
    )

    this.capitalAgent = await ethers.getContractAt(CapitalAgentAbi, "0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30")

    this.admin = await ethers.getSigner("0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863"],
    })

    await this.capitalAgent.connect(this.multisig).grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB")
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address)

    this.singleSidedInsurancePool = await ethers.getContractAt(
      SingleSidedInsurancePoolAbi,
      "0x3B61743180857c9D898c336b1604f4742887aa74",
    )
    await this.singleSidedInsurancePool.connect(this.multisig).revivePool()

    await this.singleSidedInsurancePool
      .connect(this.multisig)
      .grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)

    //await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool.target)).wait()
    await this.singleSidedInsurancePool.createRewarder(this.signers[0].address, this.rewarderFactory.target, this.mockUNO.target)
    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)
    await this.mockUNO.connect(this.UNOMillionaire).mint(getBigNumber("5000000"), { from: this.UNOMillionaire })
    await this.mockUNO.connect(this.UNOMillionaire).mint(getBigNumber("5000000"), { from: this.UNOMillionaire })

    await this.mockUNO
      .connect(this.UNOMillionaire)
      .transfer(this.rewarderAddress, getBigNumber("5000000"), { from: this.UNOMillionaire })
    await this.mockUNO
      .connect(this.UNOMillionaire)
      .transfer(this.rewarderAddress, getBigNumber("5000000"), { from: this.UNOMillionaire })

    expect(this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    //await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))

    this.rewardAttack = await this.RewardAttack.deploy()
  })

  describe("SingleSidedInsurancePool Basic", function () {
    it("Should not allow others to create risk pool", async function () {
      await expect(
        this.singleSidedInsurancePool
          .connect(this.signers[1])
          .createRiskPool(
            "UNO-LP",
            "UNO-LP",
            this.riskPoolFactory.target,
            this.mockUNO.target,
            getBigNumber("1"),
            getBigNumber("1"),
            {
              from: this.signers[1].address,
            },
          ),
      ).to.be.revertedWithCustomError(this.singleSidedInsurancePool, "AccessControlUnauthorizedAccount")
    })

    it("Should set uno multiplier factor", async function () {
      const poolInfoBefore = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfoBefore.unoMultiplierPerBlock).equal(3995433752000000)
      await this.singleSidedInsurancePool.connect(this.multisig).setRewardMultiplier(getBigNumber("2"))
      const poolInfoAfter = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfoAfter.unoMultiplierPerBlock).equal(getBigNumber("2"))
    })
  })

  describe("SingleSidedInsurancePool Actions", function () {
    beforeEach(async function () {
      console.log("[action start ========>]")

      await this.stakingAsset.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
      await this.stakingAsset
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })
      await this.mockUNO
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })
      await this.stakingAsset
        .connect(this.signers[2])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[2].address })

      const poolInfo = await this.singleSidedInsurancePool.poolInfo()
      expect(poolInfo.unoMultiplierPerBlock).equal(getBigNumber("2"))
      this.poolAddress = await this.singleSidedInsurancePool.riskPool()
      await this.singleSidedInsurancePool
        .connect(this.signers[2])
        .enterInPool(getBigNumber("8500"), { from: this.signers[2].address })
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
        let initBalance0 = await riskPool.balanceOf(this.signers[0].address)
        let initBalance1 = await riskPool.balanceOf(this.signers[1].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500") + initBalance0)
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000") + initBalance1)
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()
        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardBefore2).to.be.not.equal(pendingUnoRewardAfter2)
        //const totalCaptial = await this.capitalAgent.totalCapitalStaked()

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
        let initBalance0 = await riskPool.balanceOf(this.signers[0].address)
        let initBalance1 = await riskPool.balanceOf(this.signers[1].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("8500"))
        await this.singleSidedInsurancePool
          .connect(this.signers[1])
          .enterInPool(getBigNumber("10000"), { from: this.signers[1].address })
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance1 = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance1).to.equal(getBigNumber("8500") + initBalance0)
        const poolBalance2 = await riskPool.balanceOf(this.signers[1].address)
        expect(poolBalance2).to.equal(getBigNumber("10000") + initBalance1)
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()
        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardBefore2).to.be.not.equal(pendingUnoRewardAfter2)
        // const totalCaptial = await this.capitalAgent.totalCapitalStaked()

        // harvesting caller address equal to target address
        const userInfoBeforeHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoBeforeHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        console.log("[mock uno address check ===>]", this.mockUNO.address)

        await this.singleSidedInsurancePool.harvest(this.signers[1].address)

        const userInfoAfterHarvest1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        const userInfoAfterHarvest2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address)

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
      })
      it("should revert harvest through malicious contract after 10000 block", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore1 = await this.singleSidedInsurancePool.pendingUno(this.rewardAttack.target)
        const pendingUnoRewardBefore2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)

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
        await advanceBlockTo(beforeBlockNumber + 10000)
        const afterBlockNumber = await ethers.provider.getBlockNumber()

        const pendingUnoRewardAfter1 = await this.singleSidedInsurancePool.pendingUno(this.rewardAttack.target)
        const pendingUnoRewardAfter2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
        expect(pendingUnoRewardAfter1).to.gt(pendingUnoRewardBefore1)

        // harvest with own address through contract
        const unoBalanceBeforeHarvest = await this.mockUNO.balanceOf(this.signers[0].address)

        const unoBalanceBeforeHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        console.log("[unoBalanceBeforeHarvest 2 ======]", unoBalanceBeforeHarvest2.toString())

        await this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[0].address)
        const unoBalanceAfterFirstHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        console.log(unoBalanceAfterFirstHarvest)
        console.log(unoBalanceBeforeHarvest)
        // expect(unoBalanceAfterFirstHarvest - (unoBalanceBeforeHarvest)).to.equal(2394920448617631711000)

        const unoBalanceAfterFirstHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterFirstHarvest2 - unoBalanceBeforeHarvest2).to.equal(0)

        console.log("[try double attack]")

        await advanceBlockTo(afterBlockNumber + 10000)
        await ethers.provider.getBlockNumber()

        // harvest with different address through contract
        const unoBalanceBeforeSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        const unoBalanceBeforeSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)

        await this.rewardAttack.attackHarvest(this.singleSidedInsurancePool.target, this.signers[1].address)

        const unoBalanceAfterSecondHarvest = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfterSecondHarvest - unoBalanceBeforeSecondHarvest).to.equal(0)

        const unoBalanceAfterSecondHarvest2 = await this.mockUNO.balanceOf(this.rewardAttack.target)
        expect(unoBalanceAfterSecondHarvest2 - unoBalanceBeforeSecondHarvest2).to.equal(0)

        const pendingUnoRewardAfterHarvest1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoRewardAfterHarvest2 = await this.singleSidedInsurancePool.pendingUno(this.signers[1].address)
      })
      it("Should enter in pool by multiple users and check pending reward after generate 10000 blocks", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const pendingUnoRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        //expect(pendingUnoRewardBefore).to.equal(0)
        const poolBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))
        // block number when deposit in pool for the first time
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        const poolBalance = await riskPool.balanceOf(this.signers[0].address)
        expect(poolBalance).to.equal(getBigNumber("10000") + poolBalanceBefore)
        await advanceBlockTo(beforeBlockNumber + 10000)
        // pending reward after 10000 blocks
        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // another one will deposit in pool with the same amount

        const mockUSDTBalanceBefore = await this.stakingAsset.balanceOf(this.signers[1].address)
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
        // const totalCaptial = await this.capitalAgent.totalCapitalStaked()
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

        await this.capitalAgent.connect(this.admin).setMCR(getBigNumber("1", 16))
      })
      it("emergency withdraw", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const usdtBalanceBefore = await this.stakingAsset.balanceOf(this.signers[0].address)
        // signer 0 emergency Withdraw
        await this.singleSidedInsurancePool.toggleEmergencyWithdraw()
        await this.singleSidedInsurancePool.emergencyWithdraw()
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const usdtBalanceAfter = await this.stakingAsset.balanceOf(this.signers[0].address)
        expect(lpBalanceAfter).to.equal(getBigNumber("54000"))
        expect(usdtBalanceBefore).to.lt(usdtBalanceAfter)

        const pendingUnoRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardAfter).to.equal(0)
      })

      it("Should withdraw 1000 UNO and then will be this WR in pending but block reward will be transferred at once", async function () {
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        //expect(lpBalanceBefore).to.equal(getBigNumber("10000"))
        const pendingUnoRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        expect(pendingUnoRewardBefore).to.gt(0)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
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
        // expect(totalPendingWithdrawAmount).to.gt(getBigNumber("2000"))
      })

      it("Should not claim within 10 days since WR", async function () {
        await this.singleSidedInsurancePool.setLockTime(3600 * 24 * 10)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate = new Date()
        const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 10))
        const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
        network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 submit claim after 5 days since WR
        await expect(this.singleSidedInsurancePool.leaveFromPending(getBigNumber("1000"))).to.be.revertedWith(
          "UnoRe: Locked time",
        )
      })

      it("Should claim after 10 days since last WR in the case of repetitive WR", async function () {
        await this.singleSidedInsurancePool.setLockTime(3600 * 24 * 10)

        // const totalCaptial0 = await this.capitalAgent.totalCapitalStaked()
        // console.log(totalCaptial0.toString())
        //check the uno and risk pool LP token balance of the singer 0 before withdraw
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBefore = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        const pendingUnoReward1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        const currentDate = new Date((await ethers.provider.getBlock("latest")).timestamp * 1000)
        //const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
        const afterFiveDaysTimeStampUTC = (await ethers.provider.getBlock("latest")).timestamp + 6 * 86400
        network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // after 10000 blocks
        const currentBlock = await ethers.provider.getBlockNumber()
        await advanceBlockTo(currentBlock + 10000)
        const pendingUnoReward2 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        // console.log("[pendingUnoReward2]", pendingUnoReward2.toString(), getNumber(pendingUnoReward2))
        // signer 0 submit WR for the 1000 UNO again
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1000"))
        //const afterTenDays = new Date(afterFiveDays.setDate(currentDate.getDate() + 11))
        const afterTenDaysTimeStampUTC = (await ethers.provider.getBlock("latest")).timestamp + 11 * 86400
        network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
        await network.provider.send("evm_mine")
        // signer 0 can claim after 10 days since the last WR
        await this.singleSidedInsurancePool.leaveFromPending(getBigNumber("1000"))
        // check the uno and risk pool LP token balance of the singer 0 after withdraw
        const lpBalanceAfter = await riskPool.balanceOf(this.signers[0].address)
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        // expected uno blance after claim
        const expectedUnoBalance = unoBalanceBefore + (pendingUnoReward1 + pendingUnoReward2)
        expect(lpBalanceAfter).to.equal(getBigNumber("80000"))
        expect(getNumber(expectedUnoBalance)).to.gte(getNumber(unoBalanceAfter))
      })

      it("Should harvest", async function () {
        // signer's uno balance before harvest
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        await this.singleSidedInsurancePool.harvest(this.signers[0].address)
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 200000)
        // signer's uno balance after harvest
        const unoBalanceAfter = await this.mockUNO.balanceOf(this.signers[0].address)
        expect(unoBalanceAfter - unoBalanceBefore).to.gt(0)
      })

      it("Should cancel withdraw request", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        // signer 0 submit WR for the 1000 UNO
        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("500"))
        const unoBalanceBefore = await this.mockUNO.balanceOf(this.signers[0].address)
        const withdrawRequestBefore = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)
        expect(withdrawRequestBefore["pendingAmount"]).to.equal(getBigNumber("500"))
        expect(withdrawRequestBefore["pendingAmountInUno"]).to.equal(getBigNumber("500"))
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
    })

    describe("RiskPool LP Token Tranfer", function () {
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
      })

      it("Should check staking amount and pending reward of the new address after transfer LP token", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)
        const lpBalanceBeforeForSigner1 = await riskPool.balanceOf(this.signers[0].address)
        const lpBalanceBeforeForSigner2 = await riskPool.balanceOf(this.signers[3].address)
        expect(lpBalanceBeforeForSigner2).to.equal(0)

        const stakingStatusBefore = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)

        const pendingRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address)
        console.log(pendingRewardBefore.toString())

        await (await riskPool.transfer(this.signers[3].address, getBigNumber("1"))).wait()

        const lpBalanceAfterForSigner1 = await riskPool.balanceOf(this.signers[0].address)
        expect(lpBalanceAfterForSigner1).to.equal(lpBalanceBeforeForSigner1 - getBigNumber("1"))
        const lpBalanceAfterForSigner2 = await riskPool.balanceOf(this.signers[3].address)
        expect(lpBalanceAfterForSigner2).to.equal(getBigNumber("1"))

        beforeBlockNumber = await ethers.provider.getBlockNumber()

        await advanceBlockTo(beforeBlockNumber + 10000)

        const pendingRewardAfter = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address)
        console.log(pendingRewardAfter.toString())

        const stakingStatusAfter = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        expect(stakingStatusAfter["lpAmount"]).to.equal(stakingStatusBefore["lpAmount"] - getBigInt("1000000000000000000"))
      })

      it("Should not allow transfer risk pool LP token when greater than the blance - WR", async function () {
        const riskPool = this.RiskPool.attach(this.poolAddress)

        const pendingRewardBefore = await this.singleSidedInsurancePool.pendingUno(this.signers[3].address)

        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("800"))

        await expect(riskPool.transfer(this.signers[3].address, getBigNumber("500000"))).to.be.revertedWith(
          "ERC20: transfer amount exceeds balance or pending WR",
        )
      })
    })
    describe("SingleSidedInsurancePool migrate", function () {
      beforeEach(async function () {
        this.Migrate = await ethers.getContractFactory("MigrationMock")
        this.migrate = await this.Migrate.deploy()

        await this.singleSidedInsurancePool.setMigrateTo(this.migrate.target)

        await this.singleSidedInsurancePool.enterInPool(getBigNumber("1"))

        await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("1"))
      })

      it("Should check staking and wr amount after migrate", async function () {
        await this.singleSidedInsurancePool.migrate()

        const stakedAmountAfter = await this.singleSidedInsurancePool.getStakedAmountPerUser(this.signers[0].address)
        const wrAmountAfter = await this.singleSidedInsurancePool.getWithdrawRequestPerUser(this.signers[0].address)

        expect(stakedAmountAfter["lpAmount"]).to.equal(getBigNumber("0"))
        expect(wrAmountAfter["pendingAmount"]).to.equal(getBigNumber("0"))
        expect(stakedAmountAfter["unoAmount"]).to.equal(getBigNumber("0"))
        expect(wrAmountAfter["pendingAmountInUno"]).to.equal(getBigNumber("0"))

        const unobalanceInMigrate = await this.stakingAsset.balanceOf(this.migrate.target)
        expect(unobalanceInMigrate).to.equal(getBigNumber("120000"))
      })
    })
    describe("SingleSidedInsurancePool Staking and Migrate", function () {
      beforeEach(async function () {
        //user 1 and 2 entering the pool

        await this.singleSidedInsurancePool.connect(this.signers[0]).enterInPool(getBigNumber("100"))
        await this.singleSidedInsurancePool.connect(this.signers[1]).enterInPool(getBigNumber("100"))
        await this.stakingAsset.connect(this.signers[4]).approve(this.singleSidedInsurancePool, getBigNumber("100000"))
        await this.singleSidedInsurancePool.connect(this.signers[4]).enterInPool(getBigNumber("100000"))

        const afterTenDaysTimeStampUTC = Number((await ethers.provider.getBlock("latest")).timestamp) + Number(11 * 86400)

        await hre.ethers.provider.send("evm_increaseTime", [Number(afterTenDaysTimeStampUTC)])

        //killing pool
        await this.singleSidedInsurancePool.killPool()

        // user will not be able to enter in pool
        await expect(this.singleSidedInsurancePool.connect(this.signers[0]).enterInPool(getBigNumber("100"))).to.be.reverted

        //user will only able to withdraw in kill mode
        await expect(
          this.singleSidedInsurancePool.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("100")),
        ).not.to.be.reverted

        await hre.ethers.provider.send("evm_increaseTime", [Number(afterTenDaysTimeStampUTC)])

        await expect(
          this.singleSidedInsurancePool.connect(this.signers[1]).leaveFromPending(getBigNumber("100")),
        ).not.to.be.reverted

        // Deploying NEW SSIP POOL

        this.singleSidedInsurancePool1 = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
          this.capitalAgent.target,
          this.multisig.address,
        ])

        await this.singleSidedInsurancePool1
          .connect(this.multisig)
          .grantRole(await this.capitalAgent.ADMIN_ROLE(), this.signers[0].address)

        await (await this.capitalAgent.addPoolWhiteList(this.singleSidedInsurancePool1.target)).wait()
        await this.singleSidedInsurancePool1.createRewarder(
          this.signers[0].address,
          this.rewarderFactory.target,
          this.mockUNO.target,
        )
        this.rewarderAddress1 = await this.singleSidedInsurancePool1.rewarder()
        this.rewarder1 = await this.Rewarder.attach(this.rewarderAddress1)

        await this.singleSidedInsurancePool1.createRiskPool(
          "UNO-LP",
          "UNO-LP",
          this.riskPoolFactory.target,
          this.stakingAsset.target,
          getBigNumber("1"),
          getBigNumber("10", 6),
        )
        this.riskPool1 = this.RiskPool.attach(await this.singleSidedInsurancePool1.riskPool())
        this.riskPool = this.RiskPool.attach(await this.singleSidedInsurancePool.riskPool())

        expect(this.rewarder1.target).equal(await this.singleSidedInsurancePool1.rewarder())

        await this.singleSidedInsurancePool.setMigrateTo(this.singleSidedInsurancePool1.target)
        // await this.singleSidedInsurancePool.migrate();
        await (await this.mockUNO.mint(getBigNumber("100000"))).wait()
        await (await this.mockUNO.transfer(this.rewarder1.target, getBigNumber("100000"))).wait()

        // await this.singleSidedInsurancePool1.enterInPool(getBigNumber("100000");

        this.poolInfov2 = await this.capitalAgent.poolInfo(this.singleSidedInsurancePool.target)
        this.scrv2 = this.poolInfov2.SCR

        //setting pool capital to v2 pool capital
        await this.capitalAgent.setPoolCapital(this.singleSidedInsurancePool1.target, this.poolInfov2.totalCapital)
        await this.capitalAgent.connect(this.admin).setSCR(this.poolInfov2.SCR, this.singleSidedInsurancePool1.target)
        //transfer capital lp to riskpool
        await (await this.stakingAsset.transfer(this.riskPool1.target, this.poolInfov2.totalCapital)).wait()

        this.poolInfov3 = await this.capitalAgent.poolInfo(this.singleSidedInsurancePool1.target)
        expect(this.poolInfov3.SCR).to.equal(this.poolInfov2.SCR)
        expect(this.poolInfov3.totalCapital).to.equal(this.poolInfov2.totalCapital)
        await this.stakingAsset.connect(this.signers[4]).approve(this.singleSidedInsurancePool1, getBigNumber("100000"))
        await this.singleSidedInsurancePool1.connect(this.signers[4]).enterInPool(getBigNumber("100000"))
      })

      it("should Override the v2 position", async function () {
        const userInfoV2 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        console.log("userInfov2", userInfoV2)
        let totalUtilizedAmountBefore = await this.capitalAgent.totalUtilizedAmount()

        //migrating user position
        await this.singleSidedInsurancePool.setUserDetails(this.signers[0].address, 100, 10)
        const userInfoV3 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        let totalUtilizedAmountAfter = await this.capitalAgent.totalUtilizedAmount()

        expect(userInfoV3.amount).to.equal(100)
        expect(userInfoV3.rewardDebt).to.equal(10)
        expect(totalUtilizedAmountBefore).to.equal(totalUtilizedAmountAfter)
      })
      it("rewards amount calculation should differ", async function () {
        const userInfoV2 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)
        console.log("userInfov2", userInfoV2)

        //migrating user position
        await this.singleSidedInsurancePool1.setUserDetails(this.signers[0].address, userInfoV2.amount, 1)
        const userInfoV3 = await this.singleSidedInsurancePool1.userInfo(this.signers[0].address)

        expect(userInfoV3.amount).to.equal(userInfoV2.amount)
        expect(userInfoV3.rewardDebt).to.equal(1)

        const pendingUnoReward1 = await this.singleSidedInsurancePool.pendingUno(this.signers[0].address)
        const pendingUnoReward2 = await this.singleSidedInsurancePool1.pendingUno(this.signers[0].address)
        console.log("pendingUnoReward1", pendingUnoReward1)
        console.log("pendingUnoReward2", pendingUnoReward2)
        expect(pendingUnoReward1).not.equal(pendingUnoReward2)
      })
      it("withdraw from v3", async function () {
        const userInfoV2 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address)

        //migrating user position
        await this.singleSidedInsurancePool1.setUserDetails(this.signers[0].address, userInfoV2.amount, 1)
        const userInfoV3 = await this.singleSidedInsurancePool1.userInfo(this.signers[0].address)

        expect(userInfoV3.amount).to.equal(userInfoV2.amount)
        expect(userInfoV3.rewardDebt).to.equal(1)

        // //user leave from pool
        await expect(this.singleSidedInsurancePool.connect(this.signers[0]).leaveFromPoolInPending(userInfoV3.amount)).not.to.be
          .reverted
        await expect(this.singleSidedInsurancePool1.connect(this.signers[0]).leaveFromPoolInPending(userInfoV3.amount)).not.to.be
          .reverted

        const afterTenDaysTimeStampUTC = Number((await ethers.provider.getBlock("latest")).timestamp) + Number(11 * 86400)

        await hre.ethers.provider.send("evm_increaseTime", [Number(afterTenDaysTimeStampUTC)])

        const lpprice = (await this.riskPool.lpPriceUno()).toString()
        const LPPrice = ethers.formatEther(lpprice)
        console.log(LPPrice, "LpPrice")
        const lpprice1 = (await this.riskPool1.lpPriceUno()).toString()
        const LPPrice1 = ethers.formatEther(lpprice1)
        console.log(LPPrice1, "LpPrice1")
        console.log("Math.trunc(Number(userInfoV3.amount) * LPPrice1)", Math.trunc(Number(userInfoV3.amount) * LPPrice1))
        console.log("Math.trunc(Number(userInfoV3.amount) * LPPrice1)", Math.trunc(Number(userInfoV3.amount) * LPPrice))

        await expect(
          this.singleSidedInsurancePool.connect(this.signers[0]).leaveFromPending(userInfoV3.amount),
        ).changeTokenBalances(this.stakingAsset, [this.signers[0].address], [userInfoV3.amount])

        const signer0Amount = (await this.singleSidedInsurancePool1.getWithdrawRequestPerUser(this.signers[0].address))
          .pendingAmount
        await expect(this.singleSidedInsurancePool1.connect(this.signers[0]).leaveFromPending(signer0Amount)).changeTokenBalances(
          this.stakingAsset,
          [this.signers[0].address],
          [userInfoV3.amount],
        )
      })
    })
  })
})
