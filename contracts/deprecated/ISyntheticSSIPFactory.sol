// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface ISyntheticSSIPFactory {
    function newSyntheticSSIP(address _multiSigWallet, address _lpToken) external returns (address);
}
