module.exports = async function ({ getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy("MockUNO", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  })
};

const verify = async (contractAddress) => {
    console.log("Verifying contract...");
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        });
    } catch (e) {
        if (e.message.toLowerCase().includes("already verified")) {
            console.log("Already verified!");
        } else {
            console.log(e);
        }
    }
};

module.exports.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId()
      resolve(chainId === "57000" || chainId === "56")
    } catch (error) {
      reject(error)
    }
  })

module.exports.tags = ["MockUNO", "UnoRe"]
