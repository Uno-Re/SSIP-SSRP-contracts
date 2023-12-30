
// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

interface IClaimProcessor {
    function requestPolicyId(uint256 _policyId, address _ssip, address _to, uint256 _amount) external;
}