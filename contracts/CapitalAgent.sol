// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./interfaces/ISalesPolicy.sol";
import "./interfaces/IExchangeAgent.sol";
import "./interfaces/ICapitalAgent.sol";
import "./interfaces/IGnosisSafe.sol";

contract CapitalAgent is ICapitalAgent, ReentrancyGuardUpgradeable, AccessControlUpgradeable {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    address public exchangeAgent;
    address public salesPolicyFactory;
    address public usdcToken;
    address public operator;

    struct PoolInfo {
        uint256 totalCapital;
        uint256 SCR;
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
    mapping(address => bool) private existedCurrencies;
    mapping(address => uint256) private totalCapitalStakedByCurrency;

    PolicyInfo public policyInfo;

    uint256 public totalUtilizedAmount;

    uint256 public MCR;
    uint256 public MLR;

    uint256 public constant CALC_PRECISION = 1e18;

    mapping(address => bool) public poolWhiteList;

    event LogAddPool(address indexed _ssip, address _currency, uint256 _scr);
    event LogRemovePool(address indexed _ssip);
    event LogSetPolicy(address indexed _salesPolicy);
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
    event LogSetSCR(address indexed _owner, address indexed _capitalAgent, address indexed _pool, uint256 _SCR);
    event LogSetExchangeAgent(address indexed _owner, address indexed _capitalAgent, address _exchangeAgent);
    event LogSetSalesPolicyFactory(address indexed _factory);
    event LogAddPoolWhiteList(address indexed _pool);
    event LogRemovePoolWhiteList(address indexed _pool);
    event LogSetOperator(address indexed _operator);

    function initialize(
        address _exchangeAgent,
        address _USDC_TOKEN,
        address _multiSigWallet,
        address _operator
    ) external initializer {
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_USDC_TOKEN != address(0), "UnoRe: zero USDC address");
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        require(IGnosisSafe(_multiSigWallet).getOwners().length > 3, "UnoRe: more than three owners requied");
        require(IGnosisSafe(_multiSigWallet).getThreshold() > 1, "UnoRe: more than one owners requied to verify");
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

    function setSalesPolicyFactory(address _factory) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_factory != address(0), "UnoRe: zero factory address");
        salesPolicyFactory = _factory;
        emit LogSetSalesPolicyFactory(_factory);
    }

    function setOperator(address _operator) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_operator != address(0), "UnoRe: zero operator address");
        operator = _operator;
        emit LogSetOperator(_operator);
    }

    function addPoolWhiteList(address _pool) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_pool != address(0), "UnoRe: zero pool address");
        require(!poolWhiteList[_pool], "UnoRe: white list already");
        poolWhiteList[_pool] = true;
        emit LogAddPoolWhiteList(_pool);
    }

    function removePoolWhiteList(address _pool) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolWhiteList[_pool], "UnoRe: no white list");
        poolWhiteList[_pool] = false;
        emit LogRemovePoolWhiteList(_pool);
    }

    function totalCapitalStaked() public view returns(uint256) {
        return _getTotalCapitalStakedInUSDC();
    }

    function addPool(address _ssip, address _currency, uint256 _scr) external override onlyPoolWhiteList {
        require(_ssip != address(0), "UnoRe: zero address");
        require(!poolInfo[_ssip].exist, "UnoRe: already exist pool");

        if (existedCurrencies[_currency] == false) {
            existedCurrencies[_currency] = true;
            currencyList.push(_currency);
        }
        poolInfo[_ssip] = PoolInfo({totalCapital: 0, currency: _currency, SCR: _scr, exist: true});

        emit LogAddPool(_ssip, _currency, _scr);
    }

    function addPoolByAdmin(address _ssip, address _currency, uint256 _scr) external onlyRole(ADMIN_ROLE) {
        require(_ssip != address(0), "UnoRe: zero address");
        require(!poolInfo[_ssip].exist, "UnoRe: already exist pool");

        if (existedCurrencies[_currency] == false) {
            existedCurrencies[_currency] = true;
            currencyList.push(_currency);
        }
        poolInfo[_ssip] = PoolInfo({totalCapital: 0, currency: _currency, SCR: _scr, exist: true});

        emit LogAddPool(_ssip, _currency, _scr);
    }

    function removePool(address _ssip) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(poolInfo[_ssip].exist, "UnoRe: no exit pool");
        if (poolInfo[_ssip].totalCapital > 0) {
            address currency = poolInfo[_ssip].currency;
            totalCapitalStakedByCurrency[currency] = totalCapitalStakedByCurrency[currency] - poolInfo[_ssip].totalCapital;
        }
        delete poolInfo[_ssip];
        emit LogRemovePool(_ssip);
    }

    function setPolicy(address _policy) external override nonReentrant {
        require(!policyInfo.exist, "UnoRe: Policy exists");
        require(salesPolicyFactory == msg.sender, "UnoRe: only salesPolicyFactory can call");
        policyInfo = PolicyInfo({policy: _policy, utilizedAmount: 0, exist: true});

        emit LogSetPolicy(_policy);
    }

    function setPolicyByAdmin(address _policy) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_policy != address(0), "UnoRe: zero address");
        policyInfo = PolicyInfo({policy: _policy, utilizedAmount: 0, exist: true});

        emit LogSetPolicy(_policy);
    }

    function removePolicy() external onlyRole(ADMIN_ROLE) nonReentrant {
        require(policyInfo.exist, "UnoRe: no exit pool");
        totalUtilizedAmount = 0;
        address _policy = policyInfo.policy;
        policyInfo.policy = address(0);
        policyInfo.exist = false;
        policyInfo.utilizedAmount = 0;
        emit LogRemovePolicy(_policy);
    }

    function SSIPWithdraw(uint256 _withdrawAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        require(_checkCapitalByMCRAndSCR(msg.sender, _withdrawAmount), "UnoRe: minimum capital underflow");
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
    }

    function SSIPPolicyCaim(uint256 _withdrawAmount, uint256 _policyId, bool _isFinished) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _withdrawAmount, false);
        if (_isFinished) {
            _markToClaimPolicy(_policyId);
        }
    }

    function SSIPStaking(uint256 _stakingAmount) external override nonReentrant {
        require(poolInfo[msg.sender].exist, "UnoRe: no exist ssip");
        _updatePoolCapital(msg.sender, _stakingAmount, true);
    }

    function checkCapitalByMCR(address _pool, uint256 _withdrawAmount) external view override returns (bool) {
        return _checkCapitalByMCRAndSCR(_pool, _withdrawAmount);
    }

    function checkCoverageByMLR(uint256 _coverageAmount) external view override returns (bool) {
        return _checkCoverageByMLR(_coverageAmount);
    }

    function policySale(uint256 _coverageAmount) external override nonReentrant {
        require(msg.sender == policyInfo.policy, "UnoRe: only salesPolicy can call");
        require(policyInfo.exist, "UnoRe: no exist policy");
        require(_checkCoverageByMLR(_coverageAmount), "UnoRe: maximum leverage overflow");
        _updatePolicyCoverage(_coverageAmount, true);
    }

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

    function markToClaimPolicy(uint256 _policyId) external onlyRole(ADMIN_ROLE) nonReentrant {
        _markToClaimPolicy(_policyId);
    }

    function _markToClaimPolicy(uint256 _policyId) private {
        require(policyInfo.policy != address(0), "UnoRe: no exist salesPolicy");
        (uint256 _coverageAmount, , , , ) = ISalesPolicy(policyInfo.policy).getPolicyData(_policyId);
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
        totalCapitalStakedByCurrency[currency] = isAdd ? totalCapitalStakedByCurrency[currency] + _amount : totalCapitalStakedByCurrency[currency] - _amount;
        emit LogUpdatePoolCapital(_pool, poolInfo[_pool].totalCapital, totalCapitalStakedByCurrency[currency]);
    }

    function _updatePolicyCoverage(uint256 _amount, bool isAdd) private {
        if (!isAdd) {
            require(policyInfo.utilizedAmount >= _amount, "UnoRe: policy coverage overflow");
        }
        policyInfo.utilizedAmount = isAdd ? policyInfo.utilizedAmount + _amount : policyInfo.utilizedAmount - _amount;
        totalUtilizedAmount = isAdd ? totalUtilizedAmount + _amount : totalUtilizedAmount - _amount;
        emit LogUpdatePolicyCoverage(policyInfo.policy, _amount, policyInfo.utilizedAmount, totalUtilizedAmount);
    }

    function _checkCapitalByMCRAndSCR(address _pool, uint256 _withdrawAmount) private view returns (bool) {
        address currency = poolInfo[_pool].currency;
        uint256 totalCapitalStakedInUSDC;
        uint256 mcrInUSDC;
        uint256 scrInUSDC;

        totalCapitalStakedInUSDC = _getTotalCapitalStakedInUSDC();
        mcrInUSDC = _convertTokenToUSDC(currency, totalCapitalStakedByCurrency[currency] - _withdrawAmount);
        scrInUSDC = _convertTokenToUSDC(currency, poolInfo[_pool].totalCapital - _withdrawAmount);

        bool isMCRPass = mcrInUSDC >= (totalCapitalStakedInUSDC * MCR) / CALC_PRECISION;
        bool isSCRPass = scrInUSDC >= poolInfo[_pool].SCR;

        return isMCRPass && isSCRPass;
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

    function _getTotalCapitalStakedInUSDC() private view returns (uint256) {
        uint256 totalCapitalStakedInUSDC;
        for (uint256 i = 0; i < currencyList.length; i++) {
            address currency = currencyList[i];
            totalCapitalStakedInUSDC = totalCapitalStakedInUSDC + _convertTokenToUSDC(currency, totalCapitalStakedByCurrency[currency]);
        }

        return totalCapitalStakedInUSDC;
    }

    function _checkCoverageByMLR(uint256 _newCoverageAmount) private view returns (bool) {
        uint256 totalCapitalStakedInUSDC = _getTotalCapitalStakedInUSDC();
        return totalUtilizedAmount + _newCoverageAmount <= (totalCapitalStakedInUSDC * MLR) / CALC_PRECISION;
    }

    function setMCR(uint256 _MCR) external onlyOperator nonReentrant {
        require(_MCR > 0, "UnoRe: zero mcr");
        MCR = _MCR;
        emit LogSetMCR(msg.sender, address(this), _MCR);
    }

    function setMLR(uint256 _MLR) external onlyOperator nonReentrant {
        require(_MLR > 0, "UnoRe: zero mlr");
        MLR = _MLR;
        emit LogSetMLR(msg.sender, address(this), _MLR);
    }

    function setSCR(uint256 _SCR, address _pool) external onlyOperator nonReentrant {
        require(_SCR > 0, "UnoRe: zero scr");
        poolInfo[_pool].SCR = _SCR;
        emit LogSetSCR(msg.sender, address(this), _pool, _SCR);
    }

    function setExchangeAgent(address _exchangeAgent) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        exchangeAgent = _exchangeAgent;
        emit LogSetExchangeAgent(msg.sender, address(this), _exchangeAgent);
    }
}
