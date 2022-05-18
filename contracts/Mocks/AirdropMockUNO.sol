// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../libraries/TransferHelper.sol";

contract AirdropMockUNO is Ownable {
    receive() external payable {}

    function airdrop(
        address[] memory _receivers,
        uint256[] memory _amounts,
        address _token,
        address _from
    ) external onlyOwner {
        require(_receivers.length == _amounts.length, "Length should be equal");
        uint256 len = _receivers.length;
        for (uint256 ii = 0; ii < len; ii++) {
            TransferHelper.safeTransferFrom(_token, _from, _receivers[ii], _amounts[ii]);
        }
    }
}
