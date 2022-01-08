// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/ISalesPolicy.sol";
import "./interfaces/IExchangeAgent.sol";
import "./interfaces/ISingleSidedInsurancePool.sol";
import "./interfaces/IRiskPool.sol";
import "./interfaces/ICapitalAgent.sol";

contract CapitalAgent is ICapitalAgent, ReentrancyGuard {
    address public owner;
    address public exchangeAgent;
    address public salesPolicyFactory;
    address public UNO_TOKEN;
    address public USDC_TOKEN;

    struct PoolInfo {
        uint256 totalCapital;
        bool exist;
    }

    struct PolicyInfo {
        uint256 utilizedAmount;
        bool exist;
    }

    mapping(address => PoolInfo) public poolInfo;

    uint256 public totalCapitalStaked;

    mapping(address => PolicyInfo) public policyInfo;

    uint256 public totalUtilizedAmount;

    uint256 public MCR;
    uint256 public MLR;

    uint256 public CALC_PRECISION = 1e18;

    mapping(address => bool) public poolWhiteList;

    event LogAddPool(address indexed _ssip);
    event LogRemovePool(address indexed _ssip);
    event LogAddPolicy(address indexed _salesPolicy);
    event LogRemovePolicy(address indexed _salesPolicy);
    event LogUpdatePoolCapital(address indexed _ssip, uint256 _poolCapital, uint256 _totalCapital);
    event LogUpdatePolicyCoverage(
        address indexed _policy,
        uint256 _amount,
        uint256 _policyUtilized,
        uint256 _totalUtilizedAmount
    );
    event LogUpdatePolicyExpired(address indexed _policy, uint256 _policyTokenId);
    event LogMarkToClaimPolicy(address indexed _policy, uint256 _policyTokenId);
    event LogSetMCR(address indexed _owner, address indexed _capitalAgent, uint256 _MCR);
    event LogSetMLR(address indexed _owner, address indexed _capitalAgent, uint256 _MLR);
    event LogSetExchangeAgent(address indexed _owner, address indexed _capitalAgent, address _exchangeAgent);
    event LogSetSalesPolicyFactory(address indexed _factory);
    event LogAddPoolWhiteList(address indexed _pool);
    event LogRemovePoolWhiteList(address indexed _pool);

    constructor(
        address _exchangeAgent,
        address _UNO_TOKEN,
        address _USDC_TOKEN
    ) {
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_UNO_TOKEN != address(0), "UnoRe: zero UNO address");
        require(_USDC_TOKEN != address(0), "UnoRe: zero USDC address");
        owner = msg.sender;
        exchangeAgent = _exchangeAgent;
        UNO_TOKEN = _UNO_TOKEN;
        USDC_TOKEN = _USDC_TOKEN;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "UnoRe: Capital Agent Forbidden");
        _;
    }

    modifier onlyPoolWhiteList() {
        require(poolWhiteList[msg.sender], "UnoRe: Capital Agent Forbidden");
        _;
    }

    function setSalesPolicyFactory(address _factory) external onlyOwner nonReentrant {
        require(_factory != address(0), "UnoRe: zero factory address");
        salesPolicyFactory = _factory;
        emit LogSetSalesPolicyFactory(_factory);
    }

    function addPoolWhiteList(address _pool) external onlyOwner nonReentrant {
        require(_pool != address(0), "UnoRe: zero pool address");
        require(!poolWhiteList[_pool], "UnoRe: white list already");
        poolWhiteList[_pool] = true;
        emit LogAddPoolWhiteList(_pool);
    }

    function removePoolWhiteList(address _pool) external onlyOwner nonReentrant {
        require(_pool != address(0), "UnoRe: zero pool address");
        require(poolWhiteList[_pool], "UnoRe: no white list");
        poolWhiteList[_pool] = false;
        emit LogRemovePoolWhiteList(_pool);
    }

    function addPool(address _ssip) external override onlyPoolWhiteList {
        require(_ssip != address(0), "UnoRe: zero address");
        require(!poolInfo[_ssip].exist, "UnoRe: already exist pool");
        poolInfo[_ssip] = PoolInfo({totalCapital: 0, exist: true});

        emit LogAddPool(_ssip);
    }

    function removePool(address _ssip) external onlyOwner nonReentrant {
        require(_ssip != address(0), "UnoRe: zero address");
        require(poolInfo[_ssip].exist, "UnoRe: no exit pool");
        if (poolInfo[_ssip].totalCapital > 0) {
            totalCapitalStaked = totalCapitalStaked - poolInfo[_ssip].totalCapital;
        }
        delete poolInfo[_ssip];
        emit LogRemovePool(_ssip);
    }

    function addPolicy(address _policy) external override nonReentrant {
        require(salesPolicyFactory != address(0), "UnoRe: not set factory address yet");
        require(salesPolicyFactory == msg.sender, "UnoRe: only salesPolicyFactory can call");
        require(!policyInfo[_policy].exist, "UnoRe: already exist policy");
        policyInfo[_policy] = PolicyInfo({utilizedAmount: 0, exist: true});

        emit LogAddPolicy(_policy);
    }

    function removePolicy(address _policy) external onlyOwner nonReentrant {
        require(_policy != address(0), "UnoRe: zero address");
        require(policyInfo[_policy].exist, "UnoRe: no exit pool");
        if (policyInfo[_policy].utilizedAmount > 0) {
            totalCapitalStaked = totalUtilizedAmount - policyInfo[_policy].utilizedAmount;
        }
        delete policyInfo[_policy];
        emit LogRemovePolicy(_policy);
    }

    function SSIPWithdraw(uint256 _withdrawAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        require(_checkCapitalByMCR(_withdrawAmount), "UnoRe: minimum capital underflow");
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
    }

    function SSIPPolicyCaim(uint256 _withdrawAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
    }

    function SSIPStaking(uint256 _stakingAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _stakingAmount, true);
    }

    function checkCapitalByMCR(uint256 _withdrawAmount) external view override returns (bool) {
        return _checkCapitalByMCR(_withdrawAmount);
    }

    function policySale(uint256 _coverageAmount) external override nonReentrant {
        require(policyInfo[msg.sender].exist, "UnoRe: no exist policy");
        require(_checkCoverageByMLR(_coverageAmount), "UnoRe: maximum leverage overflow");
        _updatePolicyCoverage(msg.sender, _coverageAmount, true);
    }

    function updatePolicyStatus(address _policyAddr, uint256 _policyId) external override nonReentrant {
        (uint256 _coverageAmount, uint256 _coverageDuration, uint256 _coverStartAt, ) = ISalesPolicy(_policyAddr).getPolicyData(
            _policyId
        );
        bool isExpired = block.timestamp >= _coverageDuration + _coverStartAt;
        if (isExpired) {
            _updatePolicyCoverage(_policyAddr, _coverageAmount, false);
            ISalesPolicy(_policyAddr).updatePolicyExpired(_policyId);
            emit LogUpdatePolicyExpired(_policyAddr, _policyId);
        }
    }

    function markToClaimPolicy(address _policy, uint256 _policyId) external onlyOwner nonReentrant {
        (uint256 _coverageAmount, , , ) = ISalesPolicy(_policy).getPolicyData(_policyId);
        _updatePolicyCoverage(_policy, _coverageAmount, false);
        ISalesPolicy(_policy).markToClaim(_policyId);
        emit LogMarkToClaimPolicy(_policy, _policyId);
    }

    function _updatePoolCapital(
        address _pool,
        uint256 _amount,
        bool isAdd
    ) private {
        if (!isAdd) {
            require(poolInfo[_pool].totalCapital >= _amount, "UnoRe: pool capital overflow");
        }
        poolInfo[_pool].totalCapital = isAdd ? poolInfo[_pool].totalCapital + _amount : poolInfo[_pool].totalCapital - _amount;
        totalCapitalStaked = isAdd ? totalCapitalStaked + _amount : totalCapitalStaked - _amount;
        emit LogUpdatePoolCapital(_pool, poolInfo[_pool].totalCapital, totalCapitalStaked);
    }

    function _updatePolicyCoverage(
        address _policy,
        uint256 _amount,
        bool isAdd
    ) private {
        if (!isAdd) {
            require(policyInfo[_policy].utilizedAmount >= _amount, "UnoRe: policy coverage overflow");
        }
        policyInfo[_policy].utilizedAmount = isAdd
            ? policyInfo[_policy].utilizedAmount + _amount
            : policyInfo[_policy].utilizedAmount - _amount;
        totalUtilizedAmount = isAdd ? totalUtilizedAmount + _amount : totalUtilizedAmount - _amount;
        emit LogUpdatePolicyCoverage(_policy, _amount, policyInfo[_policy].utilizedAmount, totalUtilizedAmount);
    }

    function _checkCapitalByMCR(uint256 _withdrawAmount) private view returns (bool) {
        return totalCapitalStaked - _withdrawAmount >= (totalCapitalStaked * MCR) / CALC_PRECISION;
    }

    function _checkCoverageByMLR(uint256 _newCoverageAmount) private view returns (bool) {
        uint256 totalCapitalStakedInUSDC = IExchangeAgent(exchangeAgent).getNeededTokenAmount(
            UNO_TOKEN,
            USDC_TOKEN,
            totalCapitalStaked
        );
        return totalUtilizedAmount + _newCoverageAmount <= (totalCapitalStakedInUSDC * MLR) / CALC_PRECISION;
    }

    function setMCR(uint256 _MCR) external onlyOwner nonReentrant {
        require(_MCR > 0, "UnoRe: zero mcr");
        MCR = _MCR;
        emit LogSetMCR(msg.sender, address(this), _MCR);
    }

    function setMLR(uint256 _MLR) external onlyOwner nonReentrant {
        require(_MLR > 0, "UnoRe: zero mlr");
        MLR = _MLR;
        emit LogSetMLR(msg.sender, address(this), _MLR);
    }

    function setExchangeAgent(address _exchangeAgent) external onlyOwner nonReentrant {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        exchangeAgent = _exchangeAgent;
        emit LogSetExchangeAgent(msg.sender, address(this), _exchangeAgent);
    }
}
