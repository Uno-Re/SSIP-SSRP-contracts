const { ethers } = require("hardhat")
const { getBigNumber } = require("../shared/utilities")
const riskFactoryDeployment = require("../../deployments/kava_alpha/RiskPoolFactory.json")
const rewarderFactoryDeployment = require("../../deployments/kava_alpha/RewarderFactory.json")
const ssipDeployment = require("../../deployments/kava_alpha/SingleSidedInsurancePool.json")
const unoDeployment = require("../../deployments/kava_alpha/MockUNO.json")

async function main() {
  const signers = await ethers.getSigners()
  console.log("signer", signers[0].address)

  const MockUNO = await ethers.getContractFactory("MockUNO")
  const mockUNO = await MockUNO.attach(unoDeployment.address)

  const SSIPUNO = await ethers.getContractFactory("SingleSidedInsurancePool")
  const ssipUNO = await SSIPUNO.attach(ssipDeployment.address)

  await (
    await ssipUNO.connect(signers[0]).createRiskPool(
      "Synthetic SSIP-UNO",
      "SSSIP-UNO",
      riskFactoryDeployment.address,
      mockUNO.address,
      // 57494174023757960,
      getBigNumber("721099507210995063", 0),
      getBigNumber(15000, 6),
    )
  ).wait()

  const poolInfo = await ssipUNO.poolInfo()
  console.log("[pool info]", poolInfo, poolInfo.unoMultiplierPerBlock.toString())

  const riskPoolAddr = await ssipUNO.riskPool()
  console.log("[riskPoolAddr]", riskPoolAddr)

  await (
    await ssipUNO.connect(signers[0]).createRewarder(signers[0].address, rewarderFactoryDeployment.address, unoDeployment.address)
  ).wait()

  const rewarderAddr = await ssipUNO.rewarder()
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
