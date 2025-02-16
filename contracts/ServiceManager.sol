// contracts/ServiceManager.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

/**
 * @title ServiceManager
 * @dev A mock contract simulating how an "EigenLayer Service Manager" might work:
 *      - Register a service/AVS with some stake
 *      - Slash the stake if misbehavior is proven
 *      - Withdraw stake if no longer providing the service
 */
contract ServiceManager {
    struct ServiceInfo {
        address serviceOwner;  // who controls the AVS
        bool registered;
        uint256 stake;
    }

    // Map: avsPublicKey -> ServiceInfo
    mapping(address => ServiceInfo) public services;

    event ServiceRegistered(address indexed avsPubKey, uint256 stakeAmount);
    event ServiceSlashed(address indexed avsPubKey, uint256 slashAmount);
    event StakeWithdrawn(address indexed avsPubKey, uint256 amount);

    /**
     * @notice Register (or top-up) an AVS with stake (in ETH).
     *         In real EigenLayer, you'd deposit LSD tokens or use official staking logic.
     * @param avsPubKey The address representing the AVS's public key
     */
    function registerService(address avsPubKey) external payable {
        require(msg.value > 0, "Must stake something");
        ServiceInfo storage svc = services[avsPubKey];
        svc.serviceOwner = msg.sender;
        svc.stake += msg.value;
        svc.registered = true;
        emit ServiceRegistered(avsPubKey, msg.value);
    }

    /**
     * @notice Slash a service if proven malicious. (Anyone can call here for simplicity.)
     * @param avsPubKey The AVS's public key (address)
     * @param slashAmount The amount of stake to slash (in wei)
     */
    function slash(address avsPubKey, uint256 slashAmount) external {
        ServiceInfo storage svc = services[avsPubKey];
        require(svc.registered, "Service not registered");
        require(svc.stake >= slashAmount, "Slash too large");

        svc.stake -= slashAmount;

        // "Burn" the slashed stake. In a real scenario, it might go to a treasury or penalty pool
        emit ServiceSlashed(avsPubKey, slashAmount);

        if (svc.stake == 0) {
            svc.registered = false;
        }
    }

    /**
     * @notice Withdraw stake if you're the service owner
     * @param avsPubKey The AVS's address
     * @param amount The amount to withdraw (in wei)
     */
    function withdrawStake(address avsPubKey, uint256 amount) external {
        ServiceInfo storage svc = services[avsPubKey];
        require(svc.registered, "Not registered");
        require(msg.sender == svc.serviceOwner, "Not service owner");
        require(svc.stake >= amount, "Insufficient stake");

        svc.stake -= amount;
        payable(msg.sender).transfer(amount);

        emit StakeWithdrawn(avsPubKey, amount);

        if (svc.stake == 0) {
            svc.registered = false;
        }
    }

    /**
     * @notice Check if a given AVS address is still registered (has nonzero stake).
     * @param avsPubKey The AVS's public key (address)
     * @return bool True if registered and stake > 0
     */
    function isRegistered(address avsPubKey) external view returns (bool) {
        ServiceInfo memory svc = services[avsPubKey];
        return (svc.registered && svc.stake > 0);
    }
}
