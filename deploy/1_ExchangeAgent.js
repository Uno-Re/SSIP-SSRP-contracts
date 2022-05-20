// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const multiSigWallet = await deployments.get("MultiSigWallet")

  const USDC = "0x336f7224CDcfc041Ca34B3400d49c2083B36835c"
  const WETH = "0xED1432BfE5235019c6724c23628467D92F26cabb"
  const UNISWAPV2_FACTORY = "0x1e7fa99d0DD1D2896564B44A26EbA952DB167159"
  const UNISWAPV2_ROUTER = "0x161EAD7347193e7eA44ea997efD92777E35C9320"
  const PRICE_FEED = "0x19b6B39aa065eD73FfC20627801fC028fa03B2B0"
  const multiSigWallet = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [USDC, WETH, PRICE_FEED, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
