// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "../RiskPool.sol";
import "../interfaces/IRiskPoolFactory.sol";

contract RiskPoolFactory is IRiskPoolFactory {
    constructor() {}

    /**
     * @dev create new RiskPool Contract
     * @param _name name of the risk pool
     * @param _symbol symbol of the risk pool
     * @param _cohort address of the ssip-ssrp pool
     * @param _currency address of the currency to distribute as a reward to user
     * @return new RiskPool address
     **/
    function newRiskPool(
        string calldata _name,
        string calldata _symbol,
        address _cohort,
        address _currency
    ) external override returns (address) {
        RiskPool _riskPool = new RiskPool(_name, _symbol, _cohort, _currency);
        address _riskPoolAddr = address(_riskPool);

        return _riskPoolAddr;
    }
}
