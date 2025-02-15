import express, { Request, Response } from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

const AVS_PRIVATE_KEY = "0xyourprivatekey";
const avsWallet = new ethers.Wallet(AVS_PRIVATE_KEY);

/** 
 * Suppose your mempool watcher sends:
 *  {
 *    "functionSignature": "mint",
 *    "tokenAddress": "0x...someToken"
 *  }
 * We'll classify it as MALICIOUS if it's in a known malicious list.
 */
function classifySignature(fnSig: string): "SAFE" | "MALICIOUS" {
  const maliciousMethods = [
    "rugPull",
    "removeLiquidity",
    "setTaxFee",
    "blacklist",
    "toggleTrading",
    "mint",
    "transferOwnership"
  ];

  if (maliciousMethods.includes(fnSig)) {
    return "MALICIOUS";
  }
  return "SAFE";
}

app.post("/classify", async (req: Request, res: Response) => {
  const { functionSignature, tokenAddress } = req.body;

  const classification = classifySignature(functionSignature);
  // Now we sign tokenAddress + functionSignature + classification
  const msgHash = ethers.utils.solidityKeccak256(
    ["address", "string", "string"],
    [tokenAddress, functionSignature, classification]
  );
  const signature = await avsWallet.signMessage(ethers.utils.arrayify(msgHash));

  res.json({ classification, signature });
});

app.listen(3001, () => {
  console.log("Mock AVS Service running on http://localhost:3001");
});
