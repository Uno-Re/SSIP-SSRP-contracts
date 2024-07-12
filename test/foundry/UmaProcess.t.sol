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
    address dao = address(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
    address admin = address(this);
    address constant USDC = 0xdb2587DEb089c8f914BA6FeDf1E3d3Cb8660A015;
    address constant UNO = 0xF75C8E49831c055a88957adbc97450f778460FD9;
    address constant CAPITAL = 0x11819a1eB9373F86f4E1f7dAE8508E678BAF5D7B;
    address constant SALES = 0x0d9E62654EDAc0efFB2262Cfb9F68fdb9Fa8E80E;
    address constant PAYOUT = 0x9a752bc5Af86ec2AAAfed8E18751960d4e348752;
    address constant USDCPOOL = 0x3A83bD2e395EaBdD534c8f1EbB283B67418Abe31;
    address constant ORACLE = 0xFd9e2642a170aDD10F53Ee14a93FcF2F31924944;
    address constant DEFAULTCURRENCY = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    address constant ESCMANAGER = 0x14504281A72Fa3e183f1235496A3CF777439016A;
    bytes32 constant CLAIM_PROCESSOR_ROLE = 0x3b745c09aefb8f732a168ec71c3c87b50c0a4cfd1d104649ae3c04a4623b26bf;

    function setUp() public {
        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp");
        salesPolicy = SalesPolicy(payable(SALES));

        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp");
        capitalAgent = CapitalAgent(payable(CAPITAL));

        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp");
        usdc = USDCmock(USDC);

        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp");
        payout = PayoutRequest((PAYOUT));

        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/xEb_B2WFRsE6nEtBVPryB8CB4uQbyThp");
        poolUsdc = SingleSidedInsurancePool((USDCPOOL));
    }

    function test_claimPolicy() public {
        assertEq(salesPolicy.balanceOf(user), 7);
        uint256 initialUsdcBalance = usdc.balanceOf(user);

        uint256 id = 5;
        uint256 amount = 1;
        bytes32 hyperlaneMessage = 0x6c7563617320717565722064696e686569726f00000000000000000000000000;
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        payout.initRequest(id, amount, user, hyperlaneMessage);

        assertEq(usdc.balanceOf(user), initialUsdcBalance + amount);
    }

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
