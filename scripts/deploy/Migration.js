// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const migration = await deploy("MigrationMock", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${migration.address}`)
}

module.exports.tags = ["Migration"]
