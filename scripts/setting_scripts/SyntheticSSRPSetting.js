const fs = require("fs")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")
const { getBigNumber } = require("../shared/utilities")
const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
} = require("../shared/constants")

const capitalAgentDeployment = require("../../deployments/rinkeby/CapitalAgent.json")
const excahngeAgentDeployment = require("../../deployments/rinkeby/ExchangeAgent.json")
const multiSigWalletDeployment = require("../../deployments/rinkeby/MultiSigWallet.json")
const premiumPoolDeployment = require("../../deployments/rinkeby/PremiumPool.json")
const salesPolicyFactoryDeployment = require("../../deployments/rinkeby/SalesPolicyFactory.json")
const singleSidedReinsurancePoolDeployment = require("../../deployments/rinkeby/SingleSidedReinsurancePool.json")
const syntheticSSRPFactoryDeployment = require("../../deployments/rinkeby/SyntheticSSRPFactory.json")
const RewarderFactoryDeployment = require("../../deployments/rinkeby/RewarderFactory.json")
const SSSRPAddress = "0x472E56df028928cB28042229D329FF399dAF5d10"

async function main() {
  this.signers = await ethers.getSigners()

  this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
  this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
  this.PremiumPool = await ethers.getContractFactory("PremiumPool")
  this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
  this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
  this.SingleSidedReinsurancePool = await ethers.getContractFactory("SingleSidedReinsurancePool")
  this.SyntheticSSRPFactory = await ethers.getContractFactory("SyntheticSSRPFactory")
  this.SyntheticSSRP = await ethers.getContractFactory("SyntheticSSRP")

  this.multiSigWallet = await this.MultiSigWallet.attach(multiSigWalletDeployment.address)
  this.capitalAgent = await this.CapitalAgent.attach(capitalAgentDeployment.address)
  this.exchangeAgent = await this.ExchangeAgent.attach(excahngeAgentDeployment.address)
  this.premiumPool = await this.PremiumPool.attach(premiumPoolDeployment.address)
  this.salesPolicyFactory = await this.SalesPolicyFactory.attach(salesPolicyFactoryDeployment.address)
  // this.singleSidedReinsurancePool = await this.SingleSidedInsurancePool.attach(singleSidedReinsurancePoolDeployment.address)
  this.syntheticSSRPFactory = await this.SyntheticSSRPFactory.attach(syntheticSSRPFactoryDeployment.address)
  this.syntheticSSRP = await this.SyntheticSSRP.attach(SSSRPAddress)
  // this.salesPolicy = await this.SalesPolicy.attach()

  let encodedCallData
  this.txIdx = await this.multiSigWallet.getTransactionCount()

  // encodedCallData = this.syntheticSSRP.interface.encodeFunctionData("createRewarder", [
  //   "0x5569BDF4e02cec3fE459796e3d0e741616029fA4",
  //   RewarderFactoryDeployment.address,
  //   "0x40c035016AD732b6cFce34c3F881040B6C6cf71E",
  // ])
  // console.log("[createRewarder]", encodedCallData)

  // await expect(this.multiSigWallet.submitTransaction(this.syntheticSSRP.address, 0, encodedCallData))
  //   .to.emit(this.multiSigWallet, "SubmitTransaction")
  //   .withArgs(this.signers[0].address, this.txIdx, this.syntheticSSRP.address, 0, encodedCallData)

  // await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
  //   .to.emit(this.multiSigWallet, "ConfirmTransaction")
  //   .withArgs(this.signers[0].address, this.txIdx)

  // await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
  //   .to.emit(this.multiSigWallet, "ConfirmTransaction")
  //   .withArgs(this.signers[1].address, this.txIdx)

  // this.txIdx++

  encodedCallData = this.syntheticSSRP.interface.encodeFunctionData("setRewardPerBlock", [getBigNumber(477, 1)])
  console.log("[setRewardPerBlock]", encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.syntheticSSRP.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.syntheticSSRP.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
