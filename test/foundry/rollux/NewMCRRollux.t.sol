// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../../contracts/Mocks/MockUNO.sol";
import "../../../contracts/Mocks/USDCRollux.sol";
import "../../../contracts/Mocks/SupraPriceOracle.sol";
import "../../../contracts/SingleSidedInsurancePool.sol";
import "../../../contracts/CapitalAgent.sol";
import "../../../contracts/ExchangeAgent.sol";
import "../../../contracts/uma/PayoutRequest.sol";
import "../../../contracts/factories/SalesPolicyFactory.sol";
import "../../../contracts/interfaces/ICapitalAgent.sol";
import "../../../contracts/SalesPolicy.sol";

import "lib/forge-std/src/Vm.sol";
import "forge-std/console.sol";

import "lib/forge-std/src/Test.sol";
import "../../../src/TransparentProxy.sol";

contract NewMCRRollux is Test {
    MockUNO uno;
    USDCmock wsys;
    SupraPriceOracle priceFeed;
    SingleSidedInsurancePool pool;
    CapitalAgent capitalAgent;
    TransparentProxy capitalAgentProxy;
    TransparentProxy pool1Proxy;
    CapitalAgent proxycapital;
    CapitalAgent capitalForked;
    SingleSidedInsurancePool proxyPool;
    SingleSidedInsurancePool pool1;
    ExchangeAgent exchange;
    PayoutRequest payout;
    SalesPolicyFactory salesFactory;
    SalesPolicy salesPolicy;
    uint public startTime;
    uint public nextTime;
    uint public nextTime1;
    uint public finishTime;

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
    address constant WSYS = 0x4200000000000000000000000000000000000006;
    address constant UNO = 0x570baA32dB74279a50491E88D712C957F4C9E409;
    address constant PRICE = 0x9A2F48a2F66Ef86A6664Bb6FbC49a7407d6E33B5;
    address constant WSYSPOOL = 0x3B61743180857c9D898c336b1604f4742887aa74;
    address constant SALES_FACTORY = 0xD86D9be9143Dc514340C73502f2B77d93d0B11f4;
    uint256 constant MCR = 10000000;
    uint256 constant MLR = 1000000;
    address constant PREMIUM_POOL = 0xc94002a997d4e4E90D423778170588f695c5f242;
    address constant PAYOUT = 0x1024a3a9D000aD3cd6Ac88490F86aD9FEAef7DCA;
    address constant EXCHANGE_AGENT_ADDRESS = 0x826404CB1924e8b2773250c9d15503E5CDe7eE20;
    address constant SALES = 0x5B170693E096D8602f970757068859b9A117fA6D;
    address constant MintAddress = 0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863;
    address constant WSYSMillionaire = 0x66ff2f0AC3214758D1e61B16b41e3d5e62CAEcF1;
    address constant WSYSMillionaire1 = 0x6E1aD8E91B9b7B677C2a81FA31B6FaAA657424Fb;
    address constant UNOOWNER = 0x64A227E362309D1411195850d310E682B13F9B26;
    address constant OPERATOR = 0x100c50947580d9158B7C26f79401404208CFbE62;
    address constant MULTISIG = 0x15E18e012cb6635b228e0DF0b6FC72627C8b2429;
    address constant CAPITAL = 0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30;

    function setUp() public {
        string memory CHAIN_URL = vm.envString("ROLLUXMAIN_URL");

        vm.createSelectFork(CHAIN_URL);
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork(CHAIN_URL);
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork(CHAIN_URL);
        salesFactory = SalesPolicyFactory(SALES_FACTORY);

        vm.createSelectFork(CHAIN_URL);
        pool = SingleSidedInsurancePool(WSYSPOOL);

        vm.createSelectFork(CHAIN_URL);
        wsys = USDCmock(WSYS);

        vm.createSelectFork(CHAIN_URL);
        exchange = ExchangeAgent(payable(EXCHANGE_AGENT_ADDRESS));

        vm.createSelectFork(CHAIN_URL);
        payout = PayoutRequest((PAYOUT));

        vm.createSelectFork(CHAIN_URL);
        capitalForked = CapitalAgent((CAPITAL));

        vm.createSelectFork(CHAIN_URL);
        uno = MockUNO((UNO));

        capitalAgent = new CapitalAgent();
        capitalAgentProxy = new TransparentProxy(address(capitalAgent), address(this), "");
        proxycapital = CapitalAgent(address(capitalAgentProxy));
        proxycapital.initialize(address(exchange), WSYS, address(this), address(this));
        proxycapital.setMCR(MCR);
        proxycapital.setMLR(MLR);
        proxycapital.setSalesPolicyFactory(SALES_FACTORY);
        vm.prank(OPERATOR);
        payout.setCapitalAgent(ICapitalAgent(address(proxycapital)));

        vm.prank(0x15E18e012cb6635b228e0DF0b6FC72627C8b2429);
        salesFactory.setCapitalAgentInPolicy(address(proxycapital));

        vm.prank(0x15E18e012cb6635b228e0DF0b6FC72627C8b2429);
        pool.setCapitalAgent(address(proxycapital));
        proxycapital.addPoolByAdmin(WSYSPOOL, WSYS, 1000000);

        uint256 fullBalance = wsys.balanceOf(WSYSMillionaire1);

        vm.prank(WSYSMillionaire1);
        wsys.transfer(WSYSMillionaire, fullBalance);
    }

    function setupUsersAndStakes(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) internal {
        vm.assume(amount > 0 && amount < 500000);
        vm.assume(amount2 > 0 && amount2 < 500000);
        vm.assume(amount3 > 0 && amount3 < 500000);
        vm.assume(amount4 > 0 && amount4 < 500000);

        // Mint
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user), 500000);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user2), amount);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user3), amount2);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user4), amount);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user5), amount2);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user6), amount4);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user7), amount);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user8), amount3);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user9), 10000000);
        // Approve
        vm.prank(address(user));
        wsys.approve(address(pool), 500000);
        vm.prank(address(user2));
        wsys.approve(address(pool), amount);
        vm.prank(address(user3));
        wsys.approve(address(pool), amount2);
        vm.prank(address(user4));
        wsys.approve(address(pool), amount);
        vm.prank(address(user5));
        wsys.approve(address(pool), amount2);
        vm.prank(address(user6));
        wsys.approve(address(pool), amount4);
        vm.prank(address(user7));
        wsys.approve(address(pool), amount);
        vm.prank(address(user8));
        wsys.approve(address(pool), amount3);
        vm.prank(address(user9));
        wsys.approve(address(pool), 10000000);

        // Enter in pool
        vm.prank(address(user));
        pool.enterInPool(500000);
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
        pool.enterInPool(10000000);
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
        pool.leaveFromPoolInPending(10000000);
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
        pool.leaveFromPending(10000000);
    }

    function test_stake(uint256 amount) public {
        vm.assume(amount < 10000000);
        vm.assume(0 < amount);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user), amount);
        address riskPool = pool.riskPool();
        uint256 balanceBefore = wsys.balanceOf(riskPool);
        assertEq(wsys.balanceOf(user), amount);
        vm.prank(address(user));
        wsys.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);

        assertEq(wsys.balanceOf(address(riskPool)), (balanceBefore + amount));
    }

    function test_stakeWithdrawal(uint256 amount) public {
        vm.assume(amount < 10000000000);
        vm.assume(amount > 0);
        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user), 10000000000);
        assertEq(wsys.balanceOf(user), 10000000000);
        vm.prank(address(user));
        wsys.approve(address(pool), 10000000000);
        vm.prank(address(user));
        pool.enterInPool(10000000000);
        assertEq(proxycapital.totalCapitalStaked(), 10000000000);
        vm.prank(address(user));
        pool.leaveFromPoolInPending(amount);
        skip(900000);
        vm.prank(address(user));
        pool.leaveFromPending(amount);
        assertEq(wsys.balanceOf(user), amount);
        assertEq(proxycapital.totalCapitalStaked(), (10000000000 - amount));
    }

    function test_initialSetupAndStaking(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        address riskPool = pool.riskPool();
        uint256 balanceBefore = wsys.balanceOf(riskPool);
        setupUsersAndStakes(amount, amount2, amount3, amount4);
        uint256 expectedStake = 500000 + (3 * amount) + (2 * amount2) + amount3 + amount4 + 10000000;
        assertEq(wsys.balanceOf(riskPool), balanceBefore + expectedStake);
    }

    function test_withdrawalProcess(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        test_initialSetupAndStaking(amount, amount2, amount3, amount4);

        vm.prank(address(user2));
        pool.leaveFromPoolInPending(amount);
        vm.prank(address(user3));
        pool.leaveFromPoolInPending(amount2);
        vm.prank(address(user4));
        pool.leaveFromPoolInPending(amount);

        skip(900000);
        vm.prank(address(user2));
        pool.leaveFromPending(amount);
        vm.prank(address(user3));
        pool.leaveFromPending(amount2);
        vm.prank(address(user4));
        pool.leaveFromPending(amount);

        vm.prank(address(user));
        pool.leaveFromPoolInPending(500000);
    }

    function test_cantWithdrawAmountBelowMCR(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();

        proxycapital.setMCR(stakedAfter / 2);

        vm.prank(WSYSMillionaire);
        wsys.transfer(address(user), 500000);
        vm.prank(address(user));
        wsys.approve(address(pool), 500000);
        vm.prank(address(user));
        pool.enterInPool(500000);

        uint256 totalUserStaked = (2 * 500000);

        //Here user will withdrawal all of his money and should not fail by the MCR
        vm.prank(address(user));
        pool.leaveFromPoolInPending(totalUserStaked);
        skip(900000);
        vm.prank(address(user));
        pool.leaveFromPending(totalUserStaked);

        //here user stake all his money again
        vm.prank(address(user));
        wsys.approve(address(pool), totalUserStaked);
        vm.prank(address(user));
        pool.enterInPool(totalUserStaked);

        proxycapital.totalCapitalStaked();
        proxycapital.MCR();

        //Here other users will withdrawal all of their money
        setupStartWithdrawal(amount, amount2, amount3, amount4);
        skip(900000);
        setupFinishWithdrawal(amount, amount2, amount3, amount4);
        proxycapital.totalCapitalStaked();

        //Here user will withdrawal all of his money and it should fail by the MCR
        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(totalUserStaked);
    }
}
