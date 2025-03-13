import { OdosSwapService } from "./OdosSwapService";
require("dotenv").config();

describe("OdosSwapService Integration Tests", () => {
  let odosService: OdosSwapService;

  beforeAll(() => {
    if (!process.env.USDC || !process.env.USDM) {
      throw new Error(
        "USDC or USDM address not found in environment variables"
      );
    }

    const chainId = 1;
    odosService = new OdosSwapService(chainId, process.env.USDM);
  });

  it("should get quote for USDC to USDM swap", async () => {
    const amount = "1000000"; // 1 USDC (6 decimals)
    const userAddress = "0x0000000000000000000000000000000000000000"; // Zero address for testing

    const quote = await odosService.getQuote(
      process.env.USDC!,
      amount,
      userAddress
    );

    console.log("Quote received:", JSON.stringify(quote, null, 2));
    expect(quote).toBeDefined();
    expect(quote.pathId).toBeDefined();
  }, 10000); // Increased timeout for API call

  it("should get supported tokens", async () => {
    const tokens = await odosService.getSupportedTokens();
    console.log("Number of supported tokens:", Object.keys(tokens).length);
    expect(tokens).toBeDefined();
    expect(Object.keys(tokens).length).toBeGreaterThan(0);
  });
});
