// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const mockUSDC = "0x188bf631F2272B61Dd61119fbD264aeC7b6C57D5"
  const multiSigWallet = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  const operator = "0x5569BDF4e02cec3fE459796e3d0e741616029fA4"
  // const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"
  // const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  // const operator = "0x721d214267247568DA3A9123abfAc71fc18a5EE4"

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    args: [exchangeAgent.address, mockUSDC, multiSigWallet, operator],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
