// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const owner = deployer

  // const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  // const mockUSDT = "0x336f7224CDcfc041Ca34B3400d49c2083B36835c"
  const mockUSDC = await deployments.get("MockUSDC")
  const exchangeAgent = await deployments.get("ExchangeAgent")
  const premiumPool = await deployments.get("PremiumPool")
  const capitalAgent = await deployments.get("CapitalAgent")
  const multiSigWallet = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"

  // const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  // const premiumPool = "0xdB4B701f1a4653BFD5F0f4EFF1913aEAF5E21E68"
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"

  await deploy("SalesPolicyFactory", {
    from: deployer,
    args: [mockUSDC.address, exchangeAgent.address, premiumPool.address, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SalesPolicyFactory"]
