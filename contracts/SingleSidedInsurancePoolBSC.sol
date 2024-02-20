// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "./SingleSidedInsurancePool.sol";

contract SingleSidedInsurancePoolBSC is SingleSidedInsurancePool {

    event LogUserUpdated(address indexed pool, address indexed user, uint256 amount);

    function setUserDetails(address _user, uint256 _amount, uint256 _rewardDebt) external {
        userInfo[_user].amount = _amount;
        userInfo[_user].rewardDebt = _rewardDebt;

        emit LogUserUpdated(address(this), _user, _amount);
    }
}