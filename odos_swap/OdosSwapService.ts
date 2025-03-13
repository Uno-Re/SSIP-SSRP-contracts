import axios from "axios";

export class OdosSwapService {
  private readonly ODOS_API_URL: string;
  private readonly USDM_ADDRESS: string;
  private readonly chainId: number;
  private readonly ODOS_ROUTER_ADDRESS: string;

  constructor(chainId: number, poolCurrencyAddress: string) {
    this.ODOS_API_URL = "https://api.odos.xyz";
    this.USDM_ADDRESS = poolCurrencyAddress;
    this.chainId = chainId;
    if (!process.env.ODOS_ROUTER_ADDRESS)
      throw new Error("ODOS_ROUTER_ADDRESS not set in environment");
    this.ODOS_ROUTER_ADDRESS = process.env.ODOS_ROUTER_ADDRESS;
  }

  /**
   * Get a quote for swapping any token to USDm
   * @param inputTokenAddress The address of the token to swap from
   * @param inputAmount The amount to swap (in token's smallest unit)
   * @param userAddress The address of the user making the swap
   */
  async getQuote(
    inputTokenAddress: string,
    inputAmount: string,
    userAddress: string
  ) {
    const quoteRequest = {
      chainId: this.chainId,
      inputTokens: [
        {
          tokenAddress: inputTokenAddress,
          amount: inputAmount,
        },
      ],
      outputTokens: [
        {
          tokenAddress: this.USDM_ADDRESS,
          proportion: 1,
        },
      ],
      userAddr: userAddress,
      slippageLimitPercent: 0.5,
    };

    try {
      const response = await axios.post(
        `${this.ODOS_API_URL}/sor/quote/v2`,
        quoteRequest
      );
      return response.data;
    } catch (error) {
      console.error("Error getting quote:", error);
      throw error;
    }
  }

  /**
   * Get transaction data for executing the swap
   * @param pathId The path ID received from getQuote
   * @param userAddress The address of the user making the swap
   */
  async getSwapTransaction(pathId: string, userAddress: string) {
    const assembleRequest = {
      userAddr: userAddress,
      pathId: pathId,
      simulate: true,
    };

    try {
      const response = await axios.post(
        `${this.ODOS_API_URL}/sor/assemble`,
        assembleRequest
      );

      return response.data.transaction;
    } catch (error) {
      console.error("Error assembling swap:", error);
      throw error;
    }
  }

  /**
   * Get supported tokens and their info
   */
  async getSupportedTokens() {
    try {
      const response = await axios.get(
        `${this.ODOS_API_URL}/info/tokens/${this.chainId}`
      );
      return response.data.tokenMap;
    } catch (error) {
      console.error("Error getting supported tokens:", error);
      throw error;
    }
  }

  /**
   * Get token price in USD
   * @param tokenAddress The token address to get price for
   */
  async getTokenPrice(tokenAddress: string) {
    try {
      const response = await axios.get(
        `${this.ODOS_API_URL}/pricing/token/${this.chainId}/${tokenAddress}`
      );
      return response.data.price;
    } catch (error) {
      console.error("Error getting token price:", error);
      throw error;
    }
  }

  public getRouterAddress(): string {
    return this.ODOS_ROUTER_ADDRESS;
  }
}
