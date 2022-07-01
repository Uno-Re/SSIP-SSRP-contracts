const { ethers } = require("hardhat")
const { getBigNumber } = require("../shared/utilities")
const priceOracle = "0x33C5F22E6db919CCFFe1dDf0999cB5C4C9ae7B79"
const exchangeAgentDeployment = require("../../deployments/kava_alpha/ExchangeAgent.json")
const premiumPoolDeployment = require("../../deployments/kava_alpha/PremiumPool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdcDeployment = require("../../deployments/kava_alpha/MockUSDC.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  const exchangeAgent = await ExchangeAgent.attach(exchangeAgentDeployment.address)

  const PremiumPool = await ethers.getContractFactory("PremiumPool")
  const premiumPool = await PremiumPool.attach(premiumPoolDeployment.address)
  // await (await premiumPool.connect(signers[0]).addCurrency(usdcDeployment.address)).wait()

  await(await exchangeAgent.connect(signers[0]).addWhiteList(premiumPoolDeployment.address)).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
