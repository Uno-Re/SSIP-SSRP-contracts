// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./libraries/Counters.sol";
import "./interfaces/ICapitalAgent.sol";
import "./interfaces/IExchangeAgent.sol";
import "./interfaces/IPremiumPool.sol";
import "./interfaces/ISalesPolicyFactory.sol";
import "./interfaces/ISalesPolicy.sol";
import "./libraries/TransferHelper.sol";
import "./EIP712MetaTransaction.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @dev contract to buy policy
 **/
contract SalesPolicy is EIP712MetaTransaction("BuyPolicyMetaTransaction", "1"), ERC721, ISalesPolicy, ReentrancyGuard, Pausable {
    using Counters for Counters.Counter;
    using ECDSA for bytes32;

    address public immutable factory;
    struct Policy {
        uint256 coverStartAt;
        uint256 coverageDuration;
        uint256 coverageAmount;
        address protocolAddress;
        address premiumCurrency;
        bool exist;
        bool expired;
    }

    uint256 public maxDeadline;
    address private exchangeAgent;
    address public premiumPool;
    address public capitalAgent;
    address public signer;
    address public immutable usdcToken;

    string private protocolURI;

    Counters.Counter private policyIdx;

    mapping(uint256 => Policy) public getPolicy;
    mapping(bytes32 => address) public usedHash;

    uint256 private maxInteger = type(uint256).max;

    event BuyPolicy(
        address indexed _owner,
        address indexed _asset,
        address _premiumCurrency,
        address _protocol,
        uint256 indexed _policyIdx,
        uint256 _coverageAmount,
        uint256 _coverageDuration,
        uint256 _premiumPaid
    );
    event LogSetExchangeAgentInPolicy(address indexed _exchangeAgent, address indexed _policyAddress);
    event LogSetPremiumPoolInPolicy(address indexed _premiumPool, address indexed _policyAddress);
    event LogSetProtocolURIInPolicy(address indexed _policyAddress, string _uri);
    event LogSetSignerInPolicy(address indexed _signer, address indexed _policyAddress);
    event LogSetBuyPolicyMaxDeadlineInPolicy(uint256 _maxDeadline, address indexed _policyAddress);
    event LogSetCapitalAgentInPolicy(address indexed _capitalAgent, address indexed _policyAddress);
    event LogapprovePremiumIInPolicy(address indexed _policyAddress, address indexed _premiumCurrency, address premiumPool);
    event LogMarkToClaim(uint256 indexed _policyId, uint256 _coverageAmount);
    event LogUpdatePolicyExpired(uint256 indexed _policyId, uint256 _coverageAmount);

    constructor(
        address _factory,
        address _exchangeAgent,
        address _premiumPool,
        address _capitalAgent,
        address _usdcToken
    ) ERC721("Policy insurance", "Policy insurance") {
        require(_factory != address(0), "UnoRe: zero factory address");
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_premiumPool != address(0), "UnoRe: zero premiumPool address");
        require(_capitalAgent != address(0), "UnoRe: zero capitalAgent address");
        require(_usdcToken != address(0), "UnoRe: zero USDC address");
        factory = _factory;
        exchangeAgent = _exchangeAgent;
        capitalAgent = _capitalAgent;
        usdcToken = _usdcToken;
        premiumPool = _premiumPool;
        maxDeadline = 7 days;
    }

    modifier onlyFactory() {
        require(msgSender() == factory, "UnoRe: SalesPolicy Forbidden");
        _;
    }

    modifier onlyCapitalAgent() {
        require(msgSender() == capitalAgent, "UnoRe: SalesPolicy Forbidden");
        _;
    }

    function killPool() external onlyFactory {
        _pause();
    }

    function revivePool() external onlyFactory {
        _unpause();
    }

    receive() external payable {}

    /**
     * @dev user can buy policy by paying policy price
     * new policy id will be minted at user address
     * policy id will be claim by user at the time settlement
     * @param _assets address of assets
     * @param _protocols address of protocol for insurance
     * @param _coverageAmount amount of coverage user wants to claim
     * @param _coverageDuration duration after which can not claim policy id
     * @param _policyPriceInUSDC price of policy user wants to pay
     * @param _signedTime signed time
     * @param _premiumCurrency currency to pay
     **/
    function buyPolicy(
        address[] memory _assets,
        address[] memory _protocols,
        uint256[] memory _coverageAmount,
        uint256[] memory _coverageDuration,
        uint256 _policyPriceInUSDC,
        uint256 _signedTime,
        address _premiumCurrency,
        bytes32 r,
        bytes32 s,
        uint8 v,
        uint256 nonce
    ) external payable whenNotPaused nonReentrant {
        uint256 len = _protocols.length;
        require(len > 0, "UnoRe: no policy");
        require(len == _assets.length, "UnoRe: no match protocolIds with assets");
        require(len == _coverageAmount.length, "UnoRe: no match protocolIds with coverageAmount");
        require(len == _coverageDuration.length, "UnoRe: no match protocolIds with coverageDuration");

        address _signer = getSender(
            _policyPriceInUSDC,
            _protocols,
            _coverageDuration,
            _coverageAmount,
            _signedTime,
            _premiumCurrency,
            r,
            s,
            v,
            nonce,
            msg.sender
        );
        require(_signer != address(0) && _signer == signer, "UnoRe: invalid signer");
        require(_signedTime <= block.timestamp && block.timestamp - _signedTime < maxDeadline, "UnoRe: signature expired");

        uint256 premiumPaid;
        if (_premiumCurrency == address(0)) {
            premiumPaid = IExchangeAgent(exchangeAgent).getETHAmountForUSDC(_policyPriceInUSDC);
            require(msg.value >= premiumPaid, "UnoRe: insufficient paid");
            if (msg.value > premiumPaid) {
                TransferHelper.safeTransferETH(msgSender(), msg.value - premiumPaid);
            }
            IPremiumPool(premiumPool).collectPremiumInETH{value: premiumPaid}();
        } else {
            premiumPaid = _premiumCurrency != usdcToken
                ? IExchangeAgent(exchangeAgent).getTokenAmountForUSDC(_premiumCurrency, _policyPriceInUSDC)
                : _policyPriceInUSDC;
            TransferHelper.safeTransferFrom(_premiumCurrency, msgSender(), address(this), premiumPaid);
            IPremiumPool(premiumPool).collectPremium(_premiumCurrency, premiumPaid);
        }

        _buyPolicy(_assets, _protocols, _coverageAmount, _coverageDuration, premiumPaid, _premiumCurrency);
    }

    function _buyPolicy(
        address[] memory _assets,
        address[] memory _protocols,
        uint256[] memory _coverageAmount,
        uint256[] memory _coverageDuration,
        uint256 _premiumPaid,
        address _premiumCurrency
    ) private {
        uint256 _totalCoverage;
        uint256 lastIdx;
        uint256 coverAmount;
        uint256 coverDuration;
        address _protocol;
        address _assetLocked;

        bool checkIfProtocolInWhitelistArray = ISalesPolicyFactory(factory).checkIfProtocolInWhitelistArray();

        for (uint256 ii = 0; ii < _protocols.length; ii++) {
            lastIdx = policyIdx.current;
            coverAmount = _coverageAmount[ii];
            coverDuration = _coverageDuration[ii];
            _protocol = _protocols[ii];
            _assetLocked = _assets[ii];
            uint256 premiumPaid = _premiumPaid;
            bool isAvailableSale = false;
            if (checkIfProtocolInWhitelistArray) {
                uint16 _protocolId = ISalesPolicyFactory(factory).getProtocolId(_protocol);
                if (_protocolId > 0) {
                    (, bool isBlackList) = ISalesPolicyFactory(factory).getProtocolData(_protocolId);
                    if (!isBlackList) {
                        isAvailableSale = true;
                    }
                }
            } else {
                isAvailableSale = true;
            }
            require(isAvailableSale, "UnoRe: unavailable policy");
            getPolicy[lastIdx] = Policy({
                protocolAddress: _protocol,
                coverageAmount: coverAmount,
                coverageDuration: coverDuration,
                coverStartAt: block.timestamp,
                premiumCurrency: _premiumCurrency,
                exist: true,
                expired: false
            });

            _mint(msgSender(), lastIdx);

            _totalCoverage += coverAmount;

            emit BuyPolicy(
                msgSender(),
                _assetLocked,
                _premiumCurrency,
                _protocol,
                lastIdx,
                coverAmount,
                coverDuration,
                premiumPaid
            );
            policyIdx.next();
        }
        if (_totalCoverage > 0) {
            ICapitalAgent(capitalAgent).policySale(_totalCoverage);
        }
    }

    /**
     * @dev approve premiumPool for _premiumCurrency from salesPolicy by max value , can only be call by SalesPolicyFactory
     * @param _premiumCurrency address of currency to approve
     **/
    function approvePremium(address _premiumCurrency) external override onlyFactory {
        require(_premiumCurrency != address(0), "UnoRe: zero address");
        require(premiumPool != address(0), "UnoRe: not defiend premiumPool");
        TransferHelper.safeApprove(_premiumCurrency, premiumPool, maxInteger);
        emit LogapprovePremiumIInPolicy(address(this), _premiumCurrency, premiumPool);
    }

    /**
     * @dev set protocol uri, can only be call by SalesPolicyFactory
     * @param newURI new uri to set
     **/
    function setProtocolURI(string memory newURI) external override onlyFactory {
        protocolURI = newURI;
        emit LogSetProtocolURIInPolicy(address(this), newURI);
    }

    /**
     * @dev set premiumPool address, can only be call by SalesPolicyFactory
     * @param _premiumPool address of new premiumPool to set
     **/
    function setPremiumPool(address _premiumPool) external override onlyFactory {
        require(_premiumPool != address(0), "UnoRe: zero address");
        premiumPool = _premiumPool;
        emit LogSetPremiumPoolInPolicy(_premiumPool, address(this));
    }

    /**
     * @dev set ExchangeAgent address, can only be call by SalesPolicyFactory
     * @param _exchangeAgent address of new exchangeAgent to set
     **/
    function setExchangeAgent(address _exchangeAgent) external override onlyFactory {
        require(_exchangeAgent != address(0), "UnoRe: zero address");
        exchangeAgent = _exchangeAgent;
        emit LogSetExchangeAgentInPolicy(_exchangeAgent, address(this));
    }

    /**
     * @dev set signer, can only be call by SalesPolicyFactory
     * @param _signer address of new signer to set
     **/
    function setSigner(address _signer) external override onlyFactory {
        require(_signer != address(0), "UnoRe: zero address");
        signer = _signer;
        emit LogSetSignerInPolicy(_signer, address(this));
    }

    /**
     * @dev set capitalAgent address, can only be call by SalesPolicyFactory
     * @param _capitalAgent address of new capitalAgent to set
     **/
    function setCapitalAgent(address _capitalAgent) external override onlyFactory {
        require(_capitalAgent != address(0), "UnoRe: zero address");
        capitalAgent = _capitalAgent;
        emit LogSetCapitalAgentInPolicy(_capitalAgent, address(this));
    }

    /**
     * @dev set max deadline, can only be call by SalesPolicyFactory
     * @param _maxDeadline value to set
     **/
    function setBuyPolicyMaxDeadline(uint256 _maxDeadline) external override onlyFactory {
        require(_maxDeadline > 0, "UnoRe: zero max signedTime");
        maxDeadline = _maxDeadline;
        emit LogSetBuyPolicyMaxDeadlineInPolicy(_maxDeadline, address(this));
    }

    /**
     * @dev update policy to claim(not exist), set policy exist to false, can only be call by CapitalAgent
     * @param _policyId id policy to mark claim
     **/
    function markToClaim(uint256 _policyId) external override nonReentrant onlyCapitalAgent {
        require(getPolicy[_policyId].exist, "UnoRe: marked to claim already");
        require(!getPolicy[_policyId].expired, "UnoRe: policy expired");
        getPolicy[_policyId].exist = false;
        _burn(_policyId);
        emit LogMarkToClaim(_policyId, getPolicy[_policyId].coverageAmount);
    }

    /**
     * @dev update policy to expired, set policy expired to true, can only be call by CapitalAgent
     * @param _policyId id policy to mark expired
     **/
    function updatePolicyExpired(uint256 _policyId) external override nonReentrant onlyCapitalAgent {
        require(getPolicy[_policyId].exist, "UnoRe: marked to claim already");
        getPolicy[_policyId].expired = true;
        _burn(_policyId);
        emit LogUpdatePolicyExpired(_policyId, getPolicy[_policyId].coverageAmount);
    }

    /**
     * @dev return current policy index
     **/
    function allPoliciesLength() external view override returns (uint256) {
        return policyIdx.current;
    }

    function _baseURI() internal view override returns (string memory) {
        return protocolURI;
    }

    /**
     * @dev return policy data corresponds to _policyId
     **/
    function getPolicyData(uint256 _policyId) external view override returns (uint256, uint256, uint256, bool, bool) {
        bool exist = getPolicy[_policyId].exist;
        bool expired = getPolicy[_policyId].expired;
        uint256 coverageAmount = getPolicy[_policyId].coverageAmount;
        uint256 coverageDuration = getPolicy[_policyId].coverageDuration;
        uint256 coverStartAt = uint256(getPolicy[_policyId].coverStartAt);
        return (coverageAmount, coverageDuration, coverStartAt, exist, expired);
    }

    /**
     * @dev return sender address from corresponding message data
     **/
    function getSender(
        uint256 _policyPrice,
        address[] memory _protocols,
        uint256[] memory _coverageDuration,
        uint256[] memory _coverageAmount,
        uint256 _signedTime,
        address _premiumCurrency,
        bytes32 r,
        bytes32 s,
        uint8 v,
        uint256 nonce,
        address sender
    ) private returns (address) {
        // bytes32 digest = getSignedMsgHash(productName, priceInUSD, period, conciergePrice);
        bytes32 msgHash = keccak256(
            abi.encodePacked(
                _policyPrice,
                _protocols,
                _coverageDuration,
                _coverageAmount,
                _signedTime,
                _premiumCurrency,
                nonce,
                sender,
                block.chainid
            )
        );

        require(usedHash[msgHash] == address(0), "Already used hash");

        usedHash[msgHash] = sender;

        // bytes32 msgHash = keccak256(abi.encodePacked(productName));
        bytes32 digest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        // (bytes32 r, bytes32 s, uint8 v) = splitSignature(sig);
        address recoveredAddress = digest.recover(v, r, s);
        return recoveredAddress;
    }
}
