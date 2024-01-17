// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
require("dotenv").config()

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  const ssip = await hre.deployments.get("SingleSidedInsurancePoolUSDT")
  const claimProcessor = await hre.deployments.get("ClaimProcessor")
  const escalationManager = await hre.deployments.get("EscalationManager")
  const guardianCouncil = process.env.GAURDIAN_COUNCIL;
  const defaultCurrency = process.env.DEAFAULT_CURRENCY;
  const optimisticOracleV3 = process.env.OPTIMISTIC_ORACLE_V3;
  
  const a = await deploy("PayoutRequestUSDT", {
    from: deployer,
    contract: "PayoutRequest",
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [ssip.address, optimisticOracleV3, defaultCurrency, claimProcessor.address, escalationManager.address, guardianCouncil],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  console.log(`payoutRequest deployed at ${a.address}`);
};

module.exports.tags = ["PayoutRequestUSDT", "UnoRe"]
