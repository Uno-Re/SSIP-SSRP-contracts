import axios from "axios";
import { ethers } from "ethers";
import { OdosSwapService } from "./OdosSwapService";
import { abi as ERC20_ABI } from "@openzeppelin/contracts/build/contracts/ERC20.json";

const BASE_URL = "http://localhost:3000";

export class OdosSwapManager {
  private odosService: OdosSwapService;

  constructor(chainId: number, usdmAddress: string) {
    this.odosService = new OdosSwapService(chainId, usdmAddress);
  }

  async swapTokenToUSDm(
    tokenAddress: string,
    amount: string,
    userAddress: string,
    signer: ethers.Signer
  ) {
    try {
      // 1. Check and set allowance
      await this.checkAndSetAllowance(tokenAddress, amount, signer);

      // 2. Get quote from Odos
      const quote = await this.odosService.getQuote(
        tokenAddress,
        amount,
        userAddress
      );

      // 3. Get transaction data
      const txData = await this.odosService.getSwapTransaction(
        quote.pathId,
        userAddress
      );

      // 4. Execute the swap transaction
      const tx = await signer.sendTransaction({
        ...txData,
        from: userAddress,
      });

      // 5. Wait for confirmation
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error("Swap failed:", error);
      throw error;
    }
  }

  private async checkAndSetAllowance(
    tokenAddress: string,
    amount: string,
    signer: ethers.Signer
  ) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const userAddress = await signer.getAddress();
    const currentAllowance = await tokenContract.allowance(
      userAddress,
      this.odosService.getRouterAddress()
    );

    if (currentAllowance.lt(amount)) {
      const approveTx = await tokenContract.approve(
        this.odosService.getRouterAddress(),
        amount
      );
      await approveTx.wait();
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    return this.odosService.getTokenPrice(tokenAddress);
  }

  async getSupportedTokens() {
    return this.odosService.getSupportedTokens();
  }
}
