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

contract DeployOnlyPoolUSDMTestnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address multiSigWallet = vm.envAddress("MULTISIG_WALLET");
        address operator = vm.envAddress("OPERATOR_ADDRESS");
        address unoToken = vm.envAddress("UNO_ADDRESS");
        address usdmToken = vm.envAddress("USDM_ADDRESS");
        address capitalAgent = vm.envAddress("CAPITAL_AGENT_ADDRESS");
        address premiumPool = vm.envAddress("PREMIUM_POOL_ADDRESS");

        require(unoToken != address(0), "UNO address not set");
        require(usdmToken != address(0), "USDM address not set");
        require(capitalAgent != address(0), "Capital Agent address not set");
        require(premiumPool != address(0), "Premium Pool address not set");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy factories
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();

        // Deploy and initialize USDM Pool
        SingleSidedInsurancePoolUSDM pool = new SingleSidedInsurancePoolUSDM();
        pool.initialize(capitalAgent, multiSigWallet);

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
        pool.createRewarder(operator, address(rewarderFactory), unoToken);

        // Set initial parameters
        pool.setRewardMultiplier(1000000000000000); // UNO rewards per block
        vm.sleep(5); // Wait 5 seconds

        pool.setAccUnoPerShare(15, block.number);
        vm.sleep(5); // Wait 5 seconds

        // Set staking start time to current time
        pool.setStakingStartTime(1);

        vm.stopBroadcast();

        // Log deployed addresses
        console.log("USDM Pool:", address(pool));
        console.log("Risk Pool Factory:", address(riskPoolFactory));
        console.log("Rewarder Factory:", address(rewarderFactory));
    }
}
