// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

const hre = require("hardhat")
require("dotenv").config()

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const mockUSDT = await hre.deployments.get("MockUSDT")
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  const multiSigWallet = process.env.MULTISIGWALLET;
  const operator = process.env.OPERATOR;

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [exchangeAgent.address, mockUSDT.address, multiSigWallet, operator],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
