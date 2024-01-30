// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "../Rewarder.sol";
import "../interfaces/IRewarderFactory.sol";

contract RewarderFactory is IRewarderFactory {
    constructor() {}

    /**
     * @dev create new Rewarder Contract
     * @param _operator address of the operator to set or call owner functions
     * @param _currency address of the currency to distribute as a reward to user
     * @param _pool address of the ssip-ssrp pool
     * @return new Rewarder address
     **/
    function newRewarder(address _operator, address _currency, address _pool) external override returns (address) {
        Rewarder _rewarder = new Rewarder(_operator, _currency, _pool);
        address _rewarderAddr = address(_rewarder);

        return _rewarderAddr;
    }
}
