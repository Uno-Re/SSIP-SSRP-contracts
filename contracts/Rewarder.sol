// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IRewarder.sol";
import "./libraries/TransferHelper.sol";

interface ISSIP {
    struct PoolInfo {
        uint256 lastRewardBlock;
        uint256 accUnoPerShare;
        uint256 unoMultiplierPerBlock;
    }

    struct UserInfo {
        uint256 lastWithdrawTime;
        uint256 rewardDebt;
        uint256 amount;
    }

    function poolInfo() external view returns (PoolInfo memory);

    function userInfo(address _user) external view returns (UserInfo memory);

    function riskPool() external view returns (address);
}

contract Rewarder is IRewarder, ReentrancyGuard, Pausable {
    using Address for address;

    uint256 public constant ACC_UNO_PRECISION = 1e18;

    address public immutable override currency;
    address public immutable pool;
    address public operator;

    event LogRewarderWithdraw(address indexed _rewarder, address _currency, address indexed _to, uint256 _amount);
    event LogTransferOwnerShip(address indexed _rewarder, address indexed _oldOperator, address indexed _newOperator);

    constructor(address _operator, address _currency, address _pool) {
        require(_operator != address(0), "UnoRe: zero operator address");
        require(_pool != address(0), "UnoRe: zero pool address");
        currency = _currency;
        pool = _pool;
        operator = _operator;
    }

    receive() external payable {}

    function pausePool() external onlyOperator {
        _pause();
    }

    function unpausePool() external onlyOperator {
        _unpause();
    }

    /**
     * @dev distribute reward to `_to` address, can only be call by pool,
     * @param _to address of user
     * @param _amount amount of reward to distribute
     */
    function onReward(
        address _to,
        uint256 _amount,
        uint256 _accumulatedAmount
    ) external payable override onlyPOOL whenNotPaused returns (uint256) {
        ISSIP ssip = ISSIP(pool);
        ISSIP.PoolInfo memory poolInfos = ssip.poolInfo();
        uint256 accumulatedUno = (_accumulatedAmount * uint256(poolInfos.accUnoPerShare)) / ACC_UNO_PRECISION;

        require(accumulatedUno > _amount, "UnoRe: invalid reward amount");

        if (currency == address(0)) {
            require(address(this).balance >= _amount, "UnoRe: insufficient reward balance");
            TransferHelper.safeTransferETH(_to, _amount);
            return _amount;
        } else {
            require(IERC20(currency).balanceOf(address(this)) >= _amount, "UnoRe: insufficient reward balance");
            TransferHelper.safeTransfer(currency, _to, _amount);
            return _amount;
        }
    }

    /**
     * @dev withdraw currency from Rewarder contract, can only be call by operator,
     * @param _to address where amount will be transferred
     * @param _amount amount to transfer
     */
    function withdraw(address _to, uint256 _amount) external onlyOperator whenNotPaused {
        require(_to != address(0), "UnoRe: zero address reward");
        if (currency == address(0)) {
            if (address(this).balance >= _amount) {
                TransferHelper.safeTransferETH(_to, _amount);
                emit LogRewarderWithdraw(address(this), currency, _to, _amount);
            } else {
                if (address(this).balance > 0) {
                    uint256 rewardAmount = address(this).balance;
                    TransferHelper.safeTransferETH(_to, address(this).balance);
                    emit LogRewarderWithdraw(address(this), currency, _to, rewardAmount);
                }
            }
        } else {
            if (IERC20(currency).balanceOf(address(this)) >= _amount) {
                TransferHelper.safeTransfer(currency, _to, _amount);
                emit LogRewarderWithdraw(address(this), currency, _to, _amount);
            } else {
                if (IERC20(currency).balanceOf(address(this)) > 0) {
                    uint256 rewardAmount = IERC20(currency).balanceOf(address(this));
                    TransferHelper.safeTransfer(currency, _to, IERC20(currency).balanceOf(address(this)));
                    emit LogRewarderWithdraw(address(this), currency, _to, rewardAmount);
                }
            }
        }
    }

    function transferOwnership(address _to) external onlyOperator whenNotPaused {
        require(_to != address(0), "UnoRe: zero address reward");
        address oldOperator = operator;
        operator = _to;
        emit LogTransferOwnerShip(address(this), oldOperator, _to);
    }

    modifier onlyPOOL() {
        require(msg.sender == pool, "Only SSRP or SSIP contract can call this function.");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator call this function.");
        _;
    }
}
