//SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../interfaces/EscalationManagerInterface.sol";
import "../interfaces/OptimisticOracleV3Interface.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";
import "../interfaces/IPayoutRequest.sol";

contract EscalationManager is EscalationManagerInterface, AccessControl{

    struct AssertionApproval {
        bool exist;
        bool approved;
        bool settled;
    }

    bytes32 public constant OPTMISTIC_ORACLE_V3_ROLE = keccak256("OPTMISTIC_ORACLE_V3_ROLE");
    bytes32 public constant CLAIM_ASSESSOR_ROLE = keccak256("CLAIM_ASSESSOR_ROLE");

    bool public blockAssertion;
    bool public arbitrateViaEscalationManager;
    bool public discardOracle;
    bool public validateDisputers;

    mapping (address => bool) public checkDisputers;
    mapping (address => bool) public checkAssertingCaller;
    mapping (bytes32 => AssertionApproval) public isAssertionIdApproved;

    mapping (bytes32 => int256) public oraclePrice;

    event PriceRequestAdded(bytes32 indexed identifier, uint256 time, bytes ancillaryData);
    event UpdatedBlockAssertion(address indexed owner, bool blockAssertion);
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

    function setAssertionIdApproval(bytes32 _assertionId, bool _isApproved, bool _exist) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        isAssertionIdApproved[_assertionId].exist = _exist;
        isAssertionIdApproved[_assertionId].approved = _isApproved;
    }

    function getPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external view override returns (int256) {
        bytes32 data = keccak256(abi.encodePacked(identifier, time, ancillaryData));
        return oraclePrice[data];
    }

    function setOraclePrice(bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData,
        int256 price
    ) external onlyRole(CLAIM_ASSESSOR_ROLE) {
        bytes32 data = keccak256(abi.encodePacked(identifier, time, ancillaryData));
        oraclePrice[data] = price;
    }

    function requestPrice(
        bytes32 identifier,
        uint256 time,
        bytes memory ancillaryData
    ) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {
        emit PriceRequestAdded(identifier, time, ancillaryData);
    }

    function assertionResolvedCallback(bytes32 assertionId, bool assertedTruthfully) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {

        AssertionApproval memory _assertionApproval = isAssertionIdApproved[assertionId];
        if (_assertionApproval.exist && !_assertionApproval.settled) {
            if (_assertionApproval.approved && !assertedTruthfully) {
                IPayoutRequest _payoutAddress = IPayoutRequest(OptimisticOracleV3Interface(msg.sender).getAssertion(assertionId).callbackRecipient);
                uint256 _policyId = _payoutAddress.assertedPolicies(assertionId);
                IPayoutRequest.Policy memory policy = _payoutAddress.policies(_policyId);
                ISingleSidedInsurancePool(_payoutAddress.ssip()).settlePayout(_policyId, policy.payoutAddress, policy.insuranceAmount);
                isAssertionIdApproved[assertionId].settled = true;
            }
        }

    }

    function assertionDisputedCallback(bytes32 assertionId) external override onlyRole(OPTMISTIC_ORACLE_V3_ROLE) {}

}