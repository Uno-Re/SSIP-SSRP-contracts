const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const singleSidedInsurancePoolABI = require("../../abis/SingleSidedInsurancePool.json");
const mockUNOABI = require("../../abis/MockUNO.json");
const mockUSDTABI = require("../../abis/MockUSDT.json");

async function main() {

    const singleSidedInsurancePoolAddress = "0x5aC3f5c5310E067573302eE2977F46000f0fca03";
    const singleSidedInsurancePool = await ethers.getContractAt(singleSidedInsurancePoolABI, singleSidedInsurancePoolAddress);

    const aa = await ethers.getSigners();

    if ((await singleSidedInsurancePool.userInfo(aa[0])).isNotRollOver == true) {
        let tx = await singleSidedInsurancePool.connect(aa[0]).toggleRollOver();
    };

    await singleSidedInsurancePool.connect(aa[0]).grateRole("0x6d5c9827c1f410bbb61d3b2a0a34b6b30492d9a1fd38588edca7ec4562ab9c9b",[aa[0].address]);

    await singleSidedInsurancePool.connect(aa[0]).rollOverReward([aa[0].address]);
}


main();