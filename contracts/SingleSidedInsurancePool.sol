// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./uma/ClaimData.sol";
import "./interfaces/OptimisticOracleV3Interface.sol";
import "./interfaces/ICapitalAgent.sol";
import "./interfaces/IMigration.sol";
import "./interfaces/IRewarderFactory.sol";
import "./interfaces/IRiskPoolFactory.sol";
import "./interfaces/ISingleSidedInsurancePool.sol";
import "./interfaces/IRewarder.sol";
import "./interfaces/IRiskPool.sol";
import "./interfaces/ISyntheticSSIPFactory.sol";
import "./interfaces/ISalesPolicy.sol";
import "./interfaces/IGnosisSafe.sol";
import "./interfaces/IClaimProcessor.sol";
import "./libraries/TransferHelper.sol";

contract SingleSidedInsurancePool is
    ISingleSidedInsurancePool,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant CLAIM_PROCESSOR_ROLE = keccak256("CLAIM_PROCESSOR_ROLE");
    bytes32 public constant GUARDIAN_COUNCIL_ROLE = keccak256("GUARDIAN_COUNCIL_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");

    uint256 public constant ACC_UNO_PRECISION = 1e18;

    OptimisticOracleV3Interface public oo;

    IERC20 public defaultCurrency;

    bytes32 public defaultIdentifier;

    address public escalationManager;
    address public migrateTo;
    address public capitalAgent;
    address public syntheticSSIP;
    address public claimProcessor;

    bool public killed;
    address public rewarder;

    bool public failed;
    address public override riskPool;

    uint256 public lockTime;
    uint256 public assertionliveTime;
    uint256 public stakingStartTime;

    struct PoolInfo {
        uint128 lastRewardBlock;
        uint128 accUnoPerShare;
        uint256 unoMultiplierPerBlock;
    }

    struct UserInfo {
        uint256 lastWithdrawTime;
        uint256 rewardDebt;
        uint256 amount;
        bool isNotRollOver;
    }

    struct Policy {
        uint256 insuranceAmount;
        address payoutAddress;
        bool settled;
    }

    mapping(bytes32 => uint256) public assertedPolicies;
    mapping(uint256 => bytes32) public policiesAssertionId;
    mapping(bytes32 => mapping(address => uint256)) public roleLockTime;

    mapping(uint256 => Policy) public policies;

    mapping(address => UserInfo) public userInfo;

    PoolInfo public poolInfo;

    event RiskPoolCreated(address indexed _SSIP, address indexed _pool);
    event StakedInPool(address indexed _staker, address indexed _pool, uint256 _amount);
    event LeftPool(address indexed _staker, address indexed _pool, uint256 _requestAmount);
    event LogUpdatePool(uint128 _lastRewardBlock, uint256 _lpSupply, uint256 _accUnoPerShare);
    event Harvest(address indexed _user, address indexed _receiver, uint256 _amount);
    event LogLeaveFromPendingSSIP(
        address indexed _user,
        address indexed _riskPool,
        uint256 _withdrawLpAmount,
        uint256 _withdrawUnoAmount
    );
    event PolicyClaim(address indexed _user, uint256 _claimAmount);
    event LogLpTransferInSSIP(address indexed _from, address indexed _to, uint256 _amount);
    event LogCreateRewarder(address indexed _SSIP, address indexed _rewarder, address _currency);
    event LogCreateSyntheticSSIP(address indexed _SSIP, address indexed _syntheticSSIP, address indexed _lpToken);
    event LogCancelWithdrawRequest(address indexed _user, uint256 _cancelAmount, uint256 _cancelAmountInUno);
    event LogMigrate(address indexed _user, address indexed _migrateTo, uint256 _migratedAmount);
    event LogSetCapitalAgent(address indexed _SSIP, address indexed _capitalAgent);
    event LogSetRewardMultiplier(address indexed _SSIP, uint256 _rewardPerBlock);
    event LogSetRole(address indexed _SSIP, bytes32 _role, address indexed _account);
    event LogSetMigrateTo(address indexed _SSIP, address indexed _migrateTo);
    event LogSetMinLPCapital(address indexed _SSIP, uint256 _minLPCapital);
    event LogSetLockTime(address indexed _SSIP, uint256 _lockTime);
    event LogSetAssertionAliveTime(address indexed _SSIP, uint256 _assertionAliveTime);
    event LogSetStakingStartTime(address indexed _SSIP, uint256 _startTime);
    event PoolAlived(address indexed _owner, bool _alive);
    event PoolFailed(address indexed _owner, bool _fail);
    event PolicyApproved(address indexed _owner, uint256 _policyId);
    event PolicyRejected(address indexed _owner, uint256 _policyId);
    event InsuranceIssued(bytes32 indexed policyId, bytes insuredEvent, uint256 insuranceAmount, address indexed payoutAddress);

    event InsurancePayoutRequested(uint256 indexed policyId, bytes32 indexed assertionId);

    event InsurancePayoutSettled(uint256 indexed policyId, bytes32 indexed assertionId);
    event RollOverReward(address[] indexed _staker, address indexed _pool, uint256 _amount);

    event LogSetEscalationManager(address indexed _SSIP, address indexed _escalatingManager);
    event LogSetClaimProccessor(address indexed _SSIP, address indexed _claimProccessor);
    event RoleAccepted(address indexed _SSIP, address indexed _previousOwner, address indexed _newOwner);

    function initialize(
        address _capitalAgent,
        address _multiSigWallet,
        address _governance,
        address _claimProcessor,
        address _escalationManager,
        address _defaultCurrency,
        address _optimisticOracleV3
    ) external initializer {
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        require(IGnosisSafe(_multiSigWallet).getOwners().length > 3, "UnoRe: more than three owners requied");
        require(IGnosisSafe(_multiSigWallet).getThreshold() > 1, "UnoRe: more than one owners requied to verify");
        capitalAgent = _capitalAgent;
        lockTime = 10 days;
        assertionliveTime = 10 days;
        escalationManager = _escalationManager;
        claimProcessor = _claimProcessor;
        defaultCurrency = IERC20(_defaultCurrency);
        oo = OptimisticOracleV3Interface(_optimisticOracleV3);
        defaultIdentifier = oo.defaultIdentifier();
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        _grantRole(ADMIN_ROLE, _multiSigWallet);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(GUARDIAN_COUNCIL_ROLE, _governance);
        _setRoleAdmin(GUARDIAN_COUNCIL_ROLE, ADMIN_ROLE);
        _grantRole(CLAIM_PROCESSOR_ROLE, _claimProcessor);
        _setRoleAdmin(CLAIM_PROCESSOR_ROLE, ADMIN_ROLE);
        _setRoleAdmin(BOT_ROLE, ADMIN_ROLE);
    }

    modifier isStartTime() {
        require(block.timestamp >= stakingStartTime, "UnoRe: not available time");
        _;
    }

    modifier roleLockTimePassed(bytes32 _role) {
        require(block.timestamp >= roleLockTime[_role][msg.sender], "UnoRe: roll lock time not passed");
        _;
    }

    modifier isAlive() {
        require(!killed, "UnoRe: pool is killed");
        _;
    }

    function pausePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        _pause();
    }

    function UnpausePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        _unpause();
    }

    function killPool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        killed = true;
        emit PoolAlived(msg.sender, true);
    }

    function revivePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        killed = false;
        emit PoolAlived(msg.sender, false);
    }

    function setFailed(bool _failed) external onlyRole(GUARDIAN_COUNCIL_ROLE) roleLockTimePassed(GUARDIAN_COUNCIL_ROLE) {
        failed = _failed;
        emit PoolFailed(msg.sender, _failed);
    }

    function setEscalatingManager(address _escalatingManager) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        escalationManager = _escalatingManager;
        emit LogSetEscalationManager(address(this), _escalatingManager);
    }

    function setClaimProcessor(address _claimProcessor) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        claimProcessor = _claimProcessor;
        emit LogSetClaimProccessor(address(this), _claimProcessor);
    }

    function setRole(bytes32 _role, address _account) external onlyRole(GUARDIAN_COUNCIL_ROLE) roleLockTimePassed(GUARDIAN_COUNCIL_ROLE) {
        require(_account != address(0), "UnoRe: zero address");
        roleLockTime[_role][_account] = block.timestamp + lockTime;
        _grantRole(_role, _account);
        emit LogSetRole(address(this),_role, _account);
    }

    function setCapitalAgent(address _capitalAgent) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_capitalAgent != address(0), "UnoRe: zero address");
        capitalAgent = _capitalAgent;
        emit LogSetCapitalAgent(address(this), _capitalAgent);
    }

    function setRewardMultiplier(uint256 _rewardMultiplier) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_rewardMultiplier > 0, "UnoRe: zero value");
        poolInfo.unoMultiplierPerBlock = _rewardMultiplier;
        emit LogSetRewardMultiplier(address(this), _rewardMultiplier);
    }

    function setMigrateTo(address _migrateTo) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_migrateTo != address(0), "UnoRe: zero address");
        migrateTo = _migrateTo;
        emit LogSetMigrateTo(address(this), _migrateTo);
    }

    function setMinLPCapital(uint256 _minLPCapital) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_minLPCapital > 0, "UnoRe: not allow zero value");
        IRiskPool(riskPool).setMinLPCapital(_minLPCapital);
        emit LogSetMinLPCapital(address(this), _minLPCapital);
    }

    function setLockTime(uint256 _lockTime) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_lockTime > 0, "UnoRe: not allow zero lock time");
        lockTime = _lockTime;
        emit LogSetLockTime(address(this), _lockTime);
    }

    function setAliveness(uint256 _assertionliveTime) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_assertionliveTime > 0, "UnoRe: not allow zero lock time");
        assertionliveTime = _assertionliveTime;
        emit LogSetAssertionAliveTime(address(this), _assertionliveTime);
    }

    function setStakingStartTime(uint256 _startTime) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        stakingStartTime = _startTime + block.timestamp;
        emit LogSetStakingStartTime(address(this), stakingStartTime);
    }

    /**
     * @dev create Risk pool with UNO from SSIP owner
     */
    function createRiskPool(
        string calldata _name,
        string calldata _symbol,
        address _factory,
        address _currency,
        uint256 _rewardMultiplier,
        uint256 _SCR
    ) external nonReentrant onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(riskPool == address(0), "UnoRe: risk pool created already");
        require(_factory != address(0), "UnoRe: zero factory address");
        riskPool = IRiskPoolFactory(_factory).newRiskPool(_name, _symbol, address(this), _currency);
        poolInfo.lastRewardBlock = uint128(block.number);
        poolInfo.accUnoPerShare = 0;
        poolInfo.unoMultiplierPerBlock = _rewardMultiplier;
        ICapitalAgent(capitalAgent).addPool(address(this), _currency, _SCR);
        emit RiskPoolCreated(address(this), riskPool);
    }

    function createRewarder(address _operator, address _factory, address _currency) external nonReentrant onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_factory != address(0), "UnoRe: rewarder factory no exist");
        require(_operator != address(0), "UnoRe: zero operator address");
        rewarder = IRewarderFactory(_factory).newRewarder(_operator, _currency, address(this));
        emit LogCreateRewarder(address(this), rewarder, _currency);
    }

    function createSyntheticSSIP(address _multiSigWallet, address _factory) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) nonReentrant {
        require(_multiSigWallet != address(0), "UnoRe: zero owner address");
        require(_factory != address(0), "UnoRe:zero factory address");
        require(riskPool != address(0), "UnoRe:zero LP token address");
        syntheticSSIP = ISyntheticSSIPFactory(_factory).newSyntheticSSIP(_multiSigWallet, riskPool);
        emit LogCreateSyntheticSSIP(address(this), syntheticSSIP, riskPool);
    }

    function migrate() external nonReentrant isAlive {
        require(migrateTo != address(0), "UnoRe: zero address");
        _harvest(msg.sender);
        bool isUnLocked = block.timestamp - userInfo[msg.sender].lastWithdrawTime > lockTime;
        uint256 migratedAmount = IRiskPool(riskPool).migrateLP(msg.sender, migrateTo, isUnLocked);
        ICapitalAgent(capitalAgent).SSIPPolicyCaim(migratedAmount, 0, false);
        IMigration(migrateTo).onMigration(msg.sender, migratedAmount, "");
        userInfo[msg.sender].amount = 0;
        userInfo[msg.sender].rewardDebt = 0;
        emit LogMigrate(msg.sender, migrateTo, migratedAmount);
    }

    function pendingUno(address _to) external view returns (uint256 pending) {
        uint256 tokenSupply = IERC20(riskPool).totalSupply();
        uint128 accUnoPerShare = poolInfo.accUnoPerShare;
        if (block.number > poolInfo.lastRewardBlock && tokenSupply != 0) {
            uint256 blocks = block.number - uint256(poolInfo.lastRewardBlock);
            uint256 unoReward = blocks * poolInfo.unoMultiplierPerBlock;
            accUnoPerShare = accUnoPerShare + uint128((unoReward * ACC_UNO_PRECISION) / tokenSupply);
        }
        uint256 userBalance = userInfo[_to].amount;
        pending = (userBalance * uint256(accUnoPerShare)) / ACC_UNO_PRECISION - userInfo[_to].rewardDebt;
    }

    function updatePool() public override {
        if (block.number > poolInfo.lastRewardBlock) {
            uint256 tokenSupply = IERC20(riskPool).totalSupply();
            if (tokenSupply > 0) {
                uint256 blocks = block.number - uint256(poolInfo.lastRewardBlock);
                uint256 unoReward = blocks * poolInfo.unoMultiplierPerBlock;
                poolInfo.accUnoPerShare = poolInfo.accUnoPerShare + uint128(((unoReward * ACC_UNO_PRECISION) / tokenSupply));
            }
            poolInfo.lastRewardBlock = uint128(block.number);
            emit LogUpdatePool(poolInfo.lastRewardBlock, tokenSupply, poolInfo.accUnoPerShare);
        }
    }

    function enterInPool(uint256 _amount) external payable override isStartTime isAlive nonReentrant {
        _depositIn(_amount);
        _enterInPool(_amount, msg.sender);
        emit StakedInPool(msg.sender, riskPool, _amount);
    }

    /**
     * @dev WR will be in pending for 10 days at least
     */
    function leaveFromPoolInPending(uint256 _amount) external override isStartTime whenNotPaused nonReentrant {
        _harvest(msg.sender);
        require(ICapitalAgent(capitalAgent).checkCapitalByMCR(address(this), _amount), "UnoRe: minimum capital underflow");
        // Withdraw desired amount from pool
        uint256 amount = userInfo[msg.sender].amount;
        uint256 lpPriceUno = IRiskPool(riskPool).lpPriceUno();
        (uint256 pendingAmount, , ) = IRiskPool(riskPool).getWithdrawRequest(msg.sender);
        require(amount - pendingAmount >= (_amount * 1e18) / lpPriceUno, "UnoRe: withdraw amount overflow");
        IRiskPool(riskPool).leaveFromPoolInPending(msg.sender, _amount);

        userInfo[msg.sender].lastWithdrawTime = block.timestamp;
        emit LeftPool(msg.sender, riskPool, _amount);
    }

    /**
     * @dev user can submit claim again and receive his funds into his wallet after 10 days since last WR.
     */
    function leaveFromPending() external override isStartTime whenNotPaused nonReentrant {
        require(block.timestamp - userInfo[msg.sender].lastWithdrawTime >= lockTime, "UnoRe: Locked time");
        _harvest(msg.sender);
        uint256 amount = userInfo[msg.sender].amount;
        (uint256 pendingAmount, , ) = IRiskPool(riskPool).getWithdrawRequest(msg.sender);

        uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
        userInfo[msg.sender].rewardDebt =
            accumulatedUno -
            ((pendingAmount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);
        (uint256 withdrawAmount, uint256 withdrawAmountInUNO) = IRiskPool(riskPool).leaveFromPending(msg.sender);
        userInfo[msg.sender].amount = amount - withdrawAmount;
        ICapitalAgent(capitalAgent).SSIPWithdraw(withdrawAmountInUNO);
        emit LogLeaveFromPendingSSIP(msg.sender, riskPool, withdrawAmount, withdrawAmountInUNO);
    }

    function lpTransfer(address _from, address _to, uint256 _amount) external override nonReentrant whenNotPaused {
        require(msg.sender == address(riskPool), "UnoRe: not allow others transfer");
        if (_from != syntheticSSIP && _to != syntheticSSIP) {
            _harvest(_from);
            uint256 amount = userInfo[_from].amount;
            (uint256 pendingAmount, , ) = IRiskPool(riskPool).getWithdrawRequest(_from);
            require(amount - pendingAmount >= _amount, "UnoRe: balance overflow");
            uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
            userInfo[_from].rewardDebt = accumulatedUno - ((_amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);
            userInfo[_from].amount = amount - _amount;

            userInfo[_to].rewardDebt =
                userInfo[_to].rewardDebt +
                ((_amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);
            userInfo[_to].amount = userInfo[_to].amount + _amount;

            emit LogLpTransferInSSIP(_from, _to, _amount);
        }
    }

    function harvest(address _to) external override whenNotPaused isAlive isStartTime nonReentrant {
        _harvest(_to);
    }

    function _harvest(address _to) private {
        updatePool();

        uint256 _pendingUno = _updateReward(_to);

        if (rewarder != address(0) && _pendingUno != 0) {
            IRewarder(rewarder).onReward(_to, _pendingUno);
        }

        emit Harvest(msg.sender, _to, _pendingUno);
    }

    function toggleRollOver() external {
        userInfo[msg.sender].isNotRollOver = !userInfo[msg.sender].isNotRollOver;
    }

    function rollOverReward(address[] memory _to) external isStartTime isAlive onlyRole(BOT_ROLE) nonReentrant {
        require(IRiskPool(riskPool).currency() == IRewarder(rewarder).currency(), "UnoRe: currency not matched");
        updatePool();
        uint256 _totalPendingUno;
        for (uint256 i; i < _to.length; i++) {
            require(!userInfo[_to[i]].isNotRollOver, "UnoRe: rollover is not set");

            uint256 _pendingUno = _updateReward(_to[i]);
            _totalPendingUno += _pendingUno;

            _enterInPool(_pendingUno, _to[i]);
        }

        if (rewarder != address(0) && _totalPendingUno != 0) {
            IRewarder(rewarder).onReward(riskPool, _totalPendingUno);
        }
        emit RollOverReward(_to, riskPool, _totalPendingUno);
    }

    function cancelWithdrawRequest() external nonReentrant {
        (uint256 cancelAmount, uint256 cancelAmountInUno) = IRiskPool(riskPool).cancelWithrawRequest(msg.sender);
        emit LogCancelWithdrawRequest(msg.sender, cancelAmount, cancelAmountInUno);
    }

    function getStakedAmountPerUser(address _to) external view returns (uint256 unoAmount, uint256 lpAmount) {
        lpAmount = userInfo[_to].amount;
        uint256 lpPriceUno = IRiskPool(riskPool).lpPriceUno();
        unoAmount = (lpAmount * lpPriceUno) / 1e18;
    }

    /**
     * @dev get withdraw request amount in pending per user in UNO
     */
    function getWithdrawRequestPerUser(
        address _user
    ) external view returns (uint256 pendingAmount, uint256 pendingAmountInUno, uint256 originUnoAmount, uint256 requestTime) {
        uint256 lpPriceUno = IRiskPool(riskPool).lpPriceUno();
        (pendingAmount, requestTime, originUnoAmount) = IRiskPool(riskPool).getWithdrawRequest(_user);
        pendingAmountInUno = (pendingAmount * lpPriceUno) / 1e18;
    }

    /**
     * @dev get total withdraw request amount in pending for the risk pool in UNO
     */
    function getTotalWithdrawPendingAmount() external view returns (uint256) {
        return IRiskPool(riskPool).getTotalWithdrawRequestAmount();
    }

    function requestPayout(uint256 _policyId, uint256 _amount, address _to) public isAlive returns (bytes32 assertionId) {
        (address salesPolicy, , ) = ICapitalAgent(capitalAgent).getPolicyInfo();
        require(IERC721(salesPolicy).ownerOf(_policyId) == msg.sender, "UnoRe: not owner of policy id");
        (uint256 _coverageAmount, , , bool _exist, bool _expired) = ISalesPolicy(salesPolicy).getPolicyData(_policyId);
        require(_amount <= _coverageAmount, "UnoRe: amount exceeds coverage amount");
        require(_exist && !_expired, "UnoRe: policy expired or not exist");
        Policy memory _policyData = policies[_policyId];
        _policyData.insuranceAmount = _amount;
        _policyData.payoutAddress = _to;
        policies[_policyId] = _policyData;
        if (!failed) {
            uint256 bond = oo.getMinimumBond(address(defaultCurrency));
            assertionId = oo.assertTruth(
                abi.encodePacked(
                    "Insurance contract is claiming that insurance event ",
                    " had occurred as of ",
                    ClaimData.toUtf8BytesUint(block.timestamp),
                    "."
                ),
                _to,
                address(this),
                escalationManager,
                uint64(assertionliveTime),
                defaultCurrency,
                bond,
                defaultIdentifier,
                bytes32(0) // No domain.
            );
            assertedPolicies[assertionId] = _policyId;
            policiesAssertionId[_policyId] = assertionId;
            emit InsurancePayoutRequested(_policyId, assertionId);
        } else {
            IClaimProcessor(claimProcessor).requestPolicyId(_policyId);
        }
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external isAlive {
        require(!failed, "UnoRe: pool failed");
        // If the assertion was true, then the policy is settled.
        if (_assertedTruthfully) {
            uint256 _policyId = assertedPolicies[_assertionId];
            settlePayout(_policyId, _assertionId);
        }
    }

    function assertionDisputedCallback(bytes32 assertionId) external {}

    function settlePayout(uint256 _policyId, bytes32 _assertionId) public isAlive onlyRole(CLAIM_PROCESSOR_ROLE)  roleLockTimePassed(CLAIM_PROCESSOR_ROLE) {
        // If already settled, do nothing. We don't revert because this function is called by the
        // OptimisticOracleV3, which may block the assertion resolution.
        Policy storage policy = policies[_policyId];
        if (policy.settled) return;
        policy.settled = true;
        uint256 realClaimAmount = IRiskPool(riskPool).policyClaim(policy.payoutAddress, policy.insuranceAmount);
        ICapitalAgent(capitalAgent).SSIPPolicyCaim(realClaimAmount, uint256(_policyId), true);

        emit InsurancePayoutSettled(_policyId, _assertionId);
    }

    function _enterInPool(uint256 _amount, address _to) internal {
        require(_amount != 0, "UnoRe: ZERO Value");
        updatePool();
        uint256 lpPriceUno = IRiskPool(riskPool).lpPriceUno();
        IRiskPool(riskPool).enter(_to, _amount);
        UserInfo memory _userInfo = userInfo[_to];
        _userInfo.rewardDebt =
            _userInfo.rewardDebt +
            ((_amount * 1e18 * uint256(poolInfo.accUnoPerShare)) / lpPriceUno) /
            ACC_UNO_PRECISION;
        _userInfo.amount = _userInfo.amount + ((_amount * 1e18) / lpPriceUno);
        userInfo[_to] = _userInfo;
        ICapitalAgent(capitalAgent).SSIPStaking(_amount);
    }

    function _updateReward(address _to) internal returns (uint256) {
        uint256 amount = userInfo[_to].amount;
        uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
        uint256 _pendingUno = accumulatedUno - userInfo[_to].rewardDebt;

        // Effects
        userInfo[_to].rewardDebt = accumulatedUno;
        return _pendingUno;
    }

    function _depositIn(uint256 _amount) internal {
        address token = IRiskPool(riskPool).currency();
        if (token == address(0)) {
            require(msg.value >= _amount, "UnoRe: insufficient paid");
            if (msg.value > _amount) {
                TransferHelper.safeTransferETH(msg.sender, msg.value - _amount);
            }
            TransferHelper.safeTransferETH(riskPool, _amount);
        } else {
            TransferHelper.safeTransferFrom(token, msg.sender, riskPool, _amount);
        }
    }
}
