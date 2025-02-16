// generateKey.js
const { ethers } = require("ethers");

function generateAVSKey() {
  const wallet = ethers.Wallet.createRandom();
  console.log("Your new AVS private key:\n", wallet.privateKey);
  console.log("Corresponding address:\n", wallet.address);
}

generateAVSKey();
