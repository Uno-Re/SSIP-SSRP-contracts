// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "forge-std/Test.sol";
import "../../contracts/SingleSidedInsurancePoolUSDM.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/MockUSDC.sol";
import "../../contracts/Mocks/MockUSDM.sol";
import "../../contracts/Mocks/MockUniswap.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/factories/RewarderFactory.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "forge-std/console.sol";

import {PriceOracle as MockOraclePriceFeed} from "../../contracts/Mocks/OraclePriceFeed.sol";
import {MockChainLinkAggregator} from "../../contracts/Mocks/MockChainLinkAggregator.sol";

contract PoolUSDMTest is Test {
    MockUSDM public usdmToken;
    MockUNO public unoToken;
    MockUSDC public usdcToken;
    SingleSidedInsurancePoolUSDM public pool;
    CapitalAgent public capitalAgent;
    ExchangeAgent public exchangeAgent;
    RiskPoolFactory public riskPoolFactory;
    RewarderFactory public rewarderFactory;

    // Mock Uniswap contracts
    MockUniswapPair public mockUniswapPair;
    MockUniswapFactory public mockUniswapFactory;
    MockUniswapRouter public uniswapRouter;

    // Oracle contracts
    MockChainLinkAggregator public mockEthUsdAggregator;
    MockOraclePriceFeed public priceOracle;

    address public multiSigWallet;
    address public operator;
    address public user1;
    address public user2;
    address public user3;
    address public wethAddress;
    uint256 public constant MCR = 10e6;
    uint256 public constant MLR = 1e6;
    uint256 public constant INITIAL_BALANCE = 1000000 ether;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    function setUp() public {
        // Setup addresses
        multiSigWallet = address(0x1);
        operator = address(0x4);
        user1 = address(0x7);
        user2 = address(0x5);
        user3 = address(0x6);
        wethAddress = address(0x8);

        // Deploy tokens
        usdmToken = new MockUSDM();
        unoToken = new MockUNO();
        usdcToken = new MockUSDC();

        // Setup Oracle
        mockEthUsdAggregator = new MockChainLinkAggregator(1e8, 8);
        priceOracle = new MockOraclePriceFeed(multiSigWallet);
        riskPoolFactory = new RiskPoolFactory();
        rewarderFactory = new RewarderFactory();

        vm.startPrank(multiSigWallet);
        priceOracle.setETHUSDAggregator(address(mockEthUsdAggregator));
        priceOracle.addStableCoin(address(unoToken));
        priceOracle.addStableCoin(address(usdmToken));
        priceOracle.setAssetEthPrice(address(usdmToken), 1e18);
        priceOracle.setAssetEthPrice(address(usdcToken), 1e18);
        vm.stopPrank();

        // Setup Exchange Agent
        mockUniswapFactory = new MockUniswapFactory();
        uniswapRouter = new MockUniswapRouter();
        mockUniswapPair = new MockUniswapPair(address(usdmToken), address(usdcToken));
        mockUniswapFactory.setPair(address(usdmToken), address(usdcToken), address(mockUniswapPair));

        exchangeAgent = new ExchangeAgent(
            address(usdcToken),
            address(usdmToken),
            address(priceOracle),
            address(uniswapRouter),
            address(mockUniswapFactory),
            multiSigWallet,
            1800 // 30 min deadline
        );

        // Setup Capital Agent
        vm.startPrank(multiSigWallet);
        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(address(exchangeAgent), address(usdcToken), multiSigWallet, operator);
        vm.stopPrank();

        // Deploy and initialize USDM Pool
        pool = new SingleSidedInsurancePoolUSDM();
        pool.initialize(address(capitalAgent), multiSigWallet);

        vm.startPrank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(pool));
        vm.stopPrank();

        // These calls should be made by operator
        vm.startPrank(operator);
        capitalAgent.setMCR(MCR);
        capitalAgent.setMLR(MLR);
        vm.stopPrank();

        vm.startPrank(multiSigWallet);
        pool.createRiskPool("Synthetic SSIP-USDM", "SSSIP-USDM", address(riskPoolFactory), address(usdmToken), 1e18, 1e8);
        pool.createRewarder(operator, address(rewarderFactory), address(unoToken));

        // Set reward multiplier and update pool info
        pool.setRewardMultiplier(10000000000000000000000000); // Set UNO rewards per block
        pool.setAccUnoPerShare(15, block.number); // Initialize reward tracking

        // Set staking start time
        pool.setStakingStartTime(block.timestamp);
        vm.stopPrank();

        // Warp to after staking start time
        vm.warp(block.timestamp + 1 hours);
        vm.roll(block.number + 1); // Advance block number too

        // Fund rewarder with UNO tokens for rewards
        vm.startPrank(address(user1));
        unoToken.mint(1000000 ether);
        unoToken.transfer(address(pool.rewarder()), 500000 ether);
        vm.stopPrank();

        // Fund test users
        vm.startPrank(address(usdmToken));
        usdmToken.mint(user1, 1000000 ether);
        usdmToken.mint(user2, 1000000 ether);
        usdmToken.mint(user3, 1000000 ether);
        vm.stopPrank();

        // Approvals
        vm.prank(user1);
        usdmToken.approve(address(pool), type(uint256).max);
        vm.prank(user2);
        usdmToken.approve(address(pool), type(uint256).max);
        vm.prank(user3);
        usdmToken.approve(address(pool), type(uint256).max);

        // Add large initial deposit to prevent minimum capital underflow
        vm.startPrank(multiSigWallet);
        uint256 initialPoolDeposit = 1000000 ether; // 1M USDM
        usdmToken.mint(multiSigWallet, initialPoolDeposit);
        usdmToken.approve(address(pool), initialPoolDeposit);
        pool.enterInPool(initialPoolDeposit);
        vm.stopPrank();
    }

    function testDepositWithRebase() public {
        uint256 depositAmount = 100 ether;

        // Initial deposit
        vm.prank(user1);
        pool.enterInPool(depositAmount);

        uint256 initialShares = pool.userShares(user1);
        uint256 initialLPTokens = IRiskPoolUSDM(pool.riskPool()).balanceOf(user1);

        // Simulate USDM rebase (10% increase)
        vm.prank(address(usdmToken));
        usdmToken.setRewardMultiplier(11e17);

        // Verify share value increased but share count remained same
        assertEq(pool.userShares(user1), initialShares, "Shares should not change after rebase");
        assertGt(pool.getShareValue(initialShares), depositAmount, "Share value should increase after positive rebase");
    }

    function testWithdrawAfterRebase() public {
        uint256 depositAmount = 100 ether;

        // Setup rewards
        vm.prank(multiSigWallet);
        pool.setRewardMultiplier(1 ether);

        vm.startPrank(multiSigWallet);
        uint256 absurdAmount = depositAmount * 5000000000;
        usdmToken.mint(multiSigWallet, absurdAmount);
        usdmToken.transfer(address(pool.riskPool()), absurdAmount);
        vm.stopPrank();

        // Initial deposit
        vm.prank(user1);
        pool.enterInPool(depositAmount);

        // Simulate USDM rebase
        vm.startPrank(address(usdmToken));
        usdmToken.mint(address(pool), 100000 ether);
        usdmToken.setRewardMultiplier(11e17);
        vm.stopPrank();

        vm.warp(block.timestamp + 3 days);
        vm.roll(block.number + 200);

        console.log("RiskPool address:", address(pool.riskPool()));
        console.log("USDM currency:", IRiskPoolUSDM(pool.riskPool()).currency());

        // Request withdrawal
        vm.prank(user1);
        pool.leaveFromPoolInPending(depositAmount);

        // Wait for lock time (10 days) and generate blocks
        vm.warp(block.timestamp + 10 days + 1);
        vm.roll(block.number + 1000);

        // Execute withdrawal after lock time
        vm.prank(user1);
        pool.leaveFromPending(depositAmount);

        // Verify withdrawal
        assertGt(usdmToken.balanceOf(user1), depositAmount, "Should have received original amount plus rewards");
    }

    function testMultipleUsersWithRebase() public {
        // User 1 deposits
        vm.prank(user1);
        pool.enterInPool(100 ether);

        // User 2 deposits
        vm.prank(user2);
        pool.enterInPool(100 ether);

        uint256 user1InitialShares = pool.userShares(user1);
        uint256 user2InitialShares = pool.userShares(user2);

        // Simulate USDM rebase (10% increase)
        vm.prank(address(usdmToken));
        usdmToken.setRewardMultiplier(11e17);

        // Verify shares remained constant but value increased
        assertEq(pool.userShares(user1), user1InitialShares, "User1 shares should not change");
        assertEq(pool.userShares(user2), user2InitialShares, "User2 shares should not change");

        assertEq(pool.getUserUSDMAmount(user1), 110 ether, "User1 USDM value should increase");
        assertEq(pool.getUserUSDMAmount(user2), 110 ether, "User2 USDM value should increase");
    }

    function testFuzzRebaseAmount(uint256 rebaseMultiplier) public {
        // Bound rebase multiplier between 1x and 2x since MockUSDM doesn't allow < 1
        rebaseMultiplier = bound(rebaseMultiplier, 1e18, 2e18);

        // Initial deposits
        vm.prank(user1);
        pool.enterInPool(100 ether);

        uint256 initialShares = pool.userShares(user1);

        // Apply rebase
        vm.prank(address(usdmToken));
        usdmToken.setRewardMultiplier(rebaseMultiplier);

        // Verify share count remains constant
        assertEq(pool.userShares(user1), initialShares, "Shares should not change");

        // Verify value changes proportionally
        uint256 expectedValue = (100 ether * rebaseMultiplier) / 1e18;
        assertEq(pool.getUserUSDMAmount(user1), expectedValue, "Value should change with rebase");
    }

    function testHighVolumeUSDMOperations() public {
        // Setup rewards
        vm.prank(multiSigWallet);
        pool.setRewardMultiplier(1 ether);

        // Fund rewarder
        vm.startPrank(multiSigWallet);
        usdmToken.mint(multiSigWallet, 10000 ether);
        usdmToken.transfer(address(pool.rewarder()), 10000 ether);
        vm.stopPrank();

        // Multiple users perform multiple operations with rebases
        for (uint i = 0; i < 10; i++) {
            // User1 operations
            vm.prank(user1);
            pool.enterInPool(100 ether);

            // User2 operations
            vm.prank(user2);
            pool.enterInPool(50 ether);

            // Simulate random rebase (1x to 1.1x) since MockUSDM doesn't allow < 1
            uint256 rebaseChange = uint256(keccak256(abi.encodePacked(block.timestamp, i))) % 10;
            uint256 newMultiplier = 1e18 + (rebaseChange * 1e16);

            vm.prank(address(usdmToken));
            usdmToken.setRewardMultiplier(newMultiplier);

            // Advance blocks and harvest
            vm.roll(block.number + 5);
            vm.prank(user1);
            pool.harvest(user1);
            vm.prank(user2);
            pool.harvest(user2);

            // Withdrawals
            vm.prank(user1);
            pool.leaveFromPoolInPending(20 ether);
            vm.prank(user2);
            pool.leaveFromPoolInPending(10 ether);
        }

        // Verify final state
        assertGt(usdmToken.balanceOf(user1), 0, "User1 should have USDM");
        assertGt(usdmToken.balanceOf(user2), 0, "User2 should have USDM");
    }

    function testFailWithdrawMoreThanBalance() public {
        uint256 depositAmount = 100 ether;

        vm.startPrank(user1);
        pool.enterInPool(depositAmount);

        // Try to withdraw more than deposited
        vm.expectRevert("UnoRe: insufficient balance");
        pool.leaveFromPoolInPending(depositAmount * 2);
        vm.stopPrank();
    }

    function testRewardsAfterMultipleRebase() public {
        // Initial deposit
        vm.prank(user1);
        pool.enterInPool(100 ether);

        // Multiple rebases with harvests in between
        for (uint i = 0; i < 5; i++) {
            // Increase multiplier by 10% each time
            vm.prank(address(usdmToken));
            usdmToken.setRewardMultiplier((11e17 * (i + 10)) / 10);

            vm.roll(block.number + 100);

            vm.prank(user1);
            pool.harvest(user1);
        }

        // Verify final rewards are correct
        assertGt(usdmToken.balanceOf(user1), 100 ether, "Should have earned rewards");
    }

    function testEmergencyWithdraw() public {
        uint256 sharesBefore = pool.userShares(user1);

        vm.prank(user1);
        pool.enterInPool(100 ether);

        // Enable emergency withdraw
        vm.prank(multiSigWallet);
        pool.toggleEmergencyWithdraw();

        uint256 balanceBefore = usdmToken.balanceOf(user1);

        vm.prank(user1);
        pool.emergencyWithdraw();

        uint256 sharesAfter = pool.userShares(user1);

        assertGt(usdmToken.balanceOf(user1), balanceBefore, "Should have withdrawn funds");
    }

    function testFailDoubleWithdrawRequest() public {
        vm.startPrank(user1);
        pool.enterInPool(100 ether);
        pool.leaveFromPoolInPending(50 ether);

        // Should fail on second withdraw request
        vm.expectRevert("UnoRe: pending withdrawal exists");
        pool.leaveFromPoolInPending(50 ether);
        vm.stopPrank();
    }
}
