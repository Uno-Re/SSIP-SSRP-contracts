// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../../contracts/CapitalAgent.sol";

contract CapitalAgentDeploy is Script {
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
        
        address multiSigWallet = address(0x638e1314Fa2023638452cBaD7A6357182De4FC66);
        address exchangeAgent = address(0x62c7FcBA5f4400C965a223011C47e5696464385c);
        address usdcToken = address(0x7682E6f40ea8dfAe954432130E8ae506934c0d10);
        address operator = address(0x638e1314Fa2023638452cBaD7A6357182De4FC66);
        
        // Input validation
        require(multiSigWallet != address(0), "MultiSig wallet address not set");
        require(exchangeAgent != address(0), "Exchange Agent address not set");
        require(usdcToken != address(0), "USDC token address not set");
        require(operator != address(0), "Operator address not set");

        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy CapitalAgent contract
        CapitalAgent capitalAgent = new CapitalAgent();
        
        // Initialize the CapitalAgent
        capitalAgent.initialize(
            exchangeAgent,
            usdcToken,
            multiSigWallet,
            operator
        );
        
        // Optional: Set initial values if needed
        // capitalAgent.setMCR(10e6); // Example: Set MCR to 10
        // capitalAgent.setMLR(1e6);  // Example: Set MLR to 1
        
        vm.stopBroadcast();
        
        // Log deployed address
        console.log("CapitalAgent deployed at:", address(capitalAgent));
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