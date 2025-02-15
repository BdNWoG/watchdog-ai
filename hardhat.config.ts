import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
require("@nomicfoundation/hardhat-toolbox");

import * as dotenv from "dotenv";

dotenv.config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://eth-goerli.g.alchemy.com/v2/ABC123";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x59c6995e998f97a5a..."; // TODO: Replace with an actual test key

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      chainId: 31337
    },
    goerli: {
      url: GOERLI_RPC_URL,
      accounts: [PRIVATE_KEY]
    }
  }
};

export default config;
