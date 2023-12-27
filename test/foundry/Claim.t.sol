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

        proxySSIP.enterInPool(850000000000000);
        proxycapital.setMLR(10000000);
        proxySSIP.enterInPool(10000000000000000);
        proxycapital.setSalesPolicyFactory(address(salesPolicyFactory));
        address salesP = salesPolicyFactory.newSalesPolicy(address(exchangeAgent), address(uno), address(proxycapital));
        mockSalesPolicy = MockSalesPolicy(payable(salesP));
        mockSalesPolicy.buyPol(1, address(uno), 45000);
        proxySSIP.setClaimProcessor(address(claimProcessor));
        // riskPool = new RiskPool();
        // rewarder = new Rewarder();
        // mockSalesPolicy = new 
    }

    function testFuzz_FBlanceOfMintToken(uint8 amount) public {
        // vm.expectRevert(
        //     "TransparentUpgradeableProxy: admin cannot fallback to proxy target"
        // );
        uint256 a = uno.balanceOf(address(this));
        uno.faucetToken(amount);
        assertEq(uno.balanceOf(address(this)), amount + a);
    }

    function test_RequsetPolicy() public {

        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));

        assertEq(proxySSIP.assertedPolicies(assetId), 1);
        assertEq((optimisticOracleV3.getAssertion(assetId)).asserter, address(2));
    }

    function test_ClaimPolicy() public {
        proxySSIP.setLockTime(1);
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(optimisticOracleV3));
        proxySSIP.setAliveness(1);
        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));
        vm.warp(block.timestamp + 100);
        optimisticOracleV3.settleAssertion(assetId);
        assertEq(usdt.balanceOf(address(2)), 45000);
    }

    function test_dispute() public {
        proxySSIP.setLockTime(1);
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(optimisticOracleV3));
        proxySSIP.setAliveness(10);
        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));
        escalationManager.toggleDisputer(address(this));
        optimisticOracleV3.disputeAssertion(assetId, address(2));
        vm.warp(block.timestamp + 100);
        optimisticOracleV3.settleAssertion(assetId);

        assertEq(usdt.balanceOf(address(2)), 0);
    }

    function test_claimByProcessor() public {
        proxySSIP.setLockTime(1);
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(claimProcessor));
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(optimisticOracleV3));
        vm.warp(block.timestamp + 100);
        proxySSIP.setAliveness(1);
        proxySSIP.setFailed(true);
        claimProcessor.grantRole(claimProcessor.SSIP_ROLE(), address(proxySSIP));
        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));

        claimProcessor.approvePolicy(1);
        claimProcessor.claimPolicy(1);

        assertEq(usdt.balanceOf(address(2)), 45000);
    }

    function testExpectRevert_NotCLaimIFNotApprovedByGovernance() public {
        proxySSIP.setLockTime(1);
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(claimProcessor));
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(optimisticOracleV3));
        vm.warp(block.timestamp + 100);
        proxySSIP.setAliveness(1);
        proxySSIP.setFailed(true);
        claimProcessor.grantRole(claimProcessor.SSIP_ROLE(), address(proxySSIP));
        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));

        // claimProcessor.approvePolicy(1)
        vm.expectRevert(
            bytes("UnoRe: not approved or already settled")
        );
        claimProcessor.claimPolicy(1);
    }

    function testExpectRevert_IfDispiterIsNotSet() public {
        proxySSIP.setLockTime(1);
        proxySSIP.setRole(proxySSIP.CLAIM_PROCESSOR_ROLE(), address(optimisticOracleV3));
        proxySSIP.setAliveness(10);
        bytes32 assetId = proxySSIP.requestPayout(1, 45000, address(2));        
        vm.expectRevert(bytes("Dispute not allowed"));
        optimisticOracleV3.disputeAssertion(assetId, address(2));
    }
}
