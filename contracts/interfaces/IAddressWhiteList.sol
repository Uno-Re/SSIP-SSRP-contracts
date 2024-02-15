pragma solidity ^0.8.0;

interface IAddressWhitelist {
    // Events
    event AddedToWhitelist(address indexed addedAddress);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event RemovedFromWhitelist(address indexed removedAddress);

    // Functions
    function addToWhitelist(address newElement) external;
    function getWhitelist() external view returns (address[] memory activeWhitelist);
    function isOnWhitelist(address elementToCheck) external view returns (bool);
    function owner() external view returns (address);
    function removeFromWhitelist(address elementToRemove) external;
    function renounceOwnership() external;
    function transferOwnership(address newOwner) external;
    function whitelist(address) external view returns (uint8);
    function whitelistIndices(uint256) external view returns (address);
}
