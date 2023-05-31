const { WETH_ADDRESS, USDC, UNISWAP_ROUTER_ADDRESS, PRICE_ORACLE } = require("../scripts/shared/constants")

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  // const PRICE_FEED = "0x8e9581a717FDB3eaCc7a3420fFf22b530B61be0e"
  const multiSigWallet = process.env.NEW_FROM_ADDRESS

  await deploy("ExchangeAgent", {
    from: deployer,
    args: [USDC.goerli, WETH_ADDRESS.goerli, PRICE_ORACLE.goerli, UNISWAP_ROUTER_ADDRESS.goerli, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["ExchangeAgent", "UnoRe"]
