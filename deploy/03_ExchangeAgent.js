// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
require("dotenv").config()

const { getBigNumber } = require("../scripts/shared/utilities");

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  const mockUSDT = await hre.deployments.get("MockUSDT")
  const PRICE_FEED = await hre.deployments.get("MockOraclePriceFeed")
  const WETH = process.env.WETH;
  const UNISWAPV2_FACTORY = process.env.UNISWAPV2_FACTORY;
  const UNISWAPV2_ROUTER = process.env.UNISWAPV2_ROUTER;
  const MULTISIGWALLET = process.env.MULTISIGWALLET;

  const exchangeAgent = await deploy("ExchangeAgent", {
    from: deployer,
    args: [mockUSDT.address, WETH, PRICE_FEED.address, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, MULTISIGWALLET, getBigNumber("60")],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${exchangeAgent.address}`)
}

module.exports.tags = ["ExchangeAgent", "MockUSDT", "OraclePriceFeed"]
