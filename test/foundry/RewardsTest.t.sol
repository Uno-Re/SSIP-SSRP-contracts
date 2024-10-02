// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/WsysMock.sol";
import "../../contracts/Mocks/SupraPriceOracle.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "../../contracts/factories/RewarderFactory.sol";
import "../../src/TransparentProxy.sol";

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
    uint256 value = 5000000000000000000;

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
        uno.mint(50000000000000000000000000);
        address rewarder = proxypool.rewarder();

        uno.transfer(rewarder, 50000000000000000000000000); 
        proxypool.setAccUnoPerShare(10,1);
    }

    function enterInPool() internal {
         wsys.mint(address(user), value);

        vm.prank(address(user));
        wsys.approve(address(proxypool), value);

        vm.prank(address(user));
        proxypool.enterInPool(value);

        wsys.mint(address(user2), (value * 5));

        vm.prank(address(user2));
        wsys.approve(address(proxypool), (value * 5));
        
        vm.prank(address(user2));
        proxypool.enterInPool((value * 5));
    }

    function test_shouldAccumulateRewardsAfterLeaveFromPool() public {
        enterInPool();

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value / 2);
        vm.roll(block.number + 1);
        //Checks rewards right after withdrawing tokens
        uint256 rewardsBefore = proxypool.pendingUno(address(user));
        // wait for 10 days and skip 20 blocks
        vm.roll(block.number + 20);
        skip(10 * 24 * 60 * 60);
        // Checks rewards after a couple of days
        uint256 rewardsAfter = proxypool.pendingUno(address(user));

        assertTrue(rewardsAfter > rewardsBefore);

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value / 2);
        rewardsBefore = proxypool.pendingUno(address(user));
        vm.roll(block.number + 20);
        skip(10 * 24 * 60 * 60);
        vm.prank(address(user));
        proxypool.userInfo(address(user));
        rewardsAfter = proxypool.pendingUno(address(user));

        assertEq(rewardsAfter, rewardsBefore);
    }

    function test_shouldNotAccumulateRewards() public {
        enterInPool();

        vm.prank(address(user));
        proxypool.leaveFromPoolInPending(value);
        uint256 rewardsBefore = proxypool.pendingUno(address(user));

        // wait for 10 days
        vm.roll(block.number + 20);
        skip(10 * 24 * 60 * 60);

        uint256 rewardsAfter = proxypool.pendingUno(address(user));

        assertEq(rewardsAfter, rewardsBefore);
        vm.prank(address(user));
        proxypool.leaveFromPending(value);
    }
}
