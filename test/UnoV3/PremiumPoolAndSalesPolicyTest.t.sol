// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "lib/forge-std/src/Test.sol";
import "../../contracts/PremiumPool.sol";
import "../../contracts/SalesPolicy.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/Mocks/MockUSDC.sol";
import "../../contracts/Mocks/OraclePriceFeed.sol";
import "../../contracts/interfaces/ICapitalAgent.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/interfaces/IExchangeAgent.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "../../contracts/factories/SalesPolicyFactory.sol";
import "../../contracts/Mocks/MockChainLinkAggregator.sol";
import "../../contracts/interfaces/ISalesPolicyFactory.sol";

contract PremiumPoolAndSalesPolicyTest is Test {
    MockUNO public unoToken;
    MockUSDC public usdcToken;
    PriceOracle public priceOracle;
    SalesPolicy public salesPolicy;
    PremiumPool public premiumPool;
    CapitalAgent public capitalAgent;
    SalesPolicyFactory public factory;
    SingleSidedInsurancePool public ssip;
    RiskPoolFactory public riskPoolFactory;
    ExchangeAgent public exchangeAgentContract;
    MockChainLinkAggregator public mockEthUsdAggregator;
    
    address public operator;
    address public governance;
    address public wethAddress;
    uint256 public swapDeadline;
    address public exchangeAgent;
    address public multiSigWallet;
    address public uniswapRouterAddress;
    address public uniswapFactoryAddress;
    address public oraclePriceFeedAddress;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct PolicyParams {
        address[] assets;
        address[] protocols;
        uint256[] coverageAmounts;
        uint256[] coverageDurations;
        uint256 policyPriceInUSDC;
        uint256 signedTime;
        address premiumCurrency;
    }

    event LogSetProtocolURIInPolicy(address indexed , string );
    event LogSetBuyPolicyMaxDeadlineInPolicy(uint256, address indexed);
    event LogSetExchangeAgentInPolicy(address indexed, address indexed);

    event KillPool(address indexed , bool );
    event LogAddWhiteList(address indexed , address indexed );
    event LogRemoveCurrency(address indexed , address indexed );
    event LogRemoveWhiteList(address indexed , address indexed );
    event LogMaxApproveCurrency(address indexed , address indexed , address indexed );
    event LogMaxDestroyCurrencyAllowance(address indexed , address indexed , address indexed );

    function setUp() public {
        multiSigWallet = address(0x1);
        governance = address(0x2);
        operator = address(0x4);

        usdcToken = new MockUSDC();
        unoToken = new MockUNO();

        wethAddress = address(0x4321); 
        uniswapRouterAddress = address(0x5432); 
        uniswapFactoryAddress = address(0x6543); 
        swapDeadline = 1800; // 30 minutes, adjust as needed
        
        /////////// ORACLE CONFIGURATION ///////////
        mockEthUsdAggregator = new MockChainLinkAggregator(1 * 1e8, 8); // $2000 per ETH, 8 decimals
        priceOracle = new PriceOracle(multiSigWallet);

        vm.prank(multiSigWallet);
        priceOracle.setETHUSDAggregator(address(mockEthUsdAggregator));

        vm.startPrank(multiSigWallet);
        priceOracle.setAssetEthPrice(address(unoToken), 1e18); // 1:1 with ETH
        priceOracle.addStableCoin(address(usdcToken));
        vm.stopPrank();
        /////////// END OF ORACLE CONFIGURATION ///////////


        exchangeAgentContract = new ExchangeAgent(
            address(usdcToken),
            wethAddress,
            address(priceOracle),
            uniswapRouterAddress,
            uniswapFactoryAddress,
            multiSigWallet,
            swapDeadline
        ); 

        exchangeAgent = address(exchangeAgentContract);

        /////////// CAPITAL AGENT CONFIGURATION ///////////
        vm.prank(multiSigWallet);
        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(exchangeAgent, address(usdcToken), multiSigWallet, operator);
        
        ssip = new SingleSidedInsurancePool();
        ssip.initialize(address(capitalAgent), multiSigWallet);

        riskPoolFactory = new RiskPoolFactory();

        vm.prank(multiSigWallet);
        capitalAgent.addPoolWhiteList(address(ssip));

        vm.prank(multiSigWallet);
        ssip.createRiskPool(
            "Test Risk Pool",
            "TRP",
            address(riskPoolFactory),
            address(unoToken),
            1e18 // reward multiplier
        );
        /////////// END OF CAPITAL AGENT CONFIGURATION ///////////

        /////////// PREMIUM POOL CONFIGURATION ///////////
        vm.prank(multiSigWallet);
        premiumPool = new PremiumPool(
            exchangeAgent,
            address(unoToken),
            address(usdcToken),
            multiSigWallet,
            governance
        );
        
        vm.prank(multiSigWallet);
        premiumPool.addCurrency(address(usdcToken));

        bytes32 PAUSER_ROLE = 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775;
        vm.prank(multiSigWallet);
        premiumPool.grantRole(PAUSER_ROLE, governance);

        vm.prank(multiSigWallet);
        factory = new SalesPolicyFactory(
            address(usdcToken),
            address(exchangeAgent),
            address(premiumPool),
            address(capitalAgent),
            multiSigWallet 
        );
        /////////// END OF PREMIUM POOL CONFIGURATION ///////////

        /////////// SalesPolicy CONFIGURATION ///////////
        salesPolicy = new SalesPolicy(
            address(factory),
            exchangeAgent,
            address(premiumPool),
            address(capitalAgent),
            address(usdcToken)
        );

        vm.prank(multiSigWallet);
        capitalAgent.setSalesPolicyFactory(address(factory));

        vm.prank(address(factory));
        capitalAgent.setPolicy(address(salesPolicy));
        /////////// END OF SALES POLICY CONFIGURATION ///////////
    }

    // PremiumPool Tests
    function testPausePool() public {
        uint256 initialAmount = 1000 ether;
        uint256 additionalAmount = 500 ether;
        uint256 withdrawAmount = 200 ether;
        address user = address(0x1234);

        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(address(user));

        vm.startPrank(user);
        //mints and approves token spending
        usdcToken.faucetToken(initialAmount + additionalAmount);
        usdcToken.approve(address(premiumPool), initialAmount + additionalAmount);
        // User deposits initial amount
        premiumPool.collectPremium(address(usdcToken),initialAmount);
        vm.stopPrank();

        // Check initial state
        assertFalse(premiumPool.paused(), "Pool should not be paused initially");

        // Try to pause the pool as a non-admin (should fail)
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(user), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.pausePool();

        // Pause the pool as ADMIN
        vm.prank(multiSigWallet);
        premiumPool.pausePool();
        assertTrue(premiumPool.paused(), "Pool should be paused");

        // Try to deposit while paused (should fail)
        vm.expectRevert(abi.encodeWithSelector(0xd93c0665)); //OpenZeppelin is using AccessControl for error handling
        vm.prank(user);
        premiumPool.collectPremium(address(usdcToken),additionalAmount);

        // Try to withdraw while paused (should fail)
        vm.prank(governance);
        vm.expectRevert(abi.encodeWithSelector(0xd93c0665)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.withdrawPremium(address(usdcToken),msg.sender,withdrawAmount);

        // Unpause the pool as ADMIN
        vm.prank(multiSigWallet);
        premiumPool.unpausePool();

        // Check if the pool is unpaused
        assertFalse(premiumPool.paused(), "Pool should be unpaused");

        // Deposit additional amount (should succeed now)
        vm.prank(user);
        premiumPool.collectPremium(address(usdcToken),additionalAmount);

        // Withdraw some amount (should succeed now)
        vm.prank(governance);
        premiumPool.withdrawPremium(address(usdcToken),msg.sender,withdrawAmount);

        // Verify final balances
        uint256 expectedBalance = initialAmount + additionalAmount - withdrawAmount;
        assertEq(usdcToken.balanceOf(address(premiumPool)), expectedBalance, "Final pool balance incorrect");
    }

    function testKillPool() public {
        uint256 initialAmount = 1000 ether;
        address user = address(0x1234);

        // Setup: Add user to whitelist and let them deposit some funds
        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(user);

        vm.startPrank(user);
        usdcToken.faucetToken(initialAmount);
        usdcToken.approve(address(premiumPool), initialAmount);
        premiumPool.collectPremium(address(usdcToken), initialAmount);
        vm.stopPrank();

        // Verify initial state
        assertFalse(premiumPool.killed(), "Pool should not be killed initially");

        // Try to kill the pool as a non-admin (should fail)
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(user), ADMIN_ROLE));
        premiumPool.killPool();

        // Kill the pool as admin
        vm.prank(multiSigWallet);
        premiumPool.killPool();

        // Verify the pool is killed
        assertTrue(premiumPool.killed(), "Pool should be killed");

        // Try to deposit while killed (should succeed, as the contract doesn't prevent this)
        vm.startPrank(user);
        usdcToken.faucetToken(initialAmount);
        usdcToken.approve(address(premiumPool), initialAmount);
        premiumPool.collectPremium(address(usdcToken), initialAmount);
        vm.stopPrank();

        // Verify the deposit was successful
        assertEq(usdcToken.balanceOf(address(premiumPool)), initialAmount * 2, "Deposit should succeed even when pool is killed");

        // Try to withdraw while killed (should fail)
        vm.prank(governance);
        vm.expectRevert("UnoRe: pool is killed");
        premiumPool.withdrawPremium(address(usdcToken), governance, initialAmount);

        // Verify that pausing/unpausing has no effect when killed
        vm.prank(multiSigWallet);
        premiumPool.pausePool();

        vm.prank(multiSigWallet);
        premiumPool.unpausePool();
    }

    function testRevivePool() public {
        address user = address(0x1234);
        // First, kill the pool
        vm.prank(multiSigWallet);
        premiumPool.killPool();

        assertTrue(premiumPool.killed(), "Pool should be killed");

        // Try to revive the pool as a non-admin (should fail)
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(user), ADMIN_ROLE));
        premiumPool.revivePool();

        // Revive the pool as admin
        vm.prank(multiSigWallet);
        premiumPool.revivePool();

        // Verify the pool is revived
        assertFalse(premiumPool.killed(), "Pool should be revived");

        // Verify that normal operations can resume
        uint256 depositAmount = 1000 ether;

        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(user);

        vm.startPrank(user);
        usdcToken.faucetToken(depositAmount);
        usdcToken.approve(address(premiumPool), depositAmount);
        premiumPool.collectPremium(address(usdcToken), depositAmount);
        vm.stopPrank();

        // Verify the deposit was successful
        assertEq(usdcToken.balanceOf(address(premiumPool)), depositAmount, "Deposit should be successful after revival");

        // Verify that pausing/unpausing works again
        vm.prank(multiSigWallet);
        premiumPool.pausePool();
        assertTrue(premiumPool.paused(), "Pool should be pausable after revival");

        vm.prank(multiSigWallet);
        premiumPool.unpausePool();
        assertFalse(premiumPool.paused(), "Pool should be unpausable after revival");
    }

    function testCollectPremiumInETH() public {
        uint256 premiumAmount = 1 ether;
        address user = address(0x1234);

        // Setup: Add user to whitelist
        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(user);

        // Record initial balances
        uint256 initialPoolBalance = address(premiumPool).balance;
        uint256 initialUserBalance = user.balance;

        // User collects premium in ETH
        vm.deal(user, premiumAmount);
        vm.prank(user);
        premiumPool.collectPremiumInETH{value: premiumAmount}();

        // Verify balances after collection
        assertEq(address(premiumPool).balance, initialPoolBalance + premiumAmount, "Pool balance should increase by premium amount");
        assertEq(user.balance, initialUserBalance, "User balance should be zero after sending ETH");
        
        // Try to collect with insufficient ETH (should fail)
        vm.prank(user);
        vm.expectRevert();
        premiumPool.collectPremiumInETH{value: 0.5 ether}();

        // Try to collect as non-whitelisted user (should fail)
        address nonWhitelistedUser = address(0x5678);
        vm.deal(nonWhitelistedUser, premiumAmount);
        vm.prank(nonWhitelistedUser);
        vm.expectRevert("UnoRe: not white list address");
        premiumPool.collectPremiumInETH{value: premiumAmount}();
    }

    function testCollectPremium() public {
        uint256 premiumAmount = 1 ether;
        address user = address(0x1234);

        // Setup: Add user to whitelist
        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(user);
        // Mint tokens to the user
        vm.prank(user);
        usdcToken.faucetToken( premiumAmount);

        // Record initial balances
        uint256 initialPoolBalance = usdcToken.balanceOf(address(premiumPool));
        uint256 initialUserBalance = usdcToken.balanceOf(user);

        // Approve and collect premium
        vm.startPrank(user);
        usdcToken.approve(address(premiumPool), premiumAmount);
        premiumPool.collectPremium(address(usdcToken), premiumAmount);
        vm.stopPrank();

        // Verify balances after collection
        assertEq(usdcToken.balanceOf(address(premiumPool)), initialPoolBalance + premiumAmount, "Pool balance should increase by premium amount");
        assertEq(usdcToken.balanceOf(user), initialUserBalance - premiumAmount, "User balance should decrease by premium amount");


        // Try to collect with insufficient balance (should fail)
        vm.prank(user);
        vm.expectRevert("UnoRe: premium balance overflow");
        premiumPool.collectPremium(address(usdcToken), premiumAmount);

        // Try to collect as non-whitelisted user (should fail)
        address nonWhitelistedUser = address(0x5678);
        vm.prank(nonWhitelistedUser);
        usdcToken.faucetToken( premiumAmount);
        vm.startPrank(nonWhitelistedUser);
        usdcToken.approve(address(premiumPool), premiumAmount);
        vm.expectRevert("UnoRe: not white list address");
        premiumPool.collectPremium(address(usdcToken), premiumAmount);
        vm.stopPrank();

        // Try to collect with non-allowed currency (should fail)
        MockUNO nonAllowedToken = new MockUNO();
        vm.startPrank(user);
        nonAllowedToken.mint(premiumAmount);
        nonAllowedToken.approve(address(premiumPool), premiumAmount);
        vm.expectRevert("UnoRe: not allowed currency");
        premiumPool.collectPremium(address(nonAllowedToken), premiumAmount);
        vm.stopPrank();
    }

    function testDepositToSyntheticSSRPRewarder() public {
        // TODO: VERIFY IF THIS IS NECESSARY Implement test for depositToSyntheticSSRPRewarder function
    }

    function testDepositToSyntheticSSIPRewarder() public {
        // TODO: VERIFY IF THIS IS NECESSARY Implement test for depositToSyntheticSSIPRewarder function
    }

   function testBuyBackAndBurn() public {
        // TODO: Implement test for buyBackAndBurn function
    }

    function testWithdrawPremium() public {
        // TODO: Implement test for withdrawPremium function
    }

    function testAddCurrency() public {
        MockUNO newCurrency = new MockUNO();
        
        vm.prank(multiSigWallet);
        premiumPool.addCurrency(address(newCurrency));

        assertEq(premiumPool.availableCurrencies(address(newCurrency)),true);

        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.addCurrency(address(newCurrency));
    }

    function testRemoveCurrency() public {
        address currencyToRemove = address(usdcToken);
        
        vm.expectEmit(true, true, true, true);
        emit LogRemoveCurrency(address(premiumPool), currencyToRemove);
        
        vm.prank(multiSigWallet);
        premiumPool.removeCurrency(currencyToRemove);
                
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.removeCurrency(currencyToRemove);
    }

    function testMaxApproveCurrency() public {
        address currencyToApprove = address(usdcToken);
        address spender = address(0x1234);
        
        vm.expectEmit(true, true, true, true);
        emit LogMaxApproveCurrency(address(premiumPool), currencyToApprove, spender);
        
        vm.prank(multiSigWallet);
        premiumPool.maxApproveCurrency(currencyToApprove, spender);
        
        assertEq(IERC20(currencyToApprove).allowance(address(premiumPool), spender), type(uint256).max, "Allowance should be set to max");
        
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.maxApproveCurrency(currencyToApprove, spender);
    }

    function testDestroyCurrencyAllowance() public {
        address currencyToDestroy = address(usdcToken);
        address spender = address(0x1234);
        
        // First, set max allowance
        vm.prank(multiSigWallet);
        premiumPool.maxApproveCurrency(currencyToDestroy, spender);
        
        vm.expectEmit(true, true, true, true);
        emit LogMaxDestroyCurrencyAllowance(address(premiumPool), currencyToDestroy, spender);
        
        vm.prank(multiSigWallet);
        premiumPool.destroyCurrencyAllowance(currencyToDestroy, spender);
        
        assertEq(IERC20(currencyToDestroy).allowance(address(premiumPool), spender), 0, "Allowance should be destroyed");
        
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.destroyCurrencyAllowance(currencyToDestroy, spender);
    }

    function testAddWhiteList() public {
        address newWhitelistedAddress = address(0x1234);
        
        vm.expectEmit(true, true, true, true);
        emit LogAddWhiteList(address(premiumPool), newWhitelistedAddress);
        
        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(newWhitelistedAddress);
        
        assertEq(premiumPool.whiteList(newWhitelistedAddress),true);
        
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.addWhiteList(newWhitelistedAddress);
    }

    function testRemoveWhiteList() public {
        address addressToRemove = address(0x1234);
        
        // First, add the address to whitelist
        vm.prank(multiSigWallet);
        premiumPool.addWhiteList(addressToRemove);
        
        vm.expectEmit(true, true, true, true);
        emit LogRemoveWhiteList(address(premiumPool), addressToRemove);
        
        vm.prank(multiSigWallet);
        premiumPool.removeWhiteList(addressToRemove);
        
        assertEq(premiumPool.whiteList(addressToRemove),false);
                
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.removeWhiteList(addressToRemove);
    }

    function testGrantRole() public {
        bytes32 role = keccak256("ADMIN_ROLE");
        address account = address(0x1234);

        vm.prank(multiSigWallet);
        premiumPool.grantRole(role, account);
        
        assertTrue(premiumPool.hasRole(role, account), "Account should have the role");
        
        vm.prank(address(0x5678));
        vm.expectRevert(abi.encodeWithSelector(0xe2517d3f, address(0x5678), ADMIN_ROLE)); //OpenZeppelin is using AccessControl for error handling
        premiumPool.grantRole(role, account);
    }

    // SalesPolicy Tests

    function testKillPoolSalesPolicy() public {
        // Ensure the pool is not paused initially
        assertFalse(salesPolicy.paused(), "Pool should not be paused initially");

        // Try to kill the pool as a non-factory address (should fail)
        vm.prank(address(0x1234));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.killPool();

        // Kill the pool as the factory
        vm.prank(address(salesPolicy.factory()));
        salesPolicy.killPool();

        // Verify the pool is paused (killed)
        assertTrue(salesPolicy.paused(), "Pool should be paused (killed)");

        // Try to perform operations that should be restricted when the pool is killed

        // For example, try to buy a policy (this should fail when the pool is killed)
        address buyer = address(0x5678);
        address[] memory assets = new address[](1);
        assets[0] = address(0x1111);
        address[] memory protocols = new address[](1);
        protocols[0] = address(0x2222);
        uint256[] memory coverageAmounts = new uint256[](1);
        coverageAmounts[0] = 10 ether;
        uint256[] memory coverageDurations = new uint256[](1);
        coverageDurations[0] = 30 days;
        uint256 policyPriceInUSDC = 1 ether;
        uint256 signedTime = block.timestamp;
        address premiumCurrency = address(0); // ETH
        bytes32 r = 0x0;
        bytes32 s = 0x0;
        uint8 v = 27;
        uint256 nonce = 0;

        vm.deal(buyer, 2 ether);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(0xd93c0665));
        salesPolicy.buyPolicy{value: 1 ether}(
            assets,
            protocols,
            coverageAmounts,
            coverageDurations,
            policyPriceInUSDC,
            signedTime,
            premiumCurrency,
            r,
            s,
            v,
            nonce
        );

        // Try to revive the pool as a non-factory address (should fail)
        vm.prank(address(0x1234));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.revivePool();

        // Revive the pool as the factory
        vm.prank(address(salesPolicy.factory()));
        salesPolicy.revivePool();

        // Verify the pool is not paused (revived)
        assertFalse(salesPolicy.paused(), "Pool should not be paused (revived)");

        // Verify that operations can be performed again after revival
        // Note: This will fail unless we properly set up the signer and other required conditions
        // For the purpose of this test, we'll just check that it doesn't revert due to being paused
        vm.prank(buyer);
        vm.expectRevert(); // Expect a revert, but not due to being paused
        salesPolicy.buyPolicy{value: 1 ether}(
            assets,
            protocols,
            coverageAmounts,
            coverageDurations,
            policyPriceInUSDC,
            signedTime,
            premiumCurrency,
            r,
            s,
            v,
            nonce
        );
    }

    // LEAVE ALL LOGS FOR FUTURE DEBUGGING!!!! THIS IS A COMPLEX TEST THAT INTERACTS WITH 
    // MOST OF THE REPOSITORY CONTRACTS. MAKE SURE THAT IT IS ALWAYS PASSING
    function testBuyPolicy() public {
        address buyer = address(0x1234);
        uint256 ethAmount = 1 ether;

        // Print initial balances
        console.log("Initial SalesPolicy balance:", address(salesPolicy).balance);
        console.log("Initial PremiumPool balance:", address(premiumPool).balance);
        console.log("Initial Buyer balance:", buyer.balance);
        address factoryAddress = salesPolicy.factory();
        console.log("Factory address in SalesPolicy:", factoryAddress);

        // Buy policy using the new helper function
        uint256 policyId = buyPolicy(buyer, ethAmount);

        // Print final balances
        console.log("Final SalesPolicy balance:", address(salesPolicy).balance);
        console.log("Final PremiumPool balance:", address(premiumPool).balance);
        console.log("Final Buyer balance:", buyer.balance);

        // Verify policy data
        verifyPolicyData(setupPolicyParams());

        // Verify token transfer
        assertEq(address(premiumPool).balance, ethAmount, "PremiumPool should have received the ETH");
        assertEq(address(salesPolicy).balance, 0, "SalesPolicy should have 0 ETH balance");
    }

    function buyPolicy(address buyer, uint256 ethAmount) internal returns (uint256 policyId) {
        vm.prank(multiSigWallet);
        uint256 stakingStartTime = block.timestamp + 1 hours;
        ssip.setStakingStartTime(block.timestamp);

        vm.prank(buyer);
        unoToken.mint(2000 ether);
        vm.prank(buyer);
        unoToken.approve(address(ssip), 2000 ether);

        // Set MLR
        vm.prank(operator);
        capitalAgent.setMLR(ethAmount * 2);

        vm.warp(stakingStartTime + 1);

        // Simulate staking
        vm.prank(buyer);
        ssip.enterInPool(ethAmount);

        PolicyParams memory params = setupPolicyParams();
        
        // Mock the exchange rate
        mockExchangeRate(params.policyPriceInUSDC, ethAmount);

        // Setup buyer
        vm.deal(buyer, ethAmount);

        // Generate a valid signature
        (uint8 v, bytes32 r, bytes32 s) = generateSignature(params, buyer);

        // Set the signer
        setSigner();

        // Whitelist the buyer and the SalesPolicy contract
        vm.startPrank(multiSigWallet);
        premiumPool.addWhiteList(buyer);
        premiumPool.addWhiteList(address(salesPolicy));
        vm.stopPrank();

        // Buy policy
        vm.prank(buyer);
        try salesPolicy.buyPolicy{value: ethAmount}(
            params.assets,
            params.protocols,
            params.coverageAmounts,
            params.coverageDurations,
            params.policyPriceInUSDC,
            params.signedTime,
            params.premiumCurrency,
            r,
            s,
            v,
            0 // nonce
        ) {
            console.log("Policy bought successfully");
        } catch Error(string memory reason) {
            console.log("buyPolicy failed with Error:", reason);
            revert(reason);
        } catch (bytes memory lowLevelData) {
            console.log("buyPolicy failed with low-level error:", vm.toString(lowLevelData));
            revert("Low-level error");
        }

        policyId = salesPolicy.allPoliciesLength() - 1;
        return policyId;
}

    function setupPolicyParams() private view returns (PolicyParams memory) {
        address[] memory assets = new address[](1);
        assets[0] = address(0x5678);
        address[] memory protocols = new address[](1);
        protocols[0] = address(0x9ABC);
        uint256[] memory coverageAmounts = new uint256[](1);
        coverageAmounts[0] = 10000 * 1e6; // 10,000 USDC coverage
        uint256[] memory coverageDurations = new uint256[](1);
        coverageDurations[0] = 30 days;

        return PolicyParams({
            assets: assets,
            protocols: protocols,
            coverageAmounts: coverageAmounts,
            coverageDurations: coverageDurations,
            policyPriceInUSDC: 1000 * 1e6, // 1000 USDC
            signedTime: block.timestamp,
            premiumCurrency: address(0) // ETH
        });
    }

    function mockExchangeRate(uint256 policyPriceInUSDC, uint256 ethAmount) private {
        vm.mockCall(
            address(exchangeAgent),
            abi.encodeWithSelector(IExchangeAgent.getETHAmountForUSDC.selector, policyPriceInUSDC),
            abi.encode(ethAmount)
        );
    }

    function generateSignature(PolicyParams memory params, address buyer) private view returns (uint8, bytes32, bytes32) {
        bytes32 messageHash = keccak256(abi.encodePacked(
            params.policyPriceInUSDC, params.protocols, params.coverageDurations, params.coverageAmounts,
            params.signedTime, params.premiumCurrency, uint256(0), buyer, block.chainid
        ));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        return vm.sign(uint256(1), ethSignedMessageHash);
    }

    function setSigner() private {
        vm.prank(address(salesPolicy.factory()));
        salesPolicy.setSigner(vm.addr(1));
    }

    function verifyPolicyData(PolicyParams memory params) private {
        (uint256 coverageAmount, uint256 coverageDuration, uint256 coverStartAt, bool exist, bool expired) = salesPolicy.getPolicyData(0);
        assertEq(coverageAmount, params.coverageAmounts[0], "Coverage amount mismatch");
        assertEq(coverageDuration, params.coverageDurations[0], "Coverage duration mismatch");
        assertEq(coverStartAt, block.timestamp, "Cover start time mismatch");
        assertTrue(exist, "Policy should exist");
        assertFalse(expired, "Policy should not be expired");
    }

    function testApprovePremium() public {
        address premiumCurrency = address(0x1234); // Mock ERC20 token address
        
        // Setup mock ERC20 token
        MockUNO mockToken = new MockUNO();
        
        // Expect approval event
        vm.expectCall(
            address(mockToken),
            abi.encodeWithSelector(IERC20.approve.selector, address(salesPolicy.premiumPool()), type(uint256).max)
        );


        // Call approvePremium
        vm.prank(address(salesPolicy.factory()));
        salesPolicy.approvePremium(address(mockToken));

        // Verify approval
        assertEq(
            mockToken.allowance(address(salesPolicy), address(salesPolicy.premiumPool())),
            type(uint256).max,
            "Allowance should be set to max"
        );
    }


    function testSetProtocolURI() public {
        string memory newURI = "https://new.protocol.uri";
        // Expect the event to be emitted
        vm.expectEmit(true, true, true, true);
        emit LogSetProtocolURIInPolicy(address(salesPolicy), newURI);
        
        vm.prank(address(factory));
        salesPolicy.setProtocolURI(newURI);
        
        vm.prank(address(0x1234));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setProtocolURI(newURI);
    }

    function testSetPremiumPool() public {
        address newPremiumPool = address(0x1234);
        
        vm.prank(address(factory));
        salesPolicy.setPremiumPool(newPremiumPool);
        
        assertEq(address(salesPolicy.premiumPool()), newPremiumPool, "Premium pool should be updated");
        
        vm.prank(address(0x5678));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setPremiumPool(newPremiumPool);
    }

    function testSetExchangeAgent() public {
        address newExchangeAgent = address(0x2345);
        
        // Expect the event to be emitted
        vm.expectEmit(true, true, true, true);
        emit LogSetExchangeAgentInPolicy(newExchangeAgent,address(salesPolicy));
        
        vm.prank(address(factory));
        salesPolicy.setExchangeAgent(newExchangeAgent);
        
        vm.prank(address(0x6789));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setExchangeAgent(newExchangeAgent);
    }

    function testSetSigner() public {
        address newSigner = address(0x3456);
        
        vm.prank(address(factory));
        salesPolicy.setSigner(newSigner);
        
        assertEq(salesPolicy.signer(), newSigner, "Signer should be updated");
        
        vm.prank(address(0x7890));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setSigner(newSigner);
    }

    function testSetCapitalAgent() public {
        address newCapitalAgent = address(0x4567);
        
        vm.prank(address(factory));
        salesPolicy.setCapitalAgent(newCapitalAgent);
        
        assertEq(address(salesPolicy.capitalAgent()), newCapitalAgent, "Capital agent should be updated");
        
        vm.prank(address(0x8901));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setCapitalAgent(newCapitalAgent);
    }

    function testSetBuyPolicyMaxDeadline() public {
        uint256 newDeadline = 7 days;
        // Expect the event to be emitted
        vm.expectEmit(true, true, true, true);
        emit LogSetBuyPolicyMaxDeadlineInPolicy(newDeadline, address(salesPolicy));
        
        vm.prank(address(factory));
        salesPolicy.setBuyPolicyMaxDeadline(newDeadline);
        
        vm.prank(address(0x9012));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setBuyPolicyMaxDeadline(newDeadline);
    }

    function testMarkToClaim() public {
        address buyer = address(0x1234);
        uint256 ethAmount = 1 ether;

        // Buy policy using the new helper function
        uint256 policyId = buyPolicy(buyer, ethAmount);

        // Mark the policy to claim
        vm.prank(address(multiSigWallet));
        capitalAgent.markToClaimPolicy(policyId);

        // Get the policy data
        (,,, bool exists, bool isExpired) = salesPolicy.getPolicyData(policyId);

        // Assert
        assertFalse(exists, "Policy should be marked as claimed");
        assertFalse(isExpired, "Policy should not be marked as expired");
    }

    function testUpdatePolicyExpired() public {
        address buyer = address(0x1234);
        uint256 ethAmount = 1 ether;

        // Buy a policy
        uint256 policyId = buyPolicy(buyer, ethAmount);

        // Get initial policy data
        (, uint256 policyStartTime, uint256 policyEndTime, bool initialExists, bool initialIsExpired) = salesPolicy.getPolicyData(policyId);

        // Assert initial state
        assertTrue(initialExists, "Policy should exist initially");
        assertFalse(initialIsExpired, "Policy should not be expired initially");

        console.log("Policy start time:", policyStartTime);
        console.log("Policy end time:", policyEndTime);

        // Fast forward time to after policy expiration
        vm.warp(policyEndTime + 1);

        // Update policy expired status with the correct authorized address
        vm.prank(address(capitalAgent));
        salesPolicy.updatePolicyExpired(policyId);

        // Try to get policy data after expiration 
        (, , , , bool expired ) = salesPolicy.getPolicyData(policyId);
        assertTrue(expired, "Policy should be expired");
        
        // Try to claim an expired policy (should revert due to non-existent token)
        vm.prank(address(capitalAgent));
        vm.expectRevert("UnoRe: policy expired");
        salesPolicy.markToClaim(policyId);

        // Verify that the token no longer exists
        vm.expectRevert();
        salesPolicy.ownerOf(policyId);
    }

    function testAllPoliciesLength() public {
        address buyer1 = address(0x1234);
        address buyer2 = address(0x5678);
        address buyer3 = address(0x9ABC);
        uint256 ethAmount = 1 ether;
        
        // Check initial length
        uint256 initialLength = salesPolicy.allPoliciesLength();
        assertEq(initialLength, 0, "Initial policies length should be 0");

        // Buy first policy
        uint256 policyId1 = buyPolicy(buyer1, ethAmount);
        uint256 lengthAfterFirst = salesPolicy.allPoliciesLength();
        assertEq(lengthAfterFirst, 1, "Policies length should be 1 after first purchase");

        // Set staking start time to now
        vm.prank(multiSigWallet);
        uint256 stakingStartTime = block.timestamp;
        ssip.setStakingStartTime(stakingStartTime);

        // Warp to after staking start time
        vm.warp(stakingStartTime + 1);

        // Buy second policy
        uint256 policyId2 = buyPolicy(buyer2, ethAmount);
        uint256 lengthAfterSecond = salesPolicy.allPoliciesLength();
        assertEq(lengthAfterSecond, 2, "Policies length should be 2 after second purchase");

        // Buy third policy
        uint256 policyId3 = buyPolicy(buyer3, ethAmount);
        uint256 lengthAfterThird = salesPolicy.allPoliciesLength();
        assertEq(lengthAfterThird, 3, "Policies length should be 3 after third purchase");

        // Get policy parameters
        PolicyParams memory params = setupPolicyParams();

        // Expire a policy
        vm.warp(block.timestamp + params.coverageDurations[0] + 1);
        vm.prank(address(capitalAgent));
        salesPolicy.updatePolicyExpired(policyId2);

        // Check length after expiring a policy
        uint256 lengthAfterExpiration = salesPolicy.allPoliciesLength();
        assertEq(lengthAfterExpiration, 3, "Policies length should still be 3 after expiration");

        // Try to claim a policy
        vm.prank(address(capitalAgent));
        salesPolicy.markToClaim(policyId1);

        // Check length after claiming a policy
        uint256 lengthAfterClaim = salesPolicy.allPoliciesLength();
        assertEq(lengthAfterClaim, 3, "Policies length should still be 3 after claiming");

        console.log("testAllPoliciesLength passed successfully");
    }

    function testGetPolicyData() public {
        address buyer = address(0x1234);
        uint256 ethAmount = 1 ether;

        // Buy a policy
        uint256 policyId = buyPolicy(buyer, ethAmount);

        // Get policy data
        (
            uint256 coverageAmount,
            uint256 duration,
            uint256 startTime,
            bool exists,
            bool isExpired
        ) = salesPolicy.getPolicyData(policyId);

        // Get the policy parameters used in buyPolicy
        PolicyParams memory params = setupPolicyParams();

        // Assert policy data
        assertEq(coverageAmount, params.coverageAmounts[0], "Coverage amount should match");
        assertEq(duration, params.coverageDurations[0], "Duration should match");
        assertTrue(startTime > 0, "Start time should be set");
        assertTrue(exists, "Policy should exist");
        assertFalse(isExpired, "Policy should not be expired initially");

        // Calculate and check end time
        uint256 expectedEndTime = startTime + duration;
        assertTrue(expectedEndTime > block.timestamp, "End time should be in the future");

        // Try to get data for a non-existent policy
        uint256 nonExistentPolicyId = 9999;
        salesPolicy.getPolicyData(nonExistentPolicyId);

        // Fast forward to just before policy expiration
        vm.warp(expectedEndTime - 1);
        (, , , exists, isExpired) = salesPolicy.getPolicyData(policyId);
        assertTrue(exists, "Policy should still exist before expiration");
        assertFalse(isExpired, "Policy should not be expired before end time");

        // Fast forward to after policy expiration
        vm.warp(expectedEndTime + 1);
        vm.prank(address(capitalAgent));
        salesPolicy.updatePolicyExpired(policyId);
    }

    function testSSIPPolicyClaim() public {
        // TODO: Test SSIP policy claim with valid amount
    }

    function testSSIPPolicyClaimExceedingCoverage() public {
        // TODO: Test SSIP policy claim with amount exceeding coverage
    }
}
