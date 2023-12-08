// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "../SyntheticSSRP.sol";
import "../interfaces/ISyntheticSSRPFactory.sol";

contract SyntheticSSRPFactory is ISyntheticSSRPFactory {
    constructor() {}

    function newSyntheticSSRP(address _multiSigWallet, address _lpToken) external override returns (address) {
        SyntheticSSRP _ssip = new SyntheticSSRP(_lpToken, _multiSigWallet);
        address _ssipAddr = address(_ssip);
        return _ssipAddr;
    }
}
