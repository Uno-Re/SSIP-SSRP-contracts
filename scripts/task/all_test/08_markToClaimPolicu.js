const { ethers, network, upgrades } = require("hardhat");

const { getBigNumber, getNumber, advanceBlock, advanceBlockTo } = require("../../shared/utilities")

const CapitalAgentABI = require("../../abis/CapitalAgent..json");

async function main() {

    const CapitalAgentAddress = "0xa50F3fD32d7Ead49a5C34091744bE516b67417cA";
    const CapitalAgent = await ethers.getContractAt(CapitalAgentABI, CapitalAgentAddress);

    const aa = await ethers.getSigners();

    let policyId = 10;
    
    let tx = await CapitalAgent.connect(aa[0]).markToClaimPolicy(policyId);
}

main();