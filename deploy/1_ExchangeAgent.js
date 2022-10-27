// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const mockUSDC = "0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5"
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  const WETH = ethers.constants.AddressZero
  const UNISWAPV2_ROUTER = ethers.constants.AddressZero
  const PRICE_FEED = ethers.constants.AddressZero
  // const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  // const UNISWAPV2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  // const PRICE_FEED = "0x8e9581a717FDB3eaCc7a3420fFf22b530B61be0e"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [mockUSDC, WETH, PRICE_FEED, UNISWAPV2_ROUTER, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
