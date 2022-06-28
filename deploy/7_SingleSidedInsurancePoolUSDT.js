// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const exchangeAgent = await deployments.get("ExchangeAgent")
  // const capitalAgent = await deployments.get("CapitalAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  const exchangeAgent = "0x0b0D83702acbD625aDD45c79c7307C08eecEff4B"
  const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const claimAssessor = "0x6c78D94AB7a94A982B773aE453a6E000Da663b62"

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [claimAssessor, exchangeAgent, capitalAgent, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePoolUSDT", "UnoRe"]
