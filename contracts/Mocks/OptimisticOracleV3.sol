// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

/**
 * This smart contract
 */

interface Check {
    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external;
}

contract OptimisticOracleV3 {

    uint a;
    function set() external {
        a = 3;
    }

    function defaultIdentifier() external pure returns(bytes32){
        return bytes32("contract");
    }

    function getMinimumBond(address _c) external pure returns(uint256){
        return 100;
    }

    function assertTruth(bytes memory _a, address b, address c, address n,uint64 d, address e, uint256 f, bytes32 g, bytes32 h) external pure returns(bytes32) {
        return bytes32("a");
    }

    function settle(bytes32 id, address d) external {
        Check(d).assertionResolvedCallback(id, true);
    }
     function disputeAssertion(bytes32 assertionId, address disputer) external pure returns(uint){
        return 4;
     }
     function assertions(bytes32) external pure returns(uint){
        return 10;
     }
}
