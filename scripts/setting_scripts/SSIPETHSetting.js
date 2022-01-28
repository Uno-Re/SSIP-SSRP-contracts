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
const singleSidedInsurancePoolDeployment = require("../../deployments/rinkeby/SingleSidedInsurancePool.json")
const syntheticSSIPFactoryDeployment = require("../../deployments/rinkeby/SyntheticSSIPFactory.json")

async function main() {
  this.signers = await ethers.getSigners()

  this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
  this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
  this.PremiumPool = await ethers.getContractFactory("PremiumPool")
  this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
  this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")
  this.SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
  this.SyntheticSSIPFactory = await ethers.getContractFactory("SyntheticSSIPFactory")

  this.multiSigWallet = await this.MultiSigWallet.attach(multiSigWalletDeployment.address)
  this.capitalAgent = await this.CapitalAgent.attach(capitalAgentDeployment.address)
  this.exchangeAgent = await this.ExchangeAgent.attach(excahngeAgentDeployment.address)
  this.premiumPool = await this.PremiumPool.attach(premiumPoolDeployment.address)
  this.salesPolicyFactory = await this.SalesPolicyFactory.attach(salesPolicyFactoryDeployment.address)
  this.singleSidedInsurancePool = await this.SingleSidedInsurancePool.attach(singleSidedInsurancePoolDeployment.address)
  this.syntheticSSIPFactory = await this.SyntheticSSIPFactory.attach(syntheticSSIPFactoryDeployment.address)
  // this.salesPolicy = await this.SalesPolicy.attach()

  let encodedCallData
  this.txIdx = await this.multiSigWallet.getTransactionCount()

  encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("createRiskPool", [
    "Synthetic SSIP-ETH",
    "SSSIP-ETH",
    "0x744DD0c451C97546FB66c33F95ec252B91A08480",
    "0x0000000000000000000000000000000000000000",
    getBigNumber(1),
  ])
  console.log("[createRiskPool]", encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("createRewarder", [
    "0x5569BDF4e02cec3fE459796e3d0e741616029fA4",
    "0x777eada585d00db3a65bec57e6a8c561c6dcb9ae",
    "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5",
  ])

  await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("createSyntheticSSIP", [
    this.multiSigWallet.address,
    this.syntheticSSIPFactory.address,
  ])
  console.log("[createSyntheticSSIP]", encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.singleSidedInsurancePool.interface.encodeFunctionData("setCapitalAgent", [this.capitalAgent.address])
  console.log("[createSyntheticSSIP]", encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.singleSidedInsurancePool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.singleSidedInsurancePool.address, 0, encodedCallData)

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
