// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  const WETH = "0xc778417e063141139fce010982780140aa0cd5ab"
  const UNISWAPV2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  const UNISWAPV2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  const PRICE_FEED = "0xCd12e87cF4E8efF1e7b42eABD4a79e1437D38Ce8"
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [mockUSDT, WETH, PRICE_FEED, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
