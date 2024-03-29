// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockSalesPolicy.sol";
import "../interfaces/ISalesPolicy.sol";
import "../interfaces/ISalesPolicyFactory.sol";

contract MockSalesPolicyFactory is ISalesPolicyFactory, ReentrancyGuard, Ownable {
    using Counters for Counters.Counter;
    // It should be okay if Protocol is struct
    struct Protocol {
        address protocolAddress; // Address of that protocol
        bool isBlackList; // initial true
    }

    bool public override checkIfProtocolInWhitelistArray;

    address public premiumPool;
    address public exchangeAgent;
    address public capitalAgent;

    address public salesPolicy;

    mapping(uint16 => Protocol) public getProtocol;
    mapping(address => uint16) public override getProtocolId;
    Counters.Counter private protocolIds;

    address public usdcToken;

    event ProtocolCreated(uint16 _protocolIdx, address _protocol);
    event LogSetPremiumPool(address indexed _premiumPool);
    event LogUpdateCheckIfProtocolInWhitelistArray(bool _status);
    event LogSetBlackListProtocol(uint16 _protocolId, address indexed _protocol);
    event LogSetExchangeAgentInPolicy(address _exchangeAgent);
    event LogSetBuyPolicyMaxDeadlineInPolicy(uint256 _maxDeadline);
    event LogSetPremiumPoolInPolicy(address _premiumPool);
    event LogSetSignerInPolicy(address _signer);
    event LogSetCapitalAgentInPolicy(address _capitalAgent);
    event LogSetProtocolURIInPolicy(string _uri);
    event LogApprovePremiumInPolicy(address _premiumCurrency);

    constructor(
        address _usdcToken,
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent,
        address _multiSigWallet
    ) Ownable(_multiSigWallet) {
        require(_usdcToken != address(0), "UnoRe: zero USDC address");
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_premiumPool != address(0), "UnoRe: zero premiumPool address");
        require(_capitalAgent != address(0), "UnoRe: zero capitalAgent address");
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        usdcToken = _usdcToken;
        premiumPool = _premiumPool;
        exchangeAgent = _exchangeAgent;
        capitalAgent = _capitalAgent;
        // transferOwnership(_multiSigWallet);
    }

    // This action can be done only by owner
    // protoco id will be started from no.1 instead of no.0.
    function addProtocol(address _protocolAddress) external onlyOwner nonReentrant {
        protocolIds.next();
        uint16 lastIdx = uint16(protocolIds.current);

        getProtocol[lastIdx] = Protocol({protocolAddress: _protocolAddress, isBlackList: false});

        getProtocolId[_protocolAddress] = lastIdx;

        emit ProtocolCreated(lastIdx, _protocolAddress);
    }

    function newSalesPolicy(
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent
    ) external onlyOwner nonReentrant returns (address) {
        MockSalesPolicy _salesPolicy = new MockSalesPolicy(address(this), _exchangeAgent, _premiumPool, _capitalAgent, usdcToken);
        salesPolicy = address(_salesPolicy);
        ICapitalAgent(capitalAgent).setPolicy(address(_salesPolicy));

        return address(_salesPolicy);
    }

    function allProtocolsLength() external view returns (uint256) {
        return protocolIds.current;
    }

    function updateCheckIfProtocolInWhitelistArray(bool _status) external onlyOwner {
        checkIfProtocolInWhitelistArray = _status;
        emit LogUpdateCheckIfProtocolInWhitelistArray(_status);
    }

    function setBlackListProtocolById(uint16 _protocolId) external onlyOwner {
        getProtocol[_protocolId].isBlackList = true;
        emit LogSetBlackListProtocol(_protocolId, getProtocol[_protocolId].protocolAddress);
    }

    function setBlackListProtocolByAddress(address _protocol) external onlyOwner {
        // require(_protocol != address(0), "UnoRe: zero address");
        uint16 _protocolId = getProtocolId[_protocol];
        getProtocol[_protocolId].isBlackList = true;
        emit LogSetBlackListProtocol(_protocolId, _protocol);
    }

    function setPremiumPool(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        premiumPool = _premiumPool;
        emit LogSetPremiumPool(_premiumPool);
    }

    function setExchangeAgentInPolicy(address _exchangeAgent) external onlyOwner {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setExchangeAgent(_exchangeAgent);
        emit LogSetExchangeAgentInPolicy(_exchangeAgent);
    }

    function setBuyPolicyMaxDeadlineInPolicy(uint256 _maxDeadline) external onlyOwner {
        ISalesPolicy(salesPolicy).setBuyPolicyMaxDeadline(_maxDeadline);
        emit LogSetBuyPolicyMaxDeadlineInPolicy(_maxDeadline);
    }

    function setPremiumPoolInPolicy(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setPremiumPool(_premiumPool);
        emit LogSetPremiumPoolInPolicy(_premiumPool);
    }

    function setSignerInPolicy(address _signer) external onlyOwner {
        require(_signer != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setSigner(_signer);
        emit LogSetSignerInPolicy(_signer);
    }

    function setCapitalAgentInPolicy(address _capitalAgent) external onlyOwner {
        require(_capitalAgent != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setCapitalAgent(_capitalAgent);
        emit LogSetCapitalAgentInPolicy(_capitalAgent);
    }

    function setProtocolURIInPolicy(string memory _uri) external onlyOwner {
        ISalesPolicy(salesPolicy).setProtocolURI(_uri);
        emit LogSetProtocolURIInPolicy(_uri);
    }

    function approvePremiumInPolicy(address _premiumCurrency) external onlyOwner {
        ISalesPolicy(salesPolicy).approvePremium(_premiumCurrency);
        emit LogApprovePremiumInPolicy(_premiumCurrency);
    }

    function getProtocolData(uint16 _protocolIdx) external view override returns (address protocolAddress, bool isBlackList) {
        return (getProtocol[_protocolIdx].protocolAddress, getProtocol[_protocolIdx].isBlackList);
    }
}
