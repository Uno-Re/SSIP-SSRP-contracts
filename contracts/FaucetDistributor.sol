// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";

contract FaucetDistributor is Ownable {
    address public USDC;
    address public UNO;

    mapping(address => uint256) public lastUSDCSentTime;
    mapping(address => uint256) public lastUNOSentTime;

    event USDCSent(address indexed recipient, uint256 amount);
    event UNOSent(address indexed recipient, uint256 amount);

    constructor(address _USDC, address _UNO) Ownable(msg.sender) {
        _setUSDC(_USDC);
        _setUNO(_UNO);
    }

    // Gives 1k USDC
    function getUSDCFaucet() external {
        require(
            block.timestamp - lastUSDCSentTime[msg.sender] >= 2 hours,
            "You can only claim USDC once every 2 hours"
        );
        require(
            IERC20(USDC).transfer(msg.sender, 1000000000),
            "USDC transfer failed"
        );
        lastUSDCSentTime[msg.sender] = block.timestamp;
        emit USDCSent(msg.sender, 1000000000);
    }

    // Gives 100 UNO
    function getUNOFaucet() external {
        require(
            block.timestamp - lastUNOSentTime[msg.sender] >= 2 hours,
            "You can only claim UNO once every 2 hours"
        );
        require(
            IERC20(UNO).transfer(msg.sender, 100000000000000000000),
            "UNO transfer failed"
        );
        lastUNOSentTime[msg.sender] = block.timestamp;
        emit UNOSent(msg.sender, 100000000000000000000);
    }

    function setUSDC(address _USDC) external onlyOwner {
        _setUSDC(_USDC);
    }

    function setUNO(address _UNO) external onlyOwner {
        _setUNO(_UNO);
    }

    function _setUNO(address _UNO) internal onlyOwner {
        UNO = _UNO;
    }

    function _setUSDC(address _USDC) internal onlyOwner {
        USDC = _USDC;
    }

    function checkUSDCBalance() external view {
        IERC20(USDC).balanceOf(address(this));
    }

    function checkUNOBalance() external view {
        IERC20(UNO).balanceOf(address(this));
    }
}
