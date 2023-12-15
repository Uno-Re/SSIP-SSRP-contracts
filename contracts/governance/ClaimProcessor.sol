// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";

contract ClaimProcessor is AccessControl {

    bytes32 public constant GUARDIAN_COUNCIL_ROLE = keccak256("GUARDIAN_COUNCIL_ROLE");
    bytes32 public constant SSIP_ROLE = keccak256("SSIP_ROLE");

    struct Claim {
        bool approved;
        bool settled;
        address ssip;
        uint256 policyId;
    }

    uint256 public lastIndex;

    mapping (uint256 => Claim) assertion;

    event PolicyRequested(address indexed _ssip, uint256 indexed _assertionId, uint256 indexed _policyId);
    event PolicyApproved(uint256 indexed _assertionId);
    event PolicyClaimed(address indexed _user, uint256 indexed _assertionId, address indexed _ssip);

    constructor(address _governance) {
        _grantRole(GUARDIAN_COUNCIL_ROLE, _governance);
        _setRoleAdmin(SSIP_ROLE, GUARDIAN_COUNCIL_ROLE);
        _setRoleAdmin(GUARDIAN_COUNCIL_ROLE, GUARDIAN_COUNCIL_ROLE);
    }
    
    function requestPolicyId(uint256 _policyId) external onlyRole(SSIP_ROLE) {
        uint256 _lastIndex = ++lastIndex;
        Claim memory _claim = assertion[_lastIndex];
        _claim.ssip = msg.sender;
        _claim.policyId = _policyId;
        assertion[_lastIndex] = _claim;
        lastIndex++;
        emit PolicyRequested(msg.sender, _lastIndex, _policyId);
    }

    function approvePolicy(uint256 _assertionId) external onlyRole(GUARDIAN_COUNCIL_ROLE) {
        require(!assertion[_assertionId].approved, "UnoRe: policy already approved");
        assertion[_assertionId].approved = true;
        emit PolicyApproved(_assertionId);
    }

    function claimPolicy(uint256 _assertionId) external {
        Claim memory _policy = assertion[_assertionId];
        require(_policy.approved && !_policy.settled, "UnoRe: not approved or already settled");
        _policy.settled = true;
        ISingleSidedInsurancePool(_policy.ssip).settlePayout(_policy.policyId, bytes32(0));
        
        emit PolicyClaimed(msg.sender, _assertionId, _policy.ssip);
    }
}
