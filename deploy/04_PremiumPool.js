// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
require("dotenv").config();

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const mockUSDT = await hre.deployments.get("MockUSDT")
  const mockUNO = await hre.deployments.get("MockUNO")
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = process.env.MULTISIGWALLET;
  const governance = process.env.GOVERNANCE;

  const premiumPool = await deploy("PremiumPool", {
    from: deployer,
    args: [exchangeAgent.address, mockUNO.address, mockUSDT.address, multiSigWallet, governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${premiumPool.address}`)
}

module.exports.tags = ["PremiumPool", "MockUNO"]
