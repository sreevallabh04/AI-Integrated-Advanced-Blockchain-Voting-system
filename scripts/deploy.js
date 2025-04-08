/**
 * Enhanced Deployment Script
 * 
 * This script handles deployment of the Voting contract to both development
 * and production networks. For production networks, it uses the wallet defined
 * by the PRIVATE_KEY in the .env file.
 */

const fs = require('fs');
const path = require('path');
const { ethers, network } = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("\n🚀 Deploying Voting contract...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Network: ${network.name}`);
    
    // Get the deployer account
    const [deployer] = await ethers.getSigners();
    
    // Check if we're on a live network
    const isProduction = !['localhost', 'hardhat'].includes(network.name);
    if (isProduction) {
        console.log("\n🔐 PRODUCTION DEPLOYMENT DETECTED");
        
        // We should be using the account specified by PRIVATE_KEY in .env
        console.log(`Deployer address: ${deployer.address}`);
        
        // Make sure we have a private key configured
        if (!process.env.PRIVATE_KEY) {
            throw new Error("Missing PRIVATE_KEY in .env file - required for production deployment");
        }
        
        // Check if the deployer has sufficient funds
        const balance = await ethers.provider.getBalance(deployer.address);
        const balanceInEth = ethers.formatEther(balance);
        console.log(`Deployer balance: ${balanceInEth} ETH`);
        
        if (parseFloat(balanceInEth) < 0.01) {
            console.warn("⚠️ Warning: Deployer account has very low balance");
        }
    } else {
        console.log("\n🧪 DEVELOPMENT DEPLOYMENT");
        console.log(`Using development account: ${deployer.address}`);
        const balance = await ethers.provider.getBalance(deployer.address);
        console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
    }
    
    try {
        // Deploy the contract
        console.log("\n📝 Deploying contract...");
        const Voting = await ethers.getContractFactory("Voting");
        const voting = await Voting.deploy();
        
        await voting.waitForDeployment();
        const contractAddress = await voting.getAddress();
        
        console.log(`\n✅ Voting contract deployed successfully!`);
        console.log(`📍 Contract address: ${contractAddress}`);
        console.log(`🌐 Network: ${network.name}`);
        
        // Save the contract address to configuration
        if (isProduction) {
            updateEnvFile(contractAddress, network.name);
            updateProductionConfig(contractAddress, network.name);
            console.log(`\n💾 Contract address saved to configuration files`);
        }
        
        return {
            success: true,
            contractAddress,
            network: network.name
        };
    } catch (error) {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Updates the .env file with the deployed contract address
 */
function updateEnvFile(contractAddress, networkName) {
    try {
        const envPath = path.resolve(__dirname, '../.env');
        const envString = fs.existsSync(envPath) 
            ? fs.readFileSync(envPath, 'utf8') 
            : '';
        
        // Parse existing .env content
        const envLines = envString.split('\n');
        const updatedEnvLines = [];
        let contractAddressUpdated = false;
        
        // Update the VOTING_CONTRACT_ADDRESS line if it exists
        for (const line of envLines) {
            if (line.startsWith('VOTING_CONTRACT_ADDRESS=')) {
                updatedEnvLines.push(`VOTING_CONTRACT_ADDRESS=${contractAddress}`);
                contractAddressUpdated = true;
            } else {
                updatedEnvLines.push(line);
            }
        }
        
        // Add the contract address if it wasn't updated
        if (!contractAddressUpdated) {
            updatedEnvLines.push(`VOTING_CONTRACT_ADDRESS=${contractAddress}`);
        }
        
        // Write the updated content back to .env
        fs.writeFileSync(envPath, updatedEnvLines.join('\n'));
        
        console.log(`Updated .env with contract address: ${contractAddress}`);
    } catch (error) {
        console.warn(`Warning: Could not update .env file: ${error.message}`);
    }
}

/**
 * Updates the production-config.js file with the deployed contract address
 */
function updateProductionConfig(contractAddress, networkName) {
    try {
        const configPath = path.resolve(__dirname, '../production-config.js');
        if (!fs.existsSync(configPath)) {
            console.warn('Warning: production-config.js file not found. Skipping update.');
            return;
        }
        
        let configContent = fs.readFileSync(configPath, 'utf8');
        
        // Check if we're updating a testnet or mainnet
        const isMainnet = ['mainnet', 'ethereum'].includes(networkName.toLowerCase());
        const isTestnet = ['sepolia', 'goerli', 'rinkeby', 'ropsten', 'kovan'].includes(networkName.toLowerCase());
        
        if (isMainnet) {
            // Update mainnet contract address
            configContent = configContent.replace(
                /mainnetContractAddress:\s*['"].*?['"]/,
                `mainnetContractAddress: '${contractAddress}'`
            );
        } else if (isTestnet) {
            // Update testnet contract address
            configContent = configContent.replace(
                /testnetContractAddress:\s*['"].*?['"]/,
                `testnetContractAddress: '${contractAddress}'`
            );
        }
        
        // Write the updated content back to the config file
        fs.writeFileSync(configPath, configContent);
        
        console.log(`Updated production-config.js for ${networkName} with contract address: ${contractAddress}`);
    } catch (error) {
        console.warn(`Warning: Could not update production-config.js: ${error.message}`);
    }
}

// Run the deployment
if (require.main === module) {
    main()
        .then((result) => {
            if (result.success) {
                console.log("\n✨ Deployment completed successfully!");
                process.exit(0);
            } else {
                console.error("\n❌ Deployment failed:", result.error);
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error("\n❌ Unhandled error during deployment:");
            console.error(error);
            process.exit(1);
        });
}

// Export for testing or programmatic usage
module.exports = { deploy: main };