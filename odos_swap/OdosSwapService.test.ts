import { OdosSwapService } from "./OdosSwapService";
import axios from "axios";
import { jest } from "@jest/globals";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("OdosSwapService", () => {
  let odosService: OdosSwapService;

  beforeEach(() => {
    process.env.ODOS_ROUTER_ADDRESS =
      "0x1234567890123456789012345678901234567890";
    odosService = new OdosSwapService(1, "0xUSDM_ADDRESS");
  });

  describe("getQuote", () => {
    it("should return quote data", async () => {
      const mockQuoteResponse = {
        data: {
          pathId: "mock-path-id",
          expectedOutput: "1000000",
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockQuoteResponse);

      const quote = await odosService.getQuote(
        "0xTOKEN_ADDRESS",
        "1000000",
        "0xUSER_ADDRESS"
      );

      expect(quote).toEqual(mockQuoteResponse.data);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.odos.xyz/sor/quote/v2",
        expect.objectContaining({
          chainId: 1,
          inputTokens: [
            {
              tokenAddress: "0xTOKEN_ADDRESS",
              amount: "1000000",
            },
          ],
        })
      );
    });
  });

  describe("getSwapTransaction", () => {
    it("should return transaction data", async () => {
      const mockTxResponse = {
        data: {
          transaction: {
            to: "0xROUTER",
            data: "0xCALLDATA",
          },
        },
      };

      mockedAxios.post.mockResolvedValueOnce(mockTxResponse);

      const txData = await odosService.getSwapTransaction(
        "mock-path-id",
        "0xUSER_ADDRESS"
      );

      expect(txData).toEqual(mockTxResponse.data.transaction);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.odos.xyz/sor/assemble",
        {
          userAddr: "0xUSER_ADDRESS",
          pathId: "mock-path-id",
          simulate: true,
        }
      );
    });
  });

  describe("getRouterAddress", () => {
    it("should return the router address from env", () => {
      expect(odosService.getRouterAddress()).toBe(
        "0x1234567890123456789012345678901234567890"
      );
    });
  });
});
