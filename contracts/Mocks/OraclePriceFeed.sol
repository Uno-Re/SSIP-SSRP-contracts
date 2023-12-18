// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "../interfaces/IOraclePriceFeed.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * This smart contract
 */

contract MockOraclePriceFeed is IOraclePriceFeed, Ownable {

    uint256 public ethUsdtPrice;
    address public usdt;

    mapping (address => uint256) public assetEthPrice;

    constructor(address uno, address _usdt) Ownable(msg.sender) {
        usdt = _usdt;
        ethUsdtPrice = 459347726228755;
        assetEthPrice[uno] = 18934772622875;
        assetEthPrice[usdt] = 459347726228755;
    }

    function getEthUsdPrice() external view returns (uint256) {
        return ethUsdtPrice;
    }

    function getAssetEthPrice(address _currency) external view returns (uint256) {
        return assetEthPrice[_currency];
    }

    function consult(address token0, address token1, uint256 amount1) external view returns (uint256) {
        uint256 ethprice1 = assetEthPrice[token0];
        uint256 ethprice2 = assetEthPrice[token1];

        return (ethprice1 * amount1) / (ethprice2);
        // return 
    }

    function setEthUsdPrice(uint256 _amount) external onlyOwner {
        ethUsdtPrice = _amount;
    }

    function setAssetEthPrice(address _asset, uint256 _amount) external onlyOwner {
        assetEthPrice[_asset] = _amount;
    }
}
