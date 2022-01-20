// const { expect } = require("chai")
// const { ethers, network } = require("hardhat")
// const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../scripts/shared/utilities")
// const { BigNumber } = ethers
// const UniswapV2Router = require("../scripts/abis/UniswapV2Router.json")
// const SalesPolicy = require("../scripts/abis/SalesPolicy.json")
// const {
//   WETH_ADDRESS,
//   UNISWAP_FACTORY_ADDRESS,
//   UNISWAP_ROUTER_ADDRESS,
//   TWAP_ORACLE_PRICE_FEED_FACTORY,
//   UNO,
//   USDT,
//   UNO_USDT_PRICE_FEED,
// } = require("../scripts/shared/constants")

// describe("Premium Pool", function () {
//   before(async function () {
//     this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
//     this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
//     this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
//     this.SingleSidedReinsurancePool = await ethers.getContractFactory("SingleSidedReinsurancePool")
//     this.SyntheticSSRP = await ethers.getContractFactory("SyntheticSSRP")
//     this.PremiumPool = await ethers.getContractFactory("PremiumPool")
//     this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
//     this.RiskPool = await ethers.getContractFactory("RiskPool")
//     this.Rewarder = await ethers.getContractFactory("Rewarder")
//     this.RewarderFactory = await ethers.getContractFactory("RewarderFactory")
//     this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
//     this.SyntheticSSRPFactory = await ethers.getContractFactory("SyntheticSSRPFactory")
//     this.MockUNO = await ethers.getContractFactory("MockUNO")
//     this.MockUSDT = await ethers.getContractFactory("MockUSDT")
//     this.signers = await ethers.getSigners()
//     this.zeroAddress = ethers.constants.AddressZero
//     this.routerContract = new ethers.Contract(
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       JSON.stringify(UniswapV2Router.abi),
//       ethers.provider,
//     )
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
//     this.multiSigWallet = await this.MultiSigWallet.deploy(this.owners, this.numConfirmationsRequired)
//     this.mockUNO = this.MockUNO.attach(UNO.rinkeby)
//     this.mockUSDT = this.MockUSDT.attach(USDT.rinkeby)
//     await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber(500000000), { from: this.signers[0].address })
//     await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber(500000, 6), { from: this.signers[0].address })
//     this.masterChefOwner = this.signers[0].address
//     this.claimAssessor = this.signers[3].address
//     this.riskPoolFactory = await this.RiskPoolFactory.deploy()
//     this.rewarderFactory = await this.RewarderFactory.deploy()
//     this.syntheticSSRPFactory = await this.SyntheticSSRPFactory.deploy()

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
//         .approve(UNISWAP_ROUTER_ADDRESS.rinkeby, getBigNumber(10000000), { from: this.signers[0].address })
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

//     await (
//       await this.routerContract
//         .connect(this.signers[0])
//         .addLiquidityETH(
//           this.mockUNO.address,
//           getBigNumber(3000000),
//           getBigNumber(3000000),
//           getBigNumber(3),
//           this.signers[0].address,
//           timestamp,
//           { from: this.signers[0].address, value: getBigNumber(3), gasLimit: 9999999 },
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

//     this.txIdx = 0
//     let encodedCallData

//     encodedCallData = this.exchangeAgent.interface.encodeFunctionData("addWhiteList", [this.premiumPool.address])

//     await expect(this.multiSigWallet.submitTransaction(this.exchangeAgent.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.exchangeAgent.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     // await this.exchangeAgent.addWhiteList(this.premiumPool.address)

//     this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(
//       this.mockUSDT.address,
//       this.exchangeAgent.address,
//       this.premiumPool.address,
//       this.capitalAgent.address,
//       this.multiSigWallet.address,
//     )

//     await (
//       await this.mockUSDT
//         .connect(this.signers[0])
//         .approve(this.premiumPool.address, getBigNumber(10000000), { from: this.signers[0].address })
//     ).wait()

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

//     encodedCallData = this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.signers[0].address])

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

//     this.singleSidedReinsurancePool = await this.SingleSidedReinsurancePool.deploy(
//       this.claimAssessor,
//       this.multiSigWallet.address,
//     )

//     encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createRewarder", [
//       this.signers[0].address,
//       this.rewarderFactory.address,
//       this.mockUNO.address,
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     this.rewarderAddress = await this.singleSidedReinsurancePool.rewarder()
//     this.rewarder = await this.Rewarder.attach(this.rewarderAddress)

//     expect(this.rewarder.address).equal(await this.singleSidedReinsurancePool.rewarder())

//     encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createRiskPool", [
//       "UNO-LP",
//       "UNO-LP",
//       this.riskPoolFactory.address,
//       this.mockUNO.address,
//       getBigNumber(1),
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     this.riskPoolAddress = await this.singleSidedReinsurancePool.riskPool()

//     this.riskPool = await this.RiskPool.attach(this.riskPoolAddress)

//     encodedCallData = this.singleSidedReinsurancePool.interface.encodeFunctionData("createSyntheticSSRP", [
//       this.signers[0].address,
//       this.syntheticSSRPFactory.address,
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.singleSidedReinsurancePool.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.singleSidedReinsurancePool.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     this.syntheticSSRPAddr = await this.singleSidedReinsurancePool.syntheticSSRP()
//     console.log(this.syntheticSSRPAddr)

//     this.syntheticSSRP = await this.SyntheticSSRP.attach(this.syntheticSSRPAddr)

//     encodedCallData = this.syntheticSSRP.interface.encodeFunctionData("createRewarder", [
//       this.signers[0].address,
//       this.rewarderFactory.address,
//       this.mockUSDT.address,
//     ])

//     await expect(this.multiSigWallet.submitTransaction(this.syntheticSSRP.address, 0, encodedCallData))
//       .to.emit(this.multiSigWallet, "SubmitTransaction")
//       .withArgs(this.signers[0].address, this.txIdx, this.syntheticSSRP.address, 0, encodedCallData)

//     await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[0].address, this.txIdx)

//     await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//       .to.emit(this.multiSigWallet, "ConfirmTransaction")
//       .withArgs(this.signers[1].address, this.txIdx)

//     this.txIdx++

//     this.syntheticRewarderAddr = await this.syntheticSSRP.rewarder()
//     this.syntheticRewarder = await this.Rewarder.attach(this.syntheticRewarderAddr)
//   })

//   describe("Premium Pool Collecting", function () {
//     beforeEach(async function () {
//       await (
//         await this.mockUSDT
//           .connect(this.signers[0])
//           .approve(this.premiumPool.address, getBigNumber(10000000), { from: this.signers[0].address })
//       ).wait()
//     })

//     // it("Should collet USDT", async function () {
//     //   await (await this.premiumPool.collectPremium(this.mockUSDT.address, getBigNumber(10000, 6))).wait()
//     //   const premiumForSSRP = await this.premiumPool.SSRP_PREMIUM(this.mockUSDT.address)
//     //   const premiumForSSIP = await this.premiumPool.SSIP_PREMIUM(this.mockUSDT.address)
//     //   const premiumForBackBurn = await this.premiumPool.BACK_BURN_UNO_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumForSSRP).to.equal(getBigNumber(1000, 6))
//     //   expect(premiumForSSIP).to.equal(getBigNumber(7000, 6))
//     //   expect(premiumForBackBurn).to.equal(getBigNumber(2000, 6))
//     // })
//     // it("Should collet ETH", async function () {
//     //   await (
//     //     await this.premiumPool
//     //       .connect(this.signers[0])
//     //       .collectPremiumInETH(getBigNumber(100), { from: this.signers[0].address, value: getBigNumber(100) })
//     //   ).wait()
//     //   const premiumForSSRP = await this.premiumPool.SSRP_PREMIUM_ETH()
//     //   const premiumForSSIP = await this.premiumPool.SSIP_PREMIUM_ETH()
//     //   const premiumForBackBurn = await this.premiumPool.BACK_BURN_PREMIUM_ETH()
//     //   expect(premiumForSSRP).to.equal(getBigNumber(10))
//     //   expect(premiumForSSIP).to.equal(getBigNumber(70))
//     //   expect(premiumForBackBurn).to.equal(getBigNumber(20))
//     // })
//   })

//   describe("Premium Pool distribution", function () {
//     beforeEach(async function () {
//       await (
//         await this.mockUSDT
//           .connect(this.signers[0])
//           .approve(this.premiumPool.address, getBigNumber(10000000), { from: this.signers[0].address })
//       ).wait()
//       await (await this.premiumPool.collectPremium(this.mockUSDT.address, getBigNumber(10000, 6))).wait()
//       await (
//         await this.premiumPool
//           .connect(this.signers[0])
//           .collectPremiumInETH(getBigNumber(1), { from: this.signers[0].address, value: getBigNumber(1) })
//       ).wait()
//     })
//     // it("Should deposit to Synthetic SSRP Rewarder", async function () {
//     //   const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.syntheticRewarder.address)
//     //   expect(usdtBalanceBefore).to.equal(0)
//     //   const premiumForSSRP1 = await this.premiumPool.SSRP_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumForSSRP1).to.equal(getBigNumber(1000, 6))

//     //   let encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSRPRewarder", [
//     //     this.syntheticRewarder.address,
//     //   ])

//     //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, "SubmitTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx)

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[1].address, this.txIdx)

//     //   this.txIdx++

//     //   const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.syntheticRewarder.address)
//     //   console.log("[eth balance of rewarder after distribute]", usdtBalanceAfter.toString())
//     //   expect(usdtBalanceAfter).to.be.gt(getBigNumber(1000, 6))
//     //   const premiumForSSRP2 = await this.premiumPool.SSRP_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumForSSRP2).to.equal(getBigNumber(0))
//     //   const premiumETHForSSRP = await this.premiumPool.SSRP_PREMIUM_ETH()
//     //   expect(premiumETHForSSRP).to.equal(getBigNumber(0))
//     // })
//     // it("Should distribute to Synthetic SSIP Rewarder", async function () {
//     //   const ethBalanceBefore = await ethers.provider.getBalance(this.signers[5].address)
//     //   let premiumETHForSSIP = await this.premiumPool.SSIP_PREMIUM_ETH()
//     //   expect(premiumETHForSSIP).to.equal(getBigNumber(7, 17));

//     //   let encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSIPRewarder", [
//     //     this.zeroAddress,
//     //     this.signers[5].address,
//     //   ]);

//     //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, "SubmitTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx)

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[1].address, this.txIdx)

//     //   this.txIdx++;

//     //   const ethBalanceAfter = await ethers.provider.getBalance(this.signers[5].address)
//     //   premiumETHForSSIP = await this.premiumPool.SSIP_PREMIUM_ETH()
//     //   expect(premiumETHForSSIP).to.equal(getBigNumber(0))
//     //   expect(ethBalanceAfter).to.equal(ethBalanceBefore.add(getBigNumber(7, 17)))

//     //   const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[5].address)
//     //   expect(usdtBalanceBefore).to.equal(0)

//     //   let premiumForSSIP = await this.premiumPool.SSIP_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumForSSIP).to.equal(getBigNumber(7000, 6));

//     //   encodedCallData = this.premiumPool.interface.encodeFunctionData("depositToSyntheticSSIPRewarder", [
//     //     this.mockUSDT.address,
//     //     this.signers[5].address,
//     //   ]);

//     //   await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//     //     .to.emit(this.multiSigWallet, "SubmitTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//     //   await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[0].address, this.txIdx)

//     //   await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//     //     .to.emit(this.multiSigWallet, "ConfirmTransaction")
//     //     .withArgs(this.signers[1].address, this.txIdx)

//     //   this.txIdx++;

//     //   const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.signers[5].address)
//     //   expect(usdtBalanceAfter).to.equal(getBigNumber(7000, 6))

//     //   premiumForSSIP = await this.premiumPool.SSIP_PREMIUM(this.mockUSDT.address)
//     //   expect(premiumForSSIP).to.equal(0)
//     // })
//     it("Should back UNO and burn", async function () {
//       let premiumForBackBurnETH = await this.premiumPool.BACK_BURN_PREMIUM_ETH()
//       expect(premiumForBackBurnETH).to.equal(getBigNumber(2, 17))
//       let premiumForBackBurn = await this.premiumPool.BACK_BURN_UNO_PREMIUM(this.mockUSDT.address)
//       expect(premiumForBackBurn).to.equal(getBigNumber(2000, 6))

//       let encodedCallData = this.premiumPool.interface.encodeFunctionData("buyBackAndBurn", []);

//       await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
//         .to.emit(this.multiSigWallet, "SubmitTransaction")
//         .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

//       await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[0].address, this.txIdx)

//       await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
//         .to.emit(this.multiSigWallet, "ConfirmTransaction")
//         .withArgs(this.signers[1].address, this.txIdx)

//       this.txIdx++;
//       await (await this.premiumPool.buyBackAndBurn()).wait()

//       premiumForBackBurnETH = await this.premiumPool.BACK_BURN_PREMIUM_ETH()
//       expect(premiumForBackBurnETH).to.equal(getBigNumber(0))
//       premiumForBackBurn = await this.premiumPool.BACK_BURN_UNO_PREMIUM(this.mockUSDT.address)
//       expect(premiumForBackBurn).to.equal(getBigNumber(0))
//     })
//   })
// })
