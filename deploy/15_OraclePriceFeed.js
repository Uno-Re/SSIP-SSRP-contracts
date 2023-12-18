// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()


  const mockUNO = "0x491e7B202Ca6eB8beFb5eC4C6a3D68ce2159dcF2";
  const mockUSDT = "0xb1Ce55d27FaF8D4499b840A3EDf509E4df43f9E1";

  const oraclePriceFeed = await deploy("MockOraclePriceFeed", {
    from: deployer,
    args: [mockUNO, mockUSDT],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`oracle price feed deploy at ${oraclePriceFeed.address}`)
}

module.exports.tags = ["MockOraclePriceFeed"]
