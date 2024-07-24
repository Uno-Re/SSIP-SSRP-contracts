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
    address constant USDC = 0xdb2587DEb089c8f914BA6FeDf1E3d3Cb8660A015;
    address constant UNO = 0xF75C8E49831c055a88957adbc97450f778460FD9;
    address constant PRICE = 0x8F0872F5A2ad8384c385138A2a47dBC29F6C0135;
    address constant USDCPOOL = 0x3A83bD2e395EaBdD534c8f1EbB283B67418Abe31;
    address constant AGENT = 0x0A32617d981EC576796C1D7E267F6563aCf82375;

    function setUp() public {
        string memory ROLLUXTEST_URL = vm.envString("ROLLUXTEST_URL");

        vm.createSelectFork(ROLLUXTEST_URL);
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork(SEPOLIA_URL);
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork(SEPOLIA_URL);
        agent = CapitalAgent(AGENT);

        vm.createSelectFork(SEPOLIA_URL);
        usdc = USDCmock(USDC);
    }

    function test_stake(uint256 amount) public {
        vm.assume(amount < 1e12);
        vm.assume(0 < amount);
        uint256 totalStaked = agent.totalCapitalStaked();
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), amount);
        assertEq(usdc.balanceOf(user), amount);
        vm.prank(address(user));
        usdc.approve(address(pool), amount);
        vm.prank(address(user));
        pool.enterInPool(amount);
        assertEq(agent.totalCapitalStaked(), (totalStaked + amount));
    }

    function test_stakeWithdrawal(uint256 amount, uint256 amount2) public {
        uint256 userDeposit = 1000000000;
        vm.assume(amount < userDeposit);
        vm.assume(amount > 0);
        vm.assume(amount2 < amount);
        vm.assume(amount2 > 0);
        uint256 totalStaked = agent.totalCapitalStaked();
        vm.prank(0x3ad22Ae2dE3dCF105E8DaA12acDd15bD47596863);
        usdc.mint(address(user), userDeposit);
        assertEq(usdc.balanceOf(user), userDeposit);
        vm.prank(address(user));
        usdc.approve(address(pool), userDeposit);
        vm.prank(address(user));
        pool.enterInPool(userDeposit);
        assertEq(agent.totalCapitalStaked(), (totalStaked + userDeposit));
        vm.prank(address(user));
        pool.leaveFromPoolInPending(amount);
        skip(300);
        vm.prank(address(user));
        pool.leaveFromPending(amount2);
        assertEq(usdc.balanceOf(user), amount2);
        assertEq(agent.totalCapitalStaked(), (totalStaked + userDeposit - amount2));
    }
}
