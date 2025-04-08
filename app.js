// Initialize from production configuration if available
const networkConfig = window.productionConfig?.getNetwork?.() || {
  name: 'Local Hardhat Node',
  rpcUrl: 'http://127.0.0.1:8545',
  contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3'
};

// Use logging from production config if available
const log = window.productionConfig?.log || console;

// Check if demo mode should be available/active by default
const demoModeDefault = window.productionConfig?.featureFlags?.enableDemoMode !== false;

// Authentication state
let isAuthenticated = false;
let currentUser = null;

// Initialize zkp mode state
let zkpModeActive = false;

// Get contract address from network config
const contractAddress = networkConfig.contractAddress;

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
const RPC_URL = networkConfig.rpcUrl; // Use configurable RPC URL
let justifications = []; // Array to store justifications locally

/**
 * Setup facial authentication and connect it with the voting flow
 */
function setupFacialAuthentication() {
  // Get UI elements
  const beginAuthButton = document.getElementById('beginAuthButton');
  const votingContainer = document.getElementById('votingContainer');
  const voteButton = document.getElementById('voteButton');
  
  // Initialize authentication if facial-auth.js is loaded
  if (window.facialAuth) {
    log.info("Facial authentication module detected");
    
    // Add event listener to the begin authentication button
    if (beginAuthButton) {
      beginAuthButton.addEventListener('click', async () => {
        try {
          // Get user ID from input
          const userId = document.getElementById('userIdInput')?.value;
          if (!userId || userId.trim() === '') {
            showAuthError("Please enter a user ID to continue");
            return;
          }
          
          // Store user ID in session
          sessionStorage.setItem('userId', userId);
          
          // Start facial authentication process
          if (await window.facialAuth.initialize()) {
            window.facialAuth.startAuthentication();
          } else {
            showAuthError("Failed to initialize facial authentication. Please try again.");
          }
        } catch (error) {
          log.error(error, { context: 'startFacialAuth' });
          showAuthError("An error occurred while starting facial authentication: " + error.message);
        }
      });
    }
    
    // Register authentication listener
    window.facialAuth.registerAuthListener((isSuccessful, user) => {
      if (isSuccessful && user) {
        // Update authentication state
        isAuthenticated = true;
        currentUser = user;
        
        // Show the voting section
        if (votingContainer) {
          votingContainer.style.display = 'block';
          
          // Enable the vote button
          if (voteButton) {
            voteButton.disabled = false;
          }
          
          // Hide login section
          const loginSection = document.getElementById('loginSection');
          if (loginSection) {
            loginSection.style.display = 'none';
          }
          
          // Show authenticated user info
          showAuthenticatedUserInfo(user);
        }
        
        log.info("User authenticated successfully", { userId: user.id });
      } else {
        // Authentication failed or was cancelled
        isAuthenticated = false;
        currentUser = null;
      }
    });
  } else {
    // Facial authentication not available
    log.warn("Facial authentication module not loaded. Adding fallback mechanism.");
    
    // Add fallback to skip authentication for development
    if (beginAuthButton) {
      beginAuthButton.addEventListener('click', () => {
        // Get user ID
        const userId = document.getElementById('userIdInput')?.value || 'dev-user';
        
        // Show message
        const loginContainer = document.getElementById('facialLoginContainer');
        if (loginContainer) {
          loginContainer.innerHTML = `
            <div class="auth-success">
              <div class="success-icon">✓</div>
              <p>Development mode: Authentication skipped</p>
              <p>User ID: ${userId}</p>
              <button id="proceedToVoteButton" class="primary-button">Proceed to Vote</button>
            </div>
          `;
          
          // Add event listener
          document.getElementById('proceedToVoteButton').addEventListener('click', () => {
            // Show voting section
            if (votingContainer) {
              votingContainer.style.display = 'block';
              
              // Enable vote button
              if (voteButton) {
                voteButton.disabled = false;
              }
              
              // Hide login section
              const loginSection = document.getElementById('loginSection');
              if (loginSection) {
                loginSection.style.display = 'none';
              }
            }
          });
        }
      });
    }
  }
}

/**
 * Show authentication error message
 */
function showAuthError(message) {
  const errorContainer = document.createElement('div');
  errorContainer.className = 'auth-error';
  errorContainer.innerHTML = `<p>${message}</p>`;
  
  // Find and remove any existing error message
  const existingError = document.querySelector('.auth-error');
  if (existingError) {
    existingError.remove();
  }
  
  // Add to the login container
  const loginContainer = document.getElementById('facialLoginContainer');
  if (loginContainer) {
    loginContainer.appendChild(errorContainer);
    
    // Remove after 5 seconds
    setTimeout(() => {
      errorContainer.remove();
    }, 5000);
  }
}

/**
 * Show authenticated user information
 */
function showAuthenticatedUserInfo(user) {
  // Create user info element if it doesn't exist
  let userInfoElement = document.getElementById('userInfo');
  
  if (!userInfoElement) {
    userInfoElement = document.createElement('div');
    userInfoElement.id = 'userInfo';
    userInfoElement.className = 'user-info';
    
    // Add to voting container
    const votingContainer = document.getElementById('votingContainer');
    if (votingContainer) {
      votingContainer.insertBefore(userInfoElement, votingContainer.firstChild);
    }
  }
  
  // Update content
  userInfoElement.innerHTML = `
    <div class="user-info-container">
      <div class="user-avatar">
        <span>${user.name.charAt(0).toUpperCase()}</span>
      </div>
      <div class="user-details">
        <div class="user-name">${user.name}</div>
        <div class="auth-status">Authenticated</div>
      </div>
    </div>
  `;
  
  // Add styles if not already added
  if (!document.getElementById('userInfoStyles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'userInfoStyles';
    styleElement.textContent = `
      .user-info {
        background-color: #e8f5e9;
        padding: 10px 15px;
        border-radius: 5px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        border-left: 4px solid #4caf50;
      }
      
      .user-info-container {
        display: flex;
        align-items: center;
      }
      
      .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: #4caf50;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        margin-right: 10px;
      }
      
      .user-details {
        display: flex;
        flex-direction: column;
      }
      
      .user-name {
        font-weight: bold;
      }
      
      .auth-status {
        font-size: 12px;
        color: #4caf50;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
}

// 🚀 Connect to Blockchain Automatically
async function connectToBlockchain() {
    try {
        // Add status indicator
        const statusElement = document.createElement("div");
        statusElement.id = "connectionStatus";
        statusElement.className = "notice-banner";
        statusElement.innerHTML = `<p><strong>Connecting to ${networkConfig.name}...</strong> Please wait while we establish connection.</p>`;
        
        // Insert at the top of the page
        document.querySelector("h1").insertAdjacentElement("afterend", statusElement);
        
        // Connect to configured RPC
        provider = new ethers.JsonRpcProvider(RPC_URL);

        // Set default signer (Account 1)
        signer = await provider.getSigner(1);
        
        // Ensure the element exists before setting innerText
        const walletAddressElement = document.getElementById("walletAddress");
        if (walletAddressElement) {
            const address = await signer.getAddress();
            walletAddressElement.innerText = `Connected: ${address}`;
        } else {
            console.log("Creating wallet address display");
            const addressDisplay = document.createElement("div");
            addressDisplay.id = "walletAddress";
            addressDisplay.className = "notice-banner success";
            const address = await signer.getAddress();
            addressDisplay.innerHTML = `<p><strong>Connected:</strong> ${address}</p>`;
            document.getElementById("selectAccount").insertAdjacentElement("afterend", addressDisplay);
        }

        // Initialize contract with Hardhat signer
        contract = new ethers.Contract(contractAddress, contractABI, signer);

        // Clear and set up justification listener
        justifications = []; // Clear local justifications on reconnect
        setupJustificationListener();
        displayJustifications(); // Initial display

        // Load votes from the contract
        await loadVotes();

        log.info(`✅ Connected to ${networkConfig.name}`);
        
        // Update status
        statusElement.className = "notice-banner success";
        statusElement.innerHTML = `<p><strong>Connected to ${networkConfig.name}!</strong> You can now cast votes and see results.</p>`;
        
        // Remove the status after 5 seconds
        setTimeout(() => {
            statusElement.classList.add("fade-out");
            setTimeout(() => statusElement.remove(), 1000);
        }, 5000);
    } catch (error) {
        log.error(error, { context: 'blockchainConnection' });
        
        // Update status and offer demo mode
        const statusElement = document.getElementById("connectionStatus") || document.createElement("div");
        statusElement.id = "connectionStatus";
        statusElement.className = "notice-banner error";
        statusElement.innerHTML = `
            <p><strong>Failed to connect to ${networkConfig.name}:</strong> ${error.message}</p>
            <p>You can still explore the AI features using Demo Mode.</p>
            <button id="enableDemoModeButton" class="demo-button">Enable Demo Mode</button>
        `;
        
        // Insert at the top if it doesn't exist
        if (!document.getElementById("connectionStatus")) {
            document.querySelector("h1").insertAdjacentElement("afterend", statusElement);
        }
        
        // Add event listener to the demo mode button
        document.getElementById("enableDemoModeButton").addEventListener("click", function() {
            if (window.demoMode && typeof window.demoMode.toggleDemoMode === 'function') {
                window.demoMode.toggleDemoMode();
                this.textContent = "Demo Mode Enabled";
                this.disabled = true;
            }
        });
    }
}

// 🔄 Change Signer Based on Selected Account
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

// 🗳 Voting Function with Facial Authentication, Groq Analysis and MADD Framework
document.getElementById("voteButton").addEventListener("click", async () => {
    // Check if user is authenticated
    if (!isAuthenticated && !window.demoMode?.isDemoModeActive()) {
        // Show error message
        const votingError = document.createElement("div");
        votingError.className = "notice-banner error";
        votingError.innerHTML = `
            <p><strong>Authentication Required:</strong> Please authenticate with facial recognition before voting.</p>
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
    
    // Regular blockchain voting
    if (!contract) {
        const errorMessage = "❌ Blockchain connection is required. Please connect to Hardhat or enable Demo Mode.";
        
        // Create an error notice
        const errorNotice = document.createElement("div");
        errorNotice.className = "notice-banner error";
        errorNotice.innerHTML = `
            <p><strong>Error:</strong> ${errorMessage}</p>
            <button id="demoModeFromError" class="demo-button">Enable Demo Mode</button>
        `;
        
        // Insert after the vote button
        document.getElementById("voteButton").insertAdjacentElement("afterend", errorNotice);
        
        // Add event listener to the demo mode button
        document.getElementById("demoModeFromError").addEventListener("click", function() {
            if (window.demoMode && typeof window.demoMode.toggleDemoMode === 'function') {
                window.demoMode.toggleDemoMode();
                this.textContent = "Demo Mode Enabled";
                this.disabled = true;
                
                // Remove error notice after 2 seconds
                setTimeout(() => {
                    errorNotice.remove();
                }, 2000);
            }
        });
        
        return;
    }

    // Show voting in progress
    const votingStatus = document.createElement("div");
    votingStatus.id = "votingStatus";
    votingStatus.className = "notice-banner";
    votingStatus.innerHTML = `
        <div class="loading-container">
            <p><strong>Submitting vote to blockchain...</strong></p>
            <div class="loading-spinner"></div>
            <p>This may take a few moments. Please wait.</p>
        </div>
    `;
    
    // Insert after vote button
    document.getElementById("voteButton").insertAdjacentElement("afterend", votingStatus);

    try {
        // Call the updated vote function with justification
        const tx = await contract.connect(signer).vote(candidateIndex, justificationText);
        await tx.wait(); // Wait for transaction confirmation

        // Update status
        votingStatus.className = "notice-banner success";
        votingStatus.innerHTML = "<p><strong>✅ Vote cast successfully!</strong></p>";
        
        // Remove the status after 5 seconds
        setTimeout(() => {
            votingStatus.classList.add("fade-out");
            setTimeout(() => votingStatus.remove(), 1000);
        }, 5000);
        
        // Clear justification field
        document.getElementById("justification").value = ""; 
        
        // Reload votes after successful transaction
        await loadVotes(); 
        
        // If justification was provided, perform AI analysis
        if (justificationText.trim() !== "") {
            await processJustification(justificationText, candidateName);
        }
    } catch (error) {
        log.error(error, { context: 'voting' });
        
        // Update status
        votingStatus.className = "notice-banner error";
        votingStatus.innerHTML = `
            <p><strong>Error casting vote:</strong> ${error.message}</p>
            <p>You can still explore AI features in Demo Mode.</p>
            <button id="demoFromVoteError" class="demo-button">Process with Demo Mode</button>
        `;
        
        // Add event listener to process in demo mode
        document.getElementById("demoFromVoteError").addEventListener("click", async function() {
            if (window.demoMode) {
                // Enable demo mode if not already
                if (!window.demoMode.isDemoModeActive()) {
                    window.demoMode.toggleDemoMode();
                }
                
                // Handle in demo mode
                await handleDemoVote(candidateIndex, justificationText, candidateName);
                
                // Remove error notice
                votingStatus.remove();
            }
        });
    }
});

/**
 * Handle a vote in demo mode
 */
async function handleDemoVote(candidateIndex, justificationText, candidateName) {
    // Show a demo mode notification
    const demoNotice = document.createElement("div");
    demoNotice.className = "notice-banner warning";
    demoNotice.innerHTML = "<p><strong>Demo Mode:</strong> Processing vote simulation...</p>";
    document.getElementById("voteButton").insertAdjacentElement("afterend", demoNotice);
    
    // Simulate blockchain delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Update the notice
    demoNotice.className = "notice-banner success";
    demoNotice.innerHTML = "<p><strong>Demo Vote Simulated!</strong> Analyzing with AI...</p>";
    
    // Remove notice after 3 seconds
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
            if (signer && voter !== signer.getAddress()) {
                window.groqAnalysis.analyzeJustification(voter, candidate, justification)
                    .then(analysis => {
                        // Don't display this analysis, but add it to our research data
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
    // Setup facial authentication
    setupFacialAuthentication();
    
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
    
    // Add ZKP toggle event handlers
    if (document.getElementById("toggleZkpMode") && window.zkpIntegration) {
        document.getElementById("toggleZkpMode").addEventListener("click", function() {
            zkpModeActive = window.zkpIntegration.toggleZkpMode();
            updateZkpUI(zkpModeActive);
        });
    }
    
    // Add ZKP demo button handler
    if (document.getElementById("runZkpDemo") && window.zkpIntegration) {
        document.getElementById("runZkpDemo").addEventListener("click", async function() {
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
    
    // Initialize production config if available
    if (window.productionConfig) {
        window.productionConfig.configureForProduction();
        log.info(`Application configured for ${window.productionConfig.isProd ? 'production' : 'development'}`);
    }
    
    // Connect to blockchain
    connectToBlockchain();
});

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