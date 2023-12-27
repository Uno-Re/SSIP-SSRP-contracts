// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const owner = deployer

  // const USDC = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557"
  const mockUSDT = await hre.deployments.get("MockUSDT")

  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  // const premiumPool = "0xdB4B701f1a4653BFD5F0f4EFF1913aEAF5E21E68"
  const premiumPool = await hre.deployments.get("PremiumPool")
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const capitalAgent = await hre.deployments.get("CapitalAgent")

  await deploy("SalesPolicyFactory", {
    from: deployer,
    args: [mockUSDT.address, exchangeAgent.address, premiumPool.address, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SalesPolicyFactory"]
