// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat")
module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  // const exchangeAgent = await deployments.get("ExchangeAgent")
  const mockUNO = await hre.deployments.get("MockUNO")
  const mockUSDT = await hre.deployments.get("MockUSDT")
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  // const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"
  // const UNO = await hre.deployments.get("MockUNO")
  // const USDC = "0x2f3A40A3db8a7e3D09B0adfEfbCe4f6F81927557"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const operator = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [exchangeAgent.address, mockUNO.address, mockUSDT.address, multiSigWallet, operator],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
