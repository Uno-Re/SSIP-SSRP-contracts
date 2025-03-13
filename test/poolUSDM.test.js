const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlockTo } = require("../scripts/shared/utilities")

const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")

const { WETH_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } = require("../scripts/shared/constants")

describe("SSIP-USDM", function () {
  before(async function () {
    this.PoolUSDM = await ethers.getContractFactory("SingleSidedInsurancePoolUSDM")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.MockUSDM = await ethers.getContractFactory("MockUSDM")
    this.MockUSDC = await ethers.getContractFactory("MockUSDC")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000"
  })

  beforeEach(async function () {
    // Deploy factories first
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()

    // Deploy tokens
    this.usdmToken = await this.MockUSDM.deploy()
    this.usdcToken = await this.MockUSDC.deploy()

    // Setup Oracle
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.signers[0].address)
    await this.mockOraclePriceFeed.addStableCoin(await this.usdcToken.getAddress())
    await this.mockOraclePriceFeed.addStableCoin(await this.usdmToken.getAddress())

    // Setup Exchange Agent
    this.exchangeAgent = await this.ExchangeAgent.deploy(
      await this.usdcToken.getAddress(),
      WETH_ADDRESS.sepolia,
      await this.mockOraclePriceFeed.getAddress(),
      UNISWAP_ROUTER_ADDRESS.sepolia,
      UNISWAP_FACTORY_ADDRESS.sepolia,
      this.signers[0].address,
      getBigNumber("60"),
    )

    // Setup Capital Agent
    this.capitalAgent = await upgrades.deployProxy(this.CapitalAgent, [
      await this.exchangeAgent.getAddress(),
      await this.usdcToken.getAddress(),
      this.signers[0].address,
      this.signers[1].address,
    ])

    // Deploy and initialize USDM Pool
    const capitalAgentAddress = await this.capitalAgent.getAddress()
    this.pool = await upgrades.deployProxy(this.PoolUSDM, [capitalAgentAddress, this.signers[0].address])

    await this.capitalAgent.connect(this.signers[0]).addPoolWhiteList(await this.pool.getAddress())
    await this.capitalAgent.connect(this.signers[1]).setMCR(getBigNumber("10"))
    await this.capitalAgent.connect(this.signers[1]).setMLR(getBigNumber("10"))

    // Create RiskPool through pool
    await this.pool.createRiskPool(
      "USDM-LP",
      "USDM-LP",
      this.riskPoolFactory.getAddress(),
      this.usdmToken.getAddress(),
      getBigNumber("1"),
      getBigNumber("10"),
    )

    // Create and setup rewarder
    const rewarderFactory = await this.RewarderFactory.deploy()
    const rewarderFactoryAddress = await rewarderFactory.getAddress()
    const usdmTokenAddress = await this.usdmToken.getAddress()

    await this.pool.createRewarder(this.signers[0].address, rewarderFactoryAddress, usdmTokenAddress)
    this.rewarderAddress = await this.pool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    await this.usdmToken.mint(this.signers[0].address, getBigNumber("10000000"))
    await this.usdmToken.transfer(this.rewarderAddress, getBigNumber("10000000"))

    await this.usdmToken.mint(this.signers[2].address, getBigNumber("10000000"))
    await this.usdmToken.mint(this.signers[3].address, getBigNumber("10000000"))
    await this.usdmToken.mint(this.signers[4].address, getBigNumber("10000000"))

    // Fund rewarder
    await this.usdmToken.mint(this.rewarderAddress, getBigNumber("10000000"))
    await this.pool.setRewardMultiplier(getBigNumber("1"))
    await this.usdmToken.setRewardMultiplier(getBigNumber("1"))

    // Approve tokens for all test users
    await this.usdmToken.approve(this.pool.getAddress(), getBigNumber("100000000"))
    for (let i = 2; i <= 4; i++) {
      await this.usdmToken.connect(this.signers[i]).approve(this.pool.getAddress(), getBigNumber("100000000"))
    }
  })

  describe("USDM Pool Operations", function () {
    it("should handle deposits with rebase", async function () {
      const depositAmount = getBigNumber("100")

      await this.pool.connect(this.signers[2]).enterInPool(depositAmount)

      const initialShares = await this.pool.userShares(this.signers[2].address)
      const initialValue = await this.pool.getShareValue(initialShares)

      await this.usdmToken.setRewardMultiplier(getBigNumber("1.1"))

      expect(await this.pool.userShares(this.signers[2].address)).to.equal(initialShares)
      expect(await this.pool.getShareValue(initialShares)).to.be.gt(initialValue)
    })

    it("should handle withdrawals correctly", async function () {
      // Multiple users deposit into the pool
      await this.pool.connect(this.signers[2]).enterInPool(getBigNumber("1000"))
      await this.pool.connect(this.signers[3]).enterInPool(getBigNumber("2000"))
      await this.pool.connect(this.signers[4]).enterInPool(getBigNumber("3000"))

      async function increaseTime(seconds) {
        await ethers.provider.send("evm_increaseTime", [seconds])
        await ethers.provider.send("evm_mine")
      }

      await increaseTime(3600000000000000)

      const beforeWithdrawBlock = await ethers.provider.getBlockNumber()
      console.log("Before withdraw block:", beforeWithdrawBlock)

      // Check pending rewards before withdrawal
      const pendingBefore = await this.pool.pendingRewards(this.signers[2].address)
      console.log("Pending rewards before:", pendingBefore.toString())

      // Check rewarder balance
      const rewarderBalance = await this.usdmToken.balanceOf(this.rewarderAddress)
      console.log("Rewarder USDM balance:", rewarderBalance.toString())

      const halfAmount = getBigNumber("500")
      console.log("Attempting to withdraw:", halfAmount.toString())

      // Check user info before withdrawal
      const userInfo = await this.pool.userInfo(this.signers[2].address)
      console.log("User info before withdrawal:", {
        amount: userInfo.amount.toString(),
        rewardDebt: userInfo.rewardDebt.toString(),
        lastWithdrawTime: userInfo.lastWithdrawTime.toString(),
      })

      await this.pool.connect(this.signers[2]).leaveFromPoolInPending(halfAmount)

      // Advance time past lock period AND blocks
      const tenDays = 10 * 24 * 60 * 60
      await network.provider.send("evm_increaseTime", [tenDays])
      const beforeBlockNumber = await ethers.provider.getBlockNumber()
      await advanceBlockTo(beforeBlockNumber + 10000)

      // Mine a block to ensure time changes take effect
      await network.provider.send("evm_mine")

      // Complete withdrawal
      await this.pool.connect(this.signers[2]).leaveFromPending(halfAmount)

      const shares = await this.pool.userShares(this.signers[2].address)
      expect(await this.pool.getShareValue(shares)).to.equal(getBigNumber("500"))
      expect(await this.capitalAgent.totalCapitalStaked()).to.equal(getBigNumber("5500"))

      // Check rewards were distributed
      const pendingAfter = await this.pool.pendingRewards(this.signers[2].address)
      expect(pendingAfter).to.not.equal(pendingBefore)
    })

    describe("Rewards", function () {
      beforeEach(async function () {
        // Fund rewarder with USDM tokens
        await this.usdmToken.mint(this.rewarderAddress, getBigNumber("10000"))

        // Set reward rate
        await this.pool.connect(this.signers[0]).setRewardMultiplier(getBigNumber("1"))
      })

      it("should accumulate rewards over time", async function () {
        await this.pool.connect(this.signers[2]).enterInPool(getBigNumber("100"))

        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 100)

        const pendingReward = await this.pool.pendingRewards(this.signers[2].address)
        expect(pendingReward).to.be.gt(0)
      })

      it("should distribute rewards on multiplier increase", async function () {
        await this.pool.connect(this.signers[2]).enterInPool(getBigNumber("100"))

        // Simulate USDM rebase (10% increase)
        await this.usdmToken.setRewardMultiplier(getBigNumber("1.1"))

        const pendingReward = await this.pool.pendingRewards(this.signers[2].address)
        expect(pendingReward).to.be.gt(0)
      })

      it("should harvest rewards", async function () {
        await this.pool.connect(this.signers[2]).enterInPool(getBigNumber("100"))

        // Generate rewards
        const beforeBlockNumber = await ethers.provider.getBlockNumber()
        await advanceBlockTo(beforeBlockNumber + 100)
        await this.usdmToken.setRewardMultiplier(getBigNumber("1.1"))

        const beforeBalance = await this.usdmToken.balanceOf(this.signers[2].address)
        await this.pool.connect(this.signers[2]).harvest(this.signers[2].address)
        expect(await this.usdmToken.balanceOf(this.signers[2].address)).to.be.gt(beforeBalance)
      })
    })
  })
})
