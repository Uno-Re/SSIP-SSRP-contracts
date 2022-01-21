// const { expect } = require("chai")
// const { ethers, network } = require("hardhat")
// const sigUtil = require("eth-sig-util")
// // const { Biconomy } = require('@biconomy/mexa');
// const {
//   getBigNumber,
//   getNumber,
//   getHexStrFromStr,
//   getPaddedHexStrFromBN,
//   getPaddedHexStrFromBNArray,
//   getChainId,
//   getSignatureParameters,
//   advanceBlockTo,
// } = require("../scripts/shared/utilities")
// const { BigNumber } = ethers
// const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
// const ERC20 = require("../scripts/abis/ERC20.json")
// const {
//   WETH_ADDRESS,
//   UNISWAP_FACTORY_ADDRESS,
//   UNISWAP_ROUTER_ADDRESS,
//   TWAP_ORACLE_PRICE_FEED_FACTORY,
//   UNO,
//   USDT,
//   UNO_USDT_PRICE_FEED,
// } = require("../scripts/shared/constants")

// describe("SalesPolicy", function () {
//   before(async function () {
//     this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
//     this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
//     this.PremiumPool = await ethers.getContractFactory("PremiumPool")
//     this.Rewarder = await ethers.getContractFactory("Rewarder")
//     this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
//     this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
//     this.RiskPool = await ethers.getContractFactory("RiskPool")
//     this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
//     this.MockUNO = await ethers.getContractFactory("MockUNO")
//     this.MockUSDT = await ethers.getContractFactory("MockUSDT")
//     this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
//     this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
//     this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
//     this.signers = await ethers.getSigners()
//     this.zeroAddress = ethers.constants.AddressZero
//     this.routerContract = new ethers.Contract(
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       JSON.stringify(UniswapV2Router.abi),
//       ethers.provider,
//     )
//     this.devWallet = this.signers[0]

//     this.domainType = [
//       { name: "name", type: "string" },
//       { name: "version", type: "string" },
//       { name: "verifyingContract", type: "address" },
//       { name: "salt", type: "bytes32" },
//     ]
//     this.metaTransactionType = [
//       { name: "nonce", type: "uint256" },
//       { name: "from", type: "address" },
//       { name: "functionSignature", type: "bytes" },
//     ]

//     this.owners = [
//       this.signers[0].address,
//       this.signers[1].address,
//       this.signers[2].address,
//       this.signers[3].address,
//       this.signers[4].address,
//     ]

//     this.numConfirmationsRequired = 2
//   })

//   beforeEach(async function () {
//     this.mockUNO = this.MockUNO.attach(UNO.rinkeby)
//     this.mockUSDT = this.MockUSDT.attach(USDT.rinkeby)
//     this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
//     this.rewarderFactory = await this.RewarderFactory.deploy()
//     await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber(500000000), { from: this.signers[0].address })
//     await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber(500000, 6), { from: this.signers[0].address })
//     this.masterChefOwner = this.signers[0].address
//     this.claimAssessor = this.signers[3].address
//     this.riskPoolFactory = await this.RiskPoolFactory.deploy()

//     this.mockUNO.transfer(this.signers[1].address, getBigNumber(2000000))
//     this.mockUNO.transfer(this.signers[2].address, getBigNumber(3000000))

//     const assetArray = [this.mockUSDT.address, this.mockUNO.address, this.zeroAddress]

//     const timestamp = new Date().getTime()

//     await (
//       await this.mockUNO
//         .connect(this.signers[0])
//         .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber(10000000), { from: this.signers[0].address })
//     ).wait()
//     await (
//       await this.mockUSDT
//         .connect(this.signers[0])
//         .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber(10000000, 6), { from: this.signers[0].address })
//     ).wait()

//     console.log("Adding liquidity...")

//     await (
//       await this.routerContract
//         .connect(this.signers[0])
//         .addLiquidity(
//           this.mockUNO.address,
//           this.mockUSDT.address,
//           getBigNumber(3000000),
//           getBigNumber(3000, 6),
//           getBigNumber(3000000),
//           getBigNumber(3000, 6),
//           this.signers[0].address,
//           timestamp,
//           { from: this.signers[0].address, gasLimit: 9999999 },
//         )
//     ).wait()

//     this.exchangeAgent = await this.ExchangeAgent.deploy(
//       this.mockUSDT.address,
//       WETH_ADDRESS.rinkeby,
//       TWAP_ORACLE_PRICE_FEED_FACTORY.rinkeby,
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       UNISWAP_FACTORY_ADDRESS.rinkeby,
//       this.multiSigWallet.address,
//     )

//     this.premiumPool = await this.PremiumPool.deploy(
//       this.exchangeAgent.address,
//       this.mockUNO.address,
//       this.mockUSDT.address,
//       this.multiSigWallet.address,
//     )
//     this.capitalAgent = await this.CapitalAgent.deploy(
//       this.exchangeAgent.address,
//       this.mockUNO.address,
//       this.mockUSDT.address,
//       this.multiSigWallet.address,
//     )
//     this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
//       this.mockUSDT.address,
//       this.exchangeAgent.address,
//       this.premiumPool.address,
//       this.capitalAgent.address,
//       this.multiSigWallet.address,
//     )

//     let encodedCallData
//     this.txIdx = 0

//     // add 2 protocols
//     for (let idx = 0; idx < 3; idx++) {
//       encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('addProtocol', [
//         this.signers[idx + 1].address
//       ]);

//       await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, 'SubmitTransaction')
//         .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData);

//       await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//         .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//         .withArgs(this.signers[0].address, this.txIdx);

//       await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//         .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//         .withArgs(this.signers[1].address, this.txIdx);

//       this.txIdx++
//       // await this.salesPolicyFactory.addProtocol(this.signers[idx + 1].address)
//     }

//     expect(await this.salesPolicyFactory.allProtocolsLength()).equal(3)

//     encodedCallData = this.premiumPool.interface.encodeFunctionData("addCurrency", [this.mockUSDT.address])

//     await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     // await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()

//     this.singleSidedInsurancePool = await this.SingleSidedInsurancePool.deploy(
//       this.claimAssessor,
//       this.exchangeAgent.address,
//       this.capitalAgent.address,
//       this.multiSigWallet.address,
//     )

//     encodedCallData = this.capitalAgent.interface.encodeFunctionData("addPoolWhiteList", [this.singleSidedInsurancePool.address])
//     console.log('[addPoolWhiteList]', encodedCallData)

//     await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.executeTransaction(this.txIdx)).to.be.revertedWith("cannot execute tx")

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false)).to.be.revertedWith("tx already confirmed")

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     encodedCallData = this.capitalAgent.interface.encodeFunctionData("setSalesPolicyFactory", [this.salesPolicyFactory.address])
//     console.log('[setSalesPolicyFactory]', encodedCallData)

//     await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("createRiskPool", [
//       "UNO-LP",
//       "UNO-LP",
//       this.riskPoolFactory.address,
//       this.mockUNO.address,
//       getBigNumber(1),
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     await this.mockUNO.approve(this.singleSidedInsurancePool.address, getBigNumber(1000000))
//     await this.mockUNO
//       .connect(this.signers[1])
//       .approve(this.singleSidedInsurancePool.address, getBigNumber(1000000), { from: this.signers[1].address })

//     // await (
//     //   await this.mockUNO
//     //     .connect(this.signers[0])
//     //     .transfer(this.rewarder.address, getBigNumber(100000), { from: this.signers[0].address })
//     // ).wait()

//     await this.singleSidedInsurancePool.enterInPool(getBigNumber(100000))

//     // block number when deposit in pool for the first time
//     const beforeBlockNumber = await ethers.provider.getBlockNumber()

//     await advanceBlockTo(beforeBlockNumber + 10000)

//     // another one will deposit in pool with the same amount
//     await this.singleSidedInsurancePool
//       .connect(this.signers[1])
//       .enterInPool(getBigNumber(100000), { from: this.signers[1].address })

//     encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMCR", [getBigNumber(1, 16)])

//     await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMLR", [getBigNumber(3)])

//     await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("newSalesPolicy", [
//       this.exchangeAgent.address,
//       this.premiumPool.address,
//       this.capitalAgent.address,
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
//     console.log(this.salesPolicyAddress)
//     this.salesPolicy = await this.SalesPolicy.attach(await this.salesPolicyFactory.salesPolicy())
//   })

//   describe("Sales policy Action", function () {
//     // it("Should update premium pool address", async function () {
//     //   const premiumPoolAddressBefore = await this.salesPolicyFactory.premiumPool()
//     //   await this.salesPolicyFactory.setPremiumPool(this.signers[3].address)
//     //   const premiumPoolAddressAfter = await this.salesPolicyFactory.premiumPool()
//     //   expect(premiumPoolAddressBefore).to.be.not.equal(premiumPoolAddressAfter)
//     //   expect(premiumPoolAddressAfter).to.equal(this.signers[3].address)
//     // })

//     it("Should buy policy in USDT", async function () {
//       let hexData
//       const currentDate = new Date()
//       const timestamp = Math.floor(currentDate.getTime() / 1000)
//       const privateKey = process.env.PRIVATE_KEY

//       const protocol = await this.salesPolicyFactory.getProtocol(1)

//       let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
//         this.mockUSDT.address,
//       ])

//       await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//         .to.emit(this.multiSigWallet, "SubmitTransaction")
//         .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

//       await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[0].address, this.txIdx)

//       await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[1].address, this.txIdx)

//       this.txIdx++

//       encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", [this.signers[5].address])

//       await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//         .to.emit(this.multiSigWallet, "SubmitTransaction")
//         .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

//       await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[0].address, this.txIdx)

//       await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[1].address, this.txIdx)

//       this.txIdx++

//       encodedCallData = this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.address])

//       await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//         .to.emit(this.multiSigWallet, "SubmitTransaction")
//         .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//       await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[0].address, this.txIdx)

//       await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[1].address, this.txIdx)

//       this.txIdx++

//       // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.mockUSDT.address)).wait()
//       // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
//       await (await this.mockUSDT.approve(this.salesPolicyAddress, getBigNumber(100000000))).wait()
//       // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()
//       // await (await this.salesPolicyFactory.updateCheckIfProtocolInWhitelistArray(true)).wait()
//       // await (await this.salesPolicyFactory.setBlackListProtocolById(0)).wait()

//       //   prepare sign data
//       const policyPrice = getBigNumber(300, 6)
//       const protocols = [this.signers[0].address, this.signers[1].address]
//       const coverageDuration = [BigNumber.from(24 * 3600 * 30), BigNumber.from(24 * 3600 * 15)]
//       const coverageAmount = [getBigNumber(100, 6), getBigNumber(100, 6)]
//       const deadline = getBigNumber(timestamp - 7 * 3600, 0)

//       const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
//       const paddedProtocolsHexStr =
//         "000000000000000000000000" + protocols[0].slice(2) + "000000000000000000000000" + protocols[1].slice(2)
//       const paddedCoverageDurationHexStr = getPaddedHexStrFromBNArray(coverageDuration)
//       const paddedCoverageAmountHexStr = getPaddedHexStrFromBNArray(coverageAmount)
//       const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)

//       hexData =
//         "0x" +
//         paddedPolicyPriceHexStr.slice(2) +
//         paddedProtocolsHexStr +
//         paddedCoverageDurationHexStr.slice(2) +
//         paddedCoverageAmountHexStr.slice(2) +
//         paddedDeadlineHexStr.slice(2) +
//         this.mockUSDT.address.slice(2)

//       const flatSig = await this.signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(hexData)))
//       const splitSig = ethers.utils.splitSignature(flatSig)

//       const chainId = await getChainId()
//       console.log("chainId", chainId)

//       const domainData = {
//         name: "BuyPolicyMetaTransaction",
//         version: "1",
//         verifyingContract: this.salesPolicyAddress,
//         salt: getPaddedHexStrFromBN(chainId),
//       }

//       const functionSignature = this.salesPolicy.interface.encodeFunctionData("buyPolicy", [
//         protocols,
//         coverageAmount,
//         coverageDuration,
//         policyPrice,
//         deadline,
//         this.mockUSDT.address,
//         splitSig.r,
//         splitSig.s,
//         splitSig.v,
//       ])

//       const nonce = await this.salesPolicy.getNonce(this.signers[0].address)
//       const message = {
//         nonce: nonce.toNumber(),
//         from: this.signers[0].address,
//         functionSignature: functionSignature,
//       }

//       const dataToSign = {
//         types: {
//           EIP712Domain: this.domainType,
//           MetaTransaction: this.metaTransactionType,
//         },
//         domain: domainData,
//         primaryType: "MetaTransaction",
//         message: message,
//       }

//       const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.address)
//       expect(premiumPoolBalanceBefore).to.equal(0)

//       const signature = sigUtil.signTypedMessage(new Buffer.from(privateKey, "hex"), { data: dataToSign }, "V3")
//       let { r, s, v } = getSignatureParameters(signature)

//       try {
//         let tx = await this.salesPolicy.executeMetaTransaction(this.signers[0].address, functionSignature, r, s, v, {
//           gasLimit: 1000000,
//         })
//         const receipt = await tx.wait()
//         console.log("metatransaction receipt", receipt.status)
//       } catch (error) {
//         console.log("[error]", error)
//       }

//       const premiumPoolBalanceAfter = await this.mockUSDT.balanceOf(this.premiumPool.address)
//       const premiumForSSRP = await this.premiumPool.SSRP_PREMIUM(this.mockUSDT.address)
//       const premiumForSSIP = await this.premiumPool.SSIP_PREMIUM(this.mockUSDT.address)
//       const premiumForBackBurn = await this.premiumPool.BACK_BURN_UNO_PREMIUM(this.mockUSDT.address)
//       expect(premiumPoolBalanceAfter).to.equal(getBigNumber(300, 6))
//       expect(premiumForSSRP).to.equal(getBigNumber(30, 6))
//       expect(premiumForSSIP).to.equal(getBigNumber(210, 6))
//       expect(premiumForBackBurn).to.equal(getBigNumber(60, 6))
//     })

//     // it("Should buy policy in USDT directly", async function () {
//     //   let hexData
//     //   const currentDate = new Date()
//     //   const timestamp = Math.floor(currentDate.getTime() / 1000)
//     //   const protocol = await this.salesPolicyFactory.getProtocol(0)

//     //   let encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('approvePremiumInPolicy', [
//     //     this.mockUSDT.address
//     //   ]);

//     //   await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, 'SubmitTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData);

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx);

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[1].address, this.txIdx);

//     //   this.txIdx++;

//     //   encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('setSignerInPolicy', [
//     //     this.signers[5].address
//     //   ]);

//     //   await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, 'SubmitTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData);

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx);

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[1].address, this.txIdx);

//     //   this.txIdx++;

//     //   encodedCallData = this.premiumPool.interface.encodeFunctionData('addWhiteList', [
//     //     this.salesPolicy.address
//     //   ]);

//     //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, 'SubmitTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData);

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[0].address, this.txIdx);

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, 'ConfirmTransaction')
//     //     .withArgs(this.signers[1].address, this.txIdx);

//     //   this.txIdx++;
//     //   // await (await this.salesPolicyFactory.approvePremiumInPolicy(this.mockUSDT.address)).wait()
//     //   // await (await this.salesPolicyFactory.setSignerInPolicy(this.signers[5].address)).wait()
//     //   await (await this.mockUSDT.approve(this.salesPolicyAddress, getBigNumber(100000000))).wait()
//     //   // await (await this.premiumPool.addWhiteList(this.salesPolicy.address)).wait()

//     //   //   prepare sign data
//     //   const policyPrice = getBigNumber(300, 6)
//     //   const protocols = [this.signers[0].address, this.signers[1].address]
//     //   const coverageDuration = [BigNumber.from(24 * 3600 * 30), BigNumber.from(24 * 3600 * 15)]
//     //   const coverageAmount = [getBigNumber(100, 6), getBigNumber(100, 6)]
//     //   const deadline = getBigNumber(timestamp - 7 * 3600, 0)

//     //   const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
//     //   const paddedProtocolsHexStr = '000000000000000000000000' + protocols[0].slice(2) + '000000000000000000000000' + protocols[1].slice(2)
//     //   const paddedCoverageDurationHexStr = getPaddedHexStrFromBNArray(coverageDuration)
//     //   const paddedCoverageAmountHexStr = getPaddedHexStrFromBNArray(coverageAmount)
//     //   const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)

//     //   hexData =
//     //     "0x" +
//     //     paddedPolicyPriceHexStr.slice(2) +
//     //     paddedProtocolsHexStr +
//     //     paddedCoverageDurationHexStr.slice(2) +
//     //     paddedCoverageAmountHexStr.slice(2) +
//     //     paddedDeadlineHexStr.slice(2) +
//     //     this.mockUSDT.address.slice(2)

//     //   const flatSig = await this.signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(hexData)))
//     //   const splitSig = ethers.utils.splitSignature(flatSig)

//     //   const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.address)
//     //   expect(premiumPoolBalanceBefore).to.equal(0)

//     //   try {
//     //     let tx = await this.salesPolicy.buyPolicy(
//     //     protocols,
//     //     coverageAmount,
//     //     coverageDuration,
//     //     policyPrice,
//     //     deadline,
//     //     this.mockUSDT.address,
//     //     splitSig.r,
//     //     splitSig.s,
//     //     splitSig.v,
//     //     {
//     //       gasLimit: 1000000,
//     //     })
//     //     const receipt = await tx.wait()
//     //     console.log("metatransaction receipt", receipt.status)
//     //   } catch (error) {
//     //     console.log("[error]", error)
//     //   }

//     //   const premiumPoolBalanceAfter = await this.mockUSDT.balanceOf(this.premiumPool.address)
//     //   const premiumForSSRP = await this.premiumPool.SSRP_PREMIUM(this.mockUSDT.address)
//     //   const premiumForSSIP = await this.premiumPool.SSIP_PREMIUM(this.mockUSDT.address)
//     //   const premiumForBackBurn = await this.premiumPool.BACK_BURN_UNO_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumPoolBalanceAfter).to.equal(getBigNumber(300, 6))
//     //   expect(premiumForSSRP).to.equal(getBigNumber(30, 6))
//     //   expect(premiumForSSIP).to.equal(getBigNumber(210, 6))
//     //   expect(premiumForBackBurn).to.equal(getBigNumber(60, 6))
//     // })

//     // it("Should revert signature expired", async function () {
//     //   const timestamp = Math.floor(new Date().getTime() / 1000)
//     //   const currentDate = new Date()
//     //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 10))
//     //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
//     //   network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
//     //   await network.provider.send("evm_mine")

//     //   const privateKey = process.env.PRIVATE_KEY

//     //   const protocol = await this.salesPolicyFactory.getProtocol(0)
//     //   const salesPolicy1Address = protocol["salesPolicy"]
//     //   const salesPolicy1 = await this.SalesPolicy.attach(salesPolicy1Address)

//     //   await (await this.salesPolicyFactory.approvePremiumInPolicy(0, this.mockUSDT.address)).wait()
//     //   await (await this.mockUSDT.approve(salesPolicy1Address, getBigNumber(100000000))).wait()

//     //   //   prepare sign data
//     //   const policyPrice = getBigNumber(100, 6)
//     //   const coverageDuration = BigNumber.from(24 * 3600 * 30)
//     //   const coverageAmount = getBigNumber(100, 6)
//     //   const deadline = getBigNumber(timestamp, 0)

//     //   const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
//     //   const paddedCoverageDurationHexStr = getPaddedHexStrFromBN(coverageDuration)
//     //   const paddedCoverageAmountHexStr = getPaddedHexStrFromBN(coverageAmount)
//     //   const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)

//     //   hexData =
//     //     "0x" +
//     //     paddedPolicyPriceHexStr.slice(2) +
//     //     paddedCoverageDurationHexStr.slice(2) +
//     //     paddedCoverageAmountHexStr.slice(2) +
//     //     paddedDeadlineHexStr.slice(2) +
//     //     this.mockUSDT.address.slice(2)

//     //   const flatSig = await this.signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(hexData)))
//     //   const splitSig = ethers.utils.splitSignature(flatSig)

//     //   const chainId = await getChainId()
//     //   console.log("chainId", chainId)

//     //   const domainData = {
//     //     name: "BuyPolicyMetaTransaction",
//     //     version: "1",
//     //     verifyingContract: salesPolicy1Address,
//     //     salt: getPaddedHexStrFromBN(chainId),
//     //   }

//     //   const functionSignature = salesPolicy1.interface.encodeFunctionData("buyPolicy", [
//     //     coverageAmount,
//     //     coverageDuration,
//     //     policyPrice,
//     //     deadline,
//     //     this.mockUSDT.address,
//     //     splitSig.r,
//     //     splitSig.s,
//     //     splitSig.v,
//     //   ])

//     //   const nonce = await salesPolicy1.getNonce(this.signers[0].address)
//     //   const message = {
//     //     nonce: nonce.toNumber(),
//     //     from: this.signers[0].address,
//     //     functionSignature: functionSignature,
//     //   }

//     //   const dataToSign = {
//     //     types: {
//     //       EIP712Domain: this.domainType,
//     //       MetaTransaction: this.metaTransactionType,
//     //     },
//     //     domain: domainData,
//     //     primaryType: "MetaTransaction",
//     //     message: message,
//     //   }

//     //   await (await this.salesPolicyFactory.approvePremiumInPolicy(0, this.mockUSDT.address)).wait()
//     //   await (await this.mockUSDT.approve(salesPolicy1Address, getBigNumber(100000000))).wait()
//     //   const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.address)
//     //   expect(premiumPoolBalanceBefore).to.equal(0)

//     //   const signature = sigUtil.signTypedMessage(new Buffer.from(privateKey, "hex"), { data: dataToSign }, "V3")
//     //   let { r, s, v } = getSignatureParameters(signature)

//     //   try {
//     //     let tx = await salesPolicy1.executeMetaTransaction(this.signers[0].address, functionSignature, r, s, v, {
//     //       gasLimit: 1000000,
//     //     })
//     //     const receipt = await tx.wait()
//     //     console.log("metatransaction receipt", receipt.status)
//     //   } catch (error) {
//     //     console.log("[error]", error)
//     //   }

//     //   // const flatSig = await this.signers[5].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(hexData)))
//     //   // const splitSig = ethers.utils.splitSignature(flatSig)
//     //   // await expect(salesPolicy1.buyPolicy(
//     //   //   getBigNumber(100000),
//     //   //   BigNumber.from(24 * 3600 * 30),
//     //   //   getBigNumber(100, 6),
//     //   //   deadline,
//     //   //   this.mockUSDT.address,
//     //   //   splitSig.r,
//     //   //   splitSig.s,
//     //   //   splitSig.v,
//     //   // )).to.be.revertedWith("UnoRe: signature expired")
//     // })
//   })
// })
