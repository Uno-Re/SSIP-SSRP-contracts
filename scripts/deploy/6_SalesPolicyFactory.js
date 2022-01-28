// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const owner = deployer

  const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  const exchangeAgent = await deployments.get("ExchangeAgent")
  const premiumPool = await deployments.get("PremiumPool")
  const capitalAgent = await deployments.get("CapitalAgent")
  const multiSigWallet = await deployments.get("MultiSigWallet")

  await deploy("SalesPolicyFactory", {
    from: deployer,
    args: [mockUSDT, exchangeAgent.address, premiumPool.address, capitalAgent.address, multiSigWallet.address],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SalesPolicyFactory"]
