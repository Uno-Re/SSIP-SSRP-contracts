// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IMigration.sol";
import "./interfaces/IRewarderFactory.sol";
import "./interfaces/ISyntheticSSIP.sol";
import "./interfaces/IRewarder.sol";
import "./libraries/TransferHelper.sol";

contract SyntheticSSIP is ISyntheticSSIP, ReentrancyGuard, AccessControl, Pausable {

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");

    address public migrateTo;

    uint256 public LOCK_TIME = 10 days;
    uint256 public constant ACC_REWARD_PRECISION = 1e18;

    address public rewarder;
    address public lpToken;

    uint256 lastRewardBlock;
    uint256 accRewardPerShare;
    uint256 public rewardPerBlock;
    bool public killed;

    struct UserInfo {
        uint256 lastWithdrawTime;
        uint256 rewardDebt;
        uint256 amount;
        uint256 pendingWithdrawAmount;
        bool isNotRollOver;
    }

    mapping(address => UserInfo) public userInfo;

    uint256 public totalStakedLPAmount;
    uint256 public totalWithdrawPending;

    event LogStakedInPool(address indexed _staker, address indexed _pool, uint256 _amount);
    event LogLeftPool(address indexed _staker, address indexed _pool, uint256 _requestAmount);
    event LogLeaveFromPending(address indexed _user, address indexed _pool, uint256 _withdrawAmount);
    event LogUpdatePool(uint256 _lastRewardBlock, uint256 _lpSupply, uint256 _accRewardPerShare);
    event LogHarvest(address indexed _user, address indexed _receiver, uint256 _amount);
    event LogCancelWithdrawRequest(address indexed _user, address indexed _pool, uint256 _cancelAmount);
    event LogCreateRewarder(address indexed _SSIP, address indexed _rewarder, address _currency);
    event LogSetRewardPerBlock(address indexed _pool, uint256 _rewardPerBlock);
    event LogSetMigrateTo(address indexed _pool, address indexed _migrateTo);
    event LogSetLockTime(address indexed _pool, uint256 _lockTime);
    event LogMigrate(address indexed _user, address indexed _pool, address indexed _migrateTo, uint256 amount);
    event PoolAlived(address indexed _owner, bool _alive);
    event RollOverReward(address indexed _pool, address[] _staker, uint256 _amount);

    constructor(address _lpToken, address _multiSigWallet) {
        require(_multiSigWallet != address(0), "UnoRe: zero multiSigWallet address");
        require(_lpToken != address(0), "UnoRe: zero lp token address");
        lpToken = _lpToken;
        rewardPerBlock = 1e18;
        _grantRole(ADMIN_ROLE, _multiSigWallet);
        _setRoleAdmin(BOT_ROLE, ADMIN_ROLE);
    }

    modifier isAlive() {
        require(!killed, "UnoRe: pool is killed");
        _;
    }

    function pausePool() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function UnpausePool() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function killPool() external onlyRole(ADMIN_ROLE) {
        killed = true;
        emit PoolAlived(msg.sender, true);
    }

    function revivePool() external onlyRole(ADMIN_ROLE) {
        killed = false;
        emit PoolAlived(msg.sender, false);
    }

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyRole(ADMIN_ROLE) {
        require(_rewardPerBlock > 0, "UnoRe: zero value");
        rewardPerBlock = _rewardPerBlock;
        emit LogSetRewardPerBlock(address(this), _rewardPerBlock);
    }

    function setMigrateTo(address _migrateTo) external onlyRole(ADMIN_ROLE) {
        require(_migrateTo != address(0), "UnoRe: zero address");
        migrateTo = _migrateTo;
        emit LogSetMigrateTo(address(this), _migrateTo);
    }

    function setLockTime(uint256 _lockTime) external onlyRole(ADMIN_ROLE) {
        require(_lockTime > 0, "UnoRe: not allow zero lock time");
        LOCK_TIME = _lockTime;
        emit LogSetLockTime(address(this), _lockTime);
    }

    function createRewarder(address _operator, address _factory, address _currency) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_factory != address(0), "UnoRe: rewarder factory no exist");
        require(_operator != address(0), "UnoRe: zero operator address");
        require(_currency != address(0), "UnoRe: zero currency address");
        rewarder = IRewarderFactory(_factory).newRewarder(_operator, _currency, address(this));
        emit LogCreateRewarder(address(this), rewarder, _currency);
    }

    function migrate() external isAlive nonReentrant {
        require(migrateTo != address(0), "UnoRe: zero address");
        _harvest(msg.sender);
        if (
            userInfo[msg.sender].pendingWithdrawAmount > 0 && block.timestamp - userInfo[msg.sender].lastWithdrawTime >= LOCK_TIME
        ) {
            _leaveFromPending();
        } else {
            _cancelWithdrawRequest();
        }
        uint256 amount = userInfo[msg.sender].amount;
        TransferHelper.safeTransfer(lpToken, migrateTo, amount);
        IMigration(migrateTo).onMigration(msg.sender, amount, "");
        userInfo[msg.sender].amount = 0;
        emit LogMigrate(msg.sender, address(this), migrateTo, amount);
    }

    function pendingReward(address _to) external view returns (uint256 pending) {
        uint256 currentAccRewardPerShare = accRewardPerShare;
        if (block.number > lastRewardBlock && totalStakedLPAmount != 0) {
            uint256 blocks = block.number - lastRewardBlock;
            uint256 rewards = blocks * rewardPerBlock;
            currentAccRewardPerShare = accRewardPerShare + (rewards * ACC_REWARD_PRECISION) / totalStakedLPAmount;
        }
        uint256 userBalance = userInfo[_to].amount;
        pending = (userBalance * currentAccRewardPerShare) / ACC_REWARD_PRECISION - userInfo[_to].rewardDebt;
    }

    function updatePool() public override {
        if (block.number > lastRewardBlock) {
            if (totalStakedLPAmount > 0) {
                uint256 blocks = block.number - lastRewardBlock;
                uint256 rewards = blocks * rewardPerBlock;
                accRewardPerShare = accRewardPerShare + ((rewards * ACC_REWARD_PRECISION) / totalStakedLPAmount);
            }
            lastRewardBlock = block.number;
            emit LogUpdatePool(lastRewardBlock, totalStakedLPAmount, accRewardPerShare);
        }
    }

    function enterInPool(uint256 _amount) external override isAlive nonReentrant {
        TransferHelper.safeTransferFrom(lpToken, msg.sender, address(this), _amount);
        _enterInPool(_amount, msg.sender);
        emit LogStakedInPool(msg.sender, address(this), _amount);
    }

    function toggleRollOver() external {
        userInfo[msg.sender].isNotRollOver = !userInfo[msg.sender].isNotRollOver;
    }

    function rollOverReward(address[] memory _to) external isAlive onlyRole(BOT_ROLE) nonReentrant {
        require(lpToken == IRewarder(rewarder).currency(), "UnoRe: currency not matched");

        updatePool();
        uint256 _totalPendingUno;
        for (uint256 i; i < _to.length; i++) {
            require(!userInfo[_to[i]].isNotRollOver, "UnoRe: rollover is not set");

            uint256 _pendingReward = _updateReward(_to[i]);
            _totalPendingUno += _pendingReward;

            _enterInPool(_pendingReward, _to[i]);

        }
        
        if (rewarder != address(0) && _totalPendingUno > 0) {
            IRewarder(rewarder).onReward(address(this), _totalPendingUno);
        }
        emit RollOverReward(address(this), _to, _totalPendingUno);
    }

    /**
     * @dev WR will be in pending for 10 days at least
     */
    function leaveFromPoolInPending(uint256 _amount) external override whenNotPaused nonReentrant {
        // Withdraw desired amount from pool
        _harvest(msg.sender);
        uint256 amount = userInfo[msg.sender].amount;
        uint256 pendingWR = userInfo[msg.sender].pendingWithdrawAmount;
        require(amount - pendingWR >= _amount, "UnoRe: withdraw amount overflow");
        userInfo[msg.sender].pendingWithdrawAmount = userInfo[msg.sender].pendingWithdrawAmount + _amount;
        userInfo[msg.sender].lastWithdrawTime = block.timestamp;

        totalWithdrawPending = totalWithdrawPending + _amount;

        emit LogLeftPool(msg.sender, address(this), _amount);
    }

    /**
     * @dev user can submit claim again and receive his funds into his wallet after 10 days since last WR.
     */
    function leaveFromPending() external override whenNotPaused nonReentrant {
        require(block.timestamp - userInfo[msg.sender].lastWithdrawTime >= LOCK_TIME, "UnoRe: Locked time");
        _harvest(msg.sender);
        _leaveFromPending();
    }

    function _leaveFromPending() private {
        uint256 amount = userInfo[msg.sender].amount;
        uint256 pendingWR = userInfo[msg.sender].pendingWithdrawAmount;
        uint256 accumulatedReward = (amount * accRewardPerShare) / ACC_REWARD_PRECISION;

        TransferHelper.safeTransfer(lpToken, msg.sender, pendingWR);

        userInfo[msg.sender].rewardDebt = accumulatedReward - ((pendingWR * accRewardPerShare) / ACC_REWARD_PRECISION);
        userInfo[msg.sender].amount = amount - pendingWR;
        userInfo[msg.sender].pendingWithdrawAmount = 0;
        totalWithdrawPending = totalWithdrawPending - pendingWR;
        totalStakedLPAmount = totalStakedLPAmount - pendingWR;
        emit LogLeaveFromPending(msg.sender, address(this), pendingWR);
    }

    function harvest(address _to) external override whenNotPaused isAlive nonReentrant {
        _harvest(_to);
    }

    function _harvest(address _to) private {
        updatePool();

        uint256 _pendingReward = _updateReward(_to);

        if (rewarder != address(0) && _pendingReward > 0) {
            IRewarder(rewarder).onReward(_to, _pendingReward);
        }

        emit LogHarvest(msg.sender, _to, _pendingReward);
    }

    function _updateReward(address _to) internal returns(uint256) {
        uint256 amount = userInfo[_to].amount;
        uint256 accumulatedReward = (amount * accRewardPerShare) / ACC_REWARD_PRECISION;
        uint256 _pendingReward = accumulatedReward - userInfo[_to].rewardDebt;

        // Effects
        userInfo[_to].rewardDebt = accumulatedReward;
        return _pendingReward;
    }

    function _enterInPool(uint256 _amount, address _to) internal {
        require(_amount != 0, "UnoRe: ZERO Value");
        updatePool();
        userInfo[_to].rewardDebt = userInfo[_to].rewardDebt + (_amount * accRewardPerShare) / ACC_REWARD_PRECISION;
        userInfo[_to].amount = userInfo[_to].amount + _amount;
        totalStakedLPAmount = totalStakedLPAmount + _amount;
    }

    function cancelWithdrawRequest() external nonReentrant {
        _cancelWithdrawRequest();
    }

    function _cancelWithdrawRequest() private {
        uint256 pendingWR = userInfo[msg.sender].pendingWithdrawAmount;
        userInfo[msg.sender].pendingWithdrawAmount = 0;
        totalWithdrawPending = totalWithdrawPending - pendingWR;
        emit LogCancelWithdrawRequest(msg.sender, address(this), pendingWR);
    }
}
