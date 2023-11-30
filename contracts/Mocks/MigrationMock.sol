// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "../interfaces/IMigration.sol";

contract MigrationMock is IMigration {
    constructor() {}

    function onMigration(
        address who_,
        uint256 amount_,
        bytes memory data_
    ) external virtual override {}
}
