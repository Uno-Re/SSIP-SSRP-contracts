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
const ssrpDeployment = require("../../deployments/kava_alpha/SingleSidedReinsurancePool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdtDeployment = require("../../deployments/kava_alpha/MockUSDT.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const MockUNO = await ethers.getContractFactory("MockUNO")
  const mockUNO = await MockUNO.attach(unoDeployment.address)

  const SSRP = await ethers.getContractFactory("SingleSidedReinsurancePool")
  const ssrp = await SSRP.attach(ssrpDeployment.address)

  await (
    await ssrp
      .connect(signers[0])
      .createRiskPool(
        "Synthetic SSRP",
        "SSSRP",
        riskFactoryDeployment.address,
        mockUNO.address,
        getBigNumber(105, 16),
      )
  ).wait()

  const riskPoolAddr = await ssrp.riskPool();
  console.log('[riskPoolAddr]', riskPoolAddr)

  await (
    await ssrp
      .connect(signers[0])
      .createRewarder(
        signers[0].address,
        rewarderFactoryDeployment.address,
        unoDeployment.address,
      )
  ).wait()
  
  const rewarderAddr = await ssrp.rewarder();
  console.log('[rewarderAddr]', rewarderAddr)
  await(await mockUNO.transfer(rewarderAddr, getBigNumber(500000))).wait()

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
