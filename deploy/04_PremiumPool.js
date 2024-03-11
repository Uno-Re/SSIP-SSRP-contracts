// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
require("dotenv").config();

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const mockUSDT = process.env.USDC;
  const mockUNO = process.env.UNO;
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = process.env.MULTISIGWALLET;
  const governance = process.env.GOVERNANCE;

  const premiumPool = await deploy("PremiumPool", {
    from: deployer,
    args: [exchangeAgent.address, mockUNO, mockUSDT, multiSigWallet, governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${premiumPool.address}`)
}

module.exports.tags = ["PremiumPool", "MockUNO"]
