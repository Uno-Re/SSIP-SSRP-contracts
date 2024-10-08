const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const singleSidedInsurancePoolABI = require("../../abis/SingleSidedInsurancePool.json");
const mockUNOABI = require("../../abis/MockUNO.json");
const mockUSDTABI = require("../../abis/MockUSDT.json");

async function main() {

    const singleSidedInsurancePoolAddress = "0x5aC3f5c5310E067573302eE2977F46000f0fca03";
    const singleSidedInsurancePool = await ethers.getContractAt(singleSidedInsurancePoolABI, singleSidedInsurancePoolAddress);

    const aa = await ethers.getSigners();
    
    let tx = await singleSidedInsurancePool.connect(aa[0]).leaveFromPoolInPending(getBigNumber("10000"));
}

main();