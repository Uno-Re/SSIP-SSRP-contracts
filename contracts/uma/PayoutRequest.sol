// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./ClaimData.sol";
import "../interfaces/OptimisticOracleV3Interface.sol";
import "../interfaces/ICapitalAgent.sol";
import "../interfaces/ISalesPolicy.sol";
import "../interfaces/IClaimProcessor.sol";
import "../interfaces/ISingleSidedInsurancePool.sol";

contract PayoutRequest is PausableUpgradeable {
    struct Policy {
        uint256 insuranceAmount;
        address payoutAddress;
        bool settled;
    }

    address private _guardianCouncil;

    OptimisticOracleV3Interface public optimisticOracle;
    ISingleSidedInsurancePool public ssip;
    ICapitalAgent public capitalAgent;
    IClaimProcessor public claimProcessor;
    IERC20 public defaultCurrency;
    bytes32 public defaultIdentifier;
    uint256 public assertionliveTime;
    address public escalationManager;
    mapping(uint256 => Policy) public policies;
    mapping(bytes32 => uint256) public assertedPolicies;
    mapping(uint256 => bytes32) public policiesAssertionId;
    bool public isUMAFailed;

    event InsurancePayoutRequested(uint256 indexed policyId, bytes32 indexed assertionId);
    event LogSetEscalationManager(address indexed payout, address indexed escalatingManager);
    event LogSetAssertionAliveTime(address indexed payout, uint256 assertionAliveTime);
    event LogSetClaimProccessor(address indexed payout, address indexed claimProccessor);
    event PoolFailed(address indexed owner, bool fail);

    function initialize(
        ISingleSidedInsurancePool _ssip,
        OptimisticOracleV3Interface _optimisticOracleV3,
        IERC20 _defaultCurrency,
        IClaimProcessor _claimProcessor,
        address _escalationManager,
        address __guardianCouncil
    ) external initializer {
        ssip = _ssip;
        optimisticOracle = _optimisticOracleV3;
        defaultCurrency = _defaultCurrency;
        claimProcessor = _claimProcessor;
        escalationManager = _escalationManager;
        _guardianCouncil = __guardianCouncil;
        defaultIdentifier = optimisticOracle.defaultIdentifier();
        assertionliveTime = 10 days;
    }

    function initRequest(uint256 _policyId, uint256 _amount, address _to) public whenNotPaused returns (bytes32 assertionId) {
        (address salesPolicy, , ) = ICapitalAgent(capitalAgent).getPolicyInfo();
        require(IERC721(salesPolicy).ownerOf(_policyId) == msg.sender, "UnoRe: not owner of policy id");
        (uint256 _coverageAmount, , , bool _exist, bool _expired) = ISalesPolicy(salesPolicy).getPolicyData(_policyId);
        require(_amount <= _coverageAmount, "UnoRe: amount exceeds coverage amount");
        require(_exist && !_expired, "UnoRe: policy expired or not exist");
        Policy memory _policyData = policies[_policyId];
        _policyData.insuranceAmount = _amount;
        _policyData.payoutAddress = _to;
        policies[_policyId] = _policyData;
        if (!isUMAFailed) {
            uint256 bond = optimisticOracle.getMinimumBond(address(defaultCurrency));
            assertionId = optimisticOracle.assertTruth(
                abi.encodePacked(
                    "Insurance contract is claiming that insurance event ",
                    " had occurred as of ",
                    ClaimData.toUtf8BytesUint(block.timestamp),
                    "."
                ),
                _to,
                address(ssip),
                escalationManager,
                uint64(assertionliveTime),
                defaultCurrency,
                bond,
                defaultIdentifier,
                bytes32(0) // No domain.
            );
            assertedPolicies[assertionId] = _policyId;
            policiesAssertionId[_policyId] = assertionId;
            emit InsurancePayoutRequested(_policyId, assertionId);
        } else {
            IClaimProcessor(claimProcessor).requestPolicyId(_policyId, address(ssip), _to, _amount);
        }
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external whenNotPaused {
        require(!isUMAFailed, "RPayout: pool failed");
        // If the assertion was true, then the policy is settled.
        if (_assertedTruthfully) {
            uint256 _policyId = assertedPolicies[_assertionId];
            // If already settled, do nothing. We don't revert because this function is called by the
            // OptimisticOracleV3, which may block the assertion resolution.
            Policy storage policy = policies[_policyId];
            if (policy.settled) return;
            policy.settled = true;
            ssip.settlePayout(_policyId, policy.payoutAddress, policy.insuranceAmount);
        }
    }

    function assertionDisputedCallback(bytes32 assertionId) external {}

    function setEscalatingManager(address _escalatingManager) external {
        _requireGuardianCouncil();
        escalationManager = _escalatingManager;
        emit LogSetEscalationManager(address(this), _escalatingManager);
    }

    function setFailed(bool _failed) external {
        _requireGuardianCouncil();
        isUMAFailed = _failed;
        emit PoolFailed(msg.sender, _failed);
    }

    function setAliveness(uint256 _assertionliveTime) external {
        _requireGuardianCouncil();
        require(_assertionliveTime > 0, "RPayout: zero assertion live time");
        assertionliveTime = _assertionliveTime;
        emit LogSetAssertionAliveTime(address(this), _assertionliveTime);
    }

    function setClaimProcessor(IClaimProcessor _claimProcessor) external {
        _requireGuardianCouncil();
        claimProcessor = _claimProcessor;
        emit LogSetClaimProccessor(address(this), address(_claimProcessor));
    }

    function togglePause() external {
        _requireGuardianCouncil();
        paused() ? _unpause() : _pause();
    }

    function _requireGuardianCouncil() internal view {
        require(msg.sender == _guardianCouncil, "RPayout: unauthorised");
    }
}
