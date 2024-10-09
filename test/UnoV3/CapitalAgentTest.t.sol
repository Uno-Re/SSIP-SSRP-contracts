// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/CapitalAgent.sol";

contract CapitalAgentTest is Test {
    CapitalAgent public capitalAgent;
    address public admin;
    address public operator;
    address public exchangeAgent;
    address public usdcToken;
    address public multiSigWallet;

    function setUp() public {
        admin = address(this);
        operator = address(0x1);
        exchangeAgent = address(0x2);
        usdcToken = address(0x3);
        multiSigWallet = address(0x4);

        vm.prank(admin);
        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(exchangeAgent, usdcToken, multiSigWallet, operator);
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
        vm.expectRevert("AccessControl: account 0x0000000000000000000000000000000000000007 is missing role 0x0000000000000000000000000000000000000000000000000000000000000000");
        capitalAgent.addPoolByAdmin(pool, currency);

        vm.prank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        assertTrue(capitalAgent.poolInfo(pool).exist);
    }

    function testOnlyAdminCanRemovePool() public {
        // TODO: Verify only ADMIN_ROLE can remove pools
    }

    function testOnlyAdminCanSetPolicy() public {
        // TODO: Verify only ADMIN_ROLE can set policy
    }

    function testOnlyAdminCanRemovePolicy() public {
        // TODO: Verify only ADMIN_ROLE can remove policy
    }

    function testOnlyAdminCanMarkPolicyToClaim() public {
        // TODO: Verify only ADMIN_ROLE can mark policy to claim
    }

    function testOnlyAdminCanSetExchangeAgent() public {
        // TODO: Verify only ADMIN_ROLE can set exchange agent
    }

    function testOnlyAdminCanSetSalesPolicyFactory() public {
        // TODO: Verify only ADMIN_ROLE can set sales policy factory
    }

    function testOnlyAdminCanSetOperator() public {
        // TODO: Verify only ADMIN_ROLE can set operator
    }

    function testOnlyAdminCanSetUSDCToken() public {
        // TODO: Verify only ADMIN_ROLE can set USDC token
    }

    function testOnlyAdminCanAddPoolWhitelist() public {
        // TODO: Verify only ADMIN_ROLE can add pool to whitelist
    }

    function testOnlyAdminCanRemovePoolWhitelist() public {
        // TODO: Verify only ADMIN_ROLE can remove pool from whitelist
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

        (,, bool exist,) = capitalAgent.getPoolInfo(pool);
        assertFalse(exist);
    }

    function testRemoveNonExistentPool() public {
        address pool = address(0x5);

        vm.prank(multiSigWallet);
        vm.expectRevert("UnoRe: no exit pool");
        capitalAgent.removePool(pool);
    }
    }

    function testPoolAddedToPoolList() public {
        // TODO: Verify pool is added to poolList
    }

    function testCurrencyAddedToCurrencyList() public {
        // TODO: Verify currency is added to currencyList if new
    }

    function testSetPoolCapital() public {
        // TODO: Test setting pool capital as admin
    }

    function testSetCapitalNonExistentPool() public {
        // TODO: Test setting capital for non-existent pool
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

    function testSetPolicyAlreadyExists() public {
        address policy1 = address(0x7);
        address policy2 = address(0x8);

        vm.startPrank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy1);
        vm.expectRevert("UnoRe: Policy exists");
        capitalAgent.setPolicyByAdmin(policy2);
        vm.stopPrank();
    }

    function testRemovePolicy() public {
        address policy = address(0x7);

        vm.startPrank(multiSigWallet);
        capitalAgent.setPolicyByAdmin(policy);
        capitalAgent.removePolicy();
        vm.stopPrank();

        (address policyAddress,, bool exist) = capitalAgent.getPolicyInfo();
        assertEq(policyAddress, address(0));
        assertFalse(exist);
    }

    function testRemoveNonExistentPolicy() public {
        // TODO: Test removing non-existent policy
    }

    function testPolicyInfoUpdated() public {
        // TODO: Verify policy info is updated correctly
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

    function testSSIPStaking() public {
        // TODO: Test SSIP staking with valid amount
    }

    function testUpdatePoolWithdrawPendingCapitalAdd() public {
        // TODO: Test updating pool withdraw pending capital (add)
    }

    function testUpdatePoolWithdrawPendingCapitalSubtract() public {
        // TODO: Test updating pool withdraw pending capital (subtract)
    }

    function testUpdateWithdrawPendingCapitalNonExistentPool() public {
        // TODO: Test updating withdraw pending capital for non-existent pool
    }

    // 6. MLR Checks
    function testCheckCapitalByMLRPass() public {
        // TODO: Test check capital by MLR (should pass)
    }

    function testCheckCapitalByMLRFail() public {
        // TODO: Test check capital by MLR (should fail)
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
        vm.expectEmit(true, true, false, false);
        emit LogAddPool(pool, currency);
        capitalAgent.addPoolByAdmin(pool, currency);
    }

    function testLogRemovePoolEvent() public {
        address pool = address(0x5);
        address currency = address(0x6);

        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolByAdmin(pool, currency);
        vm.expectEmit(true, false, false, false);
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
        // TODO: Verify LogRemovePolicy event emission
    }

    function testLogUpdatePoolCapitalEvent() public {
        // TODO: Verify LogUpdatePoolCapital event emission
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
        // TODO: Verify LogSetMLR event emission
    }

    function testLogSetExchangeAgentEvent() public {
        // TODO: Verify LogSetExchangeAgent event emission
    }

    function testLogSetSalesPolicyFactoryEvent() public {
        // TODO: Verify LogSetSalesPolicyFactory event emission
    }

    function testLogAddPoolWhiteListEvent() public {
        // TODO: Verify LogAddPoolWhiteList event emission
    }

    function testLogRemovePoolWhiteListEvent() public {
        // TODO: Verify LogRemovePoolWhiteList event emission
    }

    function testLogSetOperatorEvent() public {
        // TODO: Verify LogSetOperator event emission
    }

    function testLogSetUSDCEvent() public {
        // TODO: Verify LogSetUSDC event emission
    }

    function testLogUpdatePoolWithdrawPendingCapitalEvent() public {
        // TODO: Verify LogupdatePoolWithdrawPendingCapital event emission
    }

    // 10. Edge Cases and Boundary Testing
    function testMaxUint256Values() public {
        // TODO: Test with maximum uint256 values where applicable
    }

    function testMinValues() public {
        // TODO: Test with minimum (1) values where applicable
    }

    function testZeroValues() public {
        // TODO: Test with zero values where applicable and should be rejected
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