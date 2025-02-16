import express, { Request, Response } from "express";
import { ethers } from "ethers";
import axios from "axios";

/**
 * ENV Variables:
 *  - AVS_PRIVATE_KEY: The private key for signing classification results
 *  - OPENAI_API_KEY:  Your OpenAI API key
 */
const AVS_PRIVATE_KEY = process.env.AVS_PRIVATE_KEY || "0xyourprivatekey";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "sk-xxx";
const avsWallet = new ethers.Wallet(AVS_PRIVATE_KEY);

const app = express();
app.use(express.json());

/**
 * Build an in-depth prompt that includes not just the functionSignature and tokenAddress,
 * but also extended metadata about the contract's deployer history, liquidity status, etc.
 *
 * This approach helps the LLM make more informed decisions.
 */
function buildAdvancedPrompt(data: {
  functionSignature: string;
  tokenAddress: string;
  deployerReputation: string;      // e.g. "This deployer is known to have launched 2 rug pulls in the past."
  liquidityInfo: string;           // e.g. "Liquidity is locked for 30 days" or "No liquidity lock found."
  creationDate: string;            // e.g. "Deployed 2023-10-01" or "Brand new (less than 1 day old)."
  codeAnalysis: string;            // e.g. "Potential reentrancy vulnerability, or honeypot code pattern, etc."
  recentTxHistory: string;         // e.g. "Multiple large mints in the last hour. Ownership just transferred."
}) {
  return `
You are "DeFi-SecGPT," a specialized security auditor for Ethereum contracts. 
You're given the following data about a suspicious transaction:

1. Function Signature: "${data.functionSignature}"
2. Token Address: "${data.tokenAddress}"

Additional context about the contract:
- Deployer History: ${data.deployerReputation}
- Liquidity Info: ${data.liquidityInfo}
- Contract Creation Date: ${data.creationDate}
- Code Analysis Notes: ${data.codeAnalysis}
- Recent Transaction History: ${data.recentTxHistory}

Your job: 
Analyze how suspicious or malicious this scenario is, on a scale of 0..100:
- 0 means "very safe, no malicious signs"
- 100 means "extremely malicious, almost certainly a scam"

Consider:
- If the deployer has prior rug pulls or malicious tokens, raise the score.
- If liquidity is not locked, or code has typical rug/honeypot patterns, raise it further.
- If there's questionable transaction history (like massive token mints, ownership transfers, blacklisting), also raise the score.

Return only the integer from 0..100 (no extra text).
`;
}

/**
 * Calls OpenAI with the above advanced prompt. 
 * Expects a single integer from 0..100 in the response.
 */
async function aiRiskEvaluation(advancedData: any): Promise<number> {
  const prompt = buildAdvancedPrompt(advancedData);

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.0,
        max_tokens: 10,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
      }
    );

    const textOutput = response.data?.choices?.[0]?.message?.content?.trim() || "0";
    const riskScore = parseInt(textOutput, 10);
    if (isNaN(riskScore)) {
      return 0; // fallback if parsing fails
    }

    // clamp to 0..100
    return Math.max(0, Math.min(100, riskScore));
  } catch (err) {
    console.error("Error calling AI risk evaluation:", err);
    return 0;
  }
}

app.post("/classify", (async (req, res): Promise<void> => {
  try {
    // Gather all extended metadata from request
    const {
      functionSignature,
      tokenAddress,
      deployerReputation,
      liquidityInfo,
      creationDate,
      codeAnalysis,
      recentTxHistory
    } = req.body;

    // Basic checks
    if (!functionSignature || !tokenAddress) {
      res.status(400).json({ error: "Missing functionSignature or tokenAddress" });
    }

    // We'll default the extra fields if not provided
    const dataForAI = {
      functionSignature,
      tokenAddress,
      deployerReputation: deployerReputation || "No data",
      liquidityInfo: liquidityInfo || "Unknown",
      creationDate: creationDate || "Unknown",
      codeAnalysis: codeAnalysis || "No code analysis provided",
      recentTxHistory: recentTxHistory || "No recent tx info"
    };

    // 1) AI-based risk
    const riskScore = await aiRiskEvaluation(dataForAI);

    // 2) classification
    const classification = riskScore > 70 ? "MALICIOUS" : "SAFE";

    // 3) sign (tokenAddress, functionSignature, classification, riskScore)
    const msgHash = ethers.utils.solidityKeccak256(
      ["address", "string", "string", "uint256"],
      [tokenAddress, functionSignature, classification, riskScore]
    );
    const signature = await avsWallet.signMessage(ethers.utils.arrayify(msgHash));

    res.json({classification, riskScore, signature,});
  } catch (err) {
    console.error("Error in classification:", err);
    res.status(500).json({ error: (err as Error).message });
  }
}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`AI-Powered AVS Service listening on http://localhost:${PORT}`);
});
