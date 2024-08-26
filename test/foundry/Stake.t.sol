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
    address constant USDC = 0x368433CaC2A0B8D76E64681a9835502a1f2A8A30;
    address constant UNO = 0x570baA32dB74279a50491E88D712C957F4C9E409;
    address constant PRICE = 0x9A2F48a2F66Ef86A6664Bb6FbC49a7407d6E33B5;
    address constant USDCPOOL = 0x2c89687036445089c962F4621B1F03571BBa798e;
    address constant AGENT = 0xB754842C7b0FA838e08fe5C028dB0ecd919f2d30;

    function setUp() public {
        string memory CHAIN_URL = vm.envString("ROLLUXMAIN_URL");

        vm.createSelectFork(CHAIN_URL);
        priceFeed = SupraPriceOracle(PRICE);

        vm.createSelectFork(CHAIN_URL);
        pool = SingleSidedInsurancePool(USDCPOOL);

        vm.createSelectFork(CHAIN_URL);
        agent = CapitalAgent(AGENT);

        vm.createSelectFork(CHAIN_URL);
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
