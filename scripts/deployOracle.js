const fs = require("fs")
const { ethers, network } = require("hardhat")
const hre = require("hardhat")

async function main() {
  const Oracle = await ethers.getContractFactory("SupraPriceOracle")
  const oracle = (await Oracle.deploy("0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863")).waitForDeployment
  
  console.log(oracle.address)
;}

main()

  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
