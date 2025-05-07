// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../../contracts/SingleSidedInsurancePoolUSDM.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "../../contracts/factories/RewarderFactory.sol";

contract SingleSidedInsurancePoolUSDMDeploy is Script {
    function run() external {
        // Get private key from command line arguments
        string memory privateKeyArg = vm.envOr("PRIVATE_KEY", string(""));
        uint256 deployerPrivateKey;
        
        if (bytes(privateKeyArg).length > 0) {
            // If private key is provided via command line, use it
            // Remove "0x" prefix if present
            if (bytes(privateKeyArg)[0] == "0" && bytes(privateKeyArg)[1] == "x") {
                privateKeyArg = substring(privateKeyArg, 2, bytes(privateKeyArg).length);
            }
            deployerPrivateKey = vm.parseUint(privateKeyArg);
        } else {
            // Fallback to environment variable
            deployerPrivateKey = vm.envUint("PRIVATE_KEY_SEPOLIA");
        }
        
        // Read addresses from environment or use defaults for testing
        address multiSigWallet = address(0x638e1314Fa2023638452cBaD7A6357182De4FC66);
        address capitalAgent = address(0xd4FdA0c6a4105C457C04A431337EF1a08BE00E45); // Use the deployed CapitalAgent
        address usdmToken = address(0xD31129c2A3dc2D97Db3E480DF9f1fF491B5A33CA);
        address operator =  address(0x638e1314Fa2023638452cBaD7A6357182De4FC66);
        
        // Input validation
        require(multiSigWallet != address(0), "MultiSig wallet address not set");
        require(capitalAgent != address(0), "Capital Agent address not set");
        require(usdmToken != address(0), "USDM token address not set");
        require(operator != address(0), "Operator address not set");

        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy factories first
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();
        
        // Deploy SingleSidedInsurancePoolUSDM contract
        SingleSidedInsurancePoolUSDM ssipUSDM = new SingleSidedInsurancePoolUSDM();
        
        // Initialize the SingleSidedInsurancePoolUSDM
        ssipUSDM.initialize(
            capitalAgent,
            multiSigWallet
        );
        
        // Log deployed addresses
        console.log("SingleSidedInsurancePoolUSDM deployed at:", address(ssipUSDM));
        console.log("RiskPoolFactory deployed at:", address(riskPoolFactory));
        console.log("RewarderFactory deployed at:", address(rewarderFactory));
        
        // Optional: Create Risk Pool
        if (vm.envOr("CREATE_RISK_POOL", false)) {
            string memory name = "USDM-LP";
            string memory symbol = "USDM-LP";
            uint256 rewardMultiplier = 1e18; // Default reward multiplier (1 token per block)
            uint256 SCR = 1e6; // Default SCR value (1 USDM)
            
            // Create risk pool with the SingleSidedInsurancePoolUSDM
            ssipUSDM.createRiskPool(
                name,
                symbol,
                address(riskPoolFactory),
                usdmToken,
                rewardMultiplier,
                SCR
            );
            
            address riskPool = ssipUSDM.riskPool();
            console.log("Risk Pool created at:", riskPool);
            
            // Create rewarder
            ssipUSDM.createRewarder(
                operator,
                address(rewarderFactory),
                usdmToken
            );
            
            address rewarder = ssipUSDM.rewarder();
            console.log("Rewarder created at:", rewarder);
        }
        
        vm.stopBroadcast();
    }
    
    // Helper function to extract substring
    function substring(string memory str, uint startIndex, uint endIndex) private pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(endIndex - startIndex);
        for (uint i = startIndex; i < endIndex; i++) {
            result[i - startIndex] = strBytes[i];
        }
        return string(result);
    }
}