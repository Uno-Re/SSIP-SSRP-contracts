const fs = require("fs")
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
const SALESPOLICY_ABI = require("../scripts/abis/SalesPolicy.json")

const mockUSDT_ADDRESS = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
// const mockUSDC_ADDRESS = "0xD4D5c5D939A173b9c18a6B72eEaffD98ecF8b3F6"
const SALESPOLICY_ADDRESS = "0xD7ce18716f8f9Ff15BD31E4edca51C3a51310c41"
const zeroAddress = ethers.constants.AddressZero

const domainType = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
]
const metaTransactionType = [
  { name: "nonce", type: "uint256" },
  { name: "from", type: "address" },
  { name: "functionSignature", type: "bytes" },
]

async function main() {
  let hexData
  const MockUSDT = await ethers.getContractFactory("MockUSDT")
  const mockUSDT = await MockUSDT.attach(mockUSDT_ADDRESS)
  await (await mockUSDT.approve(SALESPOLICY_ADDRESS, getBigNumber(100000000))).wait()

  const SalesPolicy = await ethers.getContractFactory("SalesPolicy")
  const salesPolicy = await SalesPolicy.attach(SALESPOLICY_ADDRESS)

  const signers = await ethers.getSigners()

  const currentDate = new Date()
  const timestamp = Math.floor(new Date(currentDate.setTime(currentDate.getTime())).getTime() / 1000)

  const privateKey = process.env.PRIVATE_KEY

  const policyPrice = getBigNumber(300, 6)
  const protocols = [signers[0].address, signers[1].address]
  const coverageDuration = [BigNumber.from(24 * 3600 * 30), BigNumber.from(24 * 3600 * 15)]
  const coverageAmount = [getBigNumber(100, 6), getBigNumber(100, 6)]
  const deadline = getBigNumber(timestamp - 7 * 3600, 0)

  const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
  const paddedProtocolsHexStr =
    "000000000000000000000000" + protocols[0].slice(2) + "000000000000000000000000" + protocols[1].slice(2)
  const paddedCoverageDurationHexStr = getPaddedHexStrFromBNArray(coverageDuration)
  const paddedCoverageAmountHexStr = getPaddedHexStrFromBNArray(coverageAmount)
  const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)

  hexData =
    "0x" +
    paddedPolicyPriceHexStr.slice(2) +
    paddedProtocolsHexStr +
    paddedCoverageDurationHexStr.slice(2) +
    paddedCoverageAmountHexStr.slice(2) +
    paddedDeadlineHexStr.slice(2) +
    mockUSDT_ADDRESS.slice(2)

  for (const account of signers) {
    console.log("[signer]", account.address)
  }
  const flatSig = await signers[1].signMessage(ethers.utils.arrayify(ethers.utils.keccak256(hexData)))
  const splitSig = ethers.utils.splitSignature(flatSig)

  await (
    await salesPolicy.buyPolicy(
      protocols,
      coverageAmount,
      coverageDuration,
      policyPrice,
      deadline,
      mockUSDT_ADDRESS,
      splitSig.r,
      splitSig.s,
      splitSig.v,
    )
  ).wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
