// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Script.sol";
import "../contracts/SingleSidedInsurancePoolUSDM.sol";
import "../contracts/interfaces/IUSDM.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/interfaces/ICapitalAgent.sol";
import "../contracts/interfaces/IPremiumPool.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../contracts/interfaces/IOraclePriceFeed.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

/**
 * @title USDMDeployer
 * @notice Script to deploy the USDM insurance pool system using TransparentUpgradeableProxy with existing components
 * @dev This script uses pre-deployed implementation, RiskPoolFactory, and RewarderFactory
 */
contract USDMDeployer is Script {
    // Events to log important addresses
    event Deployed(
        address implementation,
        address proxy,
        address proxyAdmin
    );

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_1");
        address multiSigWallet = vm.envAddress("MULTISIGWALLET");
        address unoToken = vm.envAddress("UNO");
        address usdmToken = vm.envAddress("USDM");
        address capitalAgent = vm.envAddress("CAPITAL_AGENT_ADDRESS");
        
        // Pre-deployed contracts
        address implementationAddress = vm.envAddress("POOL_IMPLEMENTATION_ADDRESS");
        address riskPoolFactoryAddress = vm.envAddress("RISKPOOL_FACTORY_ADDRESS");
        address rewarderFactoryAddress = vm.envAddress("REWARDER_FACTORY_ADDRESS");

        // Input validation
        require(unoToken != address(0), "UNO address not set");
        require(usdmToken != address(0), "USDM address not set");
        require(capitalAgent != address(0), "Capital Agent address not set");
        require(multiSigWallet != address(0), "MultiSig wallet address not set");
        require(implementationAddress != address(0), "Implementation address not set");
        require(riskPoolFactoryAddress != address(0), "RiskPoolFactory address not set");
        require(rewarderFactoryAddress != address(0), "RewarderFactory address not set");

        vm.startBroadcast(deployerPrivateKey);
        address deployer = vm.addr(deployerPrivateKey);
        
        // 1. Deploy ProxyAdmin - this will control the proxy's upgrade functions
        ProxyAdmin proxyAdmin = new ProxyAdmin(deployer);
        
        // 2. Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            SingleSidedInsurancePoolUSDM.initialize.selector,
            capitalAgent,
            deployer 
        );

        // 3. Deploy TransparentUpgradeableProxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            implementationAddress,
            address(proxyAdmin), // Admin address - the ProxyAdmin contract
            initData
        );

        // Create interface to interact with proxy
        SingleSidedInsurancePoolUSDM pool = SingleSidedInsurancePoolUSDM(address(proxy));

        // 4. Initial configuration (all these require admin role)
        // Create rewarder
        pool.createRewarder(multiSigWallet, rewarderFactoryAddress, unoToken);

        // Set initial parameters
        pool.setRewardMultiplier(19029680365483); // UNO rewards per block
        pool.setAccUnoPerShare(15, block.number);
        pool.setStakingStartTime(1);

        // 5. Transfer control to multisig
        bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
        pool.grantRole(ADMIN_ROLE, multiSigWallet);
        
        // 6. Transfer ownership of ProxyAdmin to multisig
        proxyAdmin.transferOwnership(multiSigWallet);
        
        vm.stopBroadcast();

        // Log important addresses
        console.log("Implementation:", implementationAddress);
        console.log("Proxy:", address(proxy));
        console.log("ProxyAdmin:", address(proxyAdmin));
        console.log("RiskPoolFactory:", riskPoolFactoryAddress);
        console.log("RewarderFactory:", rewarderFactoryAddress);
        
        // Emit event for easier address retrieval from logs
        emit Deployed(
            implementationAddress,
            address(proxy),
            address(proxyAdmin)
        );
    }
}