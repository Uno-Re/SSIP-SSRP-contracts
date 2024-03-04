// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");
require("dotenv").config()

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  const capitalAgent = await hre.deployments.get("CapitalAgent")
  const escalationManager = await hre.deployments.get("EscalationManager")
  const governance = process.env.GOVERNANCE;
  const multiSigWallet = process.env.MULTISIGWALLET;
  const guardianCouncil = process.env.GAURDIAN_COUNCIL;
  const defaultCurrency = process.env.DEAFAULT_CURRENCY;
  const optimisticOracleV3 = process.env.OPTIMISTIC_ORACLE_V3;
  const claimsDao = process.env.CLAIMS_DAO;

  const ssip = await deploy("SingleSidedInsurancePoolUNO", {
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

  console.log(`ssip uno deployed at ${ssip.address}`);

  
  const payoutRequest = await deploy("PayoutRequestUNO", {
    from: deployer,
    contract: "PayoutRequest",
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [ssip.address, optimisticOracleV3, defaultCurrency, escalationManager.address, guardianCouncil, claimsDao],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  console.log(`payoutRequest deployed at ${payoutRequest.address}`);

};

module.exports.tags = ["SingleSidedInsurancePoolUNO", "PayoutRequestUNO", "UnoRe"]
