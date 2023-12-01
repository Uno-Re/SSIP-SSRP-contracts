// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

interface IRewarder {
    function currency() external view returns (address);

    function onReward(address to, uint256 unoAmount) external payable returns (uint256);
}
