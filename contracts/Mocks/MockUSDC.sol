// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * This smart contract
 */

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 10000000000 * 10 ** 18);
    }

    function faucetToken(address _to, uint256 _amount) external {
        // require(_faucets[msg.sender] + _amount <= faucetLimit, "Uno: Faucet amount limitation");
        _mint(_to, _amount);
    }
}
