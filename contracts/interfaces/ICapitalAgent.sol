// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface ICapitalAgent {
    function addPool(address _ssip) external;

    function addPolicy(address _policy) external;

    function SSIPWithdraw(uint256 _withdrawAmount) external;

    function SSIPStaking(uint256 _stakingAmount) external;

    function SSIPPolicyCaim(uint256 _withdrawAmount) external;

    function checkCapitalByMCR(uint256 _withdrawAmount) external view returns (bool);

    function policySale(uint256 _coverageAmount) external;

    function updatePolicyStatus(address _policy, uint256 _policyId) external;
}
