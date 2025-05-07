// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../contracts/SingleSidedInsurancePoolUSDM.sol";

contract DeployOnlyImplementation is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_1");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy only the implementation
        SingleSidedInsurancePoolUSDM implementation = new SingleSidedInsurancePoolUSDM();
        
        vm.stopBroadcast();
        
        console.log("Implementation deployed at:", address(implementation));
    }
}