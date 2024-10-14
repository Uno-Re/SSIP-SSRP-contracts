// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "lib/forge-std/src/Test.sol";

import "../../contracts/CapitalAgent.sol";
import "../../contracts/SalesPolicy.sol";
import "../../contracts/Mocks/MockUSDC.sol";

contract CapitalAgentTest is Test {
    IERC20 public iERC20;
    CapitalAgent public capitalAgent;
    SalesPolicy public salesPolicy;
    address public admin;
    address public operator;
    address public exchangeAgent;
    address public usdcToken;
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
    address user = address(14574);
    address public premiumCurrency;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event LogAddPool(address indexed, address);
    event LogAddPool(address indexed);
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
        admin = address(this);
        operator = address(0x1);
        exchangeAgent = address(0x2);
        usdcToken = address(0x3);
        multiSigWallet = address(0x4);
        salesPolicyFactory = address(0x99);
        premiumPool = address(0x894);
        factory = address(0x111);
        vm.prank(admin);

        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(exchangeAgent, usdcToken, multiSigWallet, operator);
        vm.prank(multiSigWallet);
        capitalAgent.setSalesPolicyFactory(salesPolicyFactory);

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
        premiumCurrency = usdcToken;

        salesPolicy = new SalesPolicy(factory, exchangeAgent, premiumPool, address(capitalAgent), usdcToken);
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
        assertEq(capitalAgent.exchangeAgent(), exchangeAgent);
        assertEq(capitalAgent.usdcToken(), usdcToken);
        assertEq(capitalAgent.operator(), operator);
        assertTrue(capitalAgent.hasRole(capitalAgent.ADMIN_ROLE(), multiSigWallet));
    }

    function testInitializeZeroExchangeAgent() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero exchangeAgent address");
        newCapitalAgent.initialize(address(0), usdcToken, multiSigWallet, operator);
    }

    function testInitializeZeroUSDCToken() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero USDC address");
        newCapitalAgent.initialize(exchangeAgent, address(0), multiSigWallet, operator);
    }

    function testInitializeZeroMultiSigWallet() public {
        CapitalAgent newCapitalAgent = new CapitalAgent();
        vm.expectRevert("UnoRe: zero multisigwallet address");
        newCapitalAgent.initialize(exchangeAgent, usdcToken, address(0), operator);
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
        capitalAgent.addPoolByAdmin(poolToRemove, usdcToken);

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

    function testOnlyAdminCanMarkPolicyToClaim() public {
        address policy = address(salesPolicy);
        uint256 nonce = 0;

        // Generate signature
        (uint8 v, bytes32 r, bytes32 s) = generateSignature(nonce);

        // Set a policy first
        vm.prank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy);

        // Buy a policy
        vm.startPrank(policyBuyer);
        deal(usdcToken, policyBuyer, policyPriceInUSDC, true);
        MockUSDC(usdcToken).approve(address(salesPolicy), policyPriceInUSDC);
        salesPolicy.buyPolicy(
            assets,
            protocols,
            coverageAmount,
            coverageDuration,
            policyPriceInUSDC,
            signedTime,
            premiumCurrency,
            r,
            s,
            v,
            nonce
        );
        vm.stopPrank();

        // Get the policy ID
        uint256 policyId = salesPolicy.allPoliciesLength() - 1;

        // Non-admin should not be able to mark policy to claim
        vm.prank(address(0x7));
        vm.expectRevert("UnoRe: Capital Agent Forbidden");
        capitalAgent.markToClaimPolicy(policyId);

        // Admin should be able to mark policy to claim
        vm.prank(multiSigWallet);
        capitalAgent.markToClaimPolicy(policyId);

        // Verify that the policy is marked as claimed
        (, , , bool exist, ) = salesPolicy.getPolicyData(policyId);
        assertFalse(exist, "Policy should be marked as claimed (not exist)");
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
        assertEq(currencyList.length, 1, "Currency list length should not change for existing currency");
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

    // 5. Capital Operations
    function testSSIPWithdraw() public {
        // TODO: Test SSIP withdraw with valid amount
    }

    function testSSIPWithdrawExceedingCapital() public {
        // TODO: Test SSIP withdraw with amount exceeding pool capital
    }

    function testSSIPWithdrawViolatingMLR() public {
        // TODO: Test SSIP withdraw that violates MLR
    }

    function testSSIPPolicyClaim() public {
        // TODO: Test SSIP policy claim with valid amount
    }

    function testSSIPPolicyClaimExceedingCoverage() public {
        // TODO: Test SSIP policy claim with amount exceeding coverage
    }

    function testUpdatePoolWithdrawPendingCapitalAdd() public {
        // TODO: Test updating pool withdraw pending capital (add)
    }

    function testUpdatePoolWithdrawPendingCapitalSubtract() public {
        // TODO: Test updating pool withdraw pending capital (subtract)
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

    function testCheckCoverageByMLRPass() public {
        // TODO: Test check coverage by MLR (should pass)
    }

    function testCheckCoverageByMLRFail() public {
        // TODO: Test check coverage by MLR (should fail)
    }

    // 7. Policy Operations
    function testPolicySale() public {
        // TODO: Test policy sale with valid coverage amount
    }

    function testPolicySaleNonPolicyAddress() public {
        // TODO: Test policy sale from non-policy address
    }

    function testPolicySaleNonExistentPolicy() public {
        // TODO: Test policy sale with non-existent policy
    }

    function testPolicySaleViolatingMLR() public {
        // TODO: Test policy sale that violates MLR
    }

    function testUpdateExpiredPolicyStatus() public {
        // TODO: Test updating expired policy status
    }

    function testUpdateNonExpiredPolicyStatus() public {
        // TODO: Test updating non-expired policy status
    }

    function testMarkPolicyToClaim() public {
        // TODO: Test marking policy to claim
    }

    // 8. Calculations and Conversions
    function testTotalCapitalStakedCalculation() public {
        // TODO: Verify correct calculation of total capital staked
    }

    function testTokenToUSDCConversion() public {
        // TODO: Verify correct conversion of token amounts to USDC
    }

    function testTotalPendingCapitalCalculation() public {
        // TODO: Verify correct calculation of total pending capital
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

    function testLogUpdatePolicyCoverageEvent() public {
        // TODO: Verify LogUpdatePolicyCoverage event emission
    }

    function testLogUpdatePolicyExpiredEvent() public {
        // TODO: Verify LogUpdatePolicyExpired event emission
    }

    function testLogMarkToClaimPolicyEvent() public {
        // TODO: Verify LogMarkToClaimPolicy event emission
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
        // TODO: Test with maximum uint256 values where applicable
    }

    function testMinValues() public {
        // TODO: Test with minimum (1) values where applicable
    }

    function testZeroValueOnMLR() public {
        uint256 invalidMLR = 0;

        vm.expectRevert("UnoRe: MLR cannot be zero");

        vm.prank(operator);
        capitalAgent.setMLR(invalidMLR);
    }

    // 11. Integration Tests
    function testExchangeAgentInteraction() public {
        // TODO: Verify correct interaction with ExchangeAgent contract
    }

    function testSalesPolicyInteraction() public {
        // TODO: Verify correct interaction with SalesPolicy contract
    }

    function testSSIPInteraction() public {
        // TODO: Verify correct interaction with SSIP (pool) contracts
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
