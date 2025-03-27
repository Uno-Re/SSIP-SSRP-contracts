// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface IOraclePriceFeed {
    function getEthUsdPrice() external view returns (uint256);

    function getAssetEthPrice(address _asset) external view returns (uint256);

    function consult(address tokenA, address tokenB, uint256 amountIn) external view returns (uint256);

    function setAssetEthPrice(address _asset, uint256 _price) external;
}
