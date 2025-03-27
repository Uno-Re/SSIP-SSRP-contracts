// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

interface ICapitalAgent {
    function addPool(address _ssip, address _currency, uint256 _scr) external;

    function setPolicy(address _policy) external;

    function SSIPWithdraw(uint256 _withdrawAmount) external;

    function SSIPStaking(uint256 _stakingAmount) external;

    function SSIPPolicyCaim(uint256 _withdrawAmount, uint256 _policyId, bool _isMigrate) external;

    function checkCapitalByMCR(address _pool, uint256 _withdrawAmount) external view returns (bool);

    function checkCoverageByMLR(uint256 _coverageAmount) external view returns (bool);

    function policySale(uint256 _coverageAmount) external;

    function updatePolicyStatus(uint256 _policyId) external;

    function getPolicyInfo() external returns (address, uint256, bool);

    function claimedAmount(address _policy, uint256 _policyId) external returns (uint256);

    function exchangeAgent() external view returns (address);

    function getPoolInfo(address _pool) external view returns (uint256, uint256, address, bool, uint256);

    function updatePoolWithdrawPendingCapital(address _pool, uint256 _amount, bool) external;

    function addPoolWhiteList(address _pool) external;

    function poolWhiteList(address _pool) external view returns (bool);
}
