// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    const optimisticOracleV3 = ""
    const governance = ""
  
    const escalationManager = await deploy("EscalationManager", {
      from: deployer,
      args: [optimisticOracleV3, governance],
      log: true,
      deterministicDeployment: false,
    })
  
    console.log(`deploy at ${escalationManager.address}`)
  }
  
  module.exports.tags = ["EscalationManager"]
  