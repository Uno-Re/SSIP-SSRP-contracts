// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");

module.exports = async function ({getNamedAccounts, deployments}) {
  const { deploy } = deployments;
  const { deployer, proxyAdminOwner } = await getNamedAccounts();
  const owner = deployer


  // const exchangeAgent = "0x0b0D83702acbD625aDD45c79c7307C08eecEff4B"
  const exchangeAgent = await hre.deployments.get("ExchangeAgent")
  // const capitalAgent = "0x0bCed28f17a0c8CB66c07dD1a4ccfb2ef3159c05"
  const capitalAgent = await hre.deployments.get("CapitalAgent")
  const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const claimAccessor = "0x6c78D94AB7a94A982B773aE453a6E000D663b62"
  const claimProcessor = await hre.deployments.get("ClaimProcessor")
  const escalationManager = await hre.deployments.get("EscalationManager")
  const defaultCurrency = ""
  const optimisticOracleV3 = ""
  const governance = ""
  
  await deploy("SingleSidedInsurancePool", {
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
    },
  });
};

module.exports.tags = ["SingleSidedInsurancePoolUSDT", "UnoRe"]
