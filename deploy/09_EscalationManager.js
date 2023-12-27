// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    const optimisticOracleV3 = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB"
    const governance = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  
    const escalationManager = await deploy("EscalationManager", {
      from: deployer,
      args: [optimisticOracleV3, governance],
      log: true,
      deterministicDeployment: false,
    })
  
    console.log(`deploy at ${escalationManager.address}`)
  }
  
  module.exports.tags = ["EscalationManager"]
  