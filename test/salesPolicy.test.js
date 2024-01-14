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

describe("SalesPolicy", function () {
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
    this.riskPoolFactory = await this.RiskPoolFactory.deploy()
    this.mockUNO.transfer(this.signers[1].address, getBigNumber("2000000"))
    this.mockUNO.transfer(this.signers[2].address, getBigNumber("3000000"))

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
      this.multiSigWallet.target,
    )
    this.capitalAgent = await upgrades.deployProxy(this.CapitalAgent, [
      this.exchangeAgent.target,
      this.mockUSDT.target,
      this.multiSigWallet.target,
      this.multiSigWallet.target,
    ])
    this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
      this.mockUSDT.target,
      this.exchangeAgent.target,
      this.premiumPool.target,
      this.capitalAgent.target,
      this.multiSigWallet.target,
    )

    let encodedCallData
    this.txIdx = 0

    // add 2 protocols
    for (let idx = 0; idx < 3; idx++) {
      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('addProtocol', [
        this.signers[idx + 1].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++
      // await this.salesPolicyFactory.addProtocol(this.signers[idx + 1].address)
    }

    expect(await this.salesPolicyFactory.allProtocolsLength()).equal(3)

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

    // await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()
    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB");
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address);

    this.singleSidedInsurancePool = await upgrades.deployProxy(this.SingleSidedInsurancePool, [
      this.capitalAgent.target,
      "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6",
      this.signers[0].address,
      this.signers[0].address,
      this.signers[0].address,
    ]);

    encodedCallData = this.capitalAgent.interface.encodeFunctionData("addPoolWhiteList", [this.singleSidedInsurancePool.target])
    console.log('[addPoolWhiteList]', encodedCallData)

    await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.executeTransaction(this.txIdx)).to.be.revertedWith("cannot execute tx")

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false)).to.be.revertedWith("tx already confirmed")

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)

    this.txIdx++

    encodedCallData = this.capitalAgent.interface.encodeFunctionData("setSalesPolicyFactory", [this.salesPolicyFactory.target])
    console.log('[setSalesPolicyFactory]', encodedCallData)

    await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

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
    this.multisig = await ethers.getSigner("0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6");
    await this.singleSidedInsurancePool.connect(this.multisig).createRiskPool(
      "UNO-LP",
      "UNO-LP",
      this.riskPoolFactory.target,
      this.mockUNO.target,
      getBigNumber("1"),
      getBigNumber("10", 6),
    )
    if (false) {
      encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("createRiskPool", [
        "UNO-LP",
        "UNO-LP",
        this.riskPoolFactory.target,
        this.mockUNO.target,
        getBigNumber("1"),
        getBigNumber("10", 6),
      ])

      await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
    }

    await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
    await this.mockUNO
      .connect(this.signers[1])
      .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })

    // await (
    //   await this.mockUNO
    //     .connect(this.signers[0])
    //     .transfer(this.rewarder.address, getBigNumber(100000), { from: this.signers[0].address })
    // ).wait()
    await this.singleSidedInsurancePool.enterInPool(getBigNumber("100000"))

    // block number when deposit in pool for the first time
    const beforeBlockNumber = await ethers.provider.getBlockNumber()

    await advanceBlockTo(beforeBlockNumber + 10000)
    // another one will deposit in pool with the same amount
    await this.singleSidedInsurancePool
      .connect(this.signers[1])
      .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })

    encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMCR", [getBigNumber("1", 16)])

    await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)
    this.txIdx++

    encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMLR", [getBigNumber("3")])

    await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)
    this.txIdx++

    encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("newSalesPolicy", [
      this.exchangeAgent.target,
      this.premiumPool.target,
      this.capitalAgent.target,
    ])

    await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[0].address, this.txIdx)

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, "ConfirmTransaction")
      .withArgs(this.signers[1].address, this.txIdx)
    this.txIdx++

    this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
    this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())

    {
      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[0].address
      ]);
      const index = await this.multiSigWallet.getTransactionCount();
      await (await this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData)).wait()
      await (await this.multiSigWallet.confirmTransaction(index, false)).wait();
      await (await this.multiSigWallet.connect(this.signers[1]).confirmTransaction(index, true)).wait();
      this.txIdx++;
      this.txIdx1 = this.txIdx;
    }
  })

  describe("Sales policy Action", function () {
    // it("Should update premium pool address", async function () {
    //   const premiumPoolAddressBefore = await this.salesPolicyFactory.premiumPool()
    //   await this.salesPolicyFactory.connect(this.multiSigWallet).setPremiumPool(this.signers[3].address)
    //   const premiumPoolAddressAfter = await this.salesPolicyFactory.premiumPool()
    //   expect(premiumPoolAddressBefore).to.be.not.equal(premiumPoolAddressAfter)
    //   expect(premiumPoolAddressAfter).to.equal(this.signers[3].address)
    // })

    it("Should buy policy in USDT", async function () {
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const privateKey = process.env.PRIVATE_KEY

      const protocol = await this.salesPolicyFactory.getProtocol(1)
      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.mockUSDT.target,
      ])

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[0].address])

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

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
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
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

      console.log('this.txIdx', this.txIdx);
    })

    it("Should buy policy in USDT directly", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);
      console.log(2);
      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);
      console.log(2);
      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);
      console.log(2);
      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);
      console.log(2);
      this.txIdx++;
      console.log('this.signers[5].address', this.signers[5].address);
      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);
      console.log(2);
      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);
      console.log(2);
      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;
      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.mockUSDT.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.mockUSDT.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)

      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      try {
        let tx = await this.salesPolicy.buyPolicy(
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
          nonce,
          {
            gasLimit: 1000000,
          })
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }
      console.log('this.salesPolicyAddress', this.salesPolicyAddress);
      console.log('await this.mockUSDT.balanceOf(this.salesPolicyAddress)', await this.mockUSDT.balanceOf(this.salesPolicyAddress));
      console.log('await this.mockUSDT.balanceOf(this.premium)', await this.mockUSDT.balanceOf(this.premiumPool.target));

      const premiumPoolBalanceAfter = await this.mockUSDT.balanceOf(this.premiumPool.target)
      const premiumForSSRP = await this.premiumPool.ssrpPremium(this.mockUSDT.target)
      const premiumForSSIP = await this.premiumPool.ssipPremium(this.mockUSDT.target)
      const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.mockUSDT.target)
      expect(premiumPoolBalanceAfter).to.equal(getBigNumber("300", 6))
      expect(premiumForSSRP).to.equal(getBigNumber("30", 6))
      expect(premiumForSSIP).to.equal(getBigNumber("210", 6))
      expect(premiumForBackBurn).to.equal(getBigNumber("60", 6))
    })
    it("Should revert when invalid signer buy policy", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;
      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.mockUSDT.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.mockUSDT.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.signers[1].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig);

      await expect(this.salesPolicy.connect(this.signers[10]).buyPolicy(
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
        nonce,
        {
          gasLimit: 1000000,
        })).to.be.revertedWith('UnoRe: invalid signer')
    })
    it("Should buy policy in USDT after proxy upgrade", async function () {
      this.txIdx = this.txIdx1;
      this.capitalAgent = await upgrades.upgradeProxy(this.capitalAgent.target, this.CapitalAgent1)
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const privateKey = process.env.PRIVATE_KEY

      const protocol = await this.salesPolicyFactory.getProtocol(1)
      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.mockUSDT.target,
      ])
      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[0].address])

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

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
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      let nonce = await this.salesPolicy.getNonce(this.signers[0].address)
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

      nonce = await this.salesPolicy.getNonce(this.signers[0].address)
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
    })
    it("Should buy policy in ETH  ", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      try {
        let tx = await this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.zeroAddress,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
            value: value
          })
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }

      // const premiumPoolBalanceAfter = await this.ethers.provider.getBalance(this.premiumPool.target)
      const premiumForSSRP = await this.premiumPool.ssrpPremiumEth()
      const premiumForSSIP = await this.premiumPool.ssipPremiumEth()
      const premiumForBackBurn = await this.premiumPool.backBurnPremiumEth()
        ;


      expect(premiumForSSRP).to.equal(13780)

      expect(premiumForSSIP).to.equal(96462)

      expect(premiumForBackBurn).to.equal(27562)
    })
    it("Should revert when less premium paid in ETH", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)


      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)


      await expect(this.salesPolicy.buyPolicy(
        assets,
        protocols,
        coverageAmount,
        coverageDuration,
        policyPrice,
        deadline,
        this.zeroAddress,
        splitSig.r,
        splitSig.s,
        splitSig.v,
        nonce,
        {
          gasLimit: 1000000,
          value: 0
        })
      ).to.be.revertedWith("UnoRe: insufficient paid")
    })
    it("Should revert when protocol in blacklist", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('updateCheckIfProtocolInWhitelistArray', [
        true
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;


      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setBlackListProtocolByAddress', [
        this.signers[1].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)


      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

      await expect(this.salesPolicy.buyPolicy(
        assets,
        protocols,
        coverageAmount,
        coverageDuration,
        policyPrice,
        deadline,
        this.zeroAddress,
        splitSig.r,
        splitSig.s,
        splitSig.v,
        nonce,
        {
          gasLimit: 1000000,
          value: value
        })
      ).to.be.revertedWith("UnoRe: unavailable policy")
    })
    it("Should revert when signature time expired", async function () {
      this.txIdx = this.txIdx1;
      let hexData
      const currentDate = new Date()
      const timestamp = Math.floor(currentDate.getTime() / 1000)
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
        this.mockUSDT.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
        this.signers[5].address
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
        this.salesPolicy.target
      ]);

      await expect(this.multiSigWallet.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multiSigWallet, 'SubmitTransaction')
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData);

      await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[0].address, this.txIdx);

      await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multiSigWallet, 'ConfirmTransaction')
        .withArgs(this.signers[1].address, this.txIdx);

      this.txIdx++;

      //   prepare sign data
      const assets = [this.mockUSDT.target, this.mockUSDT.target]
      const policyPrice = getBigNumber("300", 6)


      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
      const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

      await hre.ethers.provider.send('evm_increaseTime', [Number(deadline)]);

      await expect(this.salesPolicy.buyPolicy(
        assets,
        protocols,
        coverageAmount,
        coverageDuration,
        policyPrice,
        deadline,
        this.zeroAddress,
        splitSig.r,
        splitSig.s,
        splitSig.v,
        nonce,
        {
          gasLimit: 1000000,
          value: value
        })
      ).to.be.revertedWith("UnoRe: signature expired")
    })
  })
})
