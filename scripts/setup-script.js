const { ethers, network } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

let rewardMultiplier;
let UNOToken;
let USDCToken;
let USDTToken;
let operator;
let poolSCR;
let MCR;
let MLR;
let signerInSalesPolicy;

async function main() {
    this.SSIPETH = await hre.deployments.get("SingleSidedInsurancePoolETH");
    this.SSIPUNO = await hre.deployments.get("SingleSidedInsurancePoolUNO"); 
	this.SSIPUSDC = await hre.deployments.get("SingleSidedInsurancePoolUSDC"); 
    this.SSIPUSDT = await hre.deployments.get("SingleSidedInsurancePoolUSDT"); 
    this.SSRP = await hre.deployments.get("SingleSidedReinsurancePool"); 

    this.CapitalAgent = await hre.deployments.get("CapitalAgent");
    this.PremiumPool = await hre.deployments.get("PremiumPool");
    this.SalesPolicyFactory = await hre.deployments.get("SalesPolicyFactory");
    this.RiskPoolFactory = await hre.deployments.get("RiskPoolFactory");
    this.RewarderFactory = await hre.deployments.get("RewarderFactory");
    this.ExchangeAgent = await hre.deployments.get("ExchangeAgent");

    await this.CapitalAgent.addPoolWhiteList(this.SSIPETH.address);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUNO.address);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDC.address);
    await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDT.address);
    await this.CapitalAgent.setMCR(MCR);
    await this.CapitalAgent.setMLR(MLR);
    await this.CapitalAgent.setSalesPolicyFactory(this.setSalesPolicyFactory.address);

    await this.SSIPETH.createRiskPool("SSIP-ETH", "SSIP-ETH", this.RiskPoolFactory.address, "0x0000000000000000000000000000000000000000", rewardMultiplier, poolSCR);
    await this.SSIPUNO.createRiskPool("SSIP-UNO", "SSIP-UNO", this.RiskPoolFactory.address, UNOToken, rewardMultiplier, poolSCR);
    await this.SSIPUSDC.createRiskPool("SSIP-USDC", "SSIP-USDC", this.RiskPoolFactory.address, USDCToken, rewardMultiplier, poolSCR);
    await this.SSIPUSDT.createRiskPool("SSIP-USDT", "SSIP-USDT", this.RiskPoolFactory.address, USDTToken, rewardMultiplier, poolSCR);

    await this.SSIPETH.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUNO.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUSDC.createRewarder(operator, this.RewarderFactory.address, UNOToken);
    await this.SSIPUSDT.createRewarder(operator, this.RewarderFactory.address, UNOToken);

    await this.SSRP.createRiskPool("Synthetic SSRP", "SSRP", this.RiskPoolFactory.address, UNOToken, rewardMultiplier, poolSCR);
    await this.SSRP.createRewarder(operator, this.RewarderFactory.address, UNOToken);

    
    await this.SalesPolicyFactory.newSalesPolicy(this.ExchangeAgent.address, this.PremiumPool.address, this.CapitalAgent.address);
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