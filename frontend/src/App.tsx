import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

// Minimal Guardian ABI for example
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
  const [account, setAccount] = useState("");

  // ----------------------------------------------------------------------
  // Guardian Contract
  // ----------------------------------------------------------------------
  const [guardianAddress, setGuardianAddress] = useState("0xYourGuardianAddress");
  const [guardianContract, setGuardianContract] = useState<ethers.Contract | null>(null);
  const [avsPubKey, setAvsPubKey] = useState<string>("");

  // ----------------------------------------------------------------------
  // Token Creation + Rug Actions (Right Column)
  // ----------------------------------------------------------------------
  const [createdToken, setCreatedToken] = useState<string>(""); // address of minted token
  const [liquidityRemoved, setLiquidityRemoved] = useState<boolean>(false);

  // ----------------------------------------------------------------------
  // AVS Risk Analysis (Left Column)
  // ----------------------------------------------------------------------
  const [tokenToAnalyze, setTokenToAnalyze] = useState("");
  const [classification, setClassification] = useState("");
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [avsError, setAvsError] = useState("");

  // Mempool logs (front-run monitor, etc.)
  const [mempoolLogs, setMempoolLogs] = useState<string[]>([]);
  const [eventLogs, setEventLogs] = useState<string[]>([]);

  // ----------------------------------------------------------------------
  // 1. Detect Metamask
  // ----------------------------------------------------------------------
  useEffect(() => {
    if ((window as any).ethereum) {
      const tempProvider = new ethers.providers.Web3Provider((window as any).ethereum);
      setProvider(tempProvider);
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
  // 3. Create Guardian Contract Instance
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
  // 4. Guardian Events
  // ----------------------------------------------------------------------
  useEffect(() => {
    if (!guardianContract) return;

    const handleAutoRemoved = (token: string, caller: string, evt: any) => {
      const msg = `AutoRemovedLiquidity: token=${token}, caller=${caller}, block=${evt.blockNumber}`;
      setEventLogs((prev) => [...prev, msg]);
      console.log(msg);
    };

    guardianContract.on("AutoRemovedLiquidity", handleAutoRemoved);

    return () => {
      guardianContract.off("AutoRemovedLiquidity", handleAutoRemoved);
    };
  }, [guardianContract]);

  // ----------------------------------------------------------------------
  // 5. (Optional) Mempool Watcher
  // ----------------------------------------------------------------------
  useEffect(() => {
    // Connect to a mempool-watcher ws if you have one
    const wsUrl = "ws://localhost:4000";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => console.log(`Connected to mempool watcher at ${wsUrl}`);
    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        const logMsg = `Event: ${data.event}, txHash=${data.txHash}, from=${data.txFrom}`;
        setMempoolLogs((prev) => [...prev, logMsg]);
      } catch (err) {
        console.error("Failed to parse WS message", err);
      }
    };
    ws.onerror = (err) => console.error("WebSocket error:", err);
    ws.onclose = () => console.log("WebSocket closed.");

    return () => ws.close();
  }, []);

  // ----------------------------------------------------------------------
  // Guardian: fetch AVS public key
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
  // (Right) 1. Create Token
  // ----------------------------------------------------------------------
  const createToken = async () => {
    if (!signer) return;
    try {
      // For demonstration, you'd call your "ScamTokenFactory" or something similar:
      // e.g. const factory = await ethers.getContractFactory("ScamToken", signer);
      // const token = await factory.deploy();
      // await token.deployed();
      // setCreatedToken(token.address);
      // console.log("New Token Deployed at:", token.address);
      // 
      // For now, just a placeholder:
      const fakeTokenAddr = "0xNewlyMintedToken...";
      setCreatedToken(fakeTokenAddr);
      console.log("Created new token at:", fakeTokenAddr);
    } catch (err) {
      console.error("Error creating token:", err);
    }
  };

  // ----------------------------------------------------------------------
  // (Right) 2. Add Token to Metamask
  // ----------------------------------------------------------------------
  const addTokenToMetamask = async () => {
    if (!provider || !createdToken) return;
    try {
      // Example: if your newly minted token is an ERC-20
      // you can call ethereum.request({ method: 'wallet_watchAsset', params: {...} })
      const tokenSymbol = "SCAM";
      const tokenDecimals = 18;

      await (window as any).ethereum.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: createdToken,
            symbol: tokenSymbol,
            decimals: tokenDecimals,
          },
        },
      });
      console.log("Token added to Metamask:", createdToken);
    } catch (err) {
      console.error("Failed to add token:", err);
    }
  };

  // ----------------------------------------------------------------------
  // (Left) Analyze Token with AVS
  // ----------------------------------------------------------------------
  const analyzeTokenRisk = async () => {
    try {
      setAvsError("");
      setClassification("");
      setRiskScore(null);

      const payload = {
        functionSignature: "mint", // or something relevant
        tokenAddress: tokenToAnalyze,
        deployerReputation: "Brand new deployer, likely suspicious",
        liquidityInfo: "No liquidity lock found",
        creationDate: "Just minted",
        codeAnalysis: "Minimal code, no real logic",
        recentTxHistory: "None, just deployed",
      };

      // Post to your AVS service
      const res = await fetch("http://localhost:3001/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setAvsError(json.error || "AVS error");
      } else {
        setClassification(json.classification);
        setRiskScore(json.riskScore);
      }
    } catch (err: any) {
      setAvsError(err.message);
    }
  };

  // ----------------------------------------------------------------------
  // (Right) 3. Rug the Coin (Remove Liquidity)
  // ----------------------------------------------------------------------
  const rugCoin = async () => {
    // This is a placeholder for calling your "removeLiquidity" method 
    // on a real ScamToken or DEX contract. 
    // We'll just set a flag to simulate user attempted a rug.
    console.log("User attempted to remove liquidity. Mempool watcher might front-run now...");
    setLiquidityRemoved(true);
  };

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------
  return (
    <div style={styles.container}>

      {/* ---------------- LEFT COLUMN: Risk Analysis & Mempool Logs ---------------- */}
      <div style={styles.leftColumn}>
        <h3>Token Risk Analysis</h3>
        <div style={{ marginBottom: 10 }}>
          <label>Token Address to Analyze: </label>
          <input
            style={styles.input}
            type="text"
            value={tokenToAnalyze}
            onChange={(e) => setTokenToAnalyze(e.target.value)}
            placeholder="0x1234..."
          />
          <button onClick={analyzeTokenRisk} style={styles.btn}>
            Analyze
          </button>
        </div>

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

        <hr style={styles.hr} />

        <h3>Mempool / Front-Run Logs</h3>
        <div style={{ marginBottom: 10 }}>
          <p>Monitoring for suspicious liquidity removals...</p>
        </div>
        {mempoolLogs.length === 0 && <p>No mempool logs yet...</p>}
        <ul>
          {mempoolLogs.map((log, idx) => (
            <li key={idx}>{log}</li>
          ))}
        </ul>
      </div>

      {/* ---------------- RIGHT COLUMN: Metamask, Token Creation, Rug Attempt ---------------- */}
      <div style={styles.rightColumn}>
        <h3>Metamask & Token Actions</h3>

        {!account ? (
          <button onClick={connectWallet} style={styles.btn}>
            Connect Metamask
          </button>
        ) : (
          <p>Connected: <b>{account}</b></p>
        )}

        <div style={{ marginTop: 10 }}>
          <label>Guardian Contract Address:</label>
          <input
            style={styles.input}
            type="text"
            value={guardianAddress}
            onChange={(e) => setGuardianAddress(e.target.value)}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <button onClick={fetchAvsKey} disabled={!guardianContract} style={styles.btn}>
            Fetch AVS Public Key
          </button>
          {avsPubKey && <p>AVS Key: <b>{avsPubKey}</b></p>}
        </div>

        <hr style={styles.hr} />

        <h4>Create Token</h4>
        <p>(Scam-like token for demonstration)</p>
        <button onClick={createToken} style={styles.btn}>
          Create Token
        </button>
        {createdToken && (
          <div style={{ marginTop: 5 }}>
            <p>New Token: <b>{createdToken}</b></p>
            <button onClick={addTokenToMetamask} style={styles.btn}>
              Add to Metamask
            </button>
          </div>
        )}

        <hr style={styles.hr} />

        <h4>Rug the Coin</h4>
        <button onClick={rugCoin} style={styles.btn} disabled={!createdToken}>
          Remove Liquidity (Rug)
        </button>
        {liquidityRemoved && <p style={{ color: "red" }}>Liquidity removal attempted!</p>}

        <hr style={styles.hr} />

        <h4>Guardian Contract Events</h4>
        {eventLogs.length === 0 && <p>No events yet...</p>}
        <ul>
          {eventLogs.map((log, idx) => (
            <li key={idx}>{log}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "row",
    width: "100%",
    minHeight: "100vh",
    fontFamily: "Arial, sans-serif",
  },
  leftColumn: {
    flex: 1,
    borderRight: "1px solid #ccc",
    padding: "20px",
  },
  rightColumn: {
    flex: 1,
    padding: "20px",
  },
  btn: {
    padding: "6px 12px",
    backgroundColor: "#2196f3",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    marginLeft: "8px",
  },
  input: {
    marginLeft: "6px",
    padding: "4px",
    borderRadius: "4px",
    border: "1px solid #ccc",
  },
  hr: {
    margin: "20px 0",
    border: "none",
    borderBottom: "1px solid #ccc",
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
