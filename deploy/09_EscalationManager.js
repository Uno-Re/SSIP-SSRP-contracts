// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
require("dotenv").config()

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    const optimisticOracleV3 = process.env.OPTIMISTIC_ORACLE_V3;
    const governance = process.env.GOVERNANCE;
  
    const escalationManager = await deploy("EscalationManager", {
      from: deployer,
      args: [optimisticOracleV3, governance],
      log: true,
      deterministicDeployment: false,
    })
  
    console.log(`deploy at ${escalationManager.address}`)
  }
  
  module.exports.tags = ["EscalationManager"]
  