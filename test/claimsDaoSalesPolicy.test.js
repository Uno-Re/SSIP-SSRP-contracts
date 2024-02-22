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
    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.assertor = this.signers[6]
    this.disputor = this.signers[7]
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))
    this.mockUNO.transfer(this.disputor.address, getBigNumber("3000000"))


    const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]
    const timestamp = new Date().getTime()

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

    // // block number when deposit in pool for the first time
    const beforeBlockNumber = await ethers.provider.getBlockNumber()

    await advanceBlockTo(beforeBlockNumber + 10000)
    // // another one will deposit in pool with the same amount
    await this.singleSidedInsurancePool
      .connect(this.signers[1])
      .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })

    await this.capitalAgent.setMCR(getBigNumber("1", 16));

    await this.capitalAgent.setMLR(getBigNumber("3"));

    await this.salesPolicyFactory.connect(this.multisig).newSalesPolicy(this.exchangeAgent.target, this.premiumPool.target, this.capitalAgent.target);

    this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
    this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())

    await this.salesPolicyFactory.connect(this.multisig).setSignerInPolicy(this.signers[0].address);

    await this.payoutRequest.setCapitalAgent(this.capitalAgent.target);
  })

  describe("Sales policy Action", function () {
    beforeEach(async function () {
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
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
    })

    it("Should buy policy in USDT", async function () {
        expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
        await this.payoutRequest.setFailed(true);
        await this.payoutRequest.initRequest(0, getBigNumber("201", 6), this.signers[5].address)
        expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(1)
        expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("201", 6));
    })

    it("Should not burn policy if coverage amount not fully filled", async function () {
      expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
      await this.payoutRequest.setFailed(true);
      await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)
      expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
      expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("101", 6));
      expect((await this.salesPolicy.getPolicyData(0))[3]).to.equal(true);
      expect((await this.salesPolicy.getPolicyData(0))[4]).to.equal(false);
    })

    it("Should burn policy when again clain for policy to full fill coverage", async function () {
      expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
      await this.payoutRequest.setFailed(true);
      await this.payoutRequest.initRequest(0, getBigNumber("101", 6), this.signers[5].address)
      expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(2)
      expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("101", 6));
      expect((await this.salesPolicy.getPolicyData(0))[3]).to.equal(true);
      expect((await this.salesPolicy.getPolicyData(0))[4]).to.equal(false);

      await this.payoutRequest.initRequest(0, getBigNumber("100", 6), this.signers[5].address)
      expect(await this.salesPolicy.balanceOf(this.signers[0].address)).to.equal(1)
      expect(await this.mockUNO.balanceOf(this.signers[5].address)).to.equal(getBigNumber("201", 6));
    })
  })
})
