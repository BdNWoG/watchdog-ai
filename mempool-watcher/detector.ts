// mempool-watcher/detector.ts

/**
 * A map of function names to their 4-byte signatures.
 * Adjust the hex strings to match the real 4-byte selectors of the malicious functions.
 */
export const SuspiciousSigs: Record<string, string> = {
    // Example: rugPull => 0xd4ee1d90
    // You can add or remove items as needed.
    rugPull: "0xd4ee1d90",
    removeLiquidity: "0xbaa2abde",    // Placeholder, find real sig if necessary
    setTaxFee: "0x12345678",         // Placeholder
    blacklist: "0xabcdef12",         // Placeholder
    toggleTrading: "0x87654321",     // Placeholder
    mint: "0x40c10f19",              // Standard ERC20 mint(address,uint256)
    transferOwnership: "0xf2fde38b"  // Ownable transferOwnership(address)
  };
  
  /**
   * Extract the 4-byte function selector from the transaction data,
   * then match it against our known suspicious signatures.
   *
   * @param data The tx.data field (in hex) from mempool
   * @returns The string key (e.g., "rugPull") or null if none match
   */
  export function parseFunctionSig(data: string): string | null {
    if (!data.startsWith("0x") || data.length < 10) {
      return null; // Invalid or too short
    }
  
    // First 10 chars => "0x" + 8 hex => 4-byte selector
    const fourByte = data.slice(0, 10).toLowerCase();
  
    // Compare with suspicious signatures
    for (const [fnName, sig] of Object.entries(SuspiciousSigs)) {
      if (fourByte === sig.toLowerCase()) {
        return fnName; // e.g. "rugPull", "removeLiquidity", etc.
      }
    }
    return null;
  }
  