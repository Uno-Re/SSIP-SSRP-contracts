const { ethers } = require("hardhat")
const { getBigNumber } = require("../shared/utilities")
const priceOracle = "0xD3E572A50c8e201A274BA0007d4fC43c4fAbbc37"
const exchangeAgentDeployment = require("../../deployments/kava_alpha/ExchangeAgent.json")
const premiumPoolDeployment = require("../../deployments/kava_alpha/PremiumPool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdcDeployment = require("../../deployments/kava_alpha/MockUSDC.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  const exchangeAgent = await ExchangeAgent.attach(exchangeAgentDeployment.address)
  // await (await exchangeAgent.connect(signers[0]).setOraclePriceFeed(priceOracle)).wait()

  // await (await exchangeAgent.connect(signers[0]).addWhiteList(premiumPoolDeployment.address)).wait()
  const priceOracleAddr = await exchangeAgent.oraclePriceFeed()
  console.log("[priceOracleAddr]", priceOracleAddr, unoDeployment.address, usdcDeployment.address)
  const USDC_value = await exchangeAgent.getNeededTokenAmount(unoDeployment.address, usdcDeployment.address, getBigNumber(5000))
  console.log("[usdt value]", USDC_value.toString())
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
