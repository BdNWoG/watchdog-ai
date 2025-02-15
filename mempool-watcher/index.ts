import { ethers } from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import axios from "axios";

// Example config (no placeholders):
const GOERLI_RPC_URL = "https://eth-goerli.g.alchemy.com/v2/REAL_KEY_HERE";
const FLASHBOTS_RELAY = "https://relay-goerli.flashbots.net";
const SEARCHER_PRIVATE_KEY = "0x59c6995e998f97a5a456abcdefabc...1234567890"; // Example key
const GUARDIAN_CONTRACT = "0xYourGuardianContractDeployedOnGoerli";
const CHAIN_ID = 5; // Goerli chain ID

// For demonstration, we assume our Guardian has avsPublicKey = the AVS wallet in "avs-service"
const provider = new ethers.providers.JsonRpcProvider(GOERLI_RPC_URL);
const searcherWallet = new ethers.Wallet(SEARCHER_PRIVATE_KEY, provider);

let flashbotsProvider: FlashbotsBundleProvider;

async function init() {
  flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    searcherWallet,
    FLASHBOTS_RELAY,
    "goerli"
  );
  console.log("Initialized Flashbots on Goerli");
}

function parseFunctionSig(data: string): string {
  // Minimal example:
  // if data starts with the 4-byte function signature for rugPull
  //  e.g. rugPull() => 0xd4ee1d90
  // This function is extremely simplified; real usage needs a more robust approach.
  if (data.startsWith("0xd4ee1d90")) {
    return "rugPull()";
  }
  // Add more checks for removeLiquidity, etc.
  return "unknown";
}

async function watchMempool() {
  provider.on("pending", async (txHash) => {
    try {
      const tx = await provider.getTransaction(txHash);
      if (!tx) return;

      // Check function signature
      const fnSig = parseFunctionSig(tx.data);
      if (fnSig === "rugPull()") {
        console.log(`Detected suspicious rugPull() from ${tx.from}, hash: ${txHash}`);

        // 1. Call AVS service
        const { classification, signature } = await classifyViaAVS(tx.to!, fnSig);

        // 2. If malicious, front-run
        if (classification === "MALICIOUS") {
          await frontRun(tx, tx.to!, signature);
        }
      }
    } catch (err) {
      console.error("Error in mempool watcher:", err);
    }
  });
}

async function classifyViaAVS(tokenAddress: string, functionSignature: string) {
  const resp = await axios.post("http://localhost:3001/classify", {
    functionSignature,
    tokenAddress
  });
  return resp.data; // { classification: "MALICIOUS" or "SAFE", signature: "0x..." }
}

async function frontRun(malTx: providers.TransactionResponse, tokenAddress: string, avsSignature: string) {
  const blockNumber = await provider.getBlockNumber();
  console.log("Submitting front-run bundle for block:", blockNumber + 1);

  // Guardian autoRemoveLiquidity
  const guardianAbi = ["function autoRemoveLiquidity(address, bytes) external"];
  const guardianIface = new ethers.utils.Interface(guardianAbi);

  const data = guardianIface.encodeFunctionData("autoRemoveLiquidity", [tokenAddress, avsSignature]);

  const transaction = {
    chainId: CHAIN_ID,
    type: 2,
    to: GUARDIAN_CONTRACT,
    data,
    value: 0,
    gasLimit: 300000,
    maxFeePerGas: ethers.utils.parseUnits("30", "gwei"),
    maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei")
  };

  const signedTransactions = await flashbotsProvider.signBundle([
    {
      signer: searcherWallet,
      transaction
    }
  ]);

  const simulation = await flashbotsProvider.simulate(signedTransactions, blockNumber + 1);
  if ("error" in simulation || simulation.firstRevert) {
    console.log("Simulation Error:", simulation);
    return;
  }

  const bundleResponse = await flashbotsProvider.sendRawBundle(signedTransactions, blockNumber + 1);
  console.log("Flashbots bundle submitted. Waiting...");

  const bundleResolution = await bundleResponse.wait();
  console.log("Bundle resolution:", bundleResolution);
}

async function main() {
  await init();
  await watchMempool();
  console.log("Mempool watcher running...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
