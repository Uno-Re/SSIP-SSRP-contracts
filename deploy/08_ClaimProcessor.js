// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const governance = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"

  const claimProcessor = await deploy("ClaimProcessor", {
    from: deployer,
    args: [governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${claimProcessor.address}`)
}

module.exports.tags = ["ClaimProcessor"]
