// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

interface IRiskPoolUSDM {
    function enter(address _from, uint256 _amount) external;

    function leaveFromPoolInPending(address _to, uint256 _amount) external;

    function leaveFromPending(address _to, uint256 _amount) external returns (uint256, uint256);

    function cancelWithdrawRequest(address _to) external returns (uint256, uint256);

    function policyClaim(address _to, uint256 _amount) external returns (uint256 realClaimAmount);

    function migrateLP(address _to, address _migrateTo, bool _isUnLocked) external returns (uint256);

    function setMinLPCapital(uint256 _minLPCapital) external;

    function currency() external view returns (address);

    function getTotalWithdrawRequestAmount() external view returns (uint256);

    function getWithdrawRequest(address _to) external view returns (uint256, uint256, uint256);

    function lpPriceUno() external view returns (uint256);

    function emergencyWithdraw(address _to, uint256 _amount) external returns (bool);

    function setLpPriceUno(uint256 _lpPriceUno) external;

    function transferUSDMReward(address _to, uint256 _amount) external;

    function balanceOf(address _to) external view returns (uint256);
}
