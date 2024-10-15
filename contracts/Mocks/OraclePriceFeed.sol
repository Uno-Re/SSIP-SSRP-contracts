// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {AggregatorV3Interface} from "../interfaces/IAggregatorV3.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract PriceOracle is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private _stableCoins;
    /**
     * @dev please take care token decimal
     * e.x ethPrice[uno_address] = 123456 means 1 UNO = 123456 / (10 ** 18 eth)
     */
    mapping(address => uint256) ethPrices;
    address private ethUSDAggregator = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;

    event AssetPriceUpdated(address _asset, uint256 _price, uint256 timestamp);
    event SetETHUSDAggregator(address _oldAggregator, address _newAggregator);

    constructor(address _admin) Ownable(_admin) {}

    function stableCoins() external view returns (address[] memory) {
        return _stableCoins.values();
    }

    function addStableCoin(address _token) external onlyOwner {
        _stableCoins.add(_token);
    }

    function removeStableCoin(address _token) external onlyOwner {
        _stableCoins.remove(_token);
    }

    function getEthUsdPrice() external view returns (uint256) {
        return _fetchEthUsdPrice();
    }

    function _fetchEthUsdPrice() private view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(ethUSDAggregator);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        return uint256(price) / 1e8;
    }

    function getAssetEthPrice(address _asset) external view returns (uint256) {
        return _stableCoins.contains(_asset) ? (10 ** 18) / _fetchEthUsdPrice() : ethPrices[_asset];
    }

    function setAssetEthPrice(address _asset, uint256 _price) external onlyOwner {
        ethPrices[_asset] = _price;
        emit AssetPriceUpdated(_asset, _price, block.timestamp);
    }

    function setETHUSDAggregator(address _aggregator) external onlyOwner {
        address oldAggregator = ethUSDAggregator;
        ethUSDAggregator = _aggregator;
        emit SetETHUSDAggregator(oldAggregator, _aggregator);
    }

    /**
     * returns the tokenB amount for tokenA
     */
    function consult(address tokenA, address tokenB, uint256 amountA) external view returns (uint256) {
        if (_stableCoins.contains(tokenA) && _stableCoins.contains(tokenB)) {
            return amountA;
        }

        uint256 ethPriceA = _stableCoins.contains(tokenA) ? 1e18 / _fetchEthUsdPrice() : ethPrices[tokenA];

        uint256 ethPriceB = _stableCoins.contains(tokenB) ? 1e18 / _fetchEthUsdPrice() : ethPrices[tokenB];

        require(ethPriceA != 0 && ethPriceB != 0, "PO: Prices of both tokens should be set");

        return
            (amountA * ethPriceA * (10 ** IERC20Metadata(tokenB).decimals())) /
            (10 ** IERC20Metadata(tokenA).decimals() * ethPriceB);
    }
}
