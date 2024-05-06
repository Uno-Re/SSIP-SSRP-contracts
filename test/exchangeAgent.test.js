const { expect } = require("chai")


const { ethers, network } = require("hardhat")
const { getBigNumber } = require("../scripts/shared/utilities")

const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")

const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,

} = require("../scripts/shared/constants")


describe("ExchangeAgent", function () {
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
    this.OptimisticOracleV3 = await ethers.getContractFactory("OptimisticOracleV3")
    this.SalesPolicy = await ethers.getContractFactory("MockSalesPolicy")
    this.SalesPolicyFactory = await ethers.getContractFactory("MockSalesPolicyFactory")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000";

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
    this.txIdx = 0

  })

  beforeEach(async function () {
    this.mockUNO = await this.MockUNO.deploy()
    this.mockUSDT = await this.MockUSDT.deploy()
    await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000000000"), { from: this.signers[0].address })
    await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("50000000000000"), { from: this.signers[0].address })
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
    const timestamp = new Date().getTime()
    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);


    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("100000000000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.sepolia, getBigNumber("100000000000000"), { from: this.signers[0].address })
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

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);
    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.sepolia,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.sepolia,
      UNISWAP_FACTORY_ADDRESS.sepolia,
      this.multiSigWallet.target,
      getBigNumber("60")
    )

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [this.multiSigWallet.target],
      });
  
      await network.provider.send("hardhat_setBalance", [
        this.multiSigWallet.target,
        "0x1000000000000000000000000000000000",
      ]);
  
      this.multisig = await ethers.getSigner(this.multiSigWallet.target)

  })

  describe("exchangeAgent contract initialiation", function () {
    it("should not allow others to set twapPriceFeed contract address", async function () {
      await expect(
        this.exchangeAgent
          .connect(this.signers[1])
          .setOraclePriceFeed(this.mockOraclePriceFeed.target, { from: this.signers[1].address }),
      ).to.be.revertedWithCustomError(this.exchangeAgent, "OwnableUnauthorizedAccount").withArgs(this.signers[1].address);
    })

    it("should not allow others to set slippage", async function () {
      await expect(
        this.exchangeAgent.connect(this.signers[1]).setSlippage(10, { from: this.signers[1].address }),
      ).to.be.revertedWithCustomError(this.exchangeAgent, "OwnableUnauthorizedAccount").withArgs(this.signers[1].address);
    })

    it("should add white list", async function () {
      await this.exchangeAgent.connect(this.multisig).addWhiteList(this.signers[5].address)
      const whiteList = await this.exchangeAgent.whiteList(this.signers[5].address)
      expect(whiteList).to.equal(true)
    })
  })

  describe("token exchange test", function () {
    beforeEach(async function () {
      let encodedCallData
      encodedCallData = this.exchangeAgent.interface.encodeFunctionData("setSlippage", [5])

    expect(await this.multiSigWallet.submitTransaction(this.exchangeAgent.target, 0, encodedCallData)).to.emit(this.multiSigWallet, "SubmitTransaction").withArgs(this.signers[0].address, this.txIdx, this.exchangeAgent.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.exchangeAgent.interface.encodeFunctionData("addWhiteList", [this.signers[1].address])

      await expect(this.multiSigWallet.submitTransaction(this.exchangeAgent.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.exchangeAgent.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
        await this.exchangeAgent.connect(this.multisig).setSlippage(5)
    })
    it("Should not allow others to convert tokens", async function () {
      await (
        await this.mockUNO
          .connect(this.signers[1])
          .approve(this.exchangeAgent.target, getBigNumber("10000000"), { from: this.signers[1].address })
      ).wait()

      await expect(
        this.exchangeAgent
          .connect(this.signers[2])
          .convertForToken(this.mockUNO.target, this.mockUSDT.target, getBigNumber("2000"), { from: this.signers[2].address }),
      ).to.be.revertedWith("UnoRe: ExchangeAgent Forbidden")
    })

    // it("should convert UNO to USDT", async function () {
        // const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[0].address)
        //       await (
        //         await this.mockUNO
        //           .connect(this.signers[0])
        //           .approve(this.exchangeAgent.target, getBigNumber("10000000"), { from: this.signers[0].address })
        //       ).wait()
        //       await this.mockUNO
        //         .connect(this.signers[0])
        //         .transfer(this.exchangeAgent.target, getBigNumber("2000"), { from: this.signers[0].address })
        //       const usdtConvert = await (
        //         await this.exchangeAgent.convertForToken(this.mockUNO.target, this.mockUSDT.target, getBigNumber("2000"))
        //       ).wait()
        //       const convertedAmount = usdtConvert.events[usdtConvert.events.length - 1].args._convertedAmount
        //       const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.signers[0].address)
        //       expect(usdtBalanceAfter).to.equal(usdtBalanceBefore.add(convertedAmount))
    // })
  })
})
