// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface ISyntheticSSRP {
    function updatePool() external;

    function enterInPool(uint256 _amount) external;

    function leaveFromPoolInPending(uint256 _amount) external;

    function leaveFromPending() external;

    function harvest(address _to) external;
}
