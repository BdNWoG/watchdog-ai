// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ScamToken
 * @dev This contract simulates a malicious token with a rugPull function.
 *      In a real scenario, it might call removeLiquidity on a DEX.
 */
contract ScamToken {
    event RugPulled(address indexed rugger);

    function rugPull() external {
        // For demonstration, just emit an event
        emit RugPulled(msg.sender);

        // TODO: A real malicious contract might remove liquidity from Uniswap, etc.
    }
}
