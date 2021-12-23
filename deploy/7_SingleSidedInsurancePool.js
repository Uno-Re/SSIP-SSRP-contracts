// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer;
  const claimAssessor = deployer;

  const exchangeAgent = await deployments.get("ExchangeAgent");
  const capitalAgent = await deployments.get("CapitalAgent");
  const mockUSDT = '0x40c035016AD732b6cFce34c3F881040B6C6cf71E';

  await deploy('SingleSidedInsurancePool', {
    from: deployer,
    args: [owner, claimAssessor, exchangeAgent.address, mockUSDT, capitalAgent.address],
    log: true,
    deterministicDeployment: false,
  })
}

module.exports.tags = ["SingleSidedInsurancePool", "UnoRe"]
