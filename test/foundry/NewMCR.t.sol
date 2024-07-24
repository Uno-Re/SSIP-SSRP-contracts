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

contract NewMCR is Test {
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
    address constant USDC = 0xdb2587DEb089c8f914BA6FeDf1E3d3Cb8660A015;
    address constant UNO = 0xF75C8E49831c055a88957adbc97450f778460FD9;
    address constant PRICE = 0x8F0872F5A2ad8384c385138A2a47dBC29F6C0135;
    address constant USDCPOOL = 0x3A83bD2e395EaBdD534c8f1EbB283B67418Abe31;
    address constant SALES_FACTORY = 0xA21E48961F782b57D1708f697E93ee433fC84e92;
    uint256 constant MCR = 10000000;
    uint256 constant MLR = 1000000;
    address constant PREMIUM_POOL = 0xcb2B848AF2C87C6a5B213C6dB4259CfA95A7c7E3;
    address constant PAYOUT = 0x9a752bc5Af86ec2AAAfed8E18751960d4e348752;
    address constant EXCHANGE_AGENT_ADDRESS = 0x0A32617d981EC576796C1D7E267F6563aCf82375;
    address constant SALES = 0x0d9E62654EDAc0efFB2262Cfb9F68fdb9Fa8E80E;

    function setUp() public {
        string memory SEPOLIA_URL = vm.envString("SEPOLIA_URL");
        console.log(SEPOLIA_URL);
        vm.createSelectFork(SEPOLIA_URL);
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork(SEPOLIA_URL);
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork(SEPOLIA_URL);
        salesFactory = SalesPolicyFactory(SALES_FACTORY);

        vm.createSelectFork(SEPOLIA_URL);
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork(SEPOLIA_URL);
        usdc = USDCmock(USDC);

        vm.createSelectFork(SEPOLIA_URL);
        exchange = ExchangeAgent(payable(EXCHANGE_AGENT_ADDRESS));

        vm.createSelectFork(SEPOLIA_URL);
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
        assertEq(priceFeed.getAssetEthPrice(USDC), 270000000000000);
    }

    function test_USDCxUNOPrice() public {
        assertEq(priceFeed.consult(USDC, UNO, 1), 6419400855);
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
        console.log(proxycapital.totalCapitalStaked());
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
        pool.leaveFromPoolInPending(260000000000);
    }
}
