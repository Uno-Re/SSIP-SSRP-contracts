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

contract NewMCRRollux is Test {
    MockUNO uno;
    USDCmock sys;
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
    address constant WSYS = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x368433CaC2A0B8D76E64681a9835502a1f2A8A30;
    address constant UNO = 0x570baA32dB74279a50491E88D712C957F4C9E409;
    address constant PRICE = 0x14eF9C6cD5A8C78af407cEcCA3E4668e466F2B18;
    address constant WSYSPOOL = 0x3B61743180857c9D898c336b1604f4742887aa74;
    address constant SALES_FACTORY = 0xD86D9be9143Dc514340C73502f2B77d93d0B11f4;
    uint256 constant MCR = 10000000;
    uint256 constant MLR = 1000000;
    address constant PREMIUM_POOL = 0xc94002a997d4e4E90D423778170588f695c5f242;
    address constant PAYOUT = 0xCaB9faf23a9803352f3f61Bc23782A9eb4a90fcC;
    address constant EXCHANGE_AGENT_ADDRESS = 0x83f618d714B9464C8e63F1d95592BaAa2d51a54E;
    address constant SALES = 0x5B170693E096D8602f970757068859b9A117fA6D;
    address constant MintAddress = 0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863;
    address constant SysMillionaire = 0x3F0e40bC7e9cb5f46E906dAEd18651Fb6212Aa8E;
    address constant Multisig = 0x15E18e012cb6635b228e0DF0b6FC72627C8b2429;

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
        sys = USDCmock(WSYS);

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
        vm.prank(0x100c50947580d9158B7C26f79401404208CFbE62);
        payout.setCapitalAgent(ICapitalAgent(address(proxycapital)));

        vm.prank(Multisig);
        salesFactory.setCapitalAgentInPolicy(address(proxycapital));

        vm.prank(Multisig);
        pool.setCapitalAgent(address(proxycapital));
        proxycapital.addPoolByAdmin(address(pool), WSYS, 1000000);
    }

    function setupUsersAndStakes(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) internal {
        vm.assume(amount > 0 && amount < 4000000000000000000000); //4k wsys
        vm.assume(amount2 > 0 && amount2 < 4000000000000000000000);
        vm.assume(amount3 > 0 && amount3 < 4000000000000000000000);
        vm.assume(amount4 > 0 && amount4 < 4000000000000000000000);

        // Mint
        vm.prank(SysMillionaire);
        sys.transfer(address(user), 5000000000000000000000); //5k wsys
        vm.prank(SysMillionaire);
        sys.transfer(address(user2), amount);
        vm.prank(SysMillionaire);
        sys.transfer(address(user3), amount2);
        vm.prank(SysMillionaire);
        sys.transfer(address(user4), amount);
        vm.prank(SysMillionaire);
        sys.transfer(address(user5), amount2);
        vm.prank(SysMillionaire);
        sys.transfer(address(user6), amount4);
        vm.prank(SysMillionaire);
        sys.transfer(address(user7), amount);
        vm.prank(SysMillionaire);
        sys.transfer(address(user8), amount3);
        vm.prank(SysMillionaire);
        sys.transfer(address(user9), 10000000000000000000000); //10k wsys
        // Approve
        vm.prank(address(user));
        sys.approve(address(pool), 5000000000000000000000);
        vm.prank(address(user2));
        sys.approve(address(pool), amount);
        vm.prank(address(user3));
        sys.approve(address(pool), amount2);
        vm.prank(address(user4));
        sys.approve(address(pool), amount);
        vm.prank(address(user5));
        sys.approve(address(pool), amount2);
        vm.prank(address(user6));
        sys.approve(address(pool), amount4);
        vm.prank(address(user7));
        sys.approve(address(pool), amount);
        vm.prank(address(user8));
        sys.approve(address(pool), amount3);
        vm.prank(address(user9));
        sys.approve(address(pool), 10000000000000000000000);

        // Enter in pool
        vm.prank(address(user));
        pool.enterInPool(5000000000000000000000);
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
        pool.enterInPool(10000000000000000000000);
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
        pool.leaveFromPoolInPending(10000000000000000000000);
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
        pool.leaveFromPending(10000000000000000000000);
    }

    function test_stake(uint256 amount) public {
        vm.assume(0 < amount);
        vm.assume(amount < 10000000000000000000000);
        vm.prank(SysMillionaire);
        sys.transfer(address(user), amount);
        address riskPool = pool.riskPool();
        uint256 balanceBefore = sys.balanceOf(riskPool);
        assertEq(sys.balanceOf(user), amount);
        vm.prank(address(user));
        sys.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);

        assertEq(sys.balanceOf(address(riskPool)), (balanceBefore + amount));
    }

    function test_stakeWithdrawal(uint256 amount) public {
        vm.assume(amount < 50000000000000000000000);
        vm.assume(amount > 10000000000000000000000);

        vm.prank(SysMillionaire);
        sys.transfer(address(user), amount);
        assertEq(sys.balanceOf(user), amount);

        vm.prank(address(user));
        sys.approve(address(pool), amount);

        vm.prank(address(user));
        pool.enterInPool(amount);

        uint256 expectedValueBefore = proxycapital._convertTokenToUSDC(address(sys), amount);
        assertEq(proxycapital.totalCapitalStaked(), expectedValueBefore);

        vm.prank(address(user));
        vm.expectRevert(); //should revert by the mcr, as he's the only one staked
        pool.leaveFromPoolInPending(amount);

        vm.prank(address(user));
        pool.leaveFromPoolInPending(amount / 48);

        skip(950400); //11 days

        vm.prank(address(user));
        pool.leaveFromPending(amount / 48);

        assertEq(sys.balanceOf(user), (amount / 48));

        uint256 expectedValue = proxycapital._convertTokenToUSDC(address(sys), amount - (amount / 48));

        assertEq(proxycapital.totalCapitalStaked(), expectedValue);
    }

    function test_initialSetupAndStaking(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 calcExpectedStake = 5000000000000000000000 +
            (3 * amount) +
            (2 * amount2) +
            amount3 +
            amount4 +
            10000000000000000000000;

        uint256 expectedStake = proxycapital._convertTokenToUSDC(address(sys), calcExpectedStake);

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

        skip(950400); //11 days
        vm.prank(address(user2));
        pool.leaveFromPending(amount);
        vm.prank(address(user3));
        pool.leaveFromPending(amount2);
        vm.prank(address(user4));
        pool.leaveFromPending(amount);

        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(50000000000000000000000);

        vm.prank(address(user));
        pool.leaveFromPoolInPending(5000000000000000000000);
    }

    function test_cantWithdrawAmountBelowMCR(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();
        proxycapital.setMCR(stakedAfter / 2);

        vm.prank(SysMillionaire);
        sys.transfer(address(user), 5000000000000);
        vm.prank(address(user));
        sys.approve(address(pool), 5000000000000);
        vm.prank(address(user));
        pool.enterInPool(500000000000);

        uint256 totalUserStaked = (500000000000 + 5000000000000000000000);

        //Here user will withdrawal all of his money and should not fail by the MCR
        vm.prank(address(user));
        pool.leaveFromPoolInPending(500000000000);
        skip(950400); //11 days
        vm.prank(address(user));
        pool.leaveFromPending(500000000000);

        proxycapital.totalCapitalStaked();
        proxycapital.MCR();

        //Here other users will withdrawal all of their money
        setupStartWithdrawal(amount, amount2, amount3, amount4);
        skip(950400); //11 days
        setupFinishWithdrawal(amount, amount2, amount3, amount4);

        proxycapital.totalCapitalStaked();
        proxycapital.getPoolInfo(address(pool));
        proxycapital.MCR();

        //Here user will withdrawal all of his money and it should fail by the MCR
        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending((totalUserStaked - 500000000000));
    }

    function test_shouldNotFailWithdrawalCompletion(uint256 amount, uint256 amount2, uint256 amount3, uint256 amount4) public {
        setupUsersAndStakes(amount, amount2, amount3, amount4);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();
        proxycapital.setMCR(stakedAfter / 2);

        vm.prank(SysMillionaire);
        sys.transfer(address(user), 5000000000000);
        vm.prank(address(user));
        sys.approve(address(pool), 5000000000000);
        vm.prank(address(user));
        pool.enterInPool(500000000000);

        uint256 totalUserStaked = (500000000000 + 5000000000000000000000);

        proxycapital.totalCapitalStaked();
        proxycapital.totalCapitalStakedByCurrency(WSYS);
        proxycapital.MCR();

        //Here other users will start to withdrawal all of their money, but won't finish withdrawing yet

        setupStartWithdrawal(amount, amount2, amount3, amount4);
        skip(950400); //11 days

        vm.prank(address(user));
        //this call should fail by the MCR as other users withdrew, but it doesn't
        pool.leaveFromPoolInPending(totalUserStaked / 48);
        skip(950400); //11 days

        vm.prank(address(user));
        pool.leaveFromPending(totalUserStaked / 48);
        setupFinishWithdrawal(amount, amount2, amount3, amount4);
    }
}
