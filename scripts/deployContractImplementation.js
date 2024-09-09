const hre = require("hardhat");
require("dotenv").config()

async function main() {
  // Deployer's private key
  const deployerPrivateKey = process.env.PRIVATE_KEY_1;
  
  // Connect the wallet to the provider
  const deployerWallet = new ethers.Wallet(deployerPrivateKey, ethers.provider);
  console.log("Deploying contracts with the account:", deployerWallet.address);

  // Add the contract implementation's path you want to deploy
  const Contract = await hre.ethers.getContractFactory("contracts/SingleSidedInsurancePool.sol:SingleSidedInsurancePool",deployerWallet);

  // Deploy the contract
  const contract = await Contract.deploy();
  // Log the contract's address
  console.log("Contract deployed to:", contract.target);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
