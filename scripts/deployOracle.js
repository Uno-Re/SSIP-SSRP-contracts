const hre = require("hardhat")
require("dotenv").config()

async function main() {
  const deployerPrivateKey = process.env.PRIVATE_KEY_1

  // Connect the wallet to the provider
  const deployerWallet = new ethers.Wallet(deployerPrivateKey, ethers.provider)

  console.log("Deploying contracts with the account:", deployerWallet.address)

  // Get the contract to deploy
  const SingleSidedInsurancePool = await hre.ethers.getContractFactory(
    "contracts/SingleSidedInsurancePool.sol:SingleSidedInsurancePool",
    deployerWallet,
  )

  // Deploy the contract
  const singleSidedInsurancePool = await SingleSidedInsurancePool.deploy()

  console.log("SingleSidedInsurancePool deployed to:", singleSidedInsurancePool.address)
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
