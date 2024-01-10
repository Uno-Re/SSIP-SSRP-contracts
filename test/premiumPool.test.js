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

describe("Premium Pool", function () {
  before(async function () {
    this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.SingleSidedReinsurancePool = await ethers.getContractFactory("SingleSidedReinsurancePool")
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
    this.MockOraclePriceFeed = await ethers.getContractFactory("MockOraclePriceFeed")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")

    this.SyntheticSSRP = await ethers.getContractFactory("SyntheticSSRP")
    this.SyntheticSSRPFactory = await ethers.getContractFactory("SyntheticSSRPFactory")

    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000";

    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.rinkeby,
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
    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
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
    this.syntheticSSRPFactory = await this.SyntheticSSRPFactory.deploy()

    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))

    const assetArray = [this.mockUSDT.target, this.mockUNO.target, this.zeroAddress]

    const timestamp = new Date().getTime()

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("100000000000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("100000000000000"), { from: this.signers[0].address })
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

    await (
      await this.routerContract
        .connect(this.signers[0])
        .addLiquidityETH(
          this.mockUNO.target,
          getBigNumber("3000000"),
          getBigNumber("3000000"),
          getBigNumber("3"),
          this.signers[0].address,
          timestamp,
          { from: this.signers[0].address, value: getBigNumber("3"), gasLimit: 9999999 },
        )
    ).wait()

    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.rinkeby,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multiSigWallet.target,
    )

    this.premiumPool = await this.PremiumPool.deploy(
      this.exchangeAgent.target,
      this.mockUNO.target,
      this.mockUSDT.target,
      this.multiSigWallet.target,
      this.signers[0].address
    )

    this.capitalAgent = await upgrades.deployProxy(
      this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUSDT.target,
      this.multiSigWallet.target,
      this.signers[0].address]
    );

    this.txIdx = 0
    let encodedCallData

    encodedCallData = this.exchangeAgent.interface.encodeFunctionData("addWhiteList", [this.premiumPool.target])

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

    // await this.exchangeAgent.addWhiteList(this.premiumPool.address)

    this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
      this.mockUSDT.target,
      this.exchangeAgent.target,
      this.premiumPool.target,
      this.capitalAgent.target,
      this.multiSigWallet.target,
    )

    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(this.premiumPool.target, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()

    encodedCallData = this.premiumPool.interface.encodeFunctionData("addCurrency", [this.mockUSDT.target])

    await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      "0x1000000000000000000000000000000000",
    ]);

    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6")

    this.singleSidedReinsurancePool = await upgrades.deployProxy(
      this.SingleSidedReinsurancePool, [
      this.signers[0].address,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
    ]
    );

    await this.singleSidedReinsurancePool.grantRole((await this.singleSidedReinsurancePool.ADMIN_ROLE()), this.multiSigWallet.target);

    encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createRewarder", [
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    ])

    await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++

    this.rewarderAddress = await this.singleSidedReinsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    expect(this.rewarder.target).equal(await this.singleSidedReinsurancePool.rewarder())

    encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createRiskPool", [
      "UNO-LP",
      "UNO-LP",
      this.riskPoolFactory.target,
      this.mockUNO.target,
      getBigNumber("1"),
    ])

    await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++

    this.riskPoolAddress = await this.singleSidedReinsurancePool.riskPool()

    this.riskPool = await this.RiskPool.attach(this.riskPoolAddress)

    encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createSyntheticSSRP", [
      this.signers[0].address,
      this.syntheticSSRPFactory.target,
    ])

    await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++

    this.syntheticSSRPAddr = await this.singleSidedReinsurancePool.syntheticSSRP()
    console.log(this.syntheticSSRPAddr)

    this.syntheticSSRP = await this.SyntheticSSRP.attach(this.syntheticSSRPAddr)
    await this.syntheticSSRP.grantRole((await this.syntheticSSRP.ADMIN_ROLE()), this.multiSigWallet.target);

    encodedCallData = this.syntheticSSRP.interface.encodeFunctionData("createRewarder", [
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUSDT.target,
    ])

    await expect(this.multiSigWallet.submitTransaction(this.syntheticSSRP.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.syntheticSSRP.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++

    this.syntheticRewarderAddr = await this.syntheticSSRP.rewarder()
    this.syntheticRewarder = await this.Rewarder.attach(this.syntheticRewarderAddr)
  })

  describe("Premium Pool Collecting", function () {
    beforeEach(async function () {
      await (
        await this.mockUSDT
          .connect(this.signers[0])
          .approve(this.premiumPool.target, getBigNumber("10000000"), { from: this.signers[0].address })
      ).wait()
    })

    it("Should collet USDT", async function () {
      await (await this.premiumPool.collectPremium(this.mockUSDT.target, getBigNumber("10000", 6))).wait()
      const premiumForSSRP = await this.premiumPool.ssrpPremium(this.mockUSDT.target)
      const premiumForSSIP = await this.premiumPool.ssipPremium(this.mockUSDT.target)
      const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.mockUSDT.target)
      expect(premiumForSSRP).to.equal(getBigNumber("1000", 6))
      expect(premiumForSSIP).to.equal(getBigNumber("7000", 6))
      expect(premiumForBackBurn).to.equal(getBigNumber("2000", 6))
    })
    it("Should collet ETH", async function () {
      await (
        await this.premiumPool
          .connect(this.signers[0])
          .collectPremiumInETH({ from: this.signers[0].address, value: getBigNumber("100") })
      ).wait()
      const premiumForSSRP = await this.premiumPool.ssrpPremiumEth()
      const premiumForSSIP = await this.premiumPool.ssipPremiumEth()
      const premiumForBackBurn = await this.premiumPool.backBurnPremiumEth()
      expect(premiumForSSRP).to.equal(getBigNumber("10"))
      expect(premiumForSSIP).to.equal(getBigNumber("70"))
      expect(premiumForBackBurn).to.equal(getBigNumber("20"))
    })
  })

  describe("Premium Pool distribution", function () {
    beforeEach(async function () {
      await (
        await this.mockUSDT
          .connect(this.signers[0])
          .approve(this.premiumPool.target, getBigNumber("10000000"), { from: this.signers[0].address })
      ).wait()
      await (await this.premiumPool.collectPremium(this.mockUSDT.target, getBigNumber("10000", 6))).wait()
      await (
        await this.premiumPool
          .connect(this.signers[0])
          .collectPremiumInETH({ from: this.signers[0].address, value: getBigNumber('1') })
      ).wait()
    })
    it("Should deposit to Synthetic SSRP Rewarder", async function () {
      const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.syntheticRewarder.target)
      expect(usdtBalanceBefore).to.equal(0)
      const premiumForSSRP1 = await this.premiumPool.ssrpPremium(this.mockUSDT.target)
      expect(premiumForSSRP1).to.equal(getBigNumber("1000", 6))

      let encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSRPRewarder", [
        this.syntheticRewarder.target,
      ])

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.syntheticRewarder.target)
      console.log("[eth balance of rewarder after distribute]", usdtBalanceAfter.toString())
      console.log(getBigNumber("1000", 6));
      console.log(usdtBalanceAfter, "adfdasfdas");
      expect(usdtBalanceAfter).to.be.equal(getBigNumber("1000", 6))
      const premiumForSSRP2 = await this.premiumPool.ssrpPremium(this.mockUSDT.target)
      expect(premiumForSSRP2).to.equal(getBigNumber("0"))
      const premiumETHForSSRP = await this.premiumPool.ssrpPremiumEth()
      expect(premiumETHForSSRP).to.equal(getBigNumber("0"))
    })
    // it("Should distribute to Synthetic SSIP Rewarder", async function () {
    //   const ethBalanceBefore = await ethers.provider.getBalance(this.syntheticRewarder.target)
    //   let premiumETHForSSIP = await this.premiumPool.ssipPremiumEth()
    //   expect(premiumETHForSSIP).to.equal(getBigNumber("7", 17));

    //   let encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSIPRewarder", [
    //     this.zeroAddress,
    //     this.syntheticRewarder.target,
    //     getBigNumber("7", 17)
    //   ]);

    //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
    //     .to.emit(this.multiSigWallet, "SubmitTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

    //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx)

    //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[1].address, this.txIdx)

    //   this.txIdx++;

    //   const ethBalanceAfter = await ethers.provider.getBalance(this.syntheticRewarder.target)
    //   premiumETHForSSIP = await this.premiumPool.ssipPremiumEth()
    //   expect(premiumETHForSSIP).to.equal(getBigNumber("0"))
    //   expect(ethBalanceAfter).to.equal(ethBalanceBefore + getBigNumber("7", 17))

    //   const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[5].address)
    //   expect(usdtBalanceBefore).to.equal(0)

    //   let premiumForSSIP = await this.premiumPool.ssipPremium(this.mockUSDT.target)
    //   expect(premiumForSSIP).to.equal(getBigNumber("7000", 6));

    //   encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSIPRewarder", [
    //     this.mockUSDT.target,
    //     this.syntheticRewarder.target,
    //     premiumForSSIP
    //   ]);

    //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
    //     .to.emit(this.multiSigWallet, "SubmitTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

    //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx)

    //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[1].address, this.txIdx)

    //   this.txIdx++;

    //   const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.syntheticRewarder.target)
    //   expect(usdtBalanceAfter).to.equal(getBigNumber("7000", 6))

    //   premiumForSSIP = await this.premiumPool.ssipPremium(this.mockUSDT.target)
    //   expect(premiumForSSIP).to.equal(0)
    // })
    // it("Should back UNO and burn", async function () {
    //   let premiumForBackBurnETH = await this.premiumPool.backBurnPremiumEth()
    //   expect(premiumForBackBurnETH).to.equal(getBigNumber("2", 17))
    //   let premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.mockUSDT.target)
    //   expect(premiumForBackBurn).to.equal(getBigNumber("2000", 6))

    //   let encodedCallData = this.premiumPool.interface.encodeFunctionData("buyBackAndBurn", []);

    //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
    //     .to.emit(this.multiSigWallet, "SubmitTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

    //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[0].address, this.txIdx)

    //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
    //     .withArgs(this.signers[1].address, this.txIdx)

    //   this.txIdx++;

    //   premiumForBackBurnETH = await this.premiumPool.backBurnPremiumEth()
    //   expect(premiumForBackBurnETH).to.equal(getBigNumber("0"))
    //   premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.mockUSDT.target)
    //   expect(premiumForBackBurn).to.equal(getBigNumber("0"))
    // })
  })
})
