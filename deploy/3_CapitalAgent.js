// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const multiSigWallet = "0x6E1ae7E0A77e51A9B0a1F58D57a023493FBfbe0c"
  const operator = "0x6E1ae7E0A77e51A9B0a1F58D57a023493FBfbe0c"

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    args: [exchangeAgent.address, multiSigWallet, operator],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
