// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat");
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const mockUSDT = await hre.deployments.get("MockUSDT")
  const mockUNO = await hre.deployments.get("MockUNO")
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const governance = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"

  const premiumPool = await deploy("PremiumPool", {
    from: deployer,
    args: [exchangeAgent.address, mockUNO.address, mockUSDT.address, multiSigWallet, governance],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${premiumPool.address}`)
}

module.exports.tags = ["PremiumPool", "MockUNO"]
