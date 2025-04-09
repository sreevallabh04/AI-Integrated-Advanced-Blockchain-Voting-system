/**
 * AI-Powered Predictive Analytics for Voter Engagement
 * 
 * This module uses AI to analyze historical voting data and demographic information
 * to develop predictive models that identify patterns in voter engagement. These insights
 * help electoral authorities tailor outreach efforts to increase voter participation.
 */

// Initialize from production configuration if available
const config = window.productionConfig || {};
const log = config?.log || console;
const isProd = config?.isProd || false;

// Feature flags
const isAnalyticsEnabled = config?.featureFlags?.enablePredictiveAnalytics !== false;
const allowMockDataInProd = config?.featureFlags?.allowMockDataInProduction || false;

// Module configuration with defaults
const analyticsConfig = {
    renderUI: config?.predictiveAnalytics?.renderUI !== false,
    confidenceThreshold: config?.predictiveAnalytics?.confidenceThreshold || 0.7,
    historicalDataSource: config?.predictiveAnalytics?.historicalDataSource || 'mock',
    dashboardPosition: config?.predictiveAnalytics?.dashboardPosition || 'afterVotingResults'
};

log.info("Loading AI Predictive Analytics module", { 
    enabled: isAnalyticsEnabled,
    environment: isProd ? "production" : "development",
    uiEnabled: analyticsConfig.renderUI
});

// Main namespace for predictive analytics
window.predictiveAnalytics = (function() {
    // Private variables
    let isInitialized = false;
    
    // Store historical voting data
    const historicalData = {
        participationRates: {},
        demographicTrends: {},
        engagementFactors: {},
        outreachCampaigns: []
    };
    
    // Predictive models
    const models = {
        participationPrediction: null,
        demographicSegmentation: null,
        engagementFactorAnalysis: null,
        outreachEffectiveness: null
    };
    
    // Demographic categories for analysis
    const demographics = {
        ageGroups: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+'],
        locations: ['urban', 'suburban', 'rural', 'remote'],
        engagementLevels: ['high', 'medium', 'low', 'inactive'],
        votingHistory: ['consistent', 'occasional', 'rare', 'new']
    };
    
    /**
     * Initialize the predictive analytics system
     */
    async function initialize() {
        // Skip initialization if the feature is disabled
        if (!isAnalyticsEnabled) {
            log.info("Predictive Analytics is disabled via configuration");
            return false;
        }
        
        if (isInitialized) {
            log.debug("Predictive Analytics already initialized");
            return true;
        }
        
        log.info("Initializing AI Predictive Analytics System");
        
        try {
            // Set up UI elements if enabled
            if (analyticsConfig.renderUI) {
                createAnalyticsUIElements();
            }
            
            // Load historical data
            await loadHistoricalData();
            
            // Train predictive models
            trainPredictiveModels();
            
            // Initial UI update if UI is enabled
            if (analyticsConfig.renderUI) {
                updatePredictiveAnalyticsUI();
            }
            
            isInitialized = true;
            log.info("Predictive Analytics System initialized successfully");
            
            // Dispatch event for other components
            try {
                document.dispatchEvent(new CustomEvent('predictiveAnalyticsReady'));
            } catch (eventError) {
                log.error(eventError, { context: 'dispatchReadyEvent' });
            }
            
            return true;
        } catch (error) {
            log.error(error, { context: 'predictiveAnalyticsInitialization' });
            
            // Show error in UI if enabled
            if (analyticsConfig.renderUI) {
                showInitializationError();
            }
            
            return false;
        }
    }
    
    /**
     * Load historical voting data from the specified source
     */
    async function loadHistoricalData() {
        log.debug("Loading historical data from source:", analyticsConfig.historicalDataSource);
        
        try {
            // In production, try to use real data source if available
            if (isProd && config?.dataServices?.getHistoricalVotingData && !allowMockDataInProd) {
                log.info("Loading real historical voting data");
                
                try {
                    const realData = await config.dataServices.getHistoricalVotingData();
                    
                    // Validate the data structure
                    if (validateHistoricalData(realData)) {
                        // Copy data to our local structure
                        Object.assign(historicalData, realData);
                        log.info("Successfully loaded real historical data");
                        return true;
                    } else {
                        log.warn("Real historical data failed validation, falling back to mock data");
                    }
                } catch (dataError) {
                    log.error(dataError, { context: 'loadRealHistoricalData' });
                    log.warn("Failed to load real historical data, falling back to mock data");
                }
            }
            
            // Check if we should block mock data in production
            if (isProd && !allowMockDataInProd && analyticsConfig.historicalDataSource === 'mock') {
                log.warn("Mock data not allowed in production without explicit configuration");
                throw new Error("Mock data not allowed in production environment");
            }
            
            // If we're here, either we're in development, mock data is allowed in production,
            // or real data loading failed
            log.info(`Using ${isProd ? 'mock data in production (allowed by config)' : 'mock data in development'}`);
            
            // Generate sample data
            generateSampleData();
            
            return true;
        } catch (error) {
            log.error(error, { context: 'loadHistoricalData' });
            throw new Error(`Failed to load historical voting data: ${error.message}`);
        }
    }
    
    /**
     * Validate the structure of historical data
     */
    function validateHistoricalData(data) {
        if (!data || typeof data !== 'object') return false;
        
        // Check main sections exist
        const requiredSections = ['participationRates', 'demographicTrends', 'engagementFactors', 'outreachCampaigns'];
        for (const section of requiredSections) {
            if (!data[section]) return false;
        }
        
        // Specific validation could be added here
        
        return true;
    }
    
    /**
     * Generate sample historical voting data for demonstration
     */
    function generateSampleData() {
        log.debug("Generating sample historical data for predictive models");
        
        // Generate participation rates over time
        const years = [2010, 2012, 2014, 2016, 2018, 2020, 2022];
        years.forEach(year => {
            historicalData.participationRates[year] = {
                overall: 35 + Math.random() * 30, // 35-65% participation
                byDemographic: {}
            };
            
            // Generate demographic-specific participation rates
            demographics.ageGroups.forEach(age => {
                let baseRate = 0;
                
                // Young voters typically have lower turnout
                if (age === '18-24') baseRate = 25 + Math.random() * 15;
                else if (age === '25-34') baseRate = 30 + Math.random() * 20;
                else if (age === '35-44') baseRate = 40 + Math.random() * 20;
                else if (age === '45-54') baseRate = 45 + Math.random() * 25;
                else if (age === '55-64') baseRate = 55 + Math.random() * 25;
                else if (age === '65+') baseRate = 60 + Math.random() * 25;
                
                // Presidential elections typically have higher turnout
                if (year % 4 === 0) baseRate += 10;
                
                // Add some yearly variance
                const finalRate = Math.min(95, baseRate + (Math.random() * 10 - 5));
                
                if (!historicalData.participationRates[year].byDemographic[age]) {
                    historicalData.participationRates[year].byDemographic[age] = {};
                }
                historicalData.participationRates[year].byDemographic[age].rate = finalRate;
            });
            
            // Location-specific participation rates
            demographics.locations.forEach(location => {
                let baseRate = 0;
                
                if (location === 'urban') baseRate = 40 + Math.random() * 25;
                else if (location === 'suburban') baseRate = 50 + Math.random() * 25;
                else if (location === 'rural') baseRate = 45 + Math.random() * 25;
                else if (location === 'remote') baseRate = 35 + Math.random() * 25;
                
                // Presidential elections typically have higher turnout
                if (year % 4 === 0) baseRate += 10;
                
                // Add some yearly variance
                const finalRate = Math.min(95, baseRate + (Math.random() * 10 - 5));
                
                if (!historicalData.participationRates[year].byDemographic[location]) {
                    historicalData.participationRates[year].byDemographic[location] = {};
                }
                historicalData.participationRates[year].byDemographic[location].rate = finalRate;
            });
        });
        
        // Generate demographic trends
        demographics.ageGroups.forEach(age => {
            historicalData.demographicTrends[age] = {
                growthRate: (age === '65+' || age === '55-64') ? 2.5 + Math.random() * 1.5 : 0.5 + Math.random() * 1.5,
                participationTrend: Math.random() > 0.5 ? 'increasing' : 'stable',
                votingIssues: generateRandomVotingIssues(age)
            };
        });
        
        demographics.locations.forEach(location => {
            historicalData.demographicTrends[location] = {
                populationShift: location === 'urban' || location === 'suburban' ? 1.5 + Math.random() * 2 : -0.5 - Math.random() * 1.5,
                participationTrend: location === 'remote' ? 'decreasing' : 'increasing',
                votingIssues: generateRandomVotingIssues(location)
            };
        });
        
        // Generate engagement factors
        historicalData.engagementFactors = {
            highImpact: [
                {factor: 'Convenient voting locations', impact: 8.2 + Math.random()},
                {factor: 'Early voting options', impact: 7.8 + Math.random()},
                {factor: 'Mail-in ballot access', impact: 8.5 + Math.random()},
                {factor: 'Candidate engagement with community', impact: 7.5 + Math.random()},
                {factor: 'Clear information about registration', impact: 8.0 + Math.random()}
            ],
            mediumImpact: [
                {factor: 'Weather on election day', impact: 5.2 + Math.random()},
                {factor: 'Reminders via social media', impact: 6.3 + Math.random()},
                {factor: 'Public transportation to polls', impact: 6.8 + Math.random()},
                {factor: 'Workplace flexibility for voting', impact: 6.5 + Math.random()}
            ],
            lowImpact: [
                {factor: 'Celebrity endorsements', impact: 3.2 + Math.random()},
                {factor: 'General get-out-the-vote advertising', impact: 4.1 + Math.random()},
                {factor: 'Gamification of voting process', impact: 3.8 + Math.random()}
            ]
        };
        
        // Generate sample outreach campaigns and their effectiveness
        historicalData.outreachCampaigns = [
            {
                name: 'Youth Voter Registration Drive',
                targetDemographic: '18-24',
                year: 2020,
                method: 'Campus events and social media',
                cost: 'Medium',
                effectiveness: 6.8,
                participationLift: 4.2
            },
            {
                name: 'Senior Transportation Program',
                targetDemographic: '65+',
                year: 2020,
                method: 'Free rides to polling stations',
                cost: 'Medium',
                effectiveness: 8.9,
                participationLift: 7.3
            },
            {
                name: 'Rural Voter Information Campaign',
                targetDemographic: 'rural',
                year: 2018,
                method: 'Direct mail and radio ads',
                cost: 'High',
                effectiveness: 5.4,
                participationLift: 3.1
            },
            {
                name: 'Urban Digital Engagement',
                targetDemographic: 'urban',
                year: 2020,
                method: 'Targeted social media and text messages',
                cost: 'Low',
                effectiveness: 7.2,
                participationLift: 5.8
            },
            {
                name: 'First-Time Voter Education',
                targetDemographic: 'new',
                year: 2022,
                method: 'Educational videos and registration assistance',
                cost: 'Medium',
                effectiveness: 8.5,
                participationLift: 6.9
            }
        ];
    }
    
    /**
     * Generate random voting issues for demographic groups
     */
    function generateRandomVotingIssues(demographic) {
        const allIssues = [
            'Transportation access',
            'Registration complexity',
            'Work schedule conflicts',
            'Childcare needs',
            'Lack of information',
            'Accessibility challenges',
            'Voter ID requirements',
            'Language barriers',
            'Polling station distance',
            'Digital literacy',
            'Political disengagement',
            'Distrust in electoral system'
        ];
        
        // Select 2-4 random issues
        const issueCount = 2 + Math.floor(Math.random() * 3);
        const selectedIssues = [];
        
        // Add demographic-specific issues first
        if (demographic === '18-24') {
            selectedIssues.push('Registration complexity', 'Political disengagement');
        } else if (demographic === '65+') {
            selectedIssues.push('Transportation access', 'Digital literacy');
        } else if (demographic === 'rural' || demographic === 'remote') {
            selectedIssues.push('Polling station distance', 'Transportation access');
        } else if (demographic === 'urban') {
            selectedIssues.push('Work schedule conflicts', 'Polling station wait times');
        }
        
        // Add random issues to reach desired count
        while (selectedIssues.length < issueCount) {
            const randomIssue = allIssues[Math.floor(Math.random() * allIssues.length)];
            if (!selectedIssues.includes(randomIssue)) {
                selectedIssues.push(randomIssue);
            }
        }
        
        return selectedIssues;
    }
    
    /**
     * Train predictive models using the historical data
     */
    function trainPredictiveModels() {
        log.info("Training AI predictive models");
        
        try {
            // In a real production implementation, this would use actual machine learning models
            // For this demo, we'll simulate model training with deterministic rules
            
            // In production with a real AI service
            if (isProd && config?.aiModelService?.trainPredictiveModels) {
                try {
                    const trainedModels = config.aiModelService.trainPredictiveModels(historicalData);
                    if (trainedModels && validateModels(trainedModels)) {
                        Object.assign(models, trainedModels);
                        log.info("Successfully trained models using AI service");
                        return true;
                    } else {
                        log.warn("AI service models failed validation, falling back to simulated models");
                    }
                } catch (modelError) {
                    log.error(modelError, { context: 'aiModelService' });
                    log.warn("Failed to train models with AI service, falling back to simulated models");
                }
            }
            
            // Participation prediction model
            models.participationPrediction = {
                baselineParticipation: calculateBaseline(historicalData.participationRates),
                demographicMultipliers: calculateDemographicMultipliers(),
                issueImpacts: calculateIssueImpacts(),
                predict: predictParticipation
            };
            
            // Demographic segmentation model
            models.demographicSegmentation = {
                segments: generateDemographicSegments(),
                recommendationsForSegments: generateRecommendations()
            };
            
            // Engagement factor analysis model
            models.engagementFactorAnalysis = {
                rankedFactors: rankEngagementFactors(),
                demographicFactorMatrix: createDemographicFactorMatrix()
            };
            
            // Outreach effectiveness model
            models.outreachEffectiveness = {
                campaignEffectiveness: analyzeOutreachEffectiveness(),
                recommendOptimalStrategies: recommendOutreachStrategies
            };
            
            log.info("AI predictive models trained successfully");
            return true;
        } catch (error) {
            log.error(error, { context: 'trainPredictiveModels' });
            throw new Error(`Failed to train predictive models: ${error.message}`);
        }
    }
    
    /**
     * Validate trained models 
     */
    function validateModels(models) {
        if (!models || typeof models !== 'object') return false;
        
        // Check required models exist
        const requiredModels = [
            'participationPrediction', 
            'demographicSegmentation', 
            'engagementFactorAnalysis', 
            'outreachEffectiveness'
        ];
        
        for (const model of requiredModels) {
            if (!models[model]) return false;
        }
        
        // Could add more specific validation here
        
        return true;
    }
    
    /**
     * Calculate baseline participation from historical data
     */
    function calculateBaseline(participationData) {
        const years = Object.keys(participationData);
        if (years.length === 0) return 50; // Default if no data
        
        // Calculate weighted average, with more recent years weighted more heavily
        let totalWeight = 0;
        let weightedSum = 0;
        
        years.forEach((year, index) => {
            const weight = index + 1; // More recent years get higher weights
            weightedSum += participationData[year].overall * weight;
            totalWeight += weight;
        });
        
        return weightedSum / totalWeight;
    }
    
    /**
     * Calculate demographic multipliers for participation prediction
     */
    function calculateDemographicMultipliers() {
        const multipliers = {};
        
        // Process age groups
        demographics.ageGroups.forEach(age => {
            let multiplier = 1.0;
            
            // Young voters tend to participate less
            if (age === '18-24') multiplier = 0.7;
            else if (age === '25-34') multiplier = 0.85;
            else if (age === '35-44') multiplier = 0.95;
            else if (age === '45-54') multiplier = 1.1;
            else if (age === '55-64') multiplier = 1.2;
            else if (age === '65+') multiplier = 1.3;
            
            multipliers[age] = multiplier;
        });
        
        // Process locations
        demographics.locations.forEach(location => {
            let multiplier = 1.0;
            
            if (location === 'urban') multiplier = 1.05;
            else if (location === 'suburban') multiplier = 1.15;
            else if (location === 'rural') multiplier = 0.95;
            else if (location === 'remote') multiplier = 0.85;
            
            multipliers[location] = multiplier;
        });
        
        // Process engagement levels
        demographics.engagementLevels.forEach(level => {
            let multiplier = 1.0;
            
            if (level === 'high') multiplier = 1.5;
            else if (level === 'medium') multiplier = 1.0;
            else if (level === 'low') multiplier = 0.6;
            else if (level === 'inactive') multiplier = 0.2;
            
            multipliers[level] = multiplier;
        });
        
        // Process voting history
        demographics.votingHistory.forEach(history => {
            let multiplier = 1.0;
            
            if (history === 'consistent') multiplier = 1.7;
            else if (history === 'occasional') multiplier = 1.0;
            else if (history === 'rare') multiplier = 0.5;
            else if (history === 'new') multiplier = 0.7;
            
            multipliers[history] = multiplier;
        });
        
        return multipliers;
    }
    
    /**
     * Calculate impact of various issues on voter participation
     */
    function calculateIssueImpacts() {
        // In a real system, this would be learned from the data
        return {
            'Transportation access': -15,
            'Registration complexity': -20,
            'Work schedule conflicts': -25,
            'Childcare needs': -10,
            'Lack of information': -15,
            'Accessibility challenges': -20,
            'Voter ID requirements': -12,
            'Language barriers': -18,
            'Polling station distance': -15,
            'Digital literacy': -10,
            'Political disengagement': -30,
            'Distrust in electoral system': -25
        };
    }
    
    /**
     * Predict participation rate for a demographic group
     */
    function predictParticipation(demographicTraits, electionType = 'general') {
        try {
            const model = models.participationPrediction;
            if (!model) {
                throw new Error("Participation prediction model not available");
            }
            
            let predictedRate = model.baselineParticipation;
            
            // Apply demographic multipliers
            Object.keys(demographicTraits).forEach(trait => {
                const value = demographicTraits[trait];
                if (model.demographicMultipliers[value]) {
                    predictedRate *= model.demographicMultipliers[value];
                }
            });
            
            // Apply election type modifier
            if (electionType === 'presidential') {
                predictedRate *= 1.2; // Presidential elections typically have higher turnout
            } else if (electionType === 'midterm') {
                predictedRate *= 0.8; // Midterms typically have lower turnout
            } else if (electionType === 'local') {
                predictedRate *= 0.6; // Local elections typically have lowest turnout
            }
            
            // Apply issue impacts if present
            if (demographicTraits.issues && Array.isArray(demographicTraits.issues)) {
                demographicTraits.issues.forEach(issue => {
                    if (model.issueImpacts[issue]) {
                        // Convert percentage impact to multiplier
                        const multiplier = 1 + (model.issueImpacts[issue] / 100);
                        predictedRate *= multiplier;
                    }
                });
            }
            
            // Ensure rate is within bounds
            return Math.min(100, Math.max(0, predictedRate));
        } catch (error) {
            log.error(error, { context: 'predictParticipation', traits: demographicTraits });
            // Return a default prediction in case of error
            return 50; // 50% is a neutral default
        }
    }
    
    /**
     * Generate demographic segments for targeted outreach
     */
    function generateDemographicSegments() {
        return [
            {
                id: 'young_urban',
                name: 'Young Urban Voters',
                traits: {
                    age: '18-24',
                    location: 'urban',
                    engagementLevel: 'low',
                    votingHistory: 'new'
                },
                participationRate: 25,
                potentialGrowth: 'high',
                keyIssues: ['Registration complexity', 'Political disengagement'],
                outreachChannels: ['Social media', 'Campus events', 'Mobile apps']
            },
            {
                id: 'senior_suburban',
                name: 'Senior Suburban Voters',
                traits: {
                    age: '65+',
                    location: 'suburban',
                    engagementLevel: 'high',
                    votingHistory: 'consistent'
                },
                participationRate: 72,
                potentialGrowth: 'low',
                keyIssues: ['Transportation access', 'Digital literacy'],
                outreachChannels: ['Direct mail', 'Phone calls', 'Community centers']
            },
            {
                id: 'rural_middle',
                name: 'Rural Middle-aged Voters',
                traits: {
                    age: '35-54',
                    location: 'rural',
                    engagementLevel: 'medium',
                    votingHistory: 'occasional'
                },
                participationRate: 48,
                potentialGrowth: 'medium',
                keyIssues: ['Polling station distance', 'Work schedule conflicts'],
                outreachChannels: ['Local radio', 'Direct mail', 'Community events']
            },
            {
                id: 'urban_professionals',
                name: 'Urban Professionals',
                traits: {
                    age: '25-44',
                    location: 'urban',
                    engagementLevel: 'medium',
                    votingHistory: 'occasional'
                },
                participationRate: 52,
                potentialGrowth: 'high',
                keyIssues: ['Work schedule conflicts', 'Registration complexity'],
                outreachChannels: ['Email', 'LinkedIn', 'Mobile apps']
            },
            {
                id: 'remote_disengaged',
                name: 'Remote Disengaged Voters',
                traits: {
                    age: 'various',
                    location: 'remote',
                    engagementLevel: 'low',
                    votingHistory: 'rare'
                },
                participationRate: 22,
                potentialGrowth: 'high',
                keyIssues: ['Polling station distance', 'Lack of information', 'Distrust in electoral system'],
                outreachChannels: ['Direct mail', 'Local community leaders', 'Radio']
            }
        ];
    }
    
    /**
     * Generate outreach recommendations for each segment
     */
    function generateRecommendations() {
        return {
            young_urban: [
                {
                    strategy: 'Mobile Registration Drives',
                    description: 'Set up mobile registration stations at college campuses, popular gathering spots, and events frequented by young adults',
                    expectedLift: 7.5,
                    cost: 'Medium',
                    implementationTime: 'Short'
                },
                {
                    strategy: 'Social Media Campaign',
                    description: 'Run targeted social media campaigns focused on issues that matter to young voters, with easy registration links',
                    expectedLift: 5.2,
                    cost: 'Low',
                    implementationTime: 'Short'
                },
                {
                    strategy: 'Peer Influencer Program',
                    description: 'Recruit student leaders to promote voting among their networks and provide registration assistance',
                    expectedLift: 8.9,
                    cost: 'Medium',
                    implementationTime: 'Medium'
                }
            ],
            senior_suburban: [
                {
                    strategy: 'Transportation Assistance',
                    description: 'Coordinate free rides to polling locations or assistance with mail-in ballot requests',
                    expectedLift: 4.2,
                    cost: 'Medium',
                    implementationTime: 'Medium'
                },
                {
                    strategy: 'Digital Literacy Workshops',
                    description: 'Offer workshops at community centers to help seniors navigate online voter information and registration',
                    expectedLift: 3.5,
                    cost: 'Low',
                    implementationTime: 'Medium'
                }
            ],
            rural_middle: [
                {
                    strategy: 'Extended Early Voting',
                    description: 'Advocate for extended early voting periods and weekend hours to accommodate work schedules',
                    expectedLift: 6.8,
                    cost: 'High',
                    implementationTime: 'Long'
                },
                {
                    strategy: 'Mobile Polling Stations',
                    description: 'Deploy mobile polling stations to reduce distance barriers in rural areas',
                    expectedLift: 9.2,
                    cost: 'High',
                    implementationTime: 'Medium'
                },
                {
                    strategy: 'Local Business Partnerships',
                    description: 'Partner with local businesses to offer voting information and time off for employees to vote',
                    expectedLift: 5.5,
                    cost: 'Low',
                    implementationTime: 'Medium'
                }
            ],
            urban_professionals: [
                {
                    strategy: 'Workplace Voting Programs',
                    description: 'Work with employers to create formal time-off policies for voting and host registration drives',
                    expectedLift: 7.3,
                    cost: 'Low',
                    implementationTime: 'Medium'
                },
                {
                    strategy: 'Digital Registration Reminders',
                    description: 'Use email and calendar applications to send timely reminders about registration deadlines and voting days',
                    expectedLift: 4.8,
                    cost: 'Low',
                    implementationTime: 'Short'
                }
            ],
            remote_disengaged: [
                {
                    strategy: 'Community Leader Engagement',
                    description: 'Train and resource respected community leaders to provide voting information and assistance',
                    expectedLift: 10.2,
                    cost: 'Medium',
                    implementationTime: 'Long'
                },
                {
                    strategy: 'Mail-In Ballot Education',
                    description: 'Targeted information campaign about mail-in voting options to overcome distance barriers',
                    expectedLift: 8.7,
                    cost: 'Medium',
                    implementationTime: 'Medium'
                },
                {
                    strategy: 'Transparency Initiatives',
                    description: 'Programs to increase transparency and build trust in the election process through education and open houses',
                    expectedLift: 6.4,
                    cost: 'Medium',
                    implementationTime: 'Long'
                }
            ]
        };
    }
    
    /**
     * Rank engagement factors by impact
     */
    function rankEngagementFactors() {
        try {
            // Combine all factors and sort by impact
            const allFactors = [
                ...historicalData.engagementFactors.highImpact,
                ...historicalData.engagementFactors.mediumImpact,
                ...historicalData.engagementFactors.lowImpact
            ];
            
            return allFactors.sort((a, b) => b.impact - a.impact);
        } catch (error) {
            log.error(error, { context: 'rankEngagementFactors' });
            return []; // Return empty array in case of error
        }
    }
    
    /**
     * Create a matrix showing which engagement factors work best for each demographic
     */
    function createDemographicFactorMatrix() {
        const matrix = {};
        
        try {
            // Process age groups
            demographics.ageGroups.forEach(age => {
                matrix[age] = [];
                
                if (age === '18-24') {
                    matrix[age] = [
                        {factor: 'Mobile voting options', effectiveness: 9.2},
                        {factor: 'Social media engagement', effectiveness: 8.7},
                        {factor: 'Peer encouragement programs', effectiveness: 8.5},
                        {factor: 'Issue-based messaging', effectiveness: 7.8},
                        {factor: 'Same-day registration', effectiveness: 7.6}
                    ];
                } else if (age === '25-34' || age === '35-44') {
                    matrix[age] = [
                        {factor: 'Workplace voting programs', effectiveness: 8.9},
                        {factor: 'Digital reminders and tools', effectiveness: 8.5},
                        {factor: 'Extended voting hours', effectiveness: 7.8},
                        {factor: 'Childcare at polling locations', effectiveness: 7.5},
                        {factor: 'Mobile voting options', effectiveness: 7.2}
                    ];
                } else if (age === '45-54' || age === '55-64') {
                    matrix[age] = [
                        {factor: 'Mail-in ballot access', effectiveness: 8.5},
                        {factor: 'Workplace voting programs', effectiveness: 7.8},
                        {factor: 'Local voting locations', effectiveness: 7.5},
                        {factor: 'Community events', effectiveness: 7.3},
                        {factor: 'Direct mail information', effectiveness: 6.9}
                    ];
                } else if (age === '65+') {
                    matrix[age] = [
                        {factor: 'Transportation assistance', effectiveness: 9.5},
                        {factor: 'Mail-in ballot access', effectiveness: 9.2},
                        {factor: 'Accessible polling locations', effectiveness: 8.7},
                        {factor: 'Assistance at polling stations', effectiveness: 8.5},
                        {factor: 'Direct mail information', effectiveness: 8.0}
                    ];
                }
            });
            
            // Process locations
            demographics.locations.forEach(location => {
                matrix[location] = [];
                
                if (location === 'urban') {
                    matrix[location] = [
                        {factor: 'Extended early voting', effectiveness: 8.7},
                        {factor: 'Multiple polling locations', effectiveness: 8.5},
                        {factor: 'Public transit access', effectiveness: 8.2},
                        {factor: 'Digital engagement tools', effectiveness: 7.8},
                        {factor: 'Multilingual voting materials', effectiveness: 7.5}
                    ];
                } else if (location === 'suburban') {
                    matrix[location] = [
                        {factor: 'Local community voting sites', effectiveness: 8.5},
                        {factor: 'Extended voting hours', effectiveness: 8.2},
                        {factor: 'Mail-in ballot access', effectiveness: 7.9},
                        {factor: 'Digital and print reminders', effectiveness: 7.6},
                        {factor: 'Community events', effectiveness: 7.3}
                    ];
                } else if (location === 'rural') {
                    matrix[location] = [
                        {factor: 'Mobile polling stations', effectiveness: 9.2},
                        {factor: 'Mail-in ballot access', effectiveness: 8.9},
                        {factor: 'Local community partnerships', effectiveness: 8.5},
                        {factor: 'Transportation assistance', effectiveness: 8.3},
                        {factor: 'Extended early voting', effectiveness: 7.8}
                    ];
                } else if (location === 'remote') {
                    matrix[location] = [
                        {factor: 'Mail-in ballot access', effectiveness: 9.8},
                        {factor: 'Mobile polling stations', effectiveness: 9.5},
                        {factor: 'Community leader engagement', effectiveness: 9.0},
                        {factor: 'Radio information campaigns', effectiveness: 8.5},
                        {factor: 'Satellite voting locations', effectiveness: 8.2}
                    ];
                }
            });
        } catch (error) {
            log.error(error, { context: 'createDemographicFactorMatrix' });
        }
        
        return matrix;
    }
    
    /**
     * Analyze effectiveness of previous outreach campaigns
     */
    function analyzeOutreachEffectiveness() {
        const effectiveness = {
            byDemographic: {},
            byMethod: {},
            byCost: {}
        };
        
        try {
            const campaigns = historicalData.outreachCampaigns;
            
            // Calculate effectiveness by demographic
            campaigns.forEach(campaign => {
                if (!effectiveness.byDemographic[campaign.targetDemographic]) {
                    effectiveness.byDemographic[campaign.targetDemographic] = {
                        campaigns: 0,
                        totalEffectiveness: 0,
                        totalLift: 0
                    };
                }
                
                const demoStats = effectiveness.byDemographic[campaign.targetDemographic];
                demoStats.campaigns++;
                demoStats.totalEffectiveness += campaign.effectiveness;
                demoStats.totalLift += campaign.participationLift;
            });
            
            // Calculate averages
            Object.keys(effectiveness.byDemographic).forEach(demo => {
                const stats = effectiveness.byDemographic[demo];
                stats.averageEffectiveness = stats.totalEffectiveness / stats.campaigns;
                stats.averageLift = stats.totalLift / stats.campaigns;
            });
            
            // Calculate effectiveness by method
            campaigns.forEach(campaign => {
                if (!effectiveness.byMethod[campaign.method]) {
                    effectiveness.byMethod[campaign.method] = {
                        campaigns: 0,
                        totalEffectiveness: 0,
                        totalLift: 0
                    };
                }
                
                const methodStats = effectiveness.byMethod[campaign.method];
                methodStats.campaigns++;
                methodStats.totalEffectiveness += campaign.effectiveness;
                methodStats.totalLift += campaign.participationLift;
            });
            
            // Calculate averages
            Object.keys(effectiveness.byMethod).forEach(method => {
                const stats = effectiveness.byMethod[method];
                stats.averageEffectiveness = stats.totalEffectiveness / stats.campaigns;
                stats.averageLift = stats.totalLift / stats.campaigns;
            });
            
            // Calculate effectiveness by cost
            campaigns.forEach(campaign => {
                if (!effectiveness.byCost[campaign.cost]) {
                    effectiveness.byCost[campaign.cost] = {
                        campaigns: 0,
                        totalEffectiveness: 0,
                        totalLift: 0
                    };
                }
                
                const costStats = effectiveness.byCost[campaign.cost];
                costStats.campaigns++;
                costStats.totalEffectiveness += campaign.effectiveness;
                costStats.totalLift += campaign.participationLift;
            });
            
            // Calculate averages and ROI
            Object.keys(effectiveness.byCost).forEach(cost => {
                const stats = effectiveness.byCost[cost];
                stats.averageEffectiveness = stats.totalEffectiveness / stats.campaigns;
                stats.averageLift = stats.totalLift / stats.campaigns;
                
                // Calculate ROI based on cost category
                let costMultiplier = 1;
                if (cost === 'Low') costMultiplier = 1;
                else if (cost === 'Medium') costMultiplier = 2;
                else if (cost === 'High') costMultiplier = 4;
                
                stats.roi = stats.averageLift / costMultiplier;
            });
        } catch (error) {
            log.error(error, { context: 'analyzeOutreachEffectiveness' });
        }
        
        return effectiveness;
    }
    
    /**
     * Recommend optimal outreach strategies based on objectives
     */
    function recommendOutreachStrategies(objective, constraints = {}) {
        try {
            const effectivenessData = models.outreachEffectiveness.campaignEffectiveness;
            let strategies = [];
            
            // Check if we have required data
            if (!models.demographicSegmentation || !effectivenessData) {
                throw new Error("Required models not available");
            }
            
            // Determine which strategies to consider based on objective
            if (objective === 'maximizeParticipation') {
                // Find strategies with highest average lift
                
                // By demographic
                Object.keys(effectivenessData.byDemographic).forEach(demo => {
                    const demoStats = effectivenessData.byDemographic[demo];
                    if (demoStats.averageLift > 5) { // Threshold for consideration
                        const segmentStrategies = models.demographicSegmentation.recommendationsForSegments[convertDemoToSegmentId(demo)];
                        
                        if (segmentStrategies) {
                            // Add top strategies from this segment
                            segmentStrategies.slice(0, 2).forEach(strategy => {
                                strategies.push({
                                    demographic: demo,
                                    ...strategy,
                                    source: 'demographic'
                                });
                            });
                        }
                    }
                });
                
                // By method
                Object.keys(effectivenessData.byMethod).forEach(method => {
                    const methodStats = effectivenessData.byMethod[method];
                    if (methodStats.averageLift > 6) { // Threshold for consideration
                        strategies.push({
                            method: method,
                            expectedLift: methodStats.averageLift,
                            effectiveness: methodStats.averageEffectiveness,
                            source: 'method'
                        });
                    }
                });
            } 
            else if (objective === 'costEfficiency') {
                // Find strategies with highest ROI
                
                // By cost category
                Object.keys(effectivenessData.byCost).forEach(cost => {
                    const costStats = effectivenessData.byCost[cost];
                    if (cost === 'Low' || cost === 'Medium') { // Focus on lower cost options
                        strategies.push({
                            cost: cost,
                            roi: costStats.roi,
                            expectedLift: costStats.averageLift,
                            effectiveness: costStats.averageEffectiveness,
                            source: 'cost'
                        });
                    }
                });
                
                // Add specific low-cost, high-impact strategies
                const segments = models.demographicSegmentation.segments;
                segments.forEach(segment => {
                    const segmentStrategies = models.demographicSegmentation.recommendationsForSegments[segment.id];
                    
                    if (segmentStrategies) {
                        // Find low-cost strategies
                        const lowCostStrategies = segmentStrategies.filter(s => s.cost === 'Low');
                        if (lowCostStrategies.length > 0) {
                            // Get the one with highest expected lift
                            const bestStrategy = lowCostStrategies.reduce((best, current) => 
                                current.expectedLift > best.expectedLift ? current : best, lowCostStrategies[0]);
                            
                            strategies.push({
                                demographic: segment.name,
                                ...bestStrategy,
                                source: 'segment'
                            });
                        }
                    }
                });
            }
            else if (objective === 'targetedOutreach') {
                // Target specific demographic groups
                
                if (constraints.targetDemographics && constraints.targetDemographics.length > 0) {
                    constraints.targetDemographics.forEach(demo => {
                        // Try to find segment matching this demographic
                        const segmentId = convertDemoToSegmentId(demo);
                        const segmentStrategies = models.demographicSegmentation.recommendationsForSegments[segmentId];
                        
                        if (segmentStrategies) {
                            // Add all strategies for this demographic
                            segmentStrategies.forEach(strategy => {
                                strategies.push({
                                    demographic: demo,
                                    ...strategy,
                                    source: 'targeted'
                                });
                            });
                        } else {
                            // If no specific segment, look in demographic factor matrix
                            const factorsForDemo = models.engagementFactorAnalysis.demographicFactorMatrix[demo];
                            
                            if (factorsForDemo) {
                                // Create strategies based on top factors
                                factorsForDemo.slice(0, 3).forEach(factor => {
                                    strategies.push({
                                        demographic: demo,
                                        strategy: factor.factor,
                                        description: `Implement ${factor.factor} programs specifically designed for ${demo} demographics`,
                                        expectedLift: factor.effectiveness * 0.8, // Convert effectiveness to expected lift
                                        effectiveness: factor.effectiveness,
                                        cost: estimateCost(factor.factor),
                                        source: 'factor'
                                    });
                                });
                            }
                        }
                    });
                }
            }
            
            // Apply any budget constraints
            if (constraints.budget === 'limited') {
                // Filter for low and medium cost strategies
                strategies = strategies.filter(s => s.cost === 'Low' || s.cost === 'Medium');
            }
            
            // Apply any time constraints
            if (constraints.timeframe === 'short') {
                // Filter for quick implementation strategies
                strategies = strategies.filter(s => !s.implementationTime || s.implementationTime === 'Short');
            }
            
            // Sort strategies by expected lift (descending)
            strategies.sort((a, b) => b.expectedLift - a.expectedLift);
            
            return strategies;
        } catch (error) {
            log.error(error, { 
                context: 'recommendOutreachStrategies', 
                objective: objective, 
                constraints: JSON.stringify(constraints) 
            });
            return []; // Return empty array in case of error
        }
    }
    
    /**
     * Convert a demographic trait to a segment ID
     */
    function convertDemoToSegmentId(demo) {
        // Simple mapping of demographic traits to segment IDs
        const mappings = {
            '18-24': 'young_urban',
            '65+': 'senior_suburban',
            'rural': 'rural_middle',
            'urban': 'urban_professionals',
            'remote': 'remote_disengaged'
        };
        
        return mappings[demo] || '';
    }
    
    /**
     * Estimate cost category for an engagement factor
     */
    function estimateCost(factor) {
        // Classify cost based on factor name
        if (factor.includes('Mobile') || 
            factor.includes('Transportation') ||
            factor.includes('stations')) {
            return 'High';
        }
        else if (factor.includes('Community') || 
                factor.includes('Workplace') ||
                factor.includes('Assistance')) {
            return 'Medium';
        }
        else {
            return 'Low';
        }
    }
    
    /**
     * Generate a participation forecast for the next election
     */
    function generateParticipationForecast(electionType = 'general') {
        try {
            // Check if required model is available
            if (!models.participationPrediction) {
                throw new Error("Participation prediction model not available");
            }
            
            const forecast = {
                overall: {
                    expectedParticipation: 0,
                    changeFromPrevious: 0,
                    confidenceInterval: [0, 0]
                },
                byDemographic: {}
            };
            
            // Calculate overall forecast
            const baselinePrediction = models.participationPrediction.baselineParticipation;
            let electionMultiplier = 1;
            
            if (electionType === 'presidential') {
                electionMultiplier = 1.2;
            } else if (electionType === 'midterm') {
                electionMultiplier = 0.8;
            } else if (electionType === 'local') {
                electionMultiplier = 0.6;
            }
            
            forecast.overall.expectedParticipation = baselinePrediction * electionMultiplier;
            
            // Calculate change from previous similar election
            const years = Object.keys(historicalData.participationRates).map(Number).sort((a, b) => b - a);
            let previousSimilarElection = null;
            
            if (electionType === 'presidential') {
                // Find most recent presidential election (divisible by 4)
                previousSimilarElection = years.find(year => year % 4 === 0);
            } else if (electionType === 'midterm') {
                // Find most recent midterm election (not divisible by 4 but even)
                previousSimilarElection = years.find(year => year % 4 !== 0 && year % 2 === 0);
            } else {
                // Find most recent election
                previousSimilarElection = years[0];
            }
            
            if (previousSimilarElection && historicalData.participationRates[previousSimilarElection]) {
                const previousRate = historicalData.participationRates[previousSimilarElection].overall;
                forecast.overall.changeFromPrevious = forecast.overall.expectedParticipation - previousRate;
            }
            
            // Calculate confidence interval (±5%)
            forecast.overall.confidenceInterval = [
                Math.max(0, forecast.overall.expectedParticipation - 5),
                Math.min(100, forecast.overall.expectedParticipation + 5)
            ];
            
            // Generate demographic forecasts
            
            // Age groups
            demographics.ageGroups.forEach(age => {
                forecast.byDemographic[age] = {
                    expectedParticipation: predictParticipation({ age }, electionType),
                    keyFactors: getKeyFactorsForDemographic(age),
                    recommendedStrategies: getTopStrategiesForDemographic(age)
                };
            });
            
            // Locations
            demographics.locations.forEach(location => {
                forecast.byDemographic[location] = {
                    expectedParticipation: predictParticipation({ location }, electionType),
                    keyFactors: getKeyFactorsForDemographic(location),
                    recommendedStrategies: getTopStrategiesForDemographic(location)
                };
            });
            
            return forecast;
        } catch (error) {
            log.error(error, { context: 'generateParticipationForecast', electionType: electionType });
            // Return a minimal forecast in case of error
            return {
                overall: {
                    expectedParticipation: 50, // Default
                    changeFromPrevious: 0,
                    confidenceInterval: [45, 55]
                },
                byDemographic: {}
            };
        }
    }
    
    /**
     * Get key factors that influence a demographic's participation
     */
    function getKeyFactorsForDemographic(demographic) {
        try {
            // Check if the required model is available
            if (!models.engagementFactorAnalysis || !models.engagementFactorAnalysis.demographicFactorMatrix) {
                throw new Error("Engagement factor analysis model not available");
            }
            
            const factorMatrix = models.engagementFactorAnalysis.demographicFactorMatrix;
            
            if (factorMatrix[demographic]) {
                // Return top 3 factors
                return factorMatrix[demographic].slice(0, 3).map(f => ({
                    factor: f.factor,
                    impact: f.effectiveness
                }));
            }
        } catch (error) {
            log.error(error, { context: 'getKeyFactorsForDemographic', demographic: demographic });
        }
        
        return [];
    }
    
    /**
     * Get top recommended strategies for a demographic
     */
    function getTopStrategiesForDemographic(demographic) {
        try {
            // Check if required models are available
            if (!models.demographicSegmentation || !models.demographicSegmentation.recommendationsForSegments) {
                throw new Error("Demographic segmentation model not available");
            }
            
            const segmentId = convertDemoToSegmentId(demographic);
            
            if (segmentId && models.demographicSegmentation.recommendationsForSegments[segmentId]) {
                // Return top 2 strategies
                return models.demographicSegmentation.recommendationsForSegments[segmentId].slice(0, 2);
            }
        } catch (error) {
            log.error(error, { context: 'getTopStrategiesForDemographic', demographic: demographic });
        }
        
        return [];
    }
    
    /**
     * Update the predictive analytics UI
     */
    function updatePredictiveAnalyticsUI() {
        // Skip UI updates if UI rendering is disabled
        if (!analyticsConfig.renderUI) {
            log.debug("UI updates skipped - UI rendering is disabled in configuration");
            return;
        }
        
        try {
            // Update participation forecast panel
            updateForecastUI();
            
            // Update demographic segmentation panel
            updateSegmentationUI();
            
            // Update engagement factors panel
            updateFactorsUI();
            
            // Update recommendations panel
            updateRecommendationsUI();
        } catch (error) {
            log.error(error, { context: 'updatePredictiveAnalyticsUI' });
            showUIError("An error occurred while updating the analytics dashboard");
        }
    }
    
    /**
     * Display initialization error in UI
     */
    function showInitializationError() {
        const dashboardSection = document.getElementById('predictiveAnalyticsDashboard');
        if (!dashboardSection) return;
        
        dashboardSection.innerHTML = `
            <h3>Predictive Analytics for Voter Engagement</h3>
            
            <div class="analytics-error">
                <div class="error-icon">⚠️</div>
                <h4>Error Loading Analytics</h4>
                <p>We encountered a problem initializing the predictive analytics system. Please try refreshing the page or contact support if the issue persists.</p>
                <button id="retryAnalyticsBtn" class="retry-button">Retry Loading</button>
            </div>
        `;
        
        // Add retry functionality
        const retryButton = document.getElementById('retryAnalyticsBtn');
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                // Show loading state
                dashboardSection.innerHTML = `
                    <h3>Predictive Analytics for Voter Engagement</h3>
                    <div class="loading-container">
                        <div class="loading-spinner"></div>
                        <p>Reinitializing analytics system...</p>
                    </div>
                `;
                
                // Try to initialize again
                setTimeout(() => {
                    initialize().then(success => {
                        if (!success) {
                            showInitializationError();
                        }
                    }).catch(() => {
                        showInitializationError();
                    });
                }, 1000);
            });
        }
    }
    
    /**
     * Show UI error message
     */
    function showUIError(message) {
        // Only show errors if UI rendering is enabled
        if (!analyticsConfig.renderUI) return;
        
        try {
            // Create an error notification
            const errorNotification = document.createElement('div');
            errorNotification.className = 'analytics-notification error';
            errorNotification.innerHTML = `
                <span class="notification-icon">⚠️</span>
                <span class="notification-message">${message}</span>
                <span class="notification-close">×</span>
            `;
            
            // Add to dashboard if exists
            const dashboard = document.getElementById('predictiveAnalyticsDashboard');
            if (dashboard) {
                dashboard.appendChild(errorNotification);
                
                // Auto-remove after 5 seconds
                setTimeout(() => {
                    errorNotification.classList.add('removing');
                    setTimeout(() => {
                        errorNotification.remove();
                    }, 300);
                }, 5000);
                
                // Add close button functionality
                const closeButton = errorNotification.querySelector('.notification-close');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        errorNotification.classList.add('removing');
                        setTimeout(() => {
                            errorNotification.remove();
                        }, 300);
                    });
                }
            }
        } catch (error) {
            log.error(error, { context: 'showUIError' });
        }
    }
    
    /**
     * Update participation forecast UI
     */
    function updateForecastUI() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        const forecastElement = document.getElementById('participationForecast');
        if (!forecastElement) return;
        
        try {
            // Generate forecast
            const forecast = generateParticipationForecast('general');
            
            // Create HTML for forecast
            const changeDirection = forecast.overall.changeFromPrevious >= 0 ? 'increase' : 'decrease';
            const changeClass = forecast.overall.changeFromPrevious >= 0 ? 'positive-change' : 'negative-change';
            const changeMagnitude = Math.abs(forecast.overall.changeFromPrevious).toFixed(1);
            
            const forecastHTML = `
                <div class="forecast-header">
                    <h5>Overall Participation Forecast</h5>
                    <div class="forecast-controls">
                        <select id="forecastElectionType">
                            <option value="general">General Election</option>
                            <option value="presidential">Presidential Election</option>
                            <option value="midterm">Midterm Election</option>
                            <option value="local">Local Election</option>
                        </select>
                    </div>
                </div>
                
                <div class="forecast-main">
                    <div class="forecast-metric">
                        <span class="metric-value">${forecast.overall.expectedParticipation.toFixed(1)}%</span>
                        <span class="metric-label">Expected Participation</span>
                        <span class="metric-ci">±5% (${forecast.overall.confidenceInterval[0].toFixed(1)}% - ${forecast.overall.confidenceInterval[1].toFixed(1)}%)</span>
                    </div>
                    
                    <div class="forecast-change ${changeClass}">
                        <span class="change-arrow">${changeDirection === 'increase' ? '↑' : '↓'}</span>
                        <span class="change-value">${changeMagnitude}%</span>
                        <span class="change-label">${changeDirection} from previous similar election</span>
                    </div>
                </div>
                
                <div class="forecast-demographics">
                    <h5>Participation by Demographic</h5>
                    
                    <div class="forecast-tabs">
                        <button class="forecast-tab active" data-tab="age">Age Groups</button>
                        <button class="forecast-tab" data-tab="location">Locations</button>
                    </div>
                    
                    <div class="forecast-tab-content" id="forecastAgeTab">
                        <div class="demographic-forecast-chart">
                            ${demographics.ageGroups.map(age => `
                                <div class="demographic-bar">
                                    <div class="bar-label">${age}</div>
                                    <div class="bar-container">
                                        <div class="bar-fill" style="width: ${forecast.byDemographic[age].expectedParticipation}%">
                                            <span class="bar-value">${forecast.byDemographic[age].expectedParticipation.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="forecast-tab-content" id="forecastLocationTab" style="display: none;">
                        <div class="demographic-forecast-chart">
                            ${demographics.locations.map(location => `
                                <div class="demographic-bar">
                                    <div class="bar-label">${capitalizeFirst(location)}</div>
                                    <div class="bar-container">
                                        <div class="bar-fill" style="width: ${forecast.byDemographic[location].expectedParticipation}%">
                                            <span class="bar-value">${forecast.byDemographic[location].expectedParticipation.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                
                ${isProd ? '<div class="production-indicator">Data analysis optimized for production environment</div>' : ''}
            `;
            
            forecastElement.innerHTML = forecastHTML;
            
            // Add event listeners for tabs
            document.querySelectorAll('.forecast-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    try {
                        // Update active tab
                        document.querySelectorAll('.forecast-tab').forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        
                        // Show selected tab content
                        document.querySelectorAll('.forecast-tab-content').forEach(content => {
                            content.style.display = 'none';
                        });
                        document.getElementById(`forecast${capitalizeFirst(tab.dataset.tab)}Tab`).style.display = 'block';
                    } catch (tabError) {
                        log.error(tabError, { context: 'forecastTabs' });
                    }
                });
            });
            
            // Add event listener for election type selector
            const electionTypeSelector = document.getElementById('forecastElectionType');
            if (electionTypeSelector) {
                electionTypeSelector.addEventListener('change', (e) => {
                    try {
                        const electionType = e.target.value;
                        const updatedForecast = generateParticipationForecast(electionType);
                        
                        // Update main metrics
                        document.querySelector('.forecast-metric .metric-value').textContent = `${updatedForecast.overall.expectedParticipation.toFixed(1)}%`;
                        document.querySelector('.forecast-metric .metric-ci').textContent = 
                            `±5% (${updatedForecast.overall.confidenceInterval[0].toFixed(1)}% - ${updatedForecast.overall.confidenceInterval[1].toFixed(1)}%)`;
                        
                        const newChangeDirection = updatedForecast.overall.changeFromPrevious >= 0 ? 'increase' : 'decrease';
                        const newChangeClass = updatedForecast.overall.changeFromPrevious >= 0 ? 'positive-change' : 'negative-change';
                        const newChangeMagnitude = Math.abs(updatedForecast.overall.changeFromPrevious).toFixed(1);
                        
                        const changeElement = document.querySelector('.forecast-change');
                        changeElement.className = `forecast-change ${newChangeClass}`;
                        changeElement.querySelector('.change-arrow').textContent = newChangeDirection === 'increase' ? '↑' : '↓';
                        changeElement.querySelector('.change-value').textContent = `${newChangeMagnitude}%`;
                        changeElement.querySelector('.change-label').textContent = `${newChangeDirection} from previous similar election`;
                        
                        // Update demographic charts
                        document.querySelectorAll('#forecastAgeTab .demographic-bar').forEach((bar, index) => {
                            const age = demographics.ageGroups[index];
                            const barFill = bar.querySelector('.bar-fill');
                            const barValue = bar.querySelector('.bar-value');
                            
                            barFill.style.width = `${updatedForecast.byDemographic[age].expectedParticipation}%`;
                            barValue.textContent = `${updatedForecast.byDemographic[age].expectedParticipation.toFixed(1)}%`;
                        });
                        
                        document.querySelectorAll('#forecastLocationTab .demographic-bar').forEach((bar, index) => {
                            const location = demographics.locations[index];
                            const barFill = bar.querySelector('.bar-fill');
                            const barValue = bar.querySelector('.bar-value');
                            
                            barFill.style.width = `${updatedForecast.byDemographic[location].expectedParticipation}%`;
                            barValue.textContent = `${updatedForecast.byDemographic[location].expectedParticipation.toFixed(1)}%`;
                        });
                    } catch (updateError) {
                        log.error(updateError, { context: 'updateForecastUI.electionTypeChange' });
                        showUIError("Failed to update forecast for selected election type");
                    }
                });
            }
        } catch (error) {
            log.error(error, { context: 'updateForecastUI' });
            forecastElement.innerHTML = `
                <div class="section-error">
                    <p>Unable to generate participation forecast</p>
                    <button class="retry-button" id="retryForecastBtn">Retry</button>
                </div>
            `;
            
            // Add retry functionality
            const retryButton = document.getElementById('retryForecastBtn');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    updateForecastUI();
                });
            }
        }
    }
    
    /**
     * Update demographic segmentation UI
     */
    function updateSegmentationUI() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        const segmentationElement = document.getElementById('demographicSegmentation');
        if (!segmentationElement) return;
        
        try {
            // Get segments
            const segments = models.demographicSegmentation.segments;
            
            // Create HTML for segments
            const segmentationHTML = `
                <div class="segmentation-header">
                    <h5>Voter Segments</h5>
                    <div class="segmentation-legend">
                        <span class="legend-item"><span class="legend-color high"></span> High Growth Potential</span>
                        <span class="legend-item"><span class="legend-color medium"></span> Medium Growth Potential</span>
                        <span class="legend-item"><span class="legend-color low"></span> Low Growth Potential</span>
                    </div>
                </div>
                
                <div class="segments-grid">
                    ${segments.map(segment => `
                        <div class="segment-card ${segment.potentialGrowth.toLowerCase()}">
                            <div class="segment-header">
                                <h6>${segment.name}</h6>
                                <span class="segment-rate">${segment.participationRate}%</span>
                            </div>
                            
                            <div class="segment-traits">
                                ${Object.entries(segment.traits).map(([trait, value]) => 
                                    `<span class="segment-trait">${capitalizeFirst(trait)}: ${value}</span>`
                                ).join('')}
                            </div>
                            
                            <div class="segment-issues">
                                <h6>Key Issues:</h6>
                                <ul>
                                    ${segment.keyIssues.map(issue => `<li>${issue}</li>`).join('')}
                                </ul>
                            </div>
                            
                            <div class="segment-channels">
                                <h6>Best Outreach Channels:</h6>
                                <div class="channel-tags">
                                    ${segment.outreachChannels.map(channel => 
                                        `<span class="channel-tag">${channel}</span>`
                                    ).join('')}
                                </div>
                            </div>
                            
                            <button class="view-recommendations-btn" data-segment="${segment.id}">View Recommendations</button>
                        </div>
                    `).join('')}
                </div>
                
                ${isProd ? '<div class="production-indicator">Data analysis optimized for production environment</div>' : ''}
            `;
            
            segmentationElement.innerHTML = segmentationHTML;
            
            // Add event listeners for recommendation buttons
            document.querySelectorAll('.view-recommendations-btn').forEach(button => {
                button.addEventListener('click', () => {
                    try {
                        const segmentId = button.dataset.segment;
                        showSegmentRecommendations(segmentId);
                    } catch (error) {
                        log.error(error, { context: 'segmentRecommendationsClick' });
                        showUIError("Failed to load segment recommendations");
                    }
                });
            });
        } catch (error) {
            log.error(error, { context: 'updateSegmentationUI' });
            segmentationElement.innerHTML = `
                <div class="section-error">
                    <p>Unable to load demographic segments</p>
                    <button class="retry-button" id="retrySegmentationBtn">Retry</button>
                </div>
            `;
            
            // Add retry functionality
            const retryButton = document.getElementById('retrySegmentationBtn');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    updateSegmentationUI();
                });
            }
        }
    }
    
    /**
     * Show recommendations for a specific segment
     */
    function showSegmentRecommendations(segmentId) {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        try {
            // Find segment
            const segment = models.demographicSegmentation.segments.find(s => s.id === segmentId);
            if (!segment) {
                throw new Error(`Segment not found: ${segmentId}`);
            }
            
            // Get recommendations
            const recommendations = models.demographicSegmentation.recommendationsForSegments[segmentId];
            if (!recommendations) {
                throw new Error(`No recommendations for segment: ${segmentId}`);
            }
            
            // Create modal
            const modal = document.createElement('div');
            modal.className = 'predictive-modal';
            
            // Create modal content
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h5>Recommendations for ${segment.name}</h5>
                        <span class="modal-close">&times;</span>
                    </div>
                    
                    <div class="modal-body">
                        <div class="segment-summary">
                            <p>Current participation rate: <strong>${segment.participationRate}%</strong></p>
                            <p>Growth potential: <strong>${segment.potentialGrowth}</strong></p>
                        </div>
                        
                        <h6>Recommended Strategies:</h6>
                        
                        <div class="recommendations-list">
                            ${recommendations.map((rec, index) => `
                                <div class="recommendation-item">
                                    <div class="recommendation-header">
                                        <span class="recommendation-number">${index + 1}</span>
                                        <h6>${rec.strategy}</h6>
                                        <span class="recommendation-metric">
                                            Expected lift: <strong>${rec.expectedLift.toFixed(1)}%</strong>
                                        </span>
                                    </div>
                                    
                                    <div class="recommendation-details">
                                        <p>${rec.description}</p>
                                        <div class="recommendation-meta">
                                            <span class="cost-tag ${rec.cost.toLowerCase()}">${rec.cost} Cost</span>
                                            <span class="time-tag ${rec.implementationTime.toLowerCase()}">${rec.implementationTime} Implementation</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        ${isProd ? '<div class="production-note">These recommendations are optimized based on the latest data analysis.</div>' : ''}
                    </div>
                </div>
            `;
            
            // Add modal to the page
            document.body.appendChild(modal);
            
            // Add event listener for close button
            modal.querySelector('.modal-close').addEventListener('click', () => {
                try {
                    modal.classList.add('fade-out');
                    setTimeout(() => {
                        modal.remove();
                    }, 300);
                } catch (error) {
                    modal.remove();
                }
            });
            
            // Close when clicking outside the modal
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    try {
                        modal.classList.add('fade-out');
                        setTimeout(() => {
                            modal.remove();
                        }, 300);
                    } catch (error) {
                        modal.remove();
                    }
                }
            });
        } catch (error) {
            log.error(error, { context: 'showSegmentRecommendations', segmentId: segmentId });
            showUIError("Failed to load segment recommendations");
        }
    }
    
    /**
     * Update engagement factors UI
     */
    function updateFactorsUI() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        const factorsElement = document.getElementById('engagementFactors');
        if (!factorsElement) return;
        
        try {
            // Get ranked factors
            const rankedFactors = models.engagementFactorAnalysis.rankedFactors;
            
            // Create HTML for factors
            const factorsHTML = `
                <div class="factors-header">
                    <h5>Key Engagement Factors</h5>
                    <div class="factors-filter">
                        <select id="factorsDemographicFilter">
                            <option value="all">All Demographics</option>
                            ${demographics.ageGroups.map(age => 
                                `<option value="${age}">${age}</option>`
                            ).join('')}
                            ${demographics.locations.map(location => 
                                `<option value="${location}">${capitalizeFirst(location)}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
                
                <div class="factors-list" id="allFactorsList">
                    ${rankedFactors.map((factor, index) => `
                        <div class="factor-item ${index < 5 ? 'high-impact' : index < 10 ? 'medium-impact' : 'low-impact'}">
                            <div class="factor-rank">${index + 1}</div>
                            <div class="factor-details">
                                <div class="factor-name">${factor.factor}</div>
                                <div class="factor-impact-bar">
                                    <div class="impact-fill" style="width: ${(factor.impact / 10) * 100}%"></div>
                                </div>
                            </div>
                            <div class="factor-impact">${factor.impact.toFixed(1)}</div>
                        </div>
                    `).join('')}
                </div>
                
                ${Object.keys(models.engagementFactorAnalysis.demographicFactorMatrix).map(demo => `
                    <div class="factors-list demographic-factors" id="${demo}FactorsList" style="display: none;">
                        ${models.engagementFactorAnalysis.demographicFactorMatrix[demo].map((factor, index) => `
                            <div class="factor-item ${index < 2 ? 'high-impact' : index < 4 ? 'medium-impact' : 'low-impact'}">
                                <div class="factor-rank">${index + 1}</div>
                                <div class="factor-details">
                                    <div class="factor-name">${factor.factor}</div>
                                    <div class="factor-impact-bar">
                                        <div class="impact-fill" style="width: ${(factor.effectiveness / 10) * 100}%"></div>
                                    </div>
                                </div>
                                <div class="factor-impact">${factor.effectiveness.toFixed(1)}</div>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
                
                ${isProd ? '<div class="production-indicator">Data analysis optimized for production environment</div>' : ''}
            `;
            
            factorsElement.innerHTML = factorsHTML;
            
            // Add event listener for demographic filter
            const filterDropdown = document.getElementById('factorsDemographicFilter');
            if (filterDropdown) {
                filterDropdown.addEventListener('change', (e) => {
                    try {
                        const selectedDemo = e.target.value;
                        
                        // Hide all factor lists
                        document.querySelectorAll('.factors-list').forEach(list => {
                            list.style.display = 'none';
                        });
                        
                        // Show selected list
                        if (selectedDemo === 'all') {
                            document.getElementById('allFactorsList').style.display = 'block';
                        } else {
                            document.getElementById(`${selectedDemo}FactorsList`).style.display = 'block';
                        }
                    } catch (error) {
                        log.error(error, { context: 'factorFilterChange' });
                    }
                });
            }
        } catch (error) {
            log.error(error, { context: 'updateFactorsUI' });
            factorsElement.innerHTML = `
                <div class="section-error">
                    <p>Unable to load engagement factors</p>
                    <button class="retry-button" id="retryFactorsBtn">Retry</button>
                </div>
            `;
            
            // Add retry functionality
            const retryButton = document.getElementById('retryFactorsBtn');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    updateFactorsUI();
                });
            }
        }
    }
    
    /**
     * Update recommendations UI
     */
    function updateRecommendationsUI() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        const recommendationsElement = document.getElementById('outreachRecommendations');
        if (!recommendationsElement) return;
        
        try {
            // Create HTML for recommendations
            const recommendationsHTML = `
                <div class="recommendations-header">
                    <h5>Recommended Outreach Strategies</h5>
                    <div class="recommendations-controls">
                        <select id="recommendationsObjective">
                            <option value="maximizeParticipation">Maximize Participation</option>
                            <option value="costEfficiency">Cost Efficiency</option>
                            <option value="targetedOutreach">Targeted Outreach</option>
                        </select>
                        
                        <button id="generateRecommendationsBtn" class="generate-btn">Generate</button>
                    </div>
                </div>
                
                <div class="targeting-options" id="targetingOptions" style="display: none;">
                    <h6>Select Target Demographics:</h6>
                    <div class="targeting-checkboxes">
                        ${demographics.ageGroups.map(age => `
                            <label class="targeting-checkbox">
                                <input type="checkbox" name="targetDemo" value="${age}">
                                ${age}
                            </label>
                        `).join('')}
                        ${demographics.locations.map(location => `
                            <label class="targeting-checkbox">
                                <input type="checkbox" name="targetDemo" value="${location}">
                                ${capitalizeFirst(location)}
                            </label>
                        `).join('')}
                    </div>
                    
                    <div class="constraint-options">
                        <h6>Constraints:</h6>
                        <div class="constraint-row">
                            <label>
                                <input type="checkbox" id="budgetConstraint">
                                Limited Budget
                            </label>
                            <label>
                                <input type="checkbox" id="timeConstraint">
                                Short Timeframe
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="recommendations-results" id="recommendationsResults">
                    <p class="recommendations-placeholder">Select an objective and click Generate to view recommendations</p>
                </div>
                
                ${isProd ? '<div class="production-indicator">Data analysis optimized for production environment</div>' : ''}
            `;
            
            recommendationsElement.innerHTML = recommendationsHTML;
            
            // Add event listener for objective selector
            const objectiveSelector = document.getElementById('recommendationsObjective');
            if (objectiveSelector) {
                objectiveSelector.addEventListener('change', (e) => {
                    try {
                        const objective = e.target.value;
                        
                        // Show targeting options if targeted outreach is selected
                        const targetingOptions = document.getElementById('targetingOptions');
                        if (targetingOptions) {
                            targetingOptions.style.display = objective === 'targetedOutreach' ? 'block' : 'none';
                        }
                    } catch (error) {
                        log.error(error, { context: 'objectiveSelectorChange' });
                    }
                });
            }
            
            // Add event listener for generate button
            const generateButton = document.getElementById('generateRecommendationsBtn');
            if (generateButton) {
                generateButton.addEventListener('click', () => {
                    try {
                        // Show loading state
                        const resultsElement = document.getElementById('recommendationsResults');
                        if (resultsElement) {
                            resultsElement.innerHTML = `
                                <div class="loading-container">
                                    <div class="loading-spinner"></div>
                                    <p>Generating recommendations...</p>
                                </div>
                            `;
                        }
                        
                        // Get objective
                        const objective = document.getElementById('recommendationsObjective').value;
                        const constraints = {};
                        
                        if (objective === 'targetedOutreach') {
                            // Get selected demographics
                            const selectedDemos = [];
                            document.querySelectorAll('input[name="targetDemo"]:checked').forEach(checkbox => {
                                selectedDemos.push(checkbox.value);
                            });
                            
                            if (selectedDemos.length === 0) {
                                // Show error if no demographics selected
                                if (resultsElement) {
                                    resultsElement.innerHTML = `
                                        <div class="recommendations-error">
                                            <p>Please select at least one demographic group</p>
                                        </div>
                                    `;
                                }
                                return;
                            }
                            
                            constraints.targetDemographics = selectedDemos;
                        }
                        
                        // Add budget constraint if checked
                        if (document.getElementById('budgetConstraint')?.checked) {
                            constraints.budget = 'limited';
                        }
                        
                        // Add time constraint if checked
                        if (document.getElementById('timeConstraint')?.checked) {
                            constraints.timeframe = 'short';
                        }
                        
                        // Use setTimeout to avoid blocking UI
                        setTimeout(() => {
                            try {
                                // Generate recommendations
                                const recommendations = models.outreachEffectiveness.recommendOptimalStrategies(objective, constraints);
                                displayRecommendations(recommendations, objective);
                            } catch (genError) {
                                log.error(genError, { context: 'generateRecommendations' });
                                if (resultsElement) {
                                    resultsElement.innerHTML = `
                                        <div class="recommendations-error">
                                            <p>Error generating recommendations</p>
                                            <button class="retry-button">Try Again</button>
                                        </div>
                                    `;
                                    
                                    // Add retry button functionality
                                    const retryButton = resultsElement.querySelector('.retry-button');
                                    if (retryButton) {
                                        retryButton.addEventListener('click', () => generateButton.click());
                                    }
                                }
                            }
                        }, 500);
                    } catch (error) {
                        log.error(error, { context: 'generateRecommendationsClick' });
                        showUIError("Failed to generate recommendations");
                    }
                });
            }
        } catch (error) {
            log.error(error, { context: 'updateRecommendationsUI' });
            recommendationsElement.innerHTML = `
                <div class="section-error">
                    <p>Unable to load recommendations panel</p>
                    <button class="retry-button" id="retryRecommendationsBtn">Retry</button>
                </div>
            `;
            
            // Add retry functionality
            const retryButton = document.getElementById('retryRecommendationsBtn');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    updateRecommendationsUI();
                });
            }
        }
    }
    
    /**
     * Display generated recommendations
     */
    function displayRecommendations(recommendations, objective) {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        const resultsElement = document.getElementById('recommendationsResults');
        if (!resultsElement) return;
        
        try {
            if (recommendations.length === 0) {
                resultsElement.innerHTML = '<p class="no-recommendations">No recommendations available for the selected criteria.</p>';
                return;
            }
            
            // Create HTML for recommendations
            let title = '';
            if (objective === 'maximizeParticipation') {
                title = 'Top Strategies to Maximize Voter Participation';
            } else if (objective === 'costEfficiency') {
                title = 'Most Cost-Effective Outreach Strategies';
            } else if (objective === 'targetedOutreach') {
                title = 'Targeted Strategies for Selected Demographics';
            }
            
            const recommendationsHTML = `
                <h6>${title}</h6>
                
                <div class="top-recommendations">
                    ${recommendations.slice(0, 5).map((rec, index) => `
                        <div class="top-recommendation">
                            <div class="recommendation-header">
                                <span class="recommendation-number">${index + 1}</span>
                                <h6>${rec.strategy || rec.method || 'Strategy'}</h6>
                            </div>
                            
                            <div class="recommendation-body">
                                ${rec.description ? `<p>${rec.description}</p>` : ''}
                                
                                <div class="recommendation-stats">
                                    ${rec.demographic ? `<span class="recommendation-demographic">Target: ${rec.demographic}</span>` : ''}
                                    ${rec.expectedLift ? `<span class="recommendation-lift">Expected Lift: ${rec.expectedLift.toFixed(1)}%</span>` : ''}
                                    ${rec.cost ? `<span class="cost-tag ${rec.cost.toLowerCase()}">${rec.cost}</span>` : ''}
                                    ${rec.implementationTime ? `<span class="time-tag ${rec.implementationTime.toLowerCase()}">${rec.implementationTime}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                ${recommendations.length > 5 ? `
                    <div class="additional-recommendations">
                        <h6>Additional Strategies</h6>
                        
                        <div class="recommendation-table">
                            <div class="table-header">
                                <div class="table-cell">Strategy</div>
                                <div class="table-cell">Target</div>
                                <div class="table-cell">Expected Lift</div>
                                <div class="table-cell">Cost</div>
                                <div class="table-cell">Timeframe</div>
                            </div>
                            
                            ${recommendations.slice(5).map(rec => `
                                <div class="table-row">
                                    <div class="table-cell">${rec.strategy || rec.method || 'Strategy'}</div>
                                    <div class="table-cell">${rec.demographic || 'All voters'}</div>
                                    <div class="table-cell">${rec.expectedLift ? rec.expectedLift.toFixed(1) + '%' : 'N/A'}</div>
                                    <div class="table-cell">${rec.cost || 'N/A'}</div>
                                    <div class="table-cell">${rec.implementationTime || 'N/A'}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <div class="recommendations-footer">
                    <p><strong>Note:</strong> These recommendations are based on historical data analysis and predictive modeling.</p>
                </div>
            `;
            
            resultsElement.innerHTML = recommendationsHTML;
        } catch (error) {
            log.error(error, { context: 'displayRecommendations' });
            resultsElement.innerHTML = `
                <div class="recommendations-error">
                    <p>Error displaying recommendations</p>
                    <button class="retry-button" id="retryDisplayBtn">Try Again</button>
                </div>
            `;
            
            // Add retry functionality
            const retryButton = document.getElementById('retryDisplayBtn');
            if (retryButton) {
                retryButton.addEventListener('click', () => {
                    try {
                        document.getElementById('generateRecommendationsBtn').click();
                    } catch (error) {
                        log.error(error, { context: 'retryDisplay' });
                    }
                });
            }
        }
    }
    
    /**
     * Create the UI elements for predictive analytics
     */
    function createAnalyticsUIElements() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) {
            log.debug("Skipping UI creation - UI rendering is disabled");
            return;
        }
        
        try {
            // Check if the analytics section already exists
            if (document.getElementById('predictiveAnalyticsDashboard')) {
                log.debug("Analytics dashboard already exists, skipping creation");
                return;
            }
            
            // Create the analytics dashboard section
            const dashboardSection = document.createElement('div');
            dashboardSection.id = 'predictiveAnalyticsDashboard';
            dashboardSection.className = 'predictive-analytics-dashboard';
            
            // Create dashboard content
            dashboardSection.innerHTML = `
                <h3>Predictive Analytics for Voter Engagement</h3>
                
                <div class="dashboard-description">
                    <p>This advanced analytics module uses AI to analyze historical voting data and demographic information to identify patterns in voter engagement and predict future participation rates. Use these insights to develop targeted outreach strategies to increase voter participation.</p>
                </div>
                
                <div class="analytics-grid">
                    <div class="analytics-card" id="participationForecast">
                        <div class="card-loading">
                            <div class="loading-spinner"></div>
                            <p>Generating participation forecast...</p>
                        </div>
                    </div>
                    
                    <div class="analytics-card" id="demographicSegmentation">
                        <div class="card-loading">
                            <div class="loading-spinner"></div>
                            <p>Analyzing demographic segments...</p>
                        </div>
                    </div>
                    
                    <div class="analytics-card" id="engagementFactors">
                        <div class="card-loading">
                            <div class="loading-spinner"></div>
                            <p>Ranking engagement factors...</p>
                        </div>
                    </div>
                    
                    <div class="analytics-card" id="outreachRecommendations">
                        <div class="card-loading">
                            <div class="loading-spinner"></div>
                            <p>Preparing outreach recommendations...</p>
                        </div>
                    </div>
                </div>
                
                ${isProd ? '<div class="environment-badge production">Production Environment</div>' : '<div class="environment-badge development">Development Environment</div>'}
            `;
            
            // Determine where to add the dashboard
            let insertLocation = null;
            
            if (analyticsConfig.dashboardPosition === 'afterVotingResults') {
                // Try to find voting results section
                insertLocation = document.querySelector('#voteAnalysisDashboard') || 
                                document.querySelector('.voting-results') || 
                                document.getElementById('votingResults');
            } else if (analyticsConfig.dashboardPosition === 'beforeResults') {
                // Try to find results section but insert before it
                insertLocation = document.querySelector('#resultsSection') || 
                                document.querySelector('.results-section');
            } else if (analyticsConfig.dashboardPosition === 'end') {
                // Add at the end of main content
                insertLocation = document.querySelector('main') || document.querySelector('body');
                insertLocation.appendChild(dashboardSection);
                return; // No need to use insertBefore
            }
            
            // Insert the dashboard
            if (insertLocation) {
                insertLocation.parentNode.insertBefore(dashboardSection, insertLocation.nextSibling);
            } else {
                // Fallback: add to the main container
                const mainContainer = document.querySelector('main') || document.querySelector('body');
                mainContainer.appendChild(dashboardSection);
            }
            
            // Add dashboard styles
            addDashboardStyles();
        } catch (error) {
            log.error(error, { context: 'createAnalyticsUIElements' });
        }
    }
    
    /**
     * Add CSS styles for the dashboard
     */
    function addDashboardStyles() {
        // Skip if UI rendering is disabled
        if (!analyticsConfig.renderUI) return;
        
        try {
            // Check if styles already added
            if (document.getElementById('predictiveAnalyticsStyles')) {
                return;
            }
            
            const styleElement = document.createElement('style');
            styleElement.id = 'predictiveAnalyticsStyles';
            styleElement.textContent = `
                .predictive-analytics-dashboard {
                    margin-top: 30px;
                    padding: 20px;
                    background-color: #f8f9fa;
                    border-radius: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    position: relative;
                }
                
                .predictive-analytics-dashboard h3 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                    border-bottom: 2px solid #e0e0e0;
                    padding-bottom: 10px;
                }
                
                .dashboard-description {
                    margin-bottom: 20px;
                    color: #555;
                    line-height: 1.5;
                }
                
                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                
                .analytics-card {
                    background-color: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    min-height: 300px;
                    overflow: auto;
                    position: relative;
                }
                
                .card-loading {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    color: #757575;
                }
                
                .loading-spinner {
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3f51b5;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 2s linear infinite;
                    margin-bottom: 15px;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                .section-error {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    height: 100%;
                    color: #dc3545;
                    text-align: center;
                    padding: 20px;
                }
                
                .retry-button {
                    margin-top: 10px;
                    padding: 8px 15px;
                    background-color: #dc3545;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .analytics-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 15px;
                    background-color: #fff;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                    border-radius: 6px;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    animation: slideIn 0.3s forwards;
                }
                
                .analytics-notification.removing {
                    animation: slideOut 0.3s forwards;
                }
                
                .analytics-notification.error {
                    border-left: 5px solid #dc3545;
                }
                
                .notification-icon {
                    margin-right: 10px;
                    font-size: 20px;
                }
                
                .notification-message {
                    flex: 1;
                }
                
                .notification-close {
                    margin-left: 10px;
                    cursor: pointer;
                    font-size: 20px;
                }
                
                @keyframes slideIn {
                    0% { transform: translateX(100%); opacity: 0; }
                    100% { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes slideOut {
                    0% { transform: translateX(0); opacity: 1; }
                    100% { transform: translateX(100%); opacity: 0; }
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
                
                .production-indicator {
                    margin-top: 10px;
                    font-size: 12px;
                    color: #155724;
                    background-color: #d4edda;
                    padding: 5px 10px;
                    border-radius: 4px;
                    text-align: center;
                }
                
                .analytics-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 40px 20px;
                    text-align: center;
                }
                
                .error-icon {
                    font-size: 48px;
                    margin-bottom: 15px;
                }
                
                /* Forecast Panel Styles */
                .forecast-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .forecast-header h5 {
                    margin: 0;
                    color: #333;
                }
                
                .forecast-controls select {
                    padding: 5px 10px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                
                .forecast-main {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    padding: 15px;
                    background-color: #f9f9f9;
                    border-radius: 8px;
                }
                
                .forecast-metric {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .metric-value {
                    font-size: 32px;
                    font-weight: bold;
                    color: #3f51b5;
                    margin-bottom: 5px;
                }
                
                .metric-label {
                    font-size: 14px;
                    color: #555;
                    margin-bottom: 5px;
                }
                
                .metric-ci {
                    font-size: 12px;
                    color: #777;
                }
                
                .forecast-change {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                }
                
                .positive-change {
                    color: #4caf50;
                }
                
                .negative-change {
                    color: #f44336;
                }
                
                .change-arrow {
                    font-size: 24px;
                    margin-bottom: 5px;
                }
                
                .change-value {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .change-label {
                    font-size: 12px;
                }
                
                .forecast-demographics {
                    margin-top: 20px;
                }
                
                .forecast-demographics h5 {
                    margin-top: 0;
                    margin-bottom: 15px;
                    color: #333;
                }
                
                .forecast-tabs {
                    display: flex;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #ddd;
                }
                
                .forecast-tab {
                    padding: 8px 15px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    font-size: 14px;
                    color: #555;
                    border-bottom: 2px solid transparent;
                    margin-right: 10px;
                }
                
                .forecast-tab.active {
                    color: #3f51b5;
                    border-bottom: 2px solid #3f51b5;
                    font-weight: bold;
                }
                
                .demographic-forecast-chart {
                    margin-top: 15px;
                }
                
                .demographic-bar {
                    display: flex;
                    align-items: center;
                    margin-bottom: 12px;
                }
                
                .bar-label {
                    width: 80px;
                    font-size: 14px;
                    text-align: right;
                    padding-right: 10px;
                    color: #555;
                }
                
                .bar-container {
                    flex: 1;
                    height: 24px;
                    background-color: #f1f1f1;
                    border-radius: 3px;
                    overflow: hidden;
                }
                
                .bar-fill {
                    height: 100%;
                    background-color: #3f51b5;
                    display: flex;
                    align-items: center;
                    padding: 0 8px;
                    color: white;
                    font-size: 12px;
                    transition: width 0.3s ease;
                }
                
                /* Segmentation Panel Styles */
                .segmentation-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .segmentation-header h5 {
                    margin: 0;
                    color: #333;
                }
                
                .segmentation-legend {
                    display: flex;
                    gap: 10px;
                    font-size: 12px;
                }
                
                .legend-item {
                    display: flex;
                    align-items: center;
                }
                
                .legend-color {
                    width: 12px;
                    height: 12px;
                    margin-right: 5px;
                    border-radius: 2px;
                }
                
                .legend-color.high {
                    background-color: #4caf50;
                }
                
                .legend-color.medium {
                    background-color: #ff9800;
                }
                
                .legend-color.low {
                    background-color: #9e9e9e;
                }
                
                .segments-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 15px;
                    margin-top: 15px;
                }
                
                .segment-card {
                    border-radius: 6px;
                    padding: 15px;
                    background-color: #f9f9f9;
                    border-left: 5px solid;
                }
                
                .segment-card.high {
                    border-color: #4caf50;
                }
                
                .segment-card.medium {
                    border-color: #ff9800;
                }
                
                .segment-card.low {
                    border-color: #9e9e9e;
                }
                
                .segment-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .segment-header h6 {
                    margin: 0;
                    color: #333;
                }
                
                .segment-rate {
                    font-weight: bold;
                    color: #3f51b5;
                }
                
                .segment-traits {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin-bottom: 10px;
                }
                
                .segment-trait {
                    padding: 3px 6px;
                    background-color: #e1e1e1;
                    border-radius: 3px;
                    font-size: 12px;
                }
                
                .segment-issues h6, .segment-channels h6 {
                    margin: 10px 0 5px;
                    font-size: 12px;
                    color: #555;
                }
                
                .segment-issues ul {
                    margin: 5px 0;
                    padding-left: 20px;
                    font-size: 12px;
                }
                
                .segment-issues li {
                    margin-bottom: 3px;
                }
                
                .channel-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                
                .channel-tag {
                    padding: 3px 6px;
                    background-color: #e8eaf6;
                    color: #3f51b5;
                    border-radius: 3px;
                    font-size: 12px;
                }
                
                .view-recommendations-btn {
                    margin-top: 10px;
                    padding: 5px 10px;
                    background-color: #3f51b5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    width: 100%;
                }
                
                .view-recommendations-btn:hover {
                    background-color: #303f9f;
                }
                
                /* Factors Panel Styles */
                .factors-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .factors-header h5 {
                    margin: 0;
                    color: #333;
                }
                
                .factors-filter select {
                    padding: 5px 10px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                
                .factors-list {
                    margin-top: 15px;
                }
                
                .factor-item {
                    display: flex;
                    align-items: center;
                    padding: 10px;
                    margin-bottom: 8px;
                    border-radius: 6px;
                    background-color: #f5f5f5;
                }
                
                .factor-item.high-impact {
                    border-left: 4px solid #4caf50;
                }
                
                .factor-item.medium-impact {
                    border-left: 4px solid #ff9800;
                }
                
                .factor-item.low-impact {
                    border-left: 4px solid #9e9e9e;
                }
                
                .factor-rank {
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    background-color: #3f51b5;
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-weight: bold;
                    margin-right: 15px;
                }
                
                .factor-details {
                    flex: 1;
                }
                
                .factor-name {
                    margin-bottom: 5px;
                    font-weight: 500;
                }
                
                .factor-impact-bar {
                    height: 8px;
                    background-color: #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .impact-fill {
                    height: 100%;
                    background-color: #3f51b5;
                    transition: width 0.3s ease;
                }
                
                .factor-impact {
                    margin-left: 15px;
                    font-weight: bold;
                    color: #3f51b5;
                }
                
                /* Recommendations Panel Styles */
                .recommendations-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .recommendations-header h5 {
                    margin: 0;
                    color: #333;
                }
                
                .recommendations-controls {
                    display: flex;
                    gap: 10px;
                }
                
                .recommendations-controls select {
                    padding: 5px 10px;
                    border-radius: 4px;
                    border: 1px solid #ddd;
                }
                
                .generate-btn {
                    padding: 5px 15px;
                    background-color: #3f51b5;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .targeting-options {
                    background-color: #f5f5f5;
                    padding: 15px;
                    margin-bottom: 15px;
                    border-radius: 6px;
                }
                
                .targeting-options h6 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    color: #333;
                }
                
                .targeting-checkboxes {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                
                .targeting-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 14px;
                }
                
                .constraint-options {
                    margin-top: 10px;
                }
                
                .constraint-options h6 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    color: #333;
                }
                
                .constraint-row {
                    display: flex;
                    gap: 20px;
                }
                
                .constraint-row label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font-size: 14px;
                }
                
                .recommendations-placeholder {
                    padding: 20px;
                    text-align: center;
                    color: #757575;
                    font-style: italic;
                }
                
                .recommendations-error {
                    padding: 20px;
                    text-align: center;
                    color: #dc3545;
                }
                
                .no-recommendations {
                    padding: 20px;
                    text-align: center;
                    color: #f44336;
                }
                
                .top-recommendations {
                    margin-bottom: 20px;
                }
                
                .top-recommendation {
                    padding: 12px;
                    margin-bottom: 10px;
                    border-radius: 6px;
                    background-color: #f5f5f5;
                }
                
                .recommendation-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                
                .recommendation-number {
                    width: 25px;
                    height: 25px;
                    border-radius: 50%;
                    background-color: #3f51b5;
                    color: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-weight: bold;
                    margin-right: 10px;
                    font-size: 14px;
                }
                
                .recommendation-header h6 {
                    margin: 0;
                    color: #333;
                }
                
                .recommendation-body p {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-size: 14px;
                }
                
                .recommendation-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    font-size: 12px;
                }
                
                .recommendation-demographic {
                    padding: 3px 6px;
                    background-color: #e8eaf6;
                    color: #3f51b5;
                    border-radius: 3px;
                }
                
                .recommendation-lift {
                    padding: 3px 6px;
                    background-color: #e8f5e9;
                    color: #4caf50;
                    border-radius: 3px;
                    font-weight: bold;
                }
                
                .cost-tag, .time-tag {
                    padding: 3px 6px;
                    border-radius: 3px;
                }
                
                .cost-tag.low {
                    background-color: #e8f5e9;
                    color: #4caf50;
                }
                
                .cost-tag.medium {
                    background-color: #fff3e0;
                    color: #ff9800;
                }
                
                .cost-tag.high {
                    background-color: #ffebee;
                    color: #f44336;
                }
                
                .time-tag.short {
                    background-color: #e8f5e9;
                    color: #4caf50;
                }
                
                .time-tag.medium {
                    background-color: #fff3e0;
                    color: #ff9800;
                }
                
                .time-tag.long {
                    background-color: #ffebee;
                    color: #f44336;
                }
                
                .recommendations-footer {
                    margin-top: 15px;
                    padding-top: 15px;
                    border-top: 1px solid #e0e0e0;
                    font-size: 13px;
                    color: #666;
                }
                
                .additional-recommendations h6 {
                    margin-top: 20px;
                    margin-bottom: 10px;
                    color: #333;
                }
                
                .recommendation-table {
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .table-header {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    background-color: #f5f5f5;
                    border-bottom: 1px solid #e0e0e0;
                    font-weight: bold;
                }
                
                .table-row {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .table-row:last-child {
                    border-bottom: none;
                }
                
                .table-cell {
                    padding: 8px 12px;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                }
                
                /* Modal Styles */
                .predictive-modal {
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
                    opacity: 0;
                    animation: fadeIn 0.3s forwards;
                }
                
                .predictive-modal.fade-out {
                    animation: fadeOut 0.3s forwards;
                }
                
                @keyframes fadeIn {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                
                @keyframes fadeOut {
                    0% { opacity: 1; }
                    100% { opacity: 0; }
                }
                
                .modal-content {
                    background-color: white;
                    border-radius: 8px;
                    max-width: 600px;
                    width: 90%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    transform: scale(0.9);
                    animation: scaleIn 0.3s forwards;
                }
                
                @keyframes scaleIn {
                    0% { transform: scale(0.9); }
                    100% { transform: scale(1); }
                }
                
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 15px 20px;
                    border-bottom: 1px solid #e0e0e0;
                }
                
                .modal-header h5 {
                    margin: 0;
                }
                
                .modal-close {
                    font-size: 24px;
                    cursor: pointer;
                    color: #757575;
                }
                
                .modal-body {
                    padding: 20px;
                }
                
                .segment-summary {
                    margin-bottom: 15px;
                    padding: 10px;
                    background-color: #f5f5f5;
                    border-radius: 5px;
                }
                
                .recommendations-list {
                    margin-top: 15px;
                }
                
                .recommendation-item {
                    padding: 15px;
                    margin-bottom: 15px;
                    border-radius: 6px;
                    background-color: #f9f9f9;
                    border-left: 4px solid #3f51b5;
                }
                
                .recommendation-meta {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 10px;
                    margin-top: 10px;
                }
                
                .production-note {
                    margin-top: 20px;
                    padding: 10px;
                    background-color: #e8f5e9;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #4caf50;
                    text-align: center;
                }
                
                /* Responsive Styles */
                @media (max-width: 992px) {
                    .analytics-grid {
                        grid-template-columns: 1fr;
                        gap: 15px;
                    }
                    
                    .segments-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .forecast-main {
                        flex-direction: column;
                        gap: 15px;
                    }
                    
                    .table-header, .table-row {
                        grid-template-columns: 2fr 1fr 1fr;
                    }
                    
                    .table-cell:nth-child(4), .table-cell:nth-child(5) {
                        display: none;
                    }
                    
                    .recommendations-controls {
                        flex-direction: column;
                        gap: 5px;
                    }
                }
            `;
            
            document.head.appendChild(styleElement);
        } catch (error) {
            log.error(error, { context: 'addDashboardStyles' });
        }
    }
    
    /**
     * Helper function to capitalize first letter
     */
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    // Public API
    return {
        initialize,
        generateParticipationForecast,
        recommendOutreachStrategies: function(objective, constraints) {
            try {
                return recommendOutreachStrategies(objective, constraints);
            } catch (error) {
                log.error(error, { context: 'publicAPI.recommendOutreachStrategies' });
                return [];
            }
        },
        getModelData: function() {
            try {
                return {
                    baseline: models.participationPrediction?.baselineParticipation || 50,
                    segments: models.demographicSegmentation?.segments || [],
                    topFactors: models.engagementFactorAnalysis?.rankedFactors?.slice(0, 5) || []
                };
            } catch (error) {
                log.error(error, { context: 'publicAPI.getModelData' });
                return {
                    baseline: 50,
                    segments: [],
                    topFactors: []
                };
            }
        },
        isEnabled: function() {
            return isAnalyticsEnabled && isInitialized;
        },
        refreshUI: function() {
            if (isAnalyticsEnabled && isInitialized && analyticsConfig.renderUI) {
                updatePredictiveAnalyticsUI();
                return true;
            }
            return false;
        }
    };
})();

// Initialize the predictive analytics system when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if initialization should be automatic
    if (config?.predictiveAnalytics?.autoInitialize !== false) {
        try {
            // Initialize predictive analytics system
            window.predictiveAnalytics.initialize().catch(error => {
                log.error(error, { context: 'domContentLoaded.initPredictiveAnalytics' });
            });
        } catch (error) {
            log.error(error, { context: 'domContentLoaded' });
        }
    } else {
        log.info("Automatic initialization of Predictive Analytics is disabled");
    }
});