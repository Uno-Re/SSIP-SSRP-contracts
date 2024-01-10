// SPDX-License-Identifier: GPL-3.0

pragma solidity =0.8.23;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IExchangeAgent.sol";
import "./libraries/TransferHelper.sol";
import "./interfaces/IPremiumPool.sol";
import "./interfaces/IGnosisSafe.sol";

contract PremiumPool is IPremiumPool, ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    // using Address for address;
    address public exchangeAgent;
    address public unoToken;
    address public usdcToken;
    mapping(address => bool) public availableCurrencies;
    address[] public availableCurrencyList;
    mapping(address => bool) public whiteList;

    bool public killed;
    address public constant BURNADDRESS = 0x000000000000000000000000000000000000dEaD;
    mapping(address => uint256) public ssrpPremium;
    mapping(address => uint256) public ssipPremium;
    mapping(address => uint256) public backBurnUnoPremium;
    uint256 public ssrpPremiumEth;
    uint256 public ssipPremiumEth;
    uint256 public backBurnPremiumEth;

    uint256 private maxInteger = type(uint256).max;

    event PremiumWithdraw(address indexed _currency, address indexed _to, uint256 _amount);
    event LogBuyBackAndBurn(address indexed _operator, address indexed _premiumPool, uint256 _unoAmount);
    event LogCollectPremium(address indexed _from, address _premiumCurrency, uint256 _premiumAmount);
    event LogDepositToSyntheticSSRPRewarder(address indexed _rewarder, uint256 _amountDeposited);
    event LogDepositToSyntheticSSIPRewarder(address indexed _rewarder, address indexed _currency, uint256 _amountDeposited);
    event LogAddCurrency(address indexed _premiumPool, address indexed _currency);
    event LogRemoveCurrency(address indexed _premiumPool, address indexed _currency);
    event LogMaxApproveCurrency(address indexed _premiumPool, address indexed _currency, address indexed _to);
    event LogMaxDestroyCurrencyAllowance(address indexed _premiumPool, address indexed _currency, address indexed _to);
    event LogAddWhiteList(address indexed _premiumPool, address indexed _whiteListAddress);
    event LogRemoveWhiteList(address indexed _premiumPool, address indexed _whiteListAddress);
    event PoolAlived(address indexed _owner, bool _alive);

    constructor(address _exchangeAgent, address _unoToken, address _usdcToken, address _multiSigWallet, address _governance) {
        require(_exchangeAgent != address(0), "UnoRe: zero exchangeAgent address");
        require(_unoToken != address(0), "UnoRe: zero UNO address");
        require(_usdcToken != address(0), "UnoRe: zero USDC address");
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        require(IGnosisSafe(_multiSigWallet).getOwners().length > 3, "UnoRe: more than three owners requied");
        require(IGnosisSafe(_multiSigWallet).getThreshold() > 1, "UnoRe: more than one owners requied to verify");
        exchangeAgent = _exchangeAgent;
        unoToken = _unoToken;
        usdcToken = _usdcToken;
        whiteList[msg.sender] = true;
        _grantRole(ADMIN_ROLE, _multiSigWallet);
        _grantRole(GOVERNANCE_ROLE, _governance);
        _setRoleAdmin(GOVERNANCE_ROLE, ADMIN_ROLE);
        _setRoleAdmin(ADMIN_ROLE, ADMIN_ROLE);
    }

    modifier onlyAvailableCurrency(address _currency) {
        require(availableCurrencies[_currency], "UnoRe: not allowed currency");
        _;
    }

    modifier onlyWhiteList() {
        require(whiteList[msg.sender], "UnoRe: not white list address");
        _;
    }

    modifier isAlive() {
        require(!killed, "UnoRe: pool is killed");
        _;
    }

    receive() external payable {}

    function pausePool() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpausePool() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function killPool() external onlyRole(ADMIN_ROLE) {
        killed = true;
        emit PoolAlived(msg.sender, true);
    }

    function revivePool() external onlyRole(ADMIN_ROLE) {
        killed = false;
        emit PoolAlived(msg.sender, false);
    }

    function collectPremiumInETH() external payable override isAlive nonReentrant onlyWhiteList {
        uint256 _premiumAmount = msg.value;
        uint256 _premium_SSRP = (_premiumAmount * 1000) / 10000;
        uint256 _premium_SSIP = (_premiumAmount * 7000) / 10000;
        ssrpPremiumEth = ssrpPremiumEth + _premium_SSRP;
        ssipPremiumEth = ssipPremiumEth + _premium_SSIP;
        backBurnPremiumEth = backBurnPremiumEth + (_premiumAmount - _premium_SSRP - _premium_SSIP);
        emit LogCollectPremium(msg.sender, address(0), _premiumAmount);
    }

    function collectPremium(
        address _premiumCurrency,
        uint256 _premiumAmount
    ) external override isAlive nonReentrant onlyAvailableCurrency(_premiumCurrency) onlyWhiteList {
        require(IERC20(_premiumCurrency).balanceOf(msg.sender) >= _premiumAmount, "UnoRe: premium balance overflow");
        TransferHelper.safeTransferFrom(_premiumCurrency, msg.sender, address(this), _premiumAmount);
        uint256 _premium_SSRP = (_premiumAmount * 1000) / 10000;
        uint256 _premium_SSIP = (_premiumAmount * 7000) / 10000;
        ssrpPremium[_premiumCurrency] = ssrpPremium[_premiumCurrency] + _premium_SSRP;
        ssipPremium[_premiumCurrency] = ssipPremium[_premiumCurrency] + _premium_SSIP;
        backBurnUnoPremium[_premiumCurrency] =
            backBurnUnoPremium[_premiumCurrency] +
            (_premiumAmount - _premium_SSRP - _premium_SSIP);
        emit LogCollectPremium(msg.sender, _premiumCurrency, _premiumAmount);
    }

    function depositToSyntheticSSRPRewarder(address _rewarder) external onlyRole(ADMIN_ROLE) isAlive nonReentrant {
        require(_rewarder != address(0), "UnoRe: zero address");
        enforceHasContractCode(_rewarder, "UnoRe: no contract address");
        uint256 usdcAmountToDeposit = 0;
        if (ssrpPremiumEth > 0) {
            TransferHelper.safeTransferETH(exchangeAgent, ssrpPremiumEth);
            uint256 convertedAmount = IExchangeAgent(exchangeAgent).convertForToken(address(0), usdcToken, ssrpPremiumEth);
            usdcAmountToDeposit += convertedAmount;
            ssrpPremiumEth = 0;
        }
        for (uint256 ii = 0; ii < availableCurrencyList.length; ii++) {
            if (ssrpPremium[availableCurrencyList[ii]] > 0) {
                if (availableCurrencyList[ii] == usdcToken) {
                    usdcAmountToDeposit += ssrpPremium[availableCurrencyList[ii]];
                } else {
                    uint256 convertedUSDCAmount = IExchangeAgent(exchangeAgent).convertForToken(
                        availableCurrencyList[ii],
                        usdcToken,
                        ssrpPremium[availableCurrencyList[ii]]
                    );
                    usdcAmountToDeposit += convertedUSDCAmount;
                }
                ssrpPremium[availableCurrencyList[ii]] = 0;
            }
        }
        if (usdcAmountToDeposit > 0) {
            TransferHelper.safeTransfer(usdcToken, _rewarder, usdcAmountToDeposit);
            emit LogDepositToSyntheticSSRPRewarder(_rewarder, usdcAmountToDeposit);
        }
    }

    function depositToSyntheticSSIPRewarder(
        address _currency,
        address _rewarder,
        uint256 _amount
    ) external onlyRole(ADMIN_ROLE) isAlive nonReentrant {
        require(_rewarder != address(0), "UnoRe: zero address");
        enforceHasContractCode(_rewarder, "UnoRe: no contract address");
        if (_currency == address(0) && ssipPremiumEth > 0) {
            require(_amount <= ssipPremiumEth, "UnoRe: premium balance overflow");
            TransferHelper.safeTransferETH(_rewarder, _amount);
            ssipPremiumEth -= _amount;
            emit LogDepositToSyntheticSSIPRewarder(_rewarder, _currency, _amount);
        } else {
            if (availableCurrencies[_currency] && ssipPremium[_currency] > 0) {
                require(_amount <= ssipPremium[_currency], "UnoRe: premium balance overflow");
                TransferHelper.safeTransfer(_currency, _rewarder, _amount);
                ssipPremium[_currency] -= _amount;
                emit LogDepositToSyntheticSSIPRewarder(_rewarder, _currency, _amount);
            }
        }
    }

    function buyBackAndBurn() external onlyRole(ADMIN_ROLE) isAlive {
        uint256 unoAmount = 0;
        if (backBurnPremiumEth > 0) {
            TransferHelper.safeTransferETH(exchangeAgent, backBurnPremiumEth);
            unoAmount += IExchangeAgent(exchangeAgent).convertForToken(address(0), unoToken, backBurnPremiumEth);
            backBurnPremiumEth = 0;
        }
        for (uint256 ii = 0; ii < availableCurrencyList.length; ii++) {
            if (backBurnUnoPremium[availableCurrencyList[ii]] > 0) {
                uint256 convertedAmount = IExchangeAgent(exchangeAgent).convertForToken(
                    availableCurrencyList[ii],
                    unoToken,
                    backBurnUnoPremium[availableCurrencyList[ii]]
                );
                unoAmount += convertedAmount;
                backBurnUnoPremium[availableCurrencyList[ii]] = 0;
            }
        }
        if (unoAmount > 0) {
            TransferHelper.safeTransfer(unoToken, BURNADDRESS, unoAmount);
        }
        emit LogBuyBackAndBurn(msg.sender, address(this), unoAmount);
    }

    function withdrawPremium(
        address _currency,
        address _to,
        uint256 _amount
    ) external override onlyRole(GOVERNANCE_ROLE) whenNotPaused {
        require(_to != address(0), "UnoRe: zero address");
        require(_amount > 0, "UnoRe: zero amount");
        if (_currency == address(0)) {
            require(address(this).balance >= _amount, "UnoRe: Insufficient Premium");
            TransferHelper.safeTransferETH(_to, _amount);
        } else {
            require(IERC20(_currency).balanceOf(address(this)) >= _amount, "UnoRe: Insufficient Premium");
            TransferHelper.safeTransfer(_currency, _to, _amount);
        }
        emit PremiumWithdraw(_currency, _to, _amount);
    }

    function addCurrency(address _currency) external onlyRole(ADMIN_ROLE) {
        require(!availableCurrencies[_currency], "Already available");
        availableCurrencies[_currency] = true;
        availableCurrencyList.push(_currency);
        maxApproveCurrency(_currency, exchangeAgent);
        emit LogAddCurrency(address(this), _currency);
    }

    function removeCurrency(address _currency) external onlyRole(ADMIN_ROLE) {
        require(availableCurrencies[_currency], "Not available yet");
        availableCurrencies[_currency] = false;
        uint256 len = availableCurrencyList.length;
        address lastCurrency = availableCurrencyList[len - 1];
        for (uint256 ii = 0; ii < len; ii++) {
            if (_currency == availableCurrencyList[ii]) {
                availableCurrencyList[ii] = lastCurrency;
                availableCurrencyList.pop();
                destroyCurrencyAllowance(_currency, exchangeAgent);
                emit LogRemoveCurrency(address(this), _currency);
                return;
            }
        }
    }

    function maxApproveCurrency(address _currency, address _to) public onlyRole(ADMIN_ROLE) nonReentrant {
        if (IERC20(_currency).allowance(address(this), _to) < maxInteger) {
            TransferHelper.safeApprove(_currency, _to, maxInteger);
            emit LogMaxApproveCurrency(address(this), _currency, _to);
        }
    }

    function destroyCurrencyAllowance(address _currency, address _to) public onlyRole(ADMIN_ROLE) nonReentrant {
        if (IERC20(_currency).allowance(address(this), _to) > 0) {
            TransferHelper.safeApprove(_currency, _to, 0);
            emit LogMaxDestroyCurrencyAllowance(address(this), _currency, _to);
        }
    }

    function addWhiteList(address _whiteListAddress) external onlyRole(ADMIN_ROLE) {
        require(_whiteListAddress != address(0), "UnoRe: zero address");
        require(!whiteList[_whiteListAddress], "UnoRe: white list already");
        whiteList[_whiteListAddress] = true;
        emit LogAddWhiteList(address(this), _whiteListAddress);
    }

    function removeWhiteList(address _whiteListAddress) external onlyRole(ADMIN_ROLE) {
        require(_whiteListAddress != address(0), "UnoRe: zero address");
        require(whiteList[_whiteListAddress], "UnoRe: white list removed or unadded already");
        whiteList[_whiteListAddress] = false;
        emit LogRemoveWhiteList(address(this), _whiteListAddress);
    }

    /**
     * @dev Ensure that the given address has contract code deployed
     * @param _contract The address to check for contract code
     * @param _errorMessage The error message to display if the contract code is not deployed
     */
    function enforceHasContractCode(address _contract, string memory _errorMessage) internal view {
        uint256 contractSize;
        assembly {
            contractSize := extcodesize(_contract)
        }
        require(contractSize != 0, _errorMessage);
    }
}
