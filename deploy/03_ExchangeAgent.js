// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
const { getBigNumber } = require("../scripts/shared/utilities");

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const USDC = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557"
  const mockUSDT = await hre.deployments.get("MockUSDT")
  const PRICE_FEED = await hre.deployments.get("MockOraclePriceFeed")
  const WETH = "0x2A416168ceA12820E288d36f77C1b7f936F4e228"
  const UNISWAPV2_FACTORY = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const UNISWAPV2_ROUTER = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"

  const exchangeAgent = await deploy("ExchangeAgent", {
    from: deployer,
    args: [mockUSDT.address, WETH, PRICE_FEED.address, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet, getBigNumber(60)],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${exchangeAgent.address}`)
}

module.exports.tags = ["ExchangeAgent", "MockUSDT", "OraclePriceFeed"]
