const { ethers } = require("hardhat")
require("dotenv").config()

const { getPaddedHexStrFromBN, getPaddedHexStrFromBNArray, getSignatureParameters } = require("./shared/utilities")

const { assert } = require("chai")

async function main() {
  this.signers = await ethers.getSigners()
  // ---------------------- Get Contracts ----------------------------------
  const salesPolicy = await ethers.getContractAt("SalesPolicy", process.env.SALESPOLICY)

  let hexData
  this.chainId = (await ethers.provider.getNetwork()).chainId

  const assets = process.env.ASSETS
  const policyPrice = process.env.POLICY_PRICE
  const protocols = process.env.PROTOCOLS
  const coverageDuration = process.env.COVERAGE_DURATION
  const coverageAmount = process.env.COVERAGE_AMOUNT
  const deadline = process.env.DEADLINE
  const nonce = await salesPolicy.getNonce(this.signers[0].address)

  const paddedPolicyPriceHexStr = getPaddedHexStrFromBN(policyPrice)
  const paddedProtocolsHexStr =
    "000000000000000000000000" + protocols[0].slice(2) + "000000000000000000000000" + protocols[1].slice(2)
  const paddedCoverageDurationHexStr = getPaddedHexStrFromBNArray(coverageDuration)
  const paddedCoverageAmountHexStr = getPaddedHexStrFromBNArray(coverageAmount)
  const paddedDeadlineHexStr = getPaddedHexStrFromBN(deadline)
  const paddedNonceHexStr = getPaddedHexStrFromBN(nonce)
  const paddedChainId = getPaddedHexStrFromBN(this.chainId)

  hexData =
    "0x" +
    paddedPolicyPriceHexStr.slice(2) +
    paddedProtocolsHexStr +
    paddedCoverageDurationHexStr.slice(2) +
    paddedCoverageAmountHexStr.slice(2) +
    paddedDeadlineHexStr.slice(2) +
    process.env.PREMIUM_CURRENCY.slice(2) +
    paddedNonceHexStr.slice(2) +
    salesPolicy.target.slice(2) +
    paddedChainId.slice(2)

  const flatSig = await this.signers[0].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
  const splitSig = ethers.Signature.from(flatSig)

  // const chainId =
  const functionSignature = salesPolicy.interface.encodeFunctionData("buyPolicy", [
    assets,
    protocols,
    coverageAmount,
    coverageDuration,
    policyPrice,
    deadline,
    process.env.PREMIUM_CURRENCY,
    splitSig.r,
    splitSig.s,
    splitSig.v,
    nonce,
  ])

  const domainData = {
    name: "BuyPolicyMetaTransaction",
    version: "1",
    verifyingContract: salesPolicy.target,
    salt: getPaddedHexStrFromBN(this.chainId),
  }

  const types = {
    MetaTransaction: [
      { name: "nonce", type: "uint256" },
      { name: "from", type: "address" },
      { name: "functionSignature", type: "bytes" },
    ],
  }

  const nonce1 = await salesPolicy.getNonce(this.signers[1].address)
  const message = {
    nonce: Number(nonce1),
    from: this.signers[1].address,
    functionSignature: functionSignature,
  }

  const signature = await this.signers[1].signTypedData(domainData, types, message)

  let { r, s, v } = getSignatureParameters(signature)

  let tx = await salesPolicy.executeMetaTransaction(this.signers[1].address, functionSignature, r, s, v, {
    gasLimit: 1000000,
  })

  console.log(tx)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
