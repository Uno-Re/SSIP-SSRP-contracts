// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
require("dotenv").config()

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer

  const capitalAgent = await hre.deployments.get("CapitalAgent")
  const multiSigWallet = process.env.MULTISIGWALLET;
  const governance = process.env.GOVERNANCE;
  
  const a = await deploy("SingleSidedInsurancePoolUSDT", {
    from: deployer,
    contract: "SingleSidedInsurancePool",
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [capitalAgent.address, multiSigWallet],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  console.log(`ssip usdt deployed at ${a.address}`);
};

module.exports.tags = ["SingleSidedInsurancePoolUSDT", "UnoRe"]
