// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/USDCRollux.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/uma/PayoutRequest.sol";
import "../../contracts/factories/SalesPolicyFactory.sol";
import "../../contracts/interfaces/ICapitalAgent.sol";
import "../../contracts/interfaces/EscalationManagerInterface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../contracts/SalesPolicy.sol";

import "lib/forge-std/src/Vm.sol";
import "forge-std/console.sol";

import "lib/forge-std/src/Test.sol";
import "../../src/TransparentProxy.sol";

contract UmaProcess is Test {
    MockUNO uno;
    USDCmock usdc;
    SingleSidedInsurancePool poolUsdc;
    CapitalAgent capitalAgent;
    PayoutRequest payout;
    TransparentProxy payoutRequestProxy;
    PayoutRequest proxypayout;
    SalesPolicyFactory salesFactory;
    SalesPolicy salesPolicy;

    address user = address(0x6ae23169D0809c5727f7bB1bF59335DbF9748fdd);
    address userDisputer = address(0x6ae23169d081234527F7bB1bf59335Dbf9748FdD);
    address dao = address(0xE7598Ff1fA06F3D3b696524A431cdE7C777b466A);
    address admin = address(this);
    address constant USDC = 0x368433CaC2A0B8D76E64681a9835502a1f2A8A30;
    address constant UNO = 0x570baA32dB74279a50491E88D712C957F4C9E409;
    address constant CAPITAL = 0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30;
    address constant SALES = 0x5B170693E096D8602f970757068859b9A117fA6D;
    address constant PAYOUT = 0x1024a3a9D000aD3cd6Ac88490F86aD9FEAef7DCA;
    address constant USDCPOOL = 0x2c89687036445089c962F4621B1F03571BBa798e;
    address constant ORACLE = 0x9A2F48a2F66Ef86A6664Bb6FbC49a7407d6E33B5;
    address constant DEFAULTCURRENCY = 0x4200000000000000000000000000000000000006;
    address constant ESCMANAGER = 0x9153a7017505De5E37892a5362B54904F878409a;
    bytes32 constant CLAIM_PROCESSOR_ROLE = 0x3b745c09aefb8f732a168ec71c3c87b50c0a4cfd1d104649ae3c04a4623b26bf;

    function setUp() public {
        //should include sepolia RPC
        string memory CHAIN_URL = vm.envString("ROLLUXMAIN_URL");
        vm.createSelectFork(CHAIN_URL);
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork(CHAIN_URL);
        capitalAgent = CapitalAgent(payable(CAPITAL));

        vm.createSelectFork(CHAIN_URL);
        usdc = USDCmock(USDC);

        vm.createSelectFork(CHAIN_URL);
        payout = PayoutRequest((PAYOUT));

        vm.createSelectFork(CHAIN_URL);
        poolUsdc = SingleSidedInsurancePool((USDCPOOL));
    }

    //function test_claimPolicy() public {
    //  uint256 initialUsdcBalance = usdc.balanceOf(user);

    //uint256 id = 5;
    //uint256 amount = 1;
    //bytes32 hyperlaneMessage = 0x6c7563617320717565722064696e686569726f00000000000000000000000000;
    //vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
    //payout.initRequest(id, amount, user, hyperlaneMessage);

    //assertEq(usdc.balanceOf(user), initialUsdcBalance + amount);

    //"This test shouldn't be used anymore forking sepolia. As we setted UMA to be used again, this test will fail"
    //}

    function test_claimPolicyUMA() public {
        payout = new PayoutRequest();
        payoutRequestProxy = new TransparentProxy(address(payout), address(this), "");
        proxypayout = PayoutRequest(address(payoutRequestProxy));
        proxypayout.initialize(
            ISingleSidedInsurancePool(address(USDCPOOL)),
            OptimisticOracleV3Interface(address(ORACLE)),
            IERC20(address(DEFAULTCURRENCY)),
            address(ESCMANAGER),
            dao,
            dao
        );
        vm.prank(address(dao));
        proxypayout.setCapitalAgent(ICapitalAgent(address(CAPITAL)));

        vm.prank(address(dao));
        proxypayout.setFailed(false);

        address addressPayout = address(proxypayout);

        vm.prank(address(dao));
        poolUsdc.grantRole(CLAIM_PROCESSOR_ROLE, addressPayout);

        skip(1000);

        uint256 id = 5;
        uint256 initialUsdcBalance = usdc.balanceOf(user);
        uint256 amount = 1;
        bytes32 hyperlaneMessage = 0x6c7563617320717565722064696e686569726f00000000000000000000000000;

        vm.prank(address(user));
        bytes32 returnInit = proxypayout.initRequest(id, amount, user, hyperlaneMessage);
        skip(1000);

        vm.prank(address(ORACLE));
        proxypayout.assertionResolvedCallback(returnInit, true);

        assertEq(usdc.balanceOf(user), initialUsdcBalance + amount);
    }

    function test_claimPolicyUMA_Failed() public {
        payout = new PayoutRequest();
        payoutRequestProxy = new TransparentProxy(address(payout), address(this), "");
        proxypayout = PayoutRequest(address(payoutRequestProxy));
        proxypayout.initialize(
            ISingleSidedInsurancePool(address(USDCPOOL)),
            OptimisticOracleV3Interface(address(ORACLE)),
            IERC20(address(DEFAULTCURRENCY)),
            address(ESCMANAGER),
            dao,
            dao
        );
        vm.prank(address(dao));
        proxypayout.setCapitalAgent(ICapitalAgent(address(CAPITAL)));

        vm.prank(address(dao));
        proxypayout.setFailed(false);

        address addressPayout = address(proxypayout);

        vm.prank(address(dao));
        poolUsdc.grantRole(CLAIM_PROCESSOR_ROLE, addressPayout);

        skip(1000);

        uint256 id = 5;
        uint256 initialUsdcBalance = usdc.balanceOf(user);
        uint256 amount = 1;
        bytes32 hyperlaneMessage = 0x6c7563617320717565722064696e686569726f00000000000000000000000000;

        vm.prank(address(user));
        bytes32 returnInit = proxypayout.initRequest(id, amount, user, hyperlaneMessage);
        skip(1000);

        vm.prank(address(ORACLE));
        proxypayout.assertionResolvedCallback(returnInit, false);

        skip(1000);

        vm.prank(address(user));
        bytes32 returnInit2 = proxypayout.initRequest(id, amount, user, hyperlaneMessage);

        skip(1000);

        vm.prank(address(ORACLE));
        proxypayout.assertionResolvedCallback(returnInit2, true);

        assertEq(usdc.balanceOf(user), initialUsdcBalance + amount);
    }
}
