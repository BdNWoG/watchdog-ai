// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract Guardian {
    address public avsPublicKey;

    constructor(address _avsPublicKey) {
        avsPublicKey = _avsPublicKey;
    }

    /**
     * @notice A general defense function that checks a "method" and signature
     *         before deciding how to respond (remove liquidity, auto-sell, freeze, etc.).
     *
     * @param token The address of the token (or malicious contract).
     * @param method The suspicious function name or ID (e.g. "removeLiquidity", "mint", etc.).
     * @param avsSignature The signature from the AVS confirming malicious classification
     */
    function autoDefenseAction(
        address token,
        string calldata method,
        bytes calldata avsSignature
    ) external {
        // 1. Verify signature
        require(_verifyAVSSignature(token, method, avsSignature), "Invalid AVS signature");

        // 2. Based on `method`, do something different:
        if (_stringEq(method, "removeLiquidity")) {
            // e.g. remove liquidity or block the dev
            emit DefenseActionTaken(token, method, msg.sender);
        } else if (_stringEq(method, "setTaxFee")) {
            // e.g. auto-sell user tokens to avoid 99% tax
            emit DefenseActionTaken(token, method, msg.sender);
        } else if (_stringEq(method, "blacklist")) {
            // e.g. preemptively move user tokens or freeze dev
            emit DefenseActionTaken(token, method, msg.sender);
        } else if (_stringEq(method, "mint")) {
            // e.g. auto-sell if dev minted infinite tokens
            emit DefenseActionTaken(token, method, msg.sender);
        } else if (_stringEq(method, "transferOwnership")) {
            // e.g. remove liquidity or freeze contract
            emit DefenseActionTaken(token, method, msg.sender);
        } else {
            // fallback, just emit
            emit DefenseActionTaken(token, method, msg.sender);
        }
    }

    // ========== Signature Verification ==========

    function _verifyAVSSignature(
        address token,
        string calldata method,
        bytes calldata avsSignature
    ) internal view returns (bool) {
        // e.g. the AVS provides "MALICIOUS" classification
        // We'll combine token + method + "MALICIOUS" in a single msg
        bytes32 msgHash = keccak256(abi.encodePacked(token, method, "MALICIOUS"));

        address signer = _recoverSigner(msgHash, avsSignature);
        return (signer == avsPublicKey);
    }

    function _recoverSigner(bytes32 msgHash, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );

        require(signature.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }

        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function _stringEq(string memory a, string memory b) internal pure returns (bool) {
        return (keccak256(bytes(a)) == keccak256(bytes(b)));
    }

    // ========== Events ==========

    event DefenseActionTaken(address indexed token, string method, address indexed caller);
}
