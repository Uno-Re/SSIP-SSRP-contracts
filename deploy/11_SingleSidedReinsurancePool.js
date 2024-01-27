// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
require("dotenv").config()

module.exports = async function ({getNamedAccounts, deployments}) {
    const { deploy } = deployments;
    const { deployer, proxyAdminOwner } = await getNamedAccounts();
    const owner = deployer
  
    const multiSigWallet = process.env.MULTISIGWALLET;
    const claimAccessor = process.env.CLAIM_ACCESSOR;
    
   const a =  await deploy("SingleSidedReinsurancePool", {
      from: deployer,
      contract: "SingleSidedReinsurancePool",
      log: true,
      deterministicDeployment: false,
      proxy: {
        execute: {
          init: {
            methodName: "initialize",
            args: [multiSigWallet, claimAccessor],
          },
        },
        proxyContract: "OpenZeppelinTransparentProxy",
      },
    });

    console.log(`deploy at ${a.address}`)
  };
  
  module.exports.tags = ["SingleSidedReinsurancePool"]
  