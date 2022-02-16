// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer
  const claimAssessor = deployer

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const capitalAgent = await deployments.get("CapitalAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"

  await deploy("SingleSidedInsurancePoolUNO", {
    from: deployer,
    args: [claimAssessor, exchangeAgent.address, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePoolUNO", "UnoRe"]
