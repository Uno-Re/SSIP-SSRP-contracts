// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const exchangeAgent = await deployments.get("ExchangeAgent")
  // const capitalAgent = await deployments.get("CapitalAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  const multiSigWallet = process.env.NEW_FROM_ADDRESS
  const claimAssessor = process.env.NEW_FROM_ADDRESS

  await deploy("SingleSidedReinsurancePool", {
    from: deployer,
    args: [claimAssessor, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SSRP", "UnoRe"]
