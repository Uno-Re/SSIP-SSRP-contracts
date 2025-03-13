// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.23;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract MockUniswapPair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;

    constructor(address _token0, address _token1) {
        token0 = _token0;
        token1 = _token1;
    }

    function getReserves() external view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
        return (reserve0, reserve1, uint32(block.timestamp));
    }

    function sync() public {
        reserve0 = uint112(IERC20(token0).balanceOf(address(this)));
        reserve1 = uint112(IERC20(token1).balanceOf(address(this)));
    }

    function swap(uint amount0Out, uint amount1Out, address to) external {
        if (amount0Out > 0) IERC20(token0).transfer(to, amount0Out);
        if (amount1Out > 0) IERC20(token1).transfer(to, amount1Out);
        sync();
    }
}

contract MockUniswapFactory {
    mapping(address => mapping(address => address)) public getPair;

    function setPair(address tokenA, address tokenB, address pair) external {
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}

contract MockUniswapRouter {
    using SafeERC20 for IERC20;

    function exactInputSingle(ISwapRouter.ExactInputSingleParams calldata params) external returns (uint256 amountOut) {
        // Transfer tokenIn from msg.sender to this contract
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        // Transfer tokenOut to the recipient
        IERC20(params.tokenOut).safeTransfer(params.recipient, params.amountOutMinimum);

        return params.amountOutMinimum;
    }

    // Function to allow the contract to receive ERC20 tokens
    function rescueTokens(address token, address to, uint256 amount) external {
        IERC20(token).safeTransfer(to, amount);
    }

    // Function to allow the contract to receive ETH
    receive() external payable {}
}
