const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const {getBigNumber} = require("./shared/utilities")

const dataOfUser = require("./data.json");


async function main() {


    let ssipAbi = (await artifacts.readArtifact("SingleSidedInsurancePool")).abi;

    
    this.SSIPETH = (await hre.deployments.get("SingleSidedInsurancePoolETH")).address;
    this.SSIPUNO = (await hre.deployments.get("SingleSidedInsurancePoolUNO")).address; 
	this.SSIPUSDC = (await hre.deployments.get("SingleSidedInsurancePoolUSDC")).address; 
    this.SSIPUSDT = (await hre.deployments.get("SingleSidedInsurancePoolUSDT")).address; 

    this.SSIPETH = await ethers.getContractAt(ssipAbi, this.SSIPETH);
    this.SSIPUNO = await ethers.getContractAt(ssipAbi, this.SSIPUNO);
    this.SSIPUSDC = await ethers.getContractAt(ssipAbi, this.SSIPUSDC);
    this.SSIPUSDT = await ethers.getContractAt(ssipAbi, this.SSIPUSDT);

    for (const [key, value] of Object.entries(dataOfUser)) {
        // Call your function with each key-value pair

        let tx = await(await this.SSIPUSDT.setUserDetails(key, getBigNumber(value.toString()), 0)).wait();

        console.log( "status: ", tx.status);
        const delayBetweenIterations = 5000 * 3 // 15 seconds
        await new Promise((resolve) => setTimeout(resolve, delayBetweenIterations))

    }
}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })