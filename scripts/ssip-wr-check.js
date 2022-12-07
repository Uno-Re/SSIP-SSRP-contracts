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
const capitalAgentAddress = "0x62e1D28f3204962852976983cD575Fc2741bfE19" //"0x75298ca41f347Ab468f01BDdDA20057603b3AA4d"
const exchangeAgentAddress = "0x87e1f628225c170a5C0Bf895580686430DEb3322"
const riskPoolFactoryAddress = "0xc743508A6AD19c31Aff110778EFDE0867E4cEf08"
const rewarderFactoryAddress = "0xA722FdFBbECdadB79aB27aAE388015dC4FACF6Ca"
const USDC = "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
const UNO = "0x474021845c4643113458ea4414bdb7fb74a01a77"

async function main() {
  const withdrawRequests = [
    {
      id: "0x05cf171bbe643fc86deb5455f5e47bf138a94011e17f58dc474aaaf17842f8fb-0",
      timestamp: "1656800713",
      staker: "0xb760c246db7eee48169c729d0394a7773be6a376",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "6545.844",
    },
    {
      id: "0x0f0bdcc9cedded3113665bf51f4fbfd1b436596df5dec29b8b8235b9ead8a07f-0",
      timestamp: "1667677751",
      staker: "0x58ce345c4bf081ed7416891af702cadde68b79bc",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "1415.963",
    },
    {
      id: "0x15744e4c44d3631473000cc286ffd710a8b07ccd60f4d9f8daca0615de6214d5-0",
      timestamp: "1663362839",
      staker: "0xb6fdb46b940c7c14aa4a3a00c511744f1773170d",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "7186.716",
    },
    {
      id: "0x17b9cb9e98b5886f9bcb39457a745ce6ffe117ec52090e6a2f241ac9734a3871-0",
      timestamp: "1668060935",
      staker: "0x2bf674b122d8a5b1219466c8a1dab91adc1b637f",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "5323.485",
    },
    {
      id: "0x28ec51096d7a1618e4164f2f99f23f2258e1a4c4e3c3dec077dd66ba9bb30cfa-0",
      timestamp: "1657534288",
      staker: "0xf9d9f774dc908c8d817b736cdd4d8bd6c4babf79",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "706.976",
    },
    {
      id: "0x2a163946605d643c708fcff4496af071be5c55f767c4317feaefef523285b056-0",
      timestamp: "1656619633",
      staker: "0xd7bb739060a742dd147168aba4f1b7c304759617",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "871.66",
    },
    {
      id: "0x3c4ad7c7a214146f5b8ffdfa74bf989fbb1bdb663c15e8ed4c162f78b04aab47-0",
      timestamp: "1668061979",
      staker: "0x9cb016669c235ccebcd2fbbffa2d8d3a2247b02c",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "2000",
    },
    {
      id: "0x3e6702551adfb576276aa888f8dd468b7f2e55e5e7470aaadff7538d0a183a19-0",
      timestamp: "1666596167",
      staker: "0x197f4c3cc2c89a0f4c4e2443c453f29ecdf67d4b",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "20000",
    },
    {
      id: "0x50c8f6f7f76e23afbf8b9cfd2f1f639d9a2ca9d605ed4165b41e8ae4db9756c2-0",
      timestamp: "1658497986",
      staker: "0xc7e318811aac4e3975bf49d6a7c6fbc82d2305a7",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "5000",
    },
    {
      id: "0x5733dcce63e82f917c7a3cbe47b514efee401ca3e282e083d32c7529ef080550-0",
      timestamp: "1662306397",
      staker: "0xcb6222f4df04385ea08e8da2a5871131ff5f6cba",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "100",
    },
    {
      id: "0x75fd7eb75d1ad2dc75d019fc63c9ebfbf954e90c8cf70f72883a96353da0f0ff-0",
      timestamp: "1669004843",
      staker: "0xce9c78fc31a962bacc1379c42ca692d1bb47f16f",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "606.715",
    },
    {
      id: "0x7affcd05ba0ebdd2998ed046e6e2fe452a93aa32af6a342c0025a657d9150dd9-0",
      timestamp: "1657190340",
      staker: "0x9a772e93e04714e3197c5584375ed50e672f0e8a",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "1.001",
    },
    {
      id: "0xca3b9b69160a00f9c0aea2a2bbb9826733fa0cc766c273ca098d56ed5084462b-0",
      timestamp: "1660026039",
      staker: "0x44d142fa5ead699cb550ca9d2ab0022b74853362",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "3000",
    },
    {
      id: "0xd59cdd0a1e9930047b6c1496dc41396ffb45fd810301eea7b679c83a448de9e6-0",
      timestamp: "1659050427",
      staker: "0xb760c246db7eee48169c729d0394a7773be6a376",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "7740.063",
    },
    {
      id: "0xe68af5f0bec9264ab74d5c1526c70df35cb51ac8404086823304c7ecfec672b7-0",
      timestamp: "1668848987",
      staker: "0x29a205deb97a439f10a916c6ae00ff0080d68256",
      pool: "0xfdfaa453ef3709d2c26ecf43786a14ab8bf27e36",
      requestAmount: "10002.006",
    },
  ]
  const withdraws = [
    {
      id: "0x18471a0a748ca1613d5cb0a9ed0d659d5d6e6cca50c4cf3e648729e5d4020531-0",
      timestamp: "1659927632",
      user: "0xb760c246db7eee48169c729d0394a7773be6a376",
      unoAmount: "7740.063",
    },
    {
      id: "0x2249a39da04eb5001b5339d49b01fff120238f09d0ca9cd72c0ecc65482421d6-0",
      timestamp: "1659161965",
      user: "0xf9d9f774dc908c8d817b736cdd4d8bd6c4babf79",
      unoAmount: "706.976",
    },
    {
      id: "0x2d492a7609f1d853782a0980c689bf2b3b76b9f1f2f3d9b0588333360d4375ce-0",
      timestamp: "1664594591",
      user: "0x44d142fa5ead699cb550ca9d2ab0022b74853362",
      unoAmount: "3000",
    },
    {
      id: "0x6e26ad7a8505afce3bfc11496abc23d83aaa1f5398358732a2fb0538f5fda159-0",
      timestamp: "1657485338",
      user: "0xd7bb739060a742dd147168aba4f1b7c304759617",
      unoAmount: "871.66",
    },
    {
      id: "0x83441adf45de43caa952993ebc103e399e29f09b444dc17e03e55694d9c0b93f-0",
      timestamp: "1659363148",
      user: "0xc7e318811aac4e3975bf49d6a7c6fbc82d2305a7",
      unoAmount: "5000",
    },
    {
      id: "0x834fb952d20a17fee1ec610c23f5cd0a94e3ec5d623050c1d9e2321c9b57452e-0",
      timestamp: "1664228027",
      user: "0xb6fdb46b940c7c14aa4a3a00c511744f1773170d",
      unoAmount: "7186.716",
    },
    {
      id: "0x8e72613db82282d1a2e2d176dd94f0b9532ef4e8d05f1370abcdca1d2487c930-0",
      timestamp: "1663660319",
      user: "0xcb6222f4df04385ea08e8da2a5871131ff5f6cba",
      unoAmount: "100",
    },
    {
      id: "0xa922391c423c723fc7a6ffed5e32c42056172082cf7e2c3ea09d08e2bfa0b3c9-0",
      timestamp: "1667460587",
      user: "0x197f4c3cc2c89a0f4c4e2443c453f29ecdf67d4b",
      unoAmount: "20000",
    },
    {
      id: "0xc98e3750665a340ae20629ba4e33141b7d24e8a44dd415d6db16899619ee6069-0",
      timestamp: "1669004627",
      user: "0x58ce345c4bf081ed7416891af702cadde68b79bc",
      unoAmount: "1415.963",
    },
    {
      id: "0xe4a9a66921214c71b38b2f375acf84b22bb6aa2d0db58b3d65b44c16a3386193-0",
      timestamp: "1657681920",
      user: "0xb760c246db7eee48169c729d0394a7773be6a376",
      unoAmount: "6545.844",
    },
    {
      id: "0xe68eda51157dc367b0eb01f6d64a899cebf4b2d0125ea7e3bb535a12a956250a-0",
      timestamp: "1669005647",
      user: "0x9cb016669c235ccebcd2fbbffa2d8d3a2247b02c",
      unoAmount: "2000",
    },
  ]

  const pendingWR = withdrawRequests.filter((item) => {
    const f = withdraws.find((w) => w.user === item.staker && Number(w.unoAmount) === Number(item.requestAmount))
    if (f === undefined) return true
    else false
  })
  console.log("[check withdraw requests matched]", pendingWR, pendingWR.length)

  const totalPendingWR = pendingWR?.reduce((total, item) => total + Number(item.requestAmount), 0)

  console.log("[check total pending withdraw request amount]", totalPendingWR)

  const oldPendingWR = pendingWR.filter((item) => {
    const d = new Date()
    const currentTimestamp = Math.floor(d.getTime() / 1000)
    const oneMonth = 3600 * 24 * 30
    return currentTimestamp - Number(item.timestamp) >= oneMonth
  })
  console.log("[check old withdraw requests matched]", oldPendingWR, oldPendingWR.length)

  const oldTotalPendingWR = oldPendingWR?.reduce((total, item) => total + Number(item.requestAmount), 0)
  console.log("[check old total pending withdraw request amount]", oldTotalPendingWR)
}
// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
