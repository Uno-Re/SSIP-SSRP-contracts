const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const singleSidedInsurancePoolABI = require("../../abis/SingleSidedInsurancePool.json");
const mockUNOABI = require("../../abis/MockUNO.json");
const mockUSDTABI = require("../../abis/MockUSDT.json");

async function main() {

    const mockUNOAddress = "0x491e7B202Ca6eB8beFb5eC4C6a3D68ce2159dcF2";
    const mockUNO = await ethers.getContractAt(mockUNOABI, mockUNOAddress);
    const mockUSDTAddress = "0xb1Ce55d27FaF8D4499b840A3EDf509E4df43f9E1";
    const mockUSDT = await ethers.getContractAt(mockUSDTABI, mockUSDTAddress);
    const singleSidedInsurancePoolAddress = "0x5aC3f5c5310E067573302eE2977F46000f0fca03";
    const singleSidedInsurancePool = await ethers.getContractAt(singleSidedInsurancePoolABI, singleSidedInsurancePoolAddress);

    const aa = await ethers.getSigners();
    
    await mockUNO.connect(aa[0]).faucetToken(getBigNumber("10000"));
    await mockUNO.connect(aa[0]).approve(singleSidedInsurancePoolAddress, getBigNumber("10000"));
    await mockUSDT.connect(aa[0]).faucetToken(getBigNumber("10000"));
    await mockUNO.connect(aa[0]).approve(singleSidedInsurancePoolAddress, getBigNumber("10000"));
    
    let tx = await singleSidedInsurancePool.connect(aa[0]).enterInPool(getBigNumber("10000"));
}

main();