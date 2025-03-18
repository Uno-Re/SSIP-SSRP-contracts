// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../contracts/SingleSidedInsurancePoolUSDM.sol";
import "../contracts/CapitalAgent.sol";
import "../contracts/ExchangeAgent.sol";
import "../contracts/factories/RewarderFactory.sol";
import "../contracts/factories/RiskPoolFactory.sol";
import "../contracts/Mocks/MockUNO.sol";
import "../contracts/Mocks/MockUSDC.sol";
import "../contracts/Mocks/MockUSDM.sol";
import "../contracts/Mocks/MockUniswap.sol";
import {PriceOracle as MockOraclePriceFeed} from "../contracts/Mocks/OraclePriceFeed.sol";
import {MockChainLinkAggregator} from "../contracts/Mocks/MockChainLinkAggregator.sol";

contract DeployUSDMPoolTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSigWallet = vm.envAddress("MULTISIG_WALLET");
        address operator = vm.envAddress("OPERATOR_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy USDM token first (using MockUSDM instead)
        MockUSDM usdmToken = new MockUSDM();

        // Deploy tokens
        MockUNO unoToken = new MockUNO();
        MockUSDC usdcToken = new MockUSDC();

        // Setup Oracle
        MockChainLinkAggregator mockEthUsdAggregator = new MockChainLinkAggregator(1e8, 8);
        MockOraclePriceFeed priceOracle = new MockOraclePriceFeed(multiSigWallet);

        // Setup Oracle configuration
        priceOracle.setETHUSDAggregator(address(mockEthUsdAggregator));
        priceOracle.addStableCoin(address(unoToken));
        priceOracle.addStableCoin(address(usdmToken));
        priceOracle.setAssetEthPrice(address(usdmToken), 1e18);
        priceOracle.setAssetEthPrice(address(usdcToken), 1e18);

        // Setup Mock Uniswap
        MockUniswapFactory mockUniswapFactory = new MockUniswapFactory();
        MockUniswapRouter uniswapRouter = new MockUniswapRouter();
        MockUniswapPair mockUniswapPair = new MockUniswapPair(address(usdmToken), address(usdcToken));
        mockUniswapFactory.setPair(address(usdmToken), address(usdcToken), address(mockUniswapPair));

        // Deploy factories
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();

        // Deploy Exchange Agent with full configuration
        ExchangeAgent exchangeAgent = new ExchangeAgent(
            address(usdcToken),
            address(usdmToken),
            address(priceOracle),
            address(uniswapRouter),
            address(mockUniswapFactory),
            multiSigWallet,
            1800 // 30 min deadline
        );

        // Deploy and initialize Capital Agent
        CapitalAgent capitalAgent = new CapitalAgent();
        capitalAgent.initialize(address(exchangeAgent), address(usdcToken), multiSigWallet, operator);

        // Deploy and initialize USDM Pool
        SingleSidedInsurancePoolUSDM pool = new SingleSidedInsurancePoolUSDM();
        pool.initialize(address(capitalAgent), multiSigWallet);

        // Setup initial configuration
        capitalAgent.addPoolWhiteList(address(pool));
        capitalAgent.setMCR(10e6); // 10 MCR
        capitalAgent.setMLR(1e6); // 1 MLR

        // Create risk pool
        pool.createRiskPool(
            "Synthetic SSIP-USDM",
            "SSSIP-USDM",
            address(riskPoolFactory),
            address(usdmToken),
            1e18, // Initial LP price
            1e8 // Min LP capital
        );

        // Create and setup rewarder
        pool.createRewarder(operator, address(rewarderFactory), address(unoToken));

        // Set initial parameters
        pool.setRewardMultiplier(10000000000000000000000000); // UNO rewards per block
        vm.sleep(5); // Wait 5 seconds

        pool.setAccUnoPerShare(15, block.number);
        vm.sleep(5); // Wait 5 seconds

        // Set staking start time to current time
        pool.setStakingStartTime(block.timestamp);

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("USDM Token:", address(usdmToken));
        console.log("UNO Token:", address(unoToken));
        console.log("USDC Token:", address(usdcToken));
        console.log("Price Oracle:", address(priceOracle));
        console.log("Mock Uniswap Router:", address(uniswapRouter));
        console.log("Mock Uniswap Factory:", address(mockUniswapFactory));
        console.log("Exchange Agent:", address(exchangeAgent));
        console.log("Capital Agent:", address(capitalAgent));
        console.log("USDM Pool:", address(pool));
        console.log("Risk Pool Factory:", address(riskPoolFactory));
        console.log("Rewarder Factory:", address(rewarderFactory));
    }
}
