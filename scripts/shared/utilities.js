const { ethers } = require("hardhat")
const { BigNumber } = ethers

function getCreate2CohortAddress(actuaryAddress, { cohortName, sender, nonce }, bytecode) {
  const create2Inputs = [
    "0xff",
    actuaryAddress,
    ethers.utils.keccak256(ethers.utils.solidityPack(["address", "string", "uint"], [sender, cohortName, nonce])),
    ethers.utils.keccak256(bytecode),
  ]
  const sanitizedInputs = `0x${create2Inputs.map((i) => i.slice(2)).join("")}`

  return ethers.utils.getAddress(`0x${ethers.utils.keccak256(sanitizedInputs).slice(-40)}`)
}

// Defaults to e18 using amount * 10^18
function getBigNumber(amount, decimals = 18) {
  return ethers.parseUnits(amount, decimals)
}

function getNumber(amount, decimals = 18) {
  return Number(ethers.formatUnits(amount, decimals))
}

function getPaddedHexStrFromBN(bn) {
  console.log(bn);
  const hexStr = ethers.toBeHex(bn)
  return ethers.zeroPadValue(hexStr, 32)
}

function getPaddedHexStrFromBNArray(bnArray) {
  let hexData
  for (let k = 0; k < bnArray.length; k++) {
    const hexStr = ethers.toBeHex(bnArray[k])
    if (k !== 0) {
      hexData += ethers.zeroPadValue(hexStr, 32).slice(2)
    } else {
      hexData = ethers.zeroPadValue(hexStr, 32)
    }
  }
  return hexData
}

function getHexStrFromStr(str) {
  const strBytes = ethers.utils.toUtf8Bytes(str)
  return ethers.toBeHex(strBytes)
}

async function advanceBlock() {
  return ethers.provider.send("evm_mine", [])
}

async function advanceBlockTo(blockNumber) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

async function getChainId() {
  console.log(await hre.config.networks.hardhat.chainId)
  return await hre.config.networks.hardhat.chainId
}

const getSignatureParameters = (signature) => {
  if (!ethers.isHexString(signature)) {
    throw new Error('Given value "'.concat(signature, '" is not a valid hex string.'))
  }
  var r = signature.slice(0, 66)
  var s = "0x".concat(signature.slice(66, 130))
  var v = "0x".concat(signature.slice(130, 132))
  v = Number(BigInt(v))
  if (![27, 28].includes(v)) v += 27
  return {
    r: r,
    s: s,
    v: v,
  }
}

const constructMetaTransactionMessage = (nonce, salt, functionSignature, contractAddress) => {
  return abi.soliditySHA3(["uint256", "address", "uint256", "bytes"], [nonce, contractAddress, salt, toBuffer(functionSignature)])
}

module.exports = {
  getCreate2CohortAddress,
  getBigNumber,
  getNumber,
  getPaddedHexStrFromBN,
  getPaddedHexStrFromBNArray,
  getHexStrFromStr,
  advanceBlock,
  advanceBlockTo,
  getChainId,
  getSignatureParameters,
  constructMetaTransactionMessage,
}
