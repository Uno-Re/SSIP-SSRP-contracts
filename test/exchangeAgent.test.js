// const { expect } = require("chai")
// const { ethers, network } = require("hardhat")
// const { getBigNumber, getNumber } = require("../scripts/shared/utilities")
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

// describe("ExchangeAgent", function () {
//   before(async function () {
//     this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
//     this.signers = await ethers.getSigners()
//     this.zeroAddress = ethers.constants.AddressZero
//     this.routerContract = new ethers.Contract(
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       JSON.stringify(UniswapV2Router.abi),
//       ethers.provider,
//     )
//     this.MockUNO = await ethers.getContractFactory("MockUNO")
//     this.MockUSDT = await ethers.getContractFactory("MockUSDT")
//     this.mockUNO = this.MockUNO.attach(UNO.rinkeby)
//     this.mockUSDT = this.MockUSDT.attach(USDT.rinkeby)
//     await this.mockUNO.connect(this.signers[0]).faucetToken(getBigNumber(500000000), { from: this.signers[0].address })
//     await this.mockUSDT.connect(this.signers[0]).faucetToken(getBigNumber(500000, 6), { from: this.signers[0].address })
//   })

//   beforeEach(async function () {
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
//       TWAP_ORACLE_PRICE_FEED_FACTORY.rinkeby,
//       UNISWAP_ROUTER_ADDRESS.rinkeby,
//       UNISWAP_FACTORY_ADDRESS.rinkeby,
//     )
//   })

//   // describe("exchangeAgent contract initialiation", function () {
//   //   it("should not allow others to set twapPriceFeed contract address", async function () {
//   //     await expect(
//   //       this.exchangeAgent
//   //         .connect(this.signers[1])
//   //         .updateTwapOraclePriceFeed(this.twapOraclePriceFeed.address, { from: this.signers[1].address }),
//   //     ).to.be.revertedWith("UnoRe: exchangeAgent Forbidden")
//   //   })

//   //   it("should not allow others to set slippage", async function () {
//   //     await expect(
//   //       this.exchangeAgent.connect(this.signers[1]).setSlippage(10, { from: this.signers[1].address }),
//   //     ).to.be.revertedWith("UnoRe: exchangeAgent Forbidden")
//   //   })

//   //   it("should add white list", async function () {
//   //     await this.exchangeAgent.addWhiteList(this.signers[5].address)
//   //     const whiteList = await this.exchangeAgent.whiteList(this.signers[5].address)
//   //     expect(whiteList).to.equal(true)
//   //   })
//   // })

//   describe("token exchange test", function () {
//     beforeEach(async function () {
//       await this.exchangeAgent.setSlippage(5)
//       await this.exchangeAgent.addWhiteList(this.signers[1].address)
//     })
//     it("Should not allow others to convert tokens", async function () {
//       await (
//         await this.mockUNO
//           .connect(this.signers[1])
//           .approve(this.exchangeAgent.address, getBigNumber(10000000), { from: this.signers[1].address })
//       ).wait()

//       await expect(
//         this.exchangeAgent
//           .connect(this.signers[2])
//           .tokenConvertForUSDTWithTwapPrice(this.mockUNO.address, getBigNumber(2000), { from: this.signers[2].address }),
//       ).to.be.revertedWith("UnoRe: ExchangeAgent Forbidden")
//     })

//     it("should convert UNO to USDT", async function () {
//       const usdtBalanceBefore = await this.mockUSDT.balanceOf(this.signers[0].address)
//       await (
//         await this.mockUNO
//           .connect(this.signers[0])
//           .approve(this.exchangeAgent.address, getBigNumber(10000000), { from: this.signers[0].address })
//       ).wait()
//       // await this.mockUNO
//       //   .connect(this.signers[0])
//       //   .transfer(this.exchangeAgent.address, getBigNumber(2000), { from: this.signers[0].address })
//       const usdtConvert = await (
//         await this.exchangeAgent.tokenConvertForUSDTWithTwapPrice(this.mockUNO.address, getBigNumber(2000))
//       ).wait()
//       const convertedAmount = usdtConvert.events[usdtConvert.events.length - 1].args._convertedAmount
//       const usdtBalanceAfter = await this.mockUSDT.balanceOf(this.signers[0].address)
//       expect(usdtBalanceAfter).to.equal(usdtBalanceBefore.add(convertedAmount))
//     })
//   })
// })
