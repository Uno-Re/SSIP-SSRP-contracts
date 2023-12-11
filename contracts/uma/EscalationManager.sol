//SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/EscalationManagerInterface.sol";
import "../interfaces/OptimisticOracleV3Interface.sol";

contract EscalationManager is EscalationManagerInterface, AccessControl{

    bytes32 public constant OPTMISTIC_ORACLE_V3_ROLE = keccak256("OPTMISTIC_ORACLE_V3_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    OptimisticOracleV3Interface public immutable optimisticOracleV3;

    mapping (address => bool) checkDisputers;
    mapping (address => bool) checkAssertingCaller;

    modifier onlyOptimisticOracleV3() {
        require(msg.sender == address(optimisticOracleV3), "Not the Optimistic Oracle V3");
        _;
    }

    event PriceRequestAdded(bytes32 indexed identifier, uint256 time, bytes ancillaryData);

    /**
     * @notice Constructs the escalation manager.
     * @param _optimisticOracleV3 the Optimistic Oracle V3 to use.
     */
    constructor(address _optimisticOracleV3, address _governance) {
        optimisticOracleV3 = OptimisticOracleV3Interface(_optimisticOracleV3);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
        _grantRole(ADMIN_ROLE, _governance);
        _setRoleAdmin(OPTMISTIC_ORACLE_V3_ROLE, ADMIN_ROLE);
        _grantRole(OPTMISTIC_ORACLE_V3_ROLE, _optimisticOracleV3);
    }
    
    function getAssertionPolicy(bytes32) external override pure returns (AssertionPolicy memory) {
        return AssertionPolicy({
            blockAssertion: false,
            arbitrateViaEscalationManager: true,
            discardOracle: true,
            validateDisputers: true
        });
    }

    function isDisputeAllowed(bytes32 assertionId, address disputeCaller) external override view returns (bool) {
        return checkDisputers[disputeCaller];
    }

    function toggleDisputer(address _disputer) external onlyRole(ADMIN_ROLE) {
        checkDisputers[_disputer] = !checkDisputers[_disputer];
    }

    function toggleAssertionCaller(address _caller) external onlyRole(ADMIN_ROLE) {
        checkAssertingCaller[_caller] = !checkAssertingCaller[_caller];
    }

    function getPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external override returns (int256) {}

    function requestPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {
        emit PriceRequestAdded(identifier, time, ancillaryData);
    }

    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {}

    function assertionDisputedCallback(bytes32 assertionId) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {}

}