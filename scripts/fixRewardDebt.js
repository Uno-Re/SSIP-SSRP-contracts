const fs = require("fs")
const path = require('path');
const { ethers, network } = require("hardhat")
const hre = require("hardhat")

const addressList = {
  ssrp: "0x87e1f628225c170a5C0Bf895580686430DEb3322",
  selene: "0x1342b3dAec4f54F5Af01Aaa34839626f959B362a",
  ares: "0x82E107d2b1Be4347b55FBba4a6fB99669dF3ceb1",
  hercules: "0xa476b3F7333796D4565a3D3666D54cF8557F0169",
  aphrodite: "0x72D1B61B1723900f64d041a80fe4f114d3F0942a",
  zeus: "0xBD1105Ce524828f15d7da3CAF098c8E42D0Fbf31",
  aresBSC: "0xbb5fe2d69694b44a64151eaF07199eF8420685dD"
}

async function main() {
  const SSIP = await ethers.getContractFactory("SingleSidedInsurancePool")
  const REWARDER = await ethers.getContractFactory("Rewarder")
  const ssip = await SSIP.attach(addressList.aresBSC)
  const rewarderAddress = await ssip.rewarder()
  const rewarder = await REWARDER.attach(rewarderAddress)


  // const data = fs.readFileSync('scripts/shared/ssrp_holders.csv')
  // console.log('[holders check]', data)
  const data = fs.readFileSync(path.resolve(__dirname, 'shared', 'aresBSC_holders.csv'), { encoding: 'utf8' })
  const holderList = data.split("\r\n")
  for (let i in holderList) {
    if (Number(i) === 0) continue
    // if (Number(i) <= 23) continue
    const t = holderList[i].split(",")
    if (t[0] === '') continue
    const holder = t[0].split('"')[1]
    // console.log('[holders check]', ethers.utils.getAddress(holder.toString()))
    const userInfo = await ssip.userInfo(ethers.utils.getAddress(holder.toString()))
    const rewardDebtOnSSIP = userInfo.rewardDebt
    const rewardDebtOnRewarder = await rewarder.userRewardDebt(ethers.utils.getAddress(holder.toString()))
    if (rewardDebtOnRewarder.gt(rewardDebtOnSSIP)) {
      console.log('[invalid reward debt on reward check ====>]', i, holder, rewardDebtOnSSIP.toString(), rewardDebtOnRewarder.toString())
    } else {
      console.log('[reward debt on reward and ssip check ====>]', i, holder, rewardDebtOnSSIP.toString(), rewardDebtOnRewarder.toString())
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
