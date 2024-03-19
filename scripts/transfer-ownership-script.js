const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const {getBigNumber} = require("./shared/utilities")


async function main() {

    let multisig = process.env.MULTISIGWALLET;
    let OPERATOR = process.env.OPERATOR;

    console.log(multisig, "multisig address");
    console.log(OPERATOR, "OPERATOR ddress");

    let capitalAgentAbi = (await artifacts.readArtifact("CapitalAgent")).abi;
    let rewarderAbi = (await artifacts.readArtifact("Rewarder")).abi;

    
    this.SSIPUNO = (await hre.deployments.get("SingleSidedInsurancePoolUNO")).address; 
	this.SSIPUSDC = (await hre.deployments.get("SingleSidedInsurancePoolUSDC")).address; 

    this.SSIPUNO = await ethers.getContractAt(rewarderAbi, this.SSIPUNO);
    this.SSIPUSDC = await ethers.getContractAt(rewarderAbi, this.SSIPUSDC);

    this.RewrderUNO = await ethers.getContractAt(ssipAbi, await (this.SSIPUNO.rewarder()));
    this.RewrderUSDC = await ethers.getContractAt(ssipAbi, await (this.SSIPUSDC.rewarder()));

    
    this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address;
    this.CapitalAgent = await ethers.getContractAt(capitalAgentAbi, this.CapitalAgent);
    
    this.ExchangeAgent = (await hre.deployments.get("ExchangeAgent")).address;
    this.ExchangeAgent = await ethers.getContractAt("ExchangeAgent", this.ExchangeAgent);

    let ADMIN_ROLE = await this.SSIPETH.ADMIN_ROLE();
    
    await this.SSIPUNO.grantRole(ADMIN_ROLE, multisig);
    await this.SSIPUSDC.grantRole(ADMIN_ROLE, multisig);

    await this.CapitalAgent.grantRole(ADMIN_ROLE, multisig);
    await this.CapitalAgent.setOperator(OPERATOR);

    await this.RewrderUNO.transferOwnership(OPERATOR);
    await this.RewrderUSDC.transferOwnership(OPERATOR);

    await this.ExchangeAgent.transferOwnership(multisig);

}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })