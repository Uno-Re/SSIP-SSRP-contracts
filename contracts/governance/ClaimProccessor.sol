// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";

contract ClaimProccessor is AccessControl {

    bytes32 public constant GUARDIAN_COUNCIL_ROLE = keccak256("GUARDIAN_COUNCIL_ROLE");
    bytes32 public constant SSIP_ROLE = keccak256("SSIP_ROLE");

    struct Policy {
        bool approved;
        bool exist;
    }

    mapping (uint256 => Policy) polices;

    event PolicyRequested(address indexed _ssip, uint256 indexed _policyId);
    event PolicyApproved(uint256 indexed _policyId);
    event PolicyClaimed(uint256 indexed _policyId, address indexed _ssip);

    constructor(address _governance) {
        _grantRole(GUARDIAN_COUNCIL_ROLE, _governance);
        _setRoleAdmin(SSIP_ROLE, GUARDIAN_COUNCIL_ROLE);
    }
    
    function requestPolicyId(uint256 _policyId) external onlyRole(SSIP_ROLE) {
        require(!polices[_policyId].exist, "UnoRe: policy already exist");
        polices[_policyId].exist = true;
        emit PolicyRequested(msg.sender, _policyId);
    }

    function approvePolicy(uint256 _policyId) external onlyRole(GUARDIAN_COUNCIL_ROLE) {
        require(polices[_policyId].exist, "UnoRe: policy not exist");
        polices[_policyId].approved = true;
        emit PolicyApproved(_policyId);
    }

    function claimPolicy(uint256 _policyId, address _ssip) external {
        Policy memory _policy = polices[_policyId];
        require(_policy.approved, "UnoRe: not approved or already settled");
        delete polices[_policyId];
        ISingleSidedInsurancePool(_ssip).settlePayout(_policyId, bytes32(0));
        
        emit PolicyClaimed(_policyId, _ssip);
    }
}
