import express, { Request, Response, NextFunction } from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

const AVS_PRIVATE_KEY = "...";
const avsWallet = new ethers.Wallet(AVS_PRIVATE_KEY);

function isSuspicious(fnSig: string): boolean {
  return fnSig.includes("rugPull") || fnSig.includes("removeLiquidity");
}

app.post("/classify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { functionSignature, tokenAddress } = req.body;

    let classification = "SAFE";
    if (isSuspicious(functionSignature)) {
      classification = "MALICIOUS";
    }

    const msgHash = ethers.utils.solidityKeccak256(
      ["address", "string"],
      [tokenAddress, classification]
    );

    const signature = await avsWallet.signMessage(ethers.utils.arrayify(msgHash));

    // Return the result
    return res.json({
      classification,
      signature,
    });
  } catch (err: unknown) {
    console.error(err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(3001, () => {
  console.log("Mock AVS Service running on http://localhost:3001");
});
