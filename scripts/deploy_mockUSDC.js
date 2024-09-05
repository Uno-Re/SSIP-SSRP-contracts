const fs = require("fs")
const { ethers, network } = require("hardhat")
const hre = require("hardhat")

async function main() {
  const MockUsdc = await ethers.getContractFactory("MockUSDC")
  const mockUsdc = await MockUsdc.deploy()
  
  await mockUsdc.deployed()

  console.log("MockUSDC deployed to:", mockUsdc.address)
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
