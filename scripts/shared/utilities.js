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
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals))
}

function getNumber(amount, decimals = 18) {
  return BigNumber.from(amount).div(BigNumber.from(10).pow(decimals)).toNumber()
}

function getPaddedHexStrFromBN(bn) {
  const hexStr = ethers.utils.hexlify(bn)
  return ethers.utils.hexZeroPad(hexStr, 32)
}

function getPaddedHexStrFromBNArray(bnArray) {
  let hexData;
  for(let k = 0; k < bnArray.length; k++) {
    const hexStr = ethers.utils.hexlify(bnArray[k])
    if(k !== 0) {
      hexData += ethers.utils.hexZeroPad(hexStr, 32).slice(2);
    } else {
      hexData = ethers.utils.hexZeroPad(hexStr, 32);
    }
  }
  return hexData;
}

function getHexStrFromStr(str) {
  const strBytes = ethers.utils.toUtf8Bytes(str)
  return ethers.utils.hexlify(strBytes)
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
  if (!ethers.utils.isHexString(signature)) {
    throw new Error('Given value "'.concat(signature, '" is not a valid hex string.'))
  }
  var r = signature.slice(0, 66)
  var s = "0x".concat(signature.slice(66, 130))
  var v = "0x".concat(signature.slice(130, 132))
  v = ethers.BigNumber.from(v).toNumber()
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
