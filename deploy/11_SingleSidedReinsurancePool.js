// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({getNamedAccounts, deployments}) {
    const { deploy } = deployments;
    const { deployer, proxyAdminOwner } = await getNamedAccounts();
    const owner = deployer
  
    const multiSigWallet = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
    const claimAccessor = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5"
    
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
  