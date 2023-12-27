const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const PremiumPool = require("../../abis/PremiumPool.json");

async function main() {

    const PremiumPoolAddress = "0xf18bBfF301c8602DeA7EC739fECDDE9690fF9f3B";
    const PremiumPool = await ethers.getContractAt(PremiumPoolABI, PremiumPoolAddress);

    const aa = await ethers.getSigners();

    let currency = "0x491e7B202Ca6eB8beFb5eC4C6a3D68ce2159dcF2";
    let to  = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5";
    let amount = 1000;
    
    let tx = await PremiumPool.connect(aa[0]).withdrawPremium(currency, to, amount);
}

main();