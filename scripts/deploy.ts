const { ethers } = require("hardhat");

//
// 1) Deploy the "old" Guardian + ScamToken
//
async function deployClassicGuardianAndScamToken() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying old Guardian & ScamToken with account:", deployer.address);

  // Deploy Guardian.sol (the original one)
  const Guardian = await ethers.getContractFactory("Guardian");
  const guardian = await Guardian.deploy(deployer.address); // avsPublicKey = deployer
  await guardian.deployed();
  console.log("Classic Guardian deployed to:", guardian.address);

  // Deploy ScamToken
  const ScamToken = await ethers.getContractFactory("ScamToken");
  const scamToken = await ScamToken.deploy();
  await scamToken.deployed();
  console.log("ScamToken deployed to:", scamToken.address);
}

//
// 2) Deploy the staked GuardianServiceManager + ServiceManager
//    and register the AVS with 1 ETH stake
//
async function deployStakedGuardianAVS() {
  const [deployer, avsOperator] = await ethers.getSigners();

  console.log("Deploying ServiceManager + GuardianServiceManager with:");
  console.log("  Deployer:", deployer.address);
  console.log("  AVS Operator:", avsOperator.address);

  // Deploy ServiceManager
  const ServiceManager = await ethers.getContractFactory("ServiceManager");
  const serviceMgr = await ServiceManager.deploy();
  await serviceMgr.deployed();
  console.log("ServiceManager deployed at:", serviceMgr.address);

  // Deploy GuardianServiceManager
  const Guardian = await ethers.getContractFactory("GuardianServiceManager");
  const guardian = await Guardian.deploy(avsOperator.address, serviceMgr.address);
  await guardian.deployed();
  console.log("Staked Guardian deployed at:", guardian.address);

  // Register AVS with 1 ETH stake (from avsOperator)
  const registerTx = await serviceMgr.connect(avsOperator).registerService(avsOperator.address, {
    value: ethers.utils.parseEther("1.0"),
  });
  await registerTx.wait();
  console.log(`AVS staked 1 ETH. AVS pubkey: ${avsOperator.address}`);
}

//
// 3) Slash the AVS
//
async function slashAVS() {
  const [deployer] = await ethers.getSigners();

  // Replace these addresses with real ones from your logs
  const SERVICE_MANAGER_ADDRESS = "0xServiceManagerHere";
  const AVS_PUBKEY = "0xAvsOperatorAddressHere";

  // For example, slash 0.3 ETH
  const slashAmount = ethers.utils.parseEther("0.3");

  const ServiceManager = await ethers.getContractFactory("ServiceManager");
  const serviceMgr = ServiceManager.attach(SERVICE_MANAGER_ADDRESS);

  const tx = await serviceMgr.connect(deployer).slash(AVS_PUBKEY, slashAmount);
  await tx.wait();

  console.log(`Slashed AVS at ${AVS_PUBKEY} by ${ethers.utils.formatEther(slashAmount)} ETH`);
}

//
// MAIN ENTRY POINT
//
async function main() {
  // Simple argument or environment check
  // e.g. "npx hardhat run scripts/deployAll.ts --tags classic"
  const args = process.argv.slice(2);
  const tagsIndex = args.indexOf("--tags");
  let mode = "classic"; // default
  if (tagsIndex !== -1 && args[tagsIndex + 1]) {
    mode = args[tagsIndex + 1];
  }

  console.log(`Running deployAll with mode: ${mode}`);

  if (mode === "classic") {
    await deployClassicGuardianAndScamToken();
  } else if (mode === "staked") {
    await deployStakedGuardianAVS();
  } else if (mode === "slash") {
    await slashAVS();
  } else {
    console.log(`Unknown mode: ${mode}`);
    console.log('Use "--tags classic", "--tags staked", or "--tags slash"');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
