// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const mockUSDC = "0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5"
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  const operator = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  // const USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
  // const exchangeAgent = "0x87e1f628225c170a5C0Bf895580686430DEb3322"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  // const operator = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    args: [exchangeAgent.address, mockUSDC, multiSigWallet, operator],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
