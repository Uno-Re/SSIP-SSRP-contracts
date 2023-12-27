const { ethers, network, upgrades } = require("hardhat");

const claimProcessorABI = require("../../abis/ClaimProcessor.json");

async function main() {

    const claimProcessorAddress = "0x3cFea372991c8FfB83127BF5F56C850d363D45ca";
    const singleSidedInsurancePool = "0x5aC3f5c5310E067573302eE2977F46000f0fca03";
    const claimProcessor = await ethers.getContractAt(claimProcessorABI, claimProcessorAddress);
    const assertionId = 100;      // corresponding assertion id of policy id
    const ssipRole = "0x257af332a8fde35063ab33aa27eca477b8bac1080c4a2709240cad91a49e15e7";
    
    const aa = await ethers.getSigners();
    let tx = await claimProcessor.connect(aa[0]).grantRole(ssipRole, singleSidedInsurancePool);
    console.log(tx);
    tx = await claimProcessor.connect(aa[0]).approvePolicy(assertionId);
    console.log(tx);
}

main();