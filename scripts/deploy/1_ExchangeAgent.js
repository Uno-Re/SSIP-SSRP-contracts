// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  const WETH = "0xc778417e063141139fce010982780140aa0cd5ab"
  const UNISWAPV2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  const UNISWAPV2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  const TWAP_PRICE_FEED_FACTORY = "0x6fa8a7E5c13E4094fD4Fa288ba59544791E4c9d3"
  const multiSigWallet = await deployments.get("MultiSigWallet")

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [mockUSDT, WETH, TWAP_PRICE_FEED_FACTORY, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet.address],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
