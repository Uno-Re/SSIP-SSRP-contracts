// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.0;

import "../interfaces/ISingleSidedInsurancePool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardAttack {
    constructor() {}

    function attackHarvest(address _pool, address _to) external {
        ISingleSidedInsurancePool ssip = ISingleSidedInsurancePool(_pool);
        for (uint256 ii = 0; ii < 5; ii++) {
            ssip.harvest(msg.sender);
        }
    }

    function enterInPool(
        address _pool,
        uint256 _amount,
        address _currency
    ) external {
        IERC20(_currency).approve(_pool, _amount);
        ISingleSidedInsurancePool ssip = ISingleSidedInsurancePool(_pool);
        ssip.enterInPool(_amount);
    }
}
