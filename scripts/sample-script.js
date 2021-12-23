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
} = require("./shared/utilities")
const SALESPOLICY_ABI = require("../scripts/abis/SalesPolicy.json")

const mockUSDT_ADDRESS = "0x40c035016AD732b6cFce34c3F881040B6C6cf71E"
const mockUSDC_ADDRESS = "0xD4D5c5D939A173b9c18a6B72eEaffD98ecF8b3F6"
const SALESPOLICY_ADDRESS = "0x4cAc3f667d1aFB053984CBe39215D35D27017717"
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
  const signers = await ethers.getSigners()

  const currentDate = new Date()
  const timestamp = Math.floor(new Date(currentDate.setTime(currentDate.getTime())).getTime() / 1000)

  const privateKey = process.env.PRIVATE_KEY

  const policyPrice = getBigNumber(100, 6)
  const coverageDuration = BigNumber.from(24 * 3600 * 30)
  const coverageAmount = getBigNumber(100000)
  const deadline = getBigNumber(1639767070, 0)

  const jsonRpcProvider = new ethers.providers.JsonRpcProvider(hre.config.networks.rinkeby.url)

  const biconomy = new Biconomy(jsonRpcProvider, { apiKey: process.env.BICONOMY_API_KEY, debug: true })
  const ethersProvider = new ethers.providers.Web3Provider(biconomy)
  let wallet = new ethers.Wallet(privateKey)

  biconomy
    .onEvent(biconomy.READY, async () => {
      console.log("biconomy ready")
    })
    .onEvent(biconomy.ERROR, (error, message) => {
      console.log("message", message)
      console.log("error", error)
    })

  const salesPolicyInterface = new ethers.utils.Interface(SALESPOLICY_ABI)
  const salesPolicy = new ethers.Contract(SALESPOLICY_ADDRESS, SALESPOLICY_ABI, biconomy.getSignerByAddress(signers[0].address))

  // console.log("[biconomy]", ethers.provider)

  const chainId = await getChainId()

  const domainData = {
    name: "BuyPolicyMetaTransaction",
    version: "1",
    verifyingContract: SALESPOLICY_ADDRESS,
    salt: getPaddedHexStrFromBN(4),
  }

  console.log(zeroAddress.toString(), deadline.toString())

  const functionSignature = salesPolicyInterface.encodeFunctionData("buyPolicy", [
    coverageAmount,
    coverageDuration,
    policyPrice,
    deadline,
    zeroAddress,
  ])

  const nonce = await salesPolicy.getNonce(signers[0].address)

  const message = {
    nonce: nonce.toNumber(),
    from: signers[0].address,
    functionSignature: functionSignature,
  }

  const dataToSign = {
    types: {
      EIP712Domain: domainType,
      MetaTransaction: metaTransactionType,
    },
    domain: domainData,
    primaryType: "MetaTransaction",
    message: message,
  }

  const signature = sigUtil.signTypedMessage(new Buffer.from(privateKey, "hex"), { data: dataToSign }, "V3")
  let { r, s, v } = getSignatureParameters(signature)

  let rawTx, tx
  rawTx = {
    to: SALESPOLICY_ADDRESS,
    data: salesPolicyInterface.encodeFunctionData("executeMetaTransaction", [signers[0].address, functionSignature, r, s, v]),
    from: signers[0].address,
    value: getBigNumber(1),
    gasLimit: 1000000,
  }
  tx = await wallet.signTransaction(rawTx)

  let transactionHash
  try {
    let receipt = await ethersProvider.sendTransaction(tx)
    console.log(receipt)
  } catch (error) {
    if (error.returnedHash && error.expectedHash) {
      console.log("Transaction hash : ", error.returnedHash)
      transactionHash = error.returnedHash
    } else {
      console.log("[Error while sending transaction]", error)
    }
  }

  if (transactionHash) {
    let receipt = await ethersProvider.waitForTransaction(transactionHash)
    console.log(receipt)
  } else {
    console.log("Could not get transaction hash")
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
