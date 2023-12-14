// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({getNamedAccounts, deployments}) {
    const { deploy } = deployments;
    const { deployer, proxyAdminOwner } = await getNamedAccounts();
    const owner = deployer
  
    const multiSigWallet = "0x4CB61C3B9a46bf96E2e394f2B00a5722836BA6Eb"
    const claimAccessor = "0x4CB61C3B9a46bf96E2e394f2B00a5722836BA6Eb"
    
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
  