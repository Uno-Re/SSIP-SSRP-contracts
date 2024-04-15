// SPDX-License-Identifier: GPL-3.0
pragma solidity =0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "../libraries/Counters.sol";
import "../SalesPolicy.sol";
import "../interfaces/ISalesPolicy.sol";
import "../interfaces/ISalesPolicyFactory.sol";

/**
 * @dev Manages and create new salesPolicy contract
 **/
contract SalesPolicyFactory is ISalesPolicyFactory, ReentrancyGuard, Ownable2Step {
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
    }

    /**
     * @dev Add protocol address, This action can be done only by owner
     *  protoco id will be started from no.1 instead of no.0.
     **/
    function addProtocol(address _protocolAddress) external onlyOwner nonReentrant {
        protocolIds.next();
        uint16 lastIdx = uint16(protocolIds.current);

        getProtocol[lastIdx] = Protocol({protocolAddress: _protocolAddress, isBlackList: false});

        getProtocolId[_protocolAddress] = lastIdx;

        emit ProtocolCreated(lastIdx, _protocolAddress);
    }
    
    /**
     * @dev create new SalesPolicy Contract, can only be call by owner
     * @param _exchangeAgent address of the exchange agent for price fetch and exchange
     * @param _premiumPool address of the premium pool to collect premium
     * @param _capitalAgent address of the capital agent
     * @return new SalesPolicy address
     **/
    function newSalesPolicy(
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent
    ) external onlyOwner nonReentrant returns (address) {
        SalesPolicy _salesPolicy = new SalesPolicy(address(this), _exchangeAgent, _premiumPool, _capitalAgent, usdcToken);
        salesPolicy = address(_salesPolicy);
        ICapitalAgent(capitalAgent).setPolicy(address(_salesPolicy));

        return address(_salesPolicy);
    }

    /**
     * @dev return all number protocol added
     **/
    function allProtocolsLength() external view returns (uint256) {
        return protocolIds.current;
    }

    /**
     * @dev update status of bool checkIfProtocolInWhitelistArray, can only be call by owner
     * @param _status bool to set status
     **/
    function updateCheckIfProtocolInWhitelistArray(bool _status) external onlyOwner {
        checkIfProtocolInWhitelistArray = _status;
        emit LogUpdateCheckIfProtocolInWhitelistArray(_status);
    }

    /**
     * @dev set protocol id to black list, can only be call by owner
     * @param _protocolId id of protocol to black list
     **/
    function setBlackListProtocolById(uint16 _protocolId) external onlyOwner {
        getProtocol[_protocolId].isBlackList = true;
        emit LogSetBlackListProtocol(_protocolId, getProtocol[_protocolId].protocolAddress);
    }

    /**
     * @dev set protocol address to black list, can only be call by owner
     * @param _protocol address of protocol to black list
     **/
    function setBlackListProtocolByAddress(address _protocol) external onlyOwner {
        // require(_protocol != address(0), "UnoRe: zero address");
        uint16 _protocolId = getProtocolId[_protocol];
        getProtocol[_protocolId].isBlackList = true;
        emit LogSetBlackListProtocol(_protocolId, _protocol);
    }

    /**
     * @dev set premiumPool address, can only be call by owner
     * @param _premiumPool address of new premiumPool to set
     **/
    function setPremiumPool(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        premiumPool = _premiumPool;
        emit LogSetPremiumPool(_premiumPool);
    }

    /**
     * @dev set ExchangeAgent address in salesPolicy, can only be call by owner
     * @param _exchangeAgent address of new exchangeAgent to set
     **/
    function setExchangeAgentInPolicy(address _exchangeAgent) external onlyOwner {
        ISalesPolicy(salesPolicy).setExchangeAgent(_exchangeAgent);
        emit LogSetExchangeAgentInPolicy(_exchangeAgent);
    }

    /**
     * @dev set max deadline in salesPolicy, can only be call by owner
     * @param _maxDeadline value to set
     **/
    function setBuyPolicyMaxDeadlineInPolicy(uint256 _maxDeadline) external onlyOwner {
        ISalesPolicy(salesPolicy).setBuyPolicyMaxDeadline(_maxDeadline);
        emit LogSetBuyPolicyMaxDeadlineInPolicy(_maxDeadline);
    }

    /**
     * @dev set premiumPool address in salesPolicy, can only be call by owner
     * @param _premiumPool address of new premiumPool to set
     **/
    function setPremiumPoolInPolicy(address _premiumPool) external onlyOwner {
        ISalesPolicy(salesPolicy).setPremiumPool(_premiumPool);
        emit LogSetPremiumPoolInPolicy(_premiumPool);
    }

    /**
     * @dev set signer in salesPolicy, can only be call by owner
     * @param _signer address of new signer to set
     **/
    function setSignerInPolicy(address _signer) external onlyOwner {
        ISalesPolicy(salesPolicy).setSigner(_signer);
        emit LogSetSignerInPolicy(_signer);
    }

    /**
     * @dev set capitalAgent address in salesPolicy, can only be call by owner
     * @param _capitalAgent address of new capitalAgent to set
     **/
    function setCapitalAgentInPolicy(address _capitalAgent) external onlyOwner {
        ISalesPolicy(salesPolicy).setCapitalAgent(_capitalAgent);
        emit LogSetCapitalAgentInPolicy(_capitalAgent);
    }

    /**
     * @dev set protocol uri in salesPolicy, can only be call by owner
     * @param _uri new uri to set
     **/
    function setProtocolURIInPolicy(string memory _uri) external onlyOwner {
        ISalesPolicy(salesPolicy).setProtocolURI(_uri);
        emit LogSetProtocolURIInPolicy(_uri);
    }

    /**
     * @dev approve premiumPool for _premiumCurrency from salesPolicy by max value , can only be call by owner
     * @param _premiumCurrency address of currency to approve
     **/
    function approvePremiumInPolicy(address _premiumCurrency) external onlyOwner {
        ISalesPolicy(salesPolicy).approvePremium(_premiumCurrency);
        emit LogApprovePremiumInPolicy(_premiumCurrency);
    }

    /**
     * @dev return protocol address and is blacklisted
     * @param _protocolIdx id of protocol to get data
     **/
    function getProtocolData(uint16 _protocolIdx) external view override returns (address protocolAddress, bool isBlackList) {
        return (getProtocol[_protocolIdx].protocolAddress, getProtocol[_protocolIdx].isBlackList);
    }

    /**
     * @dev kill salesPolicy, can only be called by owner
     **/
    function killSalesPolicyPool() external onlyOwner {
        ISalesPolicy(salesPolicy).killPool();
    }

    /**
     * @dev revive salesPolicy, can only be called by owner
     **/
    function reviveSalesPolicyPool() external onlyOwner {
        ISalesPolicy(salesPolicy).revivePool();
    }
}
