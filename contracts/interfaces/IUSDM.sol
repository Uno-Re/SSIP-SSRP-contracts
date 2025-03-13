// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUSDM is IERC20 {
    function rewardMultiplier() external view returns (uint256);
}
