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
import "../interfaces/IExchangeAgent.sol";

contract PayoutRequest is PausableUpgradeable {
    struct Policy {
        uint256 insuranceAmount;
        uint256 policyId;
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
    mapping(bytes32 => Policy) public assertedPolicies;
    bool public isUMAFailed;

    uint256 public lockTime;
    mapping(address => uint256) public roleLockTime;
    mapping(bytes32 => bool) settleAssertionUmaFailed;
    bytes32 public ipfsUrl;

    event InsurancePayoutRequested(uint256 indexed policyId, bytes32 indexed assertionId);
    event LogSetEscalationManager(address indexed payout, address indexed escalatingManager);
    event LogSetAssertionAliveTime(address indexed payout, uint256 assertionAliveTime);
    event LogSetClaimProccessor(address indexed payout, address indexed claimProccessor);
    event LogSetCapitalAgent(address indexed payout, address indexed capitalAgent);
    event LogSetClaimsDao(address indexed payout, address indexed capitalAgent);
    event PoolFailed(address indexed owner, bool fail);
    event LogSetLockTime(address indexed payout, uint256 newLockTime);
    event LogSetGuardianCouncil(address indexed payout, address indexed guardianCouncil);
    event SettledUMAFailedAssertion(bytes32 indexed assertionId, uint256 indexed policyId, uint256 insuranceAmount);
    event IpfsUrlSet(bytes32 ipfsLink);

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

    /**
     * @param _hyperlaneMessage Starting string texts for claim data prefix, eg. "Request for claim is for"
     */
    function initRequest(uint256 _policyId, uint256 _amount, address _to, bytes32 _hyperlaneMessage) public whenNotPaused returns (bytes32 assertionId) {
        (address salesPolicy, , ) = ICapitalAgent(capitalAgent).getPolicyInfo();
        ICapitalAgent(capitalAgent).updatePolicyStatus(_policyId);
        _checkForCoverage(salesPolicy, _policyId, _amount);
        if (!isUMAFailed) {
            require(IERC721(salesPolicy).ownerOf(_policyId) == msg.sender, "UnoRe: not owner of policy id");
            uint256 bond = optimisticOracle.getMinimumBond(address(defaultCurrency));
            TransferHelper.safeTransferFrom(address(defaultCurrency), msg.sender, address(this), bond);
            defaultCurrency.approve(address(optimisticOracle), bond);
            assertionId = optimisticOracle.assertTruth(
                abi.encodePacked(
                    "Request asserted: 0x",
                    ClaimData.toUtf8Bytes(_hyperlaneMessage),
                    " for policyId: ",
                    ClaimData.toUtf8BytesUint(_policyId),
                    ", asserter: 0x",
                    ClaimData.toUtf8BytesAddress(_to),
                    " and amount: ",
                    ClaimData.toUtf8BytesUint(_amount),
                    " with assessment: 0x",
                    ClaimData.toUtf8Bytes(ipfsUrl),
                    " at timestamp: ",
                    ClaimData.toUtf8BytesUint(block.timestamp),
                    " and RequestAsserter contract: 0x",
                    ClaimData.toUtf8BytesAddress(address(this)),
                    " is valid."
                ),
                _to,
                address(this),
                escalationManager,
                uint64(assertionliveTime),
                defaultCurrency,
                bond,
                defaultIdentifier,
                bytes32(0) // No domain.
            );

            Policy memory _policyData = assertedPolicies[assertionId];
            _policyData.insuranceAmount = _amount;
            _policyData.payoutAddress = _to;
            _policyData.policyId = _policyId;
            assertedPolicies[assertionId] = _policyData;
            emit InsurancePayoutRequested(_policyId, assertionId);
        } else {
            require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
            require(msg.sender == claimsDao, "RPayout: can only called by claimsDao");
            ssip.settlePayout(_policyId, _to, _amount);
        }
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external {
        require(msg.sender == address(optimisticOracle), "RPayout: !optimistic oracle");
        // If the assertion was true, then the policy is settled.
        Policy memory _policyData = assertedPolicies[_assertionId];
        if (_assertedTruthfully) {
            // If already settled, do nothing. We don't revert because this function is called by the
            // OptimisticOracleV3, which may block the assertion resolution.
            if (_policyData.settled) return;
            if (isUMAFailed) {
                settleAssertionUmaFailed[_assertionId] = true;
                return;
            }
            assertedPolicies[_assertionId].settled = true;
            ssip.settlePayout(_policyData.policyId, _policyData.payoutAddress, _policyData.insuranceAmount);
        }
    }

    function settleAssertionForUmaFailed(bytes32 _assertionId) external {
        require(msg.sender == claimsDao, "RPayout: can only called by claimsDao");
        require(settleAssertionUmaFailed[_assertionId], "RPayout: Id not approved to setlle");
        Policy memory _policyData = assertedPolicies[_assertionId];
        ssip.settlePayout(_policyData.policyId, _policyData.payoutAddress, _policyData.insuranceAmount);

        emit SettledUMAFailedAssertion(_assertionId, _policyData.policyId, _policyData.insuranceAmount);
    }

    function assertionDisputedCallback(bytes32 assertionId) external {}

    function setEscalatingManager(address _escalatingManager) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        escalationManager = _escalatingManager;
        emit LogSetEscalationManager(address(this), _escalatingManager);
    }

    function setFailed(bool _failed) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        isUMAFailed = _failed;
        emit PoolFailed(msg.sender, _failed);
    }

    function setAliveness(uint256 _assertionliveTime) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        require(_assertionliveTime > 0, "RPayout: zero assertion live time");
        assertionliveTime = _assertionliveTime;
        emit LogSetAssertionAliveTime(address(this), _assertionliveTime);
    }

    function setCapitalAgent(ICapitalAgent _capitalAgent) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        capitalAgent = _capitalAgent;
        emit LogSetCapitalAgent(address(this), address(_capitalAgent));
    }

    function setClaimsDao(address _claimsDao) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        roleLockTime[_claimsDao] = block.timestamp + lockTime;
        claimsDao = _claimsDao;
        emit LogSetClaimsDao(address(this), address(_claimsDao));
    }

    function setLockTime(uint256 _lockTime) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        lockTime = _lockTime;
        emit LogSetLockTime(address(this), _lockTime);
    }

    function setGuardianCouncil(address guardianCouncil) external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        roleLockTime[guardianCouncil] = block.timestamp + lockTime;
        _guardianCouncil = guardianCouncil;
        emit LogSetGuardianCouncil(address(this), guardianCouncil);
    }

    function setIpfsUrl(bytes32 _ipfsLink) external {
        _requireGuardianCouncil();
        ipfsUrl = _ipfsLink;
        emit IpfsUrlSet(_ipfsLink);
    }

    function togglePause() external {
        _requireGuardianCouncil();
        require(roleLockTime[msg.sender] <= block.timestamp, "RPayout: role lock time not passed");
        paused() ? _unpause() : _pause();
    }

    function _requireGuardianCouncil() internal view {
        require(msg.sender == _guardianCouncil, "RPayout: unauthorised");
    }

    function _checkForCoverage(address salesPolicy, uint256 _policyId, uint256 _amount) internal {
        uint256 _claimed = ICapitalAgent(capitalAgent).claimedAmount(salesPolicy, _policyId);
        (uint256 _coverageAmount, , , bool _exist, bool _expired) = ISalesPolicy(salesPolicy).getPolicyData(_policyId);
        address _exchangeAgent = ICapitalAgent(capitalAgent).exchangeAgent();
        (, , address _currency, ) = ICapitalAgent(capitalAgent).getPoolInfo(address(ssip));
        address _usdcToken = IExchangeAgent(_exchangeAgent).usdcToken();
        uint256 usdcTokenAmount = IExchangeAgent(_exchangeAgent).getNeededTokenAmount(_currency, _usdcToken, _amount);
        require(usdcTokenAmount + _claimed <= _coverageAmount, "UnoRe: amount exceeds coverage amount");
        require(_exist && !_expired, "UnoRe: policy expired or not exist");
    }
}
