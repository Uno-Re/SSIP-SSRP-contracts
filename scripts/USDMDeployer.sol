// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../contracts/SingleSidedInsurancePoolUSDM.sol";
import "../contracts/factories/RewarderFactory.sol";
import "../contracts/factories/RiskPoolFactory.sol";
import "../contracts/interfaces/IUSDM.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/interfaces/ICapitalAgent.sol";
import "../contracts/interfaces/IPremiumPool.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../contracts/interfaces/IOraclePriceFeed.sol";

contract USDMDeployer is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_1");
        address multiSigWallet = vm.envAddress("MULTISIGWALLET");
        address unoToken = vm.envAddress("UNO");
        address usdmToken = vm.envAddress("USDM");
        address capitalAgent = vm.envAddress("CAPITAL_AGENT_ADDRESS");
        address priceOracle = vm.envAddress("PRICE_ORACLE_ADDRESS");

        require(unoToken != address(0), "UNO address not set");
        require(usdmToken != address(0), "USDM address not set");
        require(capitalAgent != address(0), "Capital Agent address not set");
        require(priceOracle != address(0), "Price Oracle address not set");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy factories
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();

        // Deploy implementation
        SingleSidedInsurancePoolUSDM implementation = new SingleSidedInsurancePoolUSDM();

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            SingleSidedInsurancePoolUSDM.initialize.selector,
            capitalAgent,
            multiSigWallet
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Create interface to interact with proxy
        SingleSidedInsurancePoolUSDM pool = SingleSidedInsurancePoolUSDM(address(proxy));

        // Add pool to Capital Agent whitelist
        ICapitalAgent(capitalAgent).addPoolWhiteList(address(pool));

        // Create risk pool
        pool.createRiskPool(
            "Synthetic SSIP-USDM",
            "SSSIP-USDM",
            address(riskPoolFactory),
            usdmToken,
            1e18, // Initial LP price
            1e8 // Min LP capital
        );

        // Create and setup rewarder
        pool.createRewarder(multiSigWallet, address(rewarderFactory), unoToken);

        // Set initial parameters
        pool.setRewardMultiplier(949301000000000000); // UNO rewards per block
        vm.warp(block.timestamp + 5); // Wait 5 seconds

        pool.setAccUnoPerShare(15, block.number);
        vm.warp(block.timestamp + 5); // Wait 5 seconds

        pool.setStakingStartTime(1);

        // Set price in oracle
        IOraclePriceFeed(priceOracle).setAssetEthPrice(usdmToken, 476190476190476000);

        vm.stopBroadcast();

        console.log("Implementation deployed to:", address(implementation));
        console.log("Proxy deployed to:", address(proxy));
        console.log("Risk Pool Factory deployed to:", address(riskPoolFactory));
        console.log("Rewarder Factory deployed to:", address(rewarderFactory));
    }
}
