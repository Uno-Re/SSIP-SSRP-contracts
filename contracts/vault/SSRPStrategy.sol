// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * This strategy is for the single asset in SSRP
 */

import "../interfaces/ISingleSidedReinsurancePool.sol";
import "../interfaces/IRiskPool.sol";
import "./BaseStrategy.sol";

contract SSRPStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    address public SSRPAddress;

    constructor(
        address[] memory _initialWalletPath,
        address _vaultChefAddress,
        address _SSRPAddress,
        address _strategyToken, // the token which we want to put in pool
        address _earnedAddress,
        address[] memory _earnedToWmaticPath
    ) {
        require(_initialWalletPath.length == 3, "Parameter _initialWalletPath length shoud be 3");
        require(
            _initialWalletPath[0] != address(0) && _initialWalletPath[1] != address(0) && _initialWalletPath[2] != address(0),
            "Any of _initialWalletPath should not be ZERO"
        );
        require(
            _strategyToken != address(0) && _earnedAddress != address(0),
            "Want token or earned token should not be ZERO address"
        );
        require(_strategyToken != _earnedAddress, "Want token should not be equal to earned token");
        govAddress = msg.sender;
        dcauAddress = _initialWalletPath[0];
        withdrawFeeAddress = _initialWalletPath[1];
        feeAddress = _initialWalletPath[2];
        vaultChefAddress = _vaultChefAddress;
        SSRPAddress = _SSRPAddress;

        strategyToken = _strategyToken;

        earnedAddress = _earnedAddress;

        earnedToWmaticPath = _earnedToWmaticPath;

        transferOwnership(vaultChefAddress);
        _resetAllowances();
    }

    function earn() external override nonReentrant whenNotPaused onlyGov {
        // Harvest farm tokens
        _vaultHarvest();

        // Converts farm tokens into want tokens
        uint256 earnedAmt = IERC20(earnedAddress).balanceOf(address(this));

        if (earnedAmt > 0) {
            earnedAmt = distributeFees(earnedAmt);
            earnedAmt = buyBack(earnedAmt);

            lastEarnBlock = block.number;
            _farm();
        }
    }

    function _vaultDeposit(uint256 _amount) internal override {
        ISingleSidedReinsurancePool(SSRPAddress).enterInPool(_amount);
    }

    function _vaultWithdraw(uint256 _amount) internal override {
        ISingleSidedReinsurancePool(SSRPAddress).leaveFromPoolInPending(_amount);
    }

    function _vaultWithdrawAllPending() internal override {
        ISingleSidedReinsurancePool(SSRPAddress).leaveFromPending();
    }

    function _vaultHarvest() internal {
        ISingleSidedReinsurancePool(SSRPAddress).harvest(address(this));
    }

    function totalInUnderlying() public view override returns (uint256) {
        (, ,uint256 amount) = ISingleSidedReinsurancePool(SSRPAddress).userInfo(address(this));
        address riskPool = ISingleSidedReinsurancePool(SSRPAddress).riskPool();
        uint256 lpPrice = IRiskPool(riskPool).lpPriceUno();
        return (amount* lpPrice) / 1e18;
    }

    function wantLockedTotal() public view override returns (uint256) {
        return IERC20(strategyToken).balanceOf(address(this)) + totalInUnderlying();
    }

    function _resetAllowances() internal override {
        IERC20(strategyToken).safeApprove(SSRPAddress, uint256(0));
        IERC20(strategyToken).safeIncreaseAllowance(SSRPAddress, type(uint256).max);
    }

    function _revokeAllowances() internal override {
        IERC20(strategyToken).safeApprove(SSRPAddress, uint256(0));
    }
}
