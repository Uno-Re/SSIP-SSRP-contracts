// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "../SalesPolicy.sol";
import "../interfaces/ISalesPolicy.sol";
import "../interfaces/ISalesPolicyFactory.sol";

contract SalesPolicyFactory is ISalesPolicyFactory, ReentrancyGuard {
    using Counters for Counters.Counter;
    // It should be okay if Protocol is struct
    struct Protocol {
        uint256 coverDuration; // Duration of the protocol cover products
        uint256 mcr; // Maximum Capital Requirement Ratio of that protocol
        address protocolAddress; // Address of that protocol
        address protocolCurrency;
        string name; // protocol name
        string productType; // Type of product i.e. Wallet insurance, smart contract bug insurance, etc.
        string premiumDescription;
        address salesPolicy;
        bool exist; // initial true
    }

    address public premiumPool;
    address public owner;
    address public exchangeAgent;
    address public capitalAgent;

    mapping(uint16 => Protocol) public getProtocol;
    Counters.Counter private protocolIds;

    address public USDT_TOKEN;
    address public UNO_TOKEN;

    event ProtocolCreated(address indexed _salesPolicy, uint16 _protocolIdx);
    event LogSetProtocolMCR(uint16 _protocolIdx, uint256 _mcr);
    event LogSetPremiumPool(address indexed _premiumPool);

    constructor(
        address _owner,
        address _usdt_token,
        address _uno_token,
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent
    ) {
        USDT_TOKEN = _usdt_token;
        UNO_TOKEN = _uno_token;
        owner = _owner;
        premiumPool = _premiumPool;
        exchangeAgent = _exchangeAgent;
        capitalAgent = _capitalAgent;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "UnoRe: Forbidden");
        _;
    }

    // This action can be done only by SSIP owner
    function addProtocol(
        string calldata _name,
        string calldata _productType,
        string calldata _premiumDescription,
        uint256 _coverDuration,
        address _protocolAddress,
        address _protocolCurrency
    ) external onlyOwner nonReentrant {
        uint16 lastIdx = uint16(protocolIds.current());
        address currency = _protocolCurrency;
        address _salesPolicy = newSalesPolicy(lastIdx, exchangeAgent, premiumPool, capitalAgent, "");
        ICapitalAgent(capitalAgent).addPolicy(_salesPolicy);

        getProtocol[lastIdx] = Protocol({
            name: _name,
            coverDuration: _coverDuration,
            mcr: 1,
            protocolAddress: _protocolAddress,
            protocolCurrency: currency,
            productType: _productType,
            premiumDescription: _premiumDescription,
            salesPolicy: _salesPolicy,
            exist: true
        });

        protocolIds.increment();
        emit ProtocolCreated(_salesPolicy, lastIdx);
    }

    function newSalesPolicy(
        uint16 _protocolIdx,
        address _twapPriceFeed,
        address _premiumPool,
        address _capitalAgent,
        string memory _protocolURI
    ) private returns (address) {
        SalesPolicy _salesPolicy = new SalesPolicy(
            address(this),
            _twapPriceFeed,
            _premiumPool,
            _capitalAgent,
            UNO_TOKEN,
            USDT_TOKEN,
            _protocolURI,
            _protocolIdx
        );
        address _salesPolicyAddr = address(_salesPolicy);

        return _salesPolicyAddr;
    }

    function allProtocolsLength() external view returns (uint256) {
        return protocolIds.current();
    }

    function setPremiumPool(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        premiumPool = _premiumPool;
        emit LogSetPremiumPool(_premiumPool);
    }

    function setExchangeAgentInPolicy(uint16 _protocolIdx, address _exchangeAgent) external onlyOwner {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        address salesPolicy = getProtocol[_protocolIdx].salesPolicy;
        ISalesPolicy(salesPolicy).setExchangeAgent(_exchangeAgent);
    }

    function setBuyPolicyMaxDeadlineInPolicy(uint16 _protocolIdx, uint256 _maxDeadline) external onlyOwner {
        require(_maxDeadline > 0, "UnoRe: zero max deadline");
        address salesPolicy = getProtocol[_protocolIdx].salesPolicy;
        ISalesPolicy(salesPolicy).setBuyPolicyMaxDeadline(_maxDeadline);
    }

    function setPremiumPoolInPolicy(uint16 _protocolIdx, address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        address salesPolicy = getProtocol[_protocolIdx].salesPolicy;
        ISalesPolicy(salesPolicy).setPremiumPool(_premiumPool);
    }

    function setProtocolMCR(uint16 _protocolIdx, uint256 _mcr) external onlyOwner {
        require(_mcr > 0, "UnoRe: zero mcr");
        Protocol storage _protocol = getProtocol[_protocolIdx];
        _protocol.mcr = _mcr;
        emit LogSetProtocolMCR(_protocolIdx, _mcr);
    }

    function setProtocolURIInPolicy(uint16 _protocolIdx, string memory _uri) external onlyOwner {
        address salesPolicy = getProtocol[_protocolIdx].salesPolicy;
        ISalesPolicy(salesPolicy).setProtocolURI(_uri);
    }

    function approvePremiumInPolicy(uint16 _protocolIdx, address _premiumCurrency) external onlyOwner {
        address salesPolicy = getProtocol[_protocolIdx].salesPolicy;
        ISalesPolicy(salesPolicy).approvePremium(_premiumCurrency);
    }

    function getProtocolData(uint16 _protocolIdx)
        external
        view
        override
        returns (
            string memory protocolName,
            string memory productType,
            address protocolAddress
        )
    {
        return (getProtocol[_protocolIdx].name, getProtocol[_protocolIdx].productType, getProtocol[_protocolIdx].protocolAddress);
    }
}
