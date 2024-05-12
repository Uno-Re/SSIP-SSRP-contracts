// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/USDCRollux.sol";
import "../../contracts/Mocks/SupraPriceOracle.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/CapitalAgent.sol";

import "lib/forge-std/src/Vm.sol";
import "forge-std/console.sol";

import "lib/forge-std/src/Test.sol";
import "../../src/TransparentProxy.sol";

contract Stake is Test {
    MockUNO uno;
    USDCmock usdc;
    SupraPriceOracle priceFeed;
    SingleSidedInsurancePool pool;
    CapitalAgent agent;
    address user = address(1);
    address admin = address(this);
    address constant USDC = 0xa68E417905ACdEdC32ae8DA9113a6d4d2b6B2F30;
    address constant UNO = 0x1E61F32cBc30d919AdC92CA1eD92dA3fd115a530;
    address constant PRICE = 0xf0641df8Dd1290016229083F0695fE49067EcB79;
    address constant USDCPOOL = 0xc0c7fbcd46E16e9b91fcFd63792240399e7B0459;
    address constant AGENT = 0x2aAb17643960Ef1909522F3F8F706c587636FE27;

    function setUp() public {
        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        agent = CapitalAgent(AGENT);

        vm.createSelectFork("https://rpc-tanenbaum.rollux.com");
        usdc = USDCmock(USDC);
    }

    function test_CheckUSDCEthPrice() public {
        assertEq(priceFeed.getAssetEthPrice(USDC), 304749580000000);
    }

    function test_USDCxUNOPrice() public {
        assertEq(priceFeed.consult(USDC, UNO, 1), 21982008846048617562);
    }

    function test_CapitalAgent() public {
        assertEq(agent.totalCapitalStaked(), 1633999991);
    }

    function test_stake(uint256 amount) public {
        vm.assume(amount < 1000000000000000000000000000);
        vm.assume(0 < amount);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), amount);
        assertEq(usdc.balanceOf(user), amount);
        vm.prank(address(user));
        usdc.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);
        assertEq(agent.totalCapitalStaked(), (1633999991 + amount));
    }

    function test_stakeWithdrawal(uint256 amount, uint256 amount2) public {
        vm.assume(amount < 1000000000);
        vm.assume(amount > 0);
        vm.assume(amount2 < amount);
        vm.assume(amount2 > 0);
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), 1000000000);
        assertEq(usdc.balanceOf(user), 1000000000);
        vm.prank(address(user));
        usdc.approve(address(pool), 1000000000);
        vm.prank(address(user));
        pool.enterInPool(1000000000);
        assertEq(agent.totalCapitalStaked(), (1633999991 + 1000000000));
        vm.prank(address(user));
        pool.leaveFromPoolInPending(amount);
        skip(300);
        (uint256 request, , , ) = pool.getWithdrawRequestPerUser(address(user));
        skip(300);
        vm.prank(address(user));
        pool.leaveFromPending(amount2);
        assertEq(usdc.balanceOf(user), amount2);
        assertEq(agent.totalCapitalStaked(), (1633999991 + 1000000000 - amount2));
    }
}
