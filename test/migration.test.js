const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")

const {
  getBigNumber,
  advanceBlockTo,
} = require("../scripts/shared/utilities")

const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")

const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS
} = require("../scripts/shared/constants")
const OptimisticOracleV3Abi = require("../scripts/abis/OptimisticOracleV3.json");

describe("Migration", function () {
  before(async function () {
    this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
    this.capitalAgent = await ethers.getContractAt("CapitalAgent", "0xd49AEEAB29e098B18f6494b34C9279fe858c60ce");
    this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent1")
    this.premiumPool = await ethers.getContractAt("PremiumPool", "0x31d20E7d8bEaF36Cfe8369EB8FBC846B5466c983")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.rewarderFactory = await ethers.getContractAt("RewarderFactory", "0xb57acc8fd268Ce272419Cc4A69195eD1F5A30b0B")
    this.riskPoolFactory = await ethers.getContractAt("RiskPoolFactory", "0x6E6c4336a4C11d4af250dCd4a9266a85847ABb52")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.exchangeAgent = await ethers.getContractAt("ExchangeAgent", "0xa64D680DdDFb738c7681ED18CA1E289fB0e6b24f");
    this.mockUSDT = await ethers.getContractAt("MockUSDT", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48");
    this.mockUNO = await ethers.getContractAt("MockUNO", "0x474021845C4643113458ea4414bdb7fB74A01A77")
    this.salesPolicyFactory = await ethers.getContractAt("SalesPolicyFactory", "0x9848142dB4A7673fEcC2F1F397f5B8CA6AF120d4");
    this.SalesPolicy = await ethers.getContractFactory("SalesPolicy");
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.singleSidedInsurancePool = await ethers.getContractAt("SingleSidedInsurancePool", "0xd87a4214EDa400Ed376EaaC0aEd9d1414D71581C");
    this.mockOraclePriceFeed = await ethers.getContractAt("PriceOracle", "0x0222380d514FA7cf987004ECcD1cD74df2C6c65f");
    this.escalationManager = await ethers.getContractAt("EscalationManager", "0xDB99B62bd15e88Fe995dCE4d959aCc3B82Eb9d92");
    this.payoutRequest = await ethers.getContractAt("PayoutRequest", "0xA95cb0641b7dC9141339FC3AFC293eEEf74f7cE7")
    this.PayoutRequest = await ethers.getContractFactory("PayoutRequest")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.ZeroAddress;

    this.whale = await ethers.getImpersonatedSigner('0x7d6149aD9A573A6E2Ca6eBf7D4897c1B766841B4');
    this.usdtWhale = await ethers.getImpersonatedSigner("0xD6153F5af5679a75cC85D8974463545181f48772");
    this.unoWhale = await ethers.getImpersonatedSigner("0x4aede441085398BD74FeB9eeFCfe08E709e69ABF");
    this.deployer = await ethers.getImpersonatedSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")
    await this.whale.sendTransaction({
      to: this.usdtWhale.address,
      value: getBigNumber('100'),
    });
    await this.whale.sendTransaction({
      to: this.deployer.address,
      value: getBigNumber('100'),
    });
    await this.whale.sendTransaction({
      to: this.unoWhale.address,
      value: getBigNumber('100'),
    });
    await this.whale.sendTransaction({
      to: this.signers[0].address,
      value: getBigNumber('100'),
    });
    await this.whale.sendTransaction({
      to: this.signers[0].address,
      value: getBigNumber('100'),
    });
    await this.whale.sendTransaction({
      to: this.signers[0].address,
      value: getBigNumber('100'),
    });


    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      JSON.stringify(UniswapV2Router.abi),
      ethers.provider,
    )
    this.devWallet = this.signers[0]
    this.chainId = (await ethers.provider.getNetwork()).chainId
    this.domainType = [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
    ]
    this.metaTransactionType = [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "functionSignature", type: "bytes" },
    ]

    this.owners = [
      this.signers[0].address,
      this.signers[1].address,
      this.signers[2].address,
      this.signers[3].address,
      this.signers[4].address,
    ]

    this.numConfirmationsRequired = 2

    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[0].address, getBigNumber("100000000"))
    await this.mockUSDT.connect(this.usdtWhale).approve(this.signers[0].address, 1);
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[0].address, getBigNumber("100000000", 6))

    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[1].address, getBigNumber("1000000"));
    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[2].address, getBigNumber("1000000"));
    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[3].address, getBigNumber("1000000"));
    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[4].address, getBigNumber("1000000"));
    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[5].address, getBigNumber("500000")); await this.mockUNO.connect(this.unoWhale).transfer(this.signers[6].address, getBigNumber("1000000"));
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[1].address, getBigNumber("1000000", 6))
    await this.mockUNO.connect(this.unoWhale).transfer(this.signers[2].address, getBigNumber("1000000"))
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[2].address, getBigNumber("1000000", 6))
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[3].address, getBigNumber("100000", 6))
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[4].address, getBigNumber("100000", 6))
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[5].address, getBigNumber("100000", 6))
    await this.mockUSDT.connect(this.usdtWhale).transfer(this.signers[6].address, getBigNumber("100000", 6));
  })

  before(async function () {
    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
 
    let timestamp = new Date().getTime()
    await (
      await this.mockUNO
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.mainnet, getBigNumber("100000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.mainnet, getBigNumber("100000", 6), { from: this.signers[0].address })
    ).wait()

    await (
      await this.routerContract
        .connect(this.signers[0])
        .addLiquidity(
          this.mockUNO.target,
          this.mockUSDT.target,
          getBigNumber("100000"),
          getBigNumber("1000", 6),
          getBigNumber("100000"),
          getBigNumber("1000", 6),
          this.signers[0].address,
          timestamp,
          { from: this.signers[0].address, gasLimit: 9999999 },
        )
    ).wait()
    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
    // multisig address
    this.multisig = await ethers.getSigner("0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e"],
    });

    await network.provider.send("hardhat_setBalance", [
      "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e",
      "0x1000000000000000000000000000000000",
    ]);

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired);

    await this.premiumPool.connect(this.deployer).grantRole((await this.premiumPool.ADMIN_ROLE()), this.signers[0].address);

    let encodedCallData
    this.txIdx = 0

    // add 2 protocols
    for (let idx = 0; idx < 3; idx++) {
      await this.salesPolicyFactory.connect(this.deployer).addProtocol(this.signers[idx + 1].address);
    }

    expect(await this.salesPolicyFactory.connect(this.deployer).allProtocolsLength()).equal(3)

    //await this.premiumPool.addCurrency(this.mockUSDT.target);

    // await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()
    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0xfb55F43fB9F48F63f9269DB7Dde3BbBe1ebDC0dE");
    // this.AddressWhitelist = await ethers.getContractAt("IAddressWhitelist", "0x63fDfF29EBBcf1a958032d1E64F7627c3C98A059")
    // this.MockOracleAncillary = await ethers.getContractAt('MockOracleAncillaryInterface', '0x20570E9e27920aC5E2601E0bef7244DeFf7F0B28');
    // this.FeeManager = await ethers.getContractAt("IFeeManger", "0x07417cA264170Fc5bD3568f93cFb956729752B61")
    //this.admin = await ethers.getImpersonatedSigner("0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D");
    // await this.AddressWhitelist.connect(this.admin).addToWhitelist(this.mockUNO.target);
    // await this.FeeManager.connect(this.admin).setFinalFee(this.mockUNO.target, [10]);
    // await this.optimisticOracleV3.connect(this.admin).setAdminProperties(this.mockUNO.target, 120, ethers.parseEther("0.1"))


    this.singleSidedInsurancePool1 = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e"
    ]);

    await this.singleSidedInsurancePool.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )

    await this.singleSidedInsurancePool1.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )

    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    this.rewarderAddress1 = await this.singleSidedInsurancePool1.rewarder()
    this.rewarder1 = await this.Rewarder.attach(this.rewarderAddress1)

    this.payoutRequest = await upgrades.deployProxy(this.PayoutRequest, [
      this.singleSidedInsurancePool.target,
      this.optimisticOracleV3.target,
      await (this.optimisticOracleV3.defaultCurrency()),
      this.escalationManager.target,
      this.signers[0].address,
      this.signers[0].address,
    ]);

    await this.singleSidedInsurancePool.connect(this.deployer).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.payoutRequest.target)

    await this.capitalAgent.connect(this.deployer).addPoolWhiteList(this.singleSidedInsurancePool1.target);
    await this.capitalAgent.connect(this.deployer).setSalesPolicyFactory(this.salesPolicyFactory.target);

    console.log('[setSalesPolicyFactory]')

    await this.singleSidedInsurancePool1.connect(this.multisig).createRiskPool(
      "UNO-LP",
      "UNO-LP",
      this.riskPoolFactory.target,
      this.mockUNO.target,
      getBigNumber("1"),
      getBigNumber("0"),
    )

    await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
    await this.mockUNO
      .connect(this.signers[1])
      .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .transfer(this.rewarder.target, getBigNumber("100000"), { from: this.signers[0].address })
    ).wait()

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .transfer(this.rewarder1.target, getBigNumber("100000"), { from: this.signers[0].address })
    ).wait()

    await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))
    let amount = await this.capitalAgent.checkCapitalByMCR(this.singleSidedInsurancePool.target, getBigNumber("100000"));

    // // block number when deposit in pool for the first time
    const beforeBlockNumber = await ethers.provider.getBlockNumber()

    await advanceBlockTo(beforeBlockNumber + 10000)

    //await this.capitalAgent.setMCR(getBigNumber("1", 16));

    //await this.capitalAgent.setMLR(getBigNumber("3"));
    // // another one will deposit in pool with the same amount
    await this.singleSidedInsurancePool
      .connect(this.signers[1])
      .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })

    await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))

    this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
    this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())

    await this.salesPolicyFactory.connect(this.deployer).setSignerInPolicy(this.signers[0].address);

    await this.payoutRequest.setCapitalAgent(this.capitalAgent.target);
    let riskPool1 = await this.singleSidedInsurancePool1.riskPool();
    this.riskpool1 = this.RiskPool.attach(riskPool1);
    await this.mockUNO.transfer(riskPool1, getBigNumber("200000"))
  })

  describe("migration of users in ssip and ssrp", function () {
    it("Should update rewardDebt and user amount in new version of ssip", async function () {
      let poolCapital = (await this.capitalAgent.poolInfo(this.singleSidedInsurancePool.target)).totalCapital;
      await this.capitalAgent.connect(this.deployer).setPoolCapital(this.singleSidedInsurancePool1.target, poolCapital);
      let userInfo1 = await this.singleSidedInsurancePool.userInfo(this.signers[0].address);
      await this.singleSidedInsurancePool1.connect(this.multisig).setUserDetails(this.signers[0].address, userInfo1.amount, userInfo1.rewardDebt);
      expect((await this.singleSidedInsurancePool.userInfo(this.signers[0].address)).rewardDebt).to.equal((await this.singleSidedInsurancePool1.userInfo(this.signers[0].address)).rewardDebt);

      let userInfo2 = await this.singleSidedInsurancePool.userInfo(this.signers[1].address);
      await this.singleSidedInsurancePool1.connect(this.multisig).setUserDetails(this.signers[1].address, userInfo2.amount, userInfo2.rewardDebt);
      expect((await this.singleSidedInsurancePool.userInfo(this.signers[1].address)).rewardDebt).to.equal((await this.singleSidedInsurancePool1.userInfo(this.signers[1].address)).rewardDebt);
      let poolInfoInssip = await this.singleSidedInsurancePool.poolInfo();
      await this.singleSidedInsurancePool1.connect(this.multisig).setAccUnoPerShare(poolInfoInssip.accUnoPerShare, poolInfoInssip.lastRewardBlock);
      let poolInfoINssip1 = await this.singleSidedInsurancePool1.poolInfo();
      expect(poolInfoInssip.accUnoPerShare).to.equal(poolInfoINssip1.accUnoPerShare);

      await this.singleSidedInsurancePool1.connect(this.multisig).setLockTime(1);
      await this.singleSidedInsurancePool.connect(this.deployer).setLockTime(1);

      await this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200000"));
      await this.singleSidedInsurancePool1.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("100000"));

      await this.singleSidedInsurancePool.leaveFromPoolInPending(getBigNumber("200000"));

      const beforeBlockNumber = await ethers.provider.getBlockNumber()
      await advanceBlockTo(beforeBlockNumber + 10000)

      let beforeBalanceOfuser1 = await this.mockUNO.balanceOf(this.signers[0].address);
      let beforeBalanceOfuser2 = await this.mockUNO.balanceOf(this.signers[1].address);
      const lpprice = (await this.riskpool1.lpPriceUno()).toString();
      const LPPrice =  ethers.formatEther(lpprice);
      console.log('lp',LPPrice);
      await expect(this.singleSidedInsurancePool1.leaveFromPending(getBigNumber("200000"))).changeTokenBalance(this.mockUNO,this.signers[0].address,Math.trunc(Number(getBigNumber("200000")) * (LPPrice)));
      await expect(this.singleSidedInsurancePool1.leaveFromPending(getBigNumber("100000"))).changeTokenBalance(this.mockUNO,this.signers[0].address,Math.trunc(Number(getBigNumber("100000")) * (LPPrice)))
   
      let afterBalanceOfuser1 = await this.mockUNO.balanceOf(this.signers[0].address);
      let afterBalanceOfuser2 = await this.mockUNO.balanceOf(this.signers[1].address);

      let difffInUnoBalancOfUser1 = afterBalanceOfuser1 - beforeBalanceOfuser1;
      await this.singleSidedInsurancePool.leaveFromPending(getBigNumber("200000"));
      let afterLeaveFromSSIPuser1 = await this.mockUNO.balanceOf(this.signers[0].address);
      expect(afterLeaveFromSSIPuser1 - afterBalanceOfuser1).to.equal(difffInUnoBalancOfUser1);
    })

  })
})