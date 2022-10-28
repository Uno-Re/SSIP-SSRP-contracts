const { ethers, network } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")
const sigUtil = require("eth-sig-util")
const { Biconomy } = require("@biconomy/mexa")
const {
  getBigNumber,
  getNumber,
  getHexStrFromStr,
  getPaddedHexStrFromBN,
  getChainId,
  getSignatureParameters,
  getPaddedHexStrFromBNArray,
} = require("./shared/utilities")

const ssipAddress = "0xBD1105Ce524828f15d7da3CAF098c8E42D0Fbf31"
const capitalAgentAddress = "0x75298ca41f347Ab468f01BDdDA20057603b3AA4d"
const exchangeAgentAddress = "0x87e1f628225c170a5C0Bf895580686430DEb3322"
const riskPoolFactoryAddress = "0xc743508A6AD19c31Aff110778EFDE0867E4cEf08"
const rewarderFactoryAddress = "0xA722FdFBbECdadB79aB27aAE388015dC4FACF6Ca"
const USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"

async function main() {
  const SingleSidedInsurancePool = await ethers.getContractFactory("SingleSidedInsurancePool")
  const ssip = await SingleSidedInsurancePool.attach(ssipAddress)
  const CapitalAgent = await ethers.getContractFactory("CapitalAgent")
  const capitalAgent = await CapitalAgent.attach(capitalAgentAddress)
  const ExchangeAgent = await ethers.getContractFactory("ExchangeAgent")
  const exchangeAgent = await ExchangeAgent.attach(exchangeAgentAddress)
  const Rewarder = await ethers.getContractFactory("Rewarder")
  const RiskPool = await ethers.getContractFactory("RiskPool")

  const signers = await ethers.getSigners()
  const zeroAddress = ethers.constants.AddressZero

  // await(await capitalAgent.addPoolWhiteList(ssip.address)).wait()
  // await(await capitalAgent.setMCR(ethers.utils.parseUnits("0.5"))).wait()
  const mcr = await capitalAgent.MCR()
  console.log('[mcr check]', mcr.toString())
  const whiteList = await capitalAgent.poolWhiteList(ssip.address)
  console.log('[whiteList check]', whiteList)

  const capitalAgentCheck = await ssip.capitalAgent()
  console.log('[capitalAgentCheck check]', capitalAgentCheck)

  // await (await ssip.setCapitalAgent(capitalAgentAddress)).wait()

  // const capitalAgentCheckAfter = await ssip.capitalAgent()
  // console.log('[capitalAgentCheck check after]', capitalAgentCheckAfter)

  // await(await ssip.createRewarder(
  //   signers[0].address,
  //   rewarderFactoryAddress,
  //   UNO,
  // )).wait()

  // await(await ssip.createRiskPool(
  //   "Synthetic SSIP-USDC",
  //   "SSSIP-USDC",
  //   riskPoolFactoryAddress,
  //   USDC,
  //   ethers.utils.parseUnits("0.165"),
  //   ethers.utils.parseUnits("10000")
  // )).wait()

  const rewarderAddress = await ssip.rewarder()
  const rewarder = await Rewarder.attach(rewarderAddress)

  const riskPoolAddress = await ssip.riskPool()
  const riskPool = await Rewarder.attach(riskPoolAddress)

  console.log('[riskpool and rewarder check]', rewarderAddress, riskPool.address)

  const poolInfo = await capitalAgent.poolInfo(ssip.address)
  console.log('[pool info check on capitalAgent]', poolInfo.totalCapital.toString(), poolInfo.SCR.toString(), poolInfo.currency, poolInfo.exist)

  const totalCapital = await capitalAgent.totalCapitalInUSDC()
  console.log('[total capital check]', totalCapital.toString())
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
