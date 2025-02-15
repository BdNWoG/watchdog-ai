// mempool-watcher/index.ts
import { ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import axios from "axios";
import { parseFunctionSig } from "./detector";

/**
 * CONFIG SECTION
 * - Replace these with real values for your environment/testnet.
 */
const GOERLI_RPC_URL = "https://eth-goerli.g.alchemy.com/v2/REAL_KEY_HERE";
const FLASHBOTS_RELAY = "https://relay-goerli.flashbots.net";
const SEARCHER_PRIVATE_KEY = "0xyourFlashbotsKeyHere";
const GUARDIAN_CONTRACT = "0xYourGuardianContractDeployedOnGoerli";
const CHAIN_ID = 5; // Goerli chain ID

// We'll create a standard Provider, then use it to create a FlashbotsBundleProvider
const provider = new ethers.providers.JsonRpcProvider(GOERLI_RPC_URL);
const searcherWallet = new ethers.Wallet(SEARCHER_PRIVATE_KEY, provider);

let flashbotsProvider: FlashbotsBundleProvider | null = null;

/**
 * Initialize Flashbots
 */
async function initFlashbots() {
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    searcherWallet,
    FLASHBOTS_RELAY,
    "goerli"
  );
  console.log("Initialized Flashbots on Goerli");
}

/**
 * Query your AVS at http://localhost:3001/classify
 * We'll pass { tokenAddress, functionSignature }, expecting { classification, signature }.
 */
async function classifyViaAVS(tokenAddress: string, functionSignature: string) {
  const resp = await axios.post("http://localhost:3001/classify", {
    functionSignature,
    tokenAddress
  });
  return resp.data; // e.g. { classification: "MALICIOUS" | "SAFE", signature: "0x..." }
}

/**
 * frontRun:
 * - Builds a transaction calling Guardian.autoDefenseAction(tokenAddress, functionSignature, avsSignature)
 * - Sends it via Flashbots with higher priority to front-run the malicious transaction.
 */
async function frontRun(
  malTx: ethers.providers.TransactionResponse,
  tokenAddress: string,
  avsSignature: string,
  detectedMethod: string
) {
  if (!flashbotsProvider) {
    console.error("Flashbots provider not initialized");
    return;
  }

  const blockNumber = await provider.getBlockNumber();
  console.log(`Submitting front-run bundle for block: ${blockNumber + 1}`);

  // Guardian needs: function autoDefenseAction(address,string,bytes) external
  const guardianAbi = ["function autoDefenseAction(address,string,bytes) external"];
  const guardianIface = new ethers.utils.Interface(guardianAbi);

  const data = guardianIface.encodeFunctionData("autoDefenseAction", [
    tokenAddress,
    detectedMethod,
    avsSignature
  ]);

  const transaction = {
    chainId: CHAIN_ID,
    type: 2,
    to: GUARDIAN_CONTRACT,
    data,
    value: 0,
    gasLimit: 300000,
    // Adjust gas if needed
    maxFeePerGas: ethers.utils.parseUnits("40", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei")
  };

  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: searcherWallet,
      transaction
    }
  ]);

  // Simulate first, to ensure no revert
  const simulation = await flashbotsProvider.simulate(signedTransactions, blockNumber + 1);
  if ("error" in simulation || simulation.firstRevert) {
    console.log("Simulation Error:", simulation);
    return;
  }

  // Submit the bundle
  const bundleResponse = await flashbotsProvider.sendRawBundle(
    signedTransactions,
    blockNumber + 1
  );
  console.log("Flashbots bundle submitted. Waiting...");

  if ("error" in bundleResponse) {
    console.error("Error sending raw bundle:", bundleResponse.error);
    return;
  }

  const bundleResolution = await bundleResponse.wait();
  console.log("Bundle resolution:", bundleResolution);
}

/**
 * watchMempool:
 * - Listens for pending TX in the mempool
 * - If it matches a suspicious function, calls AVS for classification
 * - If malicious, front-runs with Guardian
 */
async function watchMempool() {
  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx || !tx.data) return;

      // Detect known malicious function calls
      const detectedMethod = parseFunctionSig(tx.data);
      if (detectedMethod) {
        console.log(`Detected suspicious call: ${detectedMethod} from ${tx.from}, hash: ${txHash}`);

        // 1. Query AVS
        const { classification, signature } = await classifyViaAVS(tx.to!, detectedMethod);

        // 2. If MALICIOUS => front-run
        if (classification === "MALICIOUS") {
          await frontRun(tx, tx.to!, signature, detectedMethod);
        }
      }
    } catch (err) {
      console.error("Error in mempool watcher:", err);
    }
  });
}

/**
 * main:
 * - Initializes Flashbots
 * - Starts mempool watching
 */
async function main() {
  await initFlashbots();
  await watchMempool();
  console.log("Mempool watcher running...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
