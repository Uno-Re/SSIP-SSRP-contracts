// SPDX-License-Identifier: MIT

interface MockOracleAncillaryInterface {
    function requestPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external;

    function pushPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData,
        int256 price
    ) external;

    function hasPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external view returns (bool);

    function getPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external view returns (int256);

    function getPendingQueries() external view returns (QueryPoint[] memory);
}

struct QueryPoint {
    bytes32 identifier;
    uint256 time;
    bytes ancillaryData;
}
