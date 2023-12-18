const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const OptimisticOracleV3ABI = require("../../abis/OptimisticOracleV3.json");

async function main() {

    const OptimisticOracleV3Address = "0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB";
    const OptimisticOracleV3 = await ethers.getContractAt(OptimisticOracleV3ABI, OptimisticOracleV3Address);

    const aa = await ethers.getSigners();
    
    let assertionId = "";
    let tx = await OptimisticOracleV3.connect(aa[0]).settleAssertion(assertionId);
}

main();