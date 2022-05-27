const { ethers, network } = require("hardhat")
const { BigNumber } = ethers
const {
  getBigNumber,
  getNumber,
  getHexStrFromStr,
  getPaddedHexStrFromBN,
  getChainId,
  getSignatureParameters,
  getPaddedHexStrFromBNArray,
} = require("../shared/utilities")
const priceOracle = "0x33C5F22E6db919CCFFe1dDf0999cB5C4C9ae7B79"
const exchangeAgentDeployment = require("../../deployments/kava_alpha/ExchangeAgent.json")
const premiumPoolDeployment = require("../../deployments/kava_alpha/PremiumPool.json")
const capitalAgentDeployment = require("../../deployments/kava_alpha/CapitalAgent.json")
const salesPolicyFactoryDeployment = require("../../deployments/kava_alpha/SalesPolicyFactory.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdcDeployment = require("../../deployments/kava_alpha/MockUSDC.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const SalesPolicyFactory = await ethers.getContractFactory("SalesPolicyFactory")
  const salesPolicyFactory = await SalesPolicyFactory.attach(salesPolicyFactoryDeployment.address)
  await (
    await salesPolicyFactory
      .connect(signers[0])
      .newSalesPolicy(exchangeAgentDeployment.address, premiumPoolDeployment.address, capitalAgentDeployment.address)
  ).wait()

  await (await salesPolicyFactory.connect(signers[0]).setSignerInPolicy(signers[0].address)).wait()
  await (await salesPolicyFactory.connect(signers[0]).approvePremiumInPolicy(usdcDeployment.address)).wait()

  const salesPolicyAddress = await salesPolicyFactory.salesPolicy()
  const SalesPolicy = await ethers.getContractFactory("SalesPolicy")
  const salesPolicy = await SalesPolicy.attach(salesPolicyAddress)
  console.log("[salesPolicy]", salesPolicy.address, salesPolicyAddress)

  const PremiumPool = await ethers.getContractFactory("PremiumPool")
  const premiumPool = await PremiumPool.attach(premiumPoolDeployment.address)
  await (await premiumPool.connect(signers[0]).addWhiteList(salesPolicyAddress)).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
