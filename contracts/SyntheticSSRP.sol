// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/IMigration.sol";
import "./interfaces/IRewarderFactory.sol";
import "./interfaces/ISyntheticSSRP.sol";
import "./interfaces/IRewarder.sol";
import "./libraries/TransferHelper.sol";

contract SyntheticSSRP is ISyntheticSSRP, ReentrancyGuard {
    address public owner;
    address public migrateTo;

    uint256 public LOCK_TIME = 10 days;
    uint256 public constant ACC_REWARD_PRECISION = 1e18;

    address public rewarder;
    address public lpToken;

    uint256 lastRewardBlock;
    uint256 accRewardPerShare;
    uint256 public rewardPerBlock;

    struct UserInfo {
        uint256 lastWithdrawTime;
        uint256 rewardDebt;
        uint256 amount;
        uint256 pendingWithdrawAmount;
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
    event LogCreateRewarder(address indexed _SSRP, address indexed _rewarder, address _currency);

    constructor(address _owner, address _lpToken) {
        require(_owner != address(0), "UnoRe: zero owner address");
        require(_lpToken != address(0), "UnoRe: zero lp token address");
        owner = _owner;
        lpToken = _lpToken;
        rewardPerBlock = 1e18;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "UnoRe: Forbidden");
        _;
    }

    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        require(_rewardPerBlock > 0, "UnoRe: zero value");
        rewardPerBlock = _rewardPerBlock;
    }

    function setMigrateTo(address _migrateTo) external onlyOwner {
        require(_migrateTo != address(0), "UnoRe: zero address");
        migrateTo = _migrateTo;
    }

    function setLockTime(uint256 _lockTime) external onlyOwner {
        require(_lockTime > 0, "UnoRe: not allow zero lock time");
        LOCK_TIME = _lockTime;
    }

    function createRewarder(
        address _operator,
        address _factory,
        address _currency
    ) external onlyOwner nonReentrant {
        require(_factory != address(0), "UnoRe: rewarder factory no exist");
        rewarder = IRewarderFactory(_factory).newRewarder(_operator, _currency, address(this));
        emit LogCreateRewarder(address(this), rewarder, _currency);
    }

    function migrate() external nonReentrant {
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
    }

    function pendingReward(address _to) external view returns (uint256 pending) {
        uint256 currentAccRewardPerShare = accRewardPerShare;
        if (block.number > lastRewardBlock && totalStakedLPAmount != 0) {
            uint256 blocks = block.number - lastRewardBlock;
            uint256 rewardAmount = blocks * rewardPerBlock;
            currentAccRewardPerShare = accRewardPerShare + (rewardAmount * ACC_REWARD_PRECISION) / totalStakedLPAmount;
        }
        uint256 userBalance = userInfo[_to].amount;
        pending = (userBalance * currentAccRewardPerShare) / ACC_REWARD_PRECISION - userInfo[_to].rewardDebt;
    }

    function updatePool() public override {
        if (block.number > lastRewardBlock) {
            if (totalStakedLPAmount > 0) {
                uint256 blocks = block.number - lastRewardBlock;
                uint256 rewardAmount = blocks * rewardPerBlock;
                accRewardPerShare = accRewardPerShare + ((rewardAmount * ACC_REWARD_PRECISION) / totalStakedLPAmount);
            }
            lastRewardBlock = block.number;
            emit LogUpdatePool(lastRewardBlock, totalStakedLPAmount, accRewardPerShare);
        }
    }

    function enterInPool(uint256 _amount) external override nonReentrant {
        require(_amount != 0, "UnoRe: ZERO Value");
        updatePool();
        TransferHelper.safeTransferFrom(lpToken, msg.sender, address(this), _amount);
        userInfo[msg.sender].rewardDebt = userInfo[msg.sender].rewardDebt + (_amount * accRewardPerShare) / ACC_REWARD_PRECISION;
        userInfo[msg.sender].amount = userInfo[msg.sender].amount + _amount;
        totalStakedLPAmount = totalStakedLPAmount + _amount;
        emit LogStakedInPool(msg.sender, address(this), _amount);
    }

    /**
     * @dev WR will be in pending for 10 days at least
     */
    function leaveFromPoolInPending(uint256 _amount) external override nonReentrant {
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
    function leaveFromPending() external override nonReentrant {
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

    function harvest(address _to) external override nonReentrant {
        _harvest(_to);
    }

    function _harvest(address _to) private {
        updatePool();
        uint256 amount = userInfo[_to].amount;
        uint256 accumulatedReward = (amount * accRewardPerShare) / ACC_REWARD_PRECISION;
        uint256 _pendingReward = accumulatedReward - userInfo[_to].rewardDebt;

        // Effects
        userInfo[msg.sender].rewardDebt = accumulatedReward;

        uint256 realRewardAmount = 0;
        if (rewarder != address(0) && _pendingReward > 0) {
            realRewardAmount = IRewarder(rewarder).onReward(_to, _pendingReward);
        }

        emit LogHarvest(msg.sender, _to, realRewardAmount);
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
