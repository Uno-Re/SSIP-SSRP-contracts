const { utils } = require("ethers");

require("@nomiclabs/hardhat-waffle");
require("hardhat-deploy");
require("hardhat-deploy-ethers");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter")
require('dotenv').config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

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
      // hardfork: "london",
      allowUnlimitedContractSize: true,
      settings: {
        optimizer: {
          enabled: true,
          runs: 9999,
        },
      },
      // evmVersion: "byzantium",
      forking: {
        // url: 'https://eth-rinkeby.alchemyapi.io/v2/8SAQa7xMc0VXTR_hyfPvAt2pe3QrXybB',
        // url: 'https://evm.evm-alpha.kava.io',
        url: 'https://evm.kava.io',
        // url: 'https://eth-mainnet.alchemyapi.io/v2/kX2m_40xGyLvewVGbo7JaAe6mZTha838',
        enabled: true,
        // blockNumber: 7041459 //6430278 //7041458 //6615559 10207859 11869355        
      },
      gasPrice: "auto",
      accounts
    },
    kava_local: {
      hardfork: "london",
      allowUnlimitedContractSize: true,
      forking: {
        url: 'https://eth-rinkeby.alchemyapi.io/v2/8SAQa7xMc0VXTR_hyfPvAt2pe3QrXybB',
        enabled: true,
        // blockNumber: 7041459 //6430278 //7041458 //6615559 10207859 11869355        
      },
      gasPrice: "auto",
      url: "http://localhost:8545/",
      // accounts: ["C93F165DF8EC9D318A464CA9304E96D627674DC7CD745B97786BB696480F13B3"]
      accounts
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts,
      chainId: 1,
      live: false,
      saveDeployments: true
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts,
      chainId: 4,
      live: false,
      saveDeployments: true,
      tags: ["staging"],
      gasPrice: 5000000000,
      gasMultiplier: 2
    },
    bscMain: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56,
      accounts: {mnemonic: process.env.MNEMONIC},
      live: true,
      saveDeployments: true
    },
    kava: {
      url: `https://evm.kava.io`,
      accounts,
      chainId: 2222,
      live: false,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2
    },
    kava_alpha: {
      url: `https://evm.evm-alpha.kava.io`,
      accounts,
      chainId: 2221,
      live: false,
      saveDeployments: true,
      tags: ["staging"],
      gasMultiplier: 2
    }
  },
  etherscan: {
    apiKey: {
      kava: "api key is not required by the Kava explorer, but can't be empty",
    }, 
      // mainnet: process.env.ETHERSCAN_API_KEY, // BSC_API_KEY,
    customChains: [
      {
        network: 'kava',
        chainId: 2222,
        urls: {
          apiURL: 'https://explorer.kava.io/api',
          browserURL: 'https://explorer.kava.io',
        },
      },
    ],
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
