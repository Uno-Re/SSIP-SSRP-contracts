// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface IPayoutRequest {
    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external;
}
