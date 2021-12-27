// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer
  const claimAssessor = deployer

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  const LPToken = "0xa2D8c3D2c839A4901Bc78F88398Dd92948e75075"

  await deploy("SyntheticSSRP", {
    from: deployer,
    args: [owner, exchangeAgent.address, LPToken, mockUNO],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SyntheticSSRP", "UnoRe"]
