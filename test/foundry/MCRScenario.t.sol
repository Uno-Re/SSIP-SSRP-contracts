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

contract MCRScenario is Test {
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

    address user = address(55);
    address user1 = address(1);
    address user2 = address(2);
    address user3 = address(3);
    address user4 = address(4);
    address user5 = address(5);
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
        string memory SEPOLIA_URL = vm.envString("SEPOLIA_URL");

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

    function test_poolScenario1() public {
        vm.prank(MintAddress);
        usdc.mint(address(user), 10000000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user1), 8000000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user2), 5500000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user3), 6000000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user4), 8002000000000);
        vm.prank(MintAddress);
        usdc.mint(address(user5), 9540000000700);

        vm.prank(address(user));
        usdc.approve(address(pool), 10000000000000);
        vm.prank(address(user1));
        usdc.approve(address(pool), 8000000000000);
        vm.prank(address(user2));
        usdc.approve(address(pool), 5500000000000);
        vm.prank(address(user3));
        usdc.approve(address(pool), 6000000000000);
        vm.prank(address(user4));
        usdc.approve(address(pool), 8002000000000);
        vm.prank(address(user5));
        usdc.approve(address(pool), 9540000000700);

        uint256 stakedBefore = proxycapital.totalCapitalStaked();

        vm.prank(address(user));
        pool.enterInPool(10000000000000);
        vm.prank(address(user1));
        pool.enterInPool(8000000000000);
        vm.prank(address(user2));
        pool.enterInPool(5500000000000);
        vm.prank(address(user3));
        pool.enterInPool(6000000000000);
        vm.prank(address(user4));
        pool.enterInPool(8002000000000);
        vm.prank(address(user5));
        pool.enterInPool(9540000000700);

        uint256 stakedAfter = proxycapital.totalCapitalStaked();

        proxycapital.setMCR(stakedAfter / 2);
        proxycapital.MCR();

        uint256 totalUserStaked = (10000000000000);

        //Here user will withdrawl all of his money and should not fail by the MCR
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

        //Here other users will withdrawl all of their money
        vm.prank(address(user1));
        pool.leaveFromPoolInPending(8000000000000);
        vm.prank(address(user2));
        pool.leaveFromPoolInPending(5500000000000);
        vm.prank(address(user3));
        pool.leaveFromPoolInPending(6000000000000);
        vm.prank(address(user4));
        pool.leaveFromPoolInPending(8002000000000);
        vm.prank(address(user5));
        pool.leaveFromPoolInPending(9540000000700);
        skip(3000);
        vm.prank(address(user1));
        pool.leaveFromPending(8000000000000);
        vm.prank(address(user2));
        pool.leaveFromPending(5500000000000);
        vm.prank(address(user3));
        pool.leaveFromPending(6000000000000);
        vm.prank(address(user4));
        pool.leaveFromPending(8002000000000);
        vm.prank(address(user5));
        pool.leaveFromPending(9540000000700);

        proxycapital.totalCapitalStaked();

        //Here user will withdrawl all of his money and it should fail by the MCR
        vm.prank(address(user));
        vm.expectRevert();
        pool.leaveFromPoolInPending(totalUserStaked);
    }
}
