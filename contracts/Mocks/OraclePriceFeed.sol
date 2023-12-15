// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "../interfaces/IOraclePriceFeed.sol";

/**
 * This smart contract
 */

contract OraclePriceFeed is IOraclePriceFeed {

    function getEthUsdPrice() external pure returns (uint256) {
        return 1;
    }

    function getAssetEthPrice(address) external pure returns (uint256) {
        return 1;
    }

    function consult(address, address, uint256 amountIn) external pure returns (uint256) {
        return amountIn;
    }

}
