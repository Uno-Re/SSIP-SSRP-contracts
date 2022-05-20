// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const exchangeAgent = await deployments.get("ExchangeAgent")
  const mockUNO = "0x3853D735ABEb59E1289EEb1F9E9c49B189103E3F"
  const mockUSDT = "0x336f7224CDcfc041Ca34B3400d49c2083B36835c"
  const multiSigWallet = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"
  // const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"
  // const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
  // const exchangeAgent = "0x6aC1081CBb92524170E61CFFD37bDaF3b38FBC4c"
  // const multiSigWallet = "0x8c3d5c9538256DAB8Eb4B197370574340fe3254F"
  const operator = "0x6C641CE6A7216F12d28692f9d8b2BDcdE812eD2b"

  const capitalAgent = await deploy("CapitalAgent", {
    from: deployer,
    args: [exchangeAgent.address, mockUNO, mockUSDT, multiSigWallet, operator],
    log: true,
    deterministicDeployment: false,
  })

  console.log(`deploy at ${capitalAgent.address}`)
}

module.exports.tags = ["CapitalAgent"]
