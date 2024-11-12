// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./interfaces/ISalesPolicy.sol";
import "./interfaces/IExchangeAgent.sol";
import "./interfaces/ICapitalAgent.sol";

/**
 * @dev update and manage all pools capital and policy utlized amount,
 * whenever user stake and withdraw from the pool and buy policy from salesPolicy
 * notifies to capital agent to update pool capital and policy coverage
 **/
contract CapitalAgent is ICapitalAgent, ReentrancyGuardUpgradeable, AccessControlUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    using Strings for uint256;
    address public exchangeAgent;
    address public salesPolicyFactory;
    address public usdcToken;
    address public operator;

    struct PoolInfo {
        uint256 totalCapital;
        address currency;
        bool exist;
    }

    struct PolicyInfo {
        address policy;
        uint256 utilizedAmount;
        bool exist;
    }

    mapping(address => PoolInfo) public poolInfo;

    address[] private currencyList;
    address[] private poolList;
    mapping(address => bool) public existedCurrencies;
    mapping(address => uint256) public totalCapitalStakedByCurrency;

    PolicyInfo public policyInfo;

    // Maximum Leverage Ratio
    uint256 public MLR;

    /* 
    Value in %. 80 means 80% of the total MLR value
    Currently we use the MLR to allow users to buy coverages. 
    The idea with the new approach is to add a safety margin on top of 
    the MLR so that we can only sell coverages for about 80% of the MLR. 
    That means that if the MLR is 200% and the pool has 100k tokens, we could 
    only sell 160k in coverage. At the same time, if 160k are sold in coverages, 
    we need to make sure that the pools always have at least 80k tokens.
    */
    uint256 public MLR_THRESHOLD = 80;

    uint256 public constant CALC_PRECISION = 1e18;

    mapping(address => bool) public poolWhiteList;

    mapping(address => mapping(uint256 => uint256)) public claimedAmount;

    event LogAddPool(address indexed _ssip, address _currency);
    event LogAddPoolToList(address indexed _ssip);
    event LogRemovePool(address indexed _ssip);
    event LogSetPolicy(address indexed _salesPolicy);
    event LogRemovePolicy(address indexed _salesPolicy);
    event LogUpdatePoolCapital(address indexed _ssip, uint256 _poolCapital, uint256 _totalCapital);
    event LogUpdatePolicyCoverage(
        address indexed _policy,
        uint256 _amount,
        uint256 _policyUtilized
    );
    event LogUpdatePolicyExpired(address indexed _policy, uint256 _policyTokenId);
    event LogMarkToClaimPolicy(address indexed _policy, uint256 _policyTokenId);
    event LogSetMLR(address indexed _owner, address indexed _capitalAgent, uint256 _MLR);
    event LogSetExchangeAgent(address indexed _owner, address indexed _capitalAgent, address _exchangeAgent);
    event LogSetSalesPolicyFactory(address indexed _factory);
    event LogAddPoolWhiteList(address indexed _pool);
    event LogRemovePoolWhiteList(address indexed _pool);
    event LogSetOperator(address indexed _operator);
    event LogSetUSDC(address indexed _usdcToken);

    function initialize(
        address _exchangeAgent,
        address _USDC_TOKEN,
        address _multiSigWallet,
        address _operator
    ) external initializer {
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_USDC_TOKEN != address(0), "UnoRe: zero USDC address");
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        exchangeAgent = _exchangeAgent;
        usdcToken = _USDC_TOKEN;
        operator = _operator;
        __ReentrancyGuard_init();
        __AccessControl_init();
        _grantRole(ADMIN_ROLE, _multiSigWallet);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

    modifier onlyPoolWhiteList() {
        require(poolWhiteList[msg.sender], "UnoRe: Capital Agent Forbidden");
        _;
    }

    modifier onlyOperator() {
        require(operator == msg.sender, "UnoRe: Capital Agent Forbidden");
        _;
    }

    function getPolicyInfo() external view returns (address, uint256, bool) {
        PolicyInfo memory _policy = policyInfo;
        return (_policy.policy, _policy.utilizedAmount, _policy.exist);
    }

    function getPoolInfo(address _pool) external view returns (uint256, address, bool) {
        PoolInfo memory _poolInfo = poolInfo[_pool];
        return (_poolInfo.totalCapital, _poolInfo.currency, _poolInfo.exist);
    }

    // Getter function to return the poolList array
    function getPoolList() public view returns (address[] memory) {
        return poolList;
    }

    // Getter function to return the curencyList array
    function getCurrencyList() public view returns (address[] memory) {
        return currencyList;
    }

    /**
     * @dev set sales policy factory, can only be call by admin role
     * @param _factory new sales policy factory address
     **/
    function setSalesPolicyFactory(address _factory) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_factory != address(0), "UnoRe: zero factory address");
        salesPolicyFactory = _factory;
        emit LogSetSalesPolicyFactory(_factory);
    }

    /**
     * @dev set operator, can only be call by admin role
     * @param _operator new operator address
     **/
    function setOperator(address _operator) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_operator != address(0), "UnoRe: zero operator address");
        operator = _operator;
        emit LogSetOperator(_operator);
    }

    /**
     * @dev set usdc token, can only be call by admin role
     * @param _usdcToken new usdc token address
     **/
    function setUSDCToken(address _usdcToken) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_usdcToken != address(0), "UnoRe: zero usdc address");
        usdcToken = _usdcToken;
        emit LogSetUSDC(_usdcToken);
    }

    /**
     * @dev whitelist pool address, can only be call by admin role
     * @param _pool address of pool to whitelist
     **/
    function addPoolWhiteList(address _pool) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_pool != address(0), "UnoRe: zero pool address");
        require(!poolWhiteList[_pool], "UnoRe: white list already");
        poolWhiteList[_pool] = true;
        emit LogAddPoolWhiteList(_pool);
    }

    /**
     * @dev remove whitelisted pool, can only be call by admin role
     * @param _pool address of pool to remove from whitelist
     **/
    function removePoolWhiteList(address _pool) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolWhiteList[_pool], "UnoRe: no white list");
        poolWhiteList[_pool] = false;
        emit LogRemovePoolWhiteList(_pool);
    }

    /**
     * @dev return total capital in usdc staked in capital agent by pools
     **/
    function totalCapitalStaked() public view returns (uint256) {
        return _getTotalCapitalAvailableInUSDC();
    }

    /**
     * @dev add pool into poolList, can only be call by whitelisted addresses
     * @param _ssip address of pool to add
     **/
    function addPoolToList(address _ssip) external onlyRole(ADMIN_ROLE) {
        require(_ssip != address(0), "UnoRe: zero address");
        require(poolInfo[_ssip].exist == true, "UnoRe: no exist pool");
        bool contains = false;

        for (uint i = 0; i < poolList.length; i++) {
            if (poolList[i] == _ssip) {
                contains = true;
                break;
            }
        }

        if (!contains) {
            poolList.push(_ssip);
            emit LogAddPoolToList(_ssip);
        }
    }

    /**
     * @dev add pool into capitalAgent to stake capital, can only be call by whitelisted pools
     * @param _ssip address of pool to add
     * @param _currency pool lp currency address
     **/
    function addPool(address _ssip, address _currency) external override onlyPoolWhiteList {
        require(_ssip != address(0), "UnoRe: zero address");
        require(!poolInfo[_ssip].exist, "UnoRe: already exist pool");

        if (existedCurrencies[_currency] == false) {
            existedCurrencies[_currency] = true;
            currencyList.push(_currency);
        }

        poolList.push(_ssip);
        poolInfo[_ssip] = PoolInfo({totalCapital: 0, currency: _currency, exist: true});

        emit LogAddPool(_ssip, _currency);
    }

    /**
     * @dev add pool into capitalAgent to stake capital, can only be call by admin role
     * @param _ssip address of pool to add
     * @param _currency pool lp currency address
     **/
    function addPoolByAdmin(address _ssip, address _currency) external onlyRole(ADMIN_ROLE) {
        require(_ssip != address(0), "UnoRe: zero address");
        require(!poolInfo[_ssip].exist, "UnoRe: already exist pool");

        if (existedCurrencies[_currency] == false) {
            existedCurrencies[_currency] = true;
            currencyList.push(_currency);
        }
        poolInfo[_ssip] = PoolInfo({totalCapital: 0, currency: _currency, exist: true});
        poolList.push(_ssip);
        emit LogAddPool(_ssip, _currency);
    }

    /**
     * @dev remove pool from capitalAgent, can only be call by admin role
     * @param _ssip address of pool to remove
     **/
    function removePool(address _ssip) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolInfo[_ssip].exist, "UnoRe: no exit pool");
        if (poolInfo[_ssip].totalCapital > 0) {
            address currency = poolInfo[_ssip].currency;
            totalCapitalStakedByCurrency[currency] = totalCapitalStakedByCurrency[currency] - poolInfo[_ssip].totalCapital;
        }
        delete poolInfo[_ssip];
        emit LogRemovePool(_ssip);
    }

    function setPoolCapital(address _ssip, uint256 _capital) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolInfo[_ssip].exist, "UnoRe: no exit pool");
        address currency = poolInfo[_ssip].currency;
        totalCapitalStakedByCurrency[currency] = _capital;
        poolInfo[_ssip].totalCapital = _capital;
    }

    /**
     * @dev set sales policy, can only be call by SalesPolicyFactory
     * @param _policy address of new SalesPolicy
     **/
    function setPolicy(address _policy) external override nonReentrant {
        require(!policyInfo.exist, "UnoRe: Policy exists");
        require(salesPolicyFactory == msg.sender, "UnoRe: only salesPolicyFactory can call");
        policyInfo = PolicyInfo({policy: _policy, utilizedAmount: 0, exist: true});

        emit LogSetPolicy(_policy);
    }

    /**
     * @dev set sales policy, can only be call by admin role
     * @param _policy address of new SalesPolicy
     **/
    function setPolicyByAdmin(address _policy) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_policy != address(0), "UnoRe: zero address");
        policyInfo = PolicyInfo({policy: _policy, utilizedAmount: 0, exist: true});

        emit LogSetPolicy(_policy);
    }

    /**
     * @dev remove sales policy from capital agent, can only be call by admin role
     **/
    function removePolicy() external onlyRole(ADMIN_ROLE) nonReentrant {
        require(policyInfo.exist, "UnoRe: non existing policy on Capital Agent");
        address _policy = policyInfo.policy;
        policyInfo.policy = address(0);
        policyInfo.exist = false;
        policyInfo.utilizedAmount = 0;
        emit LogRemovePolicy(_policy);
    }

    /**
     * @dev update pool(caller) capital from capital agent,
     * decrease capital of pool by _withdrawAmount, if user withdraw from pool
     * remaning pool capital times MLR should be greater than or equal to the totalPremiumSold
     * @param _withdrawAmount amount to withdraw
     **/
    function SSIPWithdraw(uint256 _withdrawAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _checkCapitalByMLR(msg.sender, _withdrawAmount);
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
    }

    /**
     * @dev update pool(caller) capital from capital agent,
     * decrease capital of pool by _withdrawAmount, if user claim policy from pool
     * @param _withdrawAmount amount to withdraw
     **/
    function SSIPPolicyCaim(uint256 _withdrawAmount, uint256 _policyId, bool _isNotMigrate) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
        if (_isNotMigrate) {
            _SSIPPolicyClaim(_withdrawAmount, _policyId);
        }
    }

    function _SSIPPolicyClaim(uint256 _withdrawAmount, uint256 _policyId) internal {
        address _salesPolicyAddress = policyInfo.policy;
        (uint256 _coverageAmount, , , , ) = ISalesPolicy(_salesPolicyAddress).getPolicyData(_policyId);
        uint256 _claimed = claimedAmount[_salesPolicyAddress][_policyId];
        address _poolCurrency = poolInfo[msg.sender].currency;
        uint256 usdcTokenAmount = IExchangeAgent(exchangeAgent).getNeededTokenAmount(_poolCurrency, usdcToken, _withdrawAmount);
        require(_coverageAmount >= usdcTokenAmount + _claimed, "UnoRe: coverage amount is less");
        claimedAmount[_salesPolicyAddress][_policyId] += usdcTokenAmount;
        bool _isFinished = !(_coverageAmount > (usdcTokenAmount + _claimed));
        if (_isFinished) {
            // @Audit: DUST amount will prevent marking a policy complete
            _markToClaimPolicy(_policyId, _coverageAmount);
        }
    }

    /**
     * @dev update pool(caller) capital from capital agent,
     * increase capital of pool by _stakingAmount, if user stake in pool
     * @param _stakingAmount amount to deposit
     **/
    function SSIPStaking(uint256 _stakingAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _stakingAmount, true);
    }

    /**
     * @dev return if pool can withdraw this amount,
     * remaning pool capital times MLR should be greater than or equal to the totalPremiumSold
     * @param _pool address of pool
     * @param _withdrawAmount withdraw amount
     **/
    function checkCapitalByMLR(address _pool, uint256 _withdrawAmount) external view override returns (bool) {
        return _checkCapitalByMLR(_pool, _withdrawAmount);
    }

    /**
     * @dev return if user can buy policy from this coverage amount,
     * total utlized amount plus coverage should be less than MLR of total capital staked
     * @param _coverageAmount coverage amount
     **/
    function checkCoverageByMLR(uint256 _coverageAmount) external view override returns (bool) {
        return _checkCoverageByMLR(_coverageAmount);
    }

    /**
     * @dev update policy coverage if user buy policy from SalesPolicy, only sales policy can call this function
     * @param _coverageAmount coverage amount
     **/
    function policySale(uint256 _coverageAmount) external override nonReentrant {
        require(msg.sender == policyInfo.policy, "UnoRe: only salesPolicy can call");
        require(policyInfo.exist, "UnoRe: no exist policy");
        require(_checkCoverageByMLR(_coverageAmount), "UnoRe: maximum leverage overflow");
        _updatePolicyCoverage(_coverageAmount, true);
    }

    /**
     * @dev update policy status, if expired update policy coverage and notify to sales policy
     * @param _policyId policy id to update status
     **/
    function updatePolicyStatus(uint256 _policyId) external override nonReentrant {
        require(policyInfo.policy != address(0), "UnoRe: no exist salesPolicy");
        (uint256 _coverageAmount, uint256 _coverageDuration, uint256 _coverStartAt, , ) = ISalesPolicy(policyInfo.policy)
            .getPolicyData(_policyId);
        bool isExpired = block.timestamp >= _coverageDuration + _coverStartAt;
        if (isExpired) {
            _updatePolicyCoverage(_coverageAmount, false);
            ISalesPolicy(policyInfo.policy).updatePolicyExpired(_policyId);
            emit LogUpdatePolicyExpired(policyInfo.policy, _policyId);
        }
    }

    /**
     * @dev update policy status to not exist, can only be called by admin role
     * @param _policyId policy id to update status
     **/
    function markToClaimPolicy(uint256 _policyId) external onlyRole(ADMIN_ROLE) nonReentrant {
        (uint256 _coverageAmount, , , , ) = ISalesPolicy(policyInfo.policy).getPolicyData(_policyId);
        _markToClaimPolicy(_policyId, _coverageAmount);
    }

    function _markToClaimPolicy(uint256 _policyId, uint256 _coverageAmount) private {
        require(policyInfo.policy != address(0), "UnoRe: no exist salesPolicy");
        _updatePolicyCoverage(_coverageAmount, false);
        ISalesPolicy(policyInfo.policy).markToClaim(_policyId);
        emit LogMarkToClaimPolicy(policyInfo.policy, _policyId);
    }

    function _updatePoolCapital(address _pool, uint256 _amount, bool isAdd) private {
        if (!isAdd) {
            require(poolInfo[_pool].totalCapital >= _amount, "UnoRe: pool capital overflow");
        }
        address currency = poolInfo[_pool].currency;
        poolInfo[_pool].totalCapital = isAdd ? poolInfo[_pool].totalCapital + _amount : poolInfo[_pool].totalCapital - _amount;
        totalCapitalStakedByCurrency[currency] = isAdd
            ? totalCapitalStakedByCurrency[currency] + _amount
            : totalCapitalStakedByCurrency[currency] - _amount;
        emit LogUpdatePoolCapital(_pool, poolInfo[_pool].totalCapital, totalCapitalStakedByCurrency[currency]);
    }

    function _updatePolicyCoverage(uint256 _amount, bool isAdd) private {
        if (!isAdd) {
            require(policyInfo.utilizedAmount >= _amount, "UnoRe: policy coverage overflow");
        }
        policyInfo.utilizedAmount = isAdd ? policyInfo.utilizedAmount + _amount : policyInfo.utilizedAmount - _amount;
        emit LogUpdatePolicyCoverage(policyInfo.policy, _amount, policyInfo.utilizedAmount);
    }

    function _checkCapitalByMLR(address _pool, uint256 _withdrawAmount) private view returns (bool) {
        address currency = poolInfo[_pool].currency;
        uint256 totalCapitalAvailableInUSDC;
        //Withdraw amount in USDC
        uint256 withdrawInUSDC = _convertTokenToUSDC(currency, _withdrawAmount);
        //Total Capital Staked in Pools
        totalCapitalAvailableInUSDC = _convertTokenToUSDC(currency, _getTotalCapitalAvailableInUSDC());

        uint256 maxWithdrawAmountInUSDC = (((totalCapitalAvailableInUSDC) * MLR) / CALC_PRECISION) - policyInfo.utilizedAmount;

        require(maxWithdrawAmountInUSDC >= withdrawInUSDC, string.concat("UnoRe: max ammount is", maxWithdrawAmountInUSDC.toString()));

        return policyInfo.utilizedAmount <= ((totalCapitalAvailableInUSDC - withdrawInUSDC) * MLR) / CALC_PRECISION;
    }

    function _convertTokenToUSDC(address _currency, uint256 _amount) private view returns (uint256) {
        uint256 tokenInUSDC;
        if (_currency == usdcToken) {
            tokenInUSDC = _amount;
        } else {
            tokenInUSDC = _currency != address(0)
                ? IExchangeAgent(exchangeAgent).getNeededTokenAmount(_currency, usdcToken, _amount)
                : IExchangeAgent(exchangeAgent).getTokenAmountForETH(usdcToken, _amount);
        }

        return tokenInUSDC;
    }

    function _getTotalCapitalAvailableInUSDC() private view returns (uint256) {
        uint256 totalCapitalStakedInUSDC;
        for (uint256 i = 0; i < currencyList.length; i++) {
            address currency = currencyList[i];
            totalCapitalStakedInUSDC =
                totalCapitalStakedInUSDC +
                _convertTokenToUSDC(currency, totalCapitalStakedByCurrency[currency]);
        }
        return totalCapitalStakedInUSDC;
    }

    function _checkCoverageByMLR(uint256 _newCoverageAmount) private view returns (bool) {
        uint256 totalCapitalStakedInUSDC = _getTotalCapitalAvailableInUSDC();
        uint256 availableCoverage = totalCapitalStakedInUSDC * MLR  / CALC_PRECISION;

       return
            policyInfo.utilizedAmount + _newCoverageAmount <= (availableCoverage * MLR_THRESHOLD / 100);
    }

    /**
     * @dev set new MLR, can only be called by operator
     * @dev MLR(Maximum Leverage Ratio) is a percentage value that defines the amount of coverage
     * we can sell based on the amount of tokens staked in all pools. ie. MLR = 2000000000000000000 means that
     * we can sell an amount of coverage(in USD) <= to 2X the amount(in USD) of tokens Staked in all pools
     * @param _MLR new value to update
     **/
    function setMLR(uint256 _MLR) external onlyOperator nonReentrant {
        require(_MLR > 0, "UnoRe: MLR cannot be zero");
        MLR = _MLR;
        emit LogSetMLR(msg.sender, address(this), _MLR);
    }

    /**
     * @dev set new exchange agent address, can only be called by admin role
     * @param _exchangeAgent new exchange agent address
     **/
    function setExchangeAgent(address _exchangeAgent) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        exchangeAgent = _exchangeAgent;
        emit LogSetExchangeAgent(msg.sender, address(this), _exchangeAgent);
    }
}
