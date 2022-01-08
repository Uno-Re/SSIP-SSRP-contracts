// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "../interfaces/IStrategy.sol";
// import "./Operators.sol";

contract VaultChef is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 shares; // How many LP tokens the user has provided.
    }

    struct PoolInfo {
        IERC20 strategyToken; // Address of the want token.
        address strat; // Strategy address that will auto compound want tokens
    }

    PoolInfo[] public poolInfo; // Info of each pool.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo; // Info of each user that stakes LP tokens. pool => user => shares
    mapping(address => bool) private strats;

    event AddPool(address indexed strat, uint256 indexed pid);
    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event ResetAllowance(address indexed user);
    event ResetSingleAllowance(address indexed user, uint256 indexed pid);

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    /**
     * @dev Add a new want to the pool. Can only be called by the owner.
     */
    function addPool(address _strat) external onlyOwner nonReentrant {
        require(!strats[_strat], "Existing strategy");

        poolInfo.push(PoolInfo({strategyToken: IERC20(IStrategy(_strat).strategyToken()), strat: _strat}));
        strats[_strat] = true;
        resetSingleAllowance(poolInfo.length - 1);
        emit AddPool(_strat, poolInfo.length - 1);
    }

    // View function to see staked Want tokens on frontend.
    function stakedStrategyTokens(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];

        uint256 sharesTotal = IStrategy(pool.strat).sharesTotal();
        uint256 wantLockedTotal = IStrategy(pool.strat).wantLockedTotal();
        if (sharesTotal == 0) {
            return 0;
        }
        return (user.shares * wantLockedTotal) / sharesTotal;
    }

    // Want tokens moved from user -> this -> Strat (compounding)
    function deposit(uint256 _pid, uint256 _wantAmt) external nonReentrant {
        _deposit(_pid, _wantAmt, msg.sender);
    }

    // For unique contract calls
    // function depositTo(
    //     uint256 _pid,
    //     uint256 _wantAmt,
    //     address _to
    // ) external nonReentrant onlyOperator {
    //     _deposit(_pid, _wantAmt, _to);
    // }

    function _deposit(
        uint256 _pid,
        uint256 _wantAmt,
        address _to
    ) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_to];

        if (_wantAmt > 0) {
            IERC20 _strategyToken = pool.strategyToken;

            uint256 balanceBefore = _strategyToken.balanceOf(address(this));
            _strategyToken.safeTransferFrom(msg.sender, address(this), _wantAmt);
            _wantAmt = _strategyToken.balanceOf(address(this)) - balanceBefore;
            require(_wantAmt > 0, "We only accept amount > 0");

            uint256 sharesAdded = IStrategy(pool.strat).deposit(_wantAmt);
            user.shares = user.shares + sharesAdded;
        }
        emit Deposit(_to, _pid, _wantAmt);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _wantAmt) external nonReentrant {
        _withdraw(_pid, _wantAmt, msg.sender);
    }

    // For unique contract calls
    // function withdrawTo(
    //     uint256 _pid,
    //     uint256 _wantAmt,
    //     address _to
    // ) external nonReentrant onlyOperator {
    //     _withdraw(_pid, _wantAmt, _to);
    // }

    function _withdraw(
        uint256 _pid,
        uint256 _wantAmt,
        address _to
    ) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        uint256 wantLockedTotal = IStrategy(pool.strat).wantLockedTotal();
        uint256 sharesTotal = IStrategy(pool.strat).sharesTotal();

        require(user.shares > 0, "user.shares is 0");
        require(sharesTotal > 0, "sharesTotal is 0");

        // Withdraw want tokens
        uint256 amount = (user.shares * wantLockedTotal) / sharesTotal;
        if (_wantAmt > amount) {
            _wantAmt = amount;
        }
        if (_wantAmt > 0) {
            uint256 sharesRemoved = IStrategy(pool.strat).withdraw(_wantAmt);

            if (sharesRemoved > user.shares) {
                user.shares = 0;
            } else {
                user.shares = user.shares - sharesRemoved;
            }

            uint256 wantBal = IERC20(pool.strategyToken).balanceOf(address(this));
            if (wantBal < _wantAmt) {
                _wantAmt = wantBal;
            }
            pool.strategyToken.safeTransfer(_to, _wantAmt);
        }
        emit Withdraw(msg.sender, _pid, _wantAmt);
    }

    // Withdraw everything from pool for yourself
    function withdrawAll(uint256 _pid) external nonReentrant {
        _withdraw(_pid, type(uint256).max, msg.sender);
    }

    function resetAllowances() external onlyOwner {
        for (uint256 i = 0; i < poolInfo.length; i++) {
            PoolInfo storage pool = poolInfo[i];
            pool.strategyToken.safeApprove(pool.strat, uint256(0));
            pool.strategyToken.safeIncreaseAllowance(pool.strat, type(uint256).max);
        }

        emit ResetAllowance(owner());
    }

    function resetSingleAllowance(uint256 _pid) public onlyOwner {
        PoolInfo storage pool = poolInfo[_pid];
        pool.strategyToken.safeApprove(pool.strat, uint256(0));
        pool.strategyToken.safeIncreaseAllowance(pool.strat, type(uint256).max);

        emit ResetSingleAllowance(owner(), _pid);
    }
}
