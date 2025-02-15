// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title Guardian
 * @dev A contract that allows an "AVS" (off-chain AI) to authorize
 *      protective liquidity moves.
 */
contract Guardian {
    address public avsPublicKey;

    constructor(address _avsPublicKey) {
        avsPublicKey = _avsPublicKey;
    }

    /**
     * @notice A protective function that can remove liquidity or do something else
     *         only if verified by the AVS signature.
     *
     * @param token The address of the token or scam contract
     * @param avsSignature The signature from the AVS confirming malicious classification
     */
    function autoRemoveLiquidity(
        address token,
        bytes calldata avsSignature
    ) external {
        require(_verifyAVSSignature(token, avsSignature), "Invalid AVS signature");

        // TODO: Interact with a DEX to remove liquidity, etc.
        // For demonstration, we'll just emit an event.
        emit AutoRemovedLiquidity(token, msg.sender);
    }

    function _verifyAVSSignature(
        address token,
        bytes calldata avsSignature
    ) internal view returns (bool) {
        // Construct the message: keccak256(abi.encodePacked(token, "MALICIOUS"))
        bytes32 msgHash = keccak256(abi.encodePacked(token, "MALICIOUS"));

        // Recover the signer
        address signer = _recoverSigner(msgHash, avsSignature);

        // Must match the avsPublicKey
        return (signer == avsPublicKey);
    }

    function _recoverSigner(bytes32 msgHash, bytes calldata signature)
        internal
        pure
        returns (address)
    {
        // Ethereum Signed Message prefix
        bytes32 ethSignedMessageHash = _toEthSignedMessageHash(msgHash);

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    function _toEthSignedMessageHash(bytes32 hash) internal pure returns (bytes32) {
        // Implements the behavior of eth_sign
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

    function _splitSignature(bytes calldata sig)
        internal
        pure
        returns (bytes32 r, bytes32 s, uint8 v)
    {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }

    event AutoRemovedLiquidity(address indexed token, address indexed caller);
}
