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

    function testUnpausePool() public {
        // TODO: Implement test for unpausePool function
    }

    function testKillPool() public {
        // TODO: Implement test for killPool function
    }

    function testRevivePool() public {
        // TODO: Implement test for revivePool function
    }

    function testCollectPremiumInETH() public {
        // TODO: Implement test for collectPremiumInETH function
    }

    function testCollectPremium() public {
        // TODO: Implement test for collectPremium function
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
        // TODO: Implement test for addCurrency function
    }

    function testRemoveCurrency() public {
        // TODO: Implement test for removeCurrency function
    }

    function testMaxApproveCurrency() public {
        // TODO: Implement test for maxApproveCurrency function
    }

    function testDestroyCurrencyAllowance() public {
        // TODO: Implement test for destroyCurrencyAllowance function
    }

    function testAddWhiteList() public {
        // TODO: Implement test for addWhiteList function
    }

    function testRemoveWhiteList() public {
        // TODO: Implement test for removeWhiteList function
    }

    function testGrantRole() public {
        // TODO: Implement test for grantRole function
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
        // TODO: Implement test for setProtocolURI function
    }

    function testSetPremiumPool() public {
        // TODO: Implement test for setPremiumPool function
    }

    function testSetExchangeAgent() public {
        // TODO: Implement test for setExchangeAgent function
    }

    function testSetSigner() public {
        // TODO: Implement test for setSigner function
    }

    function testSetCapitalAgent() public {
        // TODO: Implement test for setCapitalAgent function
    }

    function testSetBuyPolicyMaxDeadline() public {
        // TODO: Implement test for setBuyPolicyMaxDeadline function
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
