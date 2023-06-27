const { getBigNumber } = require("./shared/utilities")
const { UNO, xUNO } = require("./shared/constants")

module.exports = [
  process.env.NEW_FROM_ADDRESS, // operator
  UNO.goerli, // mockUSDT
  "0x2e53ec5fC8D47fDe14dEb7Ee221a124474e342B7", // pool
]

// 0x0000000000000000000000000000000000000000
