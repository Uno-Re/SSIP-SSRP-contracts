// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  const capitalAgent = await hre.deployments.get("CapitalAgent")
  const multiSigWallet = "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
  const claimProcessor = await hre.deployments.get("ClaimProcessor")
  const escalationManager = await hre.deployments.get("EscalationManager")
  const defaultCurrency = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F"
  const optimisticOracleV3 = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB"
  const governance = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  const guardianCouncil = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  
  const ssip = await deploy("SingleSidedInsurancePool", {
    from: deployer,
    contract: "SingleSidedInsurancePool",
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [capitalAgent.address, multiSigWallet, governance, claimProcessor.address, escalationManager, defaultCurrency, optimisticOracleV3],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  console.log(`ssip usdc deploted at ${ssip.address}`);

  
  const payoutRequest = await deploy("PayoutRequest", {
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

  console.log(`payoutRequest deployed at ${payoutRequest.address}`);
};

module.exports.tags = ["SingleSidedInsurancePoolETH", "PayoutRequestETH", "UnoRe"]
