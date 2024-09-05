module.exports = async function ({ getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  await deploy("MockUSDT", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.skip = ({ getChainId }) =>
  new Promise(async (resolve, reject) => {
    try {
      const chainId = await getChainId()
      resolve(chainId === "57000" || chainId === "56")
    } catch (error) {
      reject(error)
    }
  })

module.exports.tags = ["MockUSDT", "UnoRe"]
