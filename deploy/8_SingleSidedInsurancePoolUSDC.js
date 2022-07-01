// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const capitalAgent = await deployments.get("CapitalAgent")
  const multiSigWallet = "0x6E1ae7E0A77e51A9B0a1F58D57a023493FBfbe0c"
  const claimAssessor = "0x6E1ae7E0A77e51A9B0a1F58D57a023493FBfbe0c"

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [claimAssessor, exchangeAgent, capitalAgent, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePoolUSDC", "UnoRe"]
