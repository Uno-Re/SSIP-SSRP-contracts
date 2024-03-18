require("@nomicfoundation/hardhat-ethers")
require("hardhat-deploy")
require("hardhat-deploy-ethers")
require("@nomicfoundation/hardhat-verify")
require("hardhat-contract-sizer")
require("@nomicfoundation/hardhat-verify")
require("hardhat-gas-reporter")
require("@openzeppelin/hardhat-upgrades")
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
        url: "https://goerli.infura.io/v3/f18ea15fd54544a0b9b3a06c5624e665",
        // url: 'https://eth-mainnet.alchemyapi.io/v2/kX2m_40xGyLvewVGbo7JaAe6mZTha838',
        enabled: true,
        blockNumber: 	10603862 //6430278 //7041458 //6615559 10207859 11869355
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
      saveDeployments: true,
    },
    goerli: {
      url: process.env.GOERLI_URL,
      accounts: [process.env.PRIVATE_KEY_1, process.env.PRIVATE_KEY_2],
    },
  },
  etherscan: {
    apiKey: process.env.API_KEY, // BSC_API_KEY
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
    runOnCompile: true
  },
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
}
