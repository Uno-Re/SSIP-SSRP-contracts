// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  const mockUSDT = await deploy("MockUSDT", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: false,
  })

  // const USDC = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557"
  const WETH = "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6"
  const UNISWAPV2_FACTORY = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"
  const UNISWAPV2_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  const PRICE_FEED = "0x8E8074be1A0627574659E746B4Af1E5078F4B72c"
  const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"

  const exchangeAgent = await deploy("ExchangeAgent", {
    from: deployer,
    args: [`${mockUSDT.address}`, WETH, PRICE_FEED, UNISWAPV2_ROUTER, UNISWAPV2_FACTORY, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${exchangeAgent.address}`)
  console.log(`mock usd deploy at ${mockUSDT.address}`)
  console.log(`oracleprice feed deploy at ${PRICE_FEED}`)
}

module.exports.tags = ["ExchangeAgent", "MockUSDT", "OraclePriceFeed"]
