/**
 * AI-Powered Vote Analysis and Real-Time Monitoring System
 * 
 * This module provides real-time analytics and monitoring of voting patterns,
 * using AI to detect anomalies and provide insights into voter behavior and trends.
 */

// Initialize from production configuration if available
const config = window.productionConfig || {};
const log = config.log || console;
const isProd = config?.isProd || false;

// Check if vote analysis features are enabled in configuration
const isAnalysisEnabled = config?.featureFlags?.enableVoteAnalysis !== false;

log.info("Loading AI Vote Analysis System", { 
  enabled: isAnalysisEnabled,
  environment: isProd ? "production" : "development"
});

// Main namespace for vote analysis
window.voteAnalysis = (function() {
    // Private variables
    let isInitialized = false;
    let monitoringActive = false;
    
    // Get configuration values with fallbacks
    const anomalyDetectionThreshold = config?.voteAnalysis?.anomalyThreshold || 0.75;  // Threshold for anomaly detection (0-1)
    const refreshInterval = config?.voteAnalysis?.refreshIntervalSeconds || 30;  // Refresh interval in seconds
    const autoStartMonitoring = config?.voteAnalysis?.autoStartMonitoring || false; // Auto-start monitoring
    
    const geographicData = new Map();  // Map of voter locations
    
    // Store vote data for analysis
    const voteHistory = [];
    const votingPatterns = {
        byTime: {},       // Votes organized by time periods
        byLocation: {},   // Votes organized by location
        byCandidates: {}  // Vote distribution by candidate
    };
    
    // Anomaly detection state
    const detectedAnomalies = [];
    const baselineThresholds = config?.voteAnalysis?.baselineThresholds || {
        voteVelocity: 5,        // Default votes per minute threshold
        locationDensity: 10,    // Default votes per location threshold
        candidateDeviation: 0.2 // Default candidate vote distribution deviation threshold
    };
    
    /**
     * Initialize the vote analysis system
     */
    function initialize() {
        if (!isAnalysisEnabled) {
            log.warn("Vote analysis is disabled in configuration");
            return false;
        }

        if (isInitialized) return true;
        
        log.info("Initializing AI Vote Analysis System");
        
        try {
            // Set up the UI components
            createAnalysisUIElements();
            
            // Initialize data structures
            initializeDataStructures();
            
            // Listen for new votes to analyze
            setupVoteListeners();
            
            isInitialized = true;
            log.info("Vote Analysis System initialized successfully");
            
            // Auto-start monitoring if configured
            if (autoStartMonitoring) {
                setTimeout(() => startMonitoring(), 1000);
            }
            
            return true;
        } catch (error) {
            log.error(error, { context: 'voteAnalysisInit' });
            return false;
        }
    }
    
    /**
     * Initialize data structures for vote analysis
     */
    function initializeDataStructures() {
        // Initialize time-based voting patterns
        const timeSlots = [
            'morning', 'afternoon', 'evening', 'night'
        ];
        
        timeSlots.forEach(slot => {
            votingPatterns.byTime[slot] = {
                count: 0,
                candidates: {},
                velocities: [] // Store historical velocities
            };
        });
        
        // Initialize candidate-based patterns
        const allCandidates = getCandidates();
        allCandidates.forEach(candidate => {
            votingPatterns.byCandidates[candidate] = {
                count: 0,
                timeDistribution: {},
                locationDistribution: {},
                trend: [] // Store historical trend
            };
        });
        
        // Set default location areas
        const defaultLocations = [
            'urban', 'suburban', 'rural', 'remote'
        ];
        
        defaultLocations.forEach(location => {
            votingPatterns.byLocation[location] = {
                count: 0,
                candidates: {},
                density: 0
            };
        });
        
        log.debug("Vote analysis data structures initialized", { 
            candidates: allCandidates.length,
            timeSlots: timeSlots.length,
            locations: defaultLocations.length
        });
    }
    
    /**
     * Set up listeners for vote events
     */
    function setupVoteListeners() {
        // If connected to a blockchain contract
        if (window.contract) {
            try {
                // Listen for vote events
                window.contract.removeAllListeners("Voted");
                window.contract.on("Voted", (voter, candidate, event) => {
                    // Process new vote
                    const voteData = {
                        voter: voter,
                        candidate: candidate,
                        timestamp: new Date(),
                        blockNumber: event.blockNumber,
                        transactionHash: event.transactionHash
                    };
                    
                    // Add location simulation for demo
                    voteData.location = simulateVoterLocation(voter);
                    
                    // Process the vote data
                    processVote(voteData);
                });
                
                log.info("Vote event listeners set up successfully");
            } catch (error) {
                log.error(error, { context: 'voteListenerSetup' });
            }
        } else {
            // If contract isn't available, set up polling for demo
            log.info("Contract not available, setting up demo vote analysis polling");
            
            // Check if we should create mock data in production
            if (isProd && !config?.featureFlags?.allowMockVotesInProduction) {
                log.info("Mock vote generation disabled in production");
                return;
            }
            
            // Create mock votes periodically for demonstration
            setInterval(() => {
                if (monitoringActive && (window.demoMode?.isDemoModeActive() || !isProd)) {
                    createMockVote();
                }
            }, 8000); // Create a mock vote every 8 seconds
        }
    }
    
    /**
     * Process a new vote for analysis
     */
    function processVote(voteData) {
        if (!isAnalysisEnabled || !isInitialized) return;
        
        // Add to vote history
        voteHistory.push(voteData);
        
        // Update voting patterns
        updateTimeBasedPatterns(voteData);
        updateLocationBasedPatterns(voteData);
        updateCandidateDistribution(voteData);
        
        // Detect anomalies
        detectAnomalies(voteData);
        
        // Update the UI
        updateDashboard();
        
        log.debug("Processed vote", {
            candidate: voteData.candidate,
            location: voteData.location,
            voter: voteData.voter.substring(0, 10) + '...'
        });
    }
    
    /**
     * Update time-based voting patterns
     */
    function updateTimeBasedPatterns(voteData) {
        const timeSlot = getTimeSlot(voteData.timestamp);
        const timePattern = votingPatterns.byTime[timeSlot];
        
        // Increment count
        timePattern.count += 1;
        
        // Update candidate distribution
        if (!timePattern.candidates[voteData.candidate]) {
            timePattern.candidates[voteData.candidate] = 0;
        }
        timePattern.candidates[voteData.candidate] += 1;
        
        // Calculate and update velocity (votes per minute in this time slot)
        const recentVotes = voteHistory.filter(vote => 
            getTimeSlot(vote.timestamp) === timeSlot && 
            (new Date() - vote.timestamp) < 10 * 60 * 1000 // Votes in last 10 minutes
        );
        
        if (recentVotes.length > 1) {
            const timeDiffMinutes = (recentVotes[recentVotes.length - 1].timestamp - recentVotes[0].timestamp) / (60 * 1000);
            if (timeDiffMinutes > 0) {
                const velocity = recentVotes.length / timeDiffMinutes;
                timePattern.velocities.push({
                    timestamp: new Date(),
                    value: velocity
                });
                
                // Keep only recent velocity history
                if (timePattern.velocities.length > 20) {
                    timePattern.velocities.shift();
                }
            }
        }
    }
    
    /**
     * Update location-based voting patterns
     */
    function updateLocationBasedPatterns(voteData) {
        if (!voteData.location) return;
        
        const locationPattern = votingPatterns.byLocation[voteData.location];
        if (!locationPattern) {
            // Initialize if this is a new location
            votingPatterns.byLocation[voteData.location] = {
                count: 1,
                candidates: {},
                density: 1
            };
            
            // Initialize candidate count
            votingPatterns.byLocation[voteData.location].candidates[voteData.candidate] = 1;
        } else {
            // Update existing location data
            locationPattern.count += 1;
            
            // Update candidate distribution
            if (!locationPattern.candidates[voteData.candidate]) {
                locationPattern.candidates[voteData.candidate] = 0;
            }
            locationPattern.candidates[voteData.candidate] += 1;
            
            // Update density (votes per location per hour)
            const recentLocationVotes = voteHistory.filter(vote => 
                vote.location === voteData.location && 
                (new Date() - vote.timestamp) < 60 * 60 * 1000 // Votes in last hour
            );
            
            locationPattern.density = recentLocationVotes.length;
        }
        
        // Store voter location for mapping
        geographicData.set(voteData.voter, voteData.location);
    }
    
    /**
     * Update candidate vote distribution
     */
    function updateCandidateDistribution(voteData) {
        const candidatePattern = votingPatterns.byCandidates[voteData.candidate];
        if (!candidatePattern) return;
        
        // Increment count
        candidatePattern.count += 1;
        
        // Update time distribution
        const timeSlot = getTimeSlot(voteData.timestamp);
        if (!candidatePattern.timeDistribution[timeSlot]) {
            candidatePattern.timeDistribution[timeSlot] = 0;
        }
        candidatePattern.timeDistribution[timeSlot] += 1;
        
        // Update location distribution
        if (voteData.location) {
            if (!candidatePattern.locationDistribution[voteData.location]) {
                candidatePattern.locationDistribution[voteData.location] = 0;
            }
            candidatePattern.locationDistribution[voteData.location] += 1;
        }
        
        // Update trend
        candidatePattern.trend.push({
            timestamp: new Date(),
            totalVotes: candidatePattern.count
        });
        
        // Keep only recent trend data
        if (candidatePattern.trend.length > 50) {
            candidatePattern.trend.shift();
        }
    }
    
    /**
     * Detect voting anomalies using AI algorithms
     */
    function detectAnomalies(voteData) {
        if (!config?.featureFlags?.enableAnomalyDetection) {
            return; // Skip anomaly detection if disabled
        }
        
        try {
            // Check for velocity anomalies (sudden spikes in voting rate)
            detectVelocityAnomalies();
            
            // Check for location-based anomalies (unusual concentration of votes)
            detectLocationAnomalies();
            
            // Check for unusual changes in candidate vote distributions
            detectCandidateAnomalies();
            
            // Check for unusual voting patterns specific to this vote
            detectIndividualVoteAnomalies(voteData);
        } catch (error) {
            log.error(error, { context: 'anomalyDetection' });
        }
    }
    
    /**
     * Detect anomalies in voting velocity
     */
    function detectVelocityAnomalies() {
        Object.keys(votingPatterns.byTime).forEach(timeSlot => {
            const pattern = votingPatterns.byTime[timeSlot];
            
            // Need minimum number of data points
            if (pattern.velocities.length < 3) return;
            
            // Calculate mean and standard deviation
            const velocities = pattern.velocities.map(v => v.value);
            const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
            const variance = velocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / velocities.length;
            const stdDev = Math.sqrt(variance);
            
            // Get most recent velocity
            const currentVelocity = velocities[velocities.length - 1];
            
            // Check if current velocity is significantly higher than baseline
            if (currentVelocity > baselineThresholds.voteVelocity && 
                currentVelocity > mean + 2 * stdDev) {
                
                // Create anomaly record
                const anomaly = {
                    type: 'velocity',
                    timeSlot: timeSlot,
                    timestamp: new Date(),
                    expected: mean,
                    actual: currentVelocity,
                    severity: calculateSeverity(currentVelocity, mean, stdDev),
                    description: `Unusual spike in voting rate detected during ${timeSlot} period. Current rate: ${currentVelocity.toFixed(2)} votes/minute (expected around ${mean.toFixed(2)})`
                };
                
                // Only add if it's a new anomaly or significantly different
                if (shouldAddNewAnomaly(anomaly)) {
                    detectedAnomalies.push(anomaly);
                    
                    log.warn("Detected velocity anomaly", {
                        timeSlot,
                        expected: mean.toFixed(2),
                        actual: currentVelocity.toFixed(2),
                        severity: anomaly.severity.toFixed(2)
                    });
                    
                    // Show notification
                    if (anomaly.severity > anomalyDetectionThreshold) {
                        showAnomalyNotification(anomaly);
                    }
                }
            }
        });
    }
    
    /**
     * Detect anomalies in location-based voting
     */
    function detectLocationAnomalies() {
        Object.keys(votingPatterns.byLocation).forEach(location => {
            const pattern = votingPatterns.byLocation[location];
            
            // Check if density exceeds threshold
            if (pattern.density > baselineThresholds.locationDensity) {
                // Check if this is significantly higher than average
                const allDensities = Object.values(votingPatterns.byLocation).map(l => l.density);
                const meanDensity = allDensities.reduce((sum, d) => sum + d, 0) / allDensities.length;
                
                if (pattern.density > meanDensity * 2) {
                    // Create anomaly record
                    const anomaly = {
                        type: 'location',
                        location: location,
                        timestamp: new Date(),
                        expected: meanDensity,
                        actual: pattern.density,
                        severity: calculateSeverity(pattern.density, meanDensity, meanDensity / 2),
                        description: `Unusual concentration of votes detected in ${location} area. Current density: ${pattern.density} votes/hour (average: ${meanDensity.toFixed(2)})`
                    };
                    
                    // Only add if it's a new anomaly or significantly different
                    if (shouldAddNewAnomaly(anomaly)) {
                        detectedAnomalies.push(anomaly);
                        
                        log.warn("Detected location anomaly", {
                            location,
                            expected: meanDensity.toFixed(2),
                            actual: pattern.density,
                            severity: anomaly.severity.toFixed(2)
                        });
                        
                        // Show notification
                        if (anomaly.severity > anomalyDetectionThreshold) {
                            showAnomalyNotification(anomaly);
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Detect anomalies in candidate vote distributions
     */
    function detectCandidateAnomalies() {
        // Get total votes
        const totalVotes = Object.values(votingPatterns.byCandidates).reduce((sum, c) => sum + c.count, 0);
        if (totalVotes < 10) return; // Need minimum votes for analysis
        
        // Calculate expected distribution (equal or based on historical patterns)
        const candidates = Object.keys(votingPatterns.byCandidates);
        const expectedShare = 1 / candidates.length;
        
        candidates.forEach(candidate => {
            const pattern = votingPatterns.byCandidates[candidate];
            
            // Calculate actual share
            const actualShare = pattern.count / totalVotes;
            
            // Check for significant deviation from expected
            if (Math.abs(actualShare - expectedShare) > baselineThresholds.candidateDeviation &&
                pattern.trend.length >= 5) {
                
                // Calculate trend direction
                const recentTrend = pattern.trend.slice(-5);
                const startShare = recentTrend[0].totalVotes / totalVotes;
                const endShare = recentTrend[recentTrend.length - 1].totalVotes / totalVotes;
                const trendDirection = endShare - startShare;
                
                // Only flag rapid changes as anomalies
                if (Math.abs(trendDirection) > 0.05) {
                    const anomaly = {
                        type: 'candidate',
                        candidate: candidate,
                        timestamp: new Date(),
                        expected: expectedShare,
                        actual: actualShare,
                        trendDirection: trendDirection > 0 ? 'increasing' : 'decreasing',
                        severity: calculateSeverity(Math.abs(trendDirection), 0.05, 0.03),
                        description: `Unusual ${trendDirection > 0 ? 'increase' : 'decrease'} detected in votes for ${candidate}. Current share: ${(actualShare * 100).toFixed(1)}% (expected around ${(expectedShare * 100).toFixed(1)}%)`
                    };
                    
                    // Only add if it's a new anomaly or significantly different
                    if (shouldAddNewAnomaly(anomaly)) {
                        detectedAnomalies.push(anomaly);
                        
                        log.warn("Detected candidate distribution anomaly", {
                            candidate,
                            expected: (expectedShare * 100).toFixed(1) + '%',
                            actual: (actualShare * 100).toFixed(1) + '%',
                            trend: trendDirection > 0 ? 'increasing' : 'decreasing',
                            severity: anomaly.severity.toFixed(2)
                        });
                        
                        // Show notification
                        if (anomaly.severity > anomalyDetectionThreshold) {
                            showAnomalyNotification(anomaly);
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Detect anomalies related to individual votes
     */
    function detectIndividualVoteAnomalies(voteData) {
        // Check for unusual voting patterns by this specific voter
        const voterVotes = voteHistory.filter(vote => vote.voter === voteData.voter);
        
        // Check for multiple different candidates from same voter (potential account compromise)
        if (voterVotes.length > 1) {
            const candidates = new Set(voterVotes.map(vote => vote.candidate));
            
            if (candidates.size > 1) {
                const anomaly = {
                    type: 'voter',
                    voter: voteData.voter,
                    timestamp: new Date(),
                    severity: 0.95,
                    description: `Potential security issue: Voter ${shortenAddress(voteData.voter)} has voted for ${candidates.size} different candidates, which may indicate account compromise or improper use`
                };
                
                // Only add if it's a new anomaly
                if (shouldAddNewAnomaly(anomaly)) {
                    detectedAnomalies.push(anomaly);
                    
                    log.warn("Detected voter anomaly", {
                        voter: shortenAddress(voteData.voter),
                        candidateCount: candidates.size,
                        severity: anomaly.severity.toFixed(2)
                    });
                    
                    showAnomalyNotification(anomaly);
                }
            }
        }
        
        // Check for suspicious timing (votes in rapid succession from different locations)
        if (voterVotes.length > 1 && voteData.location) {
            const previousVote = voterVotes[voterVotes.length - 2];
            if (previousVote.location && previousVote.location !== voteData.location) {
                const timeDiff = (voteData.timestamp - previousVote.timestamp) / (60 * 1000); // minutes
                
                if (timeDiff < 10) { // Impossible to physically move between locations
                    const anomaly = {
                        type: 'timing',
                        voter: voteData.voter,
                        timestamp: new Date(),
                        severity: 0.9,
                        description: `Potential fraud detected: Voter ${shortenAddress(voteData.voter)} voted from ${previousVote.location} and then from ${voteData.location} just ${timeDiff.toFixed(1)} minutes apart, which is physically impossible`
                    };
                    
                    // Only add if it's a new anomaly
                    if (shouldAddNewAnomaly(anomaly)) {
                        detectedAnomalies.push(anomaly);
                        
                        log.warn("Detected timing anomaly", {
                            voter: shortenAddress(voteData.voter),
                            location1: previousVote.location,
                            location2: voteData.location,
                            minutesBetween: timeDiff.toFixed(1),
                            severity: anomaly.severity.toFixed(2)
                        });
                        
                        showAnomalyNotification(anomaly);
                    }
                }
            }
        }
    }
    
    /**
     * Check if a new anomaly should be added to avoid duplicates
     */
    function shouldAddNewAnomaly(anomaly) {
        // Don't add if there's a very similar recent anomaly
        const recentSimilarAnomaly = detectedAnomalies.find(a => 
            a.type === anomaly.type &&
            ((a.timeSlot && a.timeSlot === anomaly.timeSlot) ||
             (a.location && a.location === anomaly.location) ||
             (a.candidate && a.candidate === anomaly.candidate) ||
             (a.voter && a.voter === anomaly.voter)) &&
            (new Date() - a.timestamp) < 30 * 60 * 1000 // Within last 30 minutes
        );
        
        return !recentSimilarAnomaly;
    }
    
    /**
     * Calculate severity score for an anomaly (0-1)
     */
    function calculateSeverity(actual, expected, stdDev) {
        if (stdDev === 0) return 0.5;
        
        // Calculate z-score
        const zScore = Math.abs(actual - expected) / stdDev;
        
        // Convert to severity score (0-1)
        return Math.min(1, Math.max(0, zScore / 4));
    }
    
    /**
     * Show a notification for a detected anomaly
     */
    function showAnomalyNotification(anomaly) {
        if (isProd && !config?.featureFlags?.showAnomalyNotifications) {
            log.debug("Anomaly notifications disabled in production");
            return;
        }
        
        // Create the notification element
        const notificationElement = document.createElement('div');
        notificationElement.className = `anomaly-notification severity-${getSeverityClass(anomaly.severity)}`;
        
        // Add icon based on type
        const iconMap = {
            'velocity': '⚡',
            'location': '📍',
            'candidate': '📊',
            'voter': '👤',
            'timing': '⏱️'
        };
        
        notificationElement.innerHTML = `
            <div class="anomaly-header">
                <span class="anomaly-icon">${iconMap[anomaly.type] || '⚠️'}</span>
                <span class="anomaly-type">${capitalizeFirst(anomaly.type)} Anomaly Detected</span>
                <span class="anomaly-close">×</span>
            </div>
            <div class="anomaly-description">
                ${anomaly.description}
            </div>
            <div class="anomaly-timestamp">
                Detected at ${anomaly.timestamp.toLocaleTimeString()}
            </div>
        `;
        
        // Add to notifications container
        const notificationsContainer = document.getElementById('anomalyNotifications');
        if (notificationsContainer) {
            notificationsContainer.appendChild(notificationElement);
            
            // Only keep the last 5 notifications
            while (notificationsContainer.children.length > 5) {
                notificationsContainer.removeChild(notificationsContainer.firstChild);
            }
            
            // Add click handler to close button
            const closeButton = notificationElement.querySelector('.anomaly-close');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    notificationElement.remove();
                });
            }
            
            // Auto-remove after 30 seconds
            setTimeout(() => {
                if (notificationElement.parentNode) {
                    notificationElement.classList.add('fade-out');
                    setTimeout(() => notificationElement.remove(), 500);
                }
            }, 30000);
        }
        
        // Add to anomalies list
        updateAnomaliesList();
    }
    
    /**
     * Update the anomalies list in the UI
     */
    function updateAnomaliesList() {
        const anomaliesListElement = document.getElementById('anomaliesList');
        if (!anomaliesListElement) return;
        
        // Sort anomalies by timestamp (newest first)
        const sortedAnomalies = [...detectedAnomalies].sort((a, b) => b.timestamp - a.timestamp);
        
        // Create HTML for anomalies
        const anomaliesHTML = sortedAnomalies.map(anomaly => `
            <div class="anomaly-item severity-${getSeverityClass(anomaly.severity)}">
                <div class="anomaly-item-header">
                    <span class="anomaly-item-type">${capitalizeFirst(anomaly.type)} Anomaly</span>
                    <span class="anomaly-item-time">${anomaly.timestamp.toLocaleTimeString()}</span>
                </div>
                <div class="anomaly-item-description">
                    ${anomaly.description}
                </div>
                <div class="anomaly-item-severity">
                    Severity: ${(anomaly.severity * 100).toFixed(0)}%
                </div>
            </div>
        `).join('');
        
        // Update the list
        if (anomaliesHTML) {
            anomaliesListElement.innerHTML = anomaliesHTML;
        } else {
            anomaliesListElement.innerHTML = '<div class="no-anomalies">No anomalies detected</div>';
        }
    }
    
    /**
     * Update the analytics dashboard
     */
    function updateDashboard() {
        if (!isAnalysisEnabled || !isInitialized) return;
        
        try {
            updateVoteStatistics();
            updateVoteDistributionCharts();
            updateAnomaliesList();
            updateLocationMap();
        } catch (error) {
            log.error(error, { context: 'updateDashboard' });
        }
    }
    
    /**
     * Update vote statistics display
     */
    function updateVoteStatistics() {
        // Update total votes
        const totalVotesElement = document.getElementById('totalVotes');
        if (totalVotesElement) {
            totalVotesElement.textContent = voteHistory.length;
        }
        
        // Update voting rate
        const votingRateElement = document.getElementById('votingRate');
        if (votingRateElement && voteHistory.length >= 2) {
            // Calculate votes per minute over last 10 votes or all votes if fewer
            const recentVotes = voteHistory.slice(-Math.min(10, voteHistory.length));
            const timeDiffMinutes = (recentVotes[recentVotes.length - 1].timestamp - recentVotes[0].timestamp) / (60 * 1000);
            
            if (timeDiffMinutes > 0) {
                const votesPerMinute = recentVotes.length / timeDiffMinutes;
                votingRateElement.textContent = votesPerMinute.toFixed(2) + ' votes/min';
            } else {
                votingRateElement.textContent = 'Calculating...';
            }
        }
        
        // Update candidate totals
        const candidateTotalsElement = document.getElementById('candidateTotals');
        if (candidateTotalsElement) {
            const candidateCounts = {};
            
            voteHistory.forEach(vote => {
                candidateCounts[vote.candidate] = (candidateCounts[vote.candidate] || 0) + 1;
            });
            
            // Create HTML for candidate totals
            const candidateTotalsHTML = Object.entries(candidateCounts).map(([candidate, count]) => `
                <div class="candidate-stat">
                    <span class="candidate-name">${candidate}</span>
                    <span class="candidate-count">${count}</span>
                    <span class="candidate-percentage">(${((count / voteHistory.length) * 100).toFixed(1)}%)</span>
                </div>
            `).join('');
            
            candidateTotalsElement.innerHTML = candidateTotalsHTML;
        }
        
        // Update time distribution
        const timeDistributionElement = document.getElementById('timeDistribution');
        if (timeDistributionElement) {
            const timeSlots = Object.keys(votingPatterns.byTime);
            
            const timeDistributionHTML = timeSlots.map(timeSlot => {
                const count = votingPatterns.byTime[timeSlot].count;
                const percentage = voteHistory.length ? ((count / voteHistory.length) * 100).toFixed(1) : '0.0';
                
                return `
                    <div class="time-stat">
                        <span class="time-slot">${capitalizeFirst(timeSlot)}</span>
                        <span class="time-count">${count}</span>
                        <span class="time-percentage">(${percentage}%)</span>
                    </div>
                `;
            }).join('');
            
            timeDistributionElement.innerHTML = timeDistributionHTML;
        }
    }
    
    /**
     * Update vote distribution charts
     */
    function updateVoteDistributionCharts() {
        // This would use chart.js or similar in a real implementation
        // For this demo, we'll update simple HTML charts
        
        // Update by candidate
        const candidateChartElement = document.getElementById('candidateChart');
        if (candidateChartElement) {
            const candidates = Object.keys(votingPatterns.byCandidates);
            const totalVotes = Object.values(votingPatterns.byCandidates).reduce((sum, c) => sum + c.count, 0);
            
            if (totalVotes > 0) {
                const candidateChartHTML = candidates.map(candidate => {
                    const count = votingPatterns.byCandidates[candidate].count;
                    const percentage = (count / totalVotes) * 100;
                    
                    return `
                        <div class="chart-row">
                            <span class="chart-label">${candidate}</span>
                            <div class="chart-bar-container">
                                <div class="chart-bar candidate-${candidate.replace(/\s+/g, '').toLowerCase()}" 
                                     style="width: ${percentage}%;">
                                    <span class="chart-value">${count} (${percentage.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                candidateChartElement.innerHTML = candidateChartHTML;
            }
        }
        
        // Update by location
        const locationChartElement = document.getElementById('locationChart');
        if (locationChartElement) {
            const locations = Object.keys(votingPatterns.byLocation);
            const totalLocationVotes = Object.values(votingPatterns.byLocation).reduce((sum, l) => sum + l.count, 0);
            
            if (totalLocationVotes > 0) {
                const locationChartHTML = locations.map(location => {
                    const count = votingPatterns.byLocation[location].count;
                    const percentage = (count / totalLocationVotes) * 100;
                    
                    return `
                        <div class="chart-row">
                            <span class="chart-label">${capitalizeFirst(location)}</span>
                            <div class="chart-bar-container">
                                <div class="chart-bar location-${location}" 
                                     style="width: ${percentage}%;">
                                    <span class="chart-value">${count} (${percentage.toFixed(1)}%)</span>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
                
                locationChartElement.innerHTML = locationChartHTML;
            }
        }
    }
    
    /**
     * Update the location map visualization
     */
    function updateLocationMap() {
        const mapElement = document.getElementById('voteLocationMap');
        if (!mapElement) return;
        
        // In a real implementation, this would update a geographic map
        // For this demo, we'll just update a simple visualization
        
        // Get distribution of votes by location
        const locationCounts = {};
        geographicData.forEach(location => {
            locationCounts[location] = (locationCounts[location] || 0) + 1;
        });
        
        // Create a simple location map visualization
        const mapHTML = `
            <div class="location-map-header">
                <span>Vote Geographic Distribution</span>
                <span class="map-info">${geographicData.size} voters across ${Object.keys(locationCounts).length} regions</span>
            </div>
            <div class="location-map-visualization">
                ${Object.entries(locationCounts).map(([location, count]) => `
                    <div class="location-region ${location}" 
                         style="flex-grow: ${count};" 
                         title="${capitalizeFirst(location)}: ${count} voters">
                        <span class="location-name">${capitalizeFirst(location)}</span>
                        <span class="location-count">${count}</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        mapElement.innerHTML = mapHTML;
    }
    
    /**
     * Get current time slot (morning, afternoon, evening, night)
     */
    function getTimeSlot(timestamp) {
        const hour = timestamp.getHours();
        
        if (hour >= 5 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 17) return 'afternoon';
        if (hour >= 17 && hour < 22) return 'evening';
        return 'night';
    }
    
    /**
     * Get available candidates
     */
    function getCandidates() {
        // Try to get from the select element
        const candidateSelect = document.getElementById('candidateSelect');
        if (candidateSelect) {
            return Array.from(candidateSelect.options).map(option => option.text);
        }
        
        // Fallback to defaults
        return ['Candidate A', 'Candidate B', 'Candidate C'];
    }
    
    /**
     * Simulate a location for a voter based on their address
     */
    function simulateVoterLocation(address) {
        // Use the address to deterministically assign a location
        // This is just for demonstration purposes
        const addressSum = Array.from(address.slice(2)) // Remove 0x prefix
            .reduce((sum, char) => sum + char.charCodeAt(0), 0);
        
        const locations = ['urban', 'suburban', 'rural', 'remote'];
        return locations[addressSum % locations.length];
    }
    
    /**
     * Create a mock vote for demonstration
     */
    function createMockVote() {
        if (isProd && !config?.featureFlags?.allowMockVotesInProduction) {
            log.warn("Attempted to create mock vote in production where it's disabled");
            return null;
        }
        
        // Generate a random address
        const address = "0x" + Array(40).fill(0).map(() => 
            "0123456789abcdef"[Math.floor(Math.random() * 16)]
        ).join('');
        
        // Get random candidate
        const candidates = getCandidates();
        const candidate = candidates[Math.floor(Math.random() * candidates.length)];
        
        // Create mock vote data
        const voteData = {
            voter: address,
            candidate: candidate,
            timestamp: new Date(),
            blockNumber: Math.floor(Math.random() * 1000000),
            transactionHash: "0x" + Array(64).fill(0).map(() => 
                "0123456789abcdef"[Math.floor(Math.random() * 16)]
            ).join(''),
            location: simulateVoterLocation(address)
        };
        
        // Process the vote
        processVote(voteData);
        
        log.debug("Created mock vote", { 
            candidate: voteData.candidate,
            location: voteData.location 
        });
        
        return voteData;
    }
    
    /**
     * Start real-time monitoring
     */
    function startMonitoring() {
        if (!isAnalysisEnabled) {
            log.warn("Attempted to start monitoring but vote analysis is disabled");
            return false;
        }
        
        if (monitoringActive) return true;
        
        log.info("Starting real-time vote monitoring");
        monitoringActive = true;
        
        // Update UI to show active monitoring
        const monitoringStatusElement = document.getElementById('monitoringStatus');
        if (monitoringStatusElement) {
            monitoringStatusElement.className = 'monitoring-active';
            monitoringStatusElement.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-text">Monitoring Active</span>
            `;
        }
        
        // Enable auto-refresh
        startAutoRefresh();
        
        // Create initial mock votes for demo purposes
        if ((!window.contract && !isProd) || 
            (isProd && config?.featureFlags?.allowMockVotesInProduction)) {
            for (let i = 0; i < 10; i++) {
                createMockVote();
            }
        }
        
        return true;
    }
    
    /**
     * Stop real-time monitoring
     */
    function stopMonitoring() {
        if (!monitoringActive) return false;
        
        log.info("Stopping real-time vote monitoring");
        monitoringActive = false;
        
        // Update UI to show inactive monitoring
        const monitoringStatusElement = document.getElementById('monitoringStatus');
        if (monitoringStatusElement) {
            monitoringStatusElement.className = 'monitoring-inactive';
            monitoringStatusElement.innerHTML = `
                <span class="status-dot"></span>
                <span class="status-text">Monitoring Inactive</span>
            `;
        }
        
        // Disable auto-refresh
        stopAutoRefresh();
        
        return true;
    }
    
    /**
     * Start auto-refresh of dashboard
     */
    function startAutoRefresh() {
        stopAutoRefresh(); // Clear any existing interval
        
        window.voteAnalysisRefreshInterval = setInterval(() => {
            if (monitoringActive) {
                updateDashboard();
            }
        }, refreshInterval * 1000);
        
        log.debug("Started auto-refresh", { intervalSeconds: refreshInterval });
    }
    
    /**
     * Stop auto-refresh of dashboard
     */
    function stopAutoRefresh() {
        if (window.voteAnalysisRefreshInterval) {
            clearInterval(window.voteAnalysisRefreshInterval);
            window.voteAnalysisRefreshInterval = null;
            log.debug("Stopped auto-refresh");
        }
    }
    
    /**
     * Set anomaly detection threshold
     */
    function setAnomalyThreshold(threshold) {
        if (!isAnalysisEnabled) return false;
        
        const newThreshold = Math.max(0, Math.min(1, threshold));
        log.info("Setting anomaly detection threshold", { 
            previous: anomalyDetectionThreshold, 
            new: newThreshold 
        });
        
        // In production, this change may be stored in configuration
        if (isProd && config?.storeUserSettings) {
            try {
                config.storeUserSettings('anomalyThreshold', newThreshold);
            } catch (error) {
                log.error(error, { context: 'storeSettings' });
            }
        }
        
        return true;
    }
    
    /**
     * Set refresh interval
     */
    function setRefreshInterval(seconds) {
        if (!isAnalysisEnabled) return false;
        
        const newInterval = Math.max(5, seconds);
        log.info("Setting dashboard refresh interval", { 
            previous: refreshInterval, 
            new: newInterval 
        });
        
        // Restart auto-refresh with new interval if active
        if (monitoringActive) {
            stopAutoRefresh();
            startAutoRefresh();
        }
        
        // In production, this change may be stored in configuration
        if (isProd && config?.storeUserSettings) {
            try {
                config.storeUserSettings('refreshInterval', newInterval);
            } catch (error) {
                log.error(error, { context: 'storeSettings' });
            }
        }
        
        return true;
    }
    
    /**
     * Generate a vote analysis report
     */
    function generateAnalysisReport() {
        if (!isAnalysisEnabled) {
            log.warn("Attempted to generate report but vote analysis is disabled");
            return null;
        }
        
        const report = {
            totalVotes: voteHistory.length,
            candidateDistribution: Object.fromEntries(Object.entries(votingPatterns.byCandidates).map(
                ([candidate, pattern]) => [candidate, pattern.count]
            )),
            timeDistribution: Object.fromEntries(Object.entries(votingPatterns.byTime).map(
                ([timeSlot, pattern]) => [timeSlot, pattern.count]
            )),
            locationDistribution: Object.fromEntries(Object.entries(votingPatterns.byLocation).map(
                ([location, pattern]) => [location, pattern.count]
            )),
            detectedAnomalies: detectedAnomalies.length,
            highSeverityAnomalies: detectedAnomalies.filter(a => a.severity > 0.8).length,
            generatedAt: new Date().toISOString(),
            environment: isProd ? "production" : "development"
        };
        
        log.info("Generated vote analysis report", { 
            totalVotes: report.totalVotes,
            anomalies: report.detectedAnomalies
        });
        
        return report;
    }
    
    /**
     * Create the UI elements for vote analysis
     */
    function createAnalysisUIElements() {
        // Skip UI creation if disabled in configuration
        if (isProd && !config?.featureFlags?.showVoteAnalysisUI) {
            log.info("Vote analysis UI disabled in production configuration");
            return;
        }
        
        // Create the analysis dashboard section
        const dashboardSection = document.createElement('div');
        dashboardSection.id = 'voteAnalysisDashboard';
        dashboardSection.className = 'vote-analysis-dashboard';
        
        // Create dashboard content
        dashboardSection.innerHTML = `
            <h3>Vote Analysis & Monitoring</h3>
            
            <div class="dashboard-controls">
                <div class="monitoring-control">
                    <span>Real-time Monitoring:</span>
                    <div id="monitoringStatus" class="monitoring-inactive">
                        <span class="status-dot"></span>
                        <span class="status-text">Monitoring Inactive</span>
                    </div>
                    <button id="toggleMonitoringButton" class="toggle-monitoring">Start Monitoring</button>
                </div>
                
                <div class="dashboard-settings">
                    <button id="dashboardSettingsButton" class="settings-button">⚙️ Settings</button>
                    <div id="settingsPanel" class="settings-panel" style="display: none;">
                        <div class="setting-item">
                            <label for="anomalyThreshold">Anomaly Detection Threshold:</label>
                            <input type="range" id="anomalyThreshold" min="0" max="1" step="0.05" value="${anomalyDetectionThreshold}">
                            <span class="setting-value">${anomalyDetectionThreshold}</span>
                        </div>
                        <div class="setting-item">
                            <label for="refreshInterval">Refresh Interval (seconds):</label>
                            <input type="number" id="refreshInterval" min="5" max="300" value="${refreshInterval}">
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="dashboard-grid">
                <div class="dashboard-card vote-statistics">
                    <h4>Vote Statistics</h4>
                    <div class="stat-grid">
                        <div class="stat-item">
                            <span class="stat-label">Total Votes:</span>
                            <span id="totalVotes" class="stat-value">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Current Rate:</span>
                            <span id="votingRate" class="stat-value">0 votes/min</span>
                        </div>
                    </div>
                    
                    <h5>By Candidate</h5>
                    <div id="candidateTotals" class="stat-list">
                        <div class="no-data">No votes recorded</div>
                    </div>
                    
                    <h5>By Time of Day</h5>
                    <div id="timeDistribution" class="stat-list">
                        <div class="no-data">No votes recorded</div>
                    </div>
                </div>
                
                <div class="dashboard-card vote-charts">
                    <h4>Vote Distribution</h4>
                    <h5>By Candidate</h5>
                    <div id="candidateChart" class="chart-container">
                        <div class="no-data">No votes recorded</div>
                    </div>
                    
                    <h5>By Location</h5>
                    <div id="locationChart" class="chart-container">
                        <div class="no-data">No votes recorded</div>
                    </div>
                </div>
                
                <div class="dashboard-card vote-map">
                    <h4>Geographic Distribution</h4>
                    <div id="voteLocationMap" class="location-map">
                        <div class="no-data">No location data available</div>
                    </div>
                </div>
                
                <div class="dashboard-card anomalies-panel">
                    <h4>Detected Anomalies</h4>
                    <div id="anomaliesList" class="anomalies-list">
                        <div class="no-anomalies">No anomalies detected</div>
                    </div>
                </div>
            </div>
            
            <div id="anomalyNotifications" class="anomaly-notifications"></div>
        `;
        
        // Add to the page
        const votingResultsSection = document.querySelector('.voting-results') || 
                                    document.getElementById('votingResults');
        
        if (votingResultsSection) {
            votingResultsSection.parentNode.insertBefore(dashboardSection, votingResultsSection.nextSibling);
        } else {
            // Fallback: add to the main container
            const mainContainer = document.querySelector('main') || document.querySelector('body');
            mainContainer.appendChild(dashboardSection);
        }
        
        // Add event listeners
        document.getElementById('toggleMonitoringButton').addEventListener('click', function() {
            if (monitoringActive) {
                stopMonitoring();
                this.textContent = 'Start Monitoring';
            } else {
                startMonitoring();
                this.textContent = 'Stop Monitoring';
            }
        });
        
        document.getElementById('dashboardSettingsButton').addEventListener('click', function() {
            const settingsPanel = document.getElementById('settingsPanel');
            if (settingsPanel.style.display === 'none') {
                settingsPanel.style.display = 'block';
            } else {
                settingsPanel.style.display = 'none';
            }
        });
        
        document.getElementById('anomalyThreshold').addEventListener('input', function() {
            setAnomalyThreshold(parseFloat(this.value));
            document.querySelector('#anomalyThreshold + .setting-value').textContent = this.value;
        });
        
        document.getElementById('refreshInterval').addEventListener('change', function() {
            setRefreshInterval(parseInt(this.value, 10));
        });
        
        // Add dashboard styles
        addDashboardStyles();
        
        log.debug("Created vote analysis UI elements");
    }
    
    /**
     * Add CSS styles for the dashboard
     */
    function addDashboardStyles() {
        // Skip if styles already added
        if (document.getElementById('voteAnalysisStyles')) return;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'voteAnalysisStyles';
        styleElement.textContent = `
            .vote-analysis-dashboard {
                margin-top: 30px;
                padding: 20px;
                background-color: #f9f9f9;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .vote-analysis-dashboard h3 {
                margin-top: 0;
                margin-bottom: 20px;
                color: #333;
                border-bottom: 2px solid #e0e0e0;
                padding-bottom: 10px;
            }
            
            .dashboard-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .monitoring-control {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .monitoring-active, .monitoring-inactive {
                display: flex;
                align-items: center;
                padding: 5px 10px;
                border-radius: 15px;
                font-size: 14px;
            }
            
            .monitoring-active {
                background-color: #e6f7e6;
                color: #2e7d32;
            }
            
            .monitoring-inactive {
                background-color: #f5f5f5;
                color: #757575;
            }
            
            .status-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                margin-right: 5px;
            }
            
            .monitoring-active .status-dot {
                background-color: #2e7d32;
                animation: pulse 2s infinite;
            }
            
            .monitoring-inactive .status-dot {
                background-color: #bdbdbd;
            }
            
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
            }
            
            .toggle-monitoring {
                padding: 5px 10px;
                background-color: #3f51b5;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .settings-button {
                padding: 5px 10px;
                background-color: #f5f5f5;
                border: 1px solid #ddd;
                border-radius: 4px;
                cursor: pointer;
            }
            
            .settings-panel {
                position: absolute;
                right: 20px;
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                padding: 15px;
                z-index: 100;
                min-width: 250px;
            }
            
            .setting-item {
                margin-bottom: 10px;
            }
            
            .setting-item label {
                display: block;
                margin-bottom: 5px;
            }
            
            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }
            
            .dashboard-card {
                background-color: white;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            
            .dashboard-card h4 {
                margin-top: 0;
                margin-bottom: 15px;
                color: #333;
                font-size: 16px;
            }
            
            .dashboard-card h5 {
                margin-top: 15px;
                margin-bottom: 10px;
                color: #555;
                font-size: 14px;
            }
            
            .stat-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin-bottom: 15px;
            }
            
            .stat-item {
                display: flex;
                flex-direction: column;
            }
            
            .stat-label {
                font-size: 12px;
                color: #757575;
            }
            
            .stat-value {
                font-size: 18px;
                font-weight: bold;
                color: #333;
            }
            
            .stat-list {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .candidate-stat, .time-stat {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px dashed #eee;
            }
            
            .candidate-percentage, .time-percentage {
                color: #757575;
                font-size: 14px;
            }
            
            .chart-container {
                margin-top: 10px;
            }
            
            .chart-row {
                margin-bottom: 10px;
            }
            
            .chart-label {
                display: block;
                margin-bottom: 5px;
                font-size: 14px;
            }
            
            .chart-bar-container {
                height: 25px;
                background-color: #f5f5f5;
                border-radius: 4px;
                overflow: hidden;
            }
            
            .chart-bar {
                height: 100%;
                display: flex;
                align-items: center;
                color: white;
                padding: 0 10px;
                font-size: 12px;
                transition: width 0.3s ease;
            }
            
            .candidate-candidatea {
                background-color: #3f51b5;
            }
            
            .candidate-candidateb {
                background-color: #f44336;
            }
            
            .candidate-candidatec {
                background-color: #4caf50;
            }
            
            .location-urban {
                background-color: #3f51b5;
            }
            
            .location-suburban {
                background-color: #009688;
            }
            
            .location-rural {
                background-color: #ff9800;
            }
            
            .location-remote {
                background-color: #9c27b0;
            }
            
            .chart-value {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .location-map {
                min-height: 200px;
                display: flex;
                flex-direction: column;
            }
            
            .location-map-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            .map-info {
                color: #757575;
                font-size: 12px;
            }
            
            .location-map-visualization {
                display: flex;
                height: 150px;
                gap: 2px;
                overflow: hidden;
                border-radius: 8px;
            }
            
            .location-region {
                display: flex;
                flex-direction: column;
                justify-content: flex-end;
                align-items: center;
                color: white;
                padding: 10px;
                text-align: center;
                min-width: 60px;
            }
            
            .location-name {
                font-size: 12px;
                margin-bottom: 5px;
            }
            
            .location-count {
                font-size: 16px;
                font-weight: bold;
            }
            
            .anomalies-panel {
                grid-column: span 2;
            }
            
            .anomalies-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .anomaly-item {
                padding: 12px;
                border-radius: 6px;
                border-left: 4px solid;
                background-color: #f9f9f9;
            }
            
            .anomaly-item.severity-high {
                border-color: #f44336;
                background-color: #ffebee;
            }
            
            .anomaly-item.severity-medium {
                border-color: #ff9800;
                background-color: #fff3e0;
            }
            
            .anomaly-item.severity-low {
                border-color: #2196f3;
                background-color: #e3f2fd;
            }
            
            .anomaly-item-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
            }
            
            .anomaly-item-type {
                font-weight: bold;
                color: #333;
            }
            
            .anomaly-item-time {
                font-size: 12px;
                color: #757575;
            }
            
            .anomaly-item-description {
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .anomaly-item-severity {
                font-size: 12px;
                font-weight: bold;
            }
            
            .no-data, .no-anomalies {
                color: #757575;
                font-style: italic;
                text-align: center;
                padding: 20px 0;
            }
            
            .anomaly-notifications {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 350px;
            }
            
            .anomaly-notification {
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 3px 15px rgba(0,0,0,0.2);
                padding: 15px;
                animation: slide-in 0.3s ease;
                border-left: 4px solid;
            }
            
            .anomaly-notification.fade-out {
                animation: fade-out 0.5s ease;
            }
            
            .anomaly-notification.severity-high {
                border-color: #f44336;
            }
            
            .anomaly-notification.severity-medium {
                border-color: #ff9800;
            }
            
            .anomaly-notification.severity-low {
                border-color: #2196f3;
            }
            
            .anomaly-header {
                display: flex;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .anomaly-icon {
                margin-right: 8px;
                font-size: 18px;
            }
            
            .anomaly-type {
                flex: 1;
                font-weight: bold;
            }
            
            .anomaly-close {
                cursor: pointer;
                font-size: 18px;
                color: #aaa;
            }
            
            .anomaly-close:hover {
                color: #333;
            }
            
            .anomaly-description {
                margin-bottom: 8px;
                font-size: 14px;
            }
            
            .anomaly-timestamp {
                font-size: 12px;
                color: #757575;
            }
            
            @keyframes slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes fade-out {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            @media (max-width: 768px) {
                .dashboard-grid {
                    grid-template-columns: 1fr;
                }
                
                .anomalies-panel {
                    grid-column: span 1;
                }
            }
        `;
        
        document.head.appendChild(styleElement);
    }
    
    /**
     * Helper function to get severity class
     */
    function getSeverityClass(severity) {
        if (severity >= 0.8) return 'high';
        if (severity >= 0.5) return 'medium';
        return 'low';
    }
    
    /**
     * Helper function to capitalize first letter
     */
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    /**
     * Helper function to shorten addresses
     */
    function shortenAddress(address) {
        if (!address) return '';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }
    
    // Public API
    return {
        initialize,
        startMonitoring,
        stopMonitoring,
        setAnomalyThreshold,
        setRefreshInterval,
        generateAnalysisReport,
        getDetectedAnomalies: () => isAnalysisEnabled ? [...detectedAnomalies] : [],
        getVotingPatterns: () => isAnalysisEnabled ? JSON.parse(JSON.stringify(votingPatterns)) : {},
        isEnabled: () => isAnalysisEnabled,
        isMonitoring: () => monitoringActive
    };
})();

// Initialize the vote analysis system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize vote analysis system
    if (window.voteAnalysis.isEnabled()) {
        window.voteAnalysis.initialize();
        
        // Automatically start monitoring if in demo mode
        if (window.demoMode && window.demoMode.isDemoModeActive()) {
            setTimeout(() => {
                window.voteAnalysis.startMonitoring();
            }, 1000);
        }
    } else {
        log.info("Vote analysis system is disabled in current configuration");
    }
});