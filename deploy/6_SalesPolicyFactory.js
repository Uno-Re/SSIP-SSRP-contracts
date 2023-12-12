// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const owner = deployer

  // const mockUNO = "0x53fb43BaE4C13d6AFAD37fB37c3fC49f3Af433F5"
  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const exchangeAgent = await deployments.get("ExchangeAgent")
  // const premiumPool = await deployments.get("PremiumPool")
  // const capitalAgent = await deployments.get("CapitalAgent")
  // const multiSigWallet = await deployments.get("MultiSigWallet")

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  // const premiumPool = "0xdB4B701f1a4653BFD5F0f4EFF1913aEAF5E21E68"
  const premiumPool = await hre.deployments.get("PremiumPool")
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const capitalAgent = await hre.deployments.get("CapitalAgent")

  await deploy("SalesPolicyFactory", {
    from: deployer,
    args: [USDC, exchangeAgent, premiumPool, capitalAgent, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SalesPolicyFactory"]
