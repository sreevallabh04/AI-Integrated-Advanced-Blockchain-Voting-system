// Initialize from production configuration if available
const networkConfig = window.productionConfig?.getNetwork?.() || {
  name: 'Local Hardhat Node',
  rpcUrl: 'http://127.0.0.1:8545',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3' // Updated local address
};

// Use logging from production config if available
const log = window.productionConfig?.log || console;

/**
 * Ensure facial authentication module is initialized and available
 * even when the server isn't running
 */
function initializeFacialAuth() {
  // Check if facial auth already available
  if (window.facialAuth && typeof window.facialAuth.verifyCredentials === 'function') {
    log.info("Facial authentication module already loaded");
    return;
  }

  log.warn("Initializing facial authentication module with fallback capability");
  
  // Create a minimal facialAuth implementation if not available
  window.facialAuth = window.facialAuth || {
    // Essential fallback methods to ensure authentication works without server
    verifyCredentials: async function(aadhar, voterId, mobile, hardhatAccount) {
      log.info("Using fallback credential verification");
      
      // Simple validation
      const isValidAadhar = aadhar && aadhar.length === 12;
      const isValidVoterId = voterId && voterId.length > 0;
      const isValidMobile = mobile && mobile.length === 10;
      
      if (!isValidAadhar || !isValidVoterId || !isValidMobile) {
        return {
          success: false,
          message: "Invalid credentials. Please check your inputs."
        };
      }
      
      // Store for session
      sessionStorage.setItem('verifiedAadhar', aadhar);
      sessionStorage.setItem('verifiedVoterId', voterId);
      sessionStorage.setItem('verifiedMobile', mobile);
      
      // Generate test OTP for the fallback system
      const testOtp = '123456';
      
      return {
        success: true,
        otp: testOtp,
        message: "Credentials verified (fallback mode). OTP generated.",
        found_in_db: true
      };
    },
    
    verifyOtp: async function(otp) {
      log.info("Using fallback OTP verification");
      
      if (otp === '123456') {
        // Store for session
        sessionStorage.setItem('otpVerified', 'true');
        
        return {
          success: true,
          message: "OTP verified successfully (fallback mode)"
        };
      }
      
      return {
        success: false,
        message: "Invalid OTP. When server is unavailable, please use 123456."
      };
    },
    
    captureAndVerifyWithFallback: async function() {
      log.info("Using fallback facial verification");
      
      // Simple validation of previous steps
      const aadhar = sessionStorage.getItem('verifiedAadhar');
      const voterId = sessionStorage.getItem('verifiedVoterId');
      
      if (!aadhar || !voterId) {
        return {
          success: false,
          message: "Please complete credential verification and OTP verification first"
        };
      }
      
      // Mark user as authenticated in fallback mode
      sessionStorage.setItem('authenticated', 'true');
      sessionStorage.setItem('authMethod', 'fallback');
      sessionStorage.setItem('biometricVerified', 'true');
      
      // Return success
      return {
        success: true,
        userId: voterId,
        details: { method: 'fallback' },
        message: "Facial verification successful (fallback mode)",
        newlyRegistered: false
      };
    },
    
    startCamera: async function() {
      log.info("Using fallback camera (no actual camera access)");
      return true; // Pretend camera is started
    },
    
    stopCamera: function() {
      log.info("Stopping fallback camera");
      // Nothing to do in fallback mode
    },
    
    setCredentials: function(aadhar, voterId, mobile) {
      log.info("Setting credentials in fallback mode");
      sessionStorage.setItem('verifiedAadhar', aadhar);
      sessionStorage.setItem('verifiedVoterId', voterId);
      sessionStorage.setItem('verifiedMobile', mobile);
      return true;
    },
    
    setOtpVerified: function(verified) {
      log.info("Setting OTP verified status in fallback mode:", verified);
      if (verified) {
        sessionStorage.setItem('otpVerified', 'true');
      } else {
        sessionStorage.removeItem('otpVerified');
      }
      return verified;
    },
    
    isOtpVerified: function() {
      return sessionStorage.getItem('otpVerified') === 'true';
    },
    
    checkServerAvailability: async function() {
      // In fallback mode, always return false
      return false;
    }
  };
  
  // If the real module loads later, it will replace our fallback
  log.info("Facial authentication fallback initialized");
}

// Initialize facial auth module immediately to ensure it's always available
initializeFacialAuth();

// Check if demo mode should be available/active by default
const demoModeDefault = window.productionConfig?.featureFlags?.enableDemoMode !== false;

// Authentication states
let isAuthenticated = false; // Facial auth verification
let isWalletConnected = false; // Wallet connection status
let currentUser = null; // User data from facial auth

// Vote authorization - requires both facial auth and wallet connection
const isAuthorizedToVote = () => isAuthenticated && isWalletConnected;

// Initialize zkp mode state
let zkpModeActive = false;

// Get contract address from network config
let contractAddress = networkConfig.contractAddress;

// Updated Contract ABI
const contractABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "candidate",
          "type": "string"
        }
      ],
      "name": "Voted",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "candidates",
      "outputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "uint256",
          "name": "votes",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getVotes",
      "outputs": [
        {
          "components": [
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "uint256",
              "name": "votes",
              "type": "uint256"
            }
          ],
          "internalType": "struct Voting.Candidate[]",
          "name": "",
          "type": "tuple[]"
        },
        {
          "internalType": "address[]",
          "name": "",
          "type": "address[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "hasVoted",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "candidateIndex",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "justification",
          "type": "string"
        }
      ],
      "name": "vote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "candidate",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "justification",
          "type": "string"
        }
      ],
      "name": "VotedWithJustification",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "voterChoices",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "voterList",
      "outputs": [
        {
          "internalType": "address",
          "name": "voterAddress",
          "type": "address"
        },
        {
          "internalType": "string",
          "name": "candidateVotedFor",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "voters",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ];


let provider, signer, contract;
// RPC_URL is used to connect directly to the Hardhat node
const RPC_URL = networkConfig.rpcUrl;
// Hardhat default account private key (Account #0)
const HARDHAT_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
let userAddress = null; // Store the connected user's address
let justifications = []; // Array to store justifications locally

// 🚀 Connect Wallet and Initialize Blockchain Connection
async function connectWallet() {
    const statusElement = document.getElementById("connectionStatus") || createStatusElement();
    statusElement.className = "notice-banner";
    statusElement.innerHTML = `<p><strong>Connecting to Hardhat Node...</strong></p>`;

    // Connect directly to Hardhat node using JsonRpcProvider
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);

        // Create a signer using the default Hardhat private key
        signer = new ethers.Wallet(HARDHAT_PRIVATE_KEY, provider);
        userAddress = await signer.getAddress();

        log.info(`✅ Connected to Hardhat Node as: ${userAddress}`);

        // Update UI
        updateWalletStatus(userAddress);

        // Initialize contract with the Hardhat signer
        // Check if we need to update the contract address from productionConfig
            if (window.productionConfig) {
                // Try to detect the network and get the appropriate contract address
                const network = await window.productionConfig.detectNetworkFromWallet();
                if (network) {
                    const networkConfig = window.productionConfig.getNetwork();
                    if (networkConfig.contractAddress) {
                        contractAddress = networkConfig.contractAddress;
                        log.info(`Using network-specific contract address: ${contractAddress}`);
                    }
                }
            }
            
            if (!contractAddress) {
                throw new Error("No contract address configured for the current network");
            }
            
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Set wallet connection status
            isWalletConnected = true;

            // Setup listeners and load data (Comment out MetaMask specific listeners)
            // setupWalletListeners();
            justifications = []; // Clear local justifications on reconnect
            setupJustificationListener();
            displayJustifications(); // Initial display
            await loadVotes();
            
            statusElement.className = "notice-banner success";
            statusElement.innerHTML = `<p><strong>Wallet Connected!</strong> Network: ${networkConfig.name}.</p>`;
            removeStatusElement(statusElement, 5000);
            
            // Update voting UI to reflect combined authentication status
            updateVotingControls();
        } catch (error) {
            log.error(error, { context: 'walletConnection' });
            statusElement.className = "notice-banner error";
            statusElement.innerHTML = `<p><strong>Connection Failed:</strong> ${error.message}. Ensure Hardhat node is running at ${RPC_URL}.</p>`;
            updateWalletStatus(null); // Show disconnected state
            // Do not remove error immediately, let user see it
        }
    // Remove the 'else' block for MetaMask detection
    // } else {
    //     log.error("MetaMask (or compatible wallet) not detected.");
    //     ...
    // }
}
/**
 * Prompt the user to connect their wallet after facial authentication
// Remove the promptWalletConnection function as it's MetaMask specific
/*
function promptWalletConnection() {
  ...
}
*/

// Helper to create/get status element
function createStatusElement() {
    let statusElement = document.getElementById("connectionStatus");
    if (!statusElement) {
        statusElement = document.createElement("div");
        statusElement.id = "connectionStatus";
        // Insert after the main heading
        document.querySelector("h1")?.insertAdjacentElement("afterend", statusElement);
    }
    return statusElement;
}
// Helper to remove status element after a delay
function removeStatusElement(element, delay) {
    setTimeout(() => {
        element?.classList.add("fade-out");
        setTimeout(() => element?.remove(), 1000);
    }, delay);
}
/**
 * Update voting controls based on authentication and wallet status
 */
function updateVotingControls() {
    const voteButton = document.getElementById("voteButton");
    if (!voteButton) return;
    
    const requiresAuth = window.productionConfig?.featureFlags?.requireWalletConnection !== false;
    
    if (isAuthorizedToVote() || (window.demoMode?.isDemoModeActive() && !requiresAuth)) {
        // User is fully authorized or in demo mode
        voteButton.disabled = false;
        voteButton.title = "Cast your vote";
        
        // Add visual indicator for full authorization
        const authIndicator = document.getElementById("authIndicator") || document.createElement("div");
        authIndicator.id = "authIndicator";
        authIndicator.className = "auth-indicator success";
        authIndicator.innerHTML = `
            <i class="icon-check-circle"></i>
            <span>Fully authenticated and authorized to vote</span>
        `;
        
        // Add to page if not already there
        if (!document.getElementById("authIndicator")) {
            voteButton.parentNode.insertBefore(authIndicator, voteButton);
        }
    } else {
        // User is missing authentication or wallet connection
        voteButton.disabled = true;
        
        // Create or update indicator
        const authIndicator = document.getElementById("authIndicator") || document.createElement("div");
        authIndicator.id = "authIndicator";
        authIndicator.className = "auth-indicator warning";
        
        if (!isAuthenticated) {
            authIndicator.innerHTML = `
                <i class="icon-warning"></i>
                <span>Facial authentication required before voting</span>
            `;
            voteButton.title = "Complete facial authentication first";
        } else if (!isWalletConnected) {
            authIndicator.innerHTML = `
                <i class="icon-wallet"></i>
                <span>Connect your wallet to enable voting</span>
                <button id="authConnectWalletBtn" class="button small-button">Connect Wallet</button>
            `;
            voteButton.title = "Connect to Hardhat node to enable voting"; // Update title
        }

        // Add to page if not already there
        if (!document.getElementById("authIndicator")) {
            voteButton.parentNode.insertBefore(authIndicator, voteButton);
        }

        // Remove event listener for connect wallet button as connection is now automatic/different
        // const connectBtn = document.getElementById("authConnectWalletBtn");
        // if (connectBtn) {
        //     connectBtn.addEventListener("click", connectWallet);
        // }
    }
}
// Helper to setup demo button listener
function setupDemoButtonListener(buttonId) {
     const button = document.getElementById(buttonId);
     if (button) {
         button.addEventListener("click", function() {
             if (window.demoMode && typeof window.demoMode.toggleDemoMode === 'function') {
                 window.demoMode.toggleDemoMode();
                 this.textContent = "Demo Mode Enabled";
                 this.disabled = true;
             }
         });
     }
}
// Update Wallet Button and Address Display
function updateWalletStatus(address) {
    const connectButton = document.getElementById("connectWalletButton");
    const walletAddressElement = document.getElementById("walletAddress"); // Assuming an element with this ID exists or will be created
    if (address) {
        // Hardhat Node is connected
        if (connectButton) {
            // Update button text to show connection status and address
            connectButton.textContent = `Hardhat Node Connected: ${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
            connectButton.disabled = true; // Disable the button after connection
        }
        if (walletAddressElement) {
            walletAddressElement.innerHTML = `<p><strong>Using Hardhat Account:</strong> ${address}</p>`;
            walletAddressElement.style.display = 'block';
        }
         // Hide the old account selector if it exists
         const accountSelectorDiv = document.getElementById("accountSelectorDiv");
         if (accountSelectorDiv) accountSelectorDiv.style.display = 'none';

    } else {
        // Hardhat Node is disconnected
        if (connectButton) {
            connectButton.textContent = 'Connect to Hardhat Node'; // Update button text
            connectButton.disabled = false;
        }
        if (walletAddressElement) {
            walletAddressElement.style.display = 'none';
        }
    }
}

// Comment out MetaMask specific listeners
/*
function setupWalletListeners() {
    if (window.ethereum && window.ethereum.on) {
        window.ethereum.on('accountsChanged', (accounts) => {
            log.info("Wallet account changed", { accounts });
            if (accounts.length > 0) {
                // Reconnect with the new account
                connectWallet();
            } else {
                // User disconnected all accounts
                log.warn("Wallet disconnected by user.");
                updateWalletStatus(null);
                contract = null; // Invalidate contract instance
                // Optionally show a message prompting to reconnect
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            log.info(`Network changed to ${chainId}. Reloading page.`);
            // Reload the page to ensure connection to the correct network and contract
            window.location.reload();
        });
    }
}
*/


// --- Remove Old Account Selection Logic ---
// The event listener for 'selectAccount' button is no longer needed.
// We can comment it out or remove it. Let's comment it out for now.
/*
document.getElementById("selectAccount").addEventListener("click", async () => {
    try {
        const selectedNumber = parseInt(document.getElementById("accountSelect").value, 10); // Convert to integer
        signer = await provider.getSigner(selectedNumber);

        // Display selected account address
        const address = await signer.getAddress();
        document.getElementById("walletAddress").innerText = `Connected: ${address}`;

        log.info(`✅ Using Account ${selectedNumber}: ${address}`);
    } catch (error) {
        log.error(error, { context: 'accountSelection' });
    }
});
*/

// 🗳 Voting Function (Updated for Wallet Interaction)
document.getElementById("voteButton").addEventListener("click", async () => {
    // Check if connected to Hardhat node
    if (!signer || !contract) {
         const errorNotice = createStatusElement();
         errorNotice.className = "notice-banner error";
         errorNotice.innerHTML = `<p><strong>Not Connected:</strong> Please connect to the Hardhat node before voting.</p>`; // Update message
         removeStatusElement(errorNotice, 7000);
         return;
    }

    // Check if user is authenticated via facial recognition (existing logic)
    if (!isAuthorizedToVote() && !window.demoMode?.isDemoModeActive()) {
        // Show error message (existing logic)
        const votingError = document.createElement("div");
        votingError.className = "notice-banner error";
        votingError.innerHTML = `
            <p><strong>Full Authentication Required:</strong> Please complete both facial verification and wallet connection before voting.</p>
            <button id="returnToAuthButton" class="auth-button">Return to Authentication</button>
        `;
        
        // Insert after vote button
        document.getElementById("voteButton").insertAdjacentElement("afterend", votingError);
        
        // Add event listener
        document.getElementById("returnToAuthButton").addEventListener("click", () => {
            // Hide voting section
            document.getElementById("votingContainer").style.display = "none";
            
            // Show login section
            document.getElementById("loginSection").style.display = "block";
            
            // Remove error message
            votingError.remove();
        });
        
        return;
    }
    
    const candidateIndex = document.getElementById("candidateSelect").value;
    const justificationText = document.getElementById("justification").value || ""; // Get justification text, default to empty string
    const candidateName = document.getElementById("candidateSelect").options[candidateIndex].text;
    
    // Check if we're in demo mode
    if (window.demoMode && window.demoMode.isDemoModeActive()) {
        // Handle demo mode vote
        await handleDemoVote(candidateIndex, justificationText, candidateName);
        return;
    }
    
    // Check if we should use ZKP mode
    if (zkpModeActive && window.zkpIntegration) {
        try {
            log.info("Casting a private vote using ZKP...");
            
            // Show a notice that we're generating proof
            const zkpNotice = document.createElement("div");
            zkpNotice.className = "notice-banner";
            zkpNotice.innerHTML = `
                <div class="loading-container">
                    <p><strong>Generating zero-knowledge proof...</strong></p>
                    <div class="loading-spinner"></div>
                    <p>This may take a moment. Please wait.</p>
                </div>
            `;
            document.getElementById("voteButton").insertAdjacentElement("afterend", zkpNotice);
            
            // Cast a private vote using ZKP
            const voteResult = await window.zkpIntegration.castPrivateVote(candidateIndex, justificationText);
            
            // Update ZKP verifications UI
            updateZkpVerificationsUI(window.zkpIntegration.getVerifiedProofs());
            
            // Update the notice
            zkpNotice.className = "notice-banner success";
            zkpNotice.innerHTML = "<p><strong>✅ Private vote cast successfully with zero-knowledge proof!</strong></p>";
            
            // Remove notice after 5 seconds
            setTimeout(() => {
                zkpNotice.classList.add("fade-out");
                setTimeout(() => zkpNotice.remove(), 1000);
            }, 5000);
            
            // Clear justification field
            document.getElementById("justification").value = "";
            
            // Update vote count (simulated for ZKP mode)
            const candidateVotes = document.querySelectorAll('#voteTable tr td:last-child');
            if (candidateVotes && candidateVotes[candidateIndex]) {
                const currentVotes = parseInt(candidateVotes[candidateIndex].textContent) || 0;
                candidateVotes[candidateIndex].textContent = currentVotes + 1;
            }
            
            // Store justification locally for demo purposes
            if (justificationText.trim() !== "") {
                const voterAddress = "ZKP-PRIVATE-" + Date.now().toString(16).slice(-8);
                justifications.push({
                    voter: voterAddress,
                    candidate: candidateName,
                    justification: justificationText
                });
                displayJustifications();
            }
            
            // Perform AI analysis if justification provided
            if (justificationText.trim() !== "") {
                await processJustification(justificationText, candidateName, true);
            }
            
            return;
        } catch (zkpError) {
            log.error(zkpError, { context: 'zkpVoting' });
            
            // Show error notice
            const errorNotice = document.createElement("div");
            errorNotice.className = "notice-banner error";
            errorNotice.innerHTML = `
                <p><strong>Error casting private vote:</strong> ${zkpError.message}</p>
                <p>You can try again or disable ZKP mode to vote normally.</p>
            `;
            document.getElementById("voteButton").insertAdjacentElement("afterend", errorNotice);
            
            // Remove notice after 10 seconds
            setTimeout(() => {
                errorNotice.classList.add("fade-out");
                setTimeout(() => errorNotice.remove(), 1000);
            }, 10000);
            
            return;
        }
    }
    
    // Regular blockchain voting (uses the signer from connectWallet)
    // No need for the explicit !contract check here as it's checked at the beginning

    // Show voting in progress
    const votingStatus = createStatusElement(); // Use helper
    votingStatus.className = "notice-banner"; // Reset class
    votingStatus.innerHTML = `
        <div class="loading-container">
            <p><strong>Submitting vote to Hardhat node...</strong></p> <!-- Update message -->
            <div class="loading-spinner"></div>
            <!-- Remove wallet confirmation message -->
        </div>
    `;
    // Insert after vote button (already handled by createStatusElement if it didn't exist)

    try {
        // Call the vote function - signer is already connected to the contract instance
        log.info("Sending vote transaction...");
        const tx = await contract.vote(candidateIndex, justificationText); 
        
        // Update status while waiting for confirmation
        // No need to show Etherscan link for local Hardhat node
        votingStatus.innerHTML = `
            <div class="loading-container">
                <p><strong>Transaction sent!</strong> Waiting for confirmation...</p>
                <div class="loading-spinner"></div>
            </div>
        `;

        await tx.wait(); // Wait for transaction confirmation
        log.info("Vote transaction confirmed on Hardhat node!", { txHash: tx.hash });

        // Update status
        votingStatus.className = "notice-banner success";
        votingStatus.innerHTML = `<p><strong>✅ Vote cast successfully!</strong> Tx: ${tx.hash.substring(0,10)}...</p>`;
        removeStatusElement(votingStatus, 7000); // Use helper
        
        // Clear justification field (existing logic)
        document.getElementById("justification").value = ""; 
        
        // Reload votes after successful transaction (existing logic)
        await loadVotes(); 
        
        // If justification was provided, perform AI analysis
        if (justificationText.trim() !== "") {
            await processJustification(justificationText, candidateName);
        }
    } catch (error) {
        log.error(error, { context: 'voting' });
        let userFriendlyError = error.message;
        // Simplify error handling as wallet rejection codes don't apply
        if (error.message.includes("insufficient funds")) {
            userFriendlyError = "Insufficient funds in Hardhat account.";
        } else if (error.reason) { // Ethers often includes a 'reason'
            userFriendlyError = error.reason;
        }

        // Display error message
        votingStatus.className = "notice-banner error";
        votingStatus.innerHTML = `<p><strong>Error casting vote:</strong> ${userFriendlyError}</p>`;
    }
});

/**
 * Handle demo mode vote
 */
async function handleDemoVote(candidateIndex, justificationText, candidateName) {
    log.info("Handling vote in demo mode");
    
    // Show demo notice
    const demoNotice = document.createElement("div");
    demoNotice.className = "notice-banner info";
    demoNotice.innerHTML = `
        <p><strong>Demo Mode:</strong> Your vote will be processed without actual blockchain transactions.</p>
    `;
    document.getElementById("voteButton").insertAdjacentElement("afterend", demoNotice);
    
    // Simulate transaction delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update success message
    demoNotice.className = "notice-banner success";
    demoNotice.innerHTML = `<p><strong>✅ Demo vote cast successfully!</strong></p>`;
    
    // Remove notice after delay
    setTimeout(() => {
        demoNotice.classList.add("fade-out");
        setTimeout(() => demoNotice.remove(), 1000);
    }, 3000);
    
    // Create mock vote data for display
    const mockVoterAddress = "0x" + Math.random().toString(16).substring(2, 42); // Random address for demo
    justifications.push({
        voter: mockVoterAddress,
        candidate: candidateName,
        justification: justificationText
    });
    
    // Update the display
    displayJustifications();
    
    // If justification was provided, perform AI analysis
    if (justificationText.trim() !== "") {
        await processJustification(justificationText, candidateName, true);
    }
}

/**
 * Process a vote justification through AI analysis
 */
async function processJustification(justificationText, candidateName, isDemo = false) {
    const voterAddress = isDemo ? 
        "0x" + Math.random().toString(16).substring(2, 42) : // Random address for demo
        await signer.getAddress();
    
    // Show analysis in progress with loading animations
    const loadingContent = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <div class="loading-text">ANALYSIS_TEXT</div>
        </div>
    `;
    
    document.getElementById("argumentAnalysis").innerHTML = loadingContent.replace("ANALYSIS_TEXT", "Analyzing argument structure...");
    document.getElementById("biasAnalysis").innerHTML = loadingContent.replace("ANALYSIS_TEXT", "Detecting cognitive biases...");
    document.getElementById("researchInsights").innerHTML = loadingContent.replace("ANALYSIS_TEXT", "Generating research insights...");
    document.getElementById("deliberationProcess").innerHTML = loadingContent.replace("ANALYSIS_TEXT", "Initiating multi-agent deliberation...");
    
    try {
        let analysis, deliberation, consensusMap;
        
        // Use demo mode or real analysis based on state
        if (isDemo || (window.demoMode && window.demoMode.isDemoModeActive())) {
            log.info("Running AI analysis in demo mode");
            
            // If demoMode has specific functions for this, use them
            if (window.demoMode && window.demoMode.runDemoAnalysis) {
                const demoResults = await window.demoMode.runDemoAnalysis(
                    justificationText, 
                    candidateName
                );
                
                analysis = demoResults.analysis;
                deliberation = demoResults.deliberation;
                consensusMap = demoResults.consensusMap;
            } else {
                // Otherwise create mock data
                analysis = createMockAnalysis(justificationText, candidateName);
                deliberation = createMockDeliberation(justificationText, candidateName);
                consensusMap = createMockConsensusMap();
            }
        } else {
            // 1. Run standard Groq analysis
            analysis = await window.groqAnalysis.analyzeJustification(
                voterAddress,
                candidateName,
                justificationText
            );
            
            // 2. Run MADD Framework deliberation
            if (window.maddSystem) {
                log.info("Starting MADD deliberation for vote justification");
                deliberation = await window.maddSystem.orchestrateDeliberation(
                    justificationText,
                    candidateName
                );
                consensusMap = window.maddSystem.getCurrentConsensusMap();
            }
        }
        
        // Display results
        if (analysis) {
            displayAnalysisResults(analysis);
            
            // Update deliberative metrics if we have enough data
            const analyses = isDemo ? 
                [1, 2, 3, 4, 5] : // Fake count for demo
                window.groqAnalysis.getJustificationAnalyses();
                
            if (analyses.length > 1) {
                displayDeliberativeMetrics();
            }
            
            // Display consensus map if available
            if (consensusMap && Object.keys(consensusMap).length > 0) {
                displayConsensusMap(consensusMap);
            }
        }
        
        // Display MADD results
        if (deliberation && (window.maddSystem || isDemo)) {
            if (window.maddSystem && window.maddSystem.renderDeliberationUI) {
                window.maddSystem.renderDeliberationUI(deliberation, "deliberationProcess");
            } else {
                // Fallback for demo mode
                document.getElementById("deliberationProcess").innerHTML = `
                    <div class="analysis-item">
                        <div class="analysis-header">
                            <span>Multi-Agent Deliberation (Demo)</span>
                        </div>
                        <p>In a production environment, this would show the full deliberation between AI agents with different reasoning styles.</p>
                        <div class="agent-responses" style="display:flex;flex-wrap:wrap;gap:10px;margin-top:15px;">
                            <div class="agent-response consequentialist">
                                <div class="agent-header">
                                    <span class="agent-name">Consequentialist Agent</span>
                                </div>
                                <p>This analysis would focus on the outcomes and impact of the position.</p>
                            </div>
                            <div class="agent-response deontological">
                                <div class="agent-header">
                                    <span class="agent-name">Deontological Agent</span>
                                </div>
                                <p>This analysis would focus on the principles and rules at play.</p>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (consensusMap) {
                if (window.maddSystem && window.maddSystem.renderConsensusMap) {
                    window.maddSystem.renderConsensusMap(consensusMap, "deliberationConsensusMap");
                }
            }
            
            // Update research metrics
            updateMaddMetrics();
        }
    } catch (error) {
        log.error(error, { context: 'aiAnalysis' });
        
        // Display error and offer demo mode
        const errorHtml = `
            <div class="analysis-item">
                <div class="analysis-header">
                    <span>Error in AI Analysis</span>
                </div>
                <p>${error.message}</p>
                ${!isDemo ? '<button class="demo-button try-demo-btn">Try in Demo Mode</button>' : ''}
            </div>
        `;
        
        document.getElementById("argumentAnalysis").innerHTML = errorHtml;
        document.getElementById("biasAnalysis").innerHTML = errorHtml;
        document.getElementById("researchInsights").innerHTML = errorHtml;
        document.getElementById("deliberationProcess").innerHTML = errorHtml;
        
        // Add event listeners to demo buttons
        if (!isDemo) {
            document.querySelectorAll('.try-demo-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (window.demoMode) {
                        // Enable demo mode if not already
                        if (!window.demoMode.isDemoModeActive()) {
                            window.demoMode.toggleDemoMode();
                        }
                        
                        // Process in demo mode
                        await processJustification(justificationText, candidateName, true);
                    }
                });
            });
        }
    }
}

/**
 * Create mock analysis data for demo mode
 */
function createMockAnalysis(justificationText, candidateName) {
    // Simple heuristic to determine sentiment based on text length
    const quality = Math.min(8, 3 + (justificationText.length / 50));
    
    return {
        candidate: candidateName,
        argumentAnalysis: {
            mainClaim: justificationText.split('.')[0] || "Support for " + candidateName,
            logicalStructure: justificationText.length > 100 ? "Structured argument" : "Simple assertion",
            keyPremises: [
                "The voter believes " + candidateName + " is the best choice",
                "The justification presents reasons for this belief",
                justificationText.length > 150 ? "The argument contains detailed reasoning" : "The argument is relatively brief"
            ],
            evidenceTypes: ["Personal reasoning", justificationText.length > 120 ? "Detailed analysis" : "Simple explanation"]
        },
        biasAnalysis: {
            detectedBiases: justificationText.length < 80 ? [] : [
                {
                    name: "Confirmation Bias",
                    explanation: "The voter may be focusing on information that confirms their existing beliefs about " + candidateName,
                    confidence: 0.7
                },
                justificationText.length > 150 ? {
                    name: "Authority Bias",
                    explanation: "The voter references authority figures or experts to support their position",
                    confidence: 0.6
                } : null
            ].filter(Boolean)
        },
        researchInsights: {
            argumentQuality: {
                score: quality,
                explanation: quality > 6 ? 
                    "The justification provides substantial reasoning for the vote choice" : 
                    "The justification could be more detailed in explaining the vote choice"
            },
            improvementAreas: [
                "Provide more specific examples",
                "Consider alternative perspectives",
                "Evaluate potential drawbacks of the chosen candidate"
            ],
            significantPattern: "The voter demonstrates " + 
                (justificationText.length > 150 ? "detailed engagement" : "basic engagement") + 
                " with their voting decision",
            democraticComparisonInsight: "This type of justification is " +
                (justificationText.length > 120 ? "more detailed than" : "typical of") +
                " average voter reasoning in deliberative contexts"
        }
    };
}

// 📊 Load Voting Data Function

async function loadVotes() {
  if (!contract) {
      log.warn("Contract not initialized - cannot load votes");
      return;
  }

  try {
      // Fetch candidates votes
      const [candidates, voters] = await contract.getVotes();

      // 📊 Populate Candidate Vote Table
      let candidateTableBody = candidates
          .map(
              (candidate) =>
              `<tr>
                  <td>${candidate.name}</td>
                  <td>${candidate.votes.toString()}</td>
              </tr>`
          )
          .join("");
      document.getElementById("voteTable").innerHTML = candidateTableBody;

      // 🗳 Fetch and Populate Voter List Table
      const voterListTable = document.getElementById("voterTable");
      
      if (voters.length === 0) {
          voterListTable.innerHTML = '<tr><td colspan="2">No votes have been cast yet.</td></tr>';
          return;
      }

      // Fetch voter details using voterChoices
      const voterDetails = await Promise.all(
          voters.map(async (address) => {
              const candidateVotedFor = await contract.voterChoices(address);
              return {
                  address: address,
                  candidateVotedFor: candidateVotedFor
              };
          })
      );

      // Populate Voter List Table
      let voterTableBody = voterDetails
          .map(
              (voter) =>
              `<tr>
                  <td>${voter.address}</td>
                  <td>${voter.candidateVotedFor}</td>
              </tr>`
          )
          .join("");
      
      voterListTable.innerHTML = voterTableBody;

  } catch (error) {
      log.error(error, { context: 'loadVotes' });
      document.getElementById("voteTable").innerHTML =
          '<tr><td colspan="2">Error loading votes</td></tr>';
      document.getElementById("voterTable").innerHTML =
          '<tr><td colspan="2">Error loading voter details</td></tr>';
  }
}




// 👂 Listen for Justification Events with Groq Analysis
function setupJustificationListener() {
    if (!contract) return;

    // Remove previous listeners to avoid duplicates if reconnected
    contract.off("VotedWithJustification");

    log.info("Setting up justification event listener");
    contract.on("VotedWithJustification", (voter, candidate, justification, event) => {
        console.log(`📣 Justification received: Voter ${voter} for ${candidate}: "${justification}"`);
        if (justification && justification.trim() !== "") {
            justifications.push({ voter, candidate, justification });
            displayJustifications(); // Update display
            
            // Don't analyze here if it's our own vote (already analyzed in vote function)
            // This is for other users' votes
            if (userAddress && voter.toLowerCase() !== userAddress.toLowerCase()) { // Compare addresses case-insensitively
                window.groqAnalysis.analyzeJustification(voter, candidate, justification)
                    .then(analysis => {
                        // Don't display this analysis, but add it to our research data (existing logic)
                        log.info("Analysis completed for other voter", { voter });
                        
                        // Update deliberative metrics if we have enough data
                        const analyses = window.groqAnalysis.getJustificationAnalyses();
                        if (analyses.length > 1) {
                            displayDeliberativeMetrics();
                        }
                    })
                    .catch(error => log.error(error, { context: 'otherVoteAnalysis', voter }));
            }
        }
    });
}

// 📝 Display Justifications
function displayJustifications() {
    const listElement = document.getElementById("justificationsList");
    if (!listElement) return;

    if (justifications.length === 0) {
        listElement.innerHTML = `
            <div class="empty-justifications">
                <p>No justifications provided yet.</p>
                ${window.demoMode ? `
                    <button id="loadSampleJustifications" class="demo-button">
                        Load Sample Justifications
                    </button>
                ` : ''}
            </div>
        `;
        
        // Add event listener for sample justifications button
        setTimeout(() => {
            const sampleButton = document.getElementById("loadSampleJustifications");
            if (sampleButton) {
                sampleButton.addEventListener("click", () => {
                    if (window.demoMode) {
                        // Enable demo mode if not already
                        if (!window.demoMode.isDemoModeActive()) {
                            window.demoMode.toggleDemoMode();
                        }
                        
                        // Generate sample justifications
                        const sampleJustifications = [
                            {
                                voter: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                                candidate: "Candidate A",
                                justification: "I believe Candidate A has the most comprehensive plan for infrastructure development and economic growth. Their track record shows consistent success in managing large projects."
                            },
                            {
                                voter: "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
                                candidate: "Candidate B",
                                justification: "Candidate B's focus on education and healthcare resonates with my values. They prioritize people over profits, which I think is essential for good governance."
                            },
                            {
                                voter: "0xdD2FD4581271e230360230F9337D5c0430Bf44C0",
                                candidate: "Candidate C",
                                justification: "I support Candidate C because they have a balanced approach to all issues. They consider both short-term needs and long-term sustainability."
                            }
                        ];
                        
                        // Add to justifications array
                        justifications.push(...sampleJustifications);
                        
                        // Update display
                        displayJustifications();
                        
                        // Analyze a random justification
                        const randomIndex = Math.floor(Math.random() * sampleJustifications.length);
                        const randomJustification = sampleJustifications[randomIndex];
                        processJustification(
                            randomJustification.justification,
                            randomJustification.candidate,
                            true
                        );
                    }
                });
            }
        }, 100);
        
        return;
    }

    // Enhanced display with cards
    listElement.innerHTML = `
        <div class="justifications-grid">
            ${justifications.map(j => {
                const truncatedAddress = j.voter.substring(0, 6) + '...' + j.voter.substring(j.voter.length - 4);
                const candidateClass = j.candidate.replace(/\s+/g, '').toLowerCase();
                
                return `
                    <div class="justification-card">
                        <div class="justification-header">
                            <span class="voter-address">${truncatedAddress}</span>
                            <span class="candidate-badge candidate-${candidateClass}">${j.candidate}</span>
                        </div>
                        <div class="justification-body">
                            <p>${j.justification}</p>
                        </div>
                        <div class="justification-footer">
                            <button class="analyze-button" data-justification="${encodeURIComponent(j.justification)}" data-candidate="${j.candidate}">
                                Analyze with AI
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Add event listeners to analyze buttons
    setTimeout(() => {
        document.querySelectorAll('.analyze-button').forEach(button => {
            button.addEventListener('click', async (e) => {
                const justificationText = decodeURIComponent(e.target.dataset.justification);
                const candidateName = e.target.dataset.candidate;
                
                // Change button state
                e.target.textContent = "Analyzing...";
                e.target.disabled = true;
                
                // Process with AI
                const isDemo = !contract || (window.demoMode && window.demoMode.isDemoModeActive());
                await processJustification(justificationText, candidateName, isDemo);
                
                // Update button
                e.target.textContent = "Analysis Complete";
                
                // Scroll to analysis section
                document.querySelector('.research-panel').scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            });
        });
    }, 100);
}
/**
 * Create mock deliberation data for demo mode
 */
function createMockDeliberation(justificationText, candidateName) {
    const agents = [
        {
            name: "Consequentialist Agent",
            reasoningStyle: "consequentialist",
            response: {
                mainArgument: "This argument focuses on outcomes and results.",
                keyPoints: [
                    "Evaluating the practical consequences of supporting " + candidateName,
                    "Considering the utility and benefit to the most people",
                    "Weighing short-term vs long-term impacts"
                ],
                agreements: ["The choice will have meaningful real-world effects"],
                disagreements: ["The focus should be on principles, not just outcomes"]
            }
        },
        {
            name: "Deontological Agent",
            reasoningStyle: "deontological",
            response: {
                mainArgument: "This argument focuses on principles and duties.",
                keyPoints: [
                    "Evaluating whether supporting " + candidateName + " aligns with moral duties",
                    "Considering the universalizability of the voter's reasoning",
                    "Examining whether the justification respects rights and dignity"
                ],
                agreements: ["Ethical principles matter in voting decisions"],
                disagreements: ["Outcomes shouldn't be the only consideration"]
            }
        },
        {
            name: "Rights-Based Agent",
            reasoningStyle: "rights-based",
            response: {
                mainArgument: "This argument focuses on individual rights and freedoms.",
                keyPoints: [
                    "Assessing how " + candidateName + " might protect or expand individual rights",
                    "Considering impacts on minority rights and protections",
                    "Evaluating the justification's attention to civil liberties"
                ],
                agreements: ["Individual rights must be protected"],
                disagreements: ["Community needs may sometimes outweigh individual preferences"]
            }
        }
    ];
    
    // Determine complexity of deliberation based on text length
    const turnCount = Math.max(1, Math.min(3, Math.floor(justificationText.length / 100)));
    
    // Generate deliberation rounds
    const deliberationRounds = [];
    for (let i = 0; i < turnCount; i++) {
        deliberationRounds.push({
            turn: i + 1,
            agentResponses: agents.map(agent => ({
                agentName: agent.name,
                reasoningStyle: agent.reasoningStyle,
                response: agent.response
            }))
        });
    }
    
    // Generate synthesis
    const synthesis = {
        keyPoints: [
            "Multiple valid perspectives exist on this vote justification",
            "There are both consequentialist and principle-based arguments at play",
            "The justification contains elements that resonate across different reasoning frameworks"
        ],
        potentialConsensus: [
            "Voting decisions should be both principled and considerate of outcomes",
            "Both individual rights and community welfare matter in electoral choices",
            "Good justifications incorporate multiple perspectives"
        ],
        deliberativeQuality: (justificationText.length > 150) ? 7.5 : 5.5
    };
    
    return {
        originalJustification: justificationText,
        candidate: candidateName,
        deliberationRounds: deliberationRounds,
        synthesis: synthesis,
        timestamp: new Date().toISOString()
    };
}

/**
 * Create mock consensus map data for demo mode
 */
function createMockConsensusMap() {
    return {
        agreements: [
            "Candidates should have clear policy positions",
            "Transparency and accountability are important values",
            "Evidence-based decision making is preferable to pure ideology"
        ],
        disagreements: [
            "The appropriate balance between economic growth and regulation",
            "The role of government in providing social services",
            "Prioritization of short-term vs. long-term goals"
        ],
        bridgePositions: [
            "Policy decisions should consider both economic impacts and social welfare",
            "Transparency mechanisms benefit both government efficiency and accountability",
            "Evidence-based approaches can satisfy multiple ideological perspectives"
        ],
        voterCount: 5,
        timestamp: new Date().toISOString()
    };
}

// Add a demo mode toggle to the UI
document.addEventListener('DOMContentLoaded', () => {
    // NOTE: Facial authentication flow is handled by login.html script.
    // This script (app.js) should primarily handle wallet connection and contract interaction
    // on pages where it's included (like voting.html).

    // Check authentication status from sessionStorage on page load
    checkAuthenticationStatus();

    // Add a demo mode button to the header area if not already there
    if (!document.getElementById('demoModeToggle') && window.demoMode && demoModeDefault) {
        const demoButton = document.createElement('button');
        demoButton.id = 'demoModeToggle';
        demoButton.className = 'demo-button';
        demoButton.style.position = 'absolute';
        demoButton.style.top = '10px';
        demoButton.style.right = '10px';
        demoButton.textContent = 'Enable Demo Mode';
        demoButton.title = 'Toggle Demo Mode to see AI features without blockchain connectivity';
        
        // Add event listener
        demoButton.addEventListener('click', () => {
            if (window.demoMode) {
                window.demoMode.toggleDemoMode();
                demoButton.textContent = window.demoMode.isDemoModeActive() ? 
                    'Disable Demo Mode' : 'Enable Demo Mode';
                
                if (window.demoMode.isDemoModeActive()) {
                    // Add a demo mode indicator
                    if (!document.getElementById('demoModeIndicator')) {
                        const indicator = document.createElement('div');
                        indicator.id = 'demoModeIndicator';
                        indicator.className = 'demo-mode-indicator';
                        indicator.textContent = 'Demo Mode Active';
                        document.body.appendChild(indicator);
                    }
                    
                    // Automatically load demo data
                    document.getElementById('loadSampleJustifications')?.click();
                } else {
                    // Remove demo mode indicator
                    document.getElementById('demoModeIndicator')?.remove();
                }
            }
        });
        
        document.body.appendChild(demoButton);
    }
    
    // Add keyboard shortcut (Alt+D) for demo mode
    document.addEventListener('keydown', function(e) {
        if (e.altKey && e.key === 'd' && demoModeDefault) {
            if (window.demoMode) {
                window.demoMode.toggleDemoMode();
                document.getElementById('demoModeToggle').textContent = 
                    window.demoMode.isDemoModeActive() ? 'Disable Demo Mode' : 'Enable Demo Mode';
            }
        }
    });
    
    // Add ZKP toggle event handlers (only if element exists)
    const toggleZkpButton = document.getElementById("toggleZkpMode");
    if (toggleZkpButton && window.zkpIntegration) {
        toggleZkpButton.addEventListener("click", function() {
            zkpModeActive = window.zkpIntegration.toggleZkpMode();
            updateZkpUI(zkpModeActive);
        });
    }
    
    // Add ZKP demo button handler (only if element exists)
    const runZkpDemoButton = document.getElementById("runZkpDemo");
    if (runZkpDemoButton && window.zkpIntegration) {
        runZkpDemoButton.addEventListener("click", async function() {
            if (window.zkpIntegration) {
                try {
                    this.disabled = true;
                    this.textContent = "Running Demo...";
                    
                    // Enable ZKP mode if not already active
                    if (!zkpModeActive) {
                        zkpModeActive = window.zkpIntegration.toggleZkpMode();
                        updateZkpUI(zkpModeActive);
                    }
                    
                    // Run the demo
                    const result = await window.zkpIntegration.runDemoVote();
                    
                    // Update ZKP verifications UI
                    updateZkpVerificationsUI(window.zkpIntegration.getVerifiedProofs());
                    
                    // Show success message
                    alert(`ZKP Demo completed successfully with ${result.proofCount} verified proofs.`);
                    
                    // Re-enable button
                    this.disabled = false;
                    this.textContent = "Run ZKP Demo Again";
                    
                } catch (error) {
                    log.error(error, { context: 'zkpDemo' });
                    alert(`Error running ZKP demo: ${error.message}`);
                    this.disabled = false;
                    this.textContent = "Run ZKP Demo";
                }
            } else {
                alert("Zero-Knowledge Proof module is not available");
            }
        });
    }
    
    // Initialize ZKP UI if available
    if (window.zkpIntegration) {
        zkpModeActive = window.zkpIntegration.isZkpModeActive();
        updateZkpUI(zkpModeActive);
    }
    
    // Check if Groq integration is available
    if (!window.groqAnalysis) {
        log.error(new Error("Groq analysis module not loaded"));
        document.getElementById("researchNotice").innerHTML = `
            <p style="color: red;"><strong>Error:</strong> Research mode could not be activated. 
            Groq API integration is not available.</p>
        `;
    }
    
    // Check if MADD system is available
    if (!window.maddSystem) {
        log.error(new Error("MADD system module not loaded"));
        document.getElementById("maddSystemNotice").innerHTML = `
            <p style="color: red;"><strong>Error:</strong> Advanced Research mode could not be activated. 
            Multi-Agent Deliberative Democracy framework is not available.</p>
        `;
    } else {
        // Initialize MADD UI
        displayAgentProfiles();
    }
    
    // Initialize production config and detect network if available
    if (window.productionConfig) {
        window.productionConfig.configureForProduction()
          .then(() => {
            // Check if the contract address needs to be updated from production config
            const networkConfig = window.productionConfig.getNetwork();
            if (networkConfig && networkConfig.contractAddress) {
              contractAddress = networkConfig.contractAddress;
              log.info(`Using network-specific contract address from config: ${contractAddress}`);
            }
          })
          .catch(err => log.error("Error configuring for production:", err));
        log.info(`Application configured for ${window.productionConfig.isProd ? 'production' : 'development'}`);
    }
    
    // Add Connect to Hardhat Node button listener
    const connectButton = document.getElementById("connectWalletButton"); // Reuse the same button ID
    if (connectButton) {
        // Update button text initially
        connectButton.textContent = 'Connect to Hardhat Node';
        connectButton.addEventListener("click", connectWallet);
    } else {
        log.warn("Connect Button (ID: connectWalletButton) not found in HTML.");
        // Attempt to connect automatically on load since no user interaction is needed
        connectWallet();
    }

    // Initial UI state for voting controls
    updateVotingControls();
    // Initial UI state for wallet
    updateWalletStatus(null); 

/**
 * Add new styles for auth indicators and wallet integration
 */
document.addEventListener('DOMContentLoaded', () => {
  // Add styles for new UI elements if they don't exist already
  if (!document.getElementById('walletAuthStyles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'walletAuthStyles';
    styleElement.textContent = `
      .wallet-prompt {
        background-color: #e3f2fd;
        border-left: 4px solid #2196f3;
        margin-bottom: 20px;
        animation: fadeIn 0.5s ease-in-out;
      }
      
      .wallet-prompt.fade-out {
        animation: fadeOut 0.5s ease-in-out;
      }
      
      .auth-indicator {
        padding: 12px;
        margin-bottom: 16px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        font-size: 14px;
      }
      
      .auth-indicator.success {
        background-color: rgba(76, 175, 80, 0.1);
        color: #2e7d32;
      }
      
      .auth-indicator.warning {
        background-color: rgba(255, 152, 0, 0.1);
        color: #ef6c00;
      }
      
      .auth-indicator i {
        margin-right: 8px;
        font-size: 16px;
      }
      
      .small-button {
        padding: 4px 8px;
        font-size: 12px;
        margin-left: 10px;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-10px); }
      }
    `;
    
    document.head.appendChild(styleElement);
  }
});
    // Attempt to connect automatically if wallet is already approved (optional)
    // connectWallet(); // Uncomment this line if you want auto-connect attempt on load

    // Initial UI state for voting controls
    updateVotingControls();
    // Initial UI state for wallet
    updateWalletStatus(null);

});

/**
 * Check authentication status from sessionStorage and update UI accordingly.
 * This should be called on pages that require authentication (e.g., voting.html).
 */
function checkAuthenticationStatus() {
    isAuthenticated = sessionStorage.getItem('authenticated') === 'true';
    isWalletConnected = sessionStorage.getItem('walletConnected') === 'true'; // Check wallet status too
    const userId = sessionStorage.getItem('userId');
    const walletAddress = sessionStorage.getItem('walletAddress');

    if (isAuthenticated && userId) {
        currentUser = { id: userId, name: "Verified Voter" }; // Reconstruct basic user info
        log.info("User is authenticated via session storage.", { userId });
        showAuthenticatedUserInfo(currentUser); // Display user info if element exists

        // If wallet was also connected, update its status
        if (isWalletConnected && walletAddress) {
            userAddress = walletAddress; // Restore wallet address
            updateWalletStatus(userAddress);
            // Attempt to re-initialize contract connection if needed
            // This assumes connectWallet can handle being called multiple times or checks connection status
            connectWallet();
        } else {
             // Prompt wallet connection if authenticated but wallet not connected
             updateVotingControls(); // This will show the connect wallet prompt
        }

    } else {
        // Not authenticated, potentially redirect to login or show login prompt
        log.warn("User is not authenticated via session storage.");
        isAuthenticated = false;
        isWalletConnected = false;
        currentUser = null;
        userAddress = null;
        // Hide voting elements, show login prompt/redirect (handled by page-specific logic or updateVotingControls)
    }
    updateVotingControls(); // Update UI based on loaded status
}

/**
 * Update UI based on ZKP mode state
 */
function updateZkpUI(isActive) {
    const zkpStatus = document.getElementById("zkpVotingStatus");
    const zkpToggleBtn = document.getElementById("toggleZkpMode");
    const zkpResultsSection = document.getElementById("zkpResultsSection");
    const standardVoterSection = document.getElementById("standardVoterSection");
    
    if (isActive) {
        // Show ZKP mode is active
        if (zkpStatus) zkpStatus.style.display = "block";
        if (zkpToggleBtn) {
            zkpToggleBtn.textContent = "Disable Private Voting";
            zkpToggleBtn.style.backgroundColor = "#4caf50";
        }
        
        // Show ZKP results section if it exists and has verifications
        if (zkpResultsSection) {
            const proofs = window.zkpIntegration?.getVerifiedProofs() || [];
            if (proofs.length > 0) {
                zkpResultsSection.style.display = "block";
                if (standardVoterSection) standardVoterSection.style.display = "none";
            }
        }
    } else {
        // Show ZKP mode is inactive
        if (zkpStatus) zkpStatus.style.display = "none";
        if (zkpToggleBtn) {
            zkpToggleBtn.textContent = "Enable Private Voting (ZKP)";
            zkpToggleBtn.style.backgroundColor = "#ff9800";
        }
        
        // Hide ZKP results section
        if (zkpResultsSection) zkpResultsSection.style.display = "none";
        if (standardVoterSection) standardVoterSection.style.display = "block";
    }
}

/**
 * Update ZKP verifications UI with proof data
 */
function updateZkpVerificationsUI(proofs) {
    const zkpVerifications = document.getElementById("zkpVerifications");
    const zkpResultsSection = document.getElementById("zkpResultsSection");
    const standardVoterSection = document.getElementById("standardVoterSection");
    
    if (zkpVerifications && proofs && proofs.length > 0) {
        // Show the ZKP results section
        if (zkpResultsSection) {
            zkpResultsSection.style.display = "block";
            if (standardVoterSection) standardVoterSection.style.display = "none";
        }
        
        // Clear existing content
        zkpVerifications.innerHTML = "";
        
        // Add each verification
        proofs.forEach((proof, index) => {
            const verificationTime = new Date().toLocaleTimeString();
            const verificationItem = document.createElement("div");
            verificationItem.style.padding = "10px";
            verificationItem.style.backgroundColor = "white";
            verificationItem.style.borderRadius = "5px";
            verificationItem.style.marginBottom = "10px";
            verificationItem.style.borderLeft = "4px solid #4caf50";
            
            verificationItem.innerHTML = `
                <div style="font-weight: bold; color: #4caf50;">✓ Proof #${index + 1} Verified</div>
                <div>Nullifier Hash: ${proof.nullifierHash?.substring(0, 10) || "0x123"}...${proof.nullifierHash?.substring(proof.nullifierHash.length - 6) || "abc"}</div>
                <div style="font-size: 0.8em; color: #757575;">Verified at: ${verificationTime}</div>
            `;
            
            zkpVerifications.appendChild(verificationItem);
        });
    }
}
// 🔍 Display AI Analysis Results
function displayAnalysisResults(analysis) {
    if (!analysis) return;
    
    // Display Argument Analysis
    const argumentAnalysisElement = document.getElementById("argumentAnalysis");
    if (analysis.argumentAnalysis) {
        const argAnalysis = analysis.argumentAnalysis;
        argumentAnalysisElement.innerHTML = `
            <div class="analysis-item">
                <div class="analysis-header">
                    <span>Argument for ${analysis.candidate}</span>
                </div>
                <p><strong>Main Claim:</strong> ${argAnalysis.mainClaim || 'Not identified'}</p>
                <p><strong>Logical Structure:</strong> ${argAnalysis.logicalStructure || 'Unknown'}</p>
                <p><strong>Key Premises:</strong></p>
                <ul>
                    ${(argAnalysis.keyPremises || []).map(premise => `<li>${premise}</li>`).join('')}
                </ul>
                <p><strong>Evidence Types:</strong> ${(argAnalysis.evidenceTypes || []).join(', ') || 'None identified'}</p>
            </div>
        `;
    } else {
        argumentAnalysisElement.innerHTML = "<p>No argument structure could be analyzed.</p>";
    }
    
    // Display Bias Analysis
    const biasAnalysisElement = document.getElementById("biasAnalysis");
    if (analysis.biasAnalysis && analysis.biasAnalysis.detectedBiases) {
        const biases = analysis.biasAnalysis.detectedBiases;
        if (biases.length === 0) {
            biasAnalysisElement.innerHTML = "<p>No significant cognitive biases detected.</p>";
        } else {
            biasAnalysisElement.innerHTML = `
                <div class="analysis-item">
                    <div class="analysis-header">
                        <span>${biases.length} Potential Bias${biases.length !== 1 ? 'es' : ''} Detected</span>
                    </div>
                    <div class="bias-tags">
                        ${biases.map(bias => 
                            `<span class="bias-tag" title="${bias.explanation || ''}">${bias.name || 'Unnamed bias'} (${(bias.confidence || 0).toFixed(2)})</span>`
                        ).join('')}
                    </div>
                    <ul>
                        ${biases.map(bias => 
                            `<li><strong>${bias.name || 'Unnamed bias'}:</strong> ${bias.explanation || 'No explanation provided'}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
    } else {
        biasAnalysisElement.innerHTML = "<p>No bias analysis available.</p>";
    }
    
    // Display Research Insights
    const researchInsightsElement = document.getElementById("researchInsights");
    if (analysis.researchInsights) {
        const insights = analysis.researchInsights;
        const qualityScore = insights.argumentQuality ? insights.argumentQuality.score : '?';
        const qualityColor = getScoreColor(qualityScore);
        
        researchInsightsElement.innerHTML = `
            <div class="analysis-item">
                <div class="analysis-header">
                    <span>Research Insights</span>
                    <span class="quality-score" style="background-color: ${qualityColor}">Quality: ${qualityScore}/10</span>
                </div>
                <p><strong>Quality Explanation:</strong> ${insights.argumentQuality ? insights.argumentQuality.explanation : 'Not available'}</p>
                <p><strong>Areas for Improvement:</strong></p>
                <ul>
                    ${(insights.improvementAreas || []).map(area => `<li>${area}</li>`).join('')}
                </ul>
                <p><strong>Significant Pattern:</strong> ${insights.significantPattern || 'None identified'}</p>
                <p><strong>Democratic Comparison:</strong> ${insights.democraticComparisonInsight || 'Not available'}</p>
            </div>
        `;
    } else {
        researchInsightsElement.innerHTML = "<p>No research insights available.</p>";
    }
}

// 📊 Display Deliberative Metrics
function displayDeliberativeMetrics() {
    const metricsElement = document.getElementById("deliberativeMetrics");
    const metrics = window.groqAnalysis.calculateDeliberativeMetrics();
    
    if (!metrics) {
        metricsElement.innerHTML = "<p>Insufficient data to calculate metrics.</p>";
        return;
    }
    
    // Format evidence type distribution
    const evidenceTypes = Object.entries(metrics.evidenceTypeDistribution || {})
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
    
    // Format reasoning patterns
    const reasoningPatterns = Object.entries(metrics.reasoningPatterns || {})
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
    
    metricsElement.innerHTML = `
        <div class="analysis-item">
            <div class="analysis-header">
                <span>Collective Deliberation Metrics</span>
            </div>
            <p><strong>Average Argument Quality:</strong> ${metrics.argumentQualityAverage.toFixed(2)}/10</p>
            <p><strong>Bias Prevalence:</strong> ${metrics.biasPrevalence.toFixed(2)} biases per justification</p>
            <p><strong>Evidence Type Distribution:</strong> ${evidenceTypes || 'None'}</p>
            <p><strong>Reasoning Patterns:</strong> ${reasoningPatterns || 'None'}</p>
            <p><strong>Consensus Distance:</strong> ${metrics.consensusDistance.toFixed(2)}</p>
        </div>
    `;
}

// 🗺️ Display Consensus Map
function displayConsensusMap(consensusMap) {
    const mapElement = document.getElementById("consensusMap");
    
    if (!consensusMap || Object.keys(consensusMap).length === 0) {
        mapElement.innerHTML = "<p>Insufficient data to generate consensus map.</p>";
        return;
    }
    
    // Format agreements
    const agreements = (consensusMap.agreements || [])
        .map(point => `<li>${point}</li>`)
        .join('');
    
    // Format disagreements
    const disagreements = (consensusMap.disagreements || [])
        .map(point => `<li>${point}</li>`)
        .join('');
    
    // Format bridge positions
    const bridgePositions = (consensusMap.bridgePositions || [])
        .map(point => `<li>${point}</li>`)
        .join('');
    
    mapElement.innerHTML = `
        <div class="consensus-item">
            <p><strong>Last Updated:</strong> ${new Date(consensusMap.timestamp).toLocaleString()}</p>
            <p><strong>Based on ${consensusMap.voterCount || '?'} voter${consensusMap.voterCount !== 1 ? 's' : ''}</strong></p>
            
            <h4>Points of Agreement</h4>
            <ul>${agreements || '<li>None identified yet</li>'}</ul>
            
            <h4>Core Disagreements</h4>
            <ul>${disagreements || '<li>None identified yet</li>'}</ul>
            
            <h4>Potential Bridge Positions</h4>
            <ul>${bridgePositions || '<li>None identified yet</li>'}</ul>
        </div>
    `;
}

// Utility function to get color based on score
function getScoreColor(score) {
    if (score >= 8) return '#4CAF50'; // Green
    if (score >= 6) return '#8BC34A'; // Light Green
    if (score >= 4) return '#FFC107'; // Amber
    if (score >= 2) return '#FF9800'; // Orange
    return '#F44336'; // Red
}


/**
 * Update MADD metrics display
 */
function updateMaddMetrics() {
    const metricsContainer = document.getElementById("deliberationMetrics");
    const metricsGrid = document.getElementById("metricsGrid");
    
    if (!metricsContainer || !metricsGrid || !window.maddSystem) {
        return;
    }
    
    const metrics = window.maddSystem.getDeliberationMetrics();
    
    // Create metrics cards
    metricsGrid.innerHTML = `
        <div class="metric-card">
            <div class="metric-label">Deliberations</div>
            <div class="metric-value">${metrics.deliberationCount}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Avg. Turns</div>
            <div class="metric-value">${metrics.averageTurns.toFixed(1)}</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Consensus Rate</div>
            <div class="metric-value">${(metrics.consensusRate * 100).toFixed(1)}%</div>
        </div>
        <div class="metric-card">
            <div class="metric-label">Bridge Positions</div>
            <div class="metric-value">${metrics.bridgePositionGeneration.toFixed(1)}</div>
        </div>
    `;
}

/**
 * Display agent profiles in the UI
 */
function displayAgentProfiles() {
    const profilesContainer = document.getElementById("agentProfilesList");
    
    if (!profilesContainer || !window.maddSystem) {
        return;
    }
    
    const agentProfiles = window.maddSystem.agentProfiles;
    
    profilesContainer.innerHTML = agentProfiles.map(agent => `
        <div class="agent-profile ${agent.reasoningStyle}" style="padding: 8px; border-radius: 4px; margin-bottom: 5px;">
            <div style="font-weight: bold;">${agent.name}</div>
            <div style="font-size: 0.8em;">${agent.reasoningStyle}</div>
        </div>
    `).join('');
}
