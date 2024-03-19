const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const {getBigNumber} = require("./shared/utilities")


async function main() {

    let multisig = "0xFFadCf0465744b1a722Af1435A7d070450fdA049";
    let CLAIMS_DAO = "0xB51F1A80DB244ec8d70E4C521ff77Cd0731df241";
    let OPERATOR = "0xFFadCf0465744b1a722Af1435A7d070450fdA049";
    let GOVERNANCE = "0xFFadCf0465744b1a722Af1435A7d070450fdA049";
    let GAURDIAN_COUNCIL = "0xFFadCf0465744b1a722Af1435A7d070450fdA049";
    let EsalactionMangerMultsig = "0x21E241BA97b9a78bda0f92FF8304ba36a34c0c00";

    console.log(multisig, "multisig address");
    console.log(CLAIMS_DAO, "CLAIMS_DAO address");
    console.log(OPERATOR, "OPERATOR address");
    console.log(GOVERNANCE, "GOVERNANCE address");
    console.log(GAURDIAN_COUNCIL, "GAURDIAN_COUNCIL address");

    let ssipAbi = (await artifacts.readArtifact("SingleSidedInsurancePool")).abi;
    let capitalAgentAbi = (await artifacts.readArtifact("CapitalAgent")).abi;
    let payoutAbi = (await artifacts.readArtifact("PayoutRequest")).abi;
    let ssrpAbi = (await artifacts.readArtifact("SingleSidedReinsurancePool")).abi;
    let rewarderAbi = (await artifacts.readArtifact("Rewarder")).abi;

    
    this.SSIPETH = (await hre.deployments.get("SingleSidedInsurancePoolETH")).address;
    this.SSIPUNO = (await hre.deployments.get("SingleSidedInsurancePoolUNO")).address; 
	this.SSIPUSDC = (await hre.deployments.get("SingleSidedInsurancePoolUSDC")).address; 
    this.SSIPUSDT = (await hre.deployments.get("SingleSidedInsurancePoolUSDT")).address; 
    this.SSRP = (await hre.deployments.get("SingleSidedReinsurancePool")).address;

    this.PayoutETH = (await hre.deployments.get("PayoutRequestETH")).address;
    this.PayoutUNO = (await hre.deployments.get("PayoutRequestUNO")).address; 
	this.PayoutUSDC = (await hre.deployments.get("PayoutRequestUSDC")).address; 
    this.PayoutUSDT = (await hre.deployments.get("PayoutRequestUSDT")).address; 
    this.SSRP = (await hre.deployments.get("SingleSidedReinsurancePool")).address;
    this.EscalationManager = (await hre.deployments.get("EscalationManager")).address;

    this.SSIPETH = await ethers.getContractAt(rewarderAbi, this.SSIPETH);
    this.SSIPUNO = await ethers.getContractAt(rewarderAbi, this.SSIPUNO);
    this.SSIPUSDC = await ethers.getContractAt(rewarderAbi, this.SSIPUSDC);
    this.SSIPUSDT = await ethers.getContractAt(rewarderAbi, this.SSIPUSDT);
    this.SSRP = await ethers.getContractAt(rewarderAbi, this.SSRP);

    this.RewrderETH = await ethers.getContractAt(ssipAbi, await (this.SSIPETH.rewarder()));
    this.RewrderUNO = await ethers.getContractAt(ssipAbi, await (this.SSIPUNO.rewarder()));
    this.RewrderUSDC = await ethers.getContractAt(ssipAbi, await (this.SSIPUSDC.rewarder()));
    this.RewrderUSDT = await ethers.getContractAt(ssipAbi, await (this.SSIPUSDT.rewarder()));
    this.RewrderSSRP = await ethers.getContractAt(ssrpAbi, await (this.SSRP.rewarder()));

    
    this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address;
    this.CapitalAgent = await ethers.getContractAt(capitalAgentAbi, this.CapitalAgent);
    
    this.PremiumPool = (await hre.deployments.get("PremiumPool")).address;
    this.PremiumPool = await ethers.getContractAt("PremiumPool", this.PremiumPool);
    this.SalesPolicyFactory = (await hre.deployments.get("SalesPolicyFactory")).address;
    this.SalesPolicyFactory = await ethers.getContractAt("SalesPolicyFactory", this.SalesPolicyFactory);
    this.RiskPoolFactory = await hre.deployments.get("RiskPoolFactory");
    this.RewarderFactory = await hre.deployments.get("RewarderFactory");
    this.ExchangeAgent = (await hre.deployments.get("ExchangeAgent")).address;
    this.ExchangeAgent = await ethers.getContractAt("ExchangeAgent", this.ExchangeAgent);

    let ADMIN_ROLE = await this.SSIPETH.ADMIN_ROLE();
    let CLAIM_ASSESSOR_ROLE = await this.SSIPETH.CLAIM_ASSESSOR_ROLE();
    let GOVERNANCE_ROLE = await this.SSIPETH.GOVERNANCE_ROLE();
    
    await this.SSIPETH.grantRole(ADMIN_ROLE, multisig);
    await this.SSIPUNO.grantRole(ADMIN_ROLE, multisig);
    await this.SSIPUSDC.grantRole(ADMIN_ROLE, multisig);
    await this.SSIPUSDT.grantRole(ADMIN_ROLE, multisig);

    await this.SSRP.grantRole(ADMIN_ROLE, multisig);
    await this.SSRP.grantRole(CLAIM_ASSESSOR_ROLE, CLAIMS_DAO);

    await this.PremiumPool.grantRole(ADMIN_ROLE, multisig);
    await this.PremiumPool.grantRole(GOVERNANCE_ROLE, GOVERNANCE);

    await this.CapitalAgent.grantRole(ADMIN_ROLE, multisig);
    await this.CapitalAgent.setOperator(OPERATOR);

    await this.RewrderETH.transferOwnership(OPERATOR);
    await this.RewrderUNO.transferOwnership(OPERATOR);
    await this.RewrderUSDC.transferOwnership(OPERATOR);
    await this.RewrderUSDT.transferOwnership(OPERATOR);
    await this.RewrderSSRP.transferOwnership(OPERATOR);

    await this.ExchangeAgent.transferOwnership(multisig);

    await this.SalesPolicyFactory.transferOwnership(multisig);

    this.PayoutETH = await ethers.getContractAt(payoutAbi, this.PayoutETH);
    this.PayoutUNO = await ethers.getContractAt(payoutAbi, this.PayoutUNO);
    this.PayoutUSDC = await ethers.getContractAt(payoutAbi, this.PayoutUSDC);
    this.PayoutUSDT = await ethers.getContractAt(payoutAbi, this.PayoutUSDT);

    await this.PayoutETH.setClaimsDao(CLAIMS_DAO);
    await this.PayoutUNO.setClaimsDao(CLAIMS_DAO);
    await this.PayoutUSDC.setClaimsDao(CLAIMS_DAO);
    await this.PayoutUSDT.setClaimsDao(CLAIMS_DAO);

    await this.PayoutETH.setGuardianCouncil(GAURDIAN_COUNCIL);
    await this.PayoutUNO.setGuardianCouncil(GAURDIAN_COUNCIL);
    await this.PayoutUSDC.setGuardianCouncil(GAURDIAN_COUNCIL);
    await this.PayoutUSDT.setGuardianCouncil(GAURDIAN_COUNCIL);

    await this.EscalationManager.grantRole(CLAIM_ASSESSOR_ROLE, EsalactionMangerMultsig);

}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })