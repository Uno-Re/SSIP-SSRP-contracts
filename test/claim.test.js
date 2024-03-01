const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")
const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../scripts/shared/utilities")
const { BigNumber } = ethers
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

describe("SingleSidedInsurance claim policy", function () {
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
    this.OptimisticOracleV3 = await ethers.getContractFactory("OptimisticOracleV3")
    this.SalesPolicy = await ethers.getContractFactory("MockSalesPolicy")
    this.SalesPolicyFactory = await ethers.getContractFactory("MockSalesPolicyFactory")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")
    this.signers = await ethers.getSigners()
    this.zeroAddress = "0x0000000000000000000000000000000000000000";

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
    await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000"), { from: this.signers[2].address });

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
      TWAP_ORACLE_PRICE_FEED_FACTORY.rinkeby,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multisig.address,
      getBigNumber("60")
    )
    this.capitalAgent = await upgrades.deployProxy(
      this.CapitalAgent, [
        this.exchangeAgent.target, 
        this.mockUSDT.target,
        this.multisig.address,
        this.signers[0].address]
    );

    this.premiumPool = await this.PremiumPool.deploy(
      this.exchangeAgent.target,
      this.mockUNO.target,
      this.mockUSDT.target,
      this.multisig.address,
      this.signers[0].address
    )

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB");
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address);

    this.singleSidedInsurancePool = await upgrades.deployProxy(
      this.SingleSidedInsurancePool, [
        this.capitalAgent.target,
        "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
      ]
    );

    await (await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool.target)).wait()
    let adminRole = await this.singleSidedInsurancePool.ADMIN_ROLE();

    await this.singleSidedInsurancePool.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )
    this.rewardertarget = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewardertarget)

    expect(this.rewarder.target).equal(await this.singleSidedInsurancePool.rewarder())

    await (await this.mockUNO.transfer(this.rewarder.target, getBigNumber("100000"))).wait()

    this.rewardAttack = await this.RewardAttack.deploy()

    this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(this.mockUSDT.target, this.mockUSDT.target,this.mockUSDT.target, this.capitalAgent.target, this.signers[0].address);
  })

  describe("SingleSidedInsurancePool Actions", function () {
    beforeEach(async function () {
      console.log("[action start ========>]")
      await this.singleSidedInsurancePool.connect(this.multisig).createRiskPool(
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
      await this.singleSidedInsurancePool.connect(this.signers[2]).enterInPool(getBigNumber("8500"), {from: this.signers[2].address})

      await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.optimisticOracleV3.target);
    })

    describe("SingleSidedInsurancePool Claim", function () {

      it("Should claim by claimAssessor and then check LP token worth", async function () {
        await this.capitalAgent.setMLR(getBigNumber("10"));
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))
        const riskPool = this.RiskPool.attach(this.poolAddress)
        await this.capitalAgent.connect(this.multisig).setSalesPolicyFactory(this.salesPolicyFactory.target);
        let salesPolicy = await this.salesPolicyFactory.newSalesPolicy(this.exchangeAgent.target, this.mockUNO.target, this.capitalAgent.target);
        let a = await this.capitalAgent.getPolicyInfo();
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("1000"))
        this.salesPolicy = await ethers.getContractAt("MockSalesPolicy", a[0]);
        await this.salesPolicy.buyPol(1000, this.mockUNO.target, getBigNumber("105"));
        const lpPriceBefore = await riskPool.lpPriceUno()
        expect(lpPriceBefore).to.equal(getBigNumber("1"))
        let b = await this.salesPolicy.getPolicyData(1000);
        await time.increaseTo(30000122335);
        // await this.optimisticOracleV3.settleAssertion(id);
        expect(await this.mockUSDT.balanceOf(this.signers[5].address)).to.equal(getBigNumber("0"));
      })

      it("Should dispute policy", async function () {
        await this.escalationManager.toggleDisputer(this.signers[0].address);

        await this.capitalAgent.setMLR(getBigNumber("10"));
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("10000"))
        const riskPool = this.RiskPool.attach(this.poolAddress)
        await this.capitalAgent.connect(this.multisig).setSalesPolicyFactory(this.salesPolicyFactory.target);
        let salesPolicy = await this.salesPolicyFactory.newSalesPolicy(this.exchangeAgent.target, this.mockUNO.target, this.capitalAgent.target);
        let a = await this.capitalAgent.getPolicyInfo();
        await this.singleSidedInsurancePool.enterInPool(getBigNumber("1000"))
        this.salesPolicy = await ethers.getContractAt("MockSalesPolicy", a[0]);
        await this.salesPolicy.buyPol(1000, this.mockUNO.target, getBigNumber("105"));
        const lpPriceBefore = await riskPool.lpPriceUno()
        expect(lpPriceBefore).to.equal(getBigNumber("1"))
        let b = await this.salesPolicy.getPolicyData(1000);
        // await this.optimisticOracleV3.disputeAssertion(id, this.signers[0].address);
        await time.increaseTo(40000122335);
        // await this.optimisticOracleV3.settleAssertion(id);

        expect(await this.mockUSDT.balanceOf(this.signers[5].address)).to.equal(getBigNumber("0"));
        expect(await this.salesPolicy.ownerOf(1000)).to.equal(this.signers[0].address);
      })
    })
  })
})
