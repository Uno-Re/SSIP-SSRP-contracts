
// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

interface IEscalationManager {
    struct AssertionApproval {
        bool exist;
        bool approved;
        bool settled;
    }

    function isAssertionIdApproved(bytes32 _assertionId) external returns(AssertionApproval memory);
}