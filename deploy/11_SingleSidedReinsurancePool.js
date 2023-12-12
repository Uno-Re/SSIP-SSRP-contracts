// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({getNamedAccounts, deployments}) {
    const { deploy } = deployments;
    const { deployer, proxyAdminOwner } = await getNamedAccounts();
    const owner = deployer
  
    const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
    const claimAccessor = "0x6c78D94AB7a94A982B773aE453a6E000Da663b62"
    
    await deploy("SingleSidedReinsurancePool", {
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
      },
    });
  };
  
  module.exports.tags = ["SingleSidedReinsurancePool"]
  