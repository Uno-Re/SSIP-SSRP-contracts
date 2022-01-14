// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer
  const claimAssessor = deployer

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const capitalAgent = await deployments.get("CapitalAgent")

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [owner, claimAssessor, exchangeAgent.address, capitalAgent.address],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePool", "UnoRe"]
