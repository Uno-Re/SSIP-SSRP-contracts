// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AggregatorV3Interface} from "../interfaces/IAggregatorV3.sol";

contract MockChainlinkAggregator is AggregatorV3Interface {
    int256 private price;
    uint8 private decimals_;

    constructor(int256 _initialPrice, uint8 _decimals) {
        price = _initialPrice;
        decimals_ = _decimals;
    }

    function decimals() external view override returns (uint8) {
        return decimals_;
    }

    function description() external pure override returns (string memory) {
        return "Mock Chainlink Aggregator";
    }

    function version() external pure override returns (uint256) {
        return 1;
    }

    function getRoundData(uint80 _roundId)
        external
        pure
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, 0, 0, 0, 0);
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (0, price, 0, block.timestamp, 0);
    }

    // Function to update the price (for testing purposes)
    function updatePrice(int256 _newPrice) external {
        price = _newPrice;
    }
}