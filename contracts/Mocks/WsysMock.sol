// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract WsysMock is ERC20, Ownable, ERC20Burnable {
    constructor(string memory name, string memory symbol, uint256 initialAmount) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialAmount);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
