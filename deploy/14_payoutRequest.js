// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
require("dotenv").config()

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  const ssip = await hre.deployments.get("SingleSidedInsurancePoolUSDT")
  // const claimProcessor = await hre.deployments.get("ClaimProce/ssor")
  const escalationManager = await hre.deployments.get("EscalationManager")
  const guardianCouncil = process.env.GUARDIAN_COUNCIL;
  const defaultCurrency = process.env.DEFAULT_CURRENCY;
  const optimisticOracleV3 = process.env.OPTIMISTIC_ORACLE_V3;
  const claimsDao = process.env.CLAIMS_DAO;
  
  console.log("Before deploying proxy");
const a = await deploy("PayoutRequestUSDT", {
  from: deployer,
  contract: "PayoutRequest",
  log: true,
  deterministicDeployment: false,
  gasLimit: 6000000,
  proxy: {
    execute: {
      init: {
        methodName: "initialize",
        args: [ssip.address, optimisticOracleV3, defaultCurrency, 
          escalationManager.address, guardianCouncil, claimsDao],
      },
    },
    proxyContract: "OpenZeppelinTransparentProxy",
  },
});
console.log("After deploying proxy");


  console.log(`payoutRequest deployed at ${a.address}`);
};

module.exports.tags = ["PayoutRequestUSDT", "UnoRe"]
