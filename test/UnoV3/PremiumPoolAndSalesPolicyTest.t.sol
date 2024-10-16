// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;

import "lib/forge-std/src/Test.sol";
import "../../contracts/PremiumPool.sol";
import "../../contracts/SalesPolicy.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/Mocks/OraclePriceFeed.sol";
import "../../contracts/interfaces/IExchangeAgent.sol";
import "../../contracts/Mocks/MockUSDC.sol";
import "../../contracts/interfaces/ICapitalAgent.sol";
import "../../contracts/interfaces/ISalesPolicyFactory.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/Mocks/MockUNO.sol";

contract PremiumPoolAndSalesPolicyTest is Test {
    PremiumPool public premiumPool;
    CapitalAgent public capitalAgent;
    SalesPolicy public salesPolicy;
    ExchangeAgent public exchangeAgentContract;
    MockUSDC public usdcToken;
    PriceOracle public priceOracle;
    address public exchangeAgent;
    address public operator;
    address public multiSigWallet;
    address public governance;
    address public factory;
    address public wethAddress;
    address public uniswapRouterAddress;
    address public uniswapFactoryAddress;
    address public oraclePriceFeedAddress;
    uint256 public swapDeadline;
    MockUNO public unoToken;
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    event RoleGranted(bytes32 indexed, address indexed, address indexed);

    event LogSetProtocolURIInPolicy(address indexed , string );
    event LogSetExchangeAgentInPolicy(address indexed, address indexed);
    event LogSetBuyPolicyMaxDeadlineInPolicy(uint256, address indexed);

    event PremiumWithdraw(address indexed , address indexed , uint256 );
    event LogBuyBackAndBurn(address indexed , address indexed , uint256 );
    event LogCollectPremium(address indexed , address , uint256 );
    event LogDepositToSyntheticSSRPRewarder(address indexed , uint256 );
    event LogDepositToSyntheticSSIPRewarder(address indexed , address indexed , uint256 );
    event LogAddCurrency(address indexed , address indexed );
    event LogRemoveCurrency(address indexed , address indexed );
    event LogMaxApproveCurrency(address indexed , address indexed , address indexed );
    event LogMaxDestroyCurrencyAllowance(address indexed , address indexed , address indexed );
    event LogAddWhiteList(address indexed , address indexed );
    event LogRemoveWhiteList(address indexed , address indexed );
    event PoolAlived(address indexed , bool );
    event KillPool(address indexed , bool );

    function setUp() public {
        multiSigWallet = address(0x1);
        governance = address(0x2);
        factory = address(0x3);
        operator = address(0x4);

        usdcToken = new MockUSDC();
        unoToken = new MockUNO();

        wethAddress = address(0x4321); 
        uniswapRouterAddress = address(0x5432); 
        uniswapFactoryAddress = address(0x6543); 
        swapDeadline = 1800; // 30 minutes, adjust as needed

        priceOracle = new PriceOracle(multiSigWallet);

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

        vm.prank(multiSigWallet);
        capitalAgent = new CapitalAgent();
        capitalAgent.initialize(exchangeAgent, address(usdcToken), multiSigWallet, operator);
        
        vm.prank(multiSigWallet);
        // Deploy PremiumPool 
        premiumPool = new PremiumPool(
            exchangeAgent,
            address(unoToken),
            address(usdcToken),
            multiSigWallet,
            governance
        );

        // Add USDC as an allowed currency
        vm.prank(multiSigWallet);
        premiumPool.addCurrency(address(usdcToken));

        // Grant the pause role to governance
        bytes32 PAUSER_ROLE = 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775;
        vm.prank(multiSigWallet);
        premiumPool.grantRole(PAUSER_ROLE, governance);

        // Deploy SalesPolicy
        salesPolicy = new SalesPolicy(
            factory,
            exchangeAgent,
            address(premiumPool),
            address(capitalAgent),
            address(usdcToken)
        );
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
        // TODO: Implement test for depositToSyntheticSSRPRewarder function
    }

    function testDepositToSyntheticSSIPRewarder() public {
        // TODO: Implement test for depositToSyntheticSSIPRewarder function
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
        // TODO: Implement test for killPool function in SalesPolicy
    }

    function testRevivePoolSalesPolicy() public {
        // TODO: Implement test for revivePool function in SalesPolicy
    }

    function testBuyPolicy() public {
        // TODO: Implement test for buyPolicy function
    }

    function testApprovePremium() public {
        // TODO: Implement test for approvePremium function
    }
    function testSetProtocolURI() public {
        string memory newURI = "https://new.protocol.uri";
        // Expect the event to be emitted
        vm.expectEmit(true, true, true, true);
        emit LogSetProtocolURIInPolicy(address(salesPolicy), newURI);
        
        vm.prank(factory);
        salesPolicy.setProtocolURI(newURI);
        
        vm.prank(address(0x1234));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setProtocolURI(newURI);
    }

    function testSetPremiumPool() public {
        address newPremiumPool = address(0x1234);
        
        vm.prank(factory);
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
        
        vm.prank(factory);
        salesPolicy.setExchangeAgent(newExchangeAgent);
        
        vm.prank(address(0x6789));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setExchangeAgent(newExchangeAgent);
    }

    function testSetSigner() public {
        address newSigner = address(0x3456);
        
        vm.prank(factory);
        salesPolicy.setSigner(newSigner);
        
        assertEq(salesPolicy.signer(), newSigner, "Signer should be updated");
        
        vm.prank(address(0x7890));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setSigner(newSigner);
    }

    function testSetCapitalAgent() public {
        address newCapitalAgent = address(0x4567);
        
        vm.prank(factory);
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
        
        vm.prank(factory);
        salesPolicy.setBuyPolicyMaxDeadline(newDeadline);
        
        vm.prank(address(0x9012));
        vm.expectRevert("UnoRe: SalesPolicy Forbidden");
        salesPolicy.setBuyPolicyMaxDeadline(newDeadline);
    }

    function testMarkToClaim() public {
        // TODO: Implement test for markToClaim function
    }

    function testUpdatePolicyExpired() public {
        // TODO: Implement test for updatePolicyExpired function
    }

    function testAllPoliciesLength() public {
        // TODO: Implement test for allPoliciesLength function
    }

    function testGetPolicyData() public {
        // TODO: Implement test for getPolicyData function
    }
}
