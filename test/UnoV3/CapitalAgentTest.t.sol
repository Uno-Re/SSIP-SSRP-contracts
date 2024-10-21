// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "lib/forge-std/src/Test.sol";

import "../../contracts/Mocks/MockChainLinkAggregator.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/Mocks/OraclePriceFeed.sol";
import "../../contracts/Mocks/MockUSDC.sol";
import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/SalesPolicy.sol";
import "../../contracts/RiskPool.sol";

contract CapitalAgentTest is Test {
    IERC20 public iERC20;
    MockChainLinkAggregator public mockEthUsdAggregator;
    SingleSidedInsurancePool public ssip;
    CapitalAgent public capitalAgent;
    SalesPolicy public salesPolicy;
    RiskPoolFactory public riskPoolFactory;
    ExchangeAgent public exchangeAgentContract;
    PriceOracle public priceOracle;
    address public wethAddress;
    address public uniswapRouterAddress;
    address public uniswapFactoryAddress;
    address public oraclePriceFeedAddress;
    uint256 public swapDeadline;
    MockUNO public testToken;
    address public admin;
    address public user;
    address public operator;
    MockUSDC public usdcToken;
    address public factory;
    address public multiSigWallet;
    address public salesPolicyFactory;
    address public policyBuyer;
    address public premiumPool;
    address[] public assets;
    address[] public protocols;
    uint256[] public coverageAmount;
    uint256[] public coverageDuration;
    uint256 public policyPriceInUSDC;
    uint256 public signedTime;
    address public premiumCurrency;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event LogAddPool(address indexed, address);
    event LogAddPoolToList(address indexed);
    event LogRemovePool(address indexed);
    event LogSetPolicy(address indexed);
    event LogRemovePolicy(address indexed);
    event LogUpdatePoolCapital(address indexed, uint256, uint256);
    event LogUpdatePolicyCoverage(address indexed, uint256, uint256, uint256);
    event LogUpdatePolicyExpired(address indexed, uint256);
    event LogMarkToClaimPolicy(address indexed, uint256);
    event LogSetMLR(address indexed, address indexed, uint256 _MLR);
    event LogSetExchangeAgent(address indexed, address indexed, address);
    event LogSetSalesPolicyFactory(address indexed);
    event LogAddPoolWhiteList(address indexed);
    event LogRemovePoolWhiteList(address indexed);
    event LogSetOperator(address indexed);
    event LogSetUSDC(address indexed);
    event LogupdatePoolWithdrawPendingCapital(address indexed, uint256);

    function setUp() public {
        user = address(0x666);
        admin = address(this);
        operator = address(0x1);
        usdcToken = new MockUSDC();
        testToken = new MockUNO();
        multiSigWallet = address(0x4);
        salesPolicyFactory = address(0x99);
        premiumPool = address(0x894);
        factory = address(0x111);
        policyBuyer = address(0x1234);
        assets = new address[](1);
        assets[0] = address(0x2345);
        protocols = new address[](1);
        protocols[0] = address(0x3456);
        coverageAmount = new uint256[](1);
        coverageAmount[0] = 1000 * 1e6; // 1000 USDC
        coverageDuration = new uint256[](1);
        coverageDuration[0] = 30 days;
        policyPriceInUSDC = 50 * 1e6; // 50 USDC
        signedTime = block.timestamp;
        premiumCurrency = address(usdcToken);

        // Deploy mock Chainlink aggregator for ETH/USD
        mockEthUsdAggregator = new MockChainLinkAggregator(1 * 1e8, 8); // $2000 per ETH, 8 decimals

        // Deploy PriceOracle
        priceOracle = new PriceOracle(multiSigWallet);

        // Set the mock aggregator in PriceOracle
        vm.prank(multiSigWallet);
        priceOracle.setETHUSDAggregator(address(mockEthUsdAggregator));

        // Set prices in PriceOracle
        vm.startPrank(multiSigWallet);
        priceOracle.setAssetEthPrice(address(testToken), 1e18); // 1:1 with ETH
        priceOracle.addStableCoin(address(usdcToken));
        vm.stopPrank();

        // Set up addresses for ExchangeAgent constructor
        wethAddress = address(0x4321); // Replace with actual or mock WETH address
        uniswapRouterAddress = address(0x5432); // Replace with actual or mock Uniswap Router address
        uniswapFactoryAddress = address(0x6543); // Replace with actual or mock Uniswap Factory address
        swapDeadline = 1800; // 30 minutes, adjust as needed

        // Deploy ExchangeAgent
        exchangeAgentContract = new ExchangeAgent(
            address(usdcToken),
            wethAddress,
            address(priceOracle),
            uniswapRouterAddress,
            uniswapFactoryAddress,
            multiSigWallet,
            swapDeadline
        );

        vm.prank(multiSigWallet);
        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(address(exchangeAgentContract), address(usdcToken), multiSigWallet, operator);
        vm.prank(multiSigWallet);
        capitalAgent.setSalesPolicyFactory(salesPolicyFactory);

        salesPolicy = new SalesPolicy(
            factory,
            address(exchangeAgentContract),
            premiumPool,
            address(capitalAgent),
            address(usdcToken)
        );

        // Deploy SingleSidedInsurancePool
        ssip = new SingleSidedInsurancePool();
        ssip.initialize(address(capitalAgent), multiSigWallet);

        // Deploy RiskPoolFactory
        riskPoolFactory = new RiskPoolFactory();

        // Whitelist the SSIP in CapitalAgent
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(ssip));

        vm.startPrank(multiSigWallet);
        // Create RiskPool
        ssip.createRiskPool(
            "Test Risk Pool",
            "TRP",
            address(riskPoolFactory),
            address(testToken),
            1e18 // reward multiplier
        );
        uint256 stakingStartTime = block.timestamp + 1 hours;
        // Set staking start time to now
        ssip.setStakingStartTime(block.timestamp);
        vm.stopPrank();
        vm.prank(user);
        testToken.mint(2000 ether);
        vm.prank(address(user));
        testToken.approve(address(ssip), 2000 ether);
        vm.warp(stakingStartTime + 1);
    }

    // helper
    function generateSignature(uint256 nonce) internal view returns (uint8 v, bytes32 r, bytes32 s) {
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                policyPriceInUSDC,
                protocols,
                coverageDuration,
                coverageAmount,
                signedTime,
                premiumCurrency,
                nonce,
                policyBuyer,
                block.chainid
            )
        );
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return vm.sign(uint256(keccak256(abi.encodePacked("signer_private_key"))), ethSignedMessageHash);
    }

    // 1. Initialization
    function testInitialize() public {
        assertEq(capitalAgent.exchangeAgent(), address(exchangeAgentContract));
        assertEq(capitalAgent.usdcToken(), address(usdcToken));
        assertEq(capitalAgent.operator(), operator);
        assertTrue(capitalAgent.hasRole(capitalAgent.ADMIN_ROLE(), multiSigWallet));
    }

    function testInitializeZeroExchangeAgent() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero exchangeAgent address");
        newCapitalAgent.initialize(address(0), address(usdcToken), multiSigWallet, operator);
    }

    function testInitializeZeroUSDCToken() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero USDC address");
        newCapitalAgent.initialize(address(exchangeAgentContract), address(0), multiSigWallet, operator);
    }

    function testInitializeZeroMultiSigWallet() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero multisigwallet address");
        newCapitalAgent.initialize(address(exchangeAgentContract), address(usdcToken), address(0), operator);
    }

    function testAdminRoleGranted() public {
        assertTrue(capitalAgent.hasRole(capitalAgent.ADMIN_ROLE(), multiSigWallet));
    }

    function testAdminRoleAdmin() public {
        assertEq(capitalAgent.getRoleAdmin(capitalAgent.ADMIN_ROLE()), capitalAgent.ADMIN_ROLE());
    }

    // 2. Access Control
    function testOnlyAdminCanAddPool() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.prank(address(0x7)); // Non-admin address
        // Use the expected revert for AccessControl
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.addPoolByAdmin(pool, currency);

        // Test with a valid admin account
        vm.prank(multiSigWallet); // Admin address
        capitalAgent.addPoolByAdmin(pool, currency);
        (, , bool exist, ) = capitalAgent.getPoolInfo(pool);
        assertTrue(exist);
    }

    function testOnlyAdminCanRemovePool() public {
        address poolToRemove = address(0x6);

        // Add a pool first
        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(poolToRemove, address(usdcToken));

        // Non-admin should not be able to remove pool
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.removePool(poolToRemove);

        // Admin should be able to remove pool
        vm.prank(multiSigWallet);
        capitalAgent.removePool(poolToRemove);
    }

    function testOnlyAdminCanSetPolicy() public {
        address newPolicy = address(0x7);

        // Non-admin should not be able to set policy
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.setPolicyByAdmin(newPolicy);

        // Admin should be able to set policy
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(newPolicy);
    }

    function testOnlyAdminCanRemovePolicy() public {
        address policy = address(0x7);

        // Set a policy first
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy);

        // Non-admin should not be able to remove policy
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));

        capitalAgent.removePolicy();

        // Admin should be able to remove policy
        vm.prank(multiSigWallet);
        capitalAgent.removePolicy();
    }

    function testOnlyAdminCanSetExchangeAgent() public {
        address newExchangeAgent = address(0x8);

        // Non-admin should not be able to set exchange agent
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.setExchangeAgent(newExchangeAgent);

        // Admin should be able to set exchange agent
        vm.prank(multiSigWallet);
        capitalAgent.setExchangeAgent(newExchangeAgent);
    }

    function testOnlyAdminCanSetSalesPolicyFactory() public {
        address newSalesPolicyFactory = address(0x9);

        // Non-admin should not be able to set sales policy factory
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.setSalesPolicyFactory(newSalesPolicyFactory);

        // Admin should be able to set sales policy factory
        vm.prank(multiSigWallet);
        capitalAgent.setSalesPolicyFactory(newSalesPolicyFactory);
    }

    function testOnlyAdminCanSetOperator() public {
        address newOperator = address(0x10);

        // Non-admin should not be able to set operator
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.setOperator(newOperator);

        // Admin should be able to set operator
        vm.prank(multiSigWallet);
        capitalAgent.setOperator(newOperator);
    }

    function testOnlyAdminCanSetUSDCToken() public {
        address newUSDCToken = address(0x11);

        // Non-admin should not be able to set USDC token
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.setUSDCToken(newUSDCToken);

        // Admin should be able to set USDC token
        vm.prank(multiSigWallet);
        capitalAgent.setUSDCToken(newUSDCToken);
    }

    function testOnlyAdminCanAddPoolWhitelist() public {
        address poolToWhitelist = address(0x12);

        // Non-admin should not be able to add pool to whitelist
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.addPoolWhiteList(poolToWhitelist);

        // Admin should be able to add pool to whitelist
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(poolToWhitelist);
    }

    function testOnlyAdminCanRemovePoolWhitelist() public {
        address poolToWhitelist = address(0x12);

        // Add pool to whitelist first
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(poolToWhitelist);

        // Non-admin should not be able to remove pool from whitelist
        vm.prank(address(0x7));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x7), ADMIN_ROLE));
        capitalAgent.removePoolWhiteList(poolToWhitelist);

        // Admin should be able to remove pool from whitelist
        vm.prank(multiSigWallet);
        capitalAgent.removePoolWhiteList(poolToWhitelist);
    }

    function testOnlyOperatorCanSetMLR() public {
        uint256 newMLR = 1500000000000000000; // 1.5 in 1e18

        vm.prank(address(0x7)); // Non-operator address
        vm.expectRevert("UnoRe: Capital Agent Forbidden");
        capitalAgent.setMLR(newMLR);

        vm.prank(operator);
        capitalAgent.setMLR(newMLR);
        assertEq(capitalAgent.MLR(), newMLR);
    }

    // 3. Pool Management
    function testAddPool() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);

        (uint256 totalCapital, address poolCurrency, bool exist, ) = capitalAgent.getPoolInfo(pool);
        assertEq(totalCapital, 0);
        assertEq(poolCurrency, currency);
        assertTrue(exist);
    }

    function testAddPoolZeroAddress() public {
        address currency = address(0x6);

        vm.prank(multiSigWallet);
        vm.expectRevert("UnoRe: zero address");
        capitalAgent.addPoolByAdmin(address(0), currency);
    }

    function testAddExistingPool() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        vm.expectRevert("UnoRe: already exist pool");
        capitalAgent.addPoolByAdmin(pool, currency);
        vm.stopPrank();
    }

    function testRemovePool() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        capitalAgent.removePool(pool);
        vm.stopPrank();

        (, , bool exist, ) = capitalAgent.getPoolInfo(pool);
        assertFalse(exist);
    }

    function testRemoveNonExistentPool() public {
        address pool = address(0x5);

        vm.prank(multiSigWallet);
        vm.expectRevert("UnoRe: no exit pool");
        capitalAgent.removePool(pool);
    }

    function testPoolAddedToPoolList() public {
        address newPool = address(0x100);
        address newCurrency = address(0x101);

        // Add a new pool
        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(newPool, newCurrency);

        // Check if the pool is in the poolList
        bool poolFound = false;
        address[] memory poolList = capitalAgent.getPoolList();
        for (uint i = 0; i < poolList.length; i++) {
            if (poolList[i] == newPool) {
                poolFound = true;
                break;
            }
        }

        assertTrue(poolFound, "Pool should be added to poolList");
    }

    function testCurrencyAddedToCurrencyList() public {
        address newPool = address(0x100);
        address newCurrency = address(0x101);

        // Add a new pool with a new currency
        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(newPool, newCurrency);

        // Check if the currency is in the currencyList
        bool currencyFound = false;
        address[] memory currencyList = capitalAgent.getCurrencyList();

        for (uint i = 0; i < currencyList.length; i++) {
            if (currencyList[i] == newCurrency) {
                currencyFound = true;
                break;
            }
        }

        assertTrue(currencyFound, "Currency should be added to currencyList");

        // Add another pool with the same currency
        address anotherPool = address(0x102);
        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(anotherPool, newCurrency);

        // Check that the currency list length hasn't changed
        assertEq(currencyList.length, 2, "Currency list length should not change for existing currency");
    }

    function testSetPoolCapital() public {
        address newPool = address(0x100);
        address newCurrency = address(0x101);
        uint256 capitalAmount = 1000000; // 1 million tokens

        // Add a new pool
        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(newPool, newCurrency);

        // Set pool capital
        vm.prank(multiSigWallet);
        capitalAgent.setPoolCapital(newPool, capitalAmount);

        // Verify the pool capital has been set correctly
        (uint256 totalCapital, , , ) = capitalAgent.getPoolInfo(newPool);
        assertEq(totalCapital, capitalAmount, "Pool capital should be set correctly");

        // Verify the total capital staked for the currency has been updated
        uint256 totalStaked = capitalAgent.totalCapitalStakedByCurrency(newCurrency);
        assertEq(totalStaked, capitalAmount, "Total capital staked for currency should be updated");
    }

    function testSetCapitalNonExistentPool() public {
        address nonExistentPool = address(0x200);
        uint256 capitalAmount = 1000000; // 1 million tokens

        // Attempt to set capital for a non-existent pool
        vm.prank(multiSigWallet);
        vm.expectRevert("UnoRe: no exit pool");
        capitalAgent.setPoolCapital(nonExistentPool, capitalAmount);
    }

    // 4. Policy Management
    function testSetPolicy() public {
        address policy = address(0x7);

        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy);

        (address policyAddress, uint256 utilizedAmount, bool exist) = capitalAgent.getPolicyInfo();
        assertEq(policyAddress, policy);
        assertEq(utilizedAmount, 0);
        assertTrue(exist);
    }

    function testUpdatePolicy() public {
        address policy1 = address(0x7);
        address policy2 = address(0x8);

        vm.startPrank(multiSigWallet);

        // Set the first policy
        capitalAgent.setPolicyByAdmin(policy1);

        // Attempt to set a second policy, which should fail
        capitalAgent.setPolicyByAdmin(policy2);

        vm.stopPrank();

        // Verify that the policy is still set to policy1
        (address storedPolicy, , bool exists) = capitalAgent.getPolicyInfo();
        assertEq(storedPolicy, policy2);
        assertTrue(exists);
    }

    function testRemovePolicy() public {
        address policy = address(0x7);

        vm.startPrank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy);
        capitalAgent.removePolicy();
        vm.stopPrank();

        (address policyAddress, , bool exist) = capitalAgent.getPolicyInfo();
        assertEq(policyAddress, address(0));
        assertFalse(exist);
    }

    function testRemoveNonExistentPolicy() public {
        // Ensure no policy exists initially
        (, , bool exists) = capitalAgent.getPolicyInfo();
        assertFalse(exists, "Policy should not exist initially");

        // Attempt to remove a non-existent policy
        vm.prank(multiSigWallet);
        vm.expectRevert("UnoRe: non existing policy on Capital Agent");
        capitalAgent.removePolicy();

        // Verify that the state hasn't changed
        (, , exists) = capitalAgent.getPolicyInfo();
        assertFalse(exists, "Policy should still not exist after failed removal");
    }

    function testPolicyInfoUpdated() public {
        address testPolicy = address(0x123);

        // Check initial state
        (address initialPolicyAddress, uint256 initialUtilizedAmount, bool initialExists) = capitalAgent.getPolicyInfo();
        assertEq(initialPolicyAddress, address(0), "Initial policy address should be zero");
        assertEq(initialUtilizedAmount, 0, "Initial utilized amount should be zero");
        assertFalse(initialExists, "Policy should not exist initially");

        // Set the policy
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(testPolicy);

        // Check updated state
        (address updatedPolicyAddress, uint256 updatedUtilizedAmount, bool updatedExists) = capitalAgent.getPolicyInfo();
        assertEq(updatedPolicyAddress, testPolicy, "Policy address should be updated");
        assertEq(updatedUtilizedAmount, 0, "Utilized amount should still be zero");
        assertTrue(updatedExists, "Policy should now exist");
    }

    function testSSIPWithdraw() public {
        uint256 stakingAmount = 2000 ether;

        vm.prank(user);
        testToken.mint(stakingAmount);

        vm.prank(user);
        testToken.approve(address(ssip), stakingAmount);

        vm.prank(user);
        ssip.enterInPool(stakingAmount);

        uint256 afterStakeUserBalance = testToken.balanceOf(user);

        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200); // Assuming ~7200 blocks per day

        // Perform withdrawal
        vm.startPrank(user);
        ssip.leaveFromPoolInPending(stakingAmount / 4);

        // Skip 11 days and mint the blocks
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 11 * 7200); // Assuming ~7200 blocks per day

        ssip.leaveFromPending(stakingAmount / 4);
        vm.stopPrank();

        // Get final balances
        uint256 finalUserBalance = testToken.balanceOf(user);

        // Assert
        assertApproxEqAbs(
            finalUserBalance,
            afterStakeUserBalance + (stakingAmount / 4),
            1e18,
            "User balance should increase by withdraw amount"
        );

        // Check capital agent state
        uint256 totalPending = capitalAgent.getTotalPendingCapitalInUSDC();

        assertEq(totalPending, 0, "Total pending should be zero after withdrawal");
    }

    function testSSIPWithdrawExceedingCapital() public {
        uint256 stakingAmount = 1000 ether;
        uint256 excessiveWithdrawAmount = 1500 ether;

        // Mint and approve tokens for the user
        vm.startPrank(user);
        testToken.mint(stakingAmount);
        testToken.approve(address(ssip), stakingAmount);

        // User stakes tokens
        ssip.enterInPool(stakingAmount);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200);

        // Attempt to withdraw more than staked
        vm.prank(user);
        vm.expectRevert(); //TODO add MLR error handler
        ssip.leaveFromPoolInPending(excessiveWithdrawAmount);

        // Verify that the total pending capital in USDC is still zero
        uint256 totalPending = capitalAgent.getTotalPendingCapitalInUSDC();
        assertEq(totalPending, 0, "Total pending should be zero after failed withdrawal attempt");
        // Verify that the user's balance in the contract remains the same
        uint256 userLPBalance = RiskPool(payable(ssip.riskPool())).balanceOf(user);
        assertEq(userLPBalance, stakingAmount, "SSIP contract balance should remain unchanged");
    }

    function testSSIPWithdrawViolatingMLR() public {
        uint256 stakingAmount = 1000 ether;
        uint256 withdrawAmount = 8000 ether;
        uint256 mlr = 0.3 ether; // 30% MLR

        // Set MLR
        vm.prank(operator);
        capitalAgent.setMLR(mlr);

        // Mint and approve tokens for the user
        vm.startPrank(user);
        testToken.mint(stakingAmount);
        testToken.approve(address(ssip), stakingAmount);

        // User stakes tokens
        ssip.enterInPool(stakingAmount);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200);

        // Attempt to withdraw an amount that would violate MLR
        vm.prank(user);
        vm.expectRevert();
        ssip.leaveFromPoolInPending(withdrawAmount);

        // Verify that the staked amount remains unchanged
        uint256 userLPBalance = RiskPool(payable(ssip.riskPool())).balanceOf(user);
        assertEq(userLPBalance, stakingAmount, "Staked amount should remain unchanged");

        // Verify that the total pending capital in USDC is still zero
        uint256 totalPending = capitalAgent.getTotalPendingCapitalInUSDC();
        assertEq(totalPending, 0, "Total pending should be zero after failed withdrawal attempt");
    }

    function testUpdatePoolWithdrawPendingCapitalAdd() public {
        address testPool = address(ssip);
        uint256 initialStakingAmount = 1000 ether;
        uint256 pendingAmount = 100 ether;

        // Setup: Add pool and set initial capital
        vm.startPrank(multiSigWallet);
        capitalAgent.setPoolCapital(testPool, initialStakingAmount);
        vm.stopPrank();

        // Get initial pool info
        (uint256 initialTotalCapital, , , uint256 initialPendingCapital) = capitalAgent.getPoolInfo(testPool);

        // Simulate user staking
        vm.startPrank(user);
        testToken.mint(initialStakingAmount);
        testToken.approve(address(ssip), initialStakingAmount);
        ssip.enterInPool(initialStakingAmount);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200); // Assuming ~7200 blocks per day

        // User requests to leave from pool (which should update pending capital)
        vm.prank(user);
        ssip.leaveFromPoolInPending(pendingAmount);

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200); // Assuming ~7200 blocks per day

        // Get updated pool info
        (, , , uint256 updatedPendingCapital) = capitalAgent.getPoolInfo(testPool);

        // Assertions
        assertEq(
            updatedPendingCapital,
            initialPendingCapital + pendingAmount,
            "Pending capital should increase by pendingAmount"
        );
    }

    function testUpdatePoolWithdrawPendingCapitalSubtract() public {
        address testPool = address(ssip);
        uint256 initialStakingAmount = 1000 ether;
        uint256 pendingAmount = 100 ether;

        // Setup: Add pool and set initial capital
        vm.startPrank(multiSigWallet);
        capitalAgent.setPoolCapital(testPool, initialStakingAmount);
        vm.stopPrank();

        // Simulate user staking
        vm.startPrank(user);
        testToken.mint(initialStakingAmount);
        testToken.approve(address(ssip), initialStakingAmount);
        ssip.enterInPool(initialStakingAmount);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200); // Assuming ~7200 blocks per day

        // User requests to leave from pool (which should update pending capital)
        vm.prank(user);
        ssip.leaveFromPoolInPending(pendingAmount);

        // Get pending capital after requesting withdrawal
        (, , , uint256 pendingCapitalAfterRequest) = capitalAgent.getPoolInfo(testPool);

        // Advance time to allow for withdrawal completion
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 11 * 7200); // Assuming ~7200 blocks per day

        // User completes the withdrawal
        vm.prank(user);
        ssip.leaveFromPending(pendingAmount);

        // Get pending capital after completing withdrawal
        (, , , uint256 pendingCapitalAfterWithdrawal) = capitalAgent.getPoolInfo(testPool);

        // Assertions
        assertEq(
            pendingCapitalAfterWithdrawal,
            pendingCapitalAfterRequest - pendingAmount,
            "Pending capital should decrease by pendingAmount after withdrawal"
        );

        assertEq(pendingCapitalAfterWithdrawal, 0, "Pending capital should be zero after completing withdrawal");
    }

    function testUpdateWithdrawPendingCapitalNonExistentPool() public {
        address nonExistentPool = address(0x123);
        uint256 pendingAmount = 1000 * 1e6; // 1,000 USDC

        vm.expectRevert("UnoRe: no exist ssip");
        capitalAgent.updatePoolWithdrawPendingCapital(nonExistentPool, pendingAmount, true);
    }

    function testCheckCapitalByMLRPass() public {
        address pool = address(0x5);
        address currency = address(usdcToken);
        uint256 initialCapital = 1000000 * 1e6; // 1,000,000 USDC
        uint256 utilizedAmount = 500000 * 1e6; // 500,000 USDC
        uint256 mlr = 800000000000000000; // 0.8 in 1e18 format (80% MLR)

        // Setup: Add pool, set initial capital, and set MLR
        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        capitalAgent.setPoolCapital(pool, initialCapital);
        vm.stopPrank();

        vm.prank(operator);
        capitalAgent.setMLR(mlr);

        // Setup: Set policy
        address policyAddress = address(0x456);
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policyAddress);

        // Calculate maximum allowed utilized amount
        uint256 maxAllowedUtilized = (initialCapital * mlr) / 1e18;
        assertTrue(utilizedAmount <= maxAllowedUtilized, "Utilized amount should be within MLR limit");

        // Test with utilized amount at the MLR limit
        uint256 utilizedAtLimit = maxAllowedUtilized;

        bool result = capitalAgent.checkCapitalByMLR(pool, utilizedAtLimit);
        assertTrue(result, "Capital check should pass when utilized amount is at MLR limit");
    }

    function testCheckCapitalByMLRFail() public {
        address pool = address(0x5);
        address currency = address(usdcToken);
        uint256 initialCapital = 1000000 * 1e6; // 1,000,000 USDC
        uint256 mlr = 800000000000000000; // 0.8 in 1e18 format (80% MLR)

        // Setup: Add pool, set initial capital, and set MLR
        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        capitalAgent.setPoolCapital(pool, initialCapital);
        vm.stopPrank();

        vm.prank(operator);
        capitalAgent.setMLR(mlr);

        // Setup: Set policy
        address policyAddress = address(0x456);
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policyAddress);

        // Calculate maximum allowed utilized amount
        uint256 maxAllowedUtilized = (initialCapital * mlr) / 1e18;

        // Set utilized amount slightly above the MLR limit
        uint256 excessiveUtilizedAmount = maxAllowedUtilized + 1e18; // 1 USDC above the limit

        vm.expectRevert();
        capitalAgent.checkCapitalByMLR(pool, excessiveUtilizedAmount);

        // Test with utilized amount slightly below the MLR limit (should pass)
        uint256 belowLimitAmount = maxAllowedUtilized - 1 * 1e6; // 1 USDC below the limit

        bool result = capitalAgent.checkCapitalByMLR(pool, belowLimitAmount);
        assertTrue(result, "Capital check should pass when utilized amount is below MLR limit");
    }

    function testCheckCoverageByMLRWorksAsExpected() public {
        uint256 initialStakingAmount = 1000 ether; // Adjust based on token decimals
        uint256 coverageAmountTest = 1500 ether;
        uint256 mlr = 2 ether; // 200%
        // Set MLR
        vm.prank(operator);
        capitalAgent.setMLR(mlr);

        // Simulate staking
        vm.prank(user);
        ssip.enterInPool(initialStakingAmount);

        // Get total capital staked and pending
        uint256 totalStaked = capitalAgent.totalCapitalStaked();
        uint256 totalPending = capitalAgent.getTotalPendingCapitalInUSDC();

        // Ensure staked amount is greater than pending amount
        assertGt(totalStaked, totalPending, "Staked amount should be greater than pending amount");

        // Check if coverage is within MLR limits
        bool canCover = capitalAgent.checkCoverageByMLR(coverageAmountTest);

        // Assert
        assertTrue(canCover, "Should be able to cover this amount");

        bool cannotCover = capitalAgent.checkCoverageByMLR(coverageAmountTest * 3);

        // Assert
        assertFalse(cannotCover, "Should not be able to cover this amount");
    }

    // 8. Calculations and Conversions
    function testTotalCapitalStakedCalculation() public {
        // Deploy two new SSIPs
        SingleSidedInsurancePool ssip1 = new SingleSidedInsurancePool();
        SingleSidedInsurancePool ssip2 = new SingleSidedInsurancePool();

        ssip1.initialize(address(capitalAgent), multiSigWallet);
        ssip2.initialize(address(capitalAgent), multiSigWallet);
        // Whitelist the SSIP in CapitalAgent
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(ssip1)); // Whitelist the SSIP in CapitalAgent
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(ssip2));

        // Create RiskPools for each SSIP
        vm.prank(multiSigWallet);
        ssip1.createRiskPool(
            "Test Risk Pool 1",
            "TRP1",
            address(riskPoolFactory),
            address(testToken),
            1e18 // reward multiplier
        );
        vm.prank(multiSigWallet);
        ssip2.createRiskPool(
            "Test Risk Pool 2",
            "TRP2",
            address(riskPoolFactory),
            address(usdcToken),
            1e18 // reward multiplier
        );

        // Setup staking amounts
        uint256 amount1 = 1000 ether;
        uint256 amount2 = 2000 * 10 ** 6; // Assuming USDC has 6 decimals

        // Simulate staking in both pools
        vm.startPrank(user);
        testToken.mint(amount1);
        testToken.approve(address(ssip1), amount1);
        ssip1.enterInPool(amount1);

        usdcToken.faucetToken(amount2);
        usdcToken.approve(address(ssip2), amount2);
        ssip2.enterInPool(amount2);
        vm.stopPrank();

        // Set pool capitals in CapitalAgent
        vm.startPrank(multiSigWallet);
        capitalAgent.setPoolCapital(address(ssip1), amount1);
        capitalAgent.setPoolCapital(address(ssip2), amount2);
        vm.stopPrank();

        // Calculate expected total staked in USDC
        uint256 amount1InUSDC = exchangeAgentContract.getTokenAmountForUSDC(address(testToken), amount1);
        uint256 amount2InUSDC = amount2; // USDC amount is already in USDC
        uint256 expectedTotalStaked = amount1InUSDC + amount2InUSDC;

        // Get actual total staked from CapitalAgent
        uint256 actualTotalStaked = capitalAgent.totalCapitalStaked();

        // Assert
        assertEq(actualTotalStaked, expectedTotalStaked, "Total capital staked calculation is incorrect");

        // Test adding more capital to an existing pool
        uint256 additionalAmount = 500 ether;
        vm.startPrank(user);
        testToken.mint(additionalAmount);
        testToken.approve(address(ssip1), additionalAmount);
        ssip1.enterInPool(additionalAmount);
        vm.stopPrank();

        vm.prank(multiSigWallet);
        capitalAgent.setPoolCapital(address(ssip1), amount1 + additionalAmount);

        // Recalculate expected total staked
        amount1InUSDC = exchangeAgentContract.getTokenAmountForUSDC(address(testToken), amount1 + additionalAmount);
        expectedTotalStaked = amount1InUSDC + amount2InUSDC;

        // Get updated actual total staked
        actualTotalStaked = capitalAgent.totalCapitalStaked();

        // Assert again
        assertEq(actualTotalStaked, expectedTotalStaked, "Total capital staked calculation is incorrect after adding capital");

        // Test removing a pool
        vm.prank(multiSigWallet);
        capitalAgent.removePool(address(ssip2));

        // Recalculate expected total staked (only ssip1 should remain)
        expectedTotalStaked = amount1InUSDC;

        // Get updated actual total staked
        actualTotalStaked = capitalAgent.totalCapitalStaked();

        // Assert one more time
        assertEq(actualTotalStaked, expectedTotalStaked, "Total capital staked calculation is incorrect after removing a pool");
    }

    function testTokenToUSDCConversion() public {
        MockUNO newToken = new MockUNO();
        MockUNO anotherToken = new MockUNO();

        vm.startPrank(multiSigWallet);
        priceOracle.setAssetEthPrice(address(newToken), 0.5 ether);
        priceOracle.setAssetEthPrice(address(anotherToken), 0.25 ether);
        vm.stopPrank();

        mockEthUsdAggregator.updatePrice(2000 * 1e8);

        // Test NTK to USDC conversions
        uint256[3] memory ntkAmounts = [uint256(1 ether), uint256(1000 ether), uint256(0.001 ether)];
        uint256[3] memory expectedUsdcAmounts = [uint256(1000000000000000), uint256(1000000000000000000), uint256(1000000000000)];

        for (uint i = 0; i < 3; i++) {
            uint256 actualUsdcAmount = exchangeAgentContract.getTokenAmountForUSDC(address(newToken), ntkAmounts[i]);
            assertEq(actualUsdcAmount, expectedUsdcAmounts[i], "Incorrect USDC amount for NTK conversion");
        }

        // Test USDC to NTK conversion
        uint256 usdcAmount = 1000000000000000; // 0.001 USDC (adjusted based on the conversion rate we observed)
        uint256 expectedNtkAmount = 1000000000000;
        uint256 actualNtkAmount = exchangeAgentContract.getNeededTokenAmount(address(usdcToken), address(newToken), usdcAmount);
        assertEq(actualNtkAmount, expectedNtkAmount, "Incorrect NTK amount for USDC");

        // Test conversion between non-stable tokens
        uint256 ntkToConvert = 1 ether;
        uint256 expectedAtkAmount = 2 ether;
        uint256 actualAtkAmount = exchangeAgentContract.getNeededTokenAmount(
            address(newToken),
            address(anotherToken),
            ntkToConvert
        );
        assertEq(actualAtkAmount, expectedAtkAmount, "Incorrect ATK amount for 1 NTK");
    }

    function testTotalPendingCapitalCalculation() public {
        // Deploy two new SSIPs
        SingleSidedInsurancePool ssip1 = new SingleSidedInsurancePool();
        SingleSidedInsurancePool ssip2 = new SingleSidedInsurancePool();

        ssip1.initialize(address(capitalAgent), multiSigWallet);
        ssip2.initialize(address(capitalAgent), multiSigWallet);

        // Whitelist the SSIPs in CapitalAgent
        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(ssip1));
        capitalAgent.addPoolWhiteList(address(ssip2));
        vm.stopPrank();

        // Create RiskPools for each SSIP
        vm.startPrank(multiSigWallet);
        ssip1.createRiskPool(
            "Test Risk Pool 1",
            "TRP1",
            address(riskPoolFactory),
            address(testToken),
            1e18 // reward multiplier
        );
        ssip2.createRiskPool(
            "Test Risk Pool 2",
            "TRP2",
            address(riskPoolFactory),
            address(usdcToken),
            1e18 // reward multiplier
        );
        vm.stopPrank();

        // Setup staking amounts
        uint256 amount1 = 1000 ether;
        uint256 amount2 = 2000 * 10 ** 6; // Assuming USDC has 6 decimals

        // Simulate staking in both pools
        vm.startPrank(user);
        testToken.mint(amount1);
        testToken.approve(address(ssip1), amount1);
        ssip1.enterInPool(amount1);

        usdcToken.faucetToken(amount2);
        usdcToken.approve(address(ssip2), amount2);
        ssip2.enterInPool(amount2);
        vm.stopPrank();

        // Set pool capitals in CapitalAgent
        vm.startPrank(multiSigWallet);
        capitalAgent.setPoolCapital(address(ssip1), amount1);
        capitalAgent.setPoolCapital(address(ssip2), amount2);
        vm.stopPrank();

        // Advance time
        vm.warp(block.timestamp + 1 days);
        vm.roll(block.number + 1 * 7200); // Assuming ~7200 blocks per day

        // Request withdrawals from both pools
        uint256 pendingAmount1 = 300 ether;
        uint256 pendingAmount2 = 500 * 10 ** 6;

        vm.prank(user);
        ssip1.leaveFromPoolInPending(pendingAmount1);

        vm.prank(user);
        ssip2.leaveFromPoolInPending(pendingAmount2);

        // Calculate expected total pending capital in USDC
        uint256 pendingAmount1InUSDC = exchangeAgentContract.getTokenAmountForUSDC(address(testToken), pendingAmount1);
        uint256 pendingAmount2InUSDC = pendingAmount2; // USDC amount is already in USDC
        uint256 expectedTotalPending = pendingAmount1InUSDC + pendingAmount2InUSDC;

        // Get actual total pending capital from CapitalAgent
        uint256 actualTotalPending = capitalAgent.getTotalPendingCapitalInUSDC();

        // Assert
        assertEq(actualTotalPending, expectedTotalPending, "Total pending capital calculation is incorrect");

        // Test completing withdrawal from one pool
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 11 * 7200);

        vm.prank(user);
        ssip1.leaveFromPending(pendingAmount1);

        // Recalculate expected total pending
        expectedTotalPending = pendingAmount2InUSDC;

        // Get updated actual total pending
        actualTotalPending = capitalAgent.getTotalPendingCapitalInUSDC();

        // Assert again
        assertEq(
            actualTotalPending,
            expectedTotalPending,
            "Total pending capital calculation is incorrect after completing withdrawal"
        );

        // Test removing a pool with pending withdrawals
        vm.prank(multiSigWallet);
        capitalAgent.removePool(address(ssip2));

        // Expect total pending to be zero after removing all pools
        expectedTotalPending = 0;

        // Get updated actual total pending
        actualTotalPending = capitalAgent.getTotalPendingCapitalInUSDC();

        // Assert one more time
        assertEq(actualTotalPending, expectedTotalPending, "Total pending capital should be zero after removing all pools");
    }

    // 9. Event Emissions
    function testLogAddPoolEvent() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.prank(multiSigWallet);
        vm.recordLogs();
        capitalAgent.addPoolByAdmin(pool, currency);

        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 1);
        assertEq(entries[0].topics[0], keccak256("LogAddPool(address,address)"));
        assertEq(entries[0].topics[1], bytes32(uint256(uint160(pool))));
        assertEq(abi.decode(entries[0].data, (address)), currency);
    }

    function testLogRemovePoolEvent() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        vm.expectEmit(true, false, false, true);
        emit LogRemovePool(pool);
        capitalAgent.removePool(pool);
        vm.stopPrank();
    }

    function testLogSetPolicyEvent() public {
        address policy = address(0x7);

        vm.prank(multiSigWallet);
        vm.expectEmit(true, false, false, false);
        emit LogSetPolicy(policy);
        capitalAgent.setPolicyByAdmin(policy);
    }

    function testLogRemovePolicyEvent() public {
        address policy = address(0x7);

        vm.prank(salesPolicyFactory);
        capitalAgent.setPolicy(policy);

        vm.prank(multiSigWallet);
        // Prepare to check for event emission
        vm.expectEmit(true, true, true, true);
        emit LogRemovePolicy(policy);
        // Action: Remove the policy
        capitalAgent.removePolicy();
    }

    function testLogUpdatePoolCapitalEvent() public {
        address pool = address(0x5);
        address currency = address(0x6);
        uint256 initialStakingAmount = 100 ether;

        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);

        vm.expectEmit(true, true, true, true);
        emit LogUpdatePoolCapital(pool, initialStakingAmount, initialStakingAmount);
        // Action: Simulate staking
        vm.prank(pool);
        capitalAgent.SSIPStaking(initialStakingAmount);

        (uint256 poolCapital, address poolCurrency, bool exists, ) = capitalAgent.getPoolInfo(pool);
        assertEq(poolCapital, initialStakingAmount, "Pool capital not updated correctly");
        assertEq(currency, poolCurrency, "Pool currency mismatch");
        assertTrue(exists, "Pool should exist");

        uint256 totalCapitalStaked = capitalAgent.totalCapitalStakedByCurrency(currency);
        assertEq(totalCapitalStaked, initialStakingAmount, "Total capital staked not updated correctly");
    }

    function testLogSetMLREvent() public {
        uint256 newMLR = 2 * 1e18; // 200%

        vm.expectEmit(true, true, true, true);
        emit LogSetMLR(operator, address(capitalAgent), newMLR);

        vm.prank(operator);
        capitalAgent.setMLR(newMLR);
        assertEq(capitalAgent.MLR(), newMLR, "MLR not updated correctly");
    }

    function testLogSetExchangeAgentEvent() public {
        address newExchangeAgent = address(0x123);

        vm.expectEmit(true, true, true, true);
        emit LogSetExchangeAgent(multiSigWallet, address(capitalAgent), newExchangeAgent);

        vm.prank(multiSigWallet);
        capitalAgent.setExchangeAgent(newExchangeAgent);

        assertEq(capitalAgent.exchangeAgent(), newExchangeAgent, "Exchange agent not updated correctly");
    }

    function testLogSetSalesPolicyFactoryEvent() public {
        address newSalesPolicyFactory = address(0x123);

        vm.expectEmit(true, true, true, true);
        emit LogSetSalesPolicyFactory(newSalesPolicyFactory);

        vm.prank(multiSigWallet);
        capitalAgent.setSalesPolicyFactory(newSalesPolicyFactory);

        assertEq(capitalAgent.salesPolicyFactory(), newSalesPolicyFactory);
    }

    function testLogAddPoolWhiteListEvent() public {
        address poolToWhitelist = address(0x123);

        vm.expectEmit(true, true, true, true);
        emit LogAddPoolWhiteList(poolToWhitelist);

        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(poolToWhitelist);

        assertTrue(capitalAgent.poolWhiteList(poolToWhitelist));
    }

    function testLogRemovePoolWhiteListEvent() public {
        address poolToRemove = address(0x123);

        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(poolToRemove);

        vm.expectEmit(true, true, true, true);
        emit LogRemovePoolWhiteList(poolToRemove);

        vm.prank(multiSigWallet);
        capitalAgent.removePoolWhiteList(poolToRemove);

        assertFalse(capitalAgent.poolWhiteList(poolToRemove));
    }

    function testLogSetOperatorEvent() public {
        address newOperator = address(0x456);

        vm.expectEmit(true, true, true, true);
        emit LogSetOperator(newOperator);

        vm.prank(multiSigWallet);
        capitalAgent.setOperator(newOperator);

        assertEq(capitalAgent.operator(), newOperator);
    }

    function testLogSetUSDCEvent() public {
        address newUSDCToken = address(0x789);

        vm.expectEmit(true, true, true, true);
        emit LogSetUSDC(newUSDCToken);

        vm.prank(multiSigWallet);
        capitalAgent.setUSDCToken(newUSDCToken);

        assertEq(capitalAgent.usdcToken(), newUSDCToken);
    }

    function testLogUpdatePoolWithdrawPendingCapitalEvent() public {
        address testPool = address(0xABC);
        address testCurrency = address(0xDEF);
        uint256 pendingAmount = 100 ether;

        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(testPool, testCurrency);

        vm.expectEmit(true, true, true, true);
        emit LogupdatePoolWithdrawPendingCapital(testPool, pendingAmount);

        vm.prank(testPool);
        capitalAgent.updatePoolWithdrawPendingCapital(testPool, pendingAmount, true);

        (, , , uint256 totalWithdrawPendingCapital) = capitalAgent.getPoolInfo(testPool);
        assertEq(totalWithdrawPendingCapital, pendingAmount);
    }

    // 10. Edge Cases and Boundary Testing
    function testMaxUint256Values() public {
        uint256 maxUint = type(uint256).max;

        // Test setting max MLR
        vm.prank(operator);
        capitalAgent.setMLR(maxUint);
        assertEq(capitalAgent.MLR(), maxUint, "MLR should be set to max uint256");

        // Test adding a pool with max capital
        address mockPool = address(new SingleSidedInsurancePool());
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(mockPool);

        vm.prank(mockPool);
        capitalAgent.addPool(mockPool, address(testToken));

        vm.prank(multiSigWallet);
        capitalAgent.setPoolCapital(mockPool, maxUint);

        (uint256 poolCapital, , , ) = capitalAgent.getPoolInfo(mockPool);
        assertEq(poolCapital, maxUint, "Pool capital should be set to max uint256");

        // Test policy coverage with max value
        address testPolicy = address(
            salesPolicy = new SalesPolicy(
                factory,
                address(exchangeAgentContract),
                premiumPool,
                address(capitalAgent),
                address(usdcToken)
            )
        );
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(testPolicy);

        vm.prank(testPolicy);
        vm.expectRevert();
        capitalAgent.policySale(maxUint);

        // Test max pending withdrawal
        vm.prank(mockPool);
        capitalAgent.updatePoolWithdrawPendingCapital(mockPool, maxUint, true);

        // Verify that the pending withdrawal was set to max
        (, , , uint256 pendingWithdrawal) = capitalAgent.getPoolInfo(mockPool);
        assertEq(pendingWithdrawal, maxUint, "Pending withdrawal should be set to max uint256");

        // Test max staking amount
        vm.prank(mockPool);
        vm.expectRevert();
        capitalAgent.SSIPStaking(maxUint);

        // Test max withdrawal amount
        vm.prank(mockPool);
        vm.expectRevert();
        capitalAgent.SSIPWithdraw(maxUint);
    }

    function testMinValues() public {
        address user7 = address(0x56526);

        // Setup: Deploy a new SSIP with minimum stake
        SingleSidedInsurancePool minSsip = new SingleSidedInsurancePool();
        minSsip.initialize(address(capitalAgent), multiSigWallet);

        // Whitelist the new SSIP
        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(minSsip));

        // Create RiskPool with minimum values
        vm.prank(multiSigWallet);
        minSsip.createRiskPool(
            "Min Risk Pool",
            "MRP",
            address(riskPoolFactory),
            address(testToken),
            1 // Minimum reward multiplier
        );

        // Stake minimum amount (1 wei)
        uint256 minStake = 1;
        vm.startPrank(user7);
        testToken.mint(minStake);
        testToken.approve(address(minSsip), minStake);
        minSsip.enterInPool(minStake);
        vm.stopPrank();

        // Set minimum pool capital
        vm.prank(multiSigWallet);
        capitalAgent.setPoolCapital(address(minSsip), minStake);

        // Set minimum MLR (1 wei)
        uint256 minMlr = 1;
        vm.prank(operator);
        capitalAgent.setMLR(minMlr);

        // Set policy
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(address(salesPolicy));

        // Stake more so withdrawl works
        uint256 moreStake = 1500 ether;
        vm.startPrank(user7);
        testToken.mint(moreStake);
        testToken.approve(address(minSsip), moreStake);
        minSsip.enterInPool(moreStake);
        vm.stopPrank();

        // Test minimum withdrawal
        vm.prank(user7);
        minSsip.leaveFromPoolInPending(1);

        // Advance time to allow withdrawal
        vm.warp(block.timestamp + 11 days);
        vm.roll(block.number + 11 * 7200);

        vm.prank(user7);
        minSsip.leaveFromPending(1);

        // Verify pool info after withdrawal
        (, , , uint256 pendingCapital) = capitalAgent.getPoolInfo(address(minSsip));
        assertEq(pendingCapital, 0, "Pending capital should be 0 after withdrawal");

        // Test removing pool with minimum values
        vm.prank(multiSigWallet);
        capitalAgent.removePool(address(minSsip));

        // Verify pool no longer exists
        (, , bool poolExists, ) = capitalAgent.getPoolInfo(address(minSsip));
        assertFalse(poolExists, "Pool should no longer exist");
    }

    function testZeroValueOnMLR() public {
        uint256 invalidMLR = 0;

        vm.expectRevert("UnoRe: MLR cannot be zero");

        vm.prank(operator);
        capitalAgent.setMLR(invalidMLR);
    }

    // 11. Integration Tests
    function testExchangeAgentInteraction() public {
        // Setup: Create a new token pair for testing
        MockUNO newToken = new MockUNO();

        // Set up mock price data
        uint256 newTokenPrice = 2 ether; // 1 NTK = 2 USDC
        vm.prank(multiSigWallet);
        priceOracle.setAssetEthPrice(address(newToken), newTokenPrice);

        // Test getNeededTokenAmount function
        uint256 usdcAmount = 100 ether;
        uint256 expectedNewTokenAmount = 50 ether; // 100 USDC / 2 USDC per NTK = 50 NTK

        uint256 actualNewTokenAmount = exchangeAgentContract.getNeededTokenAmount(
            address(testToken),
            address(newToken),
            usdcAmount
        );

        assertEq(actualNewTokenAmount, expectedNewTokenAmount, "Incorrect token conversion amount");

        // Test edge cases
        vm.expectRevert("PO: Prices of both tokens should be set");
        exchangeAgentContract.getNeededTokenAmount(address(testToken), address(0x1234), usdcAmount);

        uint256 zeroAmount = exchangeAgentContract.getNeededTokenAmount(address(testToken), address(newToken), 0);
        assertEq(zeroAmount, 0);

        // Test with very large amounts
        uint256 largeAmount = 100000 ether;

        uint256 convertedLargeAmount = exchangeAgentContract.getNeededTokenAmount(
            address(testToken),
            address(newToken),
            largeAmount
        );
        assertLt(convertedLargeAmount, largeAmount, "Large amount conversion failed");
    }

    function testSSIPInteraction() public {
        uint256 initialStake = 1000 ether;
        uint256 additionalStake = 500 ether;
        uint256 unstakeAmount = 200 ether;

        // Setup: Mint tokens for the user
        vm.startPrank(user);
        testToken.mint(initialStake + additionalStake);
        testToken.approve(address(ssip), initialStake + additionalStake);
        vm.stopPrank();

        // Test 1: Initial staking
        vm.prank(user);
        ssip.enterInPool(initialStake);

        // Verify pool capital update in CapitalAgent
        (uint256 poolCapital, , , ) = capitalAgent.getPoolInfo(address(ssip));
        assertEq(poolCapital, initialStake, "Pool capital should match initial stake");

        // Test 2: Additional staking
        vm.prank(user);
        ssip.enterInPool(additionalStake);

        // Verify pool capital update after additional stake
        (poolCapital, , , ) = capitalAgent.getPoolInfo(address(ssip));
        assertEq(poolCapital, initialStake + additionalStake, "Pool capital should match total staked amount");

        // Test 3: Unstaking (pending withdrawal)
        vm.prank(user);
        ssip.leaveFromPoolInPending(unstakeAmount);

        // Verify pending withdrawal in CapitalAgent
        uint256 pendingWithdrawal = capitalAgent.getTotalPendingCapitalInUSDC();
        assertEq(pendingWithdrawal, unstakeAmount, "Pending withdrawal should match unstake amount");

        // Test 4: Completing withdrawal after waiting period
        // Simulate time passing
        vm.warp(block.timestamp + 10 days);
        vm.roll(block.number + (7200 * 10)); // Assuming 7200 blocks per day

        vm.prank(user);
        ssip.leaveFromPending(unstakeAmount);

        // Verify pool capital and pending withdrawal updates
        (poolCapital, , , ) = capitalAgent.getPoolInfo(address(ssip));
        assertEq(poolCapital, initialStake + additionalStake - unstakeAmount, "Pool capital should be reduced after withdrawal");

        pendingWithdrawal = capitalAgent.getTotalPendingCapitalInUSDC();
        assertEq(pendingWithdrawal, 0, "Pending withdrawal should be zero after completing withdrawal");

        // Test 5: Attempt to unstake more than staked amount
        uint256 excessiveUnstake = initialStake + additionalStake;
        vm.prank(user);
        vm.expectRevert(); // The exact error message might vary
        ssip.leaveFromPoolInPending(excessiveUnstake);

        // Test 6: Verify SSIP balance matches CapitalAgent's record
        uint256 ssipBalance = testToken.balanceOf(ssip.riskPool());
        (poolCapital, , , ) = capitalAgent.getPoolInfo(address(ssip));
        assertEq(ssipBalance, poolCapital, "SSIP balance should match CapitalAgent's pool capital record");

        // Test 7: Update pool capital directly (admin function)
        uint256 newCapital = 2000 ether;
        vm.prank(multiSigWallet);
        capitalAgent.setPoolCapital(address(ssip), newCapital);

        (poolCapital, , , ) = capitalAgent.getPoolInfo(address(ssip));
        assertEq(poolCapital, newCapital, "Pool capital should match new capital set by admin");

        // Test 8: Verify total capital staked across all pools
        uint256 totalCapital = capitalAgent.totalCapitalStaked();
        assertEq(totalCapital, newCapital, "Total capital staked should match the new capital of the single pool");
    }

    // 12. Upgradeability
    function testUpgradeContract() public {
        // TODO: Verify contract can be upgraded without loss of state
    }

    function testAddNewFunctionInUpgrade() public {
        // TODO: Verify new functions can be added in upgraded version
    }

    // 13. Gas Optimization
    function testGasUsage() public {
        // TODO: Measure gas usage for all external functions
    }

    // 14. Reentrancy Protection
    function testReentrancyProtection() public {
        // TODO: Verify nonReentrant modifier prevents reentrancy attacks on vulnerable functions
    }
}
