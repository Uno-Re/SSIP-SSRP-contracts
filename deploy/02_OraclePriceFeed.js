// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const admin = process.env.MULTISIGWALLET;

  const oraclePriceFeed = await deploy("PriceOracle", {
    from: deployer,
    args: [admin],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`oracle price feed deploy at ${oraclePriceFeed.address}`)
}

module.exports.tags = ["MockOraclePriceFeed"]
