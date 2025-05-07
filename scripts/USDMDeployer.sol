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

/**
 * @title USDMDeployer
 * @notice Script to deploy and set up the USDM insurance pool system
 * @dev This script deploys the pool with a burner wallet and then can transfer control to a multisig
 * 
 * The deployment process handles:
 * 1. Deploy factory contracts
 * 2. Deploy implementation contract
 * 3. Deploy proxy with burner wallet as initial admin
 * 4. Perform initial configuration
 * 5. Grant admin role to multisig
 * 
 * IMPORTANT: Post-deployment actions required (to be executed by authorized account):
 * - Add pool to CapitalAgent whitelist ICapitalAgent(capitalAgent).addPoolWhiteList(address(pool));
 * - Set asset price in OraclePriceFeed IOraclePriceFeed(priceOracle).setAssetEthPrice(usdmToken, 476190476190476000);
 * - // Create risk pool
        // pool.createRiskPool(
        //     "Synthetic SSIP-USDM",
        //     "SSSIP-USDM",
        //     address(riskPoolFactory),
        //     usdmToken,
        //     1e18, // Initial LP price
        //     1e8  // Min LP capital
        // );
 */
contract USDMDeployer is Script {
    // Events to log important addresses (useful for verification)
    event Deployed(
        address implementation,
        address proxy,
        address riskPoolFactory,
        address rewarderFactory
    );

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY_1");
        address multiSigWallet = vm.envAddress("MULTISIGWALLET");
        address unoToken = vm.envAddress("UNO");
        address usdmToken = vm.envAddress("USDM");
        address capitalAgent = vm.envAddress("CAPITAL_AGENT_ADDRESS");
        address priceOracle = vm.envAddress("PRICE_ORACLE_ADDRESS");

        // Input validation
        require(unoToken != address(0), "UNO address not set");
        require(usdmToken != address(0), "USDM address not set");
        require(capitalAgent != address(0), "Capital Agent address not set");
        require(priceOracle != address(0), "Price Oracle address not set");
        require(multiSigWallet != address(0), "MultiSig wallet address not set");

        vm.startBroadcast(deployerPrivateKey);
        address deployer = vm.addr(deployerPrivateKey);
        // // 1. Deploy factories
        RiskPoolFactory riskPoolFactory = new RiskPoolFactory();
        RewarderFactory rewarderFactory = new RewarderFactory();

        // 2. Deploy implementation
        SingleSidedInsurancePoolUSDM implementation = new SingleSidedInsurancePoolUSDM();

        // 3. Prepare initialization data - use burner wallet as initial admin
        bytes memory initData = abi.encodeWithSelector(
            SingleSidedInsurancePoolUSDM.initialize.selector,
            capitalAgent,
            deployer 
        );

        // 4. Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        // Create interface to interact with proxy
        SingleSidedInsurancePoolUSDM pool = SingleSidedInsurancePoolUSDM(address(proxy));

        // 5. Initial configuration (all these require admin role)
        // Create risk pool
        pool.createRiskPool(
            "Synthetic SSIP-USDM",
            "SSSIP-USDM",
            address(riskPoolFactory),
            usdmToken,
            1e18, // Initial LP price
            1e8  // Min LP capital
        );

        // Create rewarder
        pool.createRewarder(multiSigWallet, address(rewarderFactory), unoToken);

        // Set initial parameters
        pool.setRewardMultiplier(949301000000000000); // UNO rewards per block
        pool.setAccUnoPerShare(15, block.number);
        pool.setStakingStartTime(1);

        // 6. Transfer control to multisig
        bytes32 ADMIN_ROLE = keccak256("ADMIN_ROLE");
        pool.grantRole(ADMIN_ROLE, multiSigWallet);
        
        vm.stopBroadcast();

        // Emit event for easier address retrieval from logs
        emit Deployed(
            address(implementation),
            address(proxy),
            address(riskPoolFactory),
            address(rewarderFactory)
        );
    }
}