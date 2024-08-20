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
    address user9 = address(9);
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
    address constant MintAddress = 0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863;

    function setUp() public {
        string memory CHAIN_URL = vm.envString("SEPOLIA_URL");

        vm.createSelectFork(CHAIN_URL);
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork(CHAIN_URL);
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork(CHAIN_URL);
        salesFactory = SalesPolicyFactory(SALES_FACTORY);

        vm.createSelectFork(CHAIN_URL);
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork(CHAIN_URL);
        usdc = USDCmock(USDC);

        vm.createSelectFork(CHAIN_URL);
        exchange = ExchangeAgent(payable(EXCHANGE_AGENT_ADDRESS));

        vm.createSelectFork(CHAIN_URL);
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

    function setupUsersAndStakes(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) internal {
        vm.assume(amount > 0 && amount < 5000000000000);
        vm.assume(amount2 > 0 && amount2 < 5000000000000);
        vm.assume(amount3 > 0 && amount3 < 5000000000000);
        vm.assume(amount4 > 0 && amount4 < 5000000000000);

        // Mint
        vm.prank(MintAddress);
        usdc.mint(address(user), 5000000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user2), amount);
        vm.prank(MintAddress);
        usdc.mint(address(user3), amount2);
        vm.prank(MintAddress);
        usdc.mint(address(user4), amount);
        vm.prank(MintAddress);
        usdc.mint(address(user5), amount2);
        vm.prank(MintAddress);
        usdc.mint(address(user6), amount4);
        vm.prank(MintAddress);
        usdc.mint(address(user7), amount);
        vm.prank(MintAddress);
        usdc.mint(address(user8), amount3);
        vm.prank(MintAddress);
        usdc.mint(address(user9), 10000000000000);
        // Approve
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
        vm.prank(address(user9));
        usdc.approve(address(pool), 10000000000000);

        // Enter in pool
        vm.prank(address(user));
        pool.enterInPool(500000000000);
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
        vm.prank(address(user9));
        pool.enterInPool(10000000000000);
    }

    function setupStartWithdrawal(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) internal {
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
        vm.prank(address(user9));
        pool.leaveFromPoolInPending(10000000000000);
    }

    function setupFinishWithdrawal(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) internal {
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
        vm.prank(address(user9));
        pool.leaveFromPending(10000000000000);
    }

    function test_stake(uint256 amount) public {
        vm.assume(amount < 10000000000);
        vm.assume(0 < amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), amount);
        address riskPool = pool.riskPool();
        uint256 balanceBefore = usdc.balanceOf(riskPool);
        assertEq(usdc.balanceOf(user), amount);
        vm.prank(address(user));
        usdc.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);

        assertEq(usdc.balanceOf(address(riskPool)), (balanceBefore + amount));
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

    function test_initialSetupAndStaking(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 expectedStake = 500000000000 + (3 * amount) + (2 * amount2) + amount3 + amount4 + 10000000000000;
        assertEq(proxycapital.totalCapitalStaked(), expectedStake);
    }

    function test_withdrawalProcess(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        test_initialSetupAndStaking(amount, amount2, amount3, amount4);

        vm.prank(address(user2));
        pool.leaveFromPoolInPending(amount);
        vm.prank(address(user3));
        pool.leaveFromPoolInPending(amount2);
        vm.prank(address(user4));
        pool.leaveFromPoolInPending(amount);

        skip(300);
        vm.prank(address(user2));
        pool.leaveFromPending(amount);
        vm.prank(address(user3));
        pool.leaveFromPending(amount2);
        vm.prank(address(user4));
        pool.leaveFromPending(amount);

        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(5000000000000);

        vm.prank(address(user));
        pool.leaveFromPoolInPending(50000000);
    }

    function test_cantWithdrawAmountBelowMCR(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();

        proxycapital.setMCR(stakedAfter / 2);

        vm.prank(MintAddress);
        usdc.mint(address(user), 5000000000000);
        vm.prank(address(user));
        usdc.approve(address(pool), 5000000000000);
        vm.prank(address(user));
        pool.enterInPool(500000000000);

        uint256 totalUserStaked = (2 * 500000000000);

        //Here user will withdrawal all of his money and should not fail by the MCR
        vm.prank(address(user));
        pool.leaveFromPoolInPending(totalUserStaked);
        skip(3000);
        vm.prank(address(user));
        pool.leaveFromPending(totalUserStaked);

        //here user stake all his money again
        vm.prank(address(user));
        usdc.approve(address(pool), totalUserStaked);
        vm.prank(address(user));
        pool.enterInPool(totalUserStaked);

        proxycapital.totalCapitalStaked();
        proxycapital.MCR();

        //Here other users will withdrawal all of their money
        setupStartWithdrawal(amount, amount2, amount3, amount4);
        skip(3000);
        setupFinishWithdrawal(amount, amount2, amount3, amount4);
        proxycapital.totalCapitalStaked();

        //Here user will withdrawal all of his money and it should fail by the MCR
        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(totalUserStaked);
    }

    function test_shouldNotFailWithdrawalCompletion(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();

        proxycapital.setMCR(stakedAfter / 2);

        vm.prank(MintAddress);
        usdc.mint(address(user), 5000000000000);
        vm.prank(address(user));
        usdc.approve(address(pool), 5000000000000);
        vm.prank(address(user));
        pool.enterInPool(500000000000);

        uint256 totalUserStaked = (2 * 500000000000);

        proxycapital.totalCapitalStaked();
        proxycapital.MCR();

        //Here other users will start to withdrawal all of their money, but won't finish withdrawing yet

        setupStartWithdrawal(amount, amount2, amount3, amount4);
        skip(3000);

        vm.prank(address(user));
        //this call should fail by the MCR as other users withdrew, but it doesn't
        pool.leaveFromPoolInPending(totalUserStaked);
        skip(3000);

        vm.prank(address(user));
        pool.leaveFromPending(totalUserStaked);

        setupFinishWithdrawal(amount, amount2, amount3, amount4);
    }
}
