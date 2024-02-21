// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface IPayoutRequest {
    struct Policy {
        uint256 insuranceAmount;
        address payoutAddress;
        bool settled;
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external;
    function policies(uint256 _policyId) external view returns(Policy memory);
    function assertedPolicies(bytes32 _assertionId) external view returns(uint256);
    function ssip() external view returns(address);
}
