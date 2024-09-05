const fs = require("fs")
const { ethers, network } = require("hardhat")
const hre = require("hardhat")

async function main() {
  const MockUno = await ethers.getContractFactory("MockUNO")
  const mockUno = await MockUno.deploy()
  
  await mockUno.deployed()
  console.log(await mockUno.address)
;}

main()

  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
