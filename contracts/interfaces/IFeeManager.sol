pragma solidity ^0.8.0;

interface IFeeManger {
   struct Unsigned {
        uint256 rawValue;
    }

   
    function addMember(uint256 roleId, address newMember) external;


  
    function finalFees(address) external view returns (uint256 rawValue);

    function fixedOracleFeePerSecondPerPfc() external view returns (uint256 rawValue);

    function getCurrentTime() external view returns (uint256);

    function getMember(uint256 roleId) external view returns (address);

    function holdsRole(uint256 roleId, address memberToCheck) external view returns (bool);

    function payOracleFees() external payable;

    function removeMember(uint256 roleId, address memberToRemove) external;

    function renounceMembership(uint256 roleId) external;

    function resetMember(uint256 roleId, address newMember) external;

    function setCurrentTime(uint256 time) external;

    function setFinalFee(address currency,Unsigned memory) external;

    function timerAddress() external view returns (address);

    function weeklyDelayFeePerSecondPerPfc() external view returns (uint256 rawValue);

    function withdraw(uint256 amount) external;

    function withdrawErc20(address erc20Address, uint256 amount) external;
}
