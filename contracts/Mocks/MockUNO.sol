// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * This smart contract
 */

contract MockUNO is ERC20 {
    uint256 INITIAL_SUPPLY = 10000000000 * 10 ** 18;

    // mapping(address => uint256) private _faucets;
    uint256 public constant faucetLimit = 500000000 * 10 ** 18;

    constructor() ERC20("UNORE", "UNO") {
        _mint(msg.sender, INITIAL_SUPPLY);
    }

    function faucetToken(address _to, uint256 _amount) external {
        // require(_faucets[msg.sender] + _amount <= faucetLimit, "Uno: Faucet amount limitation");
        _mint(_to, _amount);
    }
}
