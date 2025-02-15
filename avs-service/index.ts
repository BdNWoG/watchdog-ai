import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

// Private key for demonstration. DO NOT USE IN PRODUCTION.
const AVS_PRIVATE_KEY = "0x59c6995e998f97a5a...123456789abcdefabcde00000"; 
const avsWallet = new ethers.Wallet(AVS_PRIVATE_KEY);

// Basic check to see if transaction data is suspicious
function isSuspicious(fnSig: string): boolean {
  // Example: if it includes "rugPull"
  return fnSig.includes("rugPull") || fnSig.includes("removeLiquidity");
}

app.post("/classify", async (req, res) => {
  try {
    const { functionSignature, tokenAddress } = req.body;

    // Simple classification
    let classification = "SAFE";
    if (isSuspicious(functionSignature)) {
      classification = "MALICIOUS";
    }

    // Construct message hash: keccak256(tokenAddress + classification)
    const msgHash = ethers.utils.solidityKeccak256(["address", "string"], [tokenAddress, classification]);

    // Sign the raw bytes of the msgHash
    const signature = await avsWallet.signMessage(ethers.utils.arrayify(msgHash));

    return res.json({
      classification,
      signature
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(3001, () => {
  console.log("Mock AVS Service running on http://localhost:3001");
});
