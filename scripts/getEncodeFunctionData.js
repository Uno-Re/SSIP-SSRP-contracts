const fs = require("fs")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")
const { getBigNumber } = require("./shared/utilities")
const {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
} = require("../scripts/shared/constants")


const capitalAgentDeployment = require("../deployments/rinkeby/CapitalAgent.json")
const excahngeAgentDeployment = require("../deployments/rinkeby/ExchangeAgent.json")
const multiSigWalletDeployment = require("../deployments/rinkeby/MultiSigWallet.json")
const premiumPoolDeployment = require("../deployments/rinkeby/PremiumPool.json")
const salesPolicyFactoryDeployment = require("../deployments/rinkeby/SalesPolicyFactory.json")

async function main() {
  this.signers = await ethers.getSigners()

  this.ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  this.MultiSigWallet = await ethers.getContractFactory("MultiSigWallet")
  this.CapitalAgent = await ethers.getContractFactory("CapitalAgent")
  this.PremiumPool = await ethers.getContractFactory("PremiumPool")
  this.SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
  this.SalesPolicy = await ethers.getContractFactory("SalesPolicy")

  this.multiSigWallet = await this.MultiSigWallet.attach(multiSigWalletDeployment.address);
  this.capitalAgent = await this.CapitalAgent.attach(capitalAgentDeployment.address);
  this.exchangeAgent = await this.ExchangeAgent.attach(excahngeAgentDeployment.address);
  this.premiumPool = await this.PremiumPool.attach(premiumPoolDeployment.address);
  this.salesPolicyFactory = await this.SalesPolicyFactory.attach(salesPolicyFactoryDeployment.address);

  // this.salesPolicy = await this.SalesPolicy.attach()

  let encodedCallData
  this.txIdx = 0

  encodedCallData = this.capitalAgent.interface.encodeFunctionData("addPoolWhiteList", [this.singleSidedInsurancePool.address])
  console.log('[addPoolWhiteList]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.executeTransaction(this.txIdx)).to.be.revertedWith("cannot execute tx")

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false)).to.be.revertedWith("tx already confirmed")

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.capitalAgent.interface.encodeFunctionData("setSalesPolicyFactory", [this.salesPolicyFactory.address])
  console.log('[setSalesPolicyFactory]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMLR", [getBigNumber(3)])
  console.log('[setMLR]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.capitalAgent.interface.encodeFunctionData("setMCR", [getBigNumber(1, 16)])
  console.log('[setMCR]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.capitalAgent.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.capitalAgent.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  encodedCallData = this.premiumPool.interface.encodeFunctionData("addCurrency", [USDT.rinkeby])
  console.log('[addCurrency]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  for (let idx = 1; idx < 3; idx++) {
    encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData('addProtocol', [
      this.signers[idx + 1].address
    ]);
    console.log('[addProtocol]' + idx, encodedCallData)

    await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
      .to.emit(this.multiSigWallet, 'SubmitTransaction')
      .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData);

    await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
      .to.emit(this.multiSigWallet, 'ConfirmTransaction')
      .withArgs(this.signers[0].address, this.txIdx);

    await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
      .to.emit(this.multiSigWallet, 'ConfirmTransaction')
      .withArgs(this.signers[1].address, this.txIdx);

    this.txIdx++
    // await this.salesPolicyFactory.addProtocol(this.signers[idx + 1].address)
  }

  encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("newSalesPolicy", [
    this.exchangeAgent.address,
    this.premiumPool.address,
    this.capitalAgent.address,
  ])
    console.log('[newSalesPolicy]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  this.salesPolicyAddress = await this.salesPolicyFactory.salesPolicy()
  console.log(this.salesPolicyAddress)
  this.salesPolicy = await this.SalesPolicy.attach(this.salesPolicyAddress)

  encodedCallData = this.premiumPool.interface.encodeFunctionData("addWhiteList", [this.salesPolicy.address])
  console.log('[addWhiteList]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.premiumPool.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.premiumPool.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++


  encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("approvePremiumInPolicy", [
    USDT.rinkeby,
  ])
    console.log('[approvePremiumInPolicy]', encodedCallData)

  await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
    .to.emit(this.multiSigWallet, "SubmitTransaction")
    .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

  await expect(this.multiSigWallet.confirmTransaction(this.txIdx, false))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[0].address, this.txIdx)

  await expect(this.multiSigWallet.connect(this.signers[1]).confirmTransaction(this.txIdx, true))
    .to.emit(this.multiSigWallet, "ConfirmTransaction")
    .withArgs(this.signers[1].address, this.txIdx)

  this.txIdx++

  console.log('[setSignerInPolicy]', this.signers[3].address)

    encodedCallData = this.salesPolicyFactory.interface.encodeFunctionData("setSignerInPolicy", ['0xBeF2C0415CC95b57a6e96cEE05804c8259601a2f'])

    await expect(this.multiSigWallet.submitTransaction(this.salesPolicyFactory.address, 0, encodedCallData))
      .to.emit(this.multiSigWallet, "SubmitTransaction")
      .withArgs(this.signers[0].address, this.txIdx, this.salesPolicyFactory.address, 0, encodedCallData)

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
