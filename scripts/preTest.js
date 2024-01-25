const { ethers } = require("hardhat")
const {
  getBigNumber,
  getNumber,
  getHexStrFromStr,
  getPaddedHexStrFromBN,
  getPaddedHexStrFromBNArray,
  getChainId,
  getSignatureParameters,
  advanceBlockTo,
} = require("./shared/utilities")

const { assert } = require("chai")


async function main() {
  this.signers = await ethers.getSigners()
  // ---------------------- Get Contracts ----------------------------------
  const salesPolicy = await ethers.getContractAt("SalesPolicy", "0x95103425deC1ACF52b440B12853c0ACf3F090E93")
  let hexData
  const currentDate = new Date()
  const timestamp = Math.floor(currentDate.getTime() / 1000)
  const privateKey = process.env.PRIVATE_KEY
  this.chainId = (await ethers.provider.getNetwork()).chainId
  // const protocol = await this.salesPolicyFactory.getProtocol(1)

  const assets = ["0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620", "0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620"]
      const policyPrice = getBigNumber("300", 6)
      const protocols = ["0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620", "0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620"]
      const coverageDuration = [getBigNumber(`${24 * 3600 * 30}`, 1), getBigNumber(`${24 * 3600 * 15}`, 1)]
      const coverageAmount = [getBigNumber("100", 6), getBigNumber("100", 6)]
      const deadline = getBigNumber(`${timestamp - 7 * 3600}`, 0)
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
        "0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620".slice(2) +
        paddedNonceHexStr.slice(2) +
        salesPolicy.target.slice(2) +
        paddedChainId.slice(2)


      const flatSig = await this.signers[0].signMessage(ethers.getBytes(ethers.keccak256(hexData)))
      const splitSig = ethers.Signature.from(flatSig)

      const chainId = 5
      console.log(chainId, "chainId")
      const functionSignature = salesPolicy.interface.encodeFunctionData("buyPolicy", [
        assets,
        protocols,
        coverageAmount,
        coverageDuration,
        policyPrice,
        deadline,
        "0xB6b67A0b6B3e627d9e9aD6232c1CEf3cBb719620",
        splitSig.r,
        splitSig.s,
        splitSig.v,
        nonce
      ])

      const domainData = {
        name: "BuyPolicyMetaTransaction",
        version: "1",
        verifyingContract: salesPolicy.target,
        salt: getPaddedHexStrFromBN(chainId),
      }

      const types = {
        MetaTransaction: [
          { name: "nonce", type: "uint256" },
          { name: "from", type: "address" },
          { name: "functionSignature", type: "bytes" },
        ]
      }

      const nonce1 = await salesPolicy.getNonce(this.signers[1].address)
      const message = {
        nonce: Number(nonce1),
        from: this.signers[1].address,
        functionSignature: functionSignature,
      }

      // const premiumPoolBalanceBefore = await this.mockUSDT.balanceOf(this.premiumPool.target)
      // expect(premiumPoolBalanceBefore).to.equal(0)

      const signature = await this.signers[1].signTypedData(domainData, types, message);

      let { r, s, v } = getSignatureParameters(signature)
      // try {
        let tx = await salesPolicy.executeMetaTransaction(this.signers[1].address, functionSignature, r, s, v, {
          gasLimit: 1000000,
        })
  
      console.log(tx);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
