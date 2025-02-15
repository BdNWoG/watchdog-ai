import express, { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

// Your private key (for demonstration only—don't hardcode real keys!)
const AVS_PRIVATE_KEY = "0xyourprivatekeyhere";
const avsWallet = new ethers.Wallet(AVS_PRIVATE_KEY);

function isSuspicious(fnSig: string): boolean {
  return fnSig.includes("rugPull") || fnSig.includes("removeLiquidity");
}

// Define ONLY ONE handler for /classify
app.post(
  "/classify",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { functionSignature, tokenAddress } = req.body;

      // Basic classification
      let classification = "SAFE";
      if (isSuspicious(functionSignature)) {
        classification = "MALICIOUS";
      }

      // Build and sign a hash
      const msgHash = ethers.utils.solidityKeccak256(
        ["address", "string"],
        [tokenAddress, classification]
      );
      const signature = await avsWallet.signMessage(
        ethers.utils.arrayify(msgHash)
      );

      // Send JSON response (no need to "return")
      res.json({ classification, signature });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

app.listen(3001, () => {
  console.log("Mock AVS Service running on http://localhost:3001");
});
