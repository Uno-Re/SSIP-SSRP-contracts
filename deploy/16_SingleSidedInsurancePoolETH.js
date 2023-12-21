// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  // const capitalAgent = await hre.deployments.get("CapitalAgent")
  const capitalAgent = "0xa50F3fD32d7Ead49a5C34091744bE516b67417cA"
  const multiSigWallet = "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
  const claimAccessor = "0xBC13Ca15b56BEEA075E39F6f6C09CA40c10Ddba6"
  // const claimProcessor = await hre.deployments.get("ClaimProcessor")
  const claimProcessor = "0x3cFea372991c8FfB83127BF5F56C850d363D45ca"
  // const escalationManager = await hre.deployments.get("EscalationManager")
  const escalationManager = "0x503b845364a2c8531bE9bE98B0638d286e05917b"
  const defaultCurrency = "0x07865c6E87B9F70255377e024ace6630C1Eaa37F"
  const optimisticOracleV3 = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB"
  const governance = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
  
  const a = await deploy("SingleSidedInsurancePool", {
    from: deployer,
    contract: "SingleSidedInsurancePool",
    log: true,
    deterministicDeployment: false,
    proxy: {
      execute: {
        init: {
          methodName: "initialize",
          args: [capitalAgent, multiSigWallet, governance, claimProcessor, escalationManager, defaultCurrency, optimisticOracleV3],
        },
      },
      proxyContract: "OpenZeppelinTransparentProxy",
    },
  });

  console.log(`ssip usdc deploted at ${a.address}`);
};

module.exports.tags = ["SingleSidedInsurancePoolETH", "UnoRe"]
