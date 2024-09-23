// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../../contracts/Mocks/MockUNO.sol";
import "../../../contracts/Mocks/WsysMock.sol";
import "../../../contracts/Mocks/SupraPriceOracle.sol";
import "../../../contracts/SingleSidedInsurancePool.sol";
import "../../../contracts/CapitalAgent.sol";
import "../../../contracts/factories/RiskPoolFactory.sol";
import "../../../contracts/factories/RewarderFactory.sol";
import "../../../src/TransparentProxy.sol";

import "lib/forge-std/src/Vm.sol";
import "forge-std/console.sol";

import "lib/forge-std/src/Test.sol";

contract RewardsTest is Test {
    MockUNO uno;
    WsysMock wsys;
    SingleSidedInsurancePool pool;
    SingleSidedInsurancePool proxypool;
    CapitalAgent capitalAgent;
    TransparentProxy capitalAgentProxy;
    TransparentProxy poolProxy;
    CapitalAgent proxycapital;
    uint public startTime;
    uint public nextTime;
    uint public nextTime1;
    uint public finishTime;
    RiskPoolFactory riskPoolFactory;
    RewarderFactory rewardFactory;

    address user = address(1);
    address user2 = address(2);

    uint256 constant MCR = 10000000;
    uint256 constant MLR = 1000000;
    uint256 rewardMultiplier = 7000000000000000000;
    uint256 poolSCR = 1000000;

    function setUp() public {
        wsys = new WsysMock("Wrapped Sys", "WSYS", 7000000000000000000000);
        uno = new MockUNO();
        rewardFactory = new RewarderFactory();
        capitalAgent = new CapitalAgent();
        capitalAgentProxy = new TransparentProxy(address(capitalAgent), address(this), "");
        proxycapital = CapitalAgent(address(capitalAgentProxy));
        proxycapital.initialize(address(this), address(wsys), address(this), address(this));
        proxycapital.setMCR(MCR);
        proxycapital.setMLR(MLR);

        riskPoolFactory = new RiskPoolFactory();

        pool = new SingleSidedInsurancePool();
        poolProxy = new TransparentProxy(address(pool), address(this), "");
        proxypool = SingleSidedInsurancePool(address(poolProxy));
        proxypool.initialize(address(proxycapital), address(this));
        proxycapital.addPoolWhiteList(address(proxypool));

        proxypool.createRiskPool(
            "Synthetic SSIP-WSYS",
            "SSSIP-WSYS",
            address(riskPoolFactory),
            address(wsys),
            rewardMultiplier,
            poolSCR
        );
        proxypool.createRewarder(address(this), address(rewardFactory), address(uno));

        uno.mint(5000000000);
        address rewarder = proxypool.rewarder();

        uno.transfer(rewarder, 5000000000);
    }

    function test_shouldAccumulateRewardsAfterLeaveFromPool() public {
        uint256 value = 5000000000000000000;

        wsys.mint(address(user), value);

        vm.prank(address(user));
        wsys.approve(address(proxypool), value);

        vm.prank(address(user));
        proxypool.enterInPool(value);

        uint256 rewardsBefore = proxypool.pendingUno(address(user));

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value / 2);
        // wait for 10 days
        vm.roll(block.number + 20);
        skip(10 * 24 * 60 * 60);

        uint256 rewardsAfter = proxypool.pendingUno(address(user));

        assertTrue(rewardsAfter > rewardsBefore);
        // stake 1000 tokens

        // leave from pool 1000 tokens
        // wait for 100 days
        // rewards = 0
    }

    function test_shouldNotAccumulateRewards() public {
        uint256 value = 5000000000000000000;
        proxypool.setRewardMultiplier(44736800269291200);

        wsys.mint(address(user), value);
        wsys.mint(address(user2), (value * 5));

        vm.prank(address(user2));
        wsys.approve(address(proxypool), (value * 5));
        vm.prank(address(user2));
        proxypool.enterInPool((value * 5));

        vm.prank(address(user));
        wsys.approve(address(proxypool), value);
        vm.prank(address(user));
        proxypool.enterInPool(value);

        // wait for 10 minutes
        vm.roll(block.number + 7453453);
        skip(10 * 60 * 60);
        uint256 rewardsBefore = proxypool.pendingUno(address(user));

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value);

        // wait for 10 days
        vm.roll(block.number + 20);
        skip(10 * 24 * 60 * 60);

        uint256 rewardsAfter = proxypool.pendingUno(address(user));

        assertEq(rewardsAfter, 0);
    }
}
