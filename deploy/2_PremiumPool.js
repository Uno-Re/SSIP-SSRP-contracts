// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const exchangeAgent = await deployments.get("ExchangeAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")

  const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const governance = ""

  const premiumPool = await deploy("PremiumPool", {
    from: deployer,
    args: [exchangeAgent, UNO, USDC, multiSigWallet, governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${premiumPool.address}`)
}

module.exports.tags = ["PremiumPool"]
