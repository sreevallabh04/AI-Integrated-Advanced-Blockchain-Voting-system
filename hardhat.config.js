require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require('dotenv').config(); // Load environment variables from .env file

const { PRIVATE_KEY, RPC_URL } = process.env;

// Basic validation to ensure environment variables are set
if (!PRIVATE_KEY) {
  console.warn("PRIVATE_KEY environment variable is not set. Deployment to live networks will fail.");
}
if (!RPC_URL) {
  console.warn("RPC_URL environment variable is not set. Deployment to live networks will fail.");
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Configuration for the network specified in your .env file
    // You can rename 'sepolia' if you are using a different network
    sepolia: {
      url: RPC_URL || "", // Use the RPC URL from .env
      // accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [], // Removed accounts for now to avoid validation error with placeholder key
    },
    // Keep localhost for local testing if needed
    localhost: {
      url: "http://127.0.0.1:8545",
      // Accounts are typically managed by the local node itself (e.g., npx hardhat node)
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
