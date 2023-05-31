const { utils } = require("ethers");

require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter")
require('dotenv').config();

const accounts = [
  { privateKey: process.env.NEW_PRIVATE_KEY, balance: '990000000000000000000' },
  { privateKey: "0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110", balance: '990000000000000000000' },
  { privateKey: "0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3", balance: '990000000000000000000' },
  { privateKey: "0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e", balance: '990000000000000000000' },
  { privateKey: "0x850683b40d4a740aa6e745f889a6fdc8327be76e122f5aba645a5b02d0248db8", balance: '990000000000000000000' },
  { privateKey: "0xf12e28c0eb1ef4ff90478f6805b68d63737b7f33abfa091601140805da450d93", balance: '990000000000000000000' },
  { privateKey: "0xe667e57a9b8aaa6709e51ff7d093f1c5b73b63f9987e4ab4aa9a5c699e024ee8", balance: '990000000000000000000' },
  { privateKey: "0x28a574ab2de8a00364d5dd4b07c4f2f574ef7fcc2a86a197f65abaec836d1959", balance: '990000000000000000000' },
  { privateKey: "0x74d8b3a188f7260f67698eb44da07397a298df5427df681ef68c45b34b61f998", balance: '990000000000000000000' },
  { privateKey: "0xbe79721778b48bcc679b78edac0ce48306a8578186ffcb9f2ee455ae6efeace1", balance: '990000000000000000000' },
]

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: 'hardhat',
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    enabled: true
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    dev: {
      default: 1,
    },
  },
  networks: {
    hardhat: {
      hardfork: "london",
      allowUnlimitedContractSize: true,
      settings: {
        optimizer: {
          enabled: true,
          runs: 9999,
        },
      },
      evmVersion: "byzantium",
      forking: {
        url: 'https://eth-goerli.g.alchemy.com/v2/krGbj11v1ZXel2O_tMIlBIyPiBFhChyU',
        // url: 'https://eth-rinkeby.alchemyapi.io/v2/8SAQa7xMc0VXTR_hyfPvAt2pe3QrXybB',
        // url: 'https://eth-mainnet.alchemyapi.io/v2/kX2m_40xGyLvewVGbo7JaAe6mZTha838',
        enabled: false,
        // blockNumber: 7041459 //6430278 //7041458 //6615559 10207859 11869355        
      },
      gasPrice: "auto",
      accounts
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.NEW_PRIVATE_KEY],
      chainId: 1,
      live: false,
      saveDeployments: true
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      // url: `https://rpc.ankr.com/eth_goerli`,
      // url: `https://goerli.blockpi.network/v1/rpc/public`,
      accounts: [process.env.NEW_PRIVATE_KEY],
      chainId: 5,
      live: false,
      saveDeployments: true,
      tags: ["staging"],
      // gasPrice: 100000000000,
      // gas: 1100000,
      gasMultiplier: 2
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.NEW_PRIVATE_KEY],
      chainId: 4,
      live: false,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    bscTest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [process.env.NEW_PRIVATE_KEY],
      live: true,
      saveDeployments: true,
      gasMultiplier: 2,
    },
    bscMain: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: [process.env.NEW_PRIVATE_KEY],
      live: true,
      saveDeployments: true
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY // BSC_API_KEY
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
    sources: "contracts",
    tests: "test"
  },
  mocha: {
    timeout: 300000
  },
  // contractSizer: {
  //   alphaSort: true,
  //   disambiguatePaths: true,
  //   runOnCompile: true
  // },
  solidity: {
    version: "0.8.0",
    settings: {
      optimizer: {
        enabled: true,
        runs: 800
      }
    }
  }
};
