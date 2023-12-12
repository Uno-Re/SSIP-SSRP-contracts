// SPDX-License-Identifier: MIT

pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";

contract ClaimGovernance is Ownable{

    struct Policy {
        uint256 claimAmount;
        address payoutAddress;
        bool approve;
        bool settled;
    }

    mapping (uint256 => Policy) polices;

    event PolicyRequested(uint256 indexed _policyId, address indexed _payoutAddress, uint256 _amount);
    event PolicyApproved(uint256 indexed _policyId);
    event PolicyClaimed(uint256 indexed _policyId, address indexed _ssip);

    constructor(address _governance) Ownable(_governance) {}
    
    function requsetPolicyId(uint256 _policyId, address _to, uint256 _amount) external onlyOwner {
        Policy memory _policy = polices[_policyId];
        _policy.claimAmount = _amount;
        _policy.payoutAddress = _to;
        polices[_policyId] = _policy;

        emit PolicyRequested(_policyId, _to, _amount);
    }

    function approvePolicy(uint256 _policyId) external onlyOwner {
        Policy memory _policy = polices[_policyId];
        require(_policy.payoutAddress != address(0) && _policy.claimAmount != 0, "UnoRe: policy not exist");
        polices[_policyId].approve = true;
        emit PolicyApproved(_policyId);
    }

    function claimPolicy(uint256 _policyId, address _ssip) external onlyOwner {
        Policy memory _policy = polices[_policyId];
        require(_policy.approve, "UnoRe: not approved");
        polices[_policyId].settled = true;
        ISingleSidedInsurancePool(_ssip).claimByGovernance(_policyId);
        
        emit PolicyClaimed(_policyId, _ssip);
    }
}
