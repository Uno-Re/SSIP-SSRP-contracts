// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.0;

import "../SyntheticSSRP.sol";
import "../interfaces/ISyntheticSSRPFactory.sol";

contract SyntheticSSRPFactory is ISyntheticSSRPFactory {
    constructor() {}

    function newSyntheticSSRP(address _owner, address _lpToken) external override returns (address) {
        SyntheticSSRP _ssip = new SyntheticSSRP(_owner, _lpToken);
        address _ssipAddr = address(_ssip);
        return _ssipAddr;
    }
}
