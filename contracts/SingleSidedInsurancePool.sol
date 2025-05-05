// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

import "./interfaces/ICapitalAgent.sol";
import "./interfaces/IMigration.sol";
import "./interfaces/IRewarderFactory.sol";
import "./interfaces/IRiskPoolFactory.sol";
import "./interfaces/ISingleSidedInsurancePool.sol";
import "./interfaces/IRewarder.sol";
import "./interfaces/IRiskPool.sol";
import "./libraries/TransferHelper.sol";

contract SingleSidedInsurancePool is
    ISingleSidedInsurancePool,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable
{
    bytes32 public constant CLAIM_PROCESSOR_ROLE = keccak256("CLAIM_PROCESSOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");

    uint256 public constant ACC_UNO_PRECISION = 1e18;

    address public migrateTo;
    address public capitalAgent;

    bool public killed;
    bool public emergencyWithdrawAllowed;
    address public rewarder;

    address public override riskPool;

    uint256 public lockTime;
    uint256 public stakingStartTime;

    struct PoolInfo {
        uint256 lastRewardBlock;
        uint256 accUnoPerShare;
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

    mapping(bytes32 => mapping(address => uint256)) public roleLockTime;

    mapping(uint256 => Policy) public policies;

    mapping(address => UserInfo) public userInfo;

    PoolInfo public poolInfo;

    event RiskPoolCreated(address indexed _SSIP, address indexed _pool);
    event StakedInPool(address indexed _staker, address indexed _pool, uint256 _amount);
    event LeftPool(address indexed _staker, address indexed _pool, uint256 _requestAmount);
    event LogUpdatePool(uint256 _lastRewardBlock, uint256 _lpSupply, uint256 _accUnoPerShare);
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
    event LogCancelWithdrawRequest(address indexed _user, uint256 _cancelAmount, uint256 _cancelAmountInUno);
    event LogMigrate(address indexed _user, address indexed _migrateTo, uint256 _migratedAmount);
    event LogSetCapitalAgent(address indexed _SSIP, address indexed _capitalAgent);
    event LogSetRewardMultiplier(address indexed _SSIP, uint256 _rewardPerBlock);
    event LogSetRole(address indexed _SSIP, bytes32 _role, address indexed _account);
    event LogSetMigrateTo(address indexed _SSIP, address indexed _migrateTo);
    event LogSetMinLPCapital(address indexed _SSIP, uint256 _minLPCapital);
    event LogSetLockTime(address indexed _SSIP, uint256 _lockTime);
    event LogSetStakingStartTime(address indexed _SSIP, uint256 _startTime);
    event PoolAlived(address indexed _owner, bool _alive);
    event PoolFailed(address indexed _owner, bool _fail);
    event KillPool(address indexed _owner, bool _killed);
    event InsurancePayoutSettled(uint256 indexed policyId, address indexed payout, uint256 amount);
    event RollOverReward(address[] indexed _staker, address indexed _pool, uint256 _amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event EmergencyWithdrawToggled(address indexed user, bool EmergencyWithdraw);
    event LogUserUpdated(address indexed pool, address indexed user, uint256 amount);

    function initialize(address _capitalAgent, address _multiSigWallet) external initializer {
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        capitalAgent = _capitalAgent;
        lockTime = 10 days;
        __ReentrancyGuard_init();
        __Pausable_init();
        __AccessControl_init();
        _grantRole(ADMIN_ROLE, _multiSigWallet);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _setRoleAdmin(CLAIM_PROCESSOR_ROLE, ADMIN_ROLE); // TODO
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

    /**
     * @dev pause pool to restrict pool functionality, can only by called by admin role
     */
    function pausePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev unpause pool, can only by called by admin role
     */
    function unpausePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev kill pool to restrict pool functionality, can only by called by admin role
     */
    function killPool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        killed = true;
        emit KillPool(msg.sender, true);
    }

    /**
     * @dev revive pool, can only by called by admin role
     */
    function revivePool() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        killed = false;
        emit PoolAlived(msg.sender, false);
    }

    function setRole(
        bytes32 _role,
        address _account
    ) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) whenNotPaused isAlive {
        require(_account != address(0), "UnoRe: zero address");
        roleLockTime[_role][_account] = block.timestamp + lockTime;
        _grantRole(_role, _account);
        emit LogSetRole(address(this), _role, _account);
    }

    /**
     * @dev set new capital agent, can only by called by admin role
     * @param _capitalAgent new capital agent address
     */
    function setCapitalAgent(address _capitalAgent) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_capitalAgent != address(0), "UnoRe: zero address");
        capitalAgent = _capitalAgent;
        emit LogSetCapitalAgent(address(this), _capitalAgent);
    }

    /**
     * @dev update reward muiltiplier, can only by called by admin role
     * @param _rewardMultiplier value to set
     */
    function setRewardMultiplier(uint256 _rewardMultiplier) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_rewardMultiplier > 0, "UnoRe: zero value");
        poolInfo.unoMultiplierPerBlock = _rewardMultiplier;
        emit LogSetRewardMultiplier(address(this), _rewardMultiplier);
    }

    /**
     * @dev set migrate address, can only by called by admin role
     * @param _migrateTo new migrate address
     */
    function setMigrateTo(address _migrateTo) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_migrateTo != address(0), "UnoRe: zero address");
        migrateTo = _migrateTo;
        emit LogSetMigrateTo(address(this), _migrateTo);
    }

    /**
     * @dev update min lp capital, only admin role call this function
     */
    function setMinLPCapital(uint256 _minLPCapital) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_minLPCapital > 0, "UnoRe: not allow zero value");
        IRiskPool(riskPool).setMinLPCapital(_minLPCapital);
        emit LogSetMinLPCapital(address(this), _minLPCapital);
    }

    /**
     * @dev lock time, only admin role call this function
     */
    function setLockTime(uint256 _lockTime) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_lockTime > 0, "UnoRe: not allow zero lock time");
        lockTime = _lockTime;
        emit LogSetLockTime(address(this), _lockTime);
    }

    /**
     * @dev set staking start time, only admin role call this function
     */
    function setStakingStartTime(uint256 _startTime) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        stakingStartTime = _startTime + block.timestamp;
        emit LogSetStakingStartTime(address(this), stakingStartTime);
    }

    /**
     * @dev toggle emergency withdraw bool to restrict or use this emergency withdraw,
     * only admin role call this function
     */
    function toggleEmergencyWithdraw() external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        emergencyWithdrawAllowed = !emergencyWithdrawAllowed;
        emit EmergencyWithdrawToggled(address(this), emergencyWithdrawAllowed);
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
        require(_factory != address(0), "UnoRe: zero factory address");
        riskPool = IRiskPoolFactory(_factory).newRiskPool(_name, _symbol, address(this), _currency);
        poolInfo.lastRewardBlock = block.number;
        poolInfo.accUnoPerShare = 0;
        poolInfo.unoMultiplierPerBlock = _rewardMultiplier;
        ICapitalAgent(capitalAgent).addPool(address(this), _currency, _SCR);
        emit RiskPoolCreated(address(this), riskPool);
    }

    /**
     * @dev create rewarder with UNO token
     */
    function createRewarder(
        address _operator,
        address _factory,
        address _currency
    ) external nonReentrant onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        require(_factory != address(0), "UnoRe: rewarder factory no exist");
        require(_operator != address(0), "UnoRe: zero operator address");
        rewarder = IRewarderFactory(_factory).newRewarder(_operator, _currency, address(this));
        emit LogCreateRewarder(address(this), rewarder, _currency);
    }

    /**
     * @dev migrate user to new version
     */
    function migrate() external nonReentrant whenNotPaused isAlive {
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

    /**
     * @dev return pending uno to claim of `_to` address
     */
    function pendingUno(address _to) external view returns (uint256 pending) {
        uint256 tokenSupply = IERC20(riskPool).totalSupply();
        uint256 accUnoPerShare = poolInfo.accUnoPerShare;
        if (block.number > poolInfo.lastRewardBlock && tokenSupply != 0) {
            uint256 blocks = block.number - uint256(poolInfo.lastRewardBlock);
            uint256 unoReward = blocks * poolInfo.unoMultiplierPerBlock;
            accUnoPerShare = accUnoPerShare + (unoReward * ACC_UNO_PRECISION) / tokenSupply;
        }
        (uint256 pendingAmount,,) = IRiskPool(riskPool).getWithdrawRequest(_to);
        uint256 userBalance = userInfo[_to].amount - pendingAmount;
        if(userBalance == 0){
            pending = 0;
        }
        else {
            pending = (userBalance * uint256(accUnoPerShare)) / ACC_UNO_PRECISION - userInfo[_to].rewardDebt;
        }
    }

    /**
     * @dev update pool last reward and accumulated uno per share,
     * update every time when use enter, withdraw from pool
     */
    function updatePool() public override {
        if (block.number > poolInfo.lastRewardBlock) {
            uint256 tokenSupply = IERC20(riskPool).totalSupply();
            if (tokenSupply > 0) {
                uint256 blocks = block.number - uint256(poolInfo.lastRewardBlock);
                uint256 unoReward = blocks * poolInfo.unoMultiplierPerBlock;
                poolInfo.accUnoPerShare = poolInfo.accUnoPerShare + ((unoReward * ACC_UNO_PRECISION) / tokenSupply);
            }
            poolInfo.lastRewardBlock = block.number;
            emit LogUpdatePool(poolInfo.lastRewardBlock, tokenSupply, poolInfo.accUnoPerShare);
        }
    }

    /**
     * @dev stake user collateral, update user reward per block
     * @param _amount amount to deposit to pool
     */
    function enterInPool(uint256 _amount) external payable override whenNotPaused isAlive isStartTime nonReentrant {
        _depositIn(_amount);
        _enterInPool(_amount, msg.sender);
        emit StakedInPool(msg.sender, riskPool, _amount);
    }

    /**
     * @dev WR will be in pending for 10 days at least
     */
    function leaveFromPoolInPending(uint256 _amount) external override whenNotPaused isStartTime nonReentrant {
        _harvest(msg.sender);
        require(ICapitalAgent(capitalAgent).checkCapitalByMCR(address(this), _amount), "UnoRe: minimum capital underflow");
        // Withdraw desired amount from pool
        uint256 amount = userInfo[msg.sender].amount;
        uint256 lpPriceUno = IRiskPool(riskPool).lpPriceUno();
        (uint256 pendingAmount, , ) = IRiskPool(riskPool).getWithdrawRequest(msg.sender);
        require(amount - pendingAmount >= (_amount * 1e18) / lpPriceUno, "UnoRe: withdraw amount overflow");
        IRiskPool(riskPool).leaveFromPoolInPending(msg.sender, _amount);

        userInfo[msg.sender].lastWithdrawTime = block.timestamp;
        //As user is starting the withdraw we add the value to pending capital
        ICapitalAgent(capitalAgent).updatePoolWithdrawPendingCapital(address(this), _amount, true);
        emit LeftPool(msg.sender, riskPool, _amount);
    }

    /**
     * @dev user can submit claim again and receive his funds into his wallet after 10 days since last WR.
     */
    function leaveFromPending(uint256 _amount) external override isStartTime whenNotPaused nonReentrant {
        require(_amount > 0, "Withdraw amount should be greator than zero");
        require(block.timestamp - userInfo[msg.sender].lastWithdrawTime >= lockTime, "UnoRe: Locked time");
        _harvest(msg.sender);
        uint256 amount = userInfo[msg.sender].amount;

        (uint256 withdrawAmount, uint256 withdrawAmountInUNO) = IRiskPool(riskPool).leaveFromPending(msg.sender, _amount);

        //As user is finishing the withdraw we subtract the value of pending capital (done inside SSIPWithdraw)
        ICapitalAgent(capitalAgent).SSIPWithdraw(withdrawAmountInUNO);

        uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
        userInfo[msg.sender].rewardDebt =
            accumulatedUno -
            ((withdrawAmount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);

        userInfo[msg.sender].amount = amount - withdrawAmount;

        emit LogLeaveFromPendingSSIP(msg.sender, riskPool, withdrawAmount, withdrawAmountInUNO);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw() public nonReentrant whenNotPaused {
        require(emergencyWithdrawAllowed, "Unore: emergencyWithdraw is not allowed");
        UserInfo memory user = userInfo[msg.sender];
        uint256 amount = user.amount;
        require(amount > 0, "Unore: Zero user amount");
        delete userInfo[msg.sender];
        IRiskPool(riskPool).emergencyWithdraw(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    function lpTransfer(address _from, address _to, uint256 _amount) external override nonReentrant whenNotPaused isAlive {
        require(msg.sender == address(riskPool), "UnoRe: not allow others transfer");
        _harvest(_from);
        uint256 amount = userInfo[_from].amount;
        (uint256 pendingAmount, , ) = IRiskPool(riskPool).getWithdrawRequest(_from);
        require(amount - pendingAmount >= _amount, "UnoRe: balance overflow");
        uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
        userInfo[_from].rewardDebt = accumulatedUno - ((_amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);
        userInfo[_from].amount = amount - _amount;

        userInfo[_to].rewardDebt = userInfo[_to].rewardDebt + ((_amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION);
        userInfo[_to].amount = userInfo[_to].amount + _amount;

        emit LogLpTransferInSSIP(_from, _to, _amount);
    }

    /**
     * @dev withdraw user pending uno
     * @param _to user address
     */
    function harvest(address _to) external override whenNotPaused isAlive isStartTime nonReentrant {
        _harvest(_to);
    }

    function _harvest(address _to) private {
        updatePool();

        (uint256 _pendingUno, uint256 _amount) = _updateReward(_to);

        if (rewarder != address(0) && _pendingUno != 0) {
            IRewarder(rewarder).onReward(_to, _pendingUno, _amount);
        }

        emit Harvest(msg.sender, _to, _pendingUno);
    }

    /**
     * @dev user can toggle its roll over bool
     */
    function toggleRollOver() external {
        userInfo[msg.sender].isNotRollOver = !userInfo[msg.sender].isNotRollOver;
    }

    /**
     * @dev user roll over its pending uno to stake
     */
    function rollOverReward(address[] memory _to) external isStartTime whenNotPaused isAlive onlyRole(BOT_ROLE) nonReentrant {
        require(IRiskPool(riskPool).currency() == IRewarder(rewarder).currency(), "UnoRe: currency not matched");
        updatePool();
        uint256 _totalPendingUno;
        uint256 _accumulatedAmount;
        for (uint256 i; i < _to.length; i++) {
            require(!userInfo[_to[i]].isNotRollOver, "UnoRe: rollover is not set");

            (uint256 _pendingUno, uint256 _amount) = _updateReward(_to[i]);
            _totalPendingUno += _pendingUno;
            _accumulatedAmount += _amount;
            _enterInPool(_pendingUno, _to[i]);
        }

        if (rewarder != address(0) && _totalPendingUno != 0 && _accumulatedAmount > 0) {
            IRewarder(rewarder).onReward(riskPool, _totalPendingUno, _accumulatedAmount);
        }
        emit RollOverReward(_to, riskPool, _totalPendingUno);
    }

    /**
     * @dev user can cancel its pending withdraw request
     */
    function cancelWithdrawRequest() external nonReentrant whenNotPaused isAlive {
        (uint256 cancelAmount, uint256 cancelAmountInUno) = IRiskPool(riskPool).cancelWithdrawRequest(msg.sender);

        //if user return the pending value into staking again by canceling withdraw,
        //we remove the amount from the pending capital
        ICapitalAgent(capitalAgent).updatePoolWithdrawPendingCapital(address(this), cancelAmount, false);

        emit LogCancelWithdrawRequest(msg.sender, cancelAmount, cancelAmountInUno);
    }

    /**
     * @dev return user staked currency corresponding to current lp price of uno
     */
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

    /**
     * @dev claim policy to payout, can only be called by claim processor role
     */
    function settlePayout(
        uint256 _policyId,
        address _payout,
        uint256 _amount
    ) public whenNotPaused isAlive onlyRole(CLAIM_PROCESSOR_ROLE) roleLockTimePassed(CLAIM_PROCESSOR_ROLE) {
        uint256 realClaimAmount = IRiskPool(riskPool).policyClaim(_payout, _amount);
        ICapitalAgent(capitalAgent).SSIPPolicyCaim(realClaimAmount, uint256(_policyId), true);

        emit InsurancePayoutSettled(_policyId, _payout, _amount);
    }

    function setUserDetails(
        address _user,
        uint256 _amount,
        uint256 _rewardDebt
    ) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        userInfo[_user].amount = _amount;
        userInfo[_user].rewardDebt = _rewardDebt;
        IRiskPool(riskPool).enter(_user, _amount);

        emit LogUserUpdated(address(this), _user, _amount);
    }

    function setLpPriceInRiskPool(uint256 _lpPriceUno) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        IRiskPool(riskPool).setLpPriceUno(_lpPriceUno);
    }

    function setAccUnoPerShare(
        uint256 _accUnoPerShare,
        uint256 _lastRewardBlock
    ) external onlyRole(ADMIN_ROLE) roleLockTimePassed(ADMIN_ROLE) {
        poolInfo.accUnoPerShare = _accUnoPerShare;
        poolInfo.lastRewardBlock = _lastRewardBlock;
    }

    function grantRole(
        bytes32 role,
        address account
    ) public override isAlive whenNotPaused onlyRole(getRoleAdmin(role)) roleLockTimePassed(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    function _revokeRole(
        bytes32 role,
        address account
    ) internal override isAlive whenNotPaused roleLockTimePassed(getRoleAdmin(role)) returns (bool) {
        return super._revokeRole(role, account);
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

    function _updateReward(address _to) internal returns (uint256, uint256) {
        (uint256 pendingAmount,,) = IRiskPool(riskPool).getWithdrawRequest(_to);
        uint256 amount = userInfo[_to].amount - pendingAmount;
        if(amount == 0){
            return (0,0);
        }
        uint256 accumulatedUno = (amount * uint256(poolInfo.accUnoPerShare)) / ACC_UNO_PRECISION;
        uint256 _pendingUno = accumulatedUno - userInfo[_to].rewardDebt;

        // Effects
        userInfo[_to].rewardDebt = accumulatedUno;
        return (_pendingUno, amount);
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
