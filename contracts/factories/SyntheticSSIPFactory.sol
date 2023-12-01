// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "../SyntheticSSIP.sol";
import "../interfaces/ISyntheticSSIPFactory.sol";

contract SyntheticSSIPFactory is ISyntheticSSIPFactory {
    constructor() {}

    function newSyntheticSSIP(address _multiSigWallet, address _lpToken) external override returns (address) {
        SyntheticSSIP _ssip = new SyntheticSSIP(_lpToken, _multiSigWallet);
        address _ssipAddr = address(_ssip);
        return _ssipAddr;
    }
}
