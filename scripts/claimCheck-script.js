const { ethers, network, artifacts } = require("hardhat")
const { BigNumber } = ethers
const hre = require("hardhat")
const { time } = require("@nomicfoundation/hardhat-network-helpers")

const { getBigNumber } = require("./shared/utilities")

async function main() {
  const timestamp = new Date().getSeconds()
  const userAddress = process.env.CLAIMER_ADDRESS
  const policyId = process.env.POLICY_ID
  const userAmount = process.env.POLICY_AMOUNT

  this.CapitalAgent = (await hre.deployments.get("CapitalAgent")).address
  this.CapitalAgent = await ethers.getContractAt("CapitalAgent", this.CapitalAgent)
  let salesPolicy = (await this.CapitalAgent.getPolicyInfo())[0]
  this.SalesPolicy = await ethers.getContractAt("SalesPolicy", salesPolicy)

  let policyData = await this.SalesPolicy.getPolicyData(policyId)
  let coverageAmount = policyData[0]
  let coverageDuration = policyData[1]
  let coverageStart = policyData[2]
  let isExpired = timestamp >= coverageDuration + coverageStart
  let isExist = policyData[3]
  let isAmountClaimable
  let isOwner = true

  if (!isExpired && isExist) {
    if ((await this.SalesPolicy.ownerOf(policyId)) == userAddress) {
        console.log(policyId);
      let claimedAmount = await this.CapitalAgent.claimedAmount(this.SalesPolicy.target, 12)
      isAmountClaimable = userAmount + claimedAmount <= coverageAmount
      console.log("Amount is claimable", isAmountClaimable)
    } else {
      isOwner = false
      console.log("Owner", isOwner)
    }
  } else {
    console.log("Expired", isExpired)
    console.log("Exist", isExist)
  }
}

main()
  .then((data) => data)
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
