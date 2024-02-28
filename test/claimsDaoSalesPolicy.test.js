const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")
const sigUtil = require("eth-sig-util")
// const { Biconomy } = require('@biconomy/mexa');
const {
  getBigNumber,
  getNumber,
  getHexStrFromStr,
  getPaddedHexStrFromBN,
  getPaddedHexStrFromBNArray,
  getChainId,
  getSignatureParameters,
  advanceBlockTo,
} = require("../scripts/shared/utilities")
const { BigNumber } = ethers
const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
const ERC20 = require("../scripts/abis/ERC20.json")
const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
} = require("../scripts/shared/constants")
const OptimisticOracleV3Abi = require("../scripts/abis/OptimisticOracleV3.json");

describe("CLaimsDao SalesPolicy", function () {
  before(async function () {
    this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent1")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.MockUNO = await ethers.getContractFactory("MockUNO")
    this.MockUSDT = await ethers.getContractFactory("MockUSDT")
    this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
    this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.MockOraclePriceFeed = await ethers.getContractFactory("MockOraclePriceFeed")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.PayoutRequest = await ethers.getContractFactory("PayoutRequest")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.ZeroAddress;
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
  })

  beforeEach(async function () {
    this.mockUNO = await this.MockUNO.deploy()
    this.mockUSDT = await this.MockUSDT.deploy()
    await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber("500000000"), { from: this.signers[0].address })
    await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber("500000"), { from: this.signers[0].address })
    await this.mockUNO.connect(this.signers[1]).faucetToken(getBigNumber("500000000"), { from: this.signers[1].address })
    await this.mockUSDT.connect(this.signers[1]).faucetToken(getBigNumber("500000"), { from: this.signers[1].address })
    await this.mockUNO.connect(this.signers[2]).faucetToken(getBigNumber("500000000"), { from: this.signers[2].address })
    await this.mockUSDT.connect(this.signers[2]).faucetToken(getBigNumber("500000"), { from: this.signers[2].address })
    await this.mockUNO.connect(this.signers[4]).faucetToken(getBigNumber("500000"), { from: this.signers[4].address })
    await this.mockUNO.connect(this.signers[5]).faucetToken(getBigNumber("500000"), { from: this.signers[5].address })
    await this.mockUNO.connect(this.signers[6]).faucetToken(getBigNumber("500000"), { from: this.signers[6].address })
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.assertor = this.signers[6]
    this.disputor = this.signers[7]
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
    this.mockUNO.transfer(this.disputor.address, getBigNumber("3000000"))


    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
    let timestamp = new Date().getTime()

    // multisig address
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
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()
    await (
      await this.mockUSDT
        .connect(this.signers[0])
        .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber("10000000"), { from: this.signers[0].address })
    ).wait()

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

    this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired);
    this.mockOraclePriceFeed = await this.MockOraclePriceFeed.deploy(this.mockUNO.target, this.mockUSDT.target);
    this.rewarderFactory = await this.RewarderFactory.deploy()

    this.exchangeAgent = await this.ExchangeAgent.deploy(
      this.mockUSDT.target,
      WETH_ADDRESS.rinkeby,
      this.mockOraclePriceFeed.target,
      UNISWAP_ROUTER_ADDRESS.rinkeby,
      UNISWAP_FACTORY_ADDRESS.rinkeby,
      this.multisig.address,
      getBigNumber("60")
    )

    this.premiumPool = await this.PremiumPool.deploy(
      this.exchangeAgent.target,
      this.mockUNO.target,
      this.mockUSDT.target,
      this.multisig.address,
      this.signers[0].address,
    )

    await this.premiumPool.connect(this.multisig).grantRole((await this.premiumPool.ADMIN_ROLE()), this.signers[0].address);

    this.capitalAgent = await upgrades.deployProxy(this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUSDT.target,
      this.multisig.address,
      this.signers[0].address,
    ])
    this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
      this.mockUSDT.target,
      this.exchangeAgent.target,
      this.premiumPool.target,
      this.capitalAgent.target,
      this.multisig.address,
    )

    let encodedCallData
    this.txIdx = 0

    // add 2 protocols
    for (let idx = 0; idx < 3; idx++) {
      await this.salesPolicyFactory.connect(this.multisig).addProtocol(this.signers[idx + 1].address);
    }

    expect(await this.salesPolicyFactory.connect(this.multisig).allProtocolsLength()).equal(3)

    await this.premiumPool.addCurrency(this.mockUSDT.target);

    // await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()
    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB");
    this.AddressWhitelist = await ethers.getContractAt("IAddressWhitelist", "0x63fDfF29EBBcf1a958032d1E64F7627c3C98A059")
    this.MockOracleAncillary = await ethers.getContractAt('MockOracleAncillaryInterface', '0x20570E9e27920aC5E2601E0bef7244DeFf7F0B28');
    this.FeeManager = await ethers.getContractAt("IFeeManger", "0x07417cA264170Fc5bD3568f93cFb956729752B61")
    this.admin = await ethers.getImpersonatedSigner("0x9A8f92a830A5cB89a3816e3D267CB7791c16b04D");
    await this.AddressWhitelist.connect(this.admin).addToWhitelist(this.mockUNO.target);
    await this.FeeManager.connect(this.admin).setFinalFee(this.mockUNO.target, [10]);
    await this.optimisticOracleV3.connect(this.admin).setAdminProperties(this.mockUNO.target, 120, ethers.parseEther("0.1"))

    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address);

    this.singleSidedInsurancePool = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
    ]);

    await this.singleSidedInsurancePool.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )
    this.rewarderAddress = await this.singleSidedInsurancePool.rewarder()
    this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

    this.payoutRequest = await upgrades.deployProxy(this.PayoutRequest, [
      this.singleSidedInsurancePool.target,
      this.optimisticOracleV3.target,
      await (this.optimisticOracleV3.defaultCurrency()),
      this.escalationManager.target,
      this.signers[0].address,
      this.signers[0].address,
    ]);

    await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.payoutRequest.target)

    await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool.target);

    await this.capitalAgent.connect(this.multisig).setSalesPolicyFactory(this.salesPolicyFactory.target);

    console.log('[setSalesPolicyFactory]')

    await this.singleSidedInsurancePool.connect(this.multisig).createRiskPool(
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

    await (
      await this.mockUNO
        .connect(this.signers[0])
        .transfer(this.rewarder.target, getBigNumber("100000"), { from: this.signers[0].address })
    ).wait()
    await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))
    let amount = await this.capitalAgent.checkCapitalByMCR(this.singleSidedInsurancePool.target, getBigNumber("100000"));
    console.log('a', amount)

    // // block number when deposit in pool for the first time
    const beforeBlockNumber = await ethers.provider.getBlockNumber()

    await advanceBlockTo(beforeBlockNumber + 10000)

    await this.capitalAgent.setMCR(getBigNumber("1", 16));

    await this.capitalAgent.setMLR(getBigNumber("3"));
    // // another one will deposit in pool with the same amount
    await this.singleSidedInsurancePool
      .connect(this.signers[1])
      .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })




    await this.salesPolicyFactory.connect(this.multisig).newSalesPolicy(this.exchangeAgent.target, this.premiumPool.target, this.capitalAgent.target);

    this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
    this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())

    await this.salesPolicyFactory.connect(this.multisig).setSignerInPolicy(this.signers[0].address);

    await this.payoutRequest.setCapitalAgent(this.capitalAgent.target);
    let hexData
    const currentDate = new Date()
    timestamp = Math.floor(currentDate.getTime() / 1000)
    const privateKey = process.env.PRIVATE_KEY

    await this.salesPolicyFactory.connect(this.multisig).approvePremiumInPolicy(this.mockUSDT.target);

    const protocol = await this.salesPolicyFactory.getProtocol(1)

    await this.premiumPool.addWhiteList(this.salesPolicy.target);

    // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.mockUSDT.address)).wait()
    // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
    await (await this.mockUSDT.approve(this.salesPolicyAddress, getBigNumber("1000000000"))).wait()
    // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()
    // await (await this.salesPolicyFactory.updateCheckIfProtocolInWhitelistArray(true)).wait()
    // await (await this.salesPolicyFactory.setBlackListProtocolById(0)).wait()

    //   prepare sign data
    const assets = [this.mockUSDT.target, this.mockUSDT.target]
    const policyPrice = getBigNumber("300", 6)
    const protocols = [this.signers[0].address, this.signers[1].address]
    const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
    const coverageAmount = [getBigNumber("201", 6), getBigNumber("100", 6)]
    const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
    const nonce = await this.salesPolicy.getNonce(this.signers[0].address)

    const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
    const paddedProtocolsHexStr =
      "000000000000000000000000" + protocols[0].slice(2) + "000000000000000000000000" + protocols[1].slice(2)
    const paddedCoverageDurationHexStr = getPaddedHexStrFromBNArray(coverageDuration)
    const paddedCoverageAmountHexStr = getPaddedHexStrFromBNArray(coverageAmount)
    const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)
    const paddedNonceHexStr = getPaddedHexStrFromBN(nonce)
    const paddedChainId = getPaddedHexStrFromBN(this.chainId)

    hexData =
      "0x" +
      paddedPolicyPriceHexStr.slice(2) +
      paddedProtocolsHexStr +
      paddedCoverageDurationHexStr.slice(2) +
      paddedCoverageAmountHexStr.slice(2) +
      paddedDeadlineHexStr.slice(2) +
      this.mockUSDT.target.slice(2) +
      paddedNonceHexStr.slice(2) +
      this.salesPolicy.target.slice(2) +
      paddedChainId.slice(2)


    const flatSig = await this.signers[0].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
    const splitSig = ethers.Signature.from(flatSig)

    const chainId = await getChainId()
    const functionSignature = this.salesPolicy.interface.encodeFunctionData("buyPolicy", [
      assets,
      protocols,
      coverageAmount,
      coverageDuration,
      policyPrice,
      deadline,
      this.mockUSDT.target,
      splitSig.r,
      splitSig.s,
      splitSig.v,
      nonce
    ])

    const domainData = {
      name: "BuyPolicyMetaTransaction",
      version: "1",
      verifyingContract: this.salesPolicyAddress,
      salt: getPaddedHexStrFromBN(chainId),
    }

    const types = {
      MetaTransaction: [
        { name: "nonce", type: "uint256" },
        { name: "from", type: "address" },
        { name: "functionSignature", type: "bytes" },
      ]
    }

    const message = {
      nonce: Number(nonce),
      from: this.signers[0].address,
      functionSignature: functionSignature,
    }

    const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
    expect(premiumPoolBalanceBefore).to.equal(0)

    const signature = await this.signers[0].signTypedData(domainData, types, message);

    let { r, s, v } = getSignatureParameters(signature)
    try {
      let tx = await this.salesPolicy.executeMetaTransaction(this.signers[0].address, functionSignature, r, s, v, {
        gasLimit: 1000000,
      })
      const receipt = await tx.wait()
      console.log("metatransaction receipt", receipt.status)
    } catch (error) {
      console.log("[error]", error)
    }
    const premiumPoolBalanceAfter = await this.mockUSDT.balanceOf(this.premiumPool.target)
    const premiumForSSRP = await this.premiumPool.ssrpPremium(this.mockUSDT.target)
    const premiumForSSIP = await this.premiumPool.ssipPremium(this.mockUSDT.target)
    const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.mockUSDT.target)
    expect(premiumPoolBalanceAfter).to.equal(getBigNumber("300", 6))
    expect(premiumForSSRP).to.equal(getBigNumber("30", 6))
    expect(premiumForSSIP).to.equal(getBigNumber("210", 6))
    expect(premiumForBackBurn).to.equal(getBigNumber("60", 6))
    this.tx1 = this.txIdx
    console.log('this.txIdx', this.txIdx);

    this.singleSidedInsurancePool1 = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
    ]);
    this.singleSidedInsurancePool2 = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
    ]);

    await this.singleSidedInsurancePool1.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )

    await this.singleSidedInsurancePool2.connect(this.multisig).createRewarder(
      this.signers[0].address,
      this.rewarderFactory.target,
      this.mockUNO.target,
    )
    this.rewarderAddress1 = await this.singleSidedInsurancePool1.rewarder()
    this.rewarder1 = await this.Rewarder.attach(this.rewarderAddress1)
    this.rewarderAddress2 = await this.singleSidedInsurancePool2.rewarder()
    this.rewarder2 = await this.Rewarder.attach(this.rewarderAddress2)

    this.payoutRequest1 = await upgrades.deployProxy(this.PayoutRequest, [
      this.singleSidedInsurancePool1.target,
      this.optimisticOracleV3.target,
      await (this.optimisticOracleV3.defaultCurrency()),
      this.escalationManager.target,
      this.signers[0].address,
      this.signers[0].address,
    ]);
    this.payoutRequest2 = await upgrades.deployProxy(this.PayoutRequest, [
      this.singleSidedInsurancePool2.target,
      this.optimisticOracleV3.target,
      await (this.optimisticOracleV3.defaultCurrency()),
      this.escalationManager.target,
      this.signers[0].address,
      this.signers[0].address,
    ]);

    await this.singleSidedInsurancePool1.connect(this.multisig).grantRole((await this.singleSidedInsurancePool1.CLAIM_PROCESSOR_ROLE()), this.payoutRequest1.target)
    await this.singleSidedInsurancePool2.connect(this.multisig).grantRole((await this.singleSidedInsurancePool2.CLAIM_PROCESSOR_ROLE()), this.payoutRequest2.target)

    await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool1.target);
    await this.capitalAgent.connect(this.multisig).addPoolWhiteList(this.singleSidedInsurancePool2.target);

    await this.singleSidedInsurancePool1.connect(this.multisig).createRiskPool(
      "UNO-LP",
      "UNO-LP",
      this.riskPoolFactory.target,
      this.mockUNO.target,
      getBigNumber("1"),
      getBigNumber("10", 6),
    )
    await this.singleSidedInsurancePool2.connect(this.multisig).createRiskPool(
      "UNO-LP",
      "UNO-LP",
      this.riskPoolFactory.target,
      this.mockUNO.target,
      getBigNumber("1"),
      getBigNumber("10", 6),
    )

    await this.mockUNO.approve(this.singleSidedInsurancePool1.target, getBigNumber("1000000"))

    await this.mockUNO.approve(this.singleSidedInsurancePool2.target, getBigNumber("1000000"))
    await this.mockUNO
      .connect(this.signers[1])
      .approve(this.singleSidedInsurancePool1.target, getBigNumber("1000000"), { from: this.signers[1].address })
    await this.mockUNO
      .connect(this.signers[1])
      .approve(this.singleSidedInsurancePool2.target, getBigNumber("1000000"), { from: this.signers[1].address })
    await this.mockUNO
      .connect(this.signers[0])
      .approve(this.singleSidedInsurancePool2.target, getBigNumber("1000000"), { from: this.signers[0].address })
    await (
      await this.mockUNO
        .connect(this.signers[6])
        .transfer(this.rewarder1.target, getBigNumber("200000"), { from: this.signers[6].address })
    ).wait()
    await (
      await this.mockUNO
        .connect(this.signers[6])
        .transfer(this.rewarder2.target, getBigNumber("200000"), { from: this.signers[6].address })
    ).wait()
    this.riskpool1 = await this.singleSidedInsurancePool1.riskPool()

    console.log('balance of riskPool before enter in Pool', await this.mockUNO.balanceOf(this.riskpool1));
    console.log('user 1 enter in pool with 500');
    await this.singleSidedInsurancePool1.connect(this.signers[1]).enterInPool(getBigNumber("500", 6))
    console.log('user 0 enter in pool with 200');
    await this.singleSidedInsurancePool1.connect(this.signers[0]).enterInPool(getBigNumber("200", 6))

    console.log('balance of riskPool after enter in pool', await this.mockUNO.balanceOf(this.riskpool1))
    await this.singleSidedInsurancePool2.connect(this.signers[1]).enterInPool(getBigNumber("200", 6))

    await this.payoutRequest1.setCapitalAgent(this.capitalAgent.target);
    await this.payoutRequest2.setCapitalAgent(this.capitalAgent.target);

  })

  describe("Sales policy Action", function () {


    // it("Should buy policy in USDT", async function () {
    //     expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //     await this.payoutRequest.setFailed(true);
    //     await this.payoutRequest.initRequest(0, getBigNumber("201", 6), this.signers[5].address)
    //     expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(1)
    //     expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("201", 6));
    // })

    // it("Should not burn policy if coverage amount not fully filled", async function () {
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(true);
    //   await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("101", 6));
    //   expect((await this.salesPolicy.getPolicyData(0))[3]).to.equal(true);
    //   expect((await this.salesPolicy.getPolicyData(0))[4]).to.equal(false);
    // })

    // it("Should burn policy when again clain for policy to full fill coverage", async function () {
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(true);
    //   await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("101", 6));
    //   expect((await this.salesPolicy.getPolicyData(0))[3]).to.equal(true);
    //   expect((await this.salesPolicy.getPolicyData(0))[4]).to.equal(false);

    //   await this.payoutRequest.initRequest(0, getBigNumber("100", 6), this.signers[5].address)
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(1)
    //   expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("201", 6));
    // })
    // it("DVM rejects the dispute and accepts the claim -> bond gets deducted and sent somewhere -> insurance claim payout.", async function () {

    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bondAmount', bondAmount)

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);
    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   const assertionId = await this.payoutRequest.policiesAssertionId(0);
    //   //disputor raised a dispute
    //   const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   await this.mockUNO.connect(this.disputor).approve(this.optimisticOracleV3.target, assertion.bond);
    //   await this.optimisticOracleV3.connect(this.disputor).disputeAssertion(assertionId, this.disputor.address);

    //   //users voting for the dispute .
    //   const auxillaryData = await this.optimisticOracleV3.stampAssertion(assertionId);
    //   const identifier = await this.payoutRequest.defaultIdentifier();
    //   //const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   const time = assertion.assertionTime
    //   //dvm reject the dispute 

    //   await this.mockUNO.approve(this.MockOracleAncillary, ethers.parseEther('1'))
    //   await this.MockOracleAncillary.pushPrice(identifier, time, auxillaryData, ethers.parseEther('1'))

    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const burnedBondPercentage = await this.optimisticOracleV3.burnedBondPercentage();
    //   const oracleFee = (BigInt(burnedBondPercentage) * BigInt(assertion.bond)) / BigInt(10 ** 18);
    //   const bondRecipientAmount = BigInt(BigInt(assertion.bond) * BigInt(2)) - oracleFee;
    //   const claimamount = getBigNumber("101", 6)
    //   console.log(burnedBondPercentage, 'burnedBondPercentage');
    //   console.log(oracleFee, 'oracleFee');
    //   console.log(bondRecipientAmount, 'bondRecipientAmount');

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     ["0x07417cA264170Fc5bD3568f93cFb956729752B61", assertion.asserter],
    //     [oracleFee, BigInt(claimamount) + bondRecipientAmount]
    //   );
    // })

    // it("DVM accepts the dispute and rejects the claim -> bond is returned back to user who raised dispute -> no insurance claim payout", async function () {
    //   this.txIdx = this.tx1
    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);

    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   const assertionId = await this.payoutRequest.policiesAssertionId(0);
    //   //disputor raised a dispute
    //   const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   await this.mockUNO.connect(this.disputor).approve(this.optimisticOracleV3.target, assertion.bond);
    //   await this.optimisticOracleV3.connect(this.disputor).disputeAssertion(assertionId, this.disputor.address);


    //   //users voting for the dispute
    //   const auxillaryData = await this.optimisticOracleV3.stampAssertion(assertionId);
    //   const identifier = await this.payoutRequest.defaultIdentifier();
    //   //const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   const time = assertion.assertionTime
    //   //dvm accepts the dispute 

    //   await this.mockUNO.approve(this.MockOracleAncillary, ethers.parseEther('1'))
    //   await this.MockOracleAncillary.pushPrice(identifier, time, auxillaryData, ethers.parseEther('5'))

    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const burnedBondPercentage = await this.optimisticOracleV3.burnedBondPercentage();
    //   const oracleFee = (BigInt(burnedBondPercentage) * BigInt(assertion.bond)) / BigInt(10 ** 18);
    //   const bondRecipientAmount = BigInt(BigInt(assertion.bond) * BigInt(2)) - oracleFee;

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     ["0x07417cA264170Fc5bD3568f93cFb956729752B61",this.disputor.address],
    //     [oracleFee, bondRecipientAmount]
    //   );
    // })
    // it("DVM accepts the dispute and rejects the claim -> bond is returned back to user who raised dispute -> override function called and escalated to claims DAO -> reject claim -> no insurance claim payout", async function () {

    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);

    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   const assertionId = await this.payoutRequest.policiesAssertionId(0);
    //   //disputor raised a dispute
    //   const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   await this.mockUNO.connect(this.disputor).approve(this.optimisticOracleV3.target, assertion.bond);
    //   await this.optimisticOracleV3.connect(this.disputor).disputeAssertion(assertionId, this.disputor.address);

    //   //users voting for the dispute
    //   const auxillaryData = await this.optimisticOracleV3.stampAssertion(assertionId);
    //   const identifier = await this.payoutRequest.defaultIdentifier();
    //   //const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   const time = assertion.assertionTime

    //   //overriding assertion 
    //   await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.escalationManager.target);
    //   const rollTime = await this.singleSidedInsurancePool.hasRole(await this.singleSidedInsurancePool1.CLAIM_PROCESSOR_ROLE(), this.escalationManager.target);
    //   console.log('rollTime', rollTime);

    //   await this.escalationManager.setAssertionIdApproval(assertionId, true, false)
    //   //dvm accepts the dispute 

    //   await this.mockUNO.approve(this.MockOracleAncillary, ethers.parseEther('1'))
    //   await this.MockOracleAncillary.pushPrice(identifier, time, auxillaryData, ethers.parseEther('5'))

    //   const sevenDays = 24 * 7 * 60 * 60 * 7;
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const burnedBondPercentage = await this.optimisticOracleV3.burnedBondPercentage();
    //   const oracleFee = (BigInt(burnedBondPercentage) * BigInt(assertion.bond)) / BigInt(10 ** 18);
    //   const bondRecipientAmount = BigInt(BigInt(assertion.bond) * BigInt(2)) - oracleFee;

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     ["0x07417cA264170Fc5bD3568f93cFb956729752B61", this.disputor.address, assertion.asserter],
    //     [oracleFee, bondRecipientAmount, 0]
    //   );
    // })
    // it("DVM accepts the dispute and rejects the claim -> bond is returned back to user who raised dispute -> override function called and escalated to claims DAO -> accept claim -> Insurance payout received", async function () {

    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bondAmount', bondAmount)

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);
    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   const assertionId = await this.payoutRequest.policiesAssertionId(0);
    //   //disputor raised a dispute
    //   const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   await this.mockUNO.connect(this.disputor).approve(this.optimisticOracleV3.target, assertion.bond);
    //   await this.optimisticOracleV3.connect(this.disputor).disputeAssertion(assertionId, this.disputor.address);


    //   //users voting for the dispute .
    //   const auxillaryData = await this.optimisticOracleV3.stampAssertion(assertionId);
    //   const identifier = await this.payoutRequest.defaultIdentifier();
    //   //const assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   const time = assertion.assertionTime

    //   //overriding assertion 
    //   await this.singleSidedInsurancePool.connect(this.multisig).grantRole((await this.singleSidedInsurancePool.CLAIM_PROCESSOR_ROLE()), this.escalationManager.target);
    //   const rollTime = await this.singleSidedInsurancePool.hasRole(await this.singleSidedInsurancePool1.CLAIM_PROCESSOR_ROLE(), this.escalationManager.target);
    //   console.log('rollTime', rollTime);
    //   await this.escalationManager.setAssertionIdApproval(assertionId, true, true)
    //   //dvm accepts the dispute 

    //   await this.mockUNO.approve(this.MockOracleAncillary, ethers.parseEther('5'))
    //   await this.MockOracleAncillary.pushPrice(identifier, time, auxillaryData, ethers.parseEther('5'))

    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const burnedBondPercentage = await this.optimisticOracleV3.burnedBondPercentage();
    //   const oracleFee = (BigInt(burnedBondPercentage) * BigInt(assertion.bond)) / BigInt(10 ** 18);
    //   const bondRecipientAmount = BigInt(BigInt(assertion.bond) * BigInt(2)) - oracleFee;
    //   const claimamount = getBigNumber("101", 6)
    //   console.log(burnedBondPercentage, 'burnedBondPercentage');
    //   console.log(oracleFee, 'oracleFee');
    //   console.log(bondRecipientAmount, 'bondRecipientAmount');

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     ["0x07417cA264170Fc5bD3568f93cFb956729752B61", assertion.asserter, this.disputor.address],
    //     [oracleFee, BigInt(claimamount), bondRecipientAmount]
    //   );
    // })

    // it("will issue multiple claims", async function () {

    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);


    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);
    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);


    // })
    // it("Uma failed", async function () {

    //   expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
    //   await this.payoutRequest.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);

    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);


    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   await this.mockUNO.approve(this.payoutRequest.target, bondAmount);
    //   await this.payoutRequest.setFailed(true);
    //   await expect(await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[5].address, getBigNumber("101", 6));
    // })


    // it("Payout of claim from multiple pools for single policy ", async function () {


    //   await this.payoutRequest1.setFailed(false);
    //   await this.payoutRequest2.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);


    //   await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);
    //   await this.mockUNO.approve(this.payoutRequest2.target, bondAmount);
    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest1.initRequest(0, getBigNumber("50", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   await expect(await this.payoutRequest2.initRequest(0, getBigNumber("50", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);
    //   const assertionId1 = await this.payoutRequest1.policiesAssertionId(0);
    //   const assertionId2 = await this.payoutRequest2.policiesAssertionId(0);

    //   const assertion1 = await this.optimisticOracleV3.assertions(assertionId1);
    //   const assertion2 = await this.optimisticOracleV3.assertions(assertionId2);

    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const bondRecipientAmount = BigInt(assertion1.bond)
    //   const claimamount = getBigNumber("50", 6)
    //   console.log(assertion1.asserter, 'assertion1.asserter');
    //   console.log(this.signers[5].address, 'this.signers[5].address');
    //   console.log(bondRecipientAmount, 'bondRecipientAmount');

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId1)).changeTokenBalances(
    //     this.mockUNO,
    //     [ assertion1.asserter],
    //     [ BigInt(claimamount) + bondRecipientAmount]
    //   );
    //   console.log('done',bondRecipientAmount)
    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId2)).changeTokenBalances(
    //     this.mockUNO,
    //     [ assertion2.asserter],
    //     [BigInt(claimamount) + bondRecipientAmount]
    //   );
    // })
    // it("Withdrawal of position of old underwriting LPs during and after a claim payout ", async function () {
    //   await this.payoutRequest1.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bond', bondAmount);

    //   await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);

    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest1.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);

    //   const assertionId = await this.payoutRequest1.policiesAssertionId(0);
    //   let assertion = await this.optimisticOracleV3.assertions(assertionId);

    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const bondRecipientAmount = BigInt(assertion.bond)
    //   const claimamount = getBigNumber("101", 6)

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     [assertion.asserter],
    //     [BigInt(claimamount) + bondRecipientAmount]
    //   );
    //   console.log('balance of riskPool after policy', await this.mockUNO.balanceOf(this.riskpool1))
    //   assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   expect(assertion.settled).to.equal(true);
    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
    //   // user is putting less amount for leaving
    //   const risk = this.RiskPool.attach(this.riskpool1);
    //   const minLp = (await risk.MIN_LP_CAPITAL()).toString();

    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("150", 6))).not.to.be.reverted;
    //   const currentDate = new Date();
    //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
    //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

    //   await hre.ethers.provider.send('evm_increaseTime', [Number(afterTenDaysTimeStampUTC)]);
    //   console.log(this.riskpool1, 'this.riskPool1');

    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[0]).leaveFromPending(getBigNumber("150", 6))).not.to.be.reverted
    // })
    // it("Withdrawal of position of new underwriting LPs after a claim payout", async function () {
    //   await this.payoutRequest1.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bond', bondAmount);

    //   await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);

    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest1.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);

    //   const assertionId = await this.payoutRequest1.policiesAssertionId(0);
    //   let assertion = await this.optimisticOracleV3.assertions(assertionId);


    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const bondRecipientAmount = BigInt(assertion.bond)
    //   const claimamount = getBigNumber("101", 6)

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     [assertion.asserter],
    //     [BigInt(claimamount) + bondRecipientAmount]
    //   );
    //   console.log('balance of riskPool after policy', await this.mockUNO.balanceOf(this.riskpool1))
    //   assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   expect(assertion.settled).to.equal(true);
    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
    //   //enter in pool after claim 

    //   await this.mockUNO
    //     .connect(this.signers[4])
    //     .approve(this.singleSidedInsurancePool1.target, getBigNumber("1000000"), { from: this.signers[4].address });

    //   await this.singleSidedInsurancePool1.connect(this.signers[4]).enterInPool(getBigNumber("200", 6))
    //   console.log('balance of riskPool before enter in Pool after settlement', await this.mockUNO.balanceOf(this.riskpool1));
    //   let amount = await this.capitalAgent.checkCapitalByMCR(this.singleSidedInsurancePool1.target, getBigNumber("200", 6));
    //   console.log('a', amount)

    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[4]).leaveFromPoolInPending(getBigNumber("200", 6))).not.to.be.reverted;
    //   const currentDate = new Date();
    //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
    //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

    //   await hre.ethers.provider.send('evm_increaseTime', [Number(afterTenDaysTimeStampUTC)]);
    //   console.log(this.riskpool1, 'this.riskPool1');
    //   const risk = this.RiskPool.attach(this.riskpool1);
    //   const lpprice = (await risk.lpPriceUno()).toString();
    //   const LPPrice = await ethers.formatEther(lpprice)
    //   console.log('hejhhh',LPPrice, lpprice);

    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[4]).leaveFromPending(getBigNumber("400", 6))).changeTokenBalances(
    //     this.mockUNO,
    //     [this.signers[4].address],
    //     [Number(getBigNumber("400", 6)) * (LPPrice)]
    //   );
    // })
    // it("Withdrawal of old position of old underwriting LPs after a claim payout and new user enter in pool", async function () {
    //   await this.payoutRequest1.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bond', bondAmount);

    //   await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);

    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest1.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);

    //   const assertionId = await this.payoutRequest1.policiesAssertionId(0);
    //   let assertion = await this.optimisticOracleV3.assertions(assertionId);


    //   const sevenDays = 24 * 7 * 60 * 60 * 7
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(sevenDays)]);

    //   const bondRecipientAmount = BigInt(assertion.bond)
    //   const claimamount = getBigNumber("101", 6)
    //   this.riskpool1 = this.RiskPool.attach(this.riskpool1)
    //   const riskPoolBalance = await this.mockUNO.balanceOf(this.riskpool1.target);
    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     [assertion.asserter],
    //     [BigInt(claimamount) + bondRecipientAmount]
    //   );
    //   const total = (await this.riskpool1.totalSupply());
    //   const expectedLpTokenPrice = (BigInt(riskPoolBalance - claimamount) * BigInt(1 * 10 ** 18)) / total;
    //   const lpTokenPrice = await this.riskpool1.lpPriceUno();
    //   expect(expectedLpTokenPrice).to.equal(lpTokenPrice);

    //   console.log('balance of riskPool after policy', await this.mockUNO.balanceOf(this.riskpool1.target))
    //   assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   expect(assertion.settled).to.equal(true);
    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
    //   //enter in pool after claim 

    //   await this.mockUNO
    //     .connect(this.signers[4])
    //     .approve(this.singleSidedInsurancePool1.target, getBigNumber("1000000"), { from: this.signers[4].address });

    //   await this.singleSidedInsurancePool1.connect(this.signers[4]).enterInPool(getBigNumber("20000", 18))
    //   console.log('balance of riskPool before enter in Pool after settlement', await this.mockUNO.balanceOf(this.riskpool1));
    //   // signer0 tries again leaving from pool

    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
    //   const currentDate = new Date();
    //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
    //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

    //   await hre.ethers.provider.send('evm_increaseTime', [Number(afterTenDaysTimeStampUTC)]);
    //   console.log(this.riskpool1.target, 'this.riskPool1');
    //   const lpprice = (await this.riskpool1.lpPriceUno()).toString();
    //   const LPPrice = await ethers.formatEther(lpprice)

    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;

    // })
    // it("pool withdraw amount calculation", async function () {
    //   await this.payoutRequest1.setFailed(false);
    //   const currency = await (this.optimisticOracleV3.defaultCurrency())
    //   const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
    //   console.log('bond', bondAmount);
    //   const withdrawamount = getBigNumber("200", 6);

    //   const userAAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[0].address)).lpAmount;
    //   expect((userAAmount)).to.equal(withdrawamount);

    //   await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);

    //   //user exiting from pool before claim
    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(withdrawamount)).not.to.be.reverted;

    //   //enter in pool before claim 

    //   await this.mockUNO
    //     .connect(this.signers[4])
    //     .approve(this.singleSidedInsurancePool1.target, getBigNumber("200", 6), { from: this.signers[4].address });
    //   console.log('user 4 enter in pool with 200');
    //   await this.singleSidedInsurancePool1.connect(this.signers[4]).enterInPool(getBigNumber("200", 6))
    //   console.log('balance of riskPool before enter in Pool after settlement', await this.mockUNO.balanceOf(this.riskpool1));

    //   const userBAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[4].address)).unoAmount;
    //   expect(userBAmount).to.equal(withdrawamount);

    //   await this.mockUNO
    //     .connect(this.signers[6])
    //     .approve(this.singleSidedInsurancePool1.target, getBigNumber("200", 6), { from: this.signers[6].address });
    //   console.log('user 6 enter in pool with 200');
    //   await this.singleSidedInsurancePool1.connect(this.signers[6]).enterInPool(getBigNumber("200", 6));

    //   const userCAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[6].address)).lpAmount;
    //   expect(userCAmount).to.equal(withdrawamount);

    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[6]).leaveFromPoolInPending(getBigNumber("200", 6))).not.to.be.reverted;

    //   console.log('userc', userCAmount);
    //   let currentDate = new Date();
    //   let afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
    //   let afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

    //   // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
    //   await expect(await this.payoutRequest1.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);

    //   const assertionId = await this.payoutRequest1.policiesAssertionId(0);
    //   let assertion = await this.optimisticOracleV3.assertions(assertionId);

    //   const ten = 24 * 7 * 60 * 60 * 10;
    //   //calling assert truth in optimistic oracle 
    //   await hre.ethers.provider.send('evm_increaseTime', [Number(ten)]);

    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[6]).leaveFromPending(userCAmount)).changeTokenBalances(
    //     this.mockUNO,
    //     [this.signers[6].address],
    //     [userCAmount]
    //   );

    //   const bondRecipientAmount = BigInt(assertion.bond)
    //   const claimamount = getBigNumber("101", 6)
    //   this.riskpool1 = this.RiskPool.attach(this.riskpool1)

    //   await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
    //     this.mockUNO,
    //     [assertion.asserter],
    //     [BigInt(claimamount) + bondRecipientAmount]
    //   );
    //   await this.mockUNO
    //     .connect(this.signers[5])
    //     .approve(this.singleSidedInsurancePool1.target, getBigNumber("200", 6), { from: this.signers[5].address });

    //   const total = (await this.riskpool1.totalSupply());
    //   const riskPoolBalance = await this.mockUNO.balanceOf(this.riskpool1.target);
    //   console.log('riskPoolBalance', riskPoolBalance);
    //   console.log('riskPoolBalancetotal', total);
    //   const expectedLpTokenPrice = (BigInt(riskPoolBalance) * BigInt(1 * 10 ** 18)) / total;
    //   console.log('expectedLpTokenPrice', expectedLpTokenPrice);
    //   const lpTokenPrice = await this.riskpool1.lpPriceUno();
    //   expect(expectedLpTokenPrice).to.equal(lpTokenPrice);
    //   // user enter in pool after policy claim
    //   console.log('user 5 enter in pool with 200');
    //   const tx = await this.singleSidedInsurancePool1.connect(this.signers[5]).enterInPool(getBigNumber("200", 6));
    //   const receipt = await tx.wait();
    //   //console.log(receipt);

    //   const lpprice = (await this.riskpool1.lpPriceUno()).toString();
    //   const LPPrice = ethers.formatEther(lpprice);
    //   const withdrawableAmount = Math.trunc(Number(withdrawamount) * LPPrice);
    //   console.log('LPPrice', LPPrice)
    //   console.log('withdrawableAmount', withdrawableAmount);


    //   const userDAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[5].address)).lpAmount;
    //   //expect(userDAmount).to.equal(withdrawableAmount + Math.floor(withdrawableAmount / LPPrice));
    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[5]).leaveFromPoolInPending(getBigNumber("200", 6))).not.to.be.reverted;

    //   //user exiting from pool
    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[4]).leaveFromPoolInPending(withdrawamount)).to.be.reverted;
    //   //user needs to put amount*lpToken uno 
    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[4]).leaveFromPoolInPending(withdrawableAmount + 1)).not.to.be.reverted;

    //   console.log('balance of riskPool after policy', await this.mockUNO.balanceOf(this.riskpool1.target))
    //   assertion = await this.optimisticOracleV3.assertions(assertionId);
    //   expect(assertion.settled).to.equal(true);

    //   await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
    //   currentDate = new Date();
    //   afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
    //   afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

    //   await hre.ethers.provider.send('evm_increaseTime', [Number(afterTenDaysTimeStampUTC)]);
    //   console.log(this.riskpool1.target, 'this.riskPool1', Math.trunc(withdrawableAmount * (LPPrice)));

    //   console.log('userAAmount', userAAmount, 'useraWithdraw', Math.trunc(Number(userAAmount) * LPPrice))
    //   console.log('userBAmount', userBAmount, 'userbWithdraw', Math.trunc(Number(withdrawableAmount) * LPPrice))
    //   console.log('userCAmount', userCAmount, 'usercWithdraw', userCAmount)
    //   console.log('userDAmount', userDAmount, 'userdWithdraw', Math.trunc(Number(userDAmount) * LPPrice))


    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[0]).leaveFromPending(userAAmount)).changeTokenBalances(
    //     this.mockUNO,
    //     [this.signers[0].address],
    //     [Math.trunc(Number(userAAmount) * LPPrice)]
    //   );
    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[5]).leaveFromPending(userDAmount)).changeTokenBalances(
    //     this.mockUNO,
    //     [this.signers[5].address],
    //     [Math.trunc(Number(userDAmount) * LPPrice)]
    //   );
    //   await expect(this.singleSidedInsurancePool1.connect(this.signers[4]).leaveFromPending(userBAmount)).changeTokenBalances(
    //     this.mockUNO,
    //     [this.signers[4].address],
    //     [Math.trunc(Number(userBAmount) * LPPrice)]
    //   );

    // })
    it("Will revert when pool capital will less than SCR", async function () {
      await this.mockUNO
        .connect(this.signers[6])
        .approve(this.singleSidedInsurancePool1.target, getBigNumber("200", 6), { from: this.signers[6].address });
      console.log('user 6 enter in pool with 200');
      await this.singleSidedInsurancePool1.connect(this.signers[6]).enterInPool(getBigNumber("200", 6));

      const userCAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[6].address)).lpAmount;
      

      await this.payoutRequest1.setFailed(false);
      const currency = await (this.optimisticOracleV3.defaultCurrency())
      const bondAmount = await this.optimisticOracleV3.getMinimumBond(currency);
      console.log('bond', bondAmount);
      const withdrawamount = getBigNumber("200", 6);

      const userAAmount = (await this.singleSidedInsurancePool1.getStakedAmountPerUser(this.signers[0].address)).lpAmount;
      expect((userAAmount)).to.equal(withdrawamount);

      await this.mockUNO.approve(this.payoutRequest1.target, bondAmount);

      //user exiting from pool before claim
      await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(withdrawamount)).not.to.be.reverted;
      await expect(this.singleSidedInsurancePool1.connect(this.signers[1]).leaveFromPoolInPending(getBigNumber("100", 6))).not.to.be.reverted;

      await expect(this.singleSidedInsurancePool1.connect(this.signers[6]).leaveFromPoolInPending(getBigNumber("200", 6))).not.to.be.reverted;

      console.log('userc', userCAmount);
      let currentDate = new Date();
      let afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
      let afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

      // await this.payoutRequest.setEscalatingManager(ethers.ZeroAddress)
      await expect(await this.payoutRequest1.initRequest(0, getBigNumber("101", 6), this.signers[5].address)).to.changeTokenBalance(this.mockUNO, this.signers[0].address, -bondAmount);

      const assertionId = await this.payoutRequest1.policiesAssertionId(0);
      let assertion = await this.optimisticOracleV3.assertions(assertionId);

      const ten = 24 * 7 * 60 * 60 * 10;
      //calling assert truth in optimistic oracle 
      await hre.ethers.provider.send('evm_increaseTime', [Number(ten)]);

      const bondRecipientAmount = BigInt(assertion.bond)
      const claimamount = getBigNumber("101", 6)
      this.riskpool1 = this.RiskPool.attach(this.riskpool1)

      await expect(this.optimisticOracleV3.settleAssertion(assertionId)).changeTokenBalances(
        this.mockUNO,
        [assertion.asserter],
        [BigInt(claimamount) + bondRecipientAmount]
      );
      await this.mockUNO
        .connect(this.signers[5])
        .approve(this.singleSidedInsurancePool1.target, getBigNumber("200", 6), { from: this.signers[5].address });

      const total = (await this.riskpool1.totalSupply());
      const riskPoolBalance = await this.mockUNO.balanceOf(this.riskpool1.target);
      const expectedLpTokenPrice = (BigInt(riskPoolBalance) * BigInt(1 * 10 ** 18)) / total;
      const lpTokenPrice = await this.riskpool1.lpPriceUno();
      expect(expectedLpTokenPrice).to.equal(lpTokenPrice);

      const lpprice = (await this.riskpool1.lpPriceUno()).toString();
      const LPPrice = ethers.formatEther(lpprice);
      const withdrawableAmount = Math.trunc(Number(withdrawamount) * LPPrice);
      console.log('LPPrice', LPPrice)
      console.log('withdrawableAmount', withdrawableAmount);


      //user exiting from pool

      console.log('balance of riskPool after policy', await this.mockUNO.balanceOf(this.riskpool1.target))
      assertion = await this.optimisticOracleV3.assertions(assertionId);
      expect(assertion.settled).to.equal(true);

      await expect(this.singleSidedInsurancePool1.leaveFromPoolInPending(getBigNumber("200", 6))).to.be.reverted;
      currentDate = new Date();
      afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 11))
      afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000

      await hre.ethers.provider.send('evm_increaseTime', [Number(afterTenDaysTimeStampUTC)]);

      await expect(this.singleSidedInsurancePool1.connect(this.signers[0]).leaveFromPending(userAAmount)).changeTokenBalances(
        this.mockUNO,
        [this.signers[0].address],
        [Math.trunc(Number(userAAmount) * LPPrice)]
      );

    })
  })
})
