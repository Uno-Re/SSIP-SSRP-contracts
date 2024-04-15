// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
require("dotenv").config()

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const owner = deployer

  const mockUSDT = process.env.USDC; 
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const premiumPool = await hre.deployments.get("PremiumPool")
  const capitalAgent = await hre.deployments.get("CapitalAgent")
  const multiSigWallet = process.env.MULTISIGWALLET;

  await deploy("SalesPolicyFactory", {
    from: deployer,
    args: [mockUSDT, exchangeAgent.address, premiumPool.address, capitalAgent.address, multiSigWallet],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SalesPolicyFactory"]
