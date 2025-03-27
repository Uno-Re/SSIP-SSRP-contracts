// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../contracts/Mocks/MockUSDM.sol";

contract DeployMockUSDM is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy USDM token
        MockUSDM usdmToken = new MockUSDM();

        // Mint initial supply to deployer (1 million USDM)
        usdmToken.mint(deployer, 1_000_000 * 1e6);

        vm.stopBroadcast();

        console.log("USDM Token deployed to:", address(usdmToken));
        console.log("Initial supply minted to:", deployer);
    }
}
