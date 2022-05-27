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
const riskFactoryDeployment = require("../../deployments/kava_alpha/RiskPoolFactory.json")
const rewarderFactoryDeployment = require("../../deployments/kava_alpha/RewarderFactory.json")
const ssipDeployment = require("../../deployments/kava_alpha/SingleSidedInsurancePoolETH.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdtDeployment = require("../../deployments/kava_alpha/MockUSDC.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const MockUNO = await ethers.getContractFactory("MockUNO")
  const mockUNO = await MockUNO.attach(unoDeployment.address)

  const SSIPETH = await ethers.getContractFactory("SingleSidedInsurancePool")
  const ssipETH = await SSIPETH.attach(ssipDeployment.address)

  await (
    await ssipETH.connect(signers[0]).createRiskPool(
      "Synthetic SSIP-ETH",
      "SSSIP-ETH",
      riskFactoryDeployment.address,
      ethers.constants.AddressZero,
      // 57494174023757960,
      getBigNumber("57494174023757960", 0),
      getBigNumber(15000, 6),
    )
  ).wait()

  const riskPoolAddr = await ssipETH.riskPool()
  console.log("[riskPoolAddr]", riskPoolAddr)

  await (
    await ssipETH.connect(signers[0]).createRewarder(signers[0].address, rewarderFactoryDeployment.address, unoDeployment.address)
  ).wait()

  const rewarderAddr = await ssipETH.rewarder()
  console.log("[rewarderAddr]", rewarderAddr)
  await (await mockUNO.transfer(rewarderAddr, getBigNumber(500000))).wait()

  // await (
  //   await ssipETH
  //     .connect(signers[0])
  //     .setLockTime(86400)
  // ).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
