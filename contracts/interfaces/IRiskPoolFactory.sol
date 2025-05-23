// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface IRiskPoolFactory {
    function newRiskPool(
        string calldata _name,
        string calldata _symbol,
        address _pool,
        address _currency
    ) external returns (address);

    function newRiskPoolUSDM(
        string calldata _name,
        string calldata _symbol,
        address _cohort,
        address _currency
    ) external returns (address);
}
