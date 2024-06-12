// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/USDCRollux.sol";
import "../../contracts/Mocks/SupraPriceOracle.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/uma/PayoutRequest.sol";
import "../../contracts/factories/SalesPolicyFactory.sol";
import "../../contracts/interfaces/ICapitalAgent.sol";
import "../../contracts/SalesPolicy.sol";

import "lib/forge-std/src/Vm.sol";
import "forge-std/console.sol";

import "lib/forge-std/src/Test.sol";
import "../../src/TransparentProxy.sol";

contract Stake is Test {
    MockUNO uno;
    USDCmock usdc;
    SupraPriceOracle priceFeed;
    SingleSidedInsurancePool pool;
    CapitalAgent capitalAgent;
    TransparentProxy capitalAgentProxy;
    CapitalAgent proxycapital;
    ExchangeAgent exchange;
    PayoutRequest payout;
    SalesPolicyFactory salesFactory;
    SalesPolicy salesPolicy;

    address user = address(1);
    address user2 = address(2);
    address user3 = address(3);
    address user4 = address(4);
    address user5 = address(5);
    address user6 = address(6);
    address user7 = address(7);
    address user8 = address(8);
    address admin = address(this);
    address constant USDC = 0xa68E417905ACdEdC32ae8DA9113a6d4d2b6B2F30;
    address constant UNO = 0x1E61F32cBc30d919AdC92CA1eD92dA3fd115a530;
    address constant PRICE = 0xf0641df8Dd1290016229083F0695fE49067EcB79;
    address constant USDCPOOL = 0xc0c7fbcd46E16e9b91fcFd63792240399e7B0459;
    address constant SALES_FACTORY = 0x1A2e278c7231557DBb2cA3eEeC9df4985Ace2404;
    uint256 constant MCR = 10000000;
    uint256 constant MLR = 1000000;
    address constant PREMIUM_POOL = 0x34c76160d79C6d0C678b0B48d40eC5ddc895f4ED;
    address constant PAYOUT = 0x9e8946ad9db08cB87De0E27E9Af624070a71Bb7A;
    address constant EXCHANGE_AGENT_ADDRESS = 0xE7DC3F496e92D4D0b856A51c96B16237A7d42C2a;
    address constant SALES = 0x54D0F1E9102045eEB06118E7Aed2E9461FA2b357;

    function setUp() public {
        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        salesFactory = SalesPolicyFactory(SALES_FACTORY);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        usdc = USDCmock(USDC);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        exchange = ExchangeAgent(payable(EXCHANGE_AGENT_ADDRESS));

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        payout = PayoutRequest((PAYOUT));

        capitalAgent = new CapitalAgent();
        capitalAgentProxy = new TransparentProxy(address(capitalAgent), address(this), "");
        proxycapital = CapitalAgent(address(capitalAgentProxy));
        proxycapital.initialize(address(exchange), USDC, address(this), address(this));
        proxycapital.setMCR(MCR);
        proxycapital.setMLR(MLR);
        proxycapital.setSalesPolicyFactory(SALES_FACTORY);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        payout.setCapitalAgent(ICapitalAgent(address(proxycapital)));

        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        salesFactory.setCapitalAgentInPolicy(address(proxycapital));

        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        pool.setCapitalAgent(address(proxycapital));
        proxycapital.addPoolByAdmin(USDCPOOL, USDC, 1000000);
    }

    function test_CheckUSDCEthPrice() public {
        assertEq(priceFeed.getAssetEthPrice(USDC), 266160000000000);
    }

    function test_USDCxUNOPrice() public {
        assertEq(priceFeed.consult(USDC, UNO, 1), 33333700960004);
    }

    function test_CapitalAgent() public {
        assertEq(proxycapital.totalCapitalStaked(), 0);
    }

    function test_stake(uint256 amount) public {
        vm.assume(amount < 10000000000);
        vm.assume(0 < amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), amount);
        assertEq(usdc.balanceOf(user), amount);
        vm.prank(address(user));
        usdc.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);
        assertEq(proxycapital.totalCapitalStaked(), amount);
    }

    function test_stakeWithdrawal(uint256 amount) public {
        vm.assume(amount < 10000000000);
        vm.assume(amount > 0);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), 10000000000);
        assertEq(usdc.balanceOf(user), 10000000000);
        vm.prank(address(user));
        usdc.approve(address(pool), 10000000000);
        vm.prank(address(user));
        pool.enterInPool(10000000000);
        assertEq(proxycapital.totalCapitalStaked(), 10000000000);
        vm.prank(address(user));
        pool.leaveFromPoolInPending(amount);
        skip(300);
        vm.prank(address(user));
        pool.leaveFromPending(amount);
        assertEq(usdc.balanceOf(user), amount);
        assertEq(proxycapital.totalCapitalStaked(), (10000000000 - amount));
    }

    function test_stakeWithdrawalMCR(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        vm.assume(amount < 5000000000000);
        vm.assume(amount > 0);
        vm.assume(amount2 < 5000000000000);
        vm.assume(amount2 > 0);
        vm.assume(amount3 < 5000000000000);
        vm.assume(amount3 > 0);
        vm.assume(amount4 < 5000000000000);
        vm.assume(amount4 > 0);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), 5000000000000); //5 Millions
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user2), amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user3), amount2);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user4), amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user5), amount2);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user6), amount4);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user7), amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user8), amount3);

        vm.prank(address(user));
        usdc.approve(address(pool), 5000000000000);

        vm.prank(address(user2));
        usdc.approve(address(pool), amount);

        vm.prank(address(user3));
        usdc.approve(address(pool), amount2);

        vm.prank(address(user4));
        usdc.approve(address(pool), amount);

        vm.prank(address(user5));
        usdc.approve(address(pool), amount2);

        vm.prank(address(user6));
        usdc.approve(address(pool), amount4);

        vm.prank(address(user7));
        usdc.approve(address(pool), amount);

        vm.prank(address(user8));
        usdc.approve(address(pool), amount3);

        vm.prank(address(user));
        pool.enterInPool(5000000000000);

        vm.prank(address(user2));
        pool.enterInPool(amount);

        vm.prank(address(user3));
        pool.enterInPool(amount2);

        vm.prank(address(user4));
        pool.enterInPool(amount);

        vm.prank(address(user5));
        pool.enterInPool(amount2);

        vm.prank(address(user6));
        pool.enterInPool(amount4);

        vm.prank(address(user7));
        pool.enterInPool(amount);

        vm.prank(address(user8));
        pool.enterInPool(amount3);

        assertEq(proxycapital.totalCapitalStaked(), (5000000000000 + (3 * amount) + (2 * amount2) + amount3 + amount4));
        proxycapital.setMCR((proxycapital.totalCapitalStaked() / 2)); //50%

        vm.prank(address(user2));
        pool.leaveFromPoolInPending(amount);

        vm.prank(address(user3));
        pool.leaveFromPoolInPending(amount2);

        vm.prank(address(user4));
        pool.leaveFromPoolInPending(amount);

        vm.prank(address(user5));
        pool.leaveFromPoolInPending(amount2);

        vm.prank(address(user6));
        pool.leaveFromPoolInPending(amount4);

        vm.prank(address(user7));
        pool.leaveFromPoolInPending(amount);

        vm.prank(address(user8));
        pool.leaveFromPoolInPending(amount3);
        skip(300);

        vm.prank(address(user2));
        pool.leaveFromPending(amount);

        vm.prank(address(user3));
        pool.leaveFromPending(amount2);

        vm.prank(address(user4));
        pool.leaveFromPending(amount);

        vm.prank(address(user5));
        pool.leaveFromPending(amount2);

        vm.prank(address(user6));
        pool.leaveFromPending(amount4);

        vm.prank(address(user7));
        pool.leaveFromPending(amount);

        vm.prank(address(user8));
        pool.leaveFromPending(amount3);

        assertEq(proxycapital.totalCapitalStaked(), 5000000000000);
        skip(300);

        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(5000000000000);

        vm.prank(address(user));
        pool.leaveFromPoolInPending(2400000000000);
        skip(300);
        vm.prank(address(user));
        pool.leaveFromPending(2400000000000);

        assertEq(proxycapital.totalCapitalStaked(), 2600000000000);

        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(200000000000);
    }
}
