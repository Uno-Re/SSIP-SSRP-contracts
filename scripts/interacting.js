const fs = require("fs");
const { ethers } = require("hardhat");
const { Agent } = require("http");
require("dotenv").config();

async function main() {
  const privateKey = process.env.PRIVATE_KEY_1;

  const provider = new ethers.JsonRpcProvider("https://rpc.sepolia.org"); // Use default provider
  const wallet = new ethers.Wallet(privateKey, provider);

  const capitalAgentDeployment = require("../deployments/sepolia/CapitalAgent.json");
  const capitalAgent = new ethers.Contract(
    capitalAgentDeployment.address,
    capitalAgentDeployment.abi,
    wallet
  );

   const poolDeployment = require("../deployments/sepolia/SingleSidedInsurancePoolUSDC.json");
  const pool = new ethers.Contract(
    poolDeployment.address,
    poolDeployment.abi,
    wallet
  );

  const oracleDeployment = require("../deployments/sepolia/PriceOracle.json");
  const oracle = new ethers.Contract(
    oracleDeployment.address,
    oracleDeployment.abi,
    wallet
  );
  
  //const resultMLR = await capitalAgent.MLR();
  //const resultMCR = await capitalAgent.MCR();
  //const resultTotalUtilizedAmount = await capitalAgent.totalUtilizedAmount();
  //const stakeInAgent = await pool.stakeInCapitalAgent(10000000);
  //const resultTotalCapitalStaked = await capitalAgent.totalCapitalStaked();
  const setAggregator = await oracle.setETHUSDAggregator("0x694AA1769357215DE4FAC081bf1f309aDC325306");

  

  //console.log("MLR Returned:", resultMLR);
  //console.log("MCR Returned:", resultMCR);
  //console.log("Total Utilized Amount Returned:", resultTotalUtilizedAmount);
  //console.log("Amount Staked successfully? :", stakeInAgent);
  console.log("Aggregator :", setAggregator);
  // console.log("Total Capital Staked Returned:", resultTotalCapitalStaked);

}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
