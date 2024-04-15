//SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/EscalationManagerInterface.sol";

contract EscalationManager is EscalationManagerInterface, AccessControl{

    struct AssertionApproval {
        bool exist;
        bool approved;
        bool settled;
    }

    bytes32 public constant OPTMISTIC_ORACLE_V3_ROLE = keccak256("OPTMISTIC_ORACLE_V3_ROLE");
    bytes32 public constant CLAIM_ASSESSOR_ROLE = keccak256("CLAIM_ASSESSOR_ROLE");

    int256 public constant NUMERICAL_VALUE = 1e18;

    bool public arbitrateViaEscalationManager;
    bool public discardOracle;
    bool public validateDisputers;

    mapping (address => bool) public checkDisputers;
    mapping (bytes32 => int256) public oraclePrice;
    mapping (bytes32 => bool) public isOraclePriceCalled;

    event PriceRequestAdded(bytes32 indexed identifier, uint256 time, bytes ancillaryData);
    event UpdatedArbitrateViaEscalationManager(address indexed owner, bool arbitrateViaEscalationManager);
    event UpdatedDiscardOracle(address indexed owner, bool discardOracle);
    event UpdatedValidateDisputers(address indexed owner, bool validateDisputers);
    

    /**
     * @notice Constructs the escalation manager.
     */
    constructor(address _optimisticOracleV3, address _governance) {
        _grantRole(CLAIM_ASSESSOR_ROLE, _governance);
        _setRoleAdmin(CLAIM_ASSESSOR_ROLE, CLAIM_ASSESSOR_ROLE);
        _grantRole(OPTMISTIC_ORACLE_V3_ROLE, _optimisticOracleV3);
        _setRoleAdmin(OPTMISTIC_ORACLE_V3_ROLE, CLAIM_ASSESSOR_ROLE);
    }
    
    function getAssertionPolicy(bytes32) external override view returns (AssertionPolicy memory) {
        return AssertionPolicy({
            blockAssertion: false,
            arbitrateViaEscalationManager: arbitrateViaEscalationManager,
            discardOracle: discardOracle,
            validateDisputers: validateDisputers
        });
    }

    function isDisputeAllowed(bytes32 assertionId, address disputeCaller) external override view returns (bool) {
        return checkDisputers[disputeCaller];
    }

    function setArbitrateViaEscalationManager(bool _arbitrateViaEscalationManager) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        arbitrateViaEscalationManager = _arbitrateViaEscalationManager;

        emit UpdatedArbitrateViaEscalationManager(msg.sender, _arbitrateViaEscalationManager);
    }

    function setDiscardOracle(bool _discardOracle) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        discardOracle = _discardOracle;

        emit UpdatedDiscardOracle(msg.sender, _discardOracle);
    }

    function setValidateDisputers(bool _validateDisputers) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        validateDisputers = _validateDisputers;

        emit UpdatedValidateDisputers(msg.sender, _validateDisputers);
    }

    function toggleDisputer(address _disputer) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        checkDisputers[_disputer] = !checkDisputers[_disputer];
    }

    function getPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external view override returns (int256) {
        bytes32 data = keccak256(abi.encodePacked(identifier, time, ancillaryData));
        require(isOraclePriceCalled[data], "EManager: no price request");
        return oraclePrice[data];
    }

    function setOraclePrice(bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData,
        int256 price
    ) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        require(price == 0 || price == NUMERICAL_VALUE, "EManager: invalid price");
        bytes32 data = keccak256(abi.encodePacked(identifier, time, ancillaryData));
        oraclePrice[data] = price;
        isOraclePriceCalled[data] = true;
    }

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