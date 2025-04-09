/**
 * AI-Powered Smart Contract Generation and Analysis Module
 * 
 * This module provides AI-enhanced capabilities for smart contract generation,
 * security analysis, and optimization in the voting system.
 */

// Initialize from production configuration if available
const config = window.productionConfig || {};
const log = config?.log || console;
const isProd = config?.isProd || false;

// Feature flags
const isSmartContractsEnabled = config?.featureFlags?.enableSmartContracts !== false;
const allowMockDataInProd = config?.featureFlags?.allowMockDataInProduction || false;

// Module configuration with defaults
const smartContractsConfig = {
    renderUI: config?.smartContracts?.renderUI !== false,
    maxContractSizeBytes: config?.smartContracts?.maxContractSizeBytes || 24576, // Default 24KB limit
    gasOptimization: isProd ? true : (config?.smartContracts?.gasOptimization || false),
    securityScanLevel: isProd ? 'high' : (config?.smartContracts?.securityScanLevel || 'medium'),
    templateDirectory: config?.smartContracts?.templateDirectory || 'templates/contracts',
    uiPosition: config?.smartContracts?.uiPosition || 'afterVotingSection'
};

log.info("Loading AI-Powered Smart Contract module", { 
    enabled: isSmartContractsEnabled,
    environment: isProd ? "production" : "development",
    securityScanLevel: smartContractsConfig.securityScanLevel,
    gasOptimization: smartContractsConfig.gasOptimization
});

// Main namespace for smart contract operations
window.smartContractAI = (function() {
    // Private variables
    let isInitialized = false;
    let currentAnalysis = null;
    let securityScanResults = [];
    let optimizationResults = [];
    let generatedContracts = [];
    
    // Security vulnerability patterns (simplified for demonstration)
    const vulnerabilityPatterns = {
        reentrancy: {
            name: "Reentrancy",
            pattern: /(\.\s*call\s*{.*}|\.call\.value\s*\()/,
            severity: "high",
            description: "Function calls to external contracts should come after state changes",
            recommendation: "Follow checks-effects-interactions pattern"
        },
        overflow: {
            name: "Integer Overflow/Underflow",
            pattern: /\+\+|\+=|--|-=/,
            severity: "high",
            description: "Arithmetic operations may cause integer overflow/underflow",
            recommendation: "Use SafeMath library or Solidity 0.8+ with built-in overflow checking"
        },
        uncheckedReturn: {
            name: "Unchecked Return Value",
            pattern: /\.(call|transfer|send)(?!.*require)/,
            severity: "medium",
            description: "Return values of external calls not checked",
            recommendation: "Always check return values of low-level calls"
        },
        txOrigin: {
            name: "tx.origin Usage",
            pattern: /tx\.origin/,
            severity: "high",
            description: "Using tx.origin for authorization is vulnerable to phishing",
            recommendation: "Use msg.sender for authorization instead of tx.origin"
        },
        timestamp: {
            name: "Block Timestamp Dependence",
            pattern: /(now|block\.timestamp)/,
            severity: "medium",
            description: "Block timestamps can be manipulated by miners",
            recommendation: "Don't use block timestamps for critical logic or random number generation"
        }
    };
    
    // Contract templates for various voting mechanisms
    const contractTemplates = {
        standard: {
            name: "Standard Voting",
            description: "Basic voting contract with one-person-one-vote mechanics",
            complexity: "low",
            features: ["Basic voting", "Vote counting", "Results tallying"]
        },
        weighted: {
            name: "Weighted Voting",
            description: "Voting contract where votes have different weights based on tokens held",
            complexity: "medium",
            features: ["Token-weighted voting", "Delegation", "Vote counting"]
        },
        quadratic: {
            name: "Quadratic Voting",
            description: "Voting with cost that increases quadratically with number of votes",
            complexity: "high",
            features: ["Quadratic cost", "Token integration", "Vote purchasing"]
        },
        delegated: {
            name: "Delegated Voting",
            description: "Liquid democracy system allowing vote delegation",
            complexity: "high",
            features: ["Vote delegation", "Transitive delegation", "Delegation tracking"]
        },
        timelock: {
            name: "Timelock Governance",
            description: "Voting with time-delayed execution for security",
            complexity: "high",
            features: ["Proposal queueing", "Time-delayed execution", "Emergency cancellation"]
        },
        zkp: {
            name: "Zero-Knowledge Voting",
            description: "Private voting using zero-knowledge proofs",
            complexity: "very high",
            features: ["Anonymous voting", "ZKP verification", "Privacy preservation"]
        }
    };
    
    /**
     * Initialize the AI-powered smart contract system
     */
    async function initialize() {
        // Skip initialization if the feature is disabled
        if (!isSmartContractsEnabled) {
            log.info("Smart Contracts AI module is disabled via configuration");
            return false;
        }
        
        if (isInitialized) {
            log.debug("Smart Contracts AI already initialized");
            return true;
        }
        
        log.info("Initializing AI-Powered Smart Contract System");
        
        try {
            // Create UI components if enabled
            if (smartContractsConfig.renderUI) {
                createSmartContractsUI();
            }
            
            // Load contract templates
            await loadContractTemplates();
            
            // Set up Web3 connection for contract interaction if in production
            if (isProd && config?.web3Provider) {
                try {
                    await setupWeb3Connection();
                    log.info("Web3 connection established for contract interactions");
                } catch (web3Error) {
                    log.warn("Failed to establish Web3 connection", { error: web3Error.message });
                    if (smartContractsConfig.renderUI) {
                        showWeb3Warning();
                    }
                }
            }
            
            isInitialized = true;
            log.info("Smart Contract AI System initialized successfully");
            
            // Dispatch event for other components
            try {
                document.dispatchEvent(new CustomEvent('smartContractAIReady'));
            } catch (eventError) {
                log.error(eventError, { context: 'dispatchReadyEvent' });
            }
            
            return true;
        } catch (error) {
            log.error(error, { context: 'smartContractAIInitialization' });
            
            // Show error in UI if enabled
            if (smartContractsConfig.renderUI) {
                showSystemError("Failed to initialize the smart contract AI system");
            }
            
            return false;
        }
    }
    
    /**
     * Set up Web3 connection for contract interaction
     */
    async function setupWeb3Connection() {
        if (!config.web3Provider) {
            throw new Error("No Web3 provider configuration available");
        }
        
        // In production, use the configured provider
        // In a real implementation, this would connect to the blockchain
        
        // Simulate connection delay
        await simulateDelay(500);
        
        return true;
    }
    
    /**
     * Load contract templates from configured source
     */
    async function loadContractTemplates() {
        try {
            // In production, load from secure storage/API
            if (isProd && config?.dataServices?.getContractTemplates) {
                const templates = await config.dataServices.getContractTemplates();
                if (templates && typeof templates === 'object') {
                    Object.assign(contractTemplates, templates);
                    log.info("Loaded contract templates from data service");
                    return true;
                }
            }
            
            // Templates are already defined statically in this demo version
            log.debug("Using built-in contract templates");
            return true;
        } catch (error) {
            log.error(error, { context: 'loadContractTemplates' });
            return false;
        }
    }
    
    /**
     * Generate a smart contract based on specified parameters
     */
    async function generateContract(params) {
        if (!isInitialized) {
            await initialize();
        }
        
        log.info("Generating smart contract", { 
            type: params.contractType,
            customizations: params.customFeatures?.length || 0
        });
        
        try {
            // In production with AI service
            if (isProd && config?.aiServices?.generateSmartContract) {
                try {
                    const result = await config.aiServices.generateSmartContract(params);
                    if (result && result.code) {
                        // Store the generated contract
                        const contract = {
                            id: generateId(),
                            name: params.name || `Contract_${Date.now()}`,
                            type: params.contractType,
                            code: result.code,
                            timestamp: new Date(),
                            customFeatures: params.customFeatures || [],
                            description: params.description || contractTemplates[params.contractType]?.description || ''
                        };
                        
                        generatedContracts.push(contract);
                        
                        // Run security scan if configured
                        if (params.runSecurityScan) {
                            await scanContractSecurity(contract.id);
                        }
                        
                        // Optimize gas if configured
                        if (params.optimizeGas) {
                            await optimizeContractGas(contract.id);
                        }
                        
                        log.info("Contract generated successfully with AI service", { contractId: contract.id });
                        return contract;
                    }
                } catch (aiError) {
                    log.error(aiError, { context: 'aiContractGeneration' });
                    if (!allowMockDataInProd) {
                        throw new Error("AI service failed to generate contract: " + aiError.message);
                    }
                    log.warn("Falling back to template-based generation");
                }
            }
            
            // Check if mock data is allowed in production
            if (isProd && !allowMockDataInProd) {
                throw new Error("Template-based contract generation not allowed in production environment");
            }
            
            // Template-based generation for development or fallback
            const template = contractTemplates[params.contractType];
            if (!template) {
                throw new Error(`Unknown contract type: ${params.contractType}`);
            }
            
            // Generate contract from template
            const contractCode = generateContractCode(params.contractType, params.customFeatures);
            
            // Create contract object
            const contract = {
                id: generateId(),
                name: params.name || `${template.name}_${Date.now()}`,
                type: params.contractType,
                code: contractCode,
                timestamp: new Date(),
                customFeatures: params.customFeatures || [],
                description: params.description || template.description
            };
            
            // Store the generated contract
            generatedContracts.push(contract);
            
            // Run security scan if requested
            if (params.runSecurityScan) {
                await scanContractSecurity(contract.id);
            }
            
            // Optimize gas if requested
            if (params.optimizeGas) {
                await optimizeContractGas(contract.id);
            }
            
            log.info("Contract generated successfully", { contractId: contract.id });
            return contract;
        } catch (error) {
            log.error(error, { context: 'generateContract' });
            throw new Error(`Failed to generate contract: ${error.message}`);
        }
    }
    
    /**
     * Generate solidity code based on contract type and customizations
     */
    function generateContractCode(contractType, customFeatures = []) {
        // For demonstration, we'll return simplified template contracts
        // In a real implementation, this would generate actual Solidity code
        
        const template = contractTemplates[contractType];
        
        switch (contractType) {
            case 'standard':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Standard Voting Contract
 * @dev A basic voting contract for the decentralized voting system
 */
contract StandardVoting {
    // State variables
    address public owner;
    mapping(address => bool) public hasVoted;
    mapping(uint => uint) public voteCounts;
    uint public totalVotes;
    bool public votingOpen;
    
    // Events
    event VoteCast(address indexed voter, uint indexed candidate);
    event VotingStatusChanged(bool isOpen);
    
    constructor() {
        owner = msg.sender;
        votingOpen = false;
    }
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Start the voting
    function startVoting() public onlyOwner {
        votingOpen = true;
        emit VotingStatusChanged(true);
    }
    
    // End the voting
    function endVoting() public onlyOwner {
        votingOpen = false;
        emit VotingStatusChanged(false);
    }
    
    // Cast a vote
    function vote(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        
        hasVoted[msg.sender] = true;
        voteCounts[candidateId]++;
        totalVotes++;
        
        emit VoteCast(msg.sender, candidateId);
    }
    
    // Get vote count for a candidate
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
    
    // Get total votes cast
    function getTotalVotes() public view returns (uint) {
        return totalVotes;
    }
${customFeatures.includes('vote-delegation') ? `
    // Vote delegation functionality
    mapping(address => address) public delegations;
    
    function delegateVote(address to) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        require(to != msg.sender, "Cannot delegate to self");
        
        delegations[msg.sender] = to;
    }
    
    function voteWithDelegation(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        
        // Count delegated votes
        uint delegatedVotes = 0;
        for (uint i = 0; i < _votersList.length; i++) {
            if (delegations[_votersList[i]] == msg.sender && !hasVoted[_votersList[i]]) {
                delegatedVotes++;
                hasVoted[_votersList[i]] = true;
            }
        }
        
        // Cast own vote
        require(!hasVoted[msg.sender], "Already voted");
        hasVoted[msg.sender] = true;
        
        // Update vote counts
        voteCounts[candidateId] += delegatedVotes + 1;
        totalVotes += delegatedVotes + 1;
        
        emit VoteCast(msg.sender, candidateId);
    }
` : ''}${customFeatures.includes('time-limit') ? `
    // Time-limited voting
    uint public votingEndTime;
    
    function setVotingPeriod(uint durationInMinutes) public onlyOwner {
        votingEndTime = block.timestamp + (durationInMinutes * 1 minutes);
    }
    
    // Override vote function to check time limit
    function vote(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        require(block.timestamp < votingEndTime, "Voting period has ended");
        require(!hasVoted[msg.sender], "Already voted");
        
        hasVoted[msg.sender] = true;
        voteCounts[candidateId]++;
        totalVotes++;
        
        emit VoteCast(msg.sender, candidateId);
    }
` : ''}
}`;

            case 'weighted':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Weighted Voting Contract
 * @dev A voting contract where votes are weighted by token balance
 */
contract WeightedVoting {
    // State variables
    address public owner;
    mapping(address => bool) public hasVoted;
    mapping(uint => uint) public voteCounts;
    uint public totalVotes;
    bool public votingOpen;
    
    // Token integration for vote weighting
    IERC20 public votingToken;
    
    // Events
    event WeightedVoteCast(address indexed voter, uint indexed candidate, uint weight);
    event VotingStatusChanged(bool isOpen);
    
    constructor(address _tokenAddress) {
        owner = msg.sender;
        votingOpen = false;
        votingToken = IERC20(_tokenAddress);
    }
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Start the voting
    function startVoting() public onlyOwner {
        votingOpen = true;
        emit VotingStatusChanged(true);
    }
    
    // End the voting
    function endVoting() public onlyOwner {
        votingOpen = false;
        emit VotingStatusChanged(false);
    }
    
    // Cast a weighted vote based on token balance
    function vote(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        
        // Get voter's token balance for weight
        uint weight = votingToken.balanceOf(msg.sender);
        require(weight > 0, "Must have voting tokens to participate");
        
        hasVoted[msg.sender] = true;
        voteCounts[candidateId] += weight;
        totalVotes += weight;
        
        emit WeightedVoteCast(msg.sender, candidateId, weight);
    }
    
    // Get vote count for a candidate
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
    
    // Get total votes cast
    function getTotalVotes() public view returns (uint) {
        return totalVotes;
    }
${customFeatures.includes('snapshot-balance') ? `
    // Snapshot token balances at a specific block for voting weights
    mapping(address => uint) public snapshotBalances;
    bool public snapshotTaken;
    
    function takeBalanceSnapshot() public onlyOwner {
        require(!snapshotTaken, "Snapshot already taken");
        
        // Iterate through all token holders to snapshot balances
        // Note: In practice, this would be done differently to handle large numbers of token holders
        // This is simplified for demonstration
        address[] memory holders = _getAllTokenHolders();
        for (uint i = 0; i < holders.length; i++) {
            snapshotBalances[holders[i]] = votingToken.balanceOf(holders[i]);
        }
        
        snapshotTaken = true;
    }
    
    // Override vote function to use snapshot balances
    function vote(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        require(snapshotTaken, "Balance snapshot not taken yet");
        
        // Get voter's snapshot balance for weight
        uint weight = snapshotBalances[msg.sender];
        require(weight > 0, "Must have voting tokens in snapshot");
        
        hasVoted[msg.sender] = true;
        voteCounts[candidateId] += weight;
        totalVotes += weight;
        
        emit WeightedVoteCast(msg.sender, candidateId, weight);
    }
` : ''}
}

// Interface for ERC20 tokens (simplified)
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}`;

            case 'quadratic':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Quadratic Voting Contract
 * @dev A voting contract implementing quadratic voting mechanics
 */
contract QuadraticVoting {
    // State variables
    address public owner;
    mapping(address => mapping(uint => uint)) public votesByVoter; // voter => candidate => vote count
    mapping(uint => uint) public voteCounts;
    mapping(address => uint) public voiceCreditsSpent;
    uint public totalVotes;
    bool public votingOpen;
    
    // Token for voice credits
    IERC20 public voiceCreditsToken;
    
    // Events
    event QuadraticVoteCast(address indexed voter, uint indexed candidate, uint voteCount, uint creditsSpent);
    event VotingStatusChanged(bool isOpen);
    
    constructor(address _tokenAddress) {
        owner = msg.sender;
        votingOpen = false;
        voiceCreditsToken = IERC20(_tokenAddress);
    }
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Start the voting
    function startVoting() public onlyOwner {
        votingOpen = true;
        emit VotingStatusChanged(true);
    }
    
    // End the voting
    function endVoting() public onlyOwner {
        votingOpen = false;
        emit VotingStatusChanged(false);
    }
    
    // Cast votes with quadratic cost
    function castVotes(uint candidateId, uint voteCount) public {
        require(votingOpen, "Voting is not open");
        require(voteCount > 0, "Vote count must be positive");
        
        // Calculate quadratic cost: voteCount^2
        uint cost = voteCount * voteCount;
        
        // Check if voter has enough voice credits
        uint voiceCredits = voiceCreditsToken.balanceOf(msg.sender);
        require(voiceCredits >= cost, "Not enough voice credits");
        
        // Transfer voice credits to contract
        require(voiceCreditsToken.transferFrom(msg.sender, address(this), cost), "Voice credits transfer failed");
        
        // Record votes
        votesByVoter[msg.sender][candidateId] += voteCount;
        voteCounts[candidateId] += voteCount;
        totalVotes += voteCount;
        voiceCreditsSpent[msg.sender] += cost;
        
        emit QuadraticVoteCast(msg.sender, candidateId, voteCount, cost);
    }
    
    // Get vote count for a candidate
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
    
    // Get total votes cast
    function getTotalVotes() public view returns (uint) {
        return totalVotes;
    }
    
    // Get votes cast by voter for candidate
    function getVotesByVoter(address voter, uint candidateId) public view returns (uint) {
        return votesByVoter[voter][candidateId];
    }
    
    // Get total voice credits spent by voter
    function getVoiceCreditsSpent(address voter) public view returns (uint) {
        return voiceCreditsSpent[voter];
    }
${customFeatures.includes('refund-unused') ? `
    // Refund unused voice credits after voting ends
    function refundUnusedCredits() public {
        require(!votingOpen, "Voting is still open");
        
        uint voiceCredits = voiceCreditsToken.balanceOf(msg.sender);
        if (voiceCredits > 0) {
            require(voiceCreditsToken.transfer(msg.sender, voiceCredits), "Voice credits transfer failed");
        }
    }
` : ''}
}

// Interface for ERC20 tokens (simplified)
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}`;

            case 'delegated':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Delegated Voting Contract
 * @dev A liquid democracy voting contract with delegation capabilities
 */
contract DelegatedVoting {
    // State variables
    address public owner;
    mapping(address => bool) public hasVoted;
    mapping(address => address) public delegates;
    mapping(uint => uint) public voteCounts;
    uint public totalVotes;
    bool public votingOpen;
    
    // Events
    event VoteCast(address indexed voter, uint indexed candidate);
    event DelegationSet(address indexed delegator, address indexed delegate);
    event VotingStatusChanged(bool isOpen);
    
    constructor() {
        owner = msg.sender;
        votingOpen = false;
    }
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Start the voting
    function startVoting() public onlyOwner {
        votingOpen = true;
        emit VotingStatusChanged(true);
    }
    
    // End the voting
    function endVoting() public onlyOwner {
        votingOpen = false;
        emit VotingStatusChanged(false);
    }
    
    // Delegate your vote to another address
    function delegateVote(address delegate) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        require(delegate != msg.sender, "Cannot delegate to self");
        require(findFinalDelegate(delegate) != msg.sender, "Delegation would create a loop");
        
        delegates[msg.sender] = delegate;
        emit DelegationSet(msg.sender, delegate);
    }
    
    // Find the final delegate in a delegation chain
    function findFinalDelegate(address voter) public view returns (address) {
        address current = voter;
        while (delegates[current] != address(0)) {
            current = delegates[current];
            // Prevent infinite loops by checking for circular delegation
            if (current == voter) {
                return voter;
            }
        }
        return current;
    }
    
    // Cast a vote (directly or on behalf of delegates)
    function vote(uint candidateId) public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        
        // Mark this voter as having voted
        hasVoted[msg.sender] = true;
        
        // Count direct vote
        uint voteWeight = 1;
        
        // Add votes from all delegates who delegated to this voter
        voteWeight += countDelegatedVotes(msg.sender);
        
        // Update vote counts
        voteCounts[candidateId] += voteWeight;
        totalVotes += voteWeight;
        
        emit VoteCast(msg.sender, candidateId);
    }
    
    // Recursively count all votes delegated to an address
    function countDelegatedVotes(address delegate) internal returns (uint) {
        uint delegatedVotes = 0;
        
        for (uint i = 0; i < _votersList.length; i++) {
            address voter = _votersList[i];
            if (!hasVoted[voter] && delegates[voter] == delegate) {
                hasVoted[voter] = true;
                delegatedVotes++;
                
                // Recursively add votes delegated to this voter
                delegatedVotes += countDelegatedVotes(voter);
            }
        }
        
        return delegatedVotes;
    }
    
    // Get vote count for a candidate
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
    
    // Get total votes cast
    function getTotalVotes() public view returns (uint) {
        return totalVotes;
    }
${customFeatures.includes('revoke-delegation') ? `
    // Revoke existing delegation
    function revokeDelegation() public {
        require(votingOpen, "Voting is not open");
        require(!hasVoted[msg.sender], "Already voted");
        require(delegates[msg.sender] != address(0), "No active delegation");
        
        address oldDelegate = delegates[msg.sender];
        delegates[msg.sender] = address(0);
        
        emit DelegationSet(msg.sender, address(0));
    }
` : ''}
}`;

            case 'timelock':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Timelock Governance Contract
 * @dev A governance contract with time-delayed execution for security
 */
contract TimelockGovernance {
    // State variables
    address public owner;
    uint public delay;
    mapping(bytes32 => bool) public queuedTransactions;
    
    // Events
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data);
    
    constructor(uint _delay) {
        require(_delay >= 1 days, "Delay must be at least 1 day");
        owner = msg.sender;
        delay = _delay;
    }
    
    // Modifier to restrict access to owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    // Queue a transaction for future execution
    function queueTransaction(
        address target,
        uint value,
        string memory signature,
        bytes memory data,
        uint eta
    ) public onlyOwner returns (bytes32) {
        require(eta >= block.timestamp + delay, "Estimated execution time must satisfy delay");
        
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;
        
        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }
    
    // Execute a previously queued transaction
    function executeTransaction(
        address target,
        uint value,
        string memory signature,
        bytes memory data,
        uint eta
    ) public onlyOwner returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Transaction hasn't been queued");
        require(block.timestamp >= eta, "Transaction hasn't surpassed time lock");
        require(block.timestamp <= eta + 14 days, "Transaction is stale");
        
        queuedTransactions[txHash] = false;
        
        bytes memory callData;
        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }
        
        // Execute the transaction
        (bool success, bytes memory returnData) = target.call{value: value}(callData);
        require(success, "Transaction execution reverted");
        
        emit ExecuteTransaction(txHash, target, value, signature, data);
        
        return returnData;
    }
    
    // Cancel a queued transaction
    function cancelTransaction(
        address target,
        uint value,
        string memory signature,
        bytes memory data,
        uint eta
    ) public onlyOwner {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Transaction hasn't been queued");
        
        queuedTransactions[txHash] = false;
        
        emit CancelTransaction(txHash, target, value, signature, data);
    }
    
    // Change the delay for future transactions
    function changeDelay(uint newDelay) public {
        require(msg.sender == address(this), "Call must come from Timelock");
        require(newDelay >= 1 days, "Delay must be at least 1 day");
        delay = newDelay;
    }
${customFeatures.includes('emergency-cancel') ? `
    // Emergency cancel by guardian
    address public guardian;
    
    function setGuardian(address newGuardian) public onlyOwner {
        guardian = newGuardian;
    }
    
    function emergencyCancel(
        address target,
        uint value,
        string memory signature,
        bytes memory data,
        uint eta
    ) public {
        require(msg.sender == guardian, "Only guardian can emergency cancel");
        
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Transaction hasn't been queued");
        
        queuedTransactions[txHash] = false;
        
        emit CancelTransaction(txHash, target, value, signature, data);
    }
` : ''}
}`;

            case 'zkp':
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Zero-Knowledge Proof Voting Contract
 * @dev A voting contract that uses ZKP for private voting
 */
contract ZKPVoting {
    // State variables
    address public owner;
    mapping(bytes32 => bool) public nullifierHashes; // prevent double-voting
    mapping(uint => uint) public voteCounts;
    uint public totalVotes;
    
    // ZKP verification key components (simplified for demonstration)
    uint256[2] public alpha1;
    uint256[2][2] public beta2;
    uint256[2] public gamma2;
    uint256[2][2] public delta2;
    uint256[1] public IC0;
    uint256[1][2] public IC;
    
    // Events
    event VoteAdded(bytes32 nullifierHash, uint indexed candidate, bytes32 commitment);
    
    constructor(
        uint256[2] memory _alpha1,
        uint256[2][2] memory _beta2,
        uint256[2] memory _gamma2,
        uint256[2][2] memory _delta2,
        uint256[1] memory _IC0,
        uint256[1][2] memory _IC
    ) {
        owner = msg.sender;
        
        // Store verification key components
        alpha1 = _alpha1;
        beta2 = _beta2;
        gamma2 = _gamma2;
        delta2 = _delta2;
        IC0 = _IC0;
        IC = _IC;
    }
    
    // Cast a private vote with zero-knowledge proof
    function castVote(
        uint[8] calldata _proof,
        bytes32 _nullifierHash,
        uint _candidate,
        bytes32 _commitment
    ) public {
        // Ensure nullifier hash hasn't been used (prevent double voting)
        require(!nullifierHashes[_nullifierHash], "Vote already cast");
        
        // Verify the zero-knowledge proof (simplified)
        require(verifyProof(_proof, _nullifierHash, _candidate, _commitment), "Invalid proof");
        
        // Mark nullifier as used
        nullifierHashes[_nullifierHash] = true;
        
        // Update vote count
        voteCounts[_candidate]++;
        totalVotes++;
        
        emit VoteAdded(_nullifierHash, _candidate, _commitment);
    }
    
    // Verify the zero-knowledge proof (simplified implementation)
    function verifyProof(
        uint[8] calldata _proof,
        bytes32 _nullifierHash,
        uint _candidate,
        bytes32 _commitment
    ) internal view returns (bool) {
        // In a real implementation, this would verify a zk-SNARK proof
        // This is a placeholder that would be replaced with actual verification logic
        
        // Simplified checks for demonstration
        require(_proof[0] != 0, "Proof cannot be zero");
        require(_nullifierHash != bytes32(0), "Nullifier hash cannot be zero");
        require(_commitment != bytes32(0), "Commitment cannot be zero");
        
        // In a real implementation, this would perform cryptographic verification
        return true;
    }
    
    // Get vote count for a candidate
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
    
    // Get total votes cast
    function getTotalVotes() public view returns (uint) {
        return totalVotes;
    }
${customFeatures.includes('batch-verification') ? `
    // Batch vote verification for gas efficiency
    function batchVerifyVotes(
        uint[8][] calldata _proofs,
        bytes32[] calldata _nullifierHashes,
        uint[] calldata _candidates,
        bytes32[] calldata _commitments
    ) public {
        require(
            _proofs.length == _nullifierHashes.length && 
            _nullifierHashes.length == _candidates.length && 
            _candidates.length == _commitments.length,
            "Array lengths must match"
        );
        
        for (uint i = 0; i < _proofs.length; i++) {
            // Ensure nullifier hash hasn't been used
            require(!nullifierHashes[_nullifierHashes[i]], "Vote already cast");
            
            // Verify the zero-knowledge proof
            require(
                verifyProof(_proofs[i], _nullifierHashes[i], _candidates[i], _commitments[i]),
                "Invalid proof"
            );
            
            // Mark nullifier as used
            nullifierHashes[_nullifierHashes[i]] = true;
            
            // Update vote count
            voteCounts[_candidates[i]]++;
            totalVotes++;
            
            emit VoteAdded(_nullifierHashes[i], _candidates[i], _commitments[i]);
        }
    }
` : ''}
}`;

            default:
                return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DefaultVoting {
    // Basic voting contract
    address public owner;
    mapping(address => bool) public hasVoted;
    mapping(uint => uint) public voteCounts;
    uint public totalVotes;
    
    constructor() {
        owner = msg.sender;
    }
    
    function vote(uint candidateId) public {
        require(!hasVoted[msg.sender], "Already voted");
        
        hasVoted[msg.sender] = true;
        voteCounts[candidateId]++;
        totalVotes++;
    }
    
    function getVoteCount(uint candidateId) public view returns (uint) {
        return voteCounts[candidateId];
    }
}`;
        }
    }
    
    /**
     * Analyze a smart contract for security vulnerabilities
     */
    async function scanContractSecurity(contractId) {
        if (!isInitialized) {
            await initialize();
        }
        
        // Find the contract
        const contract = generatedContracts.find(c => c.id === contractId);
        if (!contract) {
            throw new Error(`Contract with ID ${contractId} not found`);
        }
        
        log.info("Scanning contract for security vulnerabilities", { 
            contractId: contractId,
            scanLevel: smartContractsConfig.securityScanLevel
        });
        
        try {
            // In production with secure scanner
            if (isProd && config?.securityServices?.scanSmartContract) {
                try {
                    const result = await config.securityServices.scanSmartContract(contract.code);
                    if (result && Array.isArray(result.vulnerabilities)) {
                        // Store scan results
                        const scanResult = {
                            contractId: contractId,
                            timestamp: new Date(),
                            vulnerabilities: result.vulnerabilities,
                            scanLevel: smartContractsConfig.securityScanLevel,
                            riskScore: result.riskScore || calculateRiskScore(result.vulnerabilities)
                        };
                        
                        securityScanResults.push(scanResult);
                        log.info("Security scan completed with external service", { 
                            contractId: contractId,
                            vulnerabilitiesFound: result.vulnerabilities.length,
                            riskScore: scanResult.riskScore
                        });
                        
                        return scanResult;
                    }
                } catch (scanError) {
                    log.error(scanError, { context: 'securityScanService' });
                    if (!allowMockDataInProd) {
                        throw new Error("Security scan service failed: " + scanError.message);
                    }
                    log.warn("Falling back to local security scan");
                }
            }
            
            // Check if mock scans are allowed in production
            if (isProd && !allowMockDataInProd) {
                throw new Error("Local security scanning not allowed in production environment");
            }
            
            // Perform local security scan
            const vulnerabilities = [];
            
            // Analyze code against vulnerability patterns
            for (const [key, vulnerability] of Object.entries(vulnerabilityPatterns)) {
                // Skip low severity checks if scan level is high
                if (smartContractsConfig.securityScanLevel === 'high' && vulnerability.severity === 'low') {
                    continue;
                }
                
                // Check for pattern in code
                if (vulnerability.pattern.test(contract.code)) {
                    vulnerabilities.push({
                        type: vulnerability.name,
                        severity: vulnerability.severity,
                        description: vulnerability.description,
                        recommendation: vulnerability.recommendation,
                        locations: findVulnerabilityLocations(contract.code, vulnerability.pattern)
                    });
                }
            }
            
            // Additional vulnerability checks based on contract type
            if (contract.type === 'timelock' && !contract.code.includes('require(eta >= block.timestamp + delay)')) {
                vulnerabilities.push({
                    type: "Improper Time Validation",
                    severity: "high",
                    description: "Transaction execution time validation may be incorrect",
                    recommendation: "Ensure that execution time is properly validated against delay"
                });
            }
            
            if (contract.type === 'weighted' && !contract.code.includes('require(weight > 0)')) {
                vulnerabilities.push({
                    type: "Zero Weight Voting",
                    severity: "medium",
                    description: "Voters with zero weight might be able to vote",
                    recommendation: "Add explicit check to ensure voting weight is greater than zero"
                });
            }
            
            // Calculate overall risk score
            const riskScore = calculateRiskScore(vulnerabilities);
            
            // Create scan result
            const scanResult = {
                contractId: contractId,
                timestamp: new Date(),
                vulnerabilities: vulnerabilities,
                scanLevel: smartContractsConfig.securityScanLevel,
                riskScore: riskScore,
                contractType: contract.type
            };
            
            // Store scan result
            securityScanResults.push(scanResult);
            
            log.info("Security scan completed", { 
                contractId: contractId,
                vulnerabilitiesFound: vulnerabilities.length,
                riskScore: riskScore
            });
            
            return scanResult;
        } catch (error) {
            log.error(error, { context: 'scanContractSecurity' });
            throw new Error(`Security scan failed: ${error.message}`);
        }
    }
    
    /**
     * Find line numbers where vulnerabilities occur
     */
    function findVulnerabilityLocations(code, pattern) {
        const lines = code.split('\n');
        const locations = [];
        
        for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
                locations.push({
                    line: i + 1,
                    snippet: lines[i].trim()
                });
            }
        }
        
        return locations;
    }
    
    /**
     * Calculate risk score based on vulnerabilities
     */
    function calculateRiskScore(vulnerabilities) {
        if (!vulnerabilities || vulnerabilities.length === 0) {
            return 0;
        }
        
        let score = 0;
        
        // Weight by severity
        for (const vuln of vulnerabilities) {
            if (vuln.severity === 'high') {
                score += 30;
            } else if (vuln.severity === 'medium') {
                score += 15;
            } else {
                score += 5;
            }
        }
        
        // Cap at 100
        return Math.min(100, score);
    }
    
    /**
     * Optimize contract for gas efficiency
     */
    async function optimizeContractGas(contractId) {
        if (!isInitialized) {
            await initialize();
        }
        
        // Find the contract
        const contract = generatedContracts.find(c => c.id === contractId);
        if (!contract) {
            throw new Error(`Contract with ID ${contractId} not found`);
        }
        
        log.info("Optimizing contract for gas efficiency", { contractId: contractId });
        
        try {
            // In production with optimizer service
            if (isProd && config?.optimizationServices?.optimizeSmartContract) {
                try {
                    const result = await config.optimizationServices.optimizeSmartContract(contract.code);
                    if (result && result.optimizedCode) {
                        // Create optimization result
                        const optimizationResult = {
                            contractId: contractId,
                            timestamp: new Date(),
                            originalSize: contract.code.length,
                            optimizedSize: result.optimizedCode.length,
                            sizeSavings: contract.code.length - result.optimizedCode.length,
                            optimizations: result.optimizations || [],
                            gasSavings: result.estimatedGasSavings || 'Unknown'
                        };
                        
                        // Store optimization result
                        optimizationResults.push(optimizationResult);
                        
                        // Update contract with optimized code
                        contract.code = result.optimizedCode;
                        contract.isOptimized = true;
                        
                        log.info("Contract optimization completed with external service", { 
                            contractId: contractId,
                            sizeSavings: optimizationResult.sizeSavings,
                            gasSavings: optimizationResult.gasSavings
                        });
                        
                        return optimizationResult;
                    }
                } catch (optError) {
                    log.error(optError, { context: 'optimizationService' });
                    if (!allowMockDataInProd) {
                        throw new Error("Optimization service failed: " + optError.message);
                    }
                    log.warn("Falling back to local optimization");
                }
            }
            
            // Check if mock optimization is allowed in production
            if (isProd && !allowMockDataInProd) {
                throw new Error("Local optimization not allowed in production environment");
            }
            
            // Perform simple local optimization (demonstration only)
            // In a real implementation, this would use a proper Solidity optimizer
            
            // Sample optimization patterns
            const optimizationPatterns = [
                { pattern: /uint\s+public/g, replacement: "uint256 public", description: "Use explicit uint256 for clarity" },
                { pattern: /address\s+public/g, replacement: "address public", description: "Consistent address declaration" },
                { pattern: /mapping\(([^)]+)\)\s+public\s+([a-zA-Z0-9_]+)/g, replacement: "mapping($1) public $2", description: "Consistent mapping formatting" },
                { pattern: /function\s+[a-zA-Z0-9_]+\(\)/g, replacement: (match) => match + " external", description: "Use external instead of public for functions without parameters" },
                { pattern: /{\s*return ([^;]+);\s*}/g, replacement: "{ return $1; }", description: "Compact return statements" }
            ];
            
            let optimizedCode = contract.code;
            const appliedOptimizations = [];
            
            // Apply optimization patterns
            for (const opt of optimizationPatterns) {
                const originalLength = optimizedCode.length;
                optimizedCode = optimizedCode.replace(opt.pattern, opt.replacement);
                
                if (optimizedCode.length !== originalLength) {
                    appliedOptimizations.push({
                        description: opt.description,
                        occurrences: (originalLength - optimizedCode.length) / (originalLength / contract.code.match(opt.pattern)?.length || 1)
                    });
                }
            }
            
            // Create optimization result
            const optimizationResult = {
                contractId: contractId,
                timestamp: new Date(),
                originalSize: contract.code.length,
                optimizedSize: optimizedCode.length,
                sizeSavings: contract.code.length - optimizedCode.length,
                optimizations: appliedOptimizations,
                gasSavings: "Estimated 5-10% (mock data)"
            };
            
            // Store optimization result
            optimizationResults.push(optimizationResult);
            
            // Update contract with optimized code
            contract.code = optimizedCode;
            contract.isOptimized = true;
            
            log.info("Contract optimization completed", { 
                contractId: contractId,
                sizeSavings: optimizationResult.sizeSavings,
                optimizationsApplied: appliedOptimizations.length
            });
            
            return optimizationResult;
        } catch (error) {
            log.error(error, { context: 'optimizeContractGas' });
            throw new Error(`Gas optimization failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate estimated deployment cost
     */
    function estimateDeploymentCost(contractId) {
        // Find the contract
        const contract = generatedContracts.find(c => c.id === contractId);
        if (!contract) {
            throw new Error(`Contract with ID ${contractId} not found`);
        }
        
        // Very simplified gas estimation based on code size
        // In a real implementation, this would use proper gas estimation
        const bytesPerGas = 68; // Approximate bytes per gas unit
        const overhead = 21000; // Base transaction cost
        const deploymentOverhead = 32000; // Additional cost for contract creation
        
        const sizeInBytes = new Blob([contract.code]).size;
        const estimatedGas = Math.ceil(sizeInBytes / bytesPerGas) + overhead + deploymentOverhead;
        
        // Calculate cost at different gas prices
        const gasPrices = {
            low: 20, // Gwei
            medium: 40, // Gwei
            high: 80 // Gwei
        };
        
        const costs = {};
        for (const [priority, price] of Object.entries(gasPrices)) {
            costs[priority] = {
                gas: estimatedGas,
                price: price,
                costInEth: (estimatedGas * price) / 1e9
            };
        }
        
        return {
            contractId,
            contractType: contract.type,
            contractSize: sizeInBytes,
            estimates: costs,
            isOptimized: contract.isOptimized || false
        };
    }
    
    /**
     * Create UI elements for smart contract management
     */
    function createSmartContractsUI() {
        if (!smartContractsConfig.renderUI) {
            log.debug("Skipping UI creation - UI rendering is disabled");
            return;
        }
        
        try {
            // Check if the UI already exists
            if (document.getElementById('smartContractsContainer')) {
                log.debug("Smart contracts UI already exists, skipping creation");
                return;
            }
            
            // Create the container
            const container = document.createElement('div');
            container.id = 'smartContractsContainer';
            container.className = 'smart-contracts-container';
            
            // Create basic structure
            container.innerHTML = `
                <h3>AI-Powered Smart Contracts</h3>
                
                <div class="contracts-description">
                    <p>Create, analyze, and optimize smart contracts for decentralized voting with AI assistance. 
                    This module provides advanced security scanning and gas optimization to ensure your voting contracts 
                    are secure and cost-effective.</p>
                </div>
                
                <div class="contracts-tabs">
                    <div class="tabs-header">
                        <button class="tab-button active" data-tab="generate">Generate Contract</button>
                        <button class="tab-button" data-tab="analyze">Security Analysis</button>
                        <button class="tab-button" data-tab="optimize">Gas Optimization</button>
                        <button class="tab-button" data-tab="deploy">Deployment</button>
                    </div>
                    
                    <div class="tab-content active" id="generateTab">
                        <div class="generator-form">
                            <h4>Contract Generator</h4>
                            
                            <div class="form-group">
                                <label for="contractName">Contract Name</label>
                                <input type="text" id="contractName" placeholder="MyVotingContract" class="form-input">
                            </div>
                            
                            <div class="form-group">
                                <label for="contractType">Contract Type</label>
                                <select id="contractType" class="form-select">
                                    <option value="standard">Standard Voting</option>
                                    <option value="weighted">Weighted Voting</option>
                                    <option value="quadratic">Quadratic Voting</option>
                                    <option value="delegated">Delegated Voting</option>
                                    <option value="timelock">Timelock Governance</option>
                                    <option value="zkp">Zero-Knowledge Voting</option>
                                </select>
                            </div>
                            
                            <div class="form-group">
                                <label>Custom Features</label>
                                <div class="checkbox-group" id="customFeatures">
                                    <!-- Features will be populated based on selected contract type -->
                                </div>
                            </div>
                            
                            <div class="form-group">
                                <label for="contractDescription">Description</label>
                                <textarea id="contractDescription" rows="3" placeholder="Describe the purpose of this contract..." class="form-textarea"></textarea>
                            </div>
                            
                            <div class="form-options">
                                <div class="checkbox-item">
                                    <input type="checkbox" id="runSecurityScan" checked>
                                    <label for="runSecurityScan">Run security scan after generation</label>
                                </div>
                                
                                <div class="checkbox-item">
                                    <input type="checkbox" id="optimizeGas" checked>
                                    <label for="optimizeGas">Optimize for gas efficiency</label>
                                </div>
                            </div>
                            
                            <button id="generateContractBtn" class="primary-button">Generate Contract</button>
                        </div>
                        
                        <div class="code-preview">
                            <div class="preview-header">
                                <h4>Preview</h4>
                                <div class="actions">
                                    <button id="copyCodeBtn" class="icon-button" title="Copy code">📋</button>
                                    <button id="downloadCodeBtn" class="icon-button" title="Download contract">💾</button>
                                </div>
                            </div>
                            <pre id="contractCodePreview" class="code-container">// Contract code will appear here after generation</pre>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="analyzeTab">
                        <div class="security-analysis">
                            <h4>Security Analysis</h4>
                            
                            <div class="form-group">
                                <label for="contractToAnalyze">Select Contract</label>
                                <select id="contractToAnalyze" class="form-select">
                                    <option value="">-- Select a contract --</option>
                                </select>
                            </div>
                            
                            <div class="scan-options">
                                <div class="form-group">
                                    <label for="securityScanLevel">Scan Level</label>
                                    <select id="securityScanLevel" class="form-select">
                                        <option value="basic">Basic</option>
                                        <option value="medium" selected>Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                
                                <button id="scanContractBtn" class="primary-button">Scan Contract</button>
                            </div>
                            
                            <div id="scanResults" class="scan-results">
                                <div class="empty-state">
                                    <p>No security scan results yet. Select a contract and run a scan.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="optimizeTab">
                        <div class="gas-optimization">
                            <h4>Gas Optimization</h4>
                            
                            <div class="form-group">
                                <label for="contractToOptimize">Select Contract</label>
                                <select id="contractToOptimize" class="form-select">
                                    <option value="">-- Select a contract --</option>
                                </select>
                            </div>
                            
                            <div class="optimization-options">
                                <button id="optimizeContractBtn" class="primary-button">Optimize Gas Usage</button>
                            </div>
                            
                            <div id="optimizationResults" class="optimization-results">
                                <div class="empty-state">
                                    <p>No optimization results yet. Select a contract and run optimization.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="deployTab">
                        <div class="deployment-options">
                            <h4>Deployment Options</h4>
                            
                            <div class="form-group">
                                <label for="contractToDeploy">Select Contract</label>
                                <select id="contractToDeploy" class="form-select">
                                    <option value="">-- Select a contract --</option>
                                </select>
                            </div>
                            
                            <div class="network-selection">
                                <div class="form-group">
                                    <label for="deploymentNetwork">Network</label>
                                    <select id="deploymentNetwork" class="form-select">
                                        <option value="localhost">Localhost</option>
                                        <option value="testnet">Testnet</option>
                                        <option value="mainnet" ${isProd ? '' : 'disabled'}>Mainnet ${isProd ? '' : '(Disabled in Development)'}</option>
                                    </select>
                                </div>
                                
                                <button id="estimateCostBtn" class="secondary-button">Estimate Cost</button>
                                <button id="deployContractBtn" class="primary-button">Deploy Contract</button>
                            </div>
                            
                            <div id="deploymentResults" class="deployment-results">
                                <div class="empty-state">
                                    <p>No deployment information yet. Select a contract and estimate deployment cost.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${isProd ? '<div class="environment-badge production">Production Environment</div>' : 
                  '<div class="environment-badge development">Development Environment</div>'}
            `;
            
            // Determine where to add the container
            const position = smartContractsConfig.uiPosition;
            let targetElement = null;
            
            if (position === 'afterVotingSection') {
                // Try to find voting section
                targetElement = document.querySelector('.voting-section') || 
                               document.getElementById('votingSection');
            } else if (position === 'beforeResults') {
                // Try to find results section
                targetElement = document.querySelector('.results-section') || 
                               document.getElementById('resultsSection');
            } else if (position === 'end') {
                // Add at the end of main content
                targetElement = document.querySelector('main') || document.querySelector('body');
                targetElement.appendChild(container);
                addSmartContractsEventListeners();
                addSmartContractsStyles();
                return; // No need to use insertBefore
            }
            
            // Insert the container
            if (targetElement) {
                targetElement.parentNode.insertBefore(container, targetElement.nextSibling);
            } else {
                // Fallback: add to the main container
                const mainContainer = document.querySelector('main') || document.querySelector('body');
                mainContainer.appendChild(container);
            }
            
            // Add event listeners
            addSmartContractsEventListeners();
            
            // Add CSS styles
            addSmartContractsStyles();
            
            log.debug("Smart contracts UI elements created successfully");
        } catch (error) {
            log.error(error, { context: 'createSmartContractsUI' });
        }
    }
    
    /**
     * Add event listeners to smart contracts UI elements
     */
    function addSmartContractsEventListeners() {
        try {
            // Tab switching
            document.querySelectorAll('.tab-button').forEach(button => {
                button.addEventListener('click', function() {
                    try {
                        // Set active button
                        document.querySelectorAll('.tab-button').forEach(btn => {
                            btn.classList.remove('active');
                        });
                        this.classList.add('active');
                        
                        // Show corresponding tab
                        const tabId = this.dataset.tab;
                        document.querySelectorAll('.tab-content').forEach(tab => {
                            tab.classList.remove('active');
                        });
                        document.getElementById(`${tabId}Tab`).classList.add('active');
                        
                        // Load appropriate data for tab
                        if (tabId === 'analyze' || tabId === 'optimize' || tabId === 'deploy') {
                            updateContractDropdowns();
                        }
                    } catch (error) {
                        log.error(error, { context: 'tabSwitching' });
                    }
                });
            });
            
            // Contract type change
            const contractTypeSelect = document.getElementById('contractType');
            if (contractTypeSelect) {
                contractTypeSelect.addEventListener('change', function() {
                    updateCustomFeatures(this.value);
                });
                
                // Initialize custom features
                updateCustomFeatures(contractTypeSelect.value);
            }
            
            // Generate contract button
            const generateBtn = document.getElementById('generateContractBtn');
            if (generateBtn) {
                generateBtn.addEventListener('click', async function() {
                    try {
                        // Show loading state
                        this.disabled = true;
                        this.textContent = 'Generating...';
                        
                        // Get form values
                        const name = document.getElementById('contractName').value || `VotingContract_${Date.now()}`;
                        const type = document.getElementById('contractType').value;
                        const description = document.getElementById('contractDescription').value;
                        
                        // Get selected features
                        const customFeatures = [];
                        document.querySelectorAll('#customFeatures input[type=checkbox]:checked').forEach(checkbox => {
                            customFeatures.push(checkbox.value);
                        });
                        
                        // Get options
                        const runSecurityScan = document.getElementById('runSecurityScan').checked;
                        const optimizeGas = document.getElementById('optimizeGas').checked;
                        
                        // Generate contract
                        const params = {
                            name: name,
                            contractType: type,
                            description: description,
                            customFeatures: customFeatures,
                            runSecurityScan: runSecurityScan,
                            optimizeGas: optimizeGas
                        };
                        
                        const result = await generateContract(params);
                        
                        // Display generated code
                        const codePreview = document.getElementById('contractCodePreview');
                        if (codePreview) {
                            codePreview.textContent = result.code;
                        }
                        
                        // Update contract dropdowns
                        updateContractDropdowns();
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Generate Contract';
                        
                        // Show success message
                        showNotification('Contract generated successfully!', 'success');
                    } catch (error) {
                        log.error(error, { context: 'generateContract' });
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Generate Contract';
                        
                        // Show error message
                        showNotification(`Error: ${error.message}`, 'error');
                    }
                });
            }
            
            // Scan contract button
            const scanBtn = document.getElementById('scanContractBtn');
            if (scanBtn) {
                scanBtn.addEventListener('click', async function() {
                    try {
                        const contractId = document.getElementById('contractToAnalyze').value;
                        if (!contractId) {
                            showNotification('Please select a contract to scan', 'warning');
                            return;
                        }
                        
                        // Show loading state
                        this.disabled = true;
                        this.textContent = 'Scanning...';
                        
                        // Set scan level from UI
                        smartContractsConfig.securityScanLevel = document.getElementById('securityScanLevel').value;
                        
                        // Run security scan
                        const result = await scanContractSecurity(contractId);
                        
                        // Display scan results
                        displayScanResults(result);
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Scan Contract';
                    } catch (error) {
                        log.error(error, { context: 'scanContract' });
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Scan Contract';
                        
                        // Show error message
                        showNotification(`Error: ${error.message}`, 'error');
                    }
                });
            }
            
            // Optimize contract button
            const optimizeBtn = document.getElementById('optimizeContractBtn');
            if (optimizeBtn) {
                optimizeBtn.addEventListener('click', async function() {
                    try {
                        const contractId = document.getElementById('contractToOptimize').value;
                        if (!contractId) {
                            showNotification('Please select a contract to optimize', 'warning');
                            return;
                        }
                        
                        // Show loading state
                        this.disabled = true;
                        this.textContent = 'Optimizing...';
                        
                        // Run optimization
                        const result = await optimizeContractGas(contractId);
                        
                        // Display optimization results
                        displayOptimizationResults(result);
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Optimize Gas Usage';
                    } catch (error) {
                        log.error(error, { context: 'optimizeContract' });
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Optimize Gas Usage';
                        
                        // Show error message
                        showNotification(`Error: ${error.message}`, 'error');
                    }
                });
            }
            
            // Estimate deployment cost button
            const estimateBtn = document.getElementById('estimateCostBtn');
            if (estimateBtn) {
                estimateBtn.addEventListener('click', function() {
                    try {
                        const contractId = document.getElementById('contractToDeploy').value;
                        if (!contractId) {
                            showNotification('Please select a contract to estimate', 'warning');
                            return;
                        }
                        
                        // Estimate deployment cost
                        const estimate = estimateDeploymentCost(contractId);
                        
                        // Display deployment estimate
                        displayDeploymentEstimate(estimate);
                    } catch (error) {
                        log.error(error, { context: 'estimateDeployment' });
                        
                        // Show error message
                        showNotification(`Error: ${error.message}`, 'error');
                    }
                });
            }
            
            // Deploy contract button
            const deployBtn = document.getElementById('deployContractBtn');
            if (deployBtn) {
                deployBtn.addEventListener('click', async function() {
                    try {
                        const contractId = document.getElementById('contractToDeploy').value;
                        if (!contractId) {
                            showNotification('Please select a contract to deploy', 'warning');
                            return;
                        }
                        
                        const network = document.getElementById('deploymentNetwork').value;
                        
                        // Show confirmation dialog for mainnet
                        if (network === 'mainnet') {
                            if (!confirm('Are you sure you want to deploy to mainnet? This will use real funds.')) {
                                return;
                            }
                        }
                        
                        // Show loading state
                        this.disabled = true;
                        this.textContent = 'Deploying...';
                        
                        // In a real implementation, this would connect to Web3 and deploy
                        if (isProd && config?.web3Services?.deployContract) {
                            try {
                                const contract = generatedContracts.find(c => c.id === contractId);
                                const result = await config.web3Services.deployContract(contract.code, network);
                                
                                // Display deployment result
                                displayDeploymentResult(result);
                            } catch (deployError) {
                                log.error(deployError, { context: 'deployContractService' });
                                showNotification(`Deployment failed: ${deployError.message}`, 'error');
                            }
                        } else {
                            // Mock deployment
                            await simulateDelay(3000);
                            
                            // Display mock result
                            const mockResult = {
                                success: true,
                                contractId: contractId,
                                network: network,
                                address: '0x' + generateRandomId(40),
                                transactionHash: '0x' + generateRandomId(64),
                                deploymentTime: new Date(),
                                gasCost: network === 'mainnet' ? '0.0541 ETH' : '0.0041 ETH'
                            };
                            
                            displayDeploymentResult(mockResult);
                            
                            showNotification('Contract deployed successfully (simulation)', 'success');
                        }
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Deploy Contract';
                    } catch (error) {
                        log.error(error, { context: 'deployContract' });
                        
                        // Reset button state
                        this.disabled = false;
                        this.textContent = 'Deploy Contract';
                        
                        // Show error message
                        showNotification(`Error: ${error.message}`, 'error');
                    }
                });
            }
            
            // Copy code button
            const copyCodeBtn = document.getElementById('copyCodeBtn');
            if (copyCodeBtn) {
                copyCodeBtn.addEventListener('click', function() {
                    try {
                        const codePreview = document.getElementById('contractCodePreview');
                        if (codePreview && codePreview.textContent) {
                            // Copy to clipboard
                            navigator.clipboard.writeText(codePreview.textContent).then(() => {
                                showNotification('Code copied to clipboard', 'success');
                            }).catch(error => {
                                log.error(error, { context: 'copyToClipboard' });
                                showNotification('Failed to copy code', 'error');
                            });
                        }
                    } catch (error) {
                        log.error(error, { context: 'copyCode' });
                        showNotification('Failed to copy code', 'error');
                    }
                });
            }
            
            // Download code button
            const downloadCodeBtn = document.getElementById('downloadCodeBtn');
            if (downloadCodeBtn) {
                downloadCodeBtn.addEventListener('click', function() {
                    try {
                        const codePreview = document.getElementById('contractCodePreview');
                        if (codePreview && codePreview.textContent) {
                            // Create download link
                            const blob = new Blob([codePreview.textContent], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = document.getElementById('contractName').value + '.sol' || 'contract.sol';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            
                            showNotification('Code downloaded', 'success');
                        }
                    } catch (error) {
                        log.error(error, { context: 'downloadCode' });
                        showNotification('Failed to download code', 'error');
                    }
                });
            }
        } catch (error) {
            log.error(error, { context: 'addSmartContractsEventListeners' });
        }
    }
    
    /**
     * Update custom features checkboxes based on contract type
     */
    function updateCustomFeatures(contractType) {
        try {
            const featuresContainer = document.getElementById('customFeatures');
            if (!featuresContainer) return;
            
            // Clear existing features
            featuresContainer.innerHTML = '';
            
            // Add features based on contract type
            let features = [];
            
            switch (contractType) {
                case 'standard':
                    features = [
                        { id: 'vote-delegation', label: 'Vote Delegation' },
                        { id: 'time-limit', label: 'Time-Limited Voting' },
                        { id: 'minimum-quorum', label: 'Minimum Quorum Requirement' }
                    ];
                    break;
                case 'weighted':
                    features = [
                        { id: 'snapshot-balance', label: 'Balance Snapshot' },
                        { id: 'delegation', label: 'Delegation' },
                        { id: 'voter-whitelist', label: 'Voter Whitelist' }
                    ];
                    break;
                case 'quadratic':
                    features = [
                        { id: 'refund-unused', label: 'Refund Unused Credits' },
                        { id: 'credit-transfer', label: 'Credit Transfer' },
                        { id: 'multi-proposal', label: 'Multi-Proposal Voting' }
                    ];
                    break;
                case 'delegated':
                    features = [
                        { id: 'revoke-delegation', label: 'Revoke Delegation' },
                        { id: 'public-delegation', label: 'Public Delegation Records' },
                        { id: 'delegate-limits', label: 'Delegation Limits' }
                    ];
                    break;
                case 'timelock':
                    features = [
                        { id: 'emergency-cancel', label: 'Emergency Cancellation' },
                        { id: 'veto-power', label: 'Veto Power' },
                        { id: 'tiered-delays', label: 'Tiered Delays' }
                    ];
                    break;
                case 'zkp':
                    features = [
                        { id: 'batch-verification', label: 'Batch Verification' },
                        { id: 'credential-verification', label: 'Credential Verification' },
                        { id: 'nullifier-registry', label: 'External Nullifier Registry' }
                    ];
                    break;
                default:
                    features = [];
                    break;
            }
            
            // Add feature checkboxes
            features.forEach(feature => {
                const checkboxItem = document.createElement('div');
                checkboxItem.className = 'checkbox-item';
                checkboxItem.innerHTML = `
                    <input type="checkbox" id="${feature.id}" value="${feature.id}">
                    <label for="${feature.id}">${feature.label}</label>
                `;
                featuresContainer.appendChild(checkboxItem);
            });
        } catch (error) {
            log.error(error, { context: 'updateCustomFeatures' });
        }
    }
    
    /**
     * Update contract dropdowns in all tabs
     */
    function updateContractDropdowns() {
        try {
            const dropdowns = [
                document.getElementById('contractToAnalyze'),
                document.getElementById('contractToOptimize'),
                document.getElementById('contractToDeploy')
            ];
            
            dropdowns.forEach(dropdown => {
                if (!dropdown) return;
                
                // Save selected value
                const selectedValue = dropdown.value;
                
                // Clear existing options
                dropdown.innerHTML = '<option value="">-- Select a contract --</option>';
                
                // Add options for each generated contract
                generatedContracts.forEach(contract => {
                    const option = document.createElement('option');
                    option.value = contract.id;
                    option.textContent = `${contract.name} (${contractTemplates[contract.type]?.name || contract.type})`;
                    
                    // Add indicator for optimized contracts
                    if (contract.isOptimized) {
                        option.textContent += ' [Optimized]';
                    }
                    
                    dropdown.appendChild(option);
                });
                
                // Restore selected value if it still exists
                if (selectedValue) {
                    dropdown.value = selectedValue;
                }
            });
        } catch (error) {
            log.error(error, { context: 'updateContractDropdowns' });
        }
    }
    
    /**
     * Display security scan results
     */
    function displayScanResults(result) {
        try {
            const resultsContainer = document.getElementById('scanResults');
            if (!resultsContainer) return;
            
            // Get contract name
            const contract = generatedContracts.find(c => c.id === result.contractId);
            const contractName = contract ? contract.name : 'Unknown Contract';
            
            // Create results HTML
            let html = `
                <div class="scan-result">
                    <div class="result-header">
                        <div class="result-title">
                            <h5>${contractName} - Security Scan</h5>
                            <span class="scan-timestamp">${formatDateTime(result.timestamp)}</span>
                        </div>
                        <div class="risk-score-container">
                            <div class="risk-score ${getRiskScoreClass(result.riskScore)}">
                                <span class="score-value">${result.riskScore}</span>
                                <span class="score-label">Risk Score</span>
                            </div>
                        </div>
                    </div>
                    <div class="result-details">
                        <div class="scan-info">
                            <div class="info-item">
                                <span class="info-label">Scan Level:</span>
                                <span class="info-value">${result.scanLevel}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Vulnerabilities:</span>
                                <span class="info-value">${result.vulnerabilities.length}</span>
                            </div>
                        </div>
            `;
            
            // Add vulnerabilities
            if (result.vulnerabilities.length > 0) {
                html += `<div class="vulnerabilities-list">`;
                
                result.vulnerabilities.forEach(vuln => {
                    html += `
                        <div class="vulnerability-item severity-${vuln.severity}">
                            <div class="vulnerability-header">
                                <div class="vuln-title">
                                    <span class="severity-badge ${vuln.severity}">${capitalizeFirst(vuln.severity)}</span>
                                    <span class="vuln-name">${vuln.type}</span>
                                </div>
                            </div>
                            <div class="vulnerability-details">
                                <p>${vuln.description}</p>
                                <div class="recommendation">
                                    <strong>Recommendation:</strong> ${vuln.recommendation}
                                </div>
                    `;
                    
                    // Add location details if available
                    if (vuln.locations && vuln.locations.length > 0) {
                        html += `<div class="locations">
                            <strong>Locations:</strong>
                            <ul>`;
                        
                        vuln.locations.forEach(loc => {
                            html += `<li>Line ${loc.line}: <code>${loc.snippet}</code></li>`;
                        });
                        
                        html += `</ul></div>`;
                    }
                    
                    html += `</div></div>`;
                });
                
                html += `</div>`;
            } else {
                html += `
                    <div class="no-vulnerabilities">
                        <p>No vulnerabilities detected. Good job!</p>
                    </div>
                `;
            }
            
            html += `</div></div>`;
            
            // Set HTML
            resultsContainer.innerHTML = html;
        } catch (error) {
            log.error(error, { context: 'displayScanResults' });
        }
    }
    
    /**
     * Display optimization results
     */
    function displayOptimizationResults(result) {
        try {
            const resultsContainer = document.getElementById('optimizationResults');
            if (!resultsContainer) return;
            
            // Get contract name
            const contract = generatedContracts.find(c => c.id === result.contractId);
            const contractName = contract ? contract.name : 'Unknown Contract';
            
            // Calculate improvement percentage
            const improvementPercent = result.originalSize > 0 ? 
                ((result.sizeSavings / result.originalSize) * 100).toFixed(2) : 0;
            
            // Create results HTML
            let html = `
                <div class="optimization-result">
                    <div class="result-header">
                        <div class="result-title">
                            <h5>${contractName} - Gas Optimization</h5>
                            <span class="optimization-timestamp">${formatDateTime(result.timestamp)}</span>
                        </div>
                        <div class="improvement-container">
                            <div class="improvement-badge ${improvementPercent > 5 ? 'significant' : 'minor'}">
                                <span class="improvement-value">${improvementPercent}%</span>
                                <span class="improvement-label">Improved</span>
                            </div>
                        </div>
                    </div>
                    <div class="result-details">
                        <div class="optimization-info">
                            <div class="info-item">
                                <span class="info-label">Original Size:</span>
                                <span class="info-value">${result.originalSize} bytes</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Optimized Size:</span>
                                <span class="info-value">${result.optimizedSize} bytes</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Size Reduction:</span>
                                <span class="info-value">${result.sizeSavings} bytes</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Gas Savings:</span>
                                <span class="info-value">${result.gasSavings}</span>
                            </div>
                        </div>
            `;
            
            // Add optimizations
            if (result.optimizations.length > 0) {
                html += `<div class="optimizations-list">
                    <h6>Applied Optimizations</h6>
                    <ul>`;
                
                result.optimizations.forEach(opt => {
                    html += `<li>${opt.description}${opt.occurrences ? ` (${opt.occurrences} occurrences)` : ''}</li>`;
                });
                
                html += `</ul></div>`;
            }
            
            html += `</div></div>`;
            
            // Set HTML
            resultsContainer.innerHTML = html;
        } catch (error) {
            log.error(error, { context: 'displayOptimizationResults' });
        }
    }
    
    /**
     * Display deployment cost estimate
     */
    function displayDeploymentEstimate(estimate) {
        try {
            const resultsContainer = document.getElementById('deploymentResults');
            if (!resultsContainer) return;
            
            // Get contract name
            const contract = generatedContracts.find(c => c.id === estimate.contractId);
            const contractName = contract ? contract.name : 'Unknown Contract';
            
            // Create results HTML
            let html = `
                <div class="deployment-estimate">
                    <div class="estimate-header">
                        <h5>${contractName} - Deployment Estimate</h5>
                    </div>
                    <div class="estimate-details">
                        <div class="estimate-info">
                            <div class="info-item">
                                <span class="info-label">Contract Type:</span>
                                <span class="info-value">${contractTemplates[estimate.contractType]?.name || estimate.contractType}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Contract Size:</span>
                                <span class="info-value">${estimate.contractSize} bytes</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Optimization:</span>
                                <span class="info-value">${estimate.isOptimized ? 'Applied' : 'Not Applied'}</span>
                            </div>
                        </div>
                        
                        <div class="cost-estimates">
                            <h6>Estimated Costs</h6>
                            <div class="cost-table">
                                <div class="cost-header">
                                    <div class="cost-cell">Priority</div>
                                    <div class="cost-cell">Gas</div>
                                    <div class="cost-cell">Gas Price (Gwei)</div>
                                    <div class="cost-cell">Cost (ETH)</div>
                                </div>
            `;
            
            // Add cost rows
            for (const [priority, cost] of Object.entries(estimate.estimates)) {
                html += `
                    <div class="cost-row">
                        <div class="cost-cell">${capitalizeFirst(priority)}</div>
                        <div class="cost-cell">${cost.gas.toLocaleString()}</div>
                        <div class="cost-cell">${cost.price}</div>
                        <div class="cost-cell">${cost.costInEth.toFixed(6)}</div>
                    </div>
                `;
            }
            
            html += `</div></div>`;
            
            // Add gas saving notice if not optimized
            if (!estimate.isOptimized) {
                html += `
                    <div class="optimization-notice">
                        <p>ℹ️ You could reduce deployment costs by optimizing this contract for gas efficiency.</p>
                    </div>
                `;
            }
            
            html += `</div></div>`;
            
            // Set HTML
            resultsContainer.innerHTML = html;
        } catch (error) {
            log.error(error, { context: 'displayDeploymentEstimate' });
        }
    }
    
    /**
     * Display deployment result
     */
    function displayDeploymentResult(result) {
        try {
            const resultsContainer = document.getElementById('deploymentResults');
            if (!resultsContainer) return;
            
            // Get contract name
            const contract = generatedContracts.find(c => c.id === result.contractId);
            const contractName = contract ? contract.name : 'Unknown Contract';
            
            // Create results HTML
            let html = `
                <div class="deployment-result ${result.success ? 'success' : 'error'}">
                    <div class="result-header">
                        <div class="result-title">
                            <h5>${contractName} - Deployment ${result.success ? 'Success' : 'Failed'}</h5>
                            <span class="deployment-timestamp">${formatDateTime(result.deploymentTime)}</span>
                        </div>
                        <div class="status-badge ${result.success ? 'success' : 'error'}">
                            ${result.success ? '✓ Deployed' : '✗ Failed'}
                        </div>
                    </div>
                    <div class="result-details">
                        <div class="deployment-info">
                            <div class="info-item">
                                <span class="info-label">Network:</span>
                                <span class="info-value">${capitalizeFirst(result.network)}</span>
                            </div>
            `;
            
            if (result.success) {
                html += `
                    <div class="info-item">
                        <span class="info-label">Contract Address:</span>
                        <span class="info-value">${result.address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Transaction Hash:</span>
                        <span class="info-value">${result.transactionHash}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Gas Cost:</span>
                        <span class="info-value">${result.gasCost}</span>
                    </div>
                `;
                
                // Add etherscan link for non-localhost networks
                if (result.network !== 'localhost') {
                    const baseUrl = result.network === 'mainnet' ? 
                        'https://etherscan.io' : 
                        `https://${result.network}.etherscan.io`;
                    
                    html += `
                        <div class="info-item">
                            <span class="info-label">Etherscan:</span>
                            <span class="info-value">
                                <a href="${baseUrl}/address/${result.address}" target="_blank" rel="noopener noreferrer">View Contract</a>
                                | 
                                <a href="${baseUrl}/tx/${result.transactionHash}" target="_blank" rel="noopener noreferrer">View Transaction</a>
                            </span>
                        </div>
                    `;
                }
            } else {
                // Error details
                html += `
                    <div class="info-item">
                        <span class="info-label">Error:</span>
                        <span class="info-value error-text">${result.error || 'Unknown error occurred'}</span>
                    </div>
                `;
            }
            
            html += `</div></div></div>`;
            
            // Set HTML
            resultsContainer.innerHTML = html;
        } catch (error) {
            log.error(error, { context: 'displayDeploymentResult' });
        }
    }
    
    /**
     * Show a warning about Web3 connection issues
     */
    function showWeb3Warning() {
        try {
            // Create warning element
            const warning = document.createElement('div');
            warning.className = 'web3-warning';
            warning.innerHTML = `
                <div class="warning-content">
                    <div class="warning-icon">⚠️</div>
                    <div class="warning-message">
                        <h5>Web3 Connection Issue</h5>
                        <p>Could not connect to blockchain. Some features may be limited.</p>
                    </div>
                    <button class="dismiss-button">✕</button>
                </div>
            `;
            
            // Add to container
            const container = document.getElementById('smartContractsContainer');
            if (container) {
                container.insertBefore(warning, container.firstChild);
                
                // Add dismiss button functionality
                const dismissBtn = warning.querySelector('.dismiss-button');
                if (dismissBtn) {
                    dismissBtn.addEventListener('click', () => {
                        warning.remove();
                    });
                }
            }
        } catch (error) {
            log.error(error, { context: 'showWeb3Warning' });
        }
    }
    
    /**
     * Show a system error message
     */
    function showSystemError(message) {
        try {
            // Create error element
            const errorElement = document.createElement('div');
            errorElement.className = 'system-error';
            errorElement.innerHTML = `
                <div class="error-content">
                    <div class="error-icon">❌</div>
                    <div class="error-message">
                        <h5>System Error</h5>
                        <p>${message}</p>
                    </div>
                    <button class="retry-button">Retry</button>
                </div>
            `;
            
            // Add to container
            const container = document.getElementById('smartContractsContainer');
            if (container) {
                container.innerHTML = '';
                container.appendChild(errorElement);
                
                // Add retry button functionality
                const retryBtn = errorElement.querySelector('.retry-button');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        initialize();
                    });
                }
            }
        } catch (error) {
            log.error(error, { context: 'showSystemError' });
        }
    }
    
    /**
     * Show notification message
     */
    function showNotification(message, type = 'info') {
        try {
            // Create notification element
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.innerHTML = `
                <div class="notification-content">
                    <span class="notification-icon">${getNotificationIcon(type)}</span>
                    <span class="notification-message">${message}</span>
                </div>
            `;
            
            // Add to document
            document.body.appendChild(notification);
            
            // Show notification
            setTimeout(() => {
                notification.classList.add('show');
            }, 10);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, 5000);
        } catch (error) {
            log.error(error, { context: 'showNotification' });
        }
    }
    
    /**
     * Get icon for notification type
     */
    function getNotificationIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }
    
    /**
     * Get CSS class for risk score
     */
    function getRiskScoreClass(score) {
        if (score >= 70) return 'high-risk';
        if (score >= 30) return 'medium-risk';
        return 'low-risk';
    }
    
    /**
     * Add CSS styles for the smart contracts UI
     */
    function addSmartContractsStyles() {
        try {
            // Check if styles already exist
            if (document.getElementById('smartContractsStyles')) {
                return;
            }
            
            // Create style element
            const styleElement = document.createElement('style');
            styleElement.id = 'smartContractsStyles';
            styleElement.textContent = `
                .smart-contracts-container {
                    margin-top: 30px;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    position: relative;
                }
                
                .smart-contracts-container h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                }
                
                .contracts-description {
                    margin-bottom: 20px;
                    color: #555;
                    line-height: 1.5;
                }
                
                .contracts-tabs {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                
                .tabs-header {
                    display: flex;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .tab-button {
                    padding: 15px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 15px;
                    color: #555;
                    border-bottom: 3px solid transparent;
                }
                
                .tab-button.active {
                    color: #3f51b5;
                    border-bottom-color: #3f51b5;
                    font-weight: 500;
                }
                
                .tab-content {
                    padding: 20px;
                    display: none;
                }
                
                .tab-content.active {
                    display: block;
                }
                
                /* Generate tab */
                .generator-form {
                    flex: 1;
                    padding-right: 20px;
                }
                
                .code-preview {
                    flex: 2;
                    margin-top: 20px;
                }
                
                .form-group {
                    margin-bottom: 15px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #555;
                }
                
                .form-input,
                .form-select,
                .form-textarea {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .form-textarea {
                    min-height: 80px;
                    resize: vertical;
                }
                
                .checkbox-group {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    margin-top: 5px;
                }
                
                .checkbox-item {
                    display: flex;
                    align-items: center;
                }
                
                .checkbox-item label {
                    margin: 0 0 0 5px;
                    font-weight: normal;
                }
                
                .form-options {
                    margin: 20px 0;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                }
                
                .primary-button {
                    background-color: #3f51b5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 15px;
                    font-size: 16px;
                    cursor: pointer;
                }
                
                .primary-button:hover {
                    background-color: #303f9f;
                }
                
                .secondary-button {
                    background-color: #f5f5f5;
                    color: #333;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    padding: 10px 15px;
                    font-size: 16px;
                    cursor: pointer;
                }
                
                .secondary-button:hover {
                    background-color: #e0e0e0;
                }
                
                .icon-button {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 5px;
                }
                
                .preview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .preview-header h4 {
                    margin: 0;
                }
                
                .preview-header .actions {
                    display: flex;
                    gap: 10px;
                }
                
                .code-container {
                    background-color: #2d2d2d;
                    color: #f8f8f2;
                    padding: 15px;
                    border-radius: 5px;
                    overflow-x: auto;
                    font-family: monospace;
                    line-height: 1.4;
                    max-height: 500px;
                    overflow-y: auto;
                }
                
                /* Security analysis tab */
                .security-analysis, .gas-optimization, .deployment-options {
                    max-width: 100%;
                }
                
                .scan-options, .optimization-options, .network-selection {
                    display: flex;
                    align-items: flex-end;
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .scan-result, .optimization-result, .deployment-estimate, .deployment-result {
                    background-color: #f9f9f9;
                    border-radius: 8px;
                    border: 1px solid #e0e0e0;
                    overflow: hidden;
                    margin-bottom: 20px;
                }
                
                .result-header, .estimate-header {
                    background-color: #f5f5f5;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .result-title h5, .estimate-header h5 {
                    margin: 0;
                    color: #333;
                }
                
                .scan-timestamp, .optimization-timestamp, .deployment-timestamp {
                    font-size: 12px;
                    color: #777;
                    display: block;
                    margin-top: 3px;
                }
                
                .risk-score-container, .improvement-container {
                    display: flex;
                    align-items: center;
                }
                
                .risk-score {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    color: white;
                }
                
                .risk-score.low-risk {
                    background-color: #4caf50;
                }
                
                .risk-score.medium-risk {
                    background-color: #ff9800;
                }
                
                .risk-score.high-risk {
                    background-color: #f44336;
                }
                
                .score-value {
                    font-size: 20px;
                    font-weight: bold;
                }
                
                .score-label {
                    font-size: 10px;
                    text-transform: uppercase;
                }
                
                .improvement-badge {
                    padding: 5px 10px;
                    border-radius: 15px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    color: white;
                }
                
                .improvement-badge.significant {
                    background-color: #4caf50;
                }
                
                .improvement-badge.minor {
                    background-color: #2196f3;
                }
                
                .improvement-value {
                    font-weight: bold;
                }
                
                .improvement-label {
                    font-size: 10px;
                    text-transform: uppercase;
                }
                
                .result-details, .estimate-details {
                    padding: 15px;
                }
                
                .scan-info, .optimization-info, .estimate-info, .deployment-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .info-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    border-bottom: 1px dashed #eee;
                }
                
                .info-label {
                    color: #555;
                    font-weight: 500;
                }
                
                .info-value {
                    color: #333;
                }
                
                .error-text {
                    color: #f44336;
                }
                
                .vulnerabilities-list {
                    margin-top: 15px;
                }
                
                .vulnerability-item {
                    background-color: white;
                    border-radius: 5px;
                    border-left: 4px solid;
                    margin-bottom: 10px;
                    overflow: hidden;
                }
                
                .vulnerability-item.severity-high {
                    border-left-color: #f44336;
                }
                
                .vulnerability-item.severity-medium {
                    border-left-color: #ff9800;
                }
                
                .vulnerability-item.severity-low {
                    border-left-color: #4caf50;
                }
                
                .vulnerability-header {
                    padding: 10px 15px;
                    background-color: #f9f9f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .vulnerability-details {
                    padding: 15px;
                }
                
                .vulnerability-details p {
                    margin-top: 0;
                }
                
                .recommendation, .locations {
                    margin-top: 10px;
                }
                
                .severity-badge {
                    padding: 3px 6px;
                    border-radius: 3px;
                    font-size: 12px;
                    color: white;
                    margin-right: 10px;
                }
                
                .severity-badge.high {
                    background-color: #f44336;
                }
                
                .severity-badge.medium {
                    background-color: #ff9800;
                }
                
                .severity-badge.low {
                    background-color: #4caf50;
                }
                
                .vuln-name {
                    font-weight: 500;
                }
                
                .no-vulnerabilities, .empty-state, .optimization-notice {
                    padding: 20px;
                    text-align: center;
                    color: #555;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                }
                
                .optimizations-list {
                    margin-top: 15px;
                }
                
                .optimizations-list h6, .cost-estimates h6 {
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                
                .cost-table {
                    border: 1px solid #e0e0e0;
                    border-radius: 5px;
                    overflow: hidden;
                }
                
                .cost-header {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr;
                    background-color: #f5f5f5;
                    font-weight: 500;
                }
                
                .cost-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr;
                    border-top: 1px solid #e0e0e0;
                }
                
                .cost-cell {
                    padding: 8px 10px;
                    border-right: 1px solid #e0e0e0;
                }
                
                .cost-cell:last-child {
                    border-right: none;
                }
                
                .status-badge {
                    padding: 5px 10px;
                    border-radius: 15px;
                    color: white;
                    font-weight: 500;
                }
                
                .status-badge.success {
                    background-color: #4caf50;
                }
                
                .status-badge.error {
                    background-color: #f44336;
                }
                
                .deployment-result.success {
                    border-left: 4px solid #4caf50;
                }
                
                .deployment-result.error {
                    border-left: 4px solid #f44336;
                }
                
                /* Notifications */
                .notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px 20px;
                    background-color: white;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    border-radius: 5px;
                    transform: translateY(100px);
                    opacity: 0;
                    transition: all 0.3s ease;
                    z-index: 1000;
                    max-width: 300px;
                }
                
                .notification.show {
                    transform: translateY(0);
                    opacity: 1;
                }
                
                .notification.success {
                    border-left: 4px solid #4caf50;
                }
                
                .notification.error {
                    border-left: 4px solid #f44336;
                }
                
                .notification.warning {
                    border-left: 4px solid #ff9800;
                }
                
                .notification.info {
                    border-left: 4px solid #2196f3;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                }
                
                .notification-icon {
                    margin-right: 10px;
                }
                
                .notification-message {
                    flex: 1;
                }
                
                /* System error and warnings */
                .system-error, .web3-warning {
                    margin-bottom: 20px;
                    border-radius: 5px;
                    overflow: hidden;
                }
                
                .system-error .error-content {
                    background-color: #ffebee;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                }
                
                .web3-warning .warning-content {
                    background-color: #fff8e1;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                }
                
                .error-icon, .warning-icon {
                    font-size: 24px;
                    margin-right: 15px;
                }
                
                .error-message, .warning-message {
                    flex: 1;
                }
                
                .error-message h5, .warning-message h5 {
                    margin-top: 0;
                    margin-bottom: 5px;
                }
                
                .retry-button, .dismiss-button {
                    background-color: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    padding: 5px 10px;
                    margin-left: 10px;
                }
                
                .retry-button {
                    background-color: #f44336;
                    color: white;
                    border-radius: 3px;
                }
                
                .environment-badge {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                }
                
                .environment-badge.production {
                    background-color: #d4edda;
                    color: #155724;
                }
                
                .environment-badge.development {
                    background-color: #cce5ff;
                    color: #004085;
                }
                
                /* Responsive styles */
                @media (max-width: 768px) {
                    .scan-options, .optimization-options, .network-selection {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .tabs-header {
                        flex-wrap: wrap;
                    }
                    
                    .tab-button {
                        flex: 1;
                        min-width: 25%;
                    }
                    
                    .code-container {
                        max-height: 300px;
                    }
                    
                    .info-item {
                        flex-direction: column;
                    }
                    
                    .info-value {
                        word-break: break-word;
                    }
                    
                    .cost-header, .cost-row {
                        grid-template-columns: 1fr 1fr;
                    }
                    
                    .cost-cell {
                        border-bottom: 1px solid #e0e0e0;
                    }
                }
            `;
            
            document.head.appendChild(styleElement);
            log.debug("Added smart contracts styles");
        } catch (error) {
            log.error(error, { context: 'addSmartContractsStyles' });
        }
    }
    
    /**
     * Format a date and time in a readable format
     */
    function formatDateTime(date) {
        if (!date) return 'N/A';
        
        try {
            return new Date(date).toLocaleString();
        } catch (error) {
            log.error(error, { context: 'formatDateTime' });
            return String(date); // Return string representation on error
        }
    }
    
    /**
     * Capitalize the first letter of a string
     */
    function capitalizeFirst(str) {
        if (!str) return '';
        try {
            return str.charAt(0).toUpperCase() + str.slice(1);
        } catch (error) {
            log.error(error, { context: 'capitalizeFirst' });
            return str; // Return original on error
        }
    }
    
    /**
     * Generate a random ID
     */
    function generateId(length = 8) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
    
    /**
     * Simulate a delay for demonstration purposes
     */
    function simulateDelay(ms) {
        const actualDelay = isProd ? Math.min(ms, 500) : ms;
        return new Promise(resolve => setTimeout(resolve, actualDelay));
    }
    
    // Public API
    return {
        initialize,
        generateContract,
        scanContractSecurity,
        optimizeContractGas,
        estimateDeploymentCost,
        getContractTemplates: () => ({ ...contractTemplates }),
        getGeneratedContracts: () => [...generatedContracts],
        getSecurityScanResults: () => [...securityScanResults],
        getOptimizationResults: () => [...optimizationResults],
        isEnabled: () => isSmartContractsEnabled && isInitialized
    };
})();

// Initialize the smart contract AI system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-initialization is enabled in config
    if (config?.smartContracts?.autoInitialize !== false) {
        try {
            // Initialize smart contracts AI
            window.smartContractAI.initialize().then(success => {
                if (success) {
                    log.info("Smart Contracts AI initialized successfully");
                } else {
                    log.warn("Smart Contracts AI initialization failed");
                }
            }).catch(error => {
                log.error(error, { context: 'domContentLoaded.initSmartContractsAI' });
            });
        } catch (error) {
            log.error(error, { context: 'domContentLoaded' });
        }
    } else {
        log.info("Automatic initialization of Smart Contracts AI is disabled");
    }
});