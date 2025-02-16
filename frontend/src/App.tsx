import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

// Minimal ABI for Guardian: just the functions/events we need
const GUARDIAN_ABI = [
  "function avsPublicKey() view returns (address)",
  "function autoRemoveLiquidity(address, bytes) external",
  "event AutoRemovedLiquidity(address indexed token, address indexed caller)"
];

function App() {
  // ----------------------------------------------------------------------
  // Metamask / Ethers State
  // ----------------------------------------------------------------------
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");

  // ----------------------------------------------------------------------
  // Guardian Contract State
  // ----------------------------------------------------------------------
  const [guardianAddress, setGuardianAddress] = useState<string>("0xYourDeployedGuardianAddress"); 
  const [guardianContract, setGuardianContract] = useState<ethers.Contract | null>(null);

  // Data from the contract
  const [avsPubKey, setAvsPubKey] = useState<string>("");

  // ----------------------------------------------------------------------
  // Events and Logs
  // ----------------------------------------------------------------------
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [mempoolLogs, setMempoolLogs] = useState<string[]>([]);

  // ----------------------------------------------------------------------
  // AVS Classification Results
  // ----------------------------------------------------------------------
  const [functionSignature, setFunctionSignature] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [deployerRep, setDeployerRep] = useState("");
  const [liquidityInfo, setLiquidityInfo] = useState("");
  const [creationDate, setCreationDate] = useState("");
  const [codeAnalysis, setCodeAnalysis] = useState("");
  const [recentTx, setRecentTx] = useState("");

  const [classification, setClassification] = useState("");
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [avsError, setAvsError] = useState<string>("");

  // ----------------------------------------------------------------------
  // 1. Detect Metamask on mount
  // ----------------------------------------------------------------------
  useEffect(() => {
    if ((window as any).ethereum) {
      const tempProvider = new ethers.providers.Web3Provider((window as any).ethereum);
      setProvider(tempProvider);
      console.log("Metamask provider detected.");
    } else {
      console.warn("No Metamask detected.");
    }
  }, []);

  // ----------------------------------------------------------------------
  // 2. Connect Wallet
  // ----------------------------------------------------------------------
  const connectWallet = async () => {
    if (!provider) return;
    try {
      const accounts = await provider.send("eth_requestAccounts", []);
      if (accounts.length) {
        setAccount(accounts[0]);
        const _signer = provider.getSigner();
        setSigner(_signer);
        console.log("Wallet connected:", accounts[0]);
      }
    } catch (err) {
      console.error("User rejected request", err);
    }
  };

  // ----------------------------------------------------------------------
  // 3. Create Guardian Contract instance whenever signer or address changes
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!signer || !guardianAddress) {
      setGuardianContract(null);
      return;
    }
    try {
      const contract = new ethers.Contract(guardianAddress, GUARDIAN_ABI, signer);
      setGuardianContract(contract as ethers.Contract);
    } catch (err) {
      console.error("Failed to create contract instance:", err);
      setGuardianContract(null);
    }
  }, [signer, guardianAddress]);

  // ----------------------------------------------------------------------
  // 4. Listen for AutoRemovedLiquidity event
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!guardianContract) return;

    const handleAutoRemoved = (token: string, caller: string, event: any) => {
      const msg = `AutoRemovedLiquidity: token=${token}, caller=${caller}, block=${event.blockNumber}`;
      setEventLogs((prev) => [...prev, msg]);
      console.log("AutoRemovedLiquidity event =>", msg);
    };

    guardianContract.on("AutoRemovedLiquidity", handleAutoRemoved);

    return () => {
      guardianContract.off("AutoRemovedLiquidity", handleAutoRemoved);
    };
  }, [guardianContract]);

  // ----------------------------------------------------------------------
  // 5. Fetch AVS Public Key
  // ----------------------------------------------------------------------
  const fetchAvsKey = async () => {
    if (!guardianContract) return;
    try {
      const key = await guardianContract.avsPublicKey();
      setAvsPubKey(key);
      console.log("AVS Public Key:", key);
    } catch (err) {
      console.error("Error fetching avsPublicKey:", err);
    }
  };

  // ----------------------------------------------------------------------
  // 6. Call autoRemoveLiquidity (demo function)
  // ----------------------------------------------------------------------
  const callRemoveLiquidity = async () => {
    if (!guardianContract) return;
    try {
      const tokenAddr = "0x0000000000000000000000000000000000000000";
      const dummySignature = "0x1234"; // example signature
      const tx = await guardianContract.autoRemoveLiquidity(tokenAddr, dummySignature);
      console.log("Tx sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Tx mined:", receipt.transactionHash);
    } catch (err) {
      console.error("Error calling removeLiquidity:", err);
    }
  };

  // ----------------------------------------------------------------------
  // 7. Subscribe to Mempool Logs (Optional WebSocket)
  // ----------------------------------------------------------------------
  useEffect(() => {
    // If you have a local WebSocket from your mempool watcher
    // e.g. ws://localhost:4000
    const wsUrl = "ws://localhost:4000";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log(`Connected to mempool watcher at ${wsUrl}`);
    };
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const logMsg = `Event: ${data.event}, txHash=${data.txHash}, from=${data.txFrom}`;
        setMempoolLogs((prev) => [...prev, logMsg]);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    return () => {
      ws.close();
    };
  }, []);

  // ----------------------------------------------------------------------
  // 8. Test AVS Classification (POST to your Express server)
  // ----------------------------------------------------------------------
  const handleAvsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAvsError("");
    setClassification("");
    setRiskScore(null);

    try {
      const payload = {
        functionSignature,
        tokenAddress,
        deployerReputation: deployerRep,
        liquidityInfo,
        creationDate,
        codeAnalysis,
        recentTxHistory: recentTx,
      };

      const res = await fetch("http://localhost:3001/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setAvsError(json.error || "Error occurred");
      } else {
        setClassification(json.classification);
        setRiskScore(json.riskScore);
      }
    } catch (err: any) {
      setAvsError(err.message);
    }
  };

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>WatchDog AI Frontend</h2>

      {/* ----------------- Wallet Connection ----------------- */}
      <div style={{ marginBottom: 20 }}>
        {!account ? (
          <button onClick={connectWallet} style={styles.btn}>
            Connect Metamask
          </button>
        ) : (
          <p>Wallet Connected: <b>{account}</b></p>
        )}
      </div>

      {/* ----------------- Guardian Contract Input ----------------- */}
      <div>
        <label>Guardian Contract Address: </label>
        <input
          style={styles.input}
          type="text"
          value={guardianAddress}
          onChange={(e) => setGuardianAddress(e.target.value)}
        />
      </div>

      {/* ----------------- AVS Public Key Retrieval ----------------- */}
      <div style={{ marginTop: 10 }}>
        <button onClick={fetchAvsKey} disabled={!guardianContract} style={styles.btn}>
          Fetch AVS Public Key
        </button>
        {avsPubKey && <p>AVS Public Key: <b>{avsPubKey}</b></p>}
      </div>

      {/* ----------------- autoRemoveLiquidity Call ----------------- */}
      <div style={{ marginTop: 10 }}>
        <button onClick={callRemoveLiquidity} disabled={!guardianContract} style={styles.btn}>
          Call autoRemoveLiquidity (Demo)
        </button>
      </div>

      <hr style={styles.hr} />

      {/* ----------------- Guardian Events Log ----------------- */}
      <h3>Guardian Contract Events</h3>
      {eventLogs.length === 0 && <p>No events yet...</p>}
      <ul>
        {eventLogs.map((log, idx) => (
          <li key={idx}>{log}</li>
        ))}
      </ul>

      <hr style={styles.hr} />

      {/* ----------------- Mempool Logs (Optional) ----------------- */}
      <h3>Mempool Watcher Logs (WebSocket)</h3>
      {mempoolLogs.length === 0 && <p>No mempool logs yet...</p>}
      <ul>
        {mempoolLogs.map((log, idx) => (
          <li key={idx}>{log}</li>
        ))}
      </ul>

      <hr style={styles.hr} />

      {/* ----------------- AVS Classification Tester ----------------- */}
      <h3>Test AVS Classification</h3>
      <form onSubmit={handleAvsSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label>Function Signature</label>
          <input
            style={styles.input}
            value={functionSignature}
            onChange={(e) => setFunctionSignature(e.target.value)}
            placeholder="e.g. removeLiquidity"
          />
        </div>

        <div style={styles.formGroup}>
          <label>Token Address</label>
          <input
            style={styles.input}
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            placeholder="0x1234..."
          />
        </div>

        <div style={styles.formGroup}>
          <label>Deployer Reputation</label>
          <input
            style={styles.input}
            value={deployerRep}
            onChange={(e) => setDeployerRep(e.target.value)}
            placeholder="Deployer known for 2 rug pulls?"
          />
        </div>

        <div style={styles.formGroup}>
          <label>Liquidity Info</label>
          <input
            style={styles.input}
            value={liquidityInfo}
            onChange={(e) => setLiquidityInfo(e.target.value)}
            placeholder="No lock found..."
          />
        </div>

        <div style={styles.formGroup}>
          <label>Creation Date</label>
          <input
            style={styles.input}
            value={creationDate}
            onChange={(e) => setCreationDate(e.target.value)}
            placeholder="Brand new, deployed 1 day ago"
          />
        </div>

        <div style={styles.formGroup}>
          <label>Code Analysis</label>
          <input
            style={styles.input}
            value={codeAnalysis}
            onChange={(e) => setCodeAnalysis(e.target.value)}
            placeholder="Suspected reentrancy..."
          />
        </div>

        <div style={styles.formGroup}>
          <label>Recent Tx History</label>
          <input
            style={styles.input}
            value={recentTx}
            onChange={(e) => setRecentTx(e.target.value)}
            placeholder="Multiple large mints..."
          />
        </div>

        <button type="submit" style={{ ...styles.btn, marginTop: 10 }}>
          Submit to AVS
        </button>
      </form>

      {/* ----------------- Display AVS Classification Result ----------------- */}
      <div style={{ marginTop: 20 }}>
        {avsError && <p style={{ color: "red" }}>Error: {avsError}</p>}

        {classification && riskScore !== null && (
          <div style={{ marginTop: 10 }}>
            <p>Classification: <b>{classification}</b></p>
            <p>Risk Score: <b>{riskScore}%</b></p>

            <div style={styles.riskBarContainer}>
              <div
                style={{
                  ...styles.riskBarFill,
                  width: `${riskScore}%`,
                  backgroundColor:
                    riskScore < 30 ? "#4caf50" : riskScore < 70 ? "#ff9800" : "#f44336",
                }}
              >
                {riskScore}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// Basic inline CSS for a "clean & sleek" look
// Feel free to convert to a real CSS file or Tailwind
// ----------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  btn: {
    padding: "8px 16px",
    border: "none",
    backgroundColor: "#2196f3",
    color: "#fff",
    borderRadius: "4px",
    cursor: "pointer",
    marginRight: "8px",
  },
  input: {
    marginLeft: "6px",
    padding: "6px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    width: "280px",
  },
  hr: {
    margin: "20px 0",
    border: "none",
    borderBottom: "1px solid #ccc",
  },
  form: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    maxWidth: "600px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
  },
  riskBarContainer: {
    backgroundColor: "#ddd",
    borderRadius: "4px",
    overflow: "hidden",
    width: "100%",
    maxWidth: "300px",
    marginTop: "5px",
  },
  riskBarFill: {
    height: "24px",
    color: "#fff",
    textAlign: "center",
    lineHeight: "24px",
    transition: "width 0.3s",
  },
};

export default App;
