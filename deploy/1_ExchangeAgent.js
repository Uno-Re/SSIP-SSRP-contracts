// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const multiSigWallet = await deployments.get("MultiSigWallet")

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  const UNISWAPV2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  const UNISWAPV2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  const TWAP_PRICE_FEED_FACTORY = "0xd4354a2e9A5B29C0DB8c22F500D8BbAcAa257dEb"
  const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [USDC, WETH, TWAP_PRICE_FEED_FACTORY, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
