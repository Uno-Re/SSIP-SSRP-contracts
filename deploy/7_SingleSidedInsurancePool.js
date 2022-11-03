// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const claimAssessor = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  const capitalAgent = await deployments.get("CapitalAgent")
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  // const capitalAgent = "0x75298ca41f347Ab468f01BDdDA20057603b3AA4d"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  // const claimAssessor = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"

  await deploy("SingleSidedInsurancePool", {
    from: deployer,
    args: [claimAssessor, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePool", "UnoRe"]
