require("hardhat-deploy")
require("hardhat-deploy-ethers")
require("hardhat-contract-sizer")
require("hardhat-gas-reporter")
require("@openzeppelin/hardhat-upgrades")
require("@nomicfoundation/hardhat-ethers")
require("@nomicfoundation/hardhat-verify")
require("@nomicfoundation/hardhat-foundry")
require("@nomicfoundation/hardhat-chai-matchers")
require("dotenv").config()

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const accounts = {
  mnemonic: process.env.MNEMONIC || "test test test test test test test test test test test junk",
  // accountsBalance: "990000000000000000000",
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork: "hardhat",
  gasReporter: {
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    currency: "USD",
    enabled: true,
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
      // hardfork: "london",
      allowUnlimitedContractSize: true,
      evmVersion: "byzantium",
      forking: {
        url: "https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp",
        //url: "https://bnb.rpc.subquery.network/public",
        // url: 'https://eth-mainnet.alchemyapi.io/v2/kX2m_40xGyLvewVGbo7JaAe6mZTha838',
        enabled: true,
        //blockNumber: 36927257 //7041459 //6430278 //7041458 //6615559 10207859 11869355
      },
      gasPrice: "auto",
      accounts,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.MAINNET_INFURA_KEY}`,
      accounts,
      chainId: 1,
      live: false,
      saveDeployments: true,
    },
    bscTest: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts,
      live: true,
      saveDeployments: true,
      gasMultiplier: 2,
    },
    bscMain: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts,
      live: true,
    },

    sepolia: {
      url: process.env.SEPOLIA_URL,
      accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
    },
    rolluxTestnet: {
      url: process.env.ROLLUXTEST_URL,
      accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
      allowUnlimitedContractSize: true,
      saveDeployments: true,
    },
    rolluxMainnet: {
      url: process.env.ROLLUXMAIN_URL,
      accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
      allowUnlimitedContractSize: true,
      saveDeployments: true,
      evmVersion: "paris",
    },
  },
  etherscan: {
    apiKey: {
      rolluxMainnet: "abc",
      rolluxTestnet: "abc",
      tanenbaum: "abc",
      syscoin: "abc",
      bscMain: process.env.API_KEY, // BSC_API_KEY
      sepolia: process.env.API_SEP,
    },
    customChains: [
      {
        network: "rolluxMainnet",
        chainId: 570,
        urls: {
          apiURL: "https://explorer.rollux.com/api",
          browserURL: "https://explorer.rollux.com",
        },
      },
      {
        network: "rolluxTestnet",
        chainId: 57000,
        urls: {
          apiURL: "https://rollux.tanenbaum.io/api",
          browserURL: "https://rollux.tanenbaum.io",
          saveDeployments: true,
        },
      },
      {
        network: "tanenbaum",
        chainId: 5700,
        urls: {
          apiURL: "https://tanenbaum.io/api",
          browserURL: "https://tanenbaum.io",
        },
      },
      {
        network: "syscoin",
        chainId: 57,
        urls: {
          apiURL: "https://explorer.syscoin.org/api/eth-rpc",
          browserURL: "https://explorer.syscoin.org",
        },
      },
    ],
  },
  paths: {
    deploy: "deploy",
    deployments: "deployments",
    sources: "contracts",
    tests: "test",
  },
  mocha: {
    timeout: 300000,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: true,
    runOnCompile: true,
  },
  solidity: {
    compilers: [
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.7.6",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
}