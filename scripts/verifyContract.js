const { run } = require("hardhat");

async function main() {
  // Add your contract's address
  const contractAddress = "0xc60e9b29d6d844ead57db357874c20063f5e4887"; 
  // Add your contract's file name
  const contractName = "PayoutRequest.sol";     
  // Add contructor arguments, if any      
  const constructorArgs = [];                    
  try {
    console.log(`Verifying ${contractName} at address ${contractAddress}...`);
    
    await run("verify:verify", {
      address: contractAddress,
      constructorArguments: constructorArgs,
    });

    console.log("Contract verified successfully!");
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
