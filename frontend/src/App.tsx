import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

// Minimal ABI for Guardian: just the functions/events we need
const GUARDIAN_ABI = [
  "function avsPublicKey() view returns (address)",
  "function autoRemoveLiquidity(address, bytes) external",
  "event AutoRemovedLiquidity(address indexed token, address indexed caller)"
];

function App() {
  // Metamask provider state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string>("");

  // Guardian contract
  const [guardianAddress, setGuardianAddress] = useState<string>("0xYourDeployedGuardianAddress"); 
  const [guardianContract, setGuardianContract] = useState<ethers.Contract | null>(null);

  // Contract data state
  const [avsPubKey, setAvsPubKey] = useState<string>("");
  const [eventLogs, setEventLogs] = useState<string[]>([]);

  // (Optional) Mempool logs from a local WebSocket
  const [mempoolLogs, setMempoolLogs] = useState<string[]>([]);

  // -----------------------------
  // 1. On page load, detect Metamask
  // -----------------------------
  useEffect(() => {
    if ((window as any).ethereum) {
      const tempProvider = new ethers.providers.Web3Provider((window as any).ethereum);
      setProvider(tempProvider);
      console.log("Metamask provider detected.");
    } else {
      console.warn("No Metamask detected.");
    }
  }, []);

  // -----------------------------
  // 2. Connect Wallet & Retrieve Signer
  // -----------------------------
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

  // -----------------------------
  // 3. Re-create Guardian contract whenever we have a signer + address
  // -----------------------------
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

  // -----------------------------
  // 4. Listen for AutoRemovedLiquidity event
  // -----------------------------
  useEffect(() => {
    if (!guardianContract) return;

    // Handler for the event
    const handleAutoRemoved = (token: string, caller: string, event: any) => {
      const msg = `AutoRemovedLiquidity: token=${token}, caller=${caller}, block=${event.blockNumber}`;
      setEventLogs((prev) => [...prev, msg]);
      console.log("AutoRemovedLiquidity event =>", msg);
    };

    guardianContract.on("AutoRemovedLiquidity", handleAutoRemoved);

    // Cleanup when the contract or component changes
    return () => {
      guardianContract.off("AutoRemovedLiquidity", handleAutoRemoved);
    };
  }, [guardianContract]);

  // -----------------------------
  // 5. Example function: read avsPublicKey
  // -----------------------------
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

  // -----------------------------
  // 6. Call autoRemoveLiquidity
  // -----------------------------
  const callRemoveLiquidity = async () => {
    if (!guardianContract) return;
    try {
      // For demo, pass a dummy token + signature
      const tokenAddress = "0x0000000000000000000000000000000000000000";
      const dummySignature = "0x1234";

      const tx = await guardianContract.autoRemoveLiquidity(tokenAddress, dummySignature);
      console.log("Tx sent:", tx.hash);
      const receipt = await tx.wait();
      console.log("Tx mined:", receipt.transactionHash);
    } catch (err) {
      console.error("Error calling removeLiquidity:", err);
    }
  };

  // -----------------------------
  // 7. (Optional) Subscribe to Mempool Watcher logs via WebSocket
  // -----------------------------
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

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div style={{ padding: "20px" }}>
      <h2>WatchDog AI Frontend</h2>
      {!account ? (
        <button onClick={connectWallet}>Connect Metamask</button>
      ) : (
        <p>Wallet Connected: {account}</p>
      )}

      <div style={{ marginTop: 20 }}>
        <label>Guardian Contract Address:</label>
        <input
          style={{ width: "400px", marginLeft: "5px" }}
          type="text"
          value={guardianAddress}
          onChange={(e) => setGuardianAddress(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={fetchAvsKey} disabled={!guardianContract}>
          Fetch AVS Public Key
        </button>
        {avsPubKey && <p>AVS Public Key: {avsPubKey}</p>}
      </div>

      <div style={{ marginTop: 20 }}>
        <button onClick={callRemoveLiquidity} disabled={!guardianContract}>
          Call autoRemoveLiquidity
        </button>
      </div>

      <hr style={{ margin: "20px 0" }} />

      <h3>Guardian Contract Events</h3>
      {eventLogs.length === 0 && <p>No events yet...</p>}
      <ul>
        {eventLogs.map((log, idx) => (
          <li key={idx}>{log}</li>
        ))}
      </ul>

      <hr style={{ margin: "20px 0" }} />

      <h3>Mempool Watcher Logs (WebSocket)</h3>
      {mempoolLogs.length === 0 && <p>No mempool logs yet...</p>}
      <ul>
        {mempoolLogs.map((log, idx) => (
          <li key={idx}>{log}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
