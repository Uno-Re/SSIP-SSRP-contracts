const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const {getBigNumber} = require("./shared/utilities")


async function main() {

    let rewardMultiplier = 1;
    let UNOToken = (await hre.deployments.get("MockUNO")).address;
    let USDCToken = (await hre.deployments.get("MockUSDC")).address;
    let USDTToken = (await hre.deployments.get("MockUSDT")).address;
    let operator = "0xedFFe0a06914c9D6083B4B099e5b935E9E84c9a5";
    let poolSCR = getBigNumber("1", 6);
    let MCR = getBigNumber("10", 6);
    let MLR = getBigNumber("1", 6);
    let signerInSalesPolicy = "0xD60e6f9b596c717C55A0C6f50E3282f06FE02739";

    let ssipAbi = (await artifacts.readArtifact("SingleSidedInsurancePool")).abi;
    let capitalAgentAbi = (await artifacts.readArtifact("CapitalAgent")).abi;
    let payoutAbi = (await artifacts.readArtifact("PayoutRequest")).abi;
    let ssrpAbi = (await artifacts.readArtifact("SingleSidedReinsurancePool")).abi;

    
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

    this.SSIPETH = await ethers.getContractAt(ssipAbi, this.SSIPETH);
    this.SSIPUNO = await ethers.getContractAt(ssipAbi, this.SSIPUNO);
    this.SSIPUSDC = await ethers.getContractAt(ssipAbi, this.SSIPUSDC);
    this.SSIPUSDT = await ethers.getContractAt(ssipAbi, this.SSIPUSDT);
    this.SSRP = await ethers.getContractAt(ssrpAbi, this.SSRP);

    this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address;
    this.CapitalAgent = await ethers.getContractAt(capitalAgentAbi, this.CapitalAgent);

    this.PremiumPool = (await hre.deployments.get("PremiumPool")).address;
    this.PremiumPool = await ethers.getContractAt("PremiumPool", this.PremiumPool);
    this.SalesPolicyFactory = (await hre.deployments.get("SalesPolicyFactory")).address;
    this.SalesPolicyFactory = await ethers.getContractAt("SalesPolicyFactory", this.SalesPolicyFactory);
    this.RiskPoolFactory = await hre.deployments.get("RiskPoolFactory");
    this.RewarderFactory = await hre.deployments.get("RewarderFactory");
    this.ExchangeAgent = await hre.deployments.get("ExchangeAgent");

    await this.CapitalAgent.addPoolWhiteList(this.SSIPETH.target);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUNO.target);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDC.target);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDT.target);

    await this.CapitalAgent.setMCR(MCR);
    await this.CapitalAgent.setMLR(MLR);
    await this.CapitalAgent.setSalesPolicyFactory(this.SalesPolicyFactory.target);
    let CLAIM_PROCESSOR_ROLE = await this.SSIPETH.CLAIM_PROCESSOR_ROLE();

    await this.SSIPETH.createRiskPool("SSIP-ETH", "SSIP-ETH", this.RiskPoolFactory.address, "0x0000000000000000000000000000000000000000", rewardMultiplier, poolSCR);
    await this.SSIPUNO.createRiskPool("SSIP-UNO", "SSIP-UNO", this.RiskPoolFactory.address, UNOToken, rewardMultiplier, poolSCR);
    await this.SSIPUSDC.createRiskPool("SSIP-USDC", "SSIP-USDC", this.RiskPoolFactory.address, USDCToken, rewardMultiplier, poolSCR);
    await this.SSIPUSDT.createRiskPool("SSIP-USDT", "SSIP-USDT", this.RiskPoolFactory.address, USDTToken, rewardMultiplier, poolSCR);

    await this.SSIPETH.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUNO.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUSDC.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUSDT.createRewarder(operator, this.RewarderFactory.address, UNOToken);

    await this.SSIPETH.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutETH);
    await this.SSIPUNO.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUNO);
    await this.SSIPUSDC.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDC);
    await this.SSIPUSDT.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDT);

    await this.SSIPETH.grantRole(CLAIM_PROCESSOR_ROLE, this.EscalationManager);
    await this.SSIPUNO.grantRole(CLAIM_PROCESSOR_ROLE, this.EscalationManager);
    await this.SSIPUSDC.grantRole(CLAIM_PROCESSOR_ROLE, this.EscalationManager);
    await this.SSIPUSDT.grantRole(CLAIM_PROCESSOR_ROLE, this.EscalationManager);

    await this.SSRP.createRiskPool("Synthetic SSRP", "SSRP", this.RiskPoolFactory.address, UNOToken, rewardMultiplier);
    await this.SSRP.createRewarder(operator, this.RewarderFactory.address, UNOToken);

    await this.SalesPolicyFactory.newSalesPolicy(this.ExchangeAgent.address, this.PremiumPool.target, this.CapitalAgent.target);
    await this.SalesPolicyFactory.setSignerInPolicy(signerInSalesPolicy);
    await this.SalesPolicyFactory.approvePremiumInPolicy(UNOToken);
    await this.SalesPolicyFactory.approvePremiumInPolicy(USDCToken);
    await this.SalesPolicyFactory.approvePremiumInPolicy(USDTToken);
    let salesPolicy = (await this.CapitalAgent.getPolicyInfo())[0];
    await this.PremiumPool.addCurrency(UNOToken);
    await this.PremiumPool.addCurrency(USDCToken);
    await this.PremiumPool.addCurrency(USDTToken);
    await this.PremiumPool.addWhiteList(salesPolicy);
}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })