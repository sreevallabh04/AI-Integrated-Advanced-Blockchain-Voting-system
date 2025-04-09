/**
 * AI-Enhanced Audit Processes for Blockchain Voting System
 * 
 * This module implements advanced audit capabilities for verifying electoral outcomes
 * and ensuring transparency. It uses AI to streamline the comparison of on-chain votes
 * with physical records, identify discrepancies, and provide comprehensive audit trails.
 */

// Initialize from production configuration if available
const config = window.productionConfig || {};
const log = config?.log || console;
const isProd = config?.isProd || false;

// Feature flags
const isAuditEnabled = config?.featureFlags?.enableAuditProcesses !== false;
const allowMockDataInProd = config?.featureFlags?.allowMockDataInProduction || false;

// Module configuration with defaults
const auditConfig = {
    renderUI: config?.auditProcesses?.renderUI !== false,
    defaultConfidenceLevel: config?.auditProcesses?.defaultConfidenceLevel || 0.95,
    defaultMarginOfError: config?.auditProcesses?.defaultMarginOfError || 0.05,
    dashboardPosition: config?.auditProcesses?.dashboardPosition || 'afterPredictiveAnalytics',
    secureVerification: isProd ? true : (config?.auditProcesses?.secureVerification || false)
};

log.info("Loading AI-Enhanced Audit Processes module", { 
    enabled: isAuditEnabled,
    environment: isProd ? "production" : "development",
    uiEnabled: auditConfig.renderUI
});

// Main namespace for enhanced audit processes
window.auditProcesses = (function() {
    // Private variables
    let isInitialized = false;
    let currentAuditInProgress = false;
    let auditResults = null;
    
    // Store audit history
    const auditHistory = [];
    
    // Store verification records
    const verificationRecords = {
        ballotMatches: [],
        discrepancies: [],
        anomalies: []
    };
    
    // Risk-limiting audit configurations
    const rlaConfigurations = {
        confidence: auditConfig.defaultConfidenceLevel,
        marginOfError: auditConfig.defaultMarginOfError,
        sampleSizeFormula: "log(1/alpha) / (2 * margin^2)" // Simplified formula for sample size calculation
    };
    
    /**
     * Initialize the audit system
     */
    async function initialize() {
        // Skip initialization if the feature is disabled
        if (!isAuditEnabled) {
            log.info("Audit Processes module is disabled via configuration");
            return false;
        }
        
        if (isInitialized) {
            log.debug("Audit system already initialized");
            return true;
        }
        
        log.info("Initializing AI-Enhanced Audit System");
        
        try {
            // Create UI components if enabled
            if (auditConfig.renderUI) {
                createAuditUIElements();
            }
            
            // Initialize verification records (sample data in dev, empty in prod)
            if (!isProd || allowMockDataInProd) {
                initializeVerificationRecords();
            } else {
                // In production, start with empty records unless using a real data source
                if (config?.dataServices?.getVerificationRecords) {
                    try {
                        const records = await config.dataServices.getVerificationRecords();
                        if (records && validateVerificationRecords(records)) {
                            Object.assign(verificationRecords, records);
                            log.info("Loaded verification records from data service");
                        }
                    } catch (dataError) {
                        log.warn("Failed to load verification records from data service", { error: dataError.message });
                    }
                }
            }
            
            // Update verification statistics in UI if enabled
            if (auditConfig.renderUI) {
                updateVerificationStats();
            }
            
            isInitialized = true;
            log.info("Audit System initialized successfully");
            
            // Dispatch event for other components
            try {
                document.dispatchEvent(new CustomEvent('auditSystemReady'));
            } catch (eventError) {
                log.error(eventError, { context: 'dispatchReadyEvent' });
            }
            
            return true;
        } catch (error) {
            log.error(error, { context: 'auditSystemInitialization' });
            
            // Show error in UI if enabled
            if (auditConfig.renderUI) {
                showSystemError("Failed to initialize the audit system");
            }
            
            return false;
        }
    }
    
    /**
     * Validate verification records structure
     */
    function validateVerificationRecords(records) {
        // Basic validation
        if (!records || typeof records !== 'object') return false;
        
        // Check that required sections exist
        const requiredSections = ['ballotMatches', 'discrepancies', 'anomalies'];
        for (const section of requiredSections) {
            if (!records[section] || !Array.isArray(records[section])) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Initialize verification records with sample data
     */
    function initializeVerificationRecords() {
        // In a real implementation, this would be empty until audits are performed
        // For demo purposes, we'll populate with some sample data
        log.debug("Initializing sample verification records for development");
        
        // Skip sample data generation in production unless specifically allowed
        if (isProd && !allowMockDataInProd) {
            log.debug("Skipping sample data generation in production environment");
            return;
        }
        
        // Generate a few sample ballot matches
        for (let i = 0; i < 5; i++) {
            verificationRecords.ballotMatches.push({
                ballotId: "B" + generateRandomId(6),
                blockchainRecordId: "T" + generateRandomId(8),
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in the last week
                verificationMethod: "hash comparison",
                confidence: 0.95 + (Math.random() * 0.05),
                verifiedBy: "Automated system"
            });
        }
        
        // Generate a sample discrepancy
        verificationRecords.discrepancies.push({
            ballotId: "B" + generateRandomId(6),
            blockchainRecordId: "T" + generateRandomId(8),
            timestamp: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000), // Random time in the last 3 days
            discrepancyType: "signature mismatch",
            severity: "low",
            description: "Ballot signature hash does not match blockchain record signature",
            resolutionStatus: "under review",
            assignedTo: "Audit administrator"
        });
        
        // Generate a sample anomaly
        verificationRecords.anomalies.push({
            detectionTime: new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000), // Random time in the last 5 days
            anomalyType: "timing irregularity",
            description: "Unusually high number of votes recorded within a 5-minute window",
            affectedRecords: 12,
            confidenceScore: 0.87,
            investigationStatus: "completed",
            resolution: "Determined to be caused by system processing delayed votes in batch"
        });
    }
    
    /**
     * Generate a random ID of specified length
     */
    function generateRandomId(length) {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    }
    
    /**
     * Start a new audit process
     */
    async function startAudit(auditConfig) {
        // Verify that audit processes are enabled
        if (!isAuditEnabled) {
            const error = new Error("Audit system is disabled by configuration");
            log.warn(error.message);
            return Promise.reject(error);
        }
        
        // Ensure the system is initialized
        if (!isInitialized) {
            log.warn("Audit system not initialized. Attempting to initialize...");
            try {
                const initResult = await initialize();
                if (!initResult) {
                    const error = new Error("Failed to initialize audit system");
                    log.error(error.message);
                    return Promise.reject(error);
                }
            } catch (initError) {
                log.error(initError, { context: 'initializeBeforeAudit' });
                return Promise.reject(initError);
            }
        }
        
        if (currentAuditInProgress) {
            const error = new Error("Another audit is already in progress");
            log.warn(error.message);
            return Promise.reject(error);
        }
        
        // Set audit in progress
        currentAuditInProgress = true;
        
        log.info("Starting new audit process", { config: auditConfig });
        
        // Update UI if enabled
        if (auditConfig.renderUI) {
            updateAuditStatusUI("in-progress", "Starting audit process...");
        }
        
        try {
            // Initialize audit results
            auditResults = {
                auditId: "A" + Date.now().toString(36),
                startTime: new Date(),
                endTime: null,
                configuration: auditConfig,
                status: "in-progress",
                progress: 0,
                ballotsSampled: 0,
                ballotsVerified: 0,
                discrepanciesFound: 0,
                anomaliesDetected: 0,
                confidenceLevel: 0,
                comparisonResults: {
                    matches: [],
                    discrepancies: [],
                    anomalies: []
                },
                recommendations: []
            };
            
            // In production, use secure sampling and verification
            const useSecureProcesses = isProd && auditConfig.secureVerification;
            
            try {
                // Calculate sample size based on configuration
                const sampleSize = calculateSampleSize(auditConfig);
                log.info("Determined sample size for audit", { size: sampleSize });
                
                // Perform ballot sampling
                const sampledBallots = useSecureProcesses && config?.auditServices?.performBallotSampling ?
                    await config.auditServices.performBallotSampling(sampleSize, auditConfig.samplingMethod) :
                    await performBallotSampling(sampleSize, auditConfig.samplingMethod);
                
                // Set total expected samples
                auditResults.expectedSamples = sampledBallots.length;
                
                // Update status and UI
                if (auditConfig.renderUI) {
                    updateAuditStatusUI("in-progress", `Sampled ${sampledBallots.length} ballots for verification`, 10);
                }
                
                // Perform ballot verification
                await performBallotVerification(sampledBallots, useSecureProcesses);
                
                // Analyze results
                await analyzeAuditResults();
                
                // Generate recommendations
                auditResults.recommendations = generateAuditRecommendations();
                
                // Mark audit as complete
                auditResults.status = "completed";
                auditResults.endTime = new Date();
                
                // Calculate final confidence level
                auditResults.confidenceLevel = calculateConfidenceLevel();
                
                // Store in audit history
                auditHistory.push({ ...auditResults });
                
                // In production, securely store audit results
                if (isProd && config?.secureStorage?.storeAuditResults) {
                    try {
                        await config.secureStorage.storeAuditResults(auditResults);
                        log.info("Stored audit results securely", { auditId: auditResults.auditId });
                    } catch (storageError) {
                        log.error(storageError, { context: 'secureAuditStorage' });
                    }
                }
                
                // Update UI if enabled
                if (auditConfig.renderUI) {
                    updateAuditStatusUI("completed", "Audit completed successfully", 100);
                    displayAuditResults(auditResults);
                }
                
                // Dispatch completion event
                try {
                    document.dispatchEvent(new CustomEvent('auditCompleted', { 
                        detail: { 
                            auditId: auditResults.auditId,
                            status: 'completed',
                            outcome: auditResults.outcome
                        } 
                    }));
                } catch (eventError) {
                    log.error(eventError, { context: 'dispatchAuditCompleteEvent' });
                }
                
                log.info("Audit completed successfully", { 
                    auditId: auditResults.auditId,
                    outcome: auditResults.outcome,
                    ballotsVerified: auditResults.ballotsVerified,
                    discrepancies: auditResults.discrepanciesFound
                });
                
                // Audit is no longer in progress
                currentAuditInProgress = false;
                
                return {
                    success: true,
                    auditId: auditResults.auditId,
                    outcome: auditResults.outcome,
                    results: auditResults
                };
            } catch (processError) {
                throw processError;
            }
        } catch (error) {
            log.error(error, { context: 'auditProcess' });
            
            // Update audit status
            if (auditResults) {
                auditResults.status = "failed";
                auditResults.endTime = new Date();
                auditResults.error = error.message;
                
                // Store in audit history
                auditHistory.push({ ...auditResults });
            }
            
            // Update UI if enabled
            if (auditConfig.renderUI) {
                updateAuditStatusUI("failed", `Audit failed: ${error.message}`);
            }
            
            // Dispatch failure event
            try {
                document.dispatchEvent(new CustomEvent('auditCompleted', { 
                    detail: { 
                        auditId: auditResults?.auditId || 'unknown',
                        status: 'failed',
                        error: error.message
                    } 
                }));
            } catch (eventError) {
                log.error(eventError, { context: 'dispatchAuditFailedEvent' });
            }
            
            // Audit is no longer in progress
            currentAuditInProgress = false;
            
            return {
                success: false,
                error: error.message,
                auditId: auditResults?.auditId || null
            };
        }
    }
    
    /**
     * Calculate appropriate sample size based on configuration
     */
    function calculateSampleSize(config) {
        try {
            const { confidence, marginOfError, population } = config;
            
            // Default to appropriate statistical sample for 95% confidence, 5% margin of error
            let sampleSize = 384; // Standard sample size for infinite population (95% confidence, 5% margin)
            
            // If population is provided, adjust sample size using formula
            if (population) {
                // Finite population correction
                // Formula: (z^2 * p * (1-p)) / e^2 / (1 + (z^2 * p * (1-p)) / (e^2 * N))
                // where z is z-score (1.96 for 95% confidence), p is 0.5 (worst case), e is margin of error, N is population
                
                // For simplicity, we'll use approximations based on confidence level
                let zScore = 1.96; // Default Z-score for 95% confidence
                if (confidence >= 0.99) zScore = 2.58; // 99% confidence
                else if (confidence >= 0.98) zScore = 2.33; // 98% confidence
                else if (confidence >= 0.95) zScore = 1.96; // 95% confidence
                else if (confidence >= 0.90) zScore = 1.64; // 90% confidence
                
                const e = marginOfError || 0.05; // Default to 5% margin of error
                const p = 0.5; // Use 0.5 for maximum variance (worst case)
                
                // Calculate sample size with finite population correction
                const numerator = Math.pow(zScore, 2) * p * (1 - p);
                const denominator = Math.pow(e, 2);
                const correction = 1 + (numerator / (denominator * population));
                
                sampleSize = Math.ceil(numerator / denominator / correction);
            }
            
            // Apply minimum sample size based on audit type
            if (config.auditType === 'risk-limiting') {
                // Risk-limiting audits usually require smaller samples
                // but depend on the margin of victory
                const marginOfVictory = config.marginOfVictory || 0.05; // Default to 5% margin
                
                // Simplified formula for RLA sample size
                // In real RLAs, this would use more complex calculations based on risk limit and margin
                const riskLimit = 1 - (confidence || 0.95);
                sampleSize = Math.ceil(Math.log(riskLimit) / (2 * Math.pow(marginOfVictory, 2)));
                
                // Ensure reasonable minimum
                sampleSize = Math.max(sampleSize, 50);
            } else if (config.auditType === 'full') {
                // Full audits check all ballots
                sampleSize = population;
            }
            
            return sampleSize;
        } catch (error) {
            log.error(error, { context: 'calculateSampleSize' });
            return 384; // Return default sample size on error
        }
    }
    
    /**
     * Perform ballot sampling based on specified method
     */
    async function performBallotSampling(sampleSize, samplingMethod) {
        log.info("Performing ballot sampling", { method: samplingMethod, size: sampleSize });
        
        try {
            // In production, delegate to secure data services if available
            if (isProd && config?.dataServices?.getBallotSamples) {
                try {
                    const samples = await config.dataServices.getBallotSamples(sampleSize, samplingMethod);
                    if (Array.isArray(samples) && samples.length > 0) {
                        log.info("Retrieved ballot samples from secure data service", { count: samples.length });
                        return samples;
                    } else {
                        log.warn("Ballot sampling using data service returned no results, falling back to mock data");
                    }
                } catch (dataError) {
                    log.error(dataError, { context: 'secureBallotSampling' });
                    if (!allowMockDataInProd) {
                        throw new Error(`Failed to sample ballots from secure data service: ${dataError.message}`);
                    }
                    log.warn("Falling back to mock ballot sampling");
                }
            }
            
            // Check if mock data is allowed in production
            if (isProd && !allowMockDataInProd) {
                throw new Error("Mock ballot data not allowed in production environment");
            }
            
            // Simulate getting ballots from the database or blockchain
            // In a real implementation, this would query actual data
            
            // For demonstration, generate mock ballots
            const mockBallots = [];
            
            // Number of ballots to generate
            // For demo, create between sampleSize and sampleSize*1.2
            const totalBallots = sampleSize + Math.floor(Math.random() * (sampleSize * 0.2));
            
            // Generate the ballots
            for (let i = 0; i < totalBallots; i++) {
                const ballot = {
                    ballotId: "B" + generateRandomId(6),
                    blockchainTransactionId: "0x" + generateRandomHex(64),
                    blockHeight: 1000000 + Math.floor(Math.random() * 1000),
                    timestamp: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000), // Random time in last 2 weeks
                    voterAddress: "0x" + generateRandomHex(40),
                    candidateIndex: Math.floor(Math.random() * 3), // Random candidate (0, 1, or 2)
                    precinct: "P" + (Math.floor(Math.random() * 20) + 1), // Random precinct P1-P20
                    canBeAudited: Math.random() > 0.05 // 95% can be audited
                };
                
                mockBallots.push(ballot);
            }
            
            // Simulate delay for the sampling process
            await simulateDelay(isProd ? 500 : 1500);
            
            // Select sample based on sampling method
            let sampledBallots = [];
            
            if (samplingMethod === 'random') {
                // Simple random sampling
                shuffleArray(mockBallots);
                sampledBallots = mockBallots.slice(0, sampleSize);
            } 
            else if (samplingMethod === 'stratified') {
                // Stratified sampling by precinct
                const precincts = {};
                
                // Group ballots by precinct
                mockBallots.forEach(ballot => {
                    if (!precincts[ballot.precinct]) {
                        precincts[ballot.precinct] = [];
                    }
                    precincts[ballot.precinct].push(ballot);
                });
                
                // Determine how many to sample from each precinct
                const precinctCount = Object.keys(precincts).length;
                const ballotsPerPrecinct = Math.ceil(sampleSize / precinctCount);
                
                // Take samples from each precinct
                Object.values(precincts).forEach(precinctBallots => {
                    shuffleArray(precinctBallots);
                    sampledBallots = sampledBallots.concat(
                        precinctBallots.slice(0, Math.min(ballotsPerPrecinct, precinctBallots.length))
                    );
                });
                
                // If we have too many, trim the excess
                if (sampledBallots.length > sampleSize) {
                    shuffleArray(sampledBallots);
                    sampledBallots = sampledBallots.slice(0, sampleSize);
                }
            } 
            else if (samplingMethod === 'systematic') {
                // Systematic sampling
                const interval = Math.floor(mockBallots.length / sampleSize);
                
                // Sort ballots by some criteria (blockHeight in this case)
                mockBallots.sort((a, b) => a.blockHeight - b.blockHeight);
                
                // Select every nth ballot
                for (let i = 0; i < mockBallots.length && sampledBallots.length < sampleSize; i += interval) {
                    sampledBallots.push(mockBallots[i]);
                }
            }
            else {
                // Default to random sampling
                shuffleArray(mockBallots);
                sampledBallots = mockBallots.slice(0, sampleSize);
            }
            
            log.info("Sampled ballots", { method: samplingMethod, count: sampledBallots.length });
            
            // Update audit results with sample count
            auditResults.ballotsSampled = sampledBallots.length;
            
            return sampledBallots;
        } catch (error) {
            log.error(error, { context: 'performBallotSampling' });
            throw new Error(`Ballot sampling failed: ${error.message}`);
        }
    }
    
    /**
     * Perform verification of the sampled ballots
     */
    async function performBallotVerification(sampledBallots, useSecureProcesses = false) {
        log.info("Verifying sampled ballots", { count: sampledBallots.length });
        
        try {
            // In production with secure verification service
            if (useSecureProcesses && config?.auditServices?.verifyBallots) {
                try {
                    const verificationResults = await config.auditServices.verifyBallots(sampledBallots);
                    
                    if (verificationResults && typeof verificationResults === 'object') {
                        // Process the results from the secure service
                        auditResults.ballotsVerified = verificationResults.verifiedCount || 0;
                        auditResults.discrepanciesFound = verificationResults.discrepancyCount || 0;
                        auditResults.anomaliesDetected = verificationResults.anomalyCount || 0;
                        
                        if (Array.isArray(verificationResults.matches)) {
                            auditResults.comparisonResults.matches = verificationResults.matches;
                        }
                        
                        if (Array.isArray(verificationResults.discrepancies)) {
                            auditResults.comparisonResults.discrepancies = verificationResults.discrepancies;
                        }
                        
                        if (Array.isArray(verificationResults.anomalies)) {
                            auditResults.comparisonResults.anomalies = verificationResults.anomalies;
                        }
                        
                        log.info("Verification completed using secure service", {
                            verified: auditResults.ballotsVerified,
                            discrepancies: auditResults.discrepanciesFound,
                            anomalies: auditResults.anomaliesDetected
                        });
                        
                        return;
                    } else {
                        log.warn("Secure verification service returned invalid results, falling back to local verification");
                    }
                } catch (serviceError) {
                    log.error(serviceError, { context: 'secureVerificationService' });
                    
                    if (isProd && !allowMockDataInProd) {
                        throw new Error(`Secure ballot verification failed: ${serviceError.message}`);
                    }
                    
                    log.warn("Falling back to local verification process");
                }
            }
            
            // Check if mock verification is allowed in production
            if (isProd && !allowMockDataInProd) {
                throw new Error("Mock ballot verification not allowed in production environment");
            }
            
            // Initialize verification counts
            let verifiedCount = 0;
            let discrepancyCount = 0;
            let anomalyCount = 0;
            
            // Process each ballot
            for (let i = 0; i < sampledBallots.length; i++) {
                const ballot = sampledBallots[i];
                
                // Update progress
                const progress = Math.floor((i / sampledBallots.length) * 80) + 10; // 10-90% range
                
                if (auditConfig.renderUI) {
                    updateAuditStatusUI("in-progress", `Verifying ballot ${i+1} of ${sampledBallots.length}`, progress);
                }
                
                // Simulate delay for each verification - shorter in production
                await simulateDelay(isProd ? 10 : 100);
                
                // Verify ballot against blockchain record
                const verificationResult = await verifyBallotAgainstBlockchain(ballot);
                
                // Update counts based on verification result
                if (verificationResult.verified) {
                    verifiedCount++;
                    auditResults.comparisonResults.matches.push(verificationResult);
                    
                    // In a real system, we might update verification records here
                    if (!isProd) {
                        verificationRecords.ballotMatches.push({
                            ballotId: ballot.ballotId,
                            blockchainRecordId: ballot.blockchainTransactionId,
                            timestamp: new Date(),
                            verificationMethod: verificationResult.verificationMethod,
                            confidence: verificationResult.confidenceScore,
                            verifiedBy: "Audit system"
                        });
                    }
                } 
                else if (verificationResult.discrepancyType) {
                    discrepancyCount++;
                    auditResults.comparisonResults.discrepancies.push(verificationResult);
                    
                    // In a real system, we might update verification records here
                    if (!isProd) {
                        verificationRecords.discrepancies.push({
                            ballotId: ballot.ballotId,
                            blockchainRecordId: ballot.blockchainTransactionId,
                            timestamp: new Date(),
                            discrepancyType: verificationResult.discrepancyType,
                            severity: verificationResult.severity,
                            description: verificationResult.description,
                            resolutionStatus: "pending"
                        });
                    }
                }
                
                // Check for anomalies
                const anomalyCheck = detectBallotAnomalies(ballot, verificationResult);
                if (anomalyCheck.anomalyDetected) {
                    anomalyCount++;
                    auditResults.comparisonResults.anomalies.push(anomalyCheck);
                    
                    // In a real system, we might update verification records here
                    if (!isProd) {
                        verificationRecords.anomalies.push({
                            detectionTime: new Date(),
                            anomalyType: anomalyCheck.anomalyType,
                            description: anomalyCheck.description,
                            affectedRecords: 1,
                            confidenceScore: anomalyCheck.confidenceScore,
                            investigationStatus: "pending"
                        });
                    }
                }
            }
            
            // Update audit results with verification counts
            auditResults.ballotsVerified = verifiedCount;
            auditResults.discrepanciesFound = discrepancyCount;
            auditResults.anomaliesDetected = anomalyCount;
            
            // Update verification stats in UI if enabled
            if (auditConfig.renderUI && !isProd) {
                updateVerificationStats();
            }
            
            log.info("Verification complete", { 
                verified: verifiedCount, 
                discrepancies: discrepancyCount, 
                anomalies: anomalyCount 
            });
        } catch (error) {
            log.error(error, { context: 'performBallotVerification' });
            throw new Error(`Ballot verification failed: ${error.message}`);
        }
    }
    
    /**
     * Verify a ballot against its blockchain record
     */
    async function verifyBallotAgainstBlockchain(ballot) {
        // In a real implementation, this would query the blockchain
        // and compare the ballot data with the on-chain record
        
        try {
            // In production with real blockchain verification service
            if (isProd && config?.blockchainService?.verifyBallot) {
                try {
                    const result = await config.blockchainService.verifyBallot(ballot);
                    if (result && typeof result === 'object') {
                        return result;
                    }
                    // If service returns invalid result, fall through to mock implementation
                    log.warn("Blockchain verification service returned invalid result", { ballot: ballot.ballotId });
                } catch (serviceError) {
                    log.error(serviceError, { context: 'blockchainVerification', ballot: ballot.ballotId });
                    if (!allowMockDataInProd) {
                        throw new Error(`Blockchain verification service error: ${serviceError.message}`);
                    }
                }
            }
            
            // For demonstration, simulate verification with random results
            const verificationResult = {
                ballotId: ballot.ballotId,
                blockchainTransactionId: ballot.blockchainTransactionId,
                timestamp: new Date(),
                verificationMethod: "AI-enhanced hash comparison",
                verified: Math.random() > 0.08, // 92% match rate for demo
            };
            
            // If not verified, generate discrepancy information
            if (!verificationResult.verified) {
                // Types of discrepancies for demo
                const discrepancyTypes = [
                    "data hash mismatch",
                    "signature verification failed",
                    "ballot not found on chain",
                    "candidate mismatch",
                    "timestamp irregularity"
                ];
                
                // Severities for demo
                const severities = ["low", "medium", "high"];
                
                // Generate random discrepancy
                verificationResult.discrepancyType = discrepancyTypes[Math.floor(Math.random() * discrepancyTypes.length)];
                verificationResult.severity = severities[Math.floor(Math.random() * severities.length)];
                verificationResult.description = `Ballot ${verificationResult.discrepancyType} detected during verification`;
                verificationResult.confidenceScore = 0.7 + (Math.random() * 0.3); // 0.7-1.0 confidence
            } else {
                verificationResult.confidenceScore = 0.95 + (Math.random() * 0.05); // 0.95-1.0 confidence for matches
            }
            
            // In production, add a shorter simulation delay
            if (isProd) {
                await simulateDelay(10);
            }
            
            return verificationResult;
        } catch (error) {
            log.error(error, { context: 'verifyBallotAgainstBlockchain', ballot: ballot.ballotId });
            throw new Error(`Ballot verification error: ${error.message}`);
        }
    }
    
    /**
     * Detect anomalies in a ballot or verification result
     */
    function detectBallotAnomalies(ballot, verificationResult) {
        // Initialize anomaly check result
        const anomalyCheck = {
            ballotId: ballot.ballotId,
            timestamp: new Date(),
            anomalyDetected: false
        };
        
        try {
            // In production with anomaly detection service
            if (isProd && config?.aiServices?.detectAnomalies) {
                try {
                    const result = config.aiServices.detectAnomalies(ballot, verificationResult);
                    if (result && typeof result === 'object') {
                        return result;
                    }
                    // If service returns invalid result, fall through to mock implementation
                    log.warn("Anomaly detection service returned invalid result", { ballot: ballot.ballotId });
                } catch (serviceError) {
                    log.error(serviceError, { context: 'anomalyDetection', ballot: ballot.ballotId });
                    // Continue with mock implementation if allowed
                    if (!allowMockDataInProd) {
                        return anomalyCheck; // Return no anomalies if mock not allowed
                    }
                }
            }
            
            // In a real implementation, this would use machine learning to detect unusual patterns
            // For demonstration, generate random anomalies with low probability
            if (Math.random() < 0.03) { // 3% chance of anomaly
                // Types of anomalies for demo
                const anomalyTypes = [
                    "unusual voting time pattern",
                    "statistically improbable voting sequence",
                    "geographic impossibility",
                    "multiple votes from single source",
                    "suspicious timing correlation"
                ];
                
                // Generate anomaly details
                anomalyCheck.anomalyDetected = true;
                anomalyCheck.anomalyType = anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)];
                anomalyCheck.description = `Potential ${anomalyCheck.anomalyType} detected for ballot ${ballot.ballotId}`;
                anomalyCheck.confidenceScore = 0.6 + (Math.random() * 0.3); // 0.6-0.9 confidence
                anomalyCheck.recommendedAction = "Flag for human review";
            }
            
            return anomalyCheck;
        } catch (error) {
            log.error(error, { context: 'detectBallotAnomalies', ballot: ballot.ballotId });
            return anomalyCheck; // Return no anomalies on error
        }
    }
    
    /**
     * Analyze the audit results to draw conclusions
     */
    async function analyzeAuditResults() {
        log.info("Analyzing audit results");
        
        // Update status if UI is enabled
        if (auditConfig.renderUI) {
            updateAuditStatusUI("in-progress", "Analyzing audit results...", 90);
        }
        
        try {
            // In production with AI analysis service
            if (isProd && config?.aiServices?.analyzeAuditResults) {
                try {
                    const analysisResults = await config.aiServices.analyzeAuditResults(auditResults);
                    if (analysisResults && typeof analysisResults === 'object') {
                        // Apply analysis results to our audit results
                        Object.assign(auditResults, analysisResults);
                        log.info("Analysis completed using AI service", { outcome: auditResults.outcome });
                        return;
                    }
                    // If service returns invalid result, fall through to standard implementation
                    log.warn("AI analysis service returned invalid result");
                } catch (serviceError) {
                    log.error(serviceError, { context: 'aiAnalysisService' });
                    if (!allowMockDataInProd) {
                        throw new Error(`AI analysis service error: ${serviceError.message}`);
                    }
                    log.warn("Falling back to standard analysis");
                }
            }
            
            // Simulate analysis delay - shorter in production
            await simulateDelay(isProd ? 500 : 2000);
            
            // Calculate match rate
            const matchRate = auditResults.ballotsVerified / auditResults.ballotsSampled;
            
            // Calculate discrepancy rate
            const discrepancyRate = auditResults.discrepanciesFound / auditResults.ballotsSampled;
            
            // Calculate anomaly rate
            const anomalyRate = auditResults.anomaliesDetected / auditResults.ballotsSampled;
            
            // Determine audit outcome
            if (matchRate >= 0.98) {
                auditResults.outcome = "passed";
                auditResults.outcomeDescription = "Audit passed with high confidence. No significant issues detected.";
            } else if (matchRate >= 0.95) {
                auditResults.outcome = "passed_with_concerns";
                auditResults.outcomeDescription = "Audit passed, but with minor concerns that should be addressed.";
            } else if (matchRate >= 0.90) {
                auditResults.outcome = "indeterminate";
                auditResults.outcomeDescription = "Audit results are inconclusive. A larger sample or further investigation is recommended.";
            } else {
                auditResults.outcome = "failed";
                auditResults.outcomeDescription = "Audit failed. Significant discrepancies detected that require immediate attention.";
            }
            
            // Calculate statistical significance
            auditResults.statisticalSignificance = calculateStatisticalSignificance(
                auditResults.ballotsSampled,
                auditResults.configuration.population || 1000,
                auditResults.configuration.confidence || 0.95
            );
            
            // Check for patterns in discrepancies
            auditResults.discrepancyPatterns = identifyDiscrepancyPatterns(auditResults.comparisonResults.discrepancies);
            
            // Check for patterns in anomalies
            auditResults.anomalyPatterns = identifyAnomalyPatterns(auditResults.comparisonResults.anomalies);
            
            log.info("Analysis complete", { outcome: auditResults.outcome });
        } catch (error) {
            log.error(error, { context: 'analyzeAuditResults' });
            throw new Error(`Audit analysis failed: ${error.message}`);
        }
    }
    
    /**
     * Calculate statistical significance of the audit
     */
    function calculateStatisticalSignificance(sampleSize, population, confidence) {
        try {
            // In a real implementation, this would use proper statistical methods
            // For this demo, we'll use a simplified calculation
            
            const marginOfError = Math.sqrt((0.25 / sampleSize) * (1 - (sampleSize / population)));
            const zScore = 1.96; // Corresponds to 95% confidence
            
            return {
                marginOfError: marginOfError * 100, // Convert to percentage
                confidenceInterval: [
                    Math.max(0, 0.5 - (marginOfError * zScore)),
                    Math.min(1, 0.5 + (marginOfError * zScore))
                ],
                sampleRepresentativeness: Math.min(1, sampleSize / Math.sqrt(population))
            };
        } catch (error) {
            log.error(error, { context: 'calculateStatisticalSignificance' });
            // Return fallback values on error
            return {
                marginOfError: 5,
                confidenceInterval: [0.45, 0.55],
                sampleRepresentativeness: 0.5
            };
        }
    }
    
    /**
     * Identify patterns in discrepancies
     */
    function identifyDiscrepancyPatterns(discrepancies) {
        if (!discrepancies || discrepancies.length === 0) {
            return { patternsDetected: false };
        }
        
        try {
            // Count discrepancies by type
            const typeCount = {};
            discrepancies.forEach(d => {
                if (d.discrepancyType) {
                    typeCount[d.discrepancyType] = (typeCount[d.discrepancyType] || 0) + 1;
                }
            });
            
            // Identify most common type
            let mostCommonType = null;
            let maxCount = 0;
            
            Object.entries(typeCount).forEach(([type, count]) => {
                if (count > maxCount) {
                    mostCommonType = type;
                    maxCount = count;
                }
            });
            
            // Determine if there's a significant pattern
            const hasPattern = maxCount >= 3 || (maxCount / discrepancies.length) > 0.5;
            
            return {
                patternsDetected: hasPattern,
                primaryPattern: hasPattern ? mostCommonType : null,
                typeDistribution: typeCount,
                severityDistribution: countBySeverity(discrepancies),
                significanceLevel: hasPattern ? 
                    ((maxCount / discrepancies.length) * (discrepancies.length / auditResults.ballotsSampled)) : 0
            };
        } catch (error) {
            log.error(error, { context: 'identifyDiscrepancyPatterns' });
            return { patternsDetected: false };
        }
    }
    
    /**
     * Count discrepancies by severity
     */
    function countBySeverity(discrepancies) {
        try {
            const severityCount = { 
                high: 0, 
                medium: 0, 
                low: 0 
            };
            
            discrepancies.forEach(d => {
                if (d.severity) {
                    severityCount[d.severity] = (severityCount[d.severity] || 0) + 1;
                }
            });
            
            return severityCount;
        } catch (error) {
            log.error(error, { context: 'countBySeverity' });
            return { high: 0, medium: 0, low: 0 };
        }
    }
    
    /**
     * Identify patterns in anomalies
     */
    function identifyAnomalyPatterns(anomalies) {
        if (!anomalies || anomalies.length === 0) {
            return { patternsDetected: false };
        }
        
        try {
            // Count anomalies by type
            const typeCount = {};
            anomalies.forEach(a => {
                if (a.anomalyType) {
                    typeCount[a.anomalyType] = (typeCount[a.anomalyType] || 0) + 1;
                }
            });
            
            // Identify most common type
            let mostCommonType = null;
            let maxCount = 0;
            
            Object.entries(typeCount).forEach(([type, count]) => {
                if (count > maxCount) {
                    mostCommonType = type;
                    maxCount = count;
                }
            });
            
            // Determine if there's a significant pattern
            const hasPattern = maxCount >= 2 || (anomalies.length / auditResults.ballotsSampled) > 0.01;
            
            return {
                patternsDetected: hasPattern,
                primaryPattern: hasPattern ? mostCommonType : null,
                typeDistribution: typeCount,
                significanceLevel: hasPattern ? 
                    ((maxCount / anomalies.length) * (anomalies.length / auditResults.ballotsSampled)) : 0,
                recommendedAction: hasPattern ? "Investigate " + mostCommonType + " anomalies" : "No action required"
            };
        } catch (error) {
            log.error(error, { context: 'identifyAnomalyPatterns' });
            return { patternsDetected: false };
        }
    }
    
    /**
     * Generate recommendations based on audit results
     */
    function generateAuditRecommendations() {
        const recommendations = [];
        
        try {
            // In production with AI recommendation service
            if (isProd && config?.aiServices?.generateAuditRecommendations) {
                try {
                    const aiRecommendations = config.aiServices.generateAuditRecommendations(auditResults);
                    if (aiRecommendations && Array.isArray(aiRecommendations) && aiRecommendations.length > 0) {
                        log.info("Generated recommendations using AI service", { count: aiRecommendations.length });
                        return aiRecommendations;
                    }
                    // If service returns invalid result, fall through to standard implementation
                    log.warn("AI recommendation service returned invalid results");
                } catch (serviceError) {
                    log.error(serviceError, { context: 'aiRecommendationService' });
                    // Continue with standard implementation
                }
            }
            
            // Basic recommendation based on outcome
            if (auditResults.outcome === "passed") {
                recommendations.push({
                    priority: "low",
                    category: "general",
                    recommendation: "Continue standard auditing practices for future elections",
                    rationale: "Audit passed with high confidence"
                });
            } 
            else if (auditResults.outcome === "passed_with_concerns") {
                recommendations.push({
                    priority: "medium",
                    category: "general",
                    recommendation: "Conduct a follow-up review of specific areas of concern",
                    rationale: "Audit passed but identified minor issues"
                });
                
                // Add recommendation for most common discrepancy type if applicable
                if (auditResults.discrepancyPatterns && auditResults.discrepancyPatterns.patternsDetected) {
                    recommendations.push({
                        priority: "medium",
                        category: "discrepancy",
                        recommendation: `Investigate ${auditResults.discrepancyPatterns.primaryPattern} discrepancies`,
                        rationale: `Pattern of ${auditResults.discrepancyPatterns.primaryPattern} discrepancies detected`
                    });
                }
            } 
            else if (auditResults.outcome === "indeterminate") {
                recommendations.push({
                    priority: "high",
                    category: "general",
                    recommendation: "Increase sample size and conduct additional audit",
                    rationale: "Current audit results are inconclusive"
                });
                
                // Add recommendation for statistical confidence
                recommendations.push({
                    priority: "high",
                    category: "methodology",
                    recommendation: "Use stratified sampling in follow-up audit",
                    rationale: "May provide better coverage of potential problem areas"
                });
            } 
            else if (auditResults.outcome === "failed") {
                recommendations.push({
                    priority: "critical",
                    category: "general",
                    recommendation: "Conduct a full manual count and reconciliation",
                    rationale: "Significant discrepancies detected"
                });
                
                // Add recommendation for investigation
                recommendations.push({
                    priority: "critical",
                    category: "investigation",
                    recommendation: "Form investigation committee to examine cause of discrepancies",
                    rationale: "High discrepancy rate requires formal investigation"
                });
            }
            
            // Recommendations for anomalies if detected
            if (auditResults.anomalyPatterns && auditResults.anomalyPatterns.patternsDetected) {
                recommendations.push({
                    priority: "high",
                    category: "anomaly",
                    recommendation: auditResults.anomalyPatterns.recommendedAction,
                    rationale: `Pattern of ${auditResults.anomalyPatterns.primaryPattern} anomalies detected`
                });
            }
            
            // Recommendation for process improvement if discrepancies found
            if (auditResults.discrepanciesFound > 0) {
                recommendations.push({
                    priority: auditResults.discrepanciesFound > 5 ? "high" : "medium",
                    category: "process",
                    recommendation: "Review and enhance ballot handling procedures",
                    rationale: `${auditResults.discrepanciesFound} discrepancies suggest potential process improvements`
                });
            }
            
            // Technical recommendations
            const techRecommendation = generateTechnicalRecommendation();
            if (techRecommendation) {
                recommendations.push(techRecommendation);
            }
            
            log.debug("Generated recommendations", { count: recommendations.length });
            return recommendations;
        } catch (error) {
            log.error(error, { context: 'generateAuditRecommendations' });
            // Return minimal recommendations on error
            return [
                {
                    priority: "medium",
                    category: "general",
                    recommendation: "Review audit process and results",
                    rationale: "Standard recommendation when detailed analysis unavailable"
                }
            ];
        }
    }
    
    /**
     * Generate technical recommendation based on audit results
     */
    function generateTechnicalRecommendation() {
        try {
            // In a real implementation, this would analyze specific technical issues
            // For this demo, generate a random technical recommendation
            
            const technicalRecommendations = [
                {
                    priority: "medium",
                    category: "technical",
                    recommendation: "Enhance blockchain transaction logging for better auditability",
                    rationale: "Improved logging would facilitate more precise auditing"
                },
                {
                    priority: "medium",
                    category: "technical",
                    recommendation: "Implement real-time integrity verification of ballot records",
                    rationale: "Would allow issues to be identified and addressed immediately"
                },
                {
                    priority: "high",
                    category: "technical",
                    recommendation: "Add cryptographic proof linking physical ballots to blockchain records",
                    rationale: "Would strengthen verifiability of the voting system"
                },
                {
                    priority: "medium",
                    category: "technical",
                    recommendation: "Enhance anomaly detection algorithms for real-time monitoring",
                    rationale: "Current anomaly detection could be more sensitive to subtle patterns"
                }
            ];
            
            // Select a recommendation based on audit outcome
            if (auditResults.outcome === "failed" || auditResults.outcome === "indeterminate") {
                return technicalRecommendations[2]; // Most stringent recommendation
            } else if (auditResults.outcome === "passed_with_concerns") {
                return technicalRecommendations[Math.floor(Math.random() * 2)];
            } else if (Math.random() > 0.5) { // 50% chance for passing audits
                return technicalRecommendations[3];
            }
            
            return null;
        } catch (error) {
            log.error(error, { context: 'generateTechnicalRecommendation' });
            return null;
        }
    }
    
    /**
     * Calculate final confidence level for the audit
     */
    function calculateConfidenceLevel() {
        try {
            // In a real implementation, this would use proper statistical methods
            // For demonstration, use a simplified calculation
            
            const matchRate = auditResults.ballotsVerified / auditResults.ballotsSampled;
            const discrepancyWeight = auditResults.discrepanciesFound * 0.02;
            const anomalyWeight = auditResults.anomaliesDetected * 0.01;
            
            // Base confidence is configuration confidence adjusted by match rate
            const baseConfidence = (auditResults.configuration.confidence || 0.95) * matchRate;
            
            // Adjust confidence based on discrepancies and anomalies
            let adjustedConfidence = baseConfidence - discrepancyWeight - anomalyWeight;
            
            // Ensure confidence is between 0 and 1
            return Math.min(1, Math.max(0, adjustedConfidence));
        } catch (error) {
            log.error(error, { context: 'calculateConfidenceLevel' });
            return 0.5; // Return default confidence level on error
        }
    }
    
    /**
     * Display a system error message in the UI
     */
    function showSystemError(message) {
        if (!auditConfig.renderUI) return;
        
        try {
            // Get audit status element
            const statusElement = document.getElementById('auditStatus');
            if (statusElement) {
                statusElement.className = 'audit-status error';
                
                // Create error message
                statusElement.innerHTML = `
                    <div class="status-icon error-icon"></div>
                    <div class="status-content">
                        <div class="error-message">${message}</div>
                        <button class="retry-button" id="auditSystemRetryButton">Retry</button>
                    </div>
                `;
                
                // Add retry button functionality
                const retryButton = document.getElementById('auditSystemRetryButton');
                if (retryButton) {
                    retryButton.addEventListener('click', () => {
                        // Attempt to reinitialize
                        statusElement.innerHTML = `
                            <div class="status-icon"></div>
                            <div class="status-content">
                                <div class="status-message">Reinitializing audit system...</div>
                                <div class="progress-bar">
                                    <div class="progress-bar-fill" style="width: 0%"></div>
                                </div>
                                <div class="progress-text">0%</div>
                            </div>
                        `;
                        
                        // Retry initialization
                        setTimeout(() => {
                            initialize();
                        }, 500);
                    });
                }
            }
            
            // Add error to results section if it exists
            const resultsElement = document.getElementById('auditResults');
            if (resultsElement) {
                resultsElement.innerHTML = `
                    <div class="audit-error">
                        <h4>System Error</h4>
                        <p>${message}</p>
                        <p>Please try again or contact system administrator if the problem persists.</p>
                    </div>
                `;
            }
        } catch (uiError) {
            log.error(uiError, { context: 'showSystemError' });
        }
    }
    
    /**
     * Update the audit status UI
     */
    function updateAuditStatusUI(status, message, progress = null) {
        if (!auditConfig.renderUI) return;
        
        try {
            const statusElement = document.getElementById('auditStatus');
            if (!statusElement) return;
            
            // Update status class
            statusElement.className = 'audit-status ' + status;
            
            // Update message
            const messageElement = statusElement.querySelector('.status-message');
            if (messageElement) {
                messageElement.textContent = message;
            } else {
                // Create status content if it doesn't exist
                statusElement.innerHTML = `
                    <div class="status-icon"></div>
                    <div class="status-content">
                        <div class="status-message">${message}</div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: ${progress || 0}%"></div>
                        </div>
                        <div class="progress-text">${progress || 0}%</div>
                    </div>
                `;
            }
            
            // Update progress bar if provided
            if (progress !== null) {
                const progressBar = statusElement.querySelector('.progress-bar-fill');
                if (progressBar) {
                    progressBar.style.width = `${progress}%`;
                }
                
                const progressText = statusElement.querySelector('.progress-text');
                if (progressText) {
                    progressText.textContent = `${progress}%`;
                }
            }
        } catch (error) {
            log.error(error, { context: 'updateAuditStatusUI' });
        }
    }
    
    /**
     * Display audit results in the UI
     */
    function displayAuditResults(results) {
        if (!auditConfig.renderUI) return;
        
        try {
            const resultsElement = document.getElementById('auditResults');
            if (!resultsElement) return;
            
            // Format the audit outcome
            let outcomeClass = '';
            let outcomeIcon = '';
            
            switch (results.outcome) {
                case 'passed':
                    outcomeClass = 'outcome-passed';
                    outcomeIcon = '✅';
                    break;
                case 'passed_with_concerns':
                    outcomeClass = 'outcome-concerns';
                    outcomeIcon = '⚠️';
                    break;
                case 'indeterminate':
                    outcomeClass = 'outcome-indeterminate';
                    outcomeIcon = '❓';
                    break;
                case 'failed':
                    outcomeClass = 'outcome-failed';
                    outcomeIcon = '❌';
                    break;
            }
            
            // Format duration
            const durationMs = results.endTime - results.startTime;
            const duration = formatDuration(durationMs);
            
            // Create HTML for results
            const resultsHTML = `
                <div class="audit-outcome ${outcomeClass}">
                    <div class="outcome-header">
                        <span class="outcome-icon">${outcomeIcon}</span>
                        <h5>Audit ${results.outcome.replace('_', ' ')}</h5>
                    </div>
                    <p>${results.outcomeDescription}</p>
                </div>
                
                <div class="audit-overview">
                    <div class="overview-header">
                        <h4>Audit Overview</h4>
                        <span class="audit-id">ID: ${results.auditId}</span>
                    </div>
                    
                    <div class="overview-stats">
                        <div class="stat-card">
                            <span class="stat-value">${results.ballotsSampled}</span>
                            <span class="stat-label">Ballots Sampled</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-value">${results.ballotsVerified}</span>
                            <span class="stat-label">Verified</span>
                        </div>
                        <div class="stat-card ${results.discrepanciesFound > 0 ? 'stat-card-warn' : ''}">
                            <span class="stat-value">${results.discrepanciesFound}</span>
                            <span class="stat-label">Discrepancies</span>
                        </div>
                        <div class="stat-card ${results.anomaliesDetected > 0 ? 'stat-card-warn' : ''}">
                            <span class="stat-value">${results.anomaliesDetected}</span>
                            <span class="stat-label">Anomalies</span>
                        </div>
                    </div>
                    
                    <div class="overview-details">
                        <div class="detail-item">
                            <span class="detail-label">Confidence Level:</span>
                            <span class="detail-value">${(results.confidenceLevel * 100).toFixed(2)}%</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Duration:</span>
                            <span class="detail-value">${duration}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Audit Type:</span>
                            <span class="detail-value">${capitalizeFirst(results.configuration.auditType || 'standard')}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Sampling Method:</span>
                            <span class="detail-value">${capitalizeFirst(results.configuration.samplingMethod || 'random')}</span>
                        </div>
                    </div>
                    
                    ${isProd ? '<div class="environment-badge production">Production Environment</div>' : ''}
                </div>
                
                <div class="audit-recommendations">
                    <h4>Recommendations</h4>
                    
                    <div class="recommendations-list">
                        ${results.recommendations.map(rec => `
                            <div class="recommendation-item priority-${rec.priority}">
                                <div class="recommendation-header">
                                    <span class="priority-badge">${capitalizeFirst(rec.priority)}</span>
                                    <span class="category-tag">${capitalizeFirst(rec.category)}</span>
                                </div>
                                <div class="recommendation-content">
                                    <p class="recommendation-text">${rec.recommendation}</p>
                                    <p class="recommendation-rationale">${rec.rationale}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="audit-details-tabs">
                    <div class="tabs-header">
                        <button class="tab-button active" data-tab="discrepancies">Discrepancies</button>
                        <button class="tab-button" data-tab="anomalies">Anomalies</button>
                        <button class="tab-button" data-tab="statistics">Statistics</button>
                    </div>
                    
                    <div class="tab-content active" id="discrepanciesTab">
                        ${results.comparisonResults.discrepancies.length > 0 ? 
                            createDiscrepanciesTable(results.comparisonResults.discrepancies) : 
                            '<p class="no-data">No discrepancies detected</p>'}
                        
                        ${results.discrepancyPatterns && results.discrepancyPatterns.patternsDetected ? `
                            <div class="pattern-analysis">
                                <h5>Pattern Analysis</h5>
                                <p>Primary pattern detected: <strong>${results.discrepancyPatterns.primaryPattern}</strong></p>
                                <div class="pattern-distribution">
                                    ${Object.entries(results.discrepancyPatterns.typeDistribution).map(([type, count]) => `
                                        <div class="distribution-item">
                                            <span class="item-label">${type}</span>
                                            <div class="item-bar-container">
                                                <div class="item-bar" style="width: ${(count / results.discrepanciesFound) * 100}%"></div>
                                            </div>
                                            <span class="item-count">${count}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="tab-content" id="anomaliesTab">
                        ${results.comparisonResults.anomalies.length > 0 ? 
                            createAnomaliesTable(results.comparisonResults.anomalies) :
                            '<p class="no-data">No anomalies detected</p>'}
                        
                        ${results.anomalyPatterns && results.anomalyPatterns.patternsDetected ? `
                            <div class="pattern-analysis">
                                <h5>Pattern Analysis</h5>
                                <p>Primary pattern detected: <strong>${results.anomalyPatterns.primaryPattern}</strong></p>
                                <p>Recommended action: <strong>${results.anomalyPatterns.recommendedAction}</strong></p>
                                <div class="pattern-distribution">
                                    ${Object.entries(results.anomalyPatterns.typeDistribution).map(([type, count]) => `
                                        <div class="distribution-item">
                                            <span class="item-label">${type}</span>
                                            <div class="item-bar-container">
                                                <div class="item-bar" style="width: ${(count / results.anomaliesDetected) * 100}%"></div>
                                            </div>
                                            <span class="item-count">${count}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="tab-content" id="statisticsTab">
                        <div class="statistics-grid">
                            <div class="stats-card">
                                <h5>Statistical Significance</h5>
                                <div class="stat-detail-item">
                                    <span class="stat-detail-label">Margin of Error:</span>
                                    <span class="stat-detail-value">±${results.statisticalSignificance.marginOfError.toFixed(2)}%</span>
                                </div>
                                <div class="stat-detail-item">
                                    <span class="stat-detail-label">Confidence Interval:</span>
                                    <span class="stat-detail-value">
                                        ${(results.statisticalSignificance.confidenceInterval[0] * 100).toFixed(2)}% - 
                                        ${(results.statisticalSignificance.confidenceInterval[1] * 100).toFixed(2)}%
                                    </span>
                                </div>
                                <div class="stat-detail-item">
                                    <span class="stat-detail-label">Sample Representativeness:</span>
                                    <span class="stat-detail-value">${(results.statisticalSignificance.sampleRepresentativeness * 100).toFixed(2)}%</span>
                                </div>
                            </div>
                            
                            <div class="stats-card">
                                <h5>Sample Distribution</h5>
                                <div class="pie-chart-container">
                                    <div class="pie-chart-legend">
                                        <div class="legend-item">
                                            <span class="legend-color verified"></span>
                                            <span class="legend-label">Verified (${results.ballotsVerified})</span>
                                        </div>
                                        <div class="legend-item">
                                            <span class="legend-color discrepancy"></span>
                                            <span class="legend-label">Discrepancies (${results.discrepanciesFound})</span>
                                        </div>
                                        <div class="legend-item">
                                            <span class="legend-color anomaly"></span>
                                            <span class="legend-label">Anomalies (${results.anomaliesDetected})</span>
                                        </div>
                                    </div>
                                    <div class="pie-chart-placeholder">
                                        Pie chart visualization would appear here
                                    </div>
                                </div>
                            </div>
                            
                            <div class="stats-card wide">
                                <h5>Audit Timeline</h5>
                                <div class="timeline-chart-placeholder">
                                    Timeline visualization would appear here
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="audit-actions">
                    <button class="action-button download-button" id="downloadAuditReportBtn">Download Audit Report (PDF)</button>
                    <button class="action-button export-button" id="exportAuditDataBtn">Export Detailed Data (CSV)</button>
                </div>
            `;
            
            // Set the HTML
            resultsElement.innerHTML = resultsHTML;
            
            // Add event listeners for tabs
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
                    } catch (tabError) {
                        log.error(tabError, { context: 'auditResultTabs' });
                    }
                });
            });
            
            // Add event listeners for download buttons
            document.getElementById('downloadAuditReportBtn')?.addEventListener('click', () => {
                try {
                    // In production, use real report generation service
                    if (isProd && config?.auditServices?.generateReport) {
                        config.auditServices.generateReport(results.auditId, 'pdf')
                            .then(url => {
                                if (url) {
                                    window.open(url, '_blank');
                                } else {
                                    alert('Report generation is not available at this time.');
                                }
                            })
                            .catch(error => {
                                log.error(error, { context: 'generateAuditReport' });
                                alert('Failed to generate report. Please try again later.');
                            });
                    } else {
                        alert('In a production environment, this would generate and download a PDF report of the audit results.');
                    }
                } catch (error) {
                    log.error(error, { context: 'downloadAuditReport' });
                    alert('An error occurred while attempting to generate the report.');
                }
            });
            
            document.getElementById('exportAuditDataBtn')?.addEventListener('click', () => {
                try {
                    // In production, use real data export service
                    if (isProd && config?.auditServices?.exportData) {
                        config.auditServices.exportData(results.auditId, 'csv')
                            .then(url => {
                                if (url) {
                                    window.open(url, '_blank');
                                } else {
                                    alert('Data export is not available at this time.');
                                }
                            })
                            .catch(error => {
                                log.error(error, { context: 'exportAuditData' });
                                alert('Failed to export data. Please try again later.');
                            });
                    } else {
                        alert('In a production environment, this would export the detailed audit data in CSV format.');
                    }
                } catch (error) {
                    log.error(error, { context: 'exportAuditData' });
                    alert('An error occurred while attempting to export the data.');
                }
            });
        } catch (error) {
            log.error(error, { context: 'displayAuditResults' });
            
            // Show simplified error UI
            if (resultsElement) {
                resultsElement.innerHTML = `
                    <div class="audit-error">
                        <h4>Error Displaying Results</h4>
                        <p>There was a problem displaying the audit results. The audit completed, but the results cannot be shown properly.</p>
                        <button class="retry-button" id="retryDisplayBtn">Retry</button>
                    </div>
                `;
                
                // Add retry functionality
                document.getElementById('retryDisplayBtn')?.addEventListener('click', () => {
                    displayAuditResults(results);
                });
            }
        }
    }
    
    /**
     * Create a table HTML for discrepancies
     */
    function createDiscrepanciesTable(discrepancies) {
        if (!discrepancies || discrepancies.length === 0) {
            return '<p class="no-data">No discrepancies detected</p>';
        }
        
        try {
            // In production, limit the amount of sensitive data shown
            const displayDiscrepancies = isProd && discrepancies.length > 10 ? 
                discrepancies.slice(0, 10) : discrepancies;
            
            let tableHtml = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ballot ID</th>
                                <th>Discrepancy Type</th>
                                <th>Severity</th>
                                <th>Confidence</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayDiscrepancies.map(d => `
                                <tr class="severity-${d.severity || 'low'}">
                                    <td>${d.ballotId}</td>
                                    <td>${d.discrepancyType}</td>
                                    <td><span class="severity-badge ${d.severity || 'low'}">${capitalizeFirst(d.severity || 'low')}</span></td>
                                    <td>${(d.confidenceScore * 100).toFixed(1)}%</td>
                                    <td>${formatDateTime(d.timestamp)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add note if we're showing limited results in production
            if (isProd && discrepancies.length > 10) {
                tableHtml += `
                    <div class="table-note">
                        Showing 10 of ${discrepancies.length} discrepancies. Export data for complete results.
                    </div>
                `;
            }
            
            return tableHtml;
        } catch (error) {
            log.error(error, { context: 'createDiscrepanciesTable' });
            return '<p class="error-data">Error displaying discrepancies data</p>';
        }
    }
    
    /**
     * Create a table HTML for anomalies
     */
    function createAnomaliesTable(anomalies) {
        if (!anomalies || anomalies.length === 0) {
            return '<p class="no-data">No anomalies detected</p>';
        }
        
        try {
            // In production, limit the amount of sensitive data shown
            const displayAnomalies = isProd && anomalies.length > 10 ? 
                anomalies.slice(0, 10) : anomalies;
            
            let tableHtml = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ballot ID</th>
                                <th>Anomaly Type</th>
                                <th>Description</th>
                                <th>Confidence</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayAnomalies.map(a => `
                                <tr>
                                    <td>${a.ballotId}</td>
                                    <td>${a.anomalyType}</td>
                                    <td>${a.description}</td>
                                    <td>${(a.confidenceScore * 100).toFixed(1)}%</td>
                                    <td>${formatDateTime(a.timestamp)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add note if we're showing limited results in production
            if (isProd && anomalies.length > 10) {
                tableHtml += `
                    <div class="table-note">
                        Showing 10 of ${anomalies.length} anomalies. Export data for complete results.
                    </div>
                `;
            }
            
            return tableHtml;
        } catch (error) {
            log.error(error, { context: 'createAnomaliesTable' });
            return '<p class="error-data">Error displaying anomalies data</p>';
        }
    }
    
    /**
     * Update verification statistics display
     */
    function updateVerificationStats() {
        if (!auditConfig.renderUI) return;
        
        try {
            const verifiedElement = document.getElementById('verifiedBallotsCount');
            const discrepanciesElement = document.getElementById('discrepanciesCount');
            const anomaliesElement = document.getElementById('anomaliesCount');
            
            if (verifiedElement) {
                verifiedElement.textContent = verificationRecords.ballotMatches.length;
            }
            
            if (discrepanciesElement) {
                discrepanciesElement.textContent = verificationRecords.discrepancies.length;
            }
            
            if (anomaliesElement) {
                anomaliesElement.textContent = verificationRecords.anomalies.length;
            }
        } catch (error) {
            log.error(error, { context: 'updateVerificationStats' });
        }
    }
    
    /**
     * Show modal with verification records
     */
    function showVerificationRecordsModal() {
        if (!auditConfig.renderUI) return;
        
        try {
            // In production, check if this feature is allowed
            if (isProd && config?.featureFlags?.disableVerificationRecordsUI) {
                alert("Verification records are not available in this environment.");
                return;
            }
            
            // Create modal container
            const modal = document.createElement('div');
            modal.className = 'audit-modal';
            
            // Create modal content
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>Verification Records</h4>
                        <span class="modal-close">&times;</span>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="modal-tab active" data-tab="matches">Verified Ballots (${verificationRecords.ballotMatches.length})</button>
                        <button class="modal-tab" data-tab="discrepancies">Discrepancies (${verificationRecords.discrepancies.length})</button>
                        <button class="modal-tab" data-tab="anomalies">Anomalies (${verificationRecords.anomalies.length})</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="tab-content active" id="matchesContent">
                            ${createMatchesTable()}
                        </div>
                        
                        <div class="tab-content" id="discrepanciesContent">
                            ${createDiscrepanciesModal()}
                        </div>
                        
                        <div class="tab-content" id="anomaliesContent">
                            ${createAnomaliesModal()}
                        </div>
                    </div>
                    
                    ${isProd ? 
                        '<div class="modal-footer"><div class="environment-badge production">Production Environment - Limited Data View</div></div>' : 
                        ''}
                </div>
            `;
            
            // Add to the page
            document.body.appendChild(modal);
            
            // Add event listener for close button
            modal.querySelector('.modal-close').addEventListener('click', function() {
                modal.remove();
            });
            
            // Add event listeners for tabs
            modal.querySelectorAll('.modal-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    try {
                        // Set active tab
                        modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
                        this.classList.add('active');
                        
                        // Show content
                        const tabId = this.dataset.tab;
                        modal.querySelectorAll('.tab-content').forEach(content => {
                            content.classList.remove('active');
                        });
                        modal.querySelector(`#${tabId}Content`).classList.add('active');
                    } catch (tabError) {
                        log.error(tabError, { context: 'verificationRecordsTabs' });
                    }
                });
            });
            
            // Close when clicking outside the modal content
            modal.addEventListener('click', function(event) {
                if (event.target === modal) {
                    modal.remove();
                }
            });
        } catch (error) {
            log.error(error, { context: 'showVerificationRecordsModal' });
            alert("An error occurred while trying to display verification records.");
        }
    }
    
    /**
     * Create HTML table for ballot matches
     */
    function createMatchesTable() {
        if (verificationRecords.ballotMatches.length === 0) {
            return '<p class="no-data">No verified ballots recorded yet.</p>';
        }
        
        try {
            // In production, limit the data shown
            const displayMatches = isProd ? 
                verificationRecords.ballotMatches.slice(0, 10) : 
                verificationRecords.ballotMatches;
            
            let tableHtml = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ballot ID</th>
                                <th>Blockchain Record</th>
                                <th>Verification Method</th>
                                <th>Confidence</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayMatches.map(match => `
                                <tr>
                                    <td>${match.ballotId}</td>
                                    <td>${match.blockchainRecordId}</td>
                                    <td>${match.verificationMethod}</td>
                                    <td>${(match.confidence * 100).toFixed(1)}%</td>
                                    <td>${formatDateTime(match.timestamp)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add note if we're limiting data in production
            if (isProd && verificationRecords.ballotMatches.length > 10) {
                tableHtml += `
                    <div class="table-note">
                        Showing 10 of ${verificationRecords.ballotMatches.length} records. Export data for complete results.
                    </div>
                `;
            }
            
            return tableHtml;
        } catch (error) {
            log.error(error, { context: 'createMatchesTable' });
            return '<p class="error-data">Error displaying verified ballots data</p>';
        }
    }
    
    /**
     * Create HTML table for discrepancies in modal
     */
    function createDiscrepanciesModal() {
        if (verificationRecords.discrepancies.length === 0) {
            return '<p class="no-data">No discrepancies recorded yet.</p>';
        }
        
        try {
            // In production, limit the data shown
            const displayDiscrepancies = isProd ? 
                verificationRecords.discrepancies.slice(0, 10) : 
                verificationRecords.discrepancies;
            
            let tableHtml = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Ballot ID</th>
                                <th>Discrepancy Type</th>
                                <th>Description</th>
                                <th>Severity</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayDiscrepancies.map(discrepancy => `
                                <tr class="severity-${discrepancy.severity}">
                                    <td>${discrepancy.ballotId}</td>
                                    <td>${discrepancy.discrepancyType}</td>
                                    <td>${discrepancy.description}</td>
                                    <td><span class="severity-badge ${discrepancy.severity}">${capitalizeFirst(discrepancy.severity)}</span></td>
                                    <td>${discrepancy.resolutionStatus}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add note if we're limiting data in production
            if (isProd && verificationRecords.discrepancies.length > 10) {
                tableHtml += `
                    <div class="table-note">
                        Showing 10 of ${verificationRecords.discrepancies.length} records. Export data for complete results.
                    </div>
                `;
            }
            
            return tableHtml;
        } catch (error) {
            log.error(error, { context: 'createDiscrepanciesModal' });
            return '<p class="error-data">Error displaying discrepancies data</p>';
        }
    }
    
    /**
     * Create HTML table for anomalies in modal
     */
    function createAnomaliesModal() {
        if (verificationRecords.anomalies.length === 0) {
            return '<p class="no-data">No anomalies recorded yet.</p>';
        }
        
        try {
            // In production, limit the data shown
            const displayAnomalies = isProd ? 
                verificationRecords.anomalies.slice(0, 10) : 
                verificationRecords.anomalies;
            
            let tableHtml = `
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Anomaly Type</th>
                                <th>Description</th>
                                <th>Affected Records</th>
                                <th>Confidence</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${displayAnomalies.map(anomaly => `
                                <tr>
                                    <td>${anomaly.anomalyType}</td>
                                    <td>${anomaly.description}</td>
                                    <td>${anomaly.affectedRecords}</td>
                                    <td>${(anomaly.confidenceScore * 100).toFixed(1)}%</td>
                                    <td>${anomaly.investigationStatus}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            // Add note if we're limiting data in production
            if (isProd && verificationRecords.anomalies.length > 10) {
                tableHtml += `
                    <div class="table-note">
                        Showing 10 of ${verificationRecords.anomalies.length} records. Export data for complete results.
                    </div>
                `;
            }
            
            return tableHtml;
        } catch (error) {
            log.error(error, { context: 'createAnomaliesModal' });
            return '<p class="error-data">Error displaying anomalies data</p>';
        }
    }
    
    /**
     * Create the UI for the audit system
     */
    function createAuditUIElements() {
        if (!auditConfig.renderUI) {
            log.debug("Skipping UI creation - UI rendering is disabled");
            return;
        }
        
        try {
            // Check if the audit section already exists
            if (document.getElementById('auditSystemContainer')) {
                log.debug("Audit UI already exists, skipping creation");
                return;
            }
            
            // Create the audit section container
            const auditSection = document.createElement('div');
            auditSection.id = 'auditSystemContainer';
            auditSection.className = 'audit-system-container';
            
            // Create section heading
            auditSection.innerHTML = `
                <h3>Enhanced Audit Processes</h3>
                
                <div class="audit-system-description">
                    <p>This advanced audit system uses AI to verify electoral outcomes and ensure transparency. 
                    It streamlines the comparison of blockchain records with physical ballots, identifies discrepancies, 
                    and provides comprehensive verification.</p>
                </div>
                
                <div class="audit-controls">
                    <div class="control-panel">
                        <h4>Start New Audit</h4>
                        
                        <div class="control-group">
                            <label for="auditType">Audit Type</label>
                            <select id="auditType" class="audit-input">
                                <option value="standard">Standard Audit</option>
                                <option value="risk-limiting">Risk-Limiting Audit</option>
                                <option value="full">Full Recount</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="samplingMethod">Sampling Method</label>
                            <select id="samplingMethod" class="audit-input">
                                <option value="random">Random Sampling</option>
                                <option value="stratified">Stratified Sampling</option>
                                <option value="systematic">Systematic Sampling</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="confidenceLevel">Confidence Level</label>
                            <select id="confidenceLevel" class="audit-input">
                                <option value="0.90">90%</option>
                                <option value="0.95" selected>95%</option>
                                <option value="0.99">99%</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="marginOfError">Margin of Error</label>
                            <select id="marginOfError" class="audit-input">
                                <option value="0.01">1%</option>
                                <option value="0.03">3%</option>
                                <option value="0.05" selected>5%</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="ballotPopulation">Total Ballots (Optional)</label>
                            <input type="number" id="ballotPopulation" class="audit-input" placeholder="Enter number of ballots" min="1">
                        </div>
                        
                        <div class="advanced-options">
                            <button id="toggleAdvancedOptions" class="toggle-button">
                                Advanced Options ▼
                            </button>
                            
                            <div id="advancedOptionsPanel" class="advanced-panel" style="display: none;">
                                <div class="control-group">
                                    <label for="marginOfVictory">Margin of Victory (for RLA)</label>
                                    <input type="number" id="marginOfVictory" class="audit-input" value="0.05" min="0.01" max="1" step="0.01">
                                </div>
                                
                                <div class="control-group">
                                    <label for="riskLimit">Risk Limit (for RLA)</label>
                                    <input type="number" id="riskLimit" class="audit-input" value="0.05" min="0.01" max="0.1" step="0.01">
                                </div>
                                
                                ${isProd ? `
                                    <div class="control-group">
                                        <label for="secureVerification">Secure Verification</label>
                                        <select id="secureVerification" class="audit-input">
                                            <option value="true" selected>Enabled</option>
                                            <option value="false">Disabled (For Testing Only)</option>
                                        </select>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        <button id="startAuditButton" class="start-audit-button">Start Audit</button>
                    </div>
                    
                    <div class="verification-panel">
                        <h4>Verification Records</h4>
                        
                        <div class="verification-stats">
                            <div class="verification-stat">
                                <span class="stat-number" id="verifiedBallotsCount">0</span>
                                <span class="stat-label">Verified Ballots</span>
                            </div>
                            <div class="verification-stat">
                                <span class="stat-number" id="discrepanciesCount">0</span>
                                <span class="stat-label">Discrepancies</span>
                            </div>
                            <div class="verification-stat">
                                <span class="stat-number" id="anomaliesCount">0</span>
                                <span class="stat-label">Anomalies</span>
                            </div>
                        </div>
                        
                        <div class="verification-actions">
                            <button id="viewRecordsButton" class="view-records-button">View All Records</button>
                            <button id="exportRecordsButton" class="export-records-button">Export Records</button>
                        </div>
                    </div>
                </div>
                
                <div id="auditStatus" class="audit-status">
                    <div class="status-icon"></div>
                    <div class="status-content">
                        <div class="status-message">No audit in progress</div>
                        <div class="progress-bar">
                            <div class="progress-bar-fill" style="width: 0%"></div>
                        </div>
                        <div class="progress-text">0%</div>
                    </div>
                </div>
                
                <div id="auditResults" class="audit-results">
                    <!-- Audit results will be displayed here -->
                </div>
                
                ${isProd ? '<div class="environment-badge production">Production Environment</div>' : 
                  '<div class="environment-badge development">Development Environment</div>'}
            `;
            
            // Determine where to add the dashboard
            let insertLocation = null;
            
            if (auditConfig.dashboardPosition === 'afterPredictiveAnalytics') {
                // Try to find predictive analytics dashboard
                insertLocation = document.getElementById('predictiveAnalyticsDashboard');
            } else if (auditConfig.dashboardPosition === 'beforeResults') {
                // Try to find results section but insert before it
                insertLocation = document.querySelector('#resultsSection') || 
                                document.querySelector('.results-section');
            } else if (auditConfig.dashboardPosition === 'end') {
                // Add at the end of main content
                insertLocation = document.querySelector('main') || document.querySelector('body');
                insertLocation.appendChild(auditSection);
                addInitialEventListeners();
                addAuditStyles();
                return; // No need to use insertBefore
            }
            
            // Insert the dashboard
            if (insertLocation) {
                insertLocation.parentNode.insertBefore(auditSection, insertLocation.nextSibling);
            } else {
                // Fallback: add to the voting results section
                const votingResultsSection = document.querySelector('.voting-results') || 
                                          document.getElementById('votingResults');
                
                if (votingResultsSection) {
                    votingResultsSection.parentNode.insertBefore(auditSection, votingResultsSection.nextSibling);
                } else {
                    // Fallback: add to the main container
                    const mainContainer = document.querySelector('main') || document.querySelector('body');
                    mainContainer.appendChild(auditSection);
                }
            }
            
            // Add event listeners
            addInitialEventListeners();
            
            // Add CSS styles
            addAuditStyles();
            
            log.debug("Audit UI elements created successfully");
        } catch (error) {
            log.error(error, { context: 'createAuditUIElements' });
        }
    }
    
    /**
     * Add initial event listeners to UI elements
     */
    function addInitialEventListeners() {
        try {
            // Toggle advanced options
            document.getElementById('toggleAdvancedOptions')?.addEventListener('click', function() {
                try {
                    const panel = document.getElementById('advancedOptionsPanel');
                    if (panel) {
                        if (panel.style.display === 'none') {
                            panel.style.display = 'block';
                            this.textContent = 'Advanced Options ▲';
                        } else {
                            panel.style.display = 'none';
                            this.textContent = 'Advanced Options ▼';
                        }
                    }
                } catch (error) {
                    log.error(error, { context: 'toggleAdvancedOptions' });
                }
            });
            
            // Start audit button
            document.getElementById('startAuditButton')?.addEventListener('click', function() {
                try {
                    // Gather audit configuration
                    const auditConfig = {
                        auditType: document.getElementById('auditType')?.value || 'standard',
                        samplingMethod: document.getElementById('samplingMethod')?.value || 'random',
                        confidence: parseFloat(document.getElementById('confidenceLevel')?.value || '0.95'),
                        marginOfError: parseFloat(document.getElementById('marginOfError')?.value || '0.05'),
                        population: document.getElementById('ballotPopulation')?.value ? 
                            parseInt(document.getElementById('ballotPopulation').value, 10) : undefined,
                        marginOfVictory: document.getElementById('marginOfVictory')?.value ? 
                            parseFloat(document.getElementById('marginOfVictory').value) : undefined,
                        riskLimit: document.getElementById('riskLimit')?.value ? 
                            parseFloat(document.getElementById('riskLimit').value) : undefined
                    };
                    
                    // Add secure verification flag if in production
                    if (isProd && document.getElementById('secureVerification')) {
                        auditConfig.secureVerification = 
                            document.getElementById('secureVerification').value === 'true';
                    }
                    
                    // Add renderUI flag
                    auditConfig.renderUI = true;
                    
                    // Start the audit
                    startAudit(auditConfig).catch(error => {
                        log.error(error, { context: 'startAuditFromUI' });
                        alert(`Error starting audit: ${error.message}`);
                    });
                } catch (error) {
                    log.error(error, { context: 'startAuditButton' });
                    alert(`Failed to start audit: ${error.message}`);
                }
            });
            
            // View records button
            document.getElementById('viewRecordsButton')?.addEventListener('click', function() {
                showVerificationRecordsModal();
            });
            
            // Export records button
            document.getElementById('exportRecordsButton')?.addEventListener('click', function() {
                try {
                    // In production with export service
                    if (isProd && config?.auditServices?.exportVerificationRecords) {
                        config.auditServices.exportVerificationRecords('csv')
                            .then(url => {
                                if (url) {
                                    window.open(url, '_blank');
                                } else {
                                    alert('Records export is not available at this time.');
                                }
                            })
                            .catch(error => {
                                log.error(error, { context: 'exportVerificationRecords' });
                                alert('Failed to export records. Please try again later.');
                            });
                    } else {
                        alert('In a production environment, this would export all verification records to a CSV file.');
                    }
                } catch (error) {
                    log.error(error, { context: 'exportRecordsButton' });
                    alert('An error occurred while attempting to export records.');
                }
            });
            
            // Update verification stats
            updateVerificationStats();
        } catch (error) {
            log.error(error, { context: 'addInitialEventListeners' });
        }
    }
    
    /**
     * Add CSS styles for the audit system
     */
    function addAuditStyles() {
        try {
            // Check if styles already added
            if (document.getElementById('auditSystemStyles')) {
                return;
            }
            
            const styleElement = document.createElement('style');
            styleElement.id = 'auditSystemStyles';
            styleElement.textContent = `
                .audit-system-container {
                    margin-top: 30px;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    position: relative;
                }
                
                .audit-system-container h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                }
                
                .audit-system-description {
                    margin-bottom: 20px;
                    color: #555;
                    line-height: 1.5;
                }
                
                .audit-controls {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 20px;
                }
                
                .control-panel, .verification-panel {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                
                .control-panel h4, .verification-panel h4 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                }
                
                .control-group {
                    margin-bottom: 15px;
                }
                
                .control-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 500;
                    color: #555;
                }
                
                .audit-input {
                    width: 100%;
                    padding: 8px 10px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }
                
                .toggle-button {
                    background: none;
                    border: none;
                    color: #3f51b5;
                    padding: 5px 0;
                    text-align: left;
                    cursor: pointer;
                    font-size: 14px;
                    margin-bottom: 10px;
                }
                
                .advanced-panel {
                    background-color: #f5f5f5;
                    padding: 15px;
                    border-radius: 6px;
                    margin-bottom: 15px;
                }
                
                .advanced-panel .control-group:last-child {
                    margin-bottom: 0;
                }
                
                .start-audit-button {
                    background-color: #3f51b5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 15px;
                    font-size: 16px;
                    cursor: pointer;
                    width: 100%;
                    margin-top: 10px;
                }
                
                .start-audit-button:hover {
                    background-color: #303f9f;
                }
                
                .verification-stats {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                
                .verification-stat {
                    text-align: center;
                }
                
                .stat-number {
                    display: block;
                    font-size: 28px;
                    font-weight: bold;
                    color: #3f51b5;
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    color: #555;
                    font-size: 14px;
                }
                
                .verification-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                
                .view-records-button, .export-records-button {
                    padding: 8px 10px;
                    border: 1px solid #3f51b5;
                    border-radius: 4px;
                    background-color: white;
                    color: #3f51b5;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .view-records-button:hover, .export-records-button:hover {
                    background-color: #e8eaf6;
                }
                
                .audit-status {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #f5f5f5;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                }
                
                .audit-status.in-progress {
                    background-color: #e3f2fd;
                    border-left: 4px solid #2196f3;
                }
                
                .audit-status.completed {
                    background-color: #e8f5e9;
                    border-left: 4px solid #4caf50;
                }
                
                .audit-status.failed, .audit-status.error {
                    background-color: #ffebee;
                    border-left: 4px solid #f44336;
                }
                
                .status-icon {
                    width: 24px;
                    height: 24px;
                    margin-right: 15px;
                }
                
                .error-icon {
                    background-color: #f44336;
                    border-radius: 50%;
                    position: relative;
                }
                
                .error-icon:before, .error-icon:after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    width: 2px;
                    height: 12px;
                    background-color: white;
                }
                
                .error-icon:before {
                    transform: translate(-50%, -50%) rotate(45deg);
                }
                
                .error-icon:after {
                    transform: translate(-50%, -50%) rotate(-45deg);
                }
                
                .status-content {
                    flex: 1;
                }
                
                .status-message {
                    margin-bottom: 10px;
                    font-weight: 500;
                }
                
                .error-message {
                    color: #f44336;
                    margin-bottom: 10px;
                    font-weight: 500;
                }
                
                .progress-bar {
                    height: 8px;
                    background-color: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 5px;
                }
                
                .progress-bar-fill {
                    height: 100%;
                    background-color: #3f51b5;
                    width: 0%;
                    transition: width 0.3s ease;
                }
                
                .progress-text {
                    font-size: 12px;
                    color: #757575;
                    text-align: right;
                }
                
                .audit-results {
                    margin-top: 20px;
                }
                
                .audit-outcome {
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                
                .outcome-passed {
                    background-color: #e8f5e9;
                    border-left: 4px solid #4caf50;
                }
                
                .outcome-concerns {
                    background-color: #fff8e1;
                    border-left: 4px solid #ffca28;
                }
                
                .outcome-indeterminate {
                    background-color: #e3f2fd;
                    border-left: 4px solid #2196f3;
                }
                
                .outcome-failed {
                    background-color: #ffebee;
                    border-left: 4px solid #f44336;
                }
                
                .outcome-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .outcome-icon {
                    font-size: 24px;
                    margin-right: 10px;
                }
                
                .outcome-header h5 {
                    margin: 0;
                    text-transform: capitalize;
                }
                
                .audit-overview {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    position: relative;
                }
                
                .overview-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .overview-header h4 {
                    margin: 0;
                }
                
                .audit-id {
                    background-color: #e8eaf6;
                    color: #3f51b5;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                }
                
                .overview-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 20px;
                }
                
                .stat-card {
                    background-color: #f5f5f5;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                }
                
                .stat-card-warn {
                    background-color: #fff8e1;
                    border-left: 3px solid #ffca28;
                }
                
                .overview-details {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                }
                
                .detail-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px solid #f0f0f0;
                }
                
                .detail-label {
                    color: #555;
                }
                
                .detail-value {
                    font-weight: 500;
                }
                
                .audit-recommendations {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                }
                
                .audit-recommendations h4 {
                    margin-top: 0;
                    margin-bottom: 15px;
                }
                
                .recommendations-list {
                    display: grid;
                    gap: 15px;
                }
                
                .recommendation-item {
                    padding: 15px;
                    border-radius: 6px;
                    background-color: #f9f9f9;
                    border-left: 4px solid;
                }
                
                .priority-critical {
                    border-color: #f44336;
                }
                
                .priority-high {
                    border-color: #ff9800;
                }
                
                .priority-medium {
                    border-color: #2196f3;
                }
                
                .priority-low {
                    border-color: #4caf50;
                }
                
                .recommendation-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .priority-badge {
                    background-color: #f5f5f5;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    margin-right: 10px;
                }
                
                .priority-critical .priority-badge {
                    background-color: #ffebee;
                    color: #f44336;
                }
                
                .priority-high .priority-badge {
                    background-color: #fff3e0;
                    color: #ff9800;
                }
                
                .priority-medium .priority-badge {
                    background-color: #e3f2fd;
                    color: #2196f3;
                }
                
                .priority-low .priority-badge {
                    background-color: #e8f5e9;
                    color: #4caf50;
                }
                
                .category-tag {
                    background-color: #e0e0e0;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #555;
                }
                
                .recommendation-text {
                    margin-top: 0;
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                
                .recommendation-rationale {
                    margin-top: 0;
                    color: #757575;
                    font-size: 14px;
                }
                
                .audit-details-tabs {
                    background-color: white;
                    border-radius: 8px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
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
                
                .table-container {
                    overflow-x: auto;
                }
                
                .data-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .data-table th {
                    background-color: #f5f5f5;
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .data-table td {
                    padding: 10px 15px;
                    border-bottom: 1px solid #f0f0f0;
                }
                
                .data-table tr:hover {
                    background-color: #f9f9f9;
                }
                
                .severity-badge {
                    padding: 3px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                }
                
                .severity-badge.high {
                    background-color: #ffebee;
                    color: #f44336;
                }
                
                .severity-badge.medium {
                    background-color: #fff3e0;
                    color: #ff9800;
                }
                
                .severity-badge.low {
                    background-color: #e8f5e9;
                    color: #4caf50;
                }
                
                tr.severity-high {
                    background-color: #fff5f5;
                }
                
                tr.severity-medium {
                    background-color: #fffaf0;
                }
                
                .pattern-analysis {
                    margin-top: 20px;
                    padding: 15px;
                    background-color: #f5f5f5;
                    border-radius: 6px;
                }
                
                .pattern-analysis h5 {
                    margin-top: 0;
                    margin-bottom: 10px;
                }
                
                .pattern-distribution {
                    margin-top: 15px;
                }
                
                .distribution-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 8px;
                }
                
                .item-label {
                    width: 160px;
                    font-size: 14px;
                }
                
                .item-bar-container {
                    flex: 1;
                    height: 12px;
                    background-color: #e0e0e0;
                    border-radius: 6px;
                    overflow: hidden;
                    margin: 0 15px;
                }
                
                .item-bar {
                    height: 100%;
                    background-color: #3f51b5;
                    transition: width 0.3s ease;
                }
                
                .item-count {
                    font-weight: 500;
                    color: #3f51b5;
                }
                
                .statistics-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                }
                
                .stats-card {
                    background-color: #f5f5f5;
                    border-radius: 8px;
                    padding: 15px;
                }
                
                .stats-card.wide {
                    grid-column: span 2;
                }
                
                .stats-card h5 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                }
                
                .stat-detail-item {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                
                .pie-chart-container, .timeline-chart-placeholder {
                    height: 200px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background-color: #f9f9f9;
                    border-radius: 4px;
                    border: 1px dashed #ddd;
                    margin-top: 10px;
                }
                
                .pie-chart-legend {
                    display: flex;
                    flex-direction: column;
                    margin-right: 20px;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 5px;
                }
                
                .legend-color {
                    width: 10px;
                    height: 10px;
                    margin-right: 10px;
                    border-radius: 2px;
                }
                
                .legend-color.verified {
                    background-color: #4caf50;
                }
                
                .legend-color.discrepancy {
                    background-color: #ff9800;
                }
                
                .legend-color.anomaly {
                    background-color: #f44336;
                }
                
                .audit-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 15px;
                }
                
                .action-button {
                    padding: 10px 15px;
                    border-radius: 4px;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                }
                
                .download-button {
                    background-color: #3f51b5;
                    color: white;
                }
                
                .export-button {
                    background-color: #f5f5f5;
                    color: #333;
                }
                
                .audit-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background-color: white;
                    border-radius: 8px;
                    max-width: 90%;
                    width: 800px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    display: flex;
                    flex-direction: column;
                }
                
                .modal-header {
                    padding: 15px 20px;
                    border-bottom: 1px solid #e0e0e0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .modal-header h4 {
                    margin: 0;
                }
                
                .modal-close {
                    font-size: 24px;
                    color: #757575;
                    cursor: pointer;
                }
                
                .modal-tabs {
                    display: flex;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .modal-tab {
                    padding: 12px 20px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    border-bottom: 3px solid transparent;
                    color: #555;
                }
                
                .modal-tab.active {
                    color: #3f51b5;
                    border-bottom-color: #3f51b5;
                    font-weight: 500;
                }
                
                .modal-body {
                    padding: 20px;
                    max-height: 60vh;
                    overflow-y: auto;
                }
                
                .modal-footer {
                    padding: 15px 20px;
                    border-top: 1px solid #e0e0e0;
                    text-align: right;
                }
                
                .no-data {
                    padding: 30px;
                    text-align: center;
                    color: #757575;
                    font-style: italic;
                }
                
                .error-data {
                    padding: 30px;
                    text-align: center;
                    color: #f44336;
                }
                
                .table-note {
                    margin-top: 10px;
                    padding: 5px 10px;
                    background-color: #f5f5f5;
                    border-left: 3px solid #9e9e9e;
                    font-size: 12px;
                    color: #757575;
                }
                
                .retry-button {
                    padding: 8px 15px;
                    background-color: #f44336;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .audit-error {
                    padding: 20px;
                    background-color: #ffebee;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                
                .audit-error h4 {
                    margin-top: 0;
                    color: #f44336;
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
                @media (max-width: 992px) {
                    .audit-controls {
                        grid-template-columns: 1fr;
                    }
                    
                    .overview-stats {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    .overview-details {
                        grid-template-columns: 1fr;
                    }
                    
                    .statistics-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .stats-card.wide {
                        grid-column: span 1;
                    }
                    
                    .tabs-header {
                        flex-wrap: wrap;
                    }
                    
                    .tab-button {
                        padding: 10px;
                    }
                }
            `;
            
            document.head.appendChild(styleElement);
            log.debug("Added audit system styles");
        } catch (error) {
            log.error(error, { context: 'addAuditStyles' });
        }
    }
    
    /**
     * Utility function to shuffle an array
     */
    function shuffleArray(array) {
        try {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        } catch (error) {
            log.error(error, { context: 'shuffleArray' });
            return [...array]; // Return copy of original array on error
        }
    }
    
    /**
     * Generate random hexadecimal string
     */
    function generateRandomHex(length) {
        try {
            const characters = '0123456789abcdef';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += characters.charAt(Math.floor(Math.random() * characters.length));
            }
            return result;
        } catch (error) {
            log.error(error, { context: 'generateRandomHex' });
            return '0'.repeat(length); // Return fallback on error
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
     * Format a duration in a readable format
     */
    function formatDuration(milliseconds) {
        try {
            const seconds = Math.floor(milliseconds / 1000);
            
            if (seconds < 60) {
                return `${seconds} seconds`;
            } else if (seconds < 3600) {
                const minutes = Math.floor(seconds / 60);
                const remainingSeconds = seconds % 60;
                return `${minutes} min ${remainingSeconds} sec`;
            } else {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return `${hours} hr ${minutes} min`;
            }
        } catch (error) {
            log.error(error, { context: 'formatDuration' });
            return `${Math.floor(milliseconds / 1000)} seconds`; // Simple fallback
        }
    }
    
    /**
     * Simulate a delay for demonstration purposes
     * Shorter in production to improve responsiveness
     */
    function simulateDelay(ms) {
        const actualDelay = isProd ? Math.min(ms, 300) : ms;
        return new Promise(resolve => setTimeout(resolve, actualDelay));
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
    
    // Public API
    return {
        initialize,
        startAudit,
        getAuditHistory: () => [...auditHistory], // Return copy to prevent mutation
        getVerificationRecords: () => ({ 
            ballotMatches: [...verificationRecords.ballotMatches],
            discrepancies: [...verificationRecords.discrepancies],
            anomalies: [...verificationRecords.anomalies]
        }),
        calculateSampleSize,
        isEnabled: () => isAuditEnabled && isInitialized,
        getCurrentAuditState: () => currentAuditInProgress ? 
            { inProgress: true, auditId: auditResults?.auditId } : 
            { inProgress: false }
    };
})();

// Initialize the audit system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-initialization is enabled in config
    if (config?.auditProcesses?.autoInitialize !== false) {
        try {
            // Initialize audit system
            window.auditProcesses.initialize().then(success => {
                if (success) {
                    log.info("Audit system initialized successfully");
                } else {
                    log.warn("Audit system initialization failed");
                }
            }).catch(error => {
                log.error(error, { context: 'domContentLoaded.initAuditSystem' });
            });
        } catch (error) {
            log.error(error, { context: 'domContentLoaded' });
        }
    } else {
        log.info("Automatic initialization of Audit System is disabled");
    }
});