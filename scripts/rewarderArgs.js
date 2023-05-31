const { getBigNumber } = require("./shared/utilities")
const { UNO } = require("./shared/constants")

module.exports = [
  process.env.NEW_FROM_ADDRESS, // operator
  UNO.goerli, // mockUSDT
  "0x73b15F31569449D81AF0Cde34c78B184f73EbD62", // pool
]

// 0x0000000000000000000000000000000000000000
