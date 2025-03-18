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
import "../contracts/Mocks/MockUniswap.sol";
import {PriceOracle as MockOraclePriceFeed} from "../contracts/Mocks/OraclePriceFeed.sol";
import {MockChainLinkAggregator} from "../contracts/Mocks/MockChainLinkAggregator.sol";
import {IUSDM} from "../contracts/interfaces/IUSDM.sol";

contract DeployUSDMPoolMainnet is Script {
    function deployTokensAndOracle(
        address multiSigWallet,
        address usdmAddress
    ) internal returns (MockUNO unoToken, MockUSDC usdcToken, MockOraclePriceFeed priceOracle) {
        // Deploy tokens
        unoToken = new MockUNO();
        usdcToken = new MockUSDC();

        // Setup Oracle
        MockChainLinkAggregator mockEthUsdAggregator = new MockChainLinkAggregator(1e8, 8);
        priceOracle = new MockOraclePriceFeed(multiSigWallet);

        // Setup Oracle configuration
        priceOracle.setETHUSDAggregator(address(mockEthUsdAggregator));
        priceOracle.addStableCoin(address(unoToken));
        priceOracle.addStableCoin(usdmAddress);
        priceOracle.setAssetEthPrice(usdmAddress, 1e18);
        priceOracle.setAssetEthPrice(address(usdcToken), 1e18);
    }

    function deployUniswap(
        address usdmAddress,
        address usdcAddress
    ) internal returns (MockUniswapFactory mockUniswapFactory, MockUniswapRouter uniswapRouter) {
        mockUniswapFactory = new MockUniswapFactory();
        uniswapRouter = new MockUniswapRouter();
        MockUniswapPair mockUniswapPair = new MockUniswapPair(usdmAddress, usdcAddress);
        mockUniswapFactory.setPair(usdmAddress, usdcAddress, address(mockUniswapPair));
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSigWallet = vm.envAddress("MULTISIG_WALLET");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address usdmAddress = vm.envAddress("USDM_ADDRESS");
        IUSDM usdmToken = IUSDM(usdmAddress);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy tokens and oracle
        (MockUNO unoToken, MockUSDC usdcToken, MockOraclePriceFeed priceOracle) = deployTokensAndOracle(
            multiSigWallet,
            usdmAddress
        );

        // Deploy Uniswap components
        (MockUniswapFactory mockUniswapFactory, MockUniswapRouter uniswapRouter) = deployUniswap(usdmAddress, address(usdcToken));

        // Deploy factories
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();

        // Deploy Exchange Agent
        ExchangeAgent exchangeAgent = new ExchangeAgent(
            address(usdcToken),
            usdmAddress,
            address(priceOracle),
            address(uniswapRouter),
            address(mockUniswapFactory),
            multiSigWallet,
            1800
        );

        // Deploy and initialize Capital Agent
        CapitalAgent capitalAgent = new CapitalAgent();
        capitalAgent.initialize(address(exchangeAgent), address(usdcToken), multiSigWallet, operator);

        // Deploy and initialize USDM Pool
        SingleSidedInsurancePoolUSDM pool = new SingleSidedInsurancePoolUSDM();
        pool.initialize(address(capitalAgent), multiSigWallet);

        // Setup initial configuration
        capitalAgent.addPoolWhiteList(address(pool));
        capitalAgent.setMCR(10e6);
        capitalAgent.setMLR(1e6);

        // Create risk pool and rewarder
        pool.createRiskPool("Synthetic SSIP-USDM", "SSSIP-USDM", address(riskPoolFactory), usdmAddress, 1e18, 1e8);

        pool.createRewarder(operator, address(rewarderFactory), address(unoToken));

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("USDM Token:", usdmAddress);
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
