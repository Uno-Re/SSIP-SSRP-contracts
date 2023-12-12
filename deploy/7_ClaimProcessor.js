// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const governance = ""

  const claimProcessor = await deploy("ClaimProcessor", {
    from: deployer,
    args: [governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${claimProcessor.address}`)
}

module.exports.tags = ["ClaimProcessor"]
