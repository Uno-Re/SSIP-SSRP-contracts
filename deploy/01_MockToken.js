// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash
const hre = require("hardhat");

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const mockUSDT = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
  // const multiSigWallet = await deployments.get("MultiSigWallet")
  // const mockUSDT = await deploy("MockUSDT", {
  //   from: deployer,
  //   args: [],
  //   log: true,
  //   deterministicDeployment: false,
  // })

  // console.log(`mock usdt deploy at ${mockUSDT.address}`)

  // const mockUSDC = await deploy("MockUSDC", {
  //   from: deployer,
  //   args: [],
  //   log: true,
  //   deterministicDeployment: false,
  // })

  // console.log(`mock usdc deploy at ${mockUSDC.address}`)

  // const mockUNO = await deploy("MockUNO", {
  //   from: deployer,
  //   args: [],
  //   log: true,
  //   deterministicDeployment: false,
  // })

  // console.log(`mock uno deploy at ${mockUNO.address}`)
}

module.exports.tags = ["MockUSDT", "MockUSDC", "MockUNO"]