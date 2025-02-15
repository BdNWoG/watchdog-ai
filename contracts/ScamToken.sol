// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

contract MultiScamToken {
    event RugPulled(address indexed rugger);
    event TaxFeeSet(uint256 fee);
    event Blacklisted(address indexed user);
    event Minted(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);

    address public owner;
    uint256 public taxFee;

    constructor() {
        owner = msg.sender;
    }

    function removeLiquidity() external {
        emit RugPulled(msg.sender);
        // pretend to remove from Uniswap, etc.
    }

    function setTaxFee(uint256 _fee) external {
        require(msg.sender == owner, "not owner");
        taxFee = _fee;
        emit TaxFeeSet(_fee);
    }

    function blacklist(address user) external {
        require(msg.sender == owner, "not owner");
        emit Blacklisted(user);
    }

    function toggleTrading(bool enabled) external {
        require(msg.sender == owner, "not owner");
        // emit an event, or do something
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        emit Minted(to, amount);
    }

    function transferOwnership(address newOwner) external {
        require(msg.sender == owner, "not owner");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
