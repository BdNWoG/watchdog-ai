import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy Guardian
  const Guardian = await ethers.getContractFactory("Guardian");
  // Use the deployer's address as the avsPublicKey for now (just for demonstration)
  const guardian = await Guardian.deploy(deployer.address);
  await guardian.deployed();
  console.log("Guardian deployed to:", guardian.address);

  // 2. Deploy ScamToken
  const ScamToken = await ethers.getContractFactory("ScamToken");
  const scamToken = await ScamToken.deploy(); // no arguments needed
  await scamToken.deployed();
  console.log("ScamToken deployed to:", scamToken.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
