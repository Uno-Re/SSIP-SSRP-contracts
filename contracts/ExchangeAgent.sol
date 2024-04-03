// SPDX-License-Identifier: MIT
pragma solidity =0.8.23;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
//import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

import "./interfaces/IOraclePriceFeed.sol";
import "./interfaces/IExchangeAgent.sol";
import "./libraries/TransferHelper.sol";

contract ExchangeAgent is IExchangeAgent, ReentrancyGuard, Ownable2Step, Pausable {
    address public immutable override usdcToken;
    address public immutable UNISWAP_FACTORY_V3;
    address public immutable UNISWAP_ROUTER_V3;
    address public immutable WETH;
    address public oraclePriceFeed;
    uint256 public slippage;
    uint256 private constant SLIPPAGE_PRECISION = 100;
    uint256 public swapDeadline;

    mapping(address => bool) public whiteList;

    event ConvertedTokenToToken(
        address indexed _dexAddress,
        address indexed _convertToken,
        address indexed _convertedToken,
        uint256 _convertAmount,
        uint256 _desiredAmount,
        uint256 _convertedAmount
    );

    event ConvertedTokenToETH(
        address indexed _dexAddress,
        address indexed _convertToken,
        uint256 _convertAmount,
        uint256 _desiredAmount,
        uint256 _convertedAmount
    );

    event LogAddWhiteList(address indexed _exchangeAgent, address indexed _whiteListAddress);
    event LogRemoveWhiteList(address indexed _exchangeAgent, address indexed _whiteListAddress);
    event LogSetSlippage(address indexed _exchangeAgent, uint256 _slippage);
    event LogSetOraclePriceFeed(address indexed _exchangeAgent, address indexed _oraclePriceFeed);

    constructor(
        address _usdcToken,
        address _WETH,
        address _oraclePriceFeed,
        address _uniswapRouter,
        address _uniswapFactory,
        address _multiSigWallet,
        uint256 _swapDeadline
    ) Ownable(_multiSigWallet) {
        require(_usdcToken != address(0), "UnoRe: zero USDC address");
        require(_uniswapRouter != address(0), "UnoRe: zero uniswapRouter address");
        require(_uniswapFactory != address(0), "UnoRe: zero uniswapFactory address");
        require(_WETH != address(0), "UnoRe: zero WETH address");
        require(_multiSigWallet != address(0), "UnoRe: zero multisigwallet address");
        usdcToken = _usdcToken;
        UNISWAP_FACTORY_V3 = _uniswapFactory;
        UNISWAP_ROUTER_V3 = _uniswapRouter;
        WETH = _WETH;
        oraclePriceFeed = _oraclePriceFeed;
        whiteList[msg.sender] = true;
        slippage = 5 * SLIPPAGE_PRECISION;
        swapDeadline = _swapDeadline;
    }

    modifier onlyWhiteList() {
        require(whiteList[msg.sender], "UnoRe: ExchangeAgent Forbidden");
        _;
    }

    receive() external payable {}

    function killPool() external onlyOwner {
        _pause();
    }

    function revivePool() external onlyOwner {
        _unpause();
    }

    function setSwapDeadline(uint256 _swapDeadline) external onlyOwner {
        swapDeadline = _swapDeadline;
    }

    /**
     * @dev add address to whiteListed Address, can only be called by owner
     * @param _whiteListAddress address to white list
     */
    function addWhiteList(address _whiteListAddress) external onlyOwner {
        require(_whiteListAddress != address(0), "UnoRe: zero address");
        require(!whiteList[_whiteListAddress], "UnoRe: white list already");
        whiteList[_whiteListAddress] = true;
        emit LogAddWhiteList(address(this), _whiteListAddress);
    }

    /**
     * @dev remove address from whiteListed Address, can only be called by owner
     * @param _whiteListAddress address to remove from white list
     */
    function removeWhiteList(address _whiteListAddress) external onlyOwner {
        require(_whiteListAddress != address(0), "UnoRe: zero address");
        require(whiteList[_whiteListAddress], "UnoRe: white list removed or unadded already");
        whiteList[_whiteListAddress] = false;
        emit LogRemoveWhiteList(address(this), _whiteListAddress);
    }

    /**
     * @dev set slippage, can only be called by owner
     */
    function setSlippage(uint256 _slippage) external onlyOwner {
        require(_slippage > 0, "UnoRe: zero slippage");
        require(_slippage < 100, "UnoRe: 100% slippage overflow");
        slippage = _slippage * SLIPPAGE_PRECISION;
        emit LogSetSlippage(address(this), _slippage);
    }

    /**
     * @dev set oracle price feed, can only be called by owner
     */
    function setOraclePriceFeed(address _oraclePriceFeed) external onlyOwner {
        require(_oraclePriceFeed != address(0), "UnoRe: zero address");
        oraclePriceFeed = _oraclePriceFeed;
        emit LogSetOraclePriceFeed(address(this), oraclePriceFeed);
    }

    // estimate token amount for amount in USDC
    function getTokenAmountForUSDC(address _token, uint256 _usdtAmount) external view override returns (uint256) {
        return _getNeededTokenAmount(usdcToken, _token, _usdtAmount);
    }

    // estimate ETH amount for amount in USDC
    function getETHAmountForUSDC(uint256 _usdtAmount) external view override returns (uint256) {
        uint256 ethPrice = IOraclePriceFeed(oraclePriceFeed).getAssetEthPrice(usdcToken);
        uint256 tokenDecimal = IERC20Metadata(usdcToken).decimals();
        return (_usdtAmount * ethPrice) / (10 ** tokenDecimal);
    }

    // estimate ETH amount for amount in _token
    function getETHAmountForToken(address _token, uint256 _tokenAmount) public view override returns (uint256) {
        uint256 ethPrice = IOraclePriceFeed(oraclePriceFeed).getAssetEthPrice(_token);
        uint256 tokenDecimal = IERC20Metadata(_token).decimals();
        return (_tokenAmount * ethPrice) / (10 ** tokenDecimal);
    }

    // estimate token amount for amount in _token
    function getTokenAmountForETH(address _token, uint256 _ethAmount) public view override returns (uint256) {
        uint256 ethPrice = IOraclePriceFeed(oraclePriceFeed).getAssetEthPrice(_token);
        uint256 tokenDecimal = IERC20Metadata(_token).decimals();
        return (_ethAmount * (10 ** tokenDecimal)) / ethPrice;
    }

    /**
     * @dev Get expected _token1 amount for _inputAmount of _token0
     * _desiredAmount should consider decimals based on _token1,
     */
    function getNeededTokenAmount(
        address _token0,
        address _token1,
        uint256 _token0Amount
    ) external view override returns (uint256) {
        return _getNeededTokenAmount(_token0, _token1, _token0Amount);
    }

    /**
     * @dev convert expected _token1 amount for _inputAmount of _token0
     * _desiredAmount should consider decimals based on _token1,
     * only whitlisted address can call this function
     */
    function convertForToken(
        address _token0,
        address _token1,
        uint256 _token0Amount
    ) external override onlyWhiteList whenNotPaused nonReentrant returns (uint256) {
        uint256 twapPrice = 0;
        if (_token0 != address(0)) {
            require(IERC20(_token0).balanceOf(msg.sender) > 0, "UnoRe: zero balance");
            TransferHelper.safeTransferFrom(_token0, msg.sender, address(this), _token0Amount);
            twapPrice = _getNeededTokenAmount(_token0, _token1, _token0Amount);
        } else {
            twapPrice = getTokenAmountForETH(_token1, _token0Amount);
        }
        require(twapPrice > 0, "UnoRe: no pairs");
        uint256 desiredAmount = (twapPrice * (100 * SLIPPAGE_PRECISION - slippage)) / 100 / SLIPPAGE_PRECISION;

        uint256 convertedAmount = _convertTokenForToken(UNISWAP_ROUTER_V3, _token0, _token1, _token0Amount, desiredAmount);
        return convertedAmount;
    }

    /**
     * @dev convert expected eth amount for _inputAmount of _token
     * only whitlisted address can call this function
     */
    function convertForETH(
        address _token,
        uint256 _convertAmount
    ) external override onlyWhiteList whenNotPaused nonReentrant returns (uint256) {
        require(IERC20(_token).balanceOf(msg.sender) > 0, "UnoRe: zero balance");
        if (_token != address(0)) {
            TransferHelper.safeTransferFrom(_token, msg.sender, address(this), _convertAmount);
        }
        uint256 twapPriceInUSDC = getETHAmountForToken(_token, _convertAmount);
        require(twapPriceInUSDC > 0, "UnoRe: no pairs");
        uint256 desiredAmount = (twapPriceInUSDC * (100 * SLIPPAGE_PRECISION - slippage)) / 100 / SLIPPAGE_PRECISION;

        uint256 convertedAmount = _convertTokenForETH(UNISWAP_ROUTER_V3, _token, _convertAmount, desiredAmount);
        return convertedAmount;
    }

    function _convertTokenForToken(
        address _dexAddress,
        address _token0,
        address _token1,
        uint256 _convertAmount,
        uint256 _desiredAmount
    ) private returns (uint256) {
        ISwapRouter _swapRouter = ISwapRouter(_dexAddress);
        //address _factory = _swapRouter.factory();
        uint256 usdtBalanceBeforeSwap = IERC20(_token1).balanceOf(msg.sender);
        address inpToken = WETH;
        if (_token0 != address(0)) {
            inpToken = _token0;
            TransferHelper.safeApprove(_token0, address(_swapRouter), _convertAmount);
        }
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _token0,
            tokenOut: _token1,
            fee: 3000,
            recipient: msg.sender,
            deadline: block.timestamp + swapDeadline,
            amountIn: _convertAmount,
            amountOutMinimum: _desiredAmount,
            sqrtPriceLimitX96: 0
        });
        uint256 amountOut = _swapRouter.exactInputSingle(params);

        uint256 usdtBalanceAfterSwap = IERC20(_token1).balanceOf(msg.sender);
        emit ConvertedTokenToToken(
            _dexAddress,
            _token0,
            _token1,
            _convertAmount,
            _desiredAmount,
            usdtBalanceAfterSwap - usdtBalanceBeforeSwap
        );
        return usdtBalanceAfterSwap - usdtBalanceBeforeSwap;
    }

    function _convertTokenForETH(
        address _dexAddress,
        address _token,
        uint256 _convertAmount,
        uint256 _desiredAmount
    ) private returns (uint256) {
        ISwapRouter _swapRouter = ISwapRouter(_dexAddress);
        //address _factory = _swapRouter.factory();
        uint256 ethBalanceBeforeSwap = address(msg.sender).balance;
        SafeERC20.forceApprove(IERC20(_token), address(_swapRouter), _convertAmount);
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: _token,
            tokenOut:WETH,
            fee: 3000,
            recipient: msg.sender,
            deadline: block.timestamp + swapDeadline,
            amountIn: _convertAmount,
            amountOutMinimum: _desiredAmount,
            sqrtPriceLimitX96: 0
        });
        uint256 amountOut = _swapRouter.exactInputSingle(params);

        uint256 ethBalanceAfterSwap = address(msg.sender).balance;
        emit ConvertedTokenToETH(_dexAddress, _token, _convertAmount, _desiredAmount, ethBalanceAfterSwap - ethBalanceBeforeSwap);
        return ethBalanceAfterSwap - ethBalanceBeforeSwap;
    }

    /**
     * @dev Get expected _token1 amount for _inputAmount of _token0
     * _desiredAmount should consider decimals based on _token1
     */
    function _getNeededTokenAmount(address _token0, address _token1, uint256 _token0Amount) private view returns (uint256) {
        uint256 expectedToken1Amount = IOraclePriceFeed(oraclePriceFeed).consult(_token0, _token1, _token0Amount);

        return expectedToken1Amount;
    }
}