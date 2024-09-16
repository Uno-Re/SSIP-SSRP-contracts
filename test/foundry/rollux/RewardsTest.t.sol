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
    uint256 rewardMultiplier = 7000000000000000000000;
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
        startTime = block.timestamp;
        vm.warp(startTime);

        proxypool.setStakingStartTime(70000);

        //nextTime = startTime + 10 ** 18;
        //vm.warp(nextTime);
        skip(700000000000000000000000000);
        vm.getBlockTimestamp();
        uint256 value = 5000000000000000000000;

        wsys.mint(address(user), value);

        vm.prank(address(user));
        wsys.approve(address(proxypool), value);

        vm.prank(address(user));
        proxypool.enterInPool(value);

        // nextTime1 = nextTime + 10 ** 18;
        // vm.warp(nextTime1);
        skip(700000000000000000000000000);

        // save rewards
        (uint256 amount, uint256 rewardDebt, uint256 someOtherValue, bool someBool) = proxypool.userInfo(address(user));
        uint256 rewardsBefore = rewardDebt;
        // uint256 rewardsBefore = proxypool.pendingUno(address(user));

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value / 2);

        // wait for 10 days
        // finishTime = nextTime1 + 10 ** 18;
        //vm.warp(finishTime); // rewards here > rewards earlier
        skip(700000000000000000000000000);
        vm.getBlockTimestamp();

        uint256 rewardsAfter = rewardDebt;

        //uint256 rewardsAfter = proxypool.pendingUno(address(user));

        assertTrue(rewardsAfter > rewardsBefore);
        // stake 1000 tokens

        // leave from pool 1000 tokens
        // wait for 100 days
        // rewards = 0
    }
}
