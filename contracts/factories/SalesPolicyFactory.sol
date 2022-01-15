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
        bool exist; // initial true
    }

    address public premiumPool;
    address public owner;
    address public exchangeAgent;
    address public capitalAgent;

    address public salesPolicy;

    mapping(uint16 => Protocol) public getProtocol;
    Counters.Counter private protocolIds;

    address public USDC_TOKEN;

    event ProtocolCreated(uint16 _protocolIdx);
    event LogSetProtocolMCR(uint16 _protocolIdx, uint256 _mcr);
    event LogSetPremiumPool(address indexed _premiumPool);

    constructor(
        address _owner,
        address _usdcToken,
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent
    ) {
        require(_owner != address(0), "UnoRe: zero owner address");
        require(_usdcToken != address(0), "UnoRe: zero USDC address");
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_premiumPool != address(0), "UnoRe: zero premiumPool address");
        require(_capitalAgent != address(0), "UnoRe: zero capitalAgent address");
        USDC_TOKEN = _usdcToken;
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

        getProtocol[lastIdx] = Protocol({
            name: _name,
            coverDuration: _coverDuration,
            mcr: 1,
            protocolAddress: _protocolAddress,
            protocolCurrency: currency,
            productType: _productType,
            premiumDescription: _premiumDescription,
            exist: true
        });

        protocolIds.increment();
        emit ProtocolCreated(lastIdx);
    }

    function newSalesPolicy(
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent
    ) external onlyOwner nonReentrant returns (address) {
        SalesPolicy _salesPolicy = new SalesPolicy(address(this), _exchangeAgent, _premiumPool, _capitalAgent, USDC_TOKEN);
        salesPolicy = address(_salesPolicy);
        ICapitalAgent(capitalAgent).setPolicy(address(_salesPolicy));

        return address(_salesPolicy);
    }

    function allProtocolsLength() external view returns (uint256) {
        return protocolIds.current();
    }

    function setPremiumPool(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        premiumPool = _premiumPool;
        emit LogSetPremiumPool(_premiumPool);
    }

    function setExchangeAgentInPolicy(address _exchangeAgent) external onlyOwner {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setExchangeAgent(_exchangeAgent);
    }

    function setBuyPolicyMaxDeadlineInPolicy(uint256 _maxDeadline) external onlyOwner {
        require(_maxDeadline > 0, "UnoRe: zero max deadline");
        ISalesPolicy(salesPolicy).setBuyPolicyMaxDeadline(_maxDeadline);
    }

    function setPremiumPoolInPolicy(address _premiumPool) external onlyOwner {
        require(_premiumPool != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setPremiumPool(_premiumPool);
    }

    function setProtocolMCR(uint16 _protocolIdx, uint256 _mcr) external onlyOwner {
        require(_mcr > 0, "UnoRe: zero mcr");
        Protocol storage _protocol = getProtocol[_protocolIdx];
        _protocol.mcr = _mcr;
        emit LogSetProtocolMCR(_protocolIdx, _mcr);
    }

    function setSignerInPolicy(address _signer) external onlyOwner {
        require(_signer != address(0), "UnoRe: zero address");
        ISalesPolicy(salesPolicy).setSigner(_signer);
    }

    function setProtocolURIInPolicy(string memory _uri) external onlyOwner {
        ISalesPolicy(salesPolicy).setProtocolURI(_uri);
    }

    function approvePremiumInPolicy(address _premiumCurrency) external onlyOwner {
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
