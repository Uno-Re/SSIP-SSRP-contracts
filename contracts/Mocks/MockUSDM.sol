// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "../interfaces/IUSDM.sol";

contract MockUSDM is IUSDM {
    string public constant name = "Mock USDM";
    string public constant symbol = "mUSDM";
    uint8 public constant decimals = 18;

    uint256 private _totalShares;
    mapping(address => uint256) private _shares;
    mapping(address => mapping(address => uint256)) private _allowances;

    uint256 private constant _BASE = 1e18;
    uint256 public rewardMultiplier = 1e18;

    // Helper function to track share holders
    mapping(address => bool) private _isShareHolder;
    address[] private _shareHolders;

    function _getShareHolders() private view returns (address[] memory) {
        return _shareHolders;
    }

    function mint(address to, uint256 amount) external {
        uint256 shares = (amount * _BASE) / rewardMultiplier;
        _shares[to] += shares;
        _totalShares += shares;

        // Track new share holder
        if (!_isShareHolder[to]) {
            _isShareHolder[to] = true;
            _shareHolders.push(to);
        }
    }

    function setRewardMultiplier(uint256 newMultiplier) external {
        require(newMultiplier >= _BASE, "Invalid multiplier");

        // Store old multiplier for ratio calculation
        uint256 oldMultiplier = rewardMultiplier;
        rewardMultiplier = newMultiplier;

        // Adjust all shares based on multiplier change
        if (_totalShares != 0) {
            uint256 ratio = (oldMultiplier * _BASE) / newMultiplier;
            _totalShares = (_totalShares * ratio) / _BASE;

            // Update all non-zero share balances
            address[] memory holders = _getShareHolders();
            for (uint256 i = 0; i < holders.length; i++) {
                address holder = holders[i];
                if (_shares[holder] > 0) {
                    _shares[holder] = (_shares[holder] * ratio) / _BASE;
                }
            }
        }
    }

    function balanceOf(address account) external view override returns (uint256) {
        return (_shares[account] * rewardMultiplier) / _BASE;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        uint256 shares = (amount * _BASE) / rewardMultiplier;
        require(_shares[msg.sender] >= shares, "Insufficient balance");
        _shares[msg.sender] -= shares;
        _shares[to] += shares;
        return true;
    }

    // IERC20 Implementation
    function totalSupply() external view override returns (uint256) {
        return (_totalShares * rewardMultiplier) / _BASE;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        require(_allowances[from][msg.sender] >= amount, "USDM: insufficient allowance");
        require(_shares[from] >= (amount * _BASE) / rewardMultiplier, "USDM: transfer amount exceeds balance");

        uint256 shares = (amount * _BASE) / rewardMultiplier;
        _shares[from] -= shares;
        _shares[to] += shares;
        _allowances[from][msg.sender] -= amount;

        return true;
    }
}
