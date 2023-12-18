const { ethers, network, upgrades } = require("hardhat");

const singleSidedInsurancePoolABI = require("../../abis/SingleSidedInsurancePool.json");

async function main() {

    const singleSidedInsurancePoolAddress = "0x5aC3f5c5310E067573302eE2977F46000f0fca03";
    const singleSidedInsurancePool = await ethers.getContractAt(singleSidedInsurancePoolABI, singleSidedInsurancePoolAddress);
    const policyId = 100;
    const amount = 234000;
    const to = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5";
    
    const aa = await ethers.getSigners();

    await singleSidedInsurancePool.connect(aa[0]).setFailed(true);
    let tx = await singleSidedInsurancePool.connect(aa[0]).requestPayout(policyId, amount, to);
}

main();