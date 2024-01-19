// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "./ClaimData.sol";
import "../libraries/TransferHelper.sol";
import "../interfaces/OptimisticOracleV3Interface.sol";
import "../interfaces/ICapitalAgent.sol";
import "../interfaces/ISalesPolicy.sol";
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
    IERC20 public defaultCurrency;
    bytes32 public defaultIdentifier;
    uint256 public assertionliveTime;
    address public escalationManager;
    address public claimsDao;
    mapping(uint256 => Policy) public policies;
    mapping(bytes32 => uint256) public assertedPolicies;
    mapping(uint256 => bytes32) public policiesAssertionId;
    mapping(uint256 => bool) public isRequestInit;
    bool public isUMAFailed;

    event InsurancePayoutRequested(uint256 indexed policyId, bytes32 indexed assertionId);
    event LogSetEscalationManager(address indexed payout, address indexed escalatingManager);
    event LogSetAssertionAliveTime(address indexed payout, uint256 assertionAliveTime);
    event LogSetClaimProccessor(address indexed payout, address indexed claimProccessor);
    event LogSetCapitalAgent(address indexed payout, address indexed capitalAgent);
    event PoolFailed(address indexed owner, bool fail);

    function initialize(
        ISingleSidedInsurancePool _ssip,
        OptimisticOracleV3Interface _optimisticOracleV3,
        IERC20 _defaultCurrency,
        address _escalationManager,
        address __guardianCouncil,
        address _claimsDao
    ) external initializer {
        ssip = _ssip;
        optimisticOracle = _optimisticOracleV3;
        defaultCurrency = _defaultCurrency;
        escalationManager = _escalationManager;
        claimsDao = _claimsDao;
        _guardianCouncil = __guardianCouncil;
        defaultIdentifier = optimisticOracle.defaultIdentifier();
        assertionliveTime = 10 days;
        isUMAFailed = true;
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
            TransferHelper.safeTransferFrom(address(defaultCurrency), msg.sender, address(this), bond);
            defaultCurrency.approve(address(optimisticOracle), bond);
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
            require(msg.sender == claimsDao, "RPayout: can only called by claimsDao");
            policies[_policyId].settled = true;
            ssip.settlePayout(_policyId, _to, _amount);
        }
        isRequestInit[_policyId] = true;
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external whenNotPaused {
        require(!isUMAFailed, "RPayout: pool failed");
        require(msg.sender == address(optimisticOracle), "RPayout: !optimistic oracle");
        // If the assertion was true, then the policy is settled.
        uint256 _policyId = assertedPolicies[_assertionId];
        if (_assertedTruthfully) {
            // If already settled, do nothing. We don't revert because this function is called by the
            // OptimisticOracleV3, which may block the assertion resolution.
            Policy storage policy = policies[_policyId];
            if (policy.settled) return;
            policy.settled = true;
            ssip.settlePayout(_policyId, policy.payoutAddress, policy.insuranceAmount);
        } else {
            isRequestInit[_policyId] = false;
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

    function setCapitalAgent(ICapitalAgent _capitalAgent) external {
        _requireGuardianCouncil();
        capitalAgent = _capitalAgent;
        emit LogSetCapitalAgent(address(this), address(_capitalAgent));
    }

    function togglePause() external {
        _requireGuardianCouncil();
        paused() ? _unpause() : _pause();
    }

    function _requireGuardianCouncil() internal view {
        require(msg.sender == _guardianCouncil, "RPayout: unauthorised");
    }
}
