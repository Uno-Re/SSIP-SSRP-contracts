// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  const exchangeAgent = await deployments.get("ExchangeAgent")
  const multiSigWallet = await deployments.get("MultiSigWallet")

  const premiumPool = await deploy("PremiumPool", {
    from: deployer,
    args: [exchangeAgent.address, mockUNO, mockUSDT, multiSigWallet.address],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${premiumPool.address}`)
}

module.exports.tags = ["PremiumPool"]
