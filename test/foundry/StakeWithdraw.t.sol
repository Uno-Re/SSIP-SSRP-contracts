// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.23;

import "../../contracts/Mocks/MockUNO.sol";
import "../../contracts/Mocks/MockUSDT.sol";
import "../../contracts/ExchangeAgent.sol";
import "../../contracts/SingleSidedInsurancePool.sol";
import "../../contracts/CapitalAgent.sol";
import "../../contracts/RiskPool.sol";
import "../../contracts/Rewarder.sol";
import "../../contracts/factories/RewarderFactory.sol";
import "../../contracts/factories/RiskPoolFactory.sol";
import "../../contracts/interfaces/OptimisticOracleV3Interface.sol";
import "../../contracts/Mocks/MockSalesPolicy.sol";
import "../../contracts/Mocks/MockSalesPolicyFactory.sol";
import "../../contracts/uma/EscalationManager.sol";
import "../../contracts/PremiumPool.sol";
import "../../contracts/Mocks/OraclePriceFeed.sol";
import "../../contracts/governance/ClaimProcessor.sol";
import "../../contracts/interfaces/IUniswapRouter01.sol";
import "../../contracts/interfaces/IUniswapRouter02.sol";
import "../../contracts/interfaces/IUniswapFactory.sol";


// import "../contracts";

import "lib/forge-std/src/Vm.sol";

import "lib/forge-std/src/Test.sol";
import "../../src/TransparentProxy.sol";

contract Claim is Test {
    MockUNO uno;
    ExchangeAgent exchangeAgent;
    MockUSDT usdt;
    SingleSidedInsurancePool singleSidedInsurancePool;
    CapitalAgent capitalAgent;
    RiskPoolFactory riskPoolFactory;
    RiskPool riskPool;
    Rewarder rewarder;
    RewarderFactory rewarderFactory;
    OptimisticOracleV3Interface optimisticOracleV3;
    MockSalesPolicy  mockSalesPolicy;
    MockSalesPolicyFactory salesPolicyFactory;
    EscalationManager escalationManager;
    PremiumPool premiumPool; 
    OraclePriceFeed priceFeed;
    ClaimProcessor claimProcessor;

    TransparentProxy capitalAgentProxy;
    TransparentProxy SSIPProxy;
    CapitalAgent proxycapital;
    SingleSidedInsurancePool proxySSIP;
    // Vm vm = Vm(address(1));
    address user = address(1);
    address admin = address(this);

    function setUp() public {
        // deploy logic contract
        uno = new MockUNO();
        usdt = new MockUSDT();
        priceFeed = new OraclePriceFeed();
        exchangeAgent = new ExchangeAgent(address(usdt), 0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6,  address(priceFeed), 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f, address(this));
        premiumPool =  new PremiumPool(address(exchangeAgent), address(uno), address(usdt), address(this), address(this));

        capitalAgent = new CapitalAgent();
        singleSidedInsurancePool = new SingleSidedInsurancePool();

        SSIPProxy = new TransparentProxy(address(singleSidedInsurancePool), address(this), "");
        capitalAgentProxy = new TransparentProxy(address(capitalAgent), address(this), "");

        proxycapital = CapitalAgent(address(capitalAgentProxy));
        proxycapital.initialize(address(exchangeAgent), address(uno), address(usdt), address(this), address(this));
        proxySSIP = SingleSidedInsurancePool(address(SSIPProxy));

        rewarderFactory = new RewarderFactory();
        riskPoolFactory = new RiskPoolFactory();
        salesPolicyFactory = new MockSalesPolicyFactory(address(usdt), address(exchangeAgent), address(premiumPool), address(proxycapital), address(this));
        claimProcessor = new ClaimProcessor(address(this));
        optimisticOracleV3 = OptimisticOracleV3Interface(0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB);
        escalationManager = new EscalationManager(0x9923D42eF695B5dd9911D05Ac944d4cAca3c4EAB, address(this));
        proxySSIP.initialize(address(proxycapital), address(this), address(this), address(claimProcessor), address(escalationManager), 0x07865c6E87B9F70255377e024ace6630C1Eaa37F, address(optimisticOracleV3));

        uno.faucetToken(500000000000000000000000000000);
        usdt.faucetToken(500000000000000000000000000000);
        uno.approve(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 10000000000000000000000000000);
        usdt.approve(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D, 10000000000000000000000000000);

        IUniswapRouter02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D).addLiquidity(address(uno), address(usdt), 3000000, 3000, 3000000, 3000, address(this), block.timestamp);
        proxycapital.addPoolWhiteList(address(proxySSIP));
        proxySSIP.createRewarder(address(this), address(rewarderFactory), address(uno));
        rewarder = Rewarder(payable(proxySSIP.rewarder()));
        uno.transfer(address(rewarder), 100000000000000000000000000);

        proxySSIP.createRiskPool("UNO-LP", "UNO-LP", address(riskPoolFactory), address(usdt), 1, 10);

        uno.approve(address(proxySSIP), 1000000000000000000000000);
        usdt.approve(address(proxySSIP), 10000000000000000000000000);
        
        proxycapital.setSalesPolicyFactory(address(salesPolicyFactory));
        address salesP = salesPolicyFactory.newSalesPolicy(address(exchangeAgent), address(uno), address(proxycapital));
        mockSalesPolicy = MockSalesPolicy(payable(salesP));
        proxycapital.setMLR(10);
        proxycapital.setMCR(10);
        proxySSIP.setClaimProcessor(address(claimProcessor));
    }

    function test_EnterInPool() public {

        proxySSIP.enterInPool(85000);
        proxySSIP.enterInPool(10000000);
        assertEq(usdt.balanceOf(proxySSIP.riskPool()), 85000 + 10000000);
    }

    function test_LevefromPool() public {
        proxySSIP.enterInPool(8500000000000000000000);
        proxySSIP.enterInPool(10000000);
        proxySSIP.leaveFromPoolInPending(10000000);
    }

}
