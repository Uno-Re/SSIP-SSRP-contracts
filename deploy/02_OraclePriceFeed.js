// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // const mockUNO = await hre.deployments.get("MockUNO")
  // const mockUSDT = await hre.deployments.get("MockUSDT")

  // const oraclePriceFeed = await deploy("MockOraclePriceFeed", {
  //   from: deployer,
  //   args: [mockUNO.address, mockUSDT.address],
  //   log: true,
  //   deterministicDeployment: false,
  // })

  // console.log(`oracle price feed deploy at ${oraclePriceFeed.address}`)
}

module.exports.tags = ["MockOraclePriceFeed"]
