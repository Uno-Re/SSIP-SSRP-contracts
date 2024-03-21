// Defining bytecode and abi from original contract on mainnet to ensure bytecode matches and it produces the same pair code hash

module.exports = async function ({ ethers, getNamedAccounts, deployments, getChainId }) {
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const owner = deployer

  // const signers = [
  //   "0x5569BDF4e02cec3fE459796e3d0e741616029fA4",
  //   "0x8CB75ae7a37f20cC73d74eb01b8D9BE81ebe4043",
  //   "0x378C4B07Ac325E7e19d19fAb10ef523e35d4dd18",
  //   "0xBeF2C0415CC95b57a6e96cEE05804c8259601a2f",
  //   "0x7EF5A63908aF1104151F0aE7Af59fA3D691e946c"
  // ]
  // const numConfirmationsRequired = 2

  // await deploy("MultiSigWallet", {
  //   from: deployer,
  //   args: [signers, numConfirmationsRequired],
  //   log: true,
  //   deterministicDeployment: false,
  // })
}

module.exports.tags = ["MultiSigWallet", "UnoRe"]
