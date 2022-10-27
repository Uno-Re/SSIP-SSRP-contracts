// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const exchangeAgent = await deployments.get("ExchangeAgent")
  // const capitalAgent = await deployments.get("CapitalAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  const claimAssessor = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [claimAssessor, ethers.constants.AddressZero, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePool", "UnoRe"]
