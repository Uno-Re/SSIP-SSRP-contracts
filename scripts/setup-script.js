const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")

const { getBigNumber } = require("./shared/utilities")

async function main() {
  let rewardMultiplier = 1
  let UNOToken = process.env.UNO
  let USDCToken = process.env.USDC
  let USDTToken = process.env.USDT
  let operator = "0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863"
  let poolSCR = getBigNumber("1", 6)
  let MCR = getBigNumber("10", 6)
  let MLR = getBigNumber("1", 6)
  let signerInSalesPolicy = "0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863"

  let ssipAbi = (await artifacts.readArtifact("SingleSidedInsurancePool")).abi
  let capitalAgentAbi = (await artifacts.readArtifact("CapitalAgent")).abi
  let payoutAbi = (await artifacts.readArtifact("PayoutRequest")).abi
  let ssrpAbi = (await artifacts.readArtifact("SingleSidedReinsurancePool")).abi

  this.SSIPETH = (await hre.deployments.get("SingleSidedInsurancePoolETH")).address
  console.log("1 SingleSidedInsurancePoolETH", SSIPETH)
  this.SSIPUNO = (await hre.deployments.get("SingleSidedInsurancePoolUNO")).address
  console.log("2 SingleSidedInsurancePoolUNO", SSIPUNO)
  this.SSIPUSDC = (await hre.deployments.get("SingleSidedInsurancePoolUSDC")).address
  console.log("3 SingleSidedInsurancePoolUSDC", SSIPUSDC)
  this.SSIPUSDT = (await hre.deployments.get("SingleSidedInsurancePoolUSDT")).address
  console.log("4 SingleSidedInsurancePoolUSDT", SSIPUSDT)
  this.SSRP = (await hre.deployments.get("SingleSidedReinsurancePool")).address
  console.log("5 SingleSidedReinsurancePool", SSRP)

  this.PayoutETH = (await hre.deployments.get("PayoutRequestETH")).address
  console.log("6 PayoutRequestETH", PayoutETH)
  this.PayoutUNO = (await hre.deployments.get("PayoutRequestUNO")).address
  console.log("7 PayoutRequestUNO", PayoutUNO)
  this.PayoutUSDC = (await hre.deployments.get("PayoutRequestUSDC")).address
  console.log("8 PayoutRequestUSDC", PayoutUSDC)
  this.PayoutUSDT = (await hre.deployments.get("PayoutRequestUSDT")).address
  console.log("9 PayoutRequestUSDT", PayoutUSDT)
  this.SSRP = (await hre.deployments.get("SingleSidedReinsurancePool")).address
  console.log("10 SingleSidedReinsurancePool", SSRP)
  this.EscalationManager = (await hre.deployments.get("EscalationManager")).address
  console.log("11 EscalationManager", EscalationManager)

  this.SSIPETH = await ethers.getContractAt(ssipAbi, this.SSIPETH)
  this.SSIPUNO = await ethers.getContractAt(ssipAbi, this.SSIPUNO)
  this.SSIPUSDC = await ethers.getContractAt(ssipAbi, this.SSIPUSDC)
  this.SSIPUSDT = await ethers.getContractAt(ssipAbi, this.SSIPUSDT)
  this.SSRP = await ethers.getContractAt(ssrpAbi, this.SSRP)

  this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address
  console.log("12 CapitalAgent", CapitalAgent)
  this.CapitalAgent = await ethers.getContractAt(capitalAgentAbi, this.CapitalAgent)

  this.PremiumPool = (await hre.deployments.get("PremiumPool")).address
  console.log("13 PremiumPool", PremiumPool)
  this.PremiumPool = await ethers.getContractAt("PremiumPool", this.PremiumPool)
  this.SalesPolicyFactory = (await hre.deployments.get("SalesPolicyFactory")).address
  console.log("14 SalesPolicyFactory", SalesPolicyFactory)

  this.SalesPolicyFactory = await ethers.getContractAt("SalesPolicyFactory", this.SalesPolicyFactory)
  this.RiskPoolFactory = await hre.deployments.get("RiskPoolFactory")
  console.log("15 RiskPoolFactory", await RiskPoolFactory.address)
  this.RewarderFactory = await hre.deployments.get("RewarderFactory")
  console.log("16 RewarderFactory", await RewarderFactory.address)
  this.ExchangeAgent = await hre.deployments.get("ExchangeAgent")
  console.log("17 ExchangeAgent", await ExchangeAgent.address)

  await this.CapitalAgent.addPoolWhiteList(this.SSIPETH.target)
  await this.CapitalAgent.addPoolWhiteList(this.SSIPUNO.target)
  await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDC.target)
  await this.CapitalAgent.addPoolWhiteList(this.SSIPUSDT.target)

  await this.CapitalAgent.setMCR(MCR)
  await this.CapitalAgent.setMLR(MLR)
  await this.CapitalAgent.setSalesPolicyFactory(this.SalesPolicyFactory.target)

  let CLAIM_PROCESSOR_ROLE = await this.SSIPETH.CLAIM_PROCESSOR_ROLE()

  await this.SSIPETH.createRiskPool(
    "Synthetic SSIP-ETH",
    "SSSIP-ETH",
    this.RiskPoolFactory.address,
    "0x0000000000000000000000000000000000000000",
    rewardMultiplier,
    poolSCR,
  )
  await this.SSIPUNO.createRiskPool(
    "Synthetic SSIP-UNO",
    "SSSIP-UNO",
    this.RiskPoolFactory.address,
    UNOToken,
    rewardMultiplier,
    poolSCR,
  )
  await this.SSIPUSDC.createRiskPool(
    "Synthetic SSIP-USDC",
    "SSSIP-USDC",
    this.RiskPoolFactory.address,
    USDCToken,
    rewardMultiplier,
    poolSCR,
  )
  await this.SSIPUSDT.createRiskPool(
    "Synthetic SSIP-USDT",
    "SSSIP-USDT",
    this.RiskPoolFactory.address,
    USDTToken,
    rewardMultiplier,
    poolSCR,
  )

  await this.SSIPETH.createRewarder(operator, this.RewarderFactory.address, UNOToken)
  await this.SSIPUNO.createRewarder(operator, this.RewarderFactory.address, UNOToken)
  await this.SSIPUSDC.createRewarder(operator, this.RewarderFactory.address, UNOToken)
  await this.SSIPUSDT.createRewarder(operator, this.RewarderFactory.address, UNOToken)

  await this.SSIPETH.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutETH)
  await this.SSIPUNO.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUNO)
  await this.SSIPUSDC.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDC)
  await this.SSIPUSDT.grantRole(CLAIM_PROCESSOR_ROLE, this.PayoutUSDT)

  this.PayoutETH = await ethers.getContractAt(payoutAbi, this.PayoutETH)
  this.PayoutUNO = await ethers.getContractAt(payoutAbi, this.PayoutUNO)
  this.PayoutUSDC = await ethers.getContractAt(payoutAbi, this.PayoutUSDC)
  this.PayoutUSDT = await ethers.getContractAt(payoutAbi, this.PayoutUSDT)

  await this.PayoutETH.setCapitalAgent(this.CapitalAgent.target)
  await this.PayoutUNO.setCapitalAgent(this.CapitalAgent.target)
  await this.PayoutUSDC.setCapitalAgent(this.CapitalAgent.target)
  await this.PayoutUSDT.setCapitalAgent(this.CapitalAgent.target)

  await this.SSRP.createRiskPool("Synthetic SSRP", "SSRP", this.RiskPoolFactory.address, UNOToken, rewardMultiplier)
  await this.SSRP.createRewarder(operator, this.RewarderFactory.address, UNOToken)
  await this.SalesPolicyFactory.newSalesPolicy(this.ExchangeAgent.address, this.PremiumPool.target, this.CapitalAgent.target)

  await this.SalesPolicyFactory.setSignerInPolicy(signerInSalesPolicy)
  await this.SalesPolicyFactory.approvePremiumInPolicy(UNOToken)
  await this.SalesPolicyFactory.approvePremiumInPolicy(USDCToken)
  await this.SalesPolicyFactory.approvePremiumInPolicy(USDTToken)
  let salesPolicy = (await this.CapitalAgent.getPolicyInfo())[0]
  console.log(salesPolicy)

  await this.PremiumPool.addCurrency(UNOToken)
  await this.PremiumPool.addCurrency(USDCToken)
  await this.PremiumPool.addCurrency(USDTToken)
  await this.PremiumPool.addWhiteList(salesPolicy)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
