// contracts/GuardianServiceManager.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * Minimal interface to call isRegistered(avsPubKey)
 * from the ServiceManager
 */
interface IServiceManager {
    function isRegistered(address avsPubKey) external view returns (bool);
}

contract GuardianServiceManager {
    address public avsPublicKey;
    address public serviceManager; // The address of our mock ServiceManager

    constructor(address _avsPublicKey, address _serviceManager) {
        avsPublicKey = _avsPublicKey;
        serviceManager = _serviceManager;
    }

    /**
     * @notice A general defense function that checks:
     *  1. AVS is staked & registered (not slashed)
     *  2. Valid signature from AVS
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
        require(_isAvsRegistered(avsPublicKey), "AVS not registered/slashed");

        // verify signature
        require(_verifyAVSSignature(token, method, avsSignature), "Invalid AVS signature");

        // emit for demonstration
        emit DefenseActionTaken(token, method, msg.sender);
    }

    function _isAvsRegistered(address avs) internal view returns (bool) {
        return IServiceManager(serviceManager).isRegistered(avs);
    }

    function _verifyAVSSignature(
        address token,
        string calldata method,
        bytes calldata avsSignature
    ) internal view returns (bool) {
        // Example: sign keccak256(abi.encodePacked(token, method, "MALICIOUS"))
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

    event DefenseActionTaken(address indexed token, string method, address indexed caller);
}
