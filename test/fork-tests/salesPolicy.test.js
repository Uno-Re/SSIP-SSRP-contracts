const { expect } = require("chai")
const { ethers, network, upgrades } = require("hardhat")

const {
  getBigNumber,
  getPaddedHexStrFromBN,
  getPaddedHexStrFromBNArray,
  getChainId,
  getSignatureParameters,
  advanceBlockTo,
} = require("../../../scripts/shared/utilities")

const UniswapV2Router = require("../../../scripts/abis/UniswapV2Router.json")

const { WETH_ADDRESS, UNISWAP_FACTORY_ADDRESS, UNISWAP_ROUTER_ADDRESS } = require("../../../scripts/shared/constants")
const OptimisticOracleV3Abi = require("../../../scripts/abis/OptimisticOracleV3.json")
const mockUnoAbi = require("../../../scripts/abis/MockUNO.json")
const mockWSYS = require("../../../scripts/abis/WETH9.json")
const riskPoolFactoryAbi = require("../../../scripts/abis/riskPoolFactoryAbi.json")
const MockOraclePriceFeedAbi = require("../../../scripts/abis/mockOracle.json")
const exchangeAgentAbi = require("../../../scripts/abis/exchangeAgentAbi.json")
const premiumPoolAbi = require("../../../scripts/abis/PremiumPool.json")
const capitalAgentAbi = require("../../../scripts/abis/CapitalAgent.json")
const salesPolicyFactoryAbi = require("../../../scripts/abis/salesPolicyFactoryAbi.json")
const singleSidedInsurancePoolAbi = require("../../../scripts/abis/SingleSidedInsurancePool.json")

describe("SalesPolicy", function () {
  before(async function () {
    this.multisig = await ethers.getContractFactory("MultiSigWallet")
    this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
    this.CapitalAgent1 = await ethers.getContractFactory("CapitalAgent")
    this.PremiumPool = await ethers.getContractFactory("PremiumPool")
    this.Rewarder = await ethers.getContractFactory("Rewarder")
    this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
    this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
    this.RiskPool = await ethers.getContractFactory("RiskPool")
    this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
    this.MockUNO = await ethers.getContractFactory("MockUNO")
    this.stakingAsset = await ethers.getContractFactory("MockUSDT")
    this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
    this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
    this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
    this.MockOraclePriceFeed = await ethers.getContractFactory("PriceOracle")
    this.EscalationManager = await ethers.getContractFactory("EscalationManager")
    this.signers = await ethers.getSigners()
    this.zeroAddress = ethers.ZeroAddress
    this.routerContract = new ethers.Contract(
      UNISWAP_ROUTER_ADDRESS.sepolia,
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
    this.mockUNO = await ethers.getContractAt(mockUnoAbi, "0x553A7E44043C98eAaAc71334d49Ecbec92916c36")
    this.stakingAsset = await ethers.getContractAt(mockWSYS, "0x4200000000000000000000000000000000000006")
    this.multisig = await ethers.getSigner("0x15E18e012cb6635b228e0DF0b6FC72627C8b2429")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x15E18e012cb6635b228e0DF0b6FC72627C8b2429"],
    })

    this.admin = await ethers.getSigner("0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863")
    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: ["0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863"],
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

    this.masterChefOwner = this.signers[0].address
    this.claimAssessor = this.signers[3].address
    this.riskPoolFactory = await ethers.getContractAt(riskPoolFactoryAbi, "0x188A7092f2020088052D589F1C626Bb955AB5436")

    await this.mockUNO.connect(this.signers[1]).mint(getBigNumber("3000000"), { from: this.signers[1] })
    await this.mockUNO.connect(this.signers[2]).mint(getBigNumber("3000000"), { from: this.signers[2] })
    const assetArray = [this.stakingAsset.address, this.mockUNO.address, this.zeroAddress]
    const timestamp = new Date().getTime()

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

    this.mockOraclePriceFeed = await ethers.getContractAt(MockOraclePriceFeedAbi, "0x14eF9C6cD5A8C78af407cEcCA3E4668e466F2B18")

    this.exchangeAgent = await ethers.getContractAt(exchangeAgentAbi, "0x83f618d714B9464C8e63F1d95592BaAa2d51a54E")

    this.premiumPool = await ethers.getContractAt(premiumPoolAbi, "0xc94002a997d4e4E90D423778170588f695c5f242")

    this.capitalAgent = await ethers.getContractAt(capitalAgentAbi, "0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30")

    this.salesPolicyFactory = await ethers.getContractAt(salesPolicyFactoryAbi, "0xD86D9be9143Dc514340C73502f2B77d93d0B11f4")

    // add 2 protocols
    await this.salesPolicyFactory.connect(this.multisig).addProtocol(this.signers[7].address)
    await this.salesPolicyFactory.connect(this.multisig).addProtocol(this.signers[8].address)
    await this.salesPolicyFactory.connect(this.multisig).addProtocol(this.signers[5].address)

    // await this.salesPolicyFactory.addProtocol(this.signers[idx + 1].address)
    // await (await this.premiumPool.addCurrency(this.stakingAsset.address)).wait()
    await this.salesPolicyFactory.connect(this.multisig).setSignerInPolicy(this.signers[0].address)

    this.optimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3Abi, "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB")
    this.escalationManager = await this.EscalationManager.deploy(this.optimisticOracleV3.target, this.signers[0].address)

    this.singleSidedInsurancePool = await ethers.getContractAt(
      singleSidedInsurancePoolAbi,
      "0x3B61743180857c9D898c336b1604f4742887aa74",
    )

    await this.stakingAsset.approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"))
    await this.stakingAsset
      .connect(this.signers[1])
      .approve(this.singleSidedInsurancePool.target, getBigNumber("1000000"), { from: this.signers[1].address })

    await this.singleSidedInsurancePool.connect(this.signers[0]).enterInPool(getBigNumber("100000"))

    // block number when deposit in pool for the first time
    const beforeBlockNumber = await ethers.provider.getBlockNumber()

    await advanceBlockTo(beforeBlockNumber + 10000)
    // another one will deposit in pool with the same amount
    await this.singleSidedInsurancePool
      .connect(this.signers[1])
      .enterInPool(getBigNumber("100000"), { from: this.signers[1].address })

    await this.capitalAgent.connect(this.admin).setMCR(getBigNumber("1", 16))

    this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
    this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())
  })

  describe("Sales policy Action", function () {
    // it("Should update premium pool address", async function () {
    //   const premiumPoolAddressBefore = await this.salesPolicyFactory.premiumPool()
    //   await this.salesPolicyFactory.connect(this.multisig).setPremiumPool(this.signers[3].address)
    //   const premiumPoolAddressAfter = await this.salesPolicyFactory.premiumPool()
    //   expect(premiumPoolAddressBefore).to.be.not.equal(premiumPoolAddressAfter)
    //   expect(premiumPoolAddressAfter).to.equal(this.signers[3].address)
    // })

    it("Should buy policy in USDT", async function () {
      let hexData
      const currentDate = new Date()
      timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const privateKey = process.env.PRIVATE_KEY

      const protocol = await this.salesPolicyFactory.getProtocol(1)

      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.stakingAsset.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("1000000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()
      // await (await this.salesPolicyFactory.updateCheckIfProtocolInWhitelistArray(true)).wait()
      // await (await this.salesPolicyFactory.setBlackListProtocolById(0)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.salesPolicy.target.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[0].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const chainId = await getChainId()

      const functionSignature = await this.salesPolicy
        .connect(this.multisig)
        .interface.encodeFunctionData("buyPolicy", [
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
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
        ],
      }

      const message = {
        nonce: Number(nonce),
        from: this.signers[0].address,
        functionSignature: functionSignature,
      }

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      const signature = await this.signers[0].signTypedData(domainData, types, message)

      let { r, s, v } = getSignatureParameters(signature)
      try {
        let tx = await this.salesPolicy
          .connect(this.signers[0])
          .executeMetaTransaction(this.signers[0].address, functionSignature, r, s, v, {
            gasLimit: 1000000,
          })
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }
      const premiumPoolBalanceAfter = await this.stakingAsset.balanceOf(this.premiumPool.target)
      //const premiumForSSRP = await this.premiumPool.ssrpPremium(this.stakingAsset.target)
      // const premiumForSSIP = await this.premiumPool.ssipPremium(this.stakingAsset.target)
      const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.stakingAsset.target)
      expect(premiumPoolBalanceAfter).to.equal(getBigNumber("300", 6))
      //expect(premiumForSSRP).to.equal(getBigNumber("30", 6))
      // expect(premiumForSSIP).to.equal(getBigNumber("210", 6))
      expect(premiumForBackBurn).to.equal(getBigNumber("60", 6))

      console.log("this.txIdx", this.txIdx)
    })
    it("Should buy policy in USDT directly", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      await this.salesPolicyFactory.connect(this.multisig).interface.approvePremiumInPolicy(this.stakingAsset.target)

      console.log("this.signers[5].address", this.signers[5].address)
      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.stakingAsset.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      try {
        let tx = await this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        )
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }
      console.log("this.salesPolicyAddress", this.salesPolicyAddress)
      console.log(
        "await this.stakingAsset.balanceOf(this.salesPolicyAddress)",
        await this.stakingAsset.balanceOf(this.salesPolicyAddress),
      )
      console.log("await this.stakingAsset.balanceOf(this.premium)", await this.stakingAsset.balanceOf(this.premiumPool.target))

      const premiumPoolBalanceAfter = await this.stakingAsset.balanceOf(this.premiumPool.target)
      const premiumForSSRP = await this.premiumPool.ssrpPremium(this.stakingAsset.target)
      const premiumForSSIP = await this.premiumPool.ssipPremium(this.stakingAsset.target)
      const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.stakingAsset.target)
      expect(premiumPoolBalanceAfter).to.equal(getBigNumber("300", 6))
      expect(premiumForSSRP).to.equal(getBigNumber("30", 6))
      expect(premiumForSSIP).to.equal(getBigNumber("210", 6))
      expect(premiumForBackBurn).to.equal(getBigNumber("60", 6))
    })
    it("Should revert when invalid signer buy policy", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.stakingAsset.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[1].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      await expect(
        this.salesPolicy
          .connect(this.signers[10])
          .buyPolicy(
            assets,
            protocols,
            coverageAmount,
            coverageDuration,
            policyPrice,
            deadline,
            this.stakingAsset.target,
            splitSig.r,
            splitSig.s,
            splitSig.v,
            nonce,
            {
              gasLimit: 1000000,
            },
          ),
      ).to.be.revertedWith("UnoRe: invalid signer")
    })

    it("Should buy policy in ETH  ", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
      const policyPrice = getBigNumber("300", 6)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
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
            value: value,
          },
        )
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }

      // const premiumPoolBalanceAfter = await this.ethers.provider.getBalance(this.premiumPool.target)
      const premiumForSSRP = await this.premiumPool.ssrpPremiumEth()
      const premiumForSSIP = await this.premiumPool.ssipPremiumEth()
      const premiumForBackBurn = await this.premiumPool.backBurnPremiumEth()
      expect(premiumForSSRP).to.equal(13780)

      expect(premiumForSSIP).to.equal(96462)

      expect(premiumForBackBurn).to.equal(27562)
    })
    it("Should revert when less premium paid in ETH", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      await expect(
        this.salesPolicy.buyPolicy(
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
            value: 0,
          },
        ),
      ).to.be.revertedWith("UnoRe: insufficient paid")
    })
    it("Should revert when protocol in blacklist", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("updateCheckIfProtocolInWhitelistArray", [
        true,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setBlackListProtocolByAddress", [
        this.signers[1].address,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

      await expect(
        this.salesPolicy.buyPolicy(
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
            value: value,
          },
        ),
      ).to.be.revertedWith("UnoRe: unavailable policy")
    })

    it("Should revert on Policy purchase cancelled when no remaining insurance capacity available", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      //setting MLR to 1
      let encodedCallData = await this.capitalAgent.interface.encodeFunctionData("setMLR", [1])

      await expect(this.multisig.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)
      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])
      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)
      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      console.log("this.signers[5].address", this.signers[5].address)
      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      const amount = await this.capitalAgent.totalCapitalStaked()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, amount)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [amount, amount]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = await ethers.Signature.from(flatSig)
      await expect(
        this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        ),
      ).to.be.revertedWith("UnoRe: maximum leverage overflow")
    })
    it("Decrease in capacity after buying policy", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      console.log("this.signers[5].address", this.signers[5].address)
      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const totalCoverageAmount = coverageAmount.reduce((acc, currentValue) => acc + currentValue, getBigNumber("0"))
      console.log(totalCoverageAmount)
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)
      const totalUtilizedAmountBefore = await this.capitalAgent.totalUtilizedAmount()

      try {
        let tx = await this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        )
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }
      const totalUtilizedAmountAfter = await this.capitalAgent.totalUtilizedAmount()
      console.log(totalUtilizedAmountAfter, totalUtilizedAmountBefore)
      expect(totalUtilizedAmountAfter - totalUtilizedAmountBefore).to.equal(totalCoverageAmount)
    })
    it("Increase in capacity after users stakes more capital in new pools.", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      //const protocol = await this.salesPolicyFactory.getProtocol(0);

      //setting MLR to 1
      let encodedCallData = await this.capitalAgent.interface.encodeFunctionData("setMLR", [100])

      await expect(this.multisig.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)
      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])
      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)
      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      console.log("this.signers[5].address", this.signers[5].address)
      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      const amount = await this.capitalAgent.totalCapitalStaked()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, amount)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 4), getBigNumber("100", 4)]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)
      await expect(
        this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        ),
      ).to.be.revertedWith("UnoRe: maximum leverage overflow")

      //enter in pools
      await this.mockUNO.approve(this.singleSidedInsurancePool.target, getBigNumber("2000000"))
      await this.mockUNO
        .connect(this.signers[1])
        .approve(this.singleSidedInsurancePool.target, getBigNumber("2000000"), { from: this.signers[1].address })
      await this.singleSidedInsurancePool.enterInPool(getBigNumber("200000"))

      // another one will deposit in pool with the same amount
      await this.singleSidedInsurancePool
        .connect(this.signers[1])
        .enterInPool(getBigNumber("200000"), { from: this.signers[1].address })

      await expect(
        this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        ),
      ).not.to.be.reverted
    })
    it("Increase in capacity after policy expiration", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      console.log("this.signers[5].address", this.signers[5].address)
      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("100000000"))).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
      const policyPrice = getBigNumber("300", 6)
      const protocols = [this.signers[0].address, this.signers[1].address]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
      let nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const totalCoverageAmount = coverageAmount.reduce((acc, currentValue) => acc + currentValue, getBigNumber("0"))
      console.log(totalCoverageAmount)
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      try {
        let tx = await this.salesPolicy.buyPolicy(
          assets,
          protocols,
          coverageAmount,
          coverageDuration,
          policyPrice,
          deadline,
          this.stakingAsset.target,
          splitSig.r,
          splitSig.s,
          splitSig.v,
          nonce,
          {
            gasLimit: 1000000,
          },
        )
        const receipt = await tx.wait()
        console.log("metatransaction receipt", receipt.status)
      } catch (error) {
        console.log("[error]", error)
      }

      let totalUtilizedAmountBefore = await this.capitalAgent.totalUtilizedAmount()
      //console.log('totalUtilizedAmountBefore', totalUtilizedAmountBefore);

      const coverageBefore = await this.salesPolicy.getPolicyData(1)
      const _coverStartAt = coverageBefore[2]
      const _coverageDuration = coverageBefore[1]
      const coveregeAmountBefore = coverageBefore[0]

      await hre.ethers.provider.send("evm_increaseTime", [Number(_coverStartAt) + Number(_coverageDuration) + 100])

      encodedCallData = await this.capitalAgent.interface.encodeFunctionData("updatePolicyStatus", [1])

      await expect(this.multisig.submitTransaction(this.capitalAgent.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++
      let totalUtilizedAmountAfter = await this.capitalAgent.totalUtilizedAmount()
      //console.log('totalUtilizedAmountAfter', totalUtilizedAmountAfter);
      expect(totalUtilizedAmountBefore - totalUtilizedAmountAfter).to.equal(coveregeAmountBefore)
      expect(totalUtilizedAmountAfter).to.equal(getBigNumber("100", 6))
    })
    it("Should revert when signature time expired", async function () {
      this.txIdx = this.txIdx1
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const protocol = await this.salesPolicyFactory.getProtocol(0)

      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.zeroAddress.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.signers[0].address.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[5].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)
      const value = await this.exchangeAgent.getETHAmountForUSDC(policyPrice)

      await hre.ethers.provider.send("evm_increaseTime", [Number(deadline)])

      await expect(
        this.salesPolicy.buyPolicy(
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
            value: value,
          },
        ),
      ).to.be.revertedWith("UnoRe: signature expired")
    })
    it("Should buy policy in USDT after proxy upgrade", async function () {
      this.txIdx = this.txIdx1
      this.capitalAgent = await upgrades.upgradeProxy(this.capitalAgent.target, this.CapitalAgent1)
      let hexData
      const currentDate = new Date()
      let timestamp = (await ethers.provider.getBlock("latest")).timestamp
      const privateKey = process.env.PRIVATE_KEY

      const protocol = await this.salesPolicyFactory.getProtocol(1)
      let encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
        this.stakingAsset.target,
      ])
      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[0].address])

      await expect(this.multisig.submitTransaction(this.salesPolicyFactory.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      encodedCallData = await this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.target])

      await expect(this.multisig.submitTransaction(this.premiumPool.target, 0, encodedCallData))
        .to.emit(this.multisig, "SubmitTransaction")
        .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.target, 0, encodedCallData)

      await expect(this.multisig.confirmTransaction(this.txIdx, false))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[0].address, this.txIdx)

      await expect(this.multisig.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
        .to.emit(this.multisig, "ConfirmTransaction")
        .withArgs(this.signers[1].address, this.txIdx)

      this.txIdx++

      // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.stakingAsset.address)).wait()
      // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
      await (await this.stakingAsset.approve(this.salesPolicyAddress, getBigNumber("1000000000"))).wait()
      // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()
      // await (await this.salesPolicyFactory.updateCheckIfProtocolInWhitelistArray(true)).wait()
      // await (await this.salesPolicyFactory.setBlackListProtocolById(0)).wait()

      //   prepare sign data
      const assets = [this.stakingAsset.target, this.stakingAsset.target]
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
        this.stakingAsset.target.slice(2) +
        paddedNonceHexStr.slice(2) +
        this.salesPolicy.target.slice(2) +
        paddedChainId.slice(2)

      const flatSig = await this.signers[0].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const chainId = await getChainId()

      const functionSignature = await this.salesPolicy.interface.encodeFunctionData("buyPolicy", [
        assets,
        protocols,
        coverageAmount,
        coverageDuration,
        policyPrice,
        deadline,
        this.stakingAsset.target,
        splitSig.r,
        splitSig.s,
        splitSig.v,
        nonce,
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
        ],
      }

      nonce = await this.salesPolicy.getNonce(this.signers[0].address)
      const message = {
        nonce: Number(nonce),
        from: this.signers[0].address,
        functionSignature: functionSignature,
      }

      const premiumPoolBalanceBefore = await this.stakingAsset.balanceOf(this.premiumPool.target)
      expect(premiumPoolBalanceBefore).to.equal(0)

      const signature = await this.signers[0].signTypedData(domainData, types, message)
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
      const premiumPoolBalanceAfter = await this.stakingAsset.balanceOf(this.premiumPool.target)
      const premiumForSSRP = await this.premiumPool.ssrpPremium(this.stakingAsset.target)
      const premiumForSSIP = await this.premiumPool.ssipPremium(this.stakingAsset.target)
      const premiumForBackBurn = await this.premiumPool.backBurnUnoPremium(this.stakingAsset.target)
      expect(premiumPoolBalanceAfter).to.equal(getBigNumber("300", 6))
      expect(premiumForSSRP).to.equal(getBigNumber("30", 6))
      expect(premiumForSSIP).to.equal(getBigNumber("210", 6))
      expect(premiumForBackBurn).to.equal(getBigNumber("60", 6))
    })
  })
})
