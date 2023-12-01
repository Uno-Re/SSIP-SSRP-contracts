// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface ITwapOraclePriceFeed {
    function update() external;

    function consult(address token, uint256 amountIn) external view returns (uint256 amountOut);
}
