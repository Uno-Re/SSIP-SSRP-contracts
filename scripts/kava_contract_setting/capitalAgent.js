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
const capitalAgentDeployment = require("../../deployments/kava_alpha/CapitalAgent.json")
const salesPolicyFactoryDeployment = require("../../deployments/kava_alpha/SalesPolicyFactory.json")
const ssipDeployment = require("../../deployments/kava_alpha/SingleSidedInsurancePoolETH.json")
const ssipUNODeployment = require("../../deployments/kava_alpha/SingleSidedInsurancePool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")
const usdtDeployment = require("../../deployments/kava_alpha/MockUSDC.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const CapitalAgent = await ethers.getContractFactory("CapitalAgent")
  const capitalAgent = await CapitalAgent.attach(capitalAgentDeployment.address)
  await(await capitalAgent.connect(signers[0]).setSalesPolicyFactory(salesPolicyFactoryDeployment.address)).wait()
  await (await capitalAgent.connect(signers[0]).addPoolWhiteList(ssipDeployment.address)).wait()
  await (await capitalAgent.connect(signers[0]).addPoolWhiteList(ssipUNODeployment.address)).wait()
  await (await capitalAgent.connect(signers[0]).setMLR(getBigNumber(2))).wait()
  await (await capitalAgent.connect(signers[0]).setMCR(getBigNumber(5, 17))).wait()
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
