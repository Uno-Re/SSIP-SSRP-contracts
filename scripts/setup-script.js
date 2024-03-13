const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const {getBigNumber} = require("./shared/utilities")


async function main() {

    let UNOToken = process.env.UNO_BNB;
    let USDCToken = process.env.USDC_BNB;
    let operator = "0x8C0F1b5C01A7146259d51F798a114f4F8dC0177e";

    let ssipAbi = (await artifacts.readArtifact("SingleSidedInsurancePool")).abi;
    let capitalAgentAbi = (await artifacts.readArtifact("CapitalAgent")).abi;
    let payoutAbi = (await artifacts.readArtifact("PayoutRequest")).abi;
    let ssrpAbi = (await artifacts.readArtifact("SingleSidedReinsurancePool")).abi;

    
    this.SSIPUNO = (await hre.deployments.get("SingleSidedInsurancePoolUNO")).address; 
	this.SSIPUSDC = (await hre.deployments.get("SingleSidedInsurancePoolUSDC")).address; 

    this.SSIPUNO = await ethers.getContractAt(ssipAbi, this.SSIPUNO);
    this.SSIPUSDC = await ethers.getContractAt(ssipAbi, this.SSIPUSDC);

    
    this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address;
    this.CapitalAgent = await ethers.getContractAt(capitalAgentAbi, this.CapitalAgent);
    

    this.RiskPoolFactory = await hre.deployments.get("RiskPoolFactory");
    this.RewarderFactory = await hre.deployments.get("RewarderFactory");
    this.ExchangeAgent = await hre.deployments.get("ExchangeAgent");
    
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUNO.target);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDC.target);
    
    await this.CapitalAgent.setMCR("500000000000000000");
    // await this.CapitalAgent.setMLR(MLR);
    // await this.CapitalAgent.setSalesPolicyFactory(this.SalesPolicyFactory.target);
    // let CLAIM_PROCESSOR_ROLE = await this.SSIPETH.CLAIM_PROCESSOR_ROLE();
    
    // await this.SSIPETH.createRiskPool("SSIP-ETH", "SSIP-ETH", this.RiskPoolFactory.address, "0x0000000000000000000000000000000000000000", rewardMultiplier, poolSCR);
    await this.SSIPUNO.createRiskPool("Synthetic SSIP-UNO", "SSSIP-UNO", this.RiskPoolFactory.address, UNOToken, "443937087772704211", "10000000000000000000000");
    await this.SSIPUSDC.createRiskPool("Synthetic SSIP-USDC", "	SSSIP-USDC", this.RiskPoolFactory.address, USDCToken, "165000000000000000", "10000000000000000000000");
    // await this.SSIPUSDT.createRiskPool("SSIP-USDT", "SSIP-USDT", this.RiskPoolFactory.address, USDTToken, rewardMultiplier, poolSCR);
    
    // await this.SSIPETH.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUNO.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUSDC.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    // await this.SSIPUSDT.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    
    // await this.SSIPETH.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutETH);
    // await this.SSIPUNO.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUNO);
    // await this.SSIPUSDC.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDC);
    // await this.SSIPUSDT.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDT);

    // this.PayoutETH = await ethers.getContractAt(ssipAbi, this.PayoutETH);
    // this.PayoutUNO = await ethers.getContractAt(ssipAbi, this.PayoutUNO);
    // this.PayoutUSDC = await ethers.getContractAt(ssipAbi, this.PayoutUSDC);
    // this.PayoutUSDT = await ethers.getContractAt(ssipAbi, this.PayoutUSDT);

    // await this.PayoutETH.setCapitalAgent(this.CapitalAgent.target);
    // await this.PayoutUNO.setCapitalAgent(this.CapitalAgent.target);
    // await this.PayoutUSDC.setCapitalAgent(this.CapitalAgent.target);
    // await this.PayoutUSDT.setCapitalAgent(this.CapitalAgent.target); 

    // await this.SSRP.createRiskPool("Synthetic SSRP", "SSRP", this.RiskPoolFactory.address, UNOToken, rewardMultiplier);
    // await this.SSRP.createRewarder(operator, this.RewarderFactory.address, UNOToken);

    // await this.SalesPolicyFactory.newSalesPolicy(this.ExchangeAgent.address, this.PremiumPool.target, this.CapitalAgent.target);
    // await this.SalesPolicyFactory.setSignerInPolicy(signerInSalesPolicy);
    // await this.SalesPolicyFactory.approvePremiumInPolicy(UNOToken);
    // await this.SalesPolicyFactory.approvePremiumInPolicy(USDCToken);
    // await this.SalesPolicyFactory.approvePremiumInPolicy(USDTToken);
    // let salesPolicy = (await this.CapitalAgent.getPolicyInfo())[0];
    // await this.PremiumPool.addCurrency(UNOToken);
    // await this.PremiumPool.addCurrency(USDCToken);
    // await this.PremiumPool.addCurrency(USDTToken);
    // await this.PremiumPool.addWhiteList(salesPolicy);
}



main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })