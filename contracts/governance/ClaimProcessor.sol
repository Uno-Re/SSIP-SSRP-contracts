// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";

contract ClaimProcessor is AccessControl {

    bytes32 public constant GUARDIAN_COUNCIL_ROLE = keccak256("GUARDIAN_COUNCIL_ROLE");
    bytes32 public constant PAYOUT_REQUEST_ROLE = keccak256("PAYOUT_REQUEST_ROLE");

    struct Claim {
        bool approved;
        bool settled;
        address ssip;
        uint256 policyId;
        address payoutAddress;
        uint256 insureAmount;
    }

    uint256 public lastIndex;

    mapping (uint256 => Claim) public assertion;

    event PolicyRequested(address indexed _ssip, uint256 indexed _assertionId, uint256 indexed _policyId);
    event PolicyApproved(uint256 indexed _assertionId);
    event PolicyClaimed(address indexed _user, uint256 indexed _assertionId, address indexed _ssip);

    constructor(address _governance) {
        _grantRole(GUARDIAN_COUNCIL_ROLE, _governance);
        _setRoleAdmin(PAYOUT_REQUEST_ROLE, GUARDIAN_COUNCIL_ROLE);
        _setRoleAdmin(GUARDIAN_COUNCIL_ROLE, GUARDIAN_COUNCIL_ROLE);
    }

    function requestPolicyId(uint256 _policyId, address _ssip, address _to, uint256 _amount) external onlyRole(PAYOUT_REQUEST_ROLE) {
        uint256 _lastIndex = ++lastIndex;
        Claim memory _claim = assertion[_lastIndex];
        _claim.ssip = _ssip;
        _claim.policyId = _policyId;
        _claim.payoutAddress = _to;
        _claim.insureAmount = _amount;
        assertion[_lastIndex] = _claim;
        lastIndex++;
        emit PolicyRequested(_ssip, _lastIndex, _policyId);
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
        ISingleSidedInsurancePool(_policy.ssip).settlePayout(_policy.policyId, _policy.payoutAddress, _policy.insureAmount);
        
        emit PolicyClaimed(msg.sender, _assertionId, _policy.ssip);
    }
}
