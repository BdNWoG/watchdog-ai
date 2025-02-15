import { expect, use } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";
import { solidity } from "ethereum-waffle";
use(solidity);
import chaiAsPromised from "chai-as-promised";

use(chaiAsPromised);
const { ethers } = require("hardhat");

describe("Guardian Contract", function () {
  it("Should deploy Guardian and store the AVS public key", async function () {
    const [deployer] = await ethers.getSigners();
    const Guardian = await ethers.getContractFactory("Guardian");
    const guardian = await Guardian.deploy(deployer.address);
    await guardian.deployed();

    expect(await guardian.avsPublicKey()).to.equal(deployer.address);
  });

  it("Should call autoRemoveLiquidity successfully with a correct signature", async function () {
    const [deployer] = await ethers.getSigners();
    const Guardian = await ethers.getContractFactory("Guardian");
    const guardian = await Guardian.deploy(deployer.address);
    await guardian.deployed();

    // Construct the message hash (token + "MALICIOUS")
    const tokenAddress = "0x1000000000000000000000000000000000000000";
    const msgHash = ethers.utils.solidityKeccak256(["address", "string"], [tokenAddress, "MALICIOUS"]);
    const ethSignedMsgHash = ethers.utils.hashMessage(ethers.utils.arrayify(msgHash));

    // Sign with deployer (which is the avsPublicKey)
    const signature = await deployer.signMessage(ethers.utils.arrayify(msgHash));

    // Should succeed
    await expect(
      guardian.autoRemoveLiquidity(tokenAddress, signature)
    ).to.emit(guardian, "AutoRemovedLiquidity");
  });
});
