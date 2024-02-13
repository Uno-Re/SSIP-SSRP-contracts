//SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/EscalationManagerInterface.sol";
import "../interfaces/OptimisticOracleV3Interface.sol";

contract EscalationManager is EscalationManagerInterface, AccessControl{

    bytes32 public constant OPTMISTIC_ORACLE_V3_ROLE = keccak256("OPTMISTIC_ORACLE_V3_ROLE");
    bytes32 public constant CLAIM_ASSESSOR_ROLE = keccak256("CLAIM_ASSESSOR_ROLE");

    OptimisticOracleV3Interface public immutable optimisticOracleV3;

    bool public blockAssertion;
    bool public arbitrateViaEscalationManager;
    bool public discardOracle;
    bool public validateDisputers;

    mapping (address => bool) checkDisputers;
    mapping (address => bool) checkAssertingCaller;

    modifier onlyOptimisticOracleV3() {
        require(msg.sender == address(optimisticOracleV3), "Not the Optimistic Oracle V3");
        _;
    }

    event PriceRequestAdded(bytes32 indexed identifier, uint256 time, bytes ancillaryData);
    event UpdatedBlockAssertion(address indexed owner, bool blockAssertion);
    event UpdatedArbitrateViaEscalationManager(address indexed owner, bool arbitrateViaEscalationManager);
    event UpdatedDiscardOracle(address indexed owner, bool discardOracle);
    event UpdatedValidateDisputers(address indexed owner, bool validateDisputers);
    

    /**
     * @notice Constructs the escalation manager.
     * @param _optimisticOracleV3 the Optimistic Oracle V3 to use.
     */
    constructor(address _optimisticOracleV3, address _governance) {
        optimisticOracleV3 = OptimisticOracleV3Interface(_optimisticOracleV3);
        _grantRole(CLAIM_ASSESSOR_ROLE, _governance);
        _setRoleAdmin(CLAIM_ASSESSOR_ROLE, CLAIM_ASSESSOR_ROLE);
        _grantRole(OPTMISTIC_ORACLE_V3_ROLE, _optimisticOracleV3);
        _setRoleAdmin(OPTMISTIC_ORACLE_V3_ROLE, CLAIM_ASSESSOR_ROLE);
    }
    
    function getAssertionPolicy(bytes32) external override view returns (AssertionPolicy memory) {
        return AssertionPolicy({
            blockAssertion: blockAssertion,
            arbitrateViaEscalationManager: arbitrateViaEscalationManager,
            discardOracle: discardOracle,
            validateDisputers: validateDisputers
        });
    }

    function isDisputeAllowed(bytes32 assertionId, address disputeCaller) external override view returns (bool) {
        return checkDisputers[disputeCaller];
    }

    function setBlockAssertion(bool _blockAssertion) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        blockAssertion = _blockAssertion;

        emit UpdatedBlockAssertion(msg.sender, _blockAssertion);
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

    function toggleAssertionCaller(address _caller) external onlyRole(CLAIM_ASSESSOR_ROLE) {
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