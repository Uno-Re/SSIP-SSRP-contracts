// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const capitalAgent = await deployments.get("CapitalAgent")
  const multiSigWallet = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const claimAssessor = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [claimAssessor, exchangeAgent.address, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePool", "UnoRe"]
