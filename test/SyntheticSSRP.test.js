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

// describe("Synthetic SSRP", function () {
//   before(async function () {
//     this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
//     this.SingleSidedReinsurancePool = await ethers.getContractFactory("SingleSidedReinsurancePool")
//     this.SyntheticSSRP = await ethers.getContractFactory("SyntheticSSRP")
//     this.PremiumPool = await ethers.getContractFactory("PremiumPool")
//     this.RiskPoolFactory = await ethers.getContractFactory("RiskPoolFactory")
//     this.RiskPool = await ethers.getContractFactory("RiskPool")
//     this.Rewarder = await ethers.getContractFactory("Rewarder")
//     this.SyntheticRewarder = await ethers.getContractFactory("SyntheticRewarder")
//     this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
//     this.MockUNO = await ethers.getContractFactory("MockUNO")
//     this.MockUSDT = await ethers.getContractFactory("MockUSDT")
//     this.signers = await ethers.getSigners()
//     this.zeroAddress = ethers.constants.AddressZero
//     this.routerContract = new ethers.Contract(
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       JSON.stringify(UniswapV2Router.abi),
//       ethers.provider,
//     )
//   })

//   beforeEach(async function () {
//     this.mockUNO = this.MockUNO.attach(UNO.rinkeby)
//     this.mockUSDT = this.MockUSDT.attach(USDT.rinkeby)
//     await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber(500000000), { from: this.signers[0].address })
//     await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber(500000, 6), { from: this.signers[0].address })
//     this.masterChefOwner = this.signers[0].address
//     this.claimAssessor = this.signers[3].address
//     this.riskPoolFactory = await this.RiskPoolFactory.deploy()
//     this.salesPolicyFactory = await this.SalesPolicyFactory.deploy(this.mockUSDT.address, this.mockUNO.address)

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

//     this.exchangeAgent = await this.ExchangeAgent.deploy(
//       this.mockUSDT.address,
//       WETH_ADDRESS.rinkeby,
//       TWAP_ORACLE_PRICE_FEED_FACTORY.rinkeby,
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       UNISWAP_FACTORY_ADDRESS.rinkeby,
//     )

//     this.premiumPool = await this.PremiumPool.deploy(this.exchangeAgent.address, this.mockUNO.address, this.mockUSDT.address)

//     await this.exchangeAgent.addWhiteList(this.premiumPool.address);

//     await (
//       await this.mockUSDT
//         .connect(this.signers[0])
//         .approve(this.premiumPool.address, getBigNumber(10000000), { from: this.signers[0].address })
//     ).wait()
//     await (await this.premiumPool.addCurrency(this.mockUSDT.address)).wait()

//     await (await this.premiumPool.collectPremium(this.mockUSDT.address, getBigNumber(10000, 6))).wait()
//     await (
//       await this.premiumPool
//         .connect(this.signers[0])
//         .collectPremiumInETH(getBigNumber(100), { from: this.signers[0].address, value: getBigNumber(100) })
//     ).wait()

//     this.singleSidedReinsurancePool = await this.SingleSidedReinsurancePool.deploy(
//       this.masterChefOwner,
//       this.claimAssessor,
//       this.exchangeAgent.address,
//       this.premiumPool.address,
//     )
//     this.rewarder = await this.Rewarder.deploy(this.mockUNO.address, this.singleSidedReinsurancePool.address)

//     await this.singleSidedReinsurancePool.setRewarder(this.rewarder.address)
//     expect(this.rewarder.address).equal(await this.singleSidedReinsurancePool.rewarder())

//     await (
//       await this.singleSidedReinsurancePool.createRiskPool(
//         "UNO-LP",
//         "UNO-LP",
//         this.riskPoolFactory.address,
//         this.mockUNO.address,
//         getBigNumber(1),
//       )
//     ).wait()

//     this.riskPoolAddress = await this.singleSidedReinsurancePool.riskPool()

//     this.riskPool = await this.RiskPool.attach(this.riskPoolAddress)

//     this.syntheticSSRP = await this.SyntheticSSRP.deploy(
//       this.masterChefOwner,
//       this.exchangeAgent.address,
//       this.premiumPool.address,
//       this.riskPool.address,
//       this.mockUNO.address,
//     )

//     this.syntheticRewarder = await this.SyntheticRewarder.deploy(this.syntheticSSRP.address)
//     await this.syntheticSSRP.setRewarder(this.syntheticRewarder.address)
//   })

//   describe("Synthetic SSRP Basic", function () {
//     // it("Should set uno multiplier factor", async function () {
//     //   const poolInfoBefore = await this.singleSidedReinsurancePool.poolInfo()
//     //   expect(poolInfoBefore.unoMultiplierPerBlock).equal(getBigNumber(1))
//     //   await this.singleSidedReinsurancePool.setRewardMultiplier(getBigNumber(2))
//     //   const poolInfoAfter = await this.singleSidedReinsurancePool.poolInfo()
//     //   expect(poolInfoAfter.unoMultiplierPerBlock).equal(getBigNumber(2))
//     // })
//   })

//   describe("Synthetic SSRP Actions", function () {
//     beforeEach(async function () {
//       await (await this.mockUNO.approve(this.singleSidedReinsurancePool.address, getBigNumber(100000000))).wait()
//       await (
//         await this.mockUNO
//           .connect(this.signers[1])
//           .approve(this.singleSidedReinsurancePool.address, getBigNumber(100000000), { from: this.signers[1].address })
//       ).wait()
//       await (await this.singleSidedReinsurancePool.enterInPool(getBigNumber(10000))).wait()
//       await (
//         await this.singleSidedReinsurancePool
//           .connect(this.signers[1])
//           .enterInPool(getBigNumber(10000), { from: this.signers[1].address })
//       ).wait()
//       await (await this.riskPool.approve(this.syntheticSSRP.address, getBigNumber(100000000))).wait()
//       await (
//         await this.riskPool
//           .connect(this.signers[1])
//           .approve(this.syntheticSSRP.address, getBigNumber(100000000), { from: this.signers[1].address })
//       ).wait()
//     })

//     describe("Synthetic SSRP Staking", function () {
//       //   it("Should enter in pool and pending reward will be zero", async function () {
//       //     const pendingUnoRewardBefore = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     await this.syntheticSSRP.enterInPool(getBigNumber(1000))
//       //     const userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //     const stakedAmount = userInfo.amount
//       //     expect(stakedAmount).to.equal(getBigNumber(1000))
//       //     const pendingUnoRewardAfter = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     expect(pendingUnoRewardBefore).to.equal(pendingUnoRewardAfter)
//       //   })
//       //   it("Should enter in pool and check pending reward after generate 10000 blocks", async function () {
//       //     const pendingUnoRewardBefore = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     console.log("[pendingUnoRewardBefore]", pendingUnoRewardBefore.toString())
//       //     await this.syntheticSSRP.enterInPool(getBigNumber(1000))
//       //     const beforeBlockNumber = await ethers.provider.getBlockNumber()
//       //     const userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //     const stakedAmount = userInfo.amount
//       //     expect(stakedAmount).to.equal(getBigNumber(1000))
//       //     await advanceBlockTo(beforeBlockNumber + 10000)
//       //     const afterBlockNumber = await ethers.provider.getBlockNumber()
//       //     const pendingUnoRewardAfter = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     console.log("[pendingUnoRewardAfter]", pendingUnoRewardAfter.toString(), getNumber(pendingUnoRewardAfter))
//       //     expect(pendingUnoRewardBefore).to.be.not.equal(pendingUnoRewardAfter)
//       //   })
//       //   it("Should enter in pool by multiple users and check pending reward after generate 10000 blocks", async function () {
//       //     const pendingUnoRewardBefore = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     expect(pendingUnoRewardBefore).to.equal(0)
//       //     await this.syntheticSSRP.enterInPool(getBigNumber(1000))
//       //     // block number when deposit in pool for the first time
//       //     const beforeBlockNumber = await ethers.provider.getBlockNumber()
//       //     const userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //     const stakedAmount = userInfo.amount
//       //     expect(stakedAmount).to.equal(getBigNumber(1000))
//       //     await advanceBlockTo(beforeBlockNumber + 10000)
//       //     // pending reward after 10000 blocks
//       //     const pendingUnoRewardAfter = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     console.log("[pendingUnoRewardAfter]", getNumber(pendingUnoRewardAfter))
//       //     // another one will deposit in pool with the same amount
//       //     await this.syntheticSSRP
//       //       .connect(this.signers[1])
//       //       .enterInPool(getBigNumber(1000), { from: this.signers[1].address })
//       //     // pending reward of the signer 0 and 1 after another 10000 blocks
//       //     const afterBlockNumber1 = await ethers.provider.getBlockNumber()
//       //     await advanceBlockTo(afterBlockNumber1 + 10000)
//       //     const pendingUnoRewardAfter1 = await this.syntheticSSRP.pendingUno(this.signers[0].address)
//       //     const pendingUnoRewardAfter2 = await this.syntheticSSRP.pendingUno(this.signers[1].address)
//       //     console.log("[pendingUnoRewardAfter1,2]", getNumber(pendingUnoRewardAfter1), getNumber(pendingUnoRewardAfter2))
//       //     expect(pendingUnoRewardAfter1).to.gte(pendingUnoRewardAfter)
//       //     expect(pendingUnoRewardAfter2).to.be.not.equal(0)
//       //   })
//     })

//     describe("Synthetic SSRP withdraw", function () {
//       beforeEach(async function () {
//         const premiumETHBalance = await ethers.provider.getBalance(this.premiumPool.address);
//         console.log('[premiumETHBalance]', premiumETHBalance.toString());
//         await this.premiumPool.depositToSyntheticSSRPRewarder(this.syntheticRewarder.address);
//         const premiumETHBalance2 = await ethers.provider.getBalance(this.premiumPool.address);
//         console.log('[premiumETHBalance2]', premiumETHBalance2.toString());

//         await this.syntheticSSRP.enterInPool(getBigNumber(1000))

//         // block number when deposit in pool for the first time
//         const beforeBlockNumber = await ethers.provider.getBlockNumber()

//         await advanceBlockTo(beforeBlockNumber + 10000)

//         // another one will deposit in pool with the same amount
//         await this.syntheticSSRP.connect(this.signers[1]).enterInPool(getBigNumber(1000), { from: this.signers[1].address })

//         // pending reward of the signer 0 and 1 after another 10000 blocks
//         const afterBlockNumber1 = await ethers.provider.getBlockNumber()
//         await advanceBlockTo(afterBlockNumber1 + 10000)

//       })

//       // it("Sould withdraw 1000 UNO and then will be this WR in pending but block reward will be transferred at once", async function () {
//       //   //check the uno and risk pool LP token balance of the singer 0 before withdraw
//       //   const ethBalanceBefore = await ethers.provider.getBalance(this.signers[0].address)
//       //   let userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   let stakedAmount = userInfo.amount
//       //   expect(stakedAmount).to.equal(getBigNumber(1000))
//       //   // signer 0 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(1000))
//       //   // check the uno and risk pool LP token balance of the singer 0 after withdraw
//       //   const ethBalanceAfter = await ethers.provider.getBalance(this.signers[0].address)
//       //   userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   stakedAmount = userInfo.amount
//       //   expect(stakedAmount).to.equal(getBigNumber(1000))
//       //   console.log("[script]", ethBalanceAfter.sub(ethBalanceBefore).toString())
//       //   expect(ethBalanceBefore).to.lt(ethBalanceAfter)
//       // })

//       // it("Sould check withdraw pending status", async function () {
//       //   // signer 0 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(1000))
//       //   // signer 1 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP
//       //     .connect(this.signers[1])
//       //     .leaveFromPoolInPending(getBigNumber(1000), { from: this.signers[1].address })
//       //   const userInfo1 = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   const userInfo2 = await this.syntheticSSRP.userInfo(this.signers[1].address)
//       //   const totalPendingWithdrawAmount = await this.syntheticSSRP.totalWithdrawPending()
//       //   expect(userInfo1.pendingWithdrawAmount).to.equal(getBigNumber(1000))
//       //   expect(userInfo2.pendingWithdrawAmount).to.equal(getBigNumber(1000))
//       //   expect(totalPendingWithdrawAmount).to.equal(getBigNumber(2000))
//       // })

//       // it("Sould not claim within 10 days since WR", async function () {
//       //   // signer 0 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(1000))
//       //   const currentDate = new Date()
//       //   const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
//       //   const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
//       //   network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
//       //   await network.provider.send("evm_mine")
//       //   // signer 0 submit claim after 5 days since WR
//       //   await expect(this.syntheticSSRP.leaveFromPending()).to.be.revertedWith("UnoRe: Locked time")
//       // })

//       // it("Should claim after 10 days since WR", async function () {
//       //   //check the uno and risk pool LP token balance of the singer 0 before withdraw
//       //   let userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   const stakedAmountBefore = userInfo.amount
//       //   expect(stakedAmountBefore).to.equal(getBigNumber(1000))
//       //   // signer 0 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(1000))
//       //   const currentDate = new Date()
//       //   const afterTenDays = new Date(currentDate.setDate(currentDate.getDate() + 12))
//       //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
//       //   network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
//       //   await network.provider.send("evm_mine")
//       //   // signer 0 can claim after 10 days since WR
//       //   await this.syntheticSSRP.leaveFromPending()
//       //   // check the uno and risk pool LP token balance of the singer 0 after withdraw
//       //   userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   const stakedAmountAfter = userInfo.amount
//       //   expect(stakedAmountAfter).to.equal(getBigNumber(0))
//       // })

//       // it("Should claim after 10 days since last WR in the case of repetitive WR", async function () {
//       //   //check the LP token balance of the singer 0 before withdraw
//       //   let userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   const stakedAmountBefore = userInfo.amount
//       //   expect(stakedAmountBefore).to.equal(getBigNumber(1000))

//       //   // signer 0 submit WR for the 1000 UNO
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(500))
//       //   const currentDate = new Date()
//       //   const afterFiveDays = new Date(currentDate.setDate(currentDate.getDate() + 5))
//       //   const afterFiveDaysTimeStampUTC = new Date(afterFiveDays.toUTCString()).getTime() / 1000
//       //   network.provider.send("evm_setNextBlockTimestamp", [afterFiveDaysTimeStampUTC])
//       //   await network.provider.send("evm_mine")

//       //   // after 10000 blocks
//       //   const currentBlock = await ethers.provider.getBlockNumber()
//       //   await advanceBlockTo(currentBlock + 10000)
//       //   const pendingUnoReward2 = await this.syntheticSSRP.pendingUno(this.signers[0].address)

//       //   // signer 0 submit WR for the 1000 UNO again
//       //   await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(500))
//       //   const afterTenDays = new Date(afterFiveDays.setDate(currentDate.getDate() + 11))
//       //   const afterTenDaysTimeStampUTC = new Date(afterTenDays.toUTCString()).getTime() / 1000
//       //   network.provider.send("evm_setNextBlockTimestamp", [afterTenDaysTimeStampUTC])
//       //   await network.provider.send("evm_mine")

//       //   // signer 0 can claim after 10 days since the last WR
//       //   await this.syntheticSSRP.leaveFromPending()

//       //   // check LP token balance of the singer 0 after withdraw
//       //   userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//       //   const stakedAmountAfter = userInfo.amount
//       //   expect(stakedAmountAfter).to.equal(getBigNumber(0))
//       // })

//       it("Should harvest", async function () {
//         // signer's uno balance before harvest
//         const ethBalanceBefore = await ethers.provider.getBalance(this.signers[0].address)
//         await this.syntheticSSRP.harvest(this.signers[0].address)
//         // signer's uno balance after harvest
//         const ethBalanceAfter = await ethers.provider.getBalance(this.signers[0].address)
//         expect(ethBalanceAfter.sub(ethBalanceBefore)).to.gt(0)
//       })

//       it("Should cancel withdraw request", async function () {
//         // signer 0 submit WR for the 1000 UNO
//         await this.syntheticSSRP.leaveFromPoolInPending(getBigNumber(500))
//         let userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//         const withdrawRequestBefore = userInfo.pendingWithdrawAmount;
//         expect(withdrawRequestBefore).to.equal(getBigNumber(500))
//         await this.syntheticSSRP.cancelWithdrawRequest()
//         userInfo = await this.syntheticSSRP.userInfo(this.signers[0].address)
//         const withdrawRequestAfter = userInfo.pendingWithdrawAmount;
//         expect(withdrawRequestAfter).to.equal(getBigNumber(0))
//       })
//     })
//   })
// })
