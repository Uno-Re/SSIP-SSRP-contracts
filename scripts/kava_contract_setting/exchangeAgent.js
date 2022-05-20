const { ethers } = require("hardhat")
const {
  getBigNumber,
} = require("../shared/utilities")
const priceOracle = "0x33C5F22E6db919CCFFe1dDf0999cB5C4C9ae7B79"
const exchangeAgentDeployment = require("../../deployments/kava_alpha/ExchangeAgent.json")
const premiumPoolDeployment = require("../../deployments/kava_alpha/PremiumPool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdtDeployment = require("../../deployments/kava_alpha/MockUSDT.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  const exchangeAgent = await ExchangeAgent.attach(exchangeAgentDeployment.address)
  // await (await exchangeAgent.connect(signers[0]).setOraclePriceFeed(priceOracle)).wait()

  // await (await exchangeAgent.connect(signers[0]).addWhiteList(premiumPoolDeployment.address)).wait()
  const priceOracleAddr = await exchangeAgent.oraclePriceFeed()
  console.log('[priceOracleAddr]', priceOracleAddr)
  const USDT_value = await exchangeAgent.getNeededTokenAmount(unoDeployment.address, usdtDeployment.address, getBigNumber(5000))
  console.log('[usdt value]', USDT_value.toString())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
