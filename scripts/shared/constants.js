const WETH_ADDRESS = {
  sepolia: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // this is WETH address in Uniswap router 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D on sepolia
}

const UNISWAP_FACTORY_ADDRESS = {
  sepolia: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
}

const UNISWAP_ROUTER_ADDRESS = {
  sepolia: "0xc532a74256d3db42d0bf7a0400fefdbad7694008",
}

const TWAP_ORACLE_PRICE_FEED_FACTORY = {
  sepolia: "0x18Ca744fd1960d9Dda0Af5E22CC5C92aD75901E8",
}

const UNO = {
  sepolia: "0xF75C8E49831c055a88957adbc97450f778460FD9",
}

const USDT = {
  sepolia: "0xdb2587DEb089c8f914BA6FeDf1E3d3Cb8660A015",
}

const UNO_USDT_PRICE_FEED = {
  sepolia: "0x18Ca744fd1960d9Dda0Af5E22CC5C92aD75901E8",
}

//Helper link to UMA deployment contract addresses on sepolia: https://github.com/UMAprotocol/protocol/blob/master/packages/core/networks/11155111.json

const OPTIMISM_ORACLE_V3 = {
  sepolia: "0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944",
}

const ADDRESS_WHITELIST_UMA = {
  sepolia: "0xE8DE4bcE27f6214dcE18D8a7629f233C66A97B84",
}

const MOCK_ORACLE_ANCILLARY = {
  sepolia: "0x5FE28AEa36420414692b1C907F7d0114d304eb0C",
}

const STORE_UMA = {
  sepolia: "0x39e7FFA77A4ac4D34021C6BbE4C8778d47F684F2",
}

module.exports = {
  WETH_ADDRESS,
  UNISWAP_FACTORY_ADDRESS,
  UNISWAP_ROUTER_ADDRESS,
  TWAP_ORACLE_PRICE_FEED_FACTORY,
  UNO,
  USDT,
  UNO_USDT_PRICE_FEED,
  OPTIMISM_ORACLE_V3,
  ADDRESS_WHITELIST_UMA,
  MOCK_ORACLE_ANCILLARY,
  STORE_UMA,
}
