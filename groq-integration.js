// Groq API Integration for Argumentative Analysis of Vote Justifications
// Research-grade analysis of voting patterns and reasoning

let justificationAnalyses = []; // Store analyses for research purposes

// Check if production config is available
const useProductionApi = window.productionConfig && window.productionConfig.isProd && 
                         window.productionConfig.featureFlags.useSecureApiProxy;

// Set up logging
const log = window.productionConfig?.log || console;

// Initialize the Groq client via secure API proxy
async function analyzeJustification(voter, candidate, justification) {
  if (!justification || justification.trim() === '') return null;
  
  log.info(`Analyzing justification from ${voter} for ${candidate}: "${justification}"`);
  
  try {
    // Check if we should use demo mode
    if (window.demoMode && window.demoMode.isDemoModeActive()) {
      // Get demo analysis from the demo module
      const demoResults = await window.demoMode.runDemoAnalysis(justification, candidate);
      return demoResults.analysis;
    }
    
    // Argument Structure Extraction
    const argumentAnalysis = await extractArgumentStructure(justification, candidate);
    
    // Bias Detection
    const biasAnalysis = await detectCognitiveBiases(justification, argumentAnalysis);
    
    // Generate Research Insights
    const researchInsights = await generateResearchInsights(argumentAnalysis, biasAnalysis, candidate);
    
    // Combine all analyses
    const fullAnalysis = {
      voter: voter,
      candidate: candidate,
      timestamp: new Date().toISOString(),
      rawJustification: justification,
      argumentAnalysis: argumentAnalysis,
      biasAnalysis: biasAnalysis,
      researchInsights: researchInsights
    };
    
    // Store for research
    justificationAnalyses.push(fullAnalysis);
    
    // Update consensus model
    await updateConsensusModel();
    
    // Return the full analysis
    return fullAnalysis;
  } catch (error) {
    log.error(error, { context: 'analyzeJustification', voter, candidate });
    
    // Fallback to demo mode if available and not already in demo mode
    if (window.demoMode && !window.demoMode.isDemoModeActive() && 
        typeof window.demoMode.runDemoAnalysis === 'function') {
      log.warn("Falling back to demo mode for analysis due to error");
      try {
        const demoResults = await window.demoMode.runDemoAnalysis(justification, candidate);
        return demoResults.analysis;
      } catch (demoError) {
        log.error(demoError, { context: 'demoModeFallback' });
      }
    }
    
    return { error: error.message };
  }
}

// Extract the argument structure from a justification
async function extractArgumentStructure(justification, candidate) {
  const prompt = `
    Analyze the following vote justification for candidate ${candidate}:
    "${justification}"
    
    Extract and structure the argument into:
    1. Main claim (the voter's position)
    2. Key premises (supporting reasons)
    3. Implicit assumptions
    4. Logical structure (deductive, inductive, abductive)
    5. Evidence types referenced (empirical, testimonial, logical, etc.)
    
    Return ONLY a JSON object with these fields.
  `;
  
  const response = await callGroqAPI(prompt);
  let structuredArgument;
  
  try {
    // Parse the response to get the JSON object
    structuredArgument = JSON.parse(response);
  } catch (e) {
    log.error(e, { context: 'extractArgumentStructure', response });
    structuredArgument = {
      mainClaim: "Could not extract",
      keyPremises: [],
      implicitAssumptions: [],
      logicalStructure: "unknown",
      evidenceTypes: []
    };
  }
  
  return structuredArgument;
}

// Detect cognitive biases in the justification
async function detectCognitiveBiases(justification, argumentAnalysis) {
  const prompt = `
    Analyze the following vote justification for cognitive biases:
    "${justification}"
    
    Identify any of the following cognitive biases:
    1. Confirmation bias
    2. In-group favoritism
    3. Authority bias
    4. Availability heuristic
    5. Status quo bias
    6. Bandwagon effect
    7. Other notable biases
    
    For each detected bias:
    - Provide a confidence score (0-1)
    - Cite the specific text that exhibits the bias
    - Explain why it constitutes that bias
    
    Return ONLY a JSON object with an array of detected biases.
  `;
  
  const response = await callGroqAPI(prompt);
  let biasAnalysis;
  
  try {
    biasAnalysis = JSON.parse(response);
  } catch (e) {
    log.error(e, { context: 'detectCognitiveBiases', response });
    biasAnalysis = { 
      detectedBiases: [],
      overallBiasScore: 0
    };
  }
  
  return biasAnalysis;
}

// Generate research insights
async function generateResearchInsights(argumentAnalysis, biasAnalysis, candidate) {
  const prompt = `
    Based on the following argument analysis and bias detection for a vote for candidate ${candidate}:
    
    Argument Analysis: ${JSON.stringify(argumentAnalysis)}
    Bias Analysis: ${JSON.stringify(biasAnalysis)}
    
    Generate research insights:
    1. Argument quality score (0-10) with explanation
    2. Key areas where reasoning could be improved
    3. Most significant pattern in this voter's reasoning
    4. How this justification compares to typical justifications in democratic processes
    5. Research implications of this reasoning pattern
    
    Return ONLY a JSON object with these fields.
  `;
  
  const response = await callGroqAPI(prompt);
  let researchInsights;
  
  try {
    researchInsights = JSON.parse(response);
  } catch (e) {
    log.error(e, { context: 'generateResearchInsights', response });
    researchInsights = {
      argumentQuality: {
        score: 0,
        explanation: "Could not analyze"
      },
      improvementAreas: [],
      significantPattern: "Unknown",
      democraticComparisonInsight: "Not available",
      researchImplications: []
    };
  }
  
  return researchInsights;
}

// Update the consensus model based on all analyses
async function updateConsensusModel() {
  if (justificationAnalyses.length < 2) return {}; // Need at least 2 justifications
  
  const recentAnalyses = justificationAnalyses.slice(-20); // Use the most recent 20 analyses
  
  const prompt = `
    Analyze the following collection of voting arguments to identify potential consensus patterns:
    
    Argument Analyses: ${JSON.stringify(recentAnalyses)}
    
    Identify:
    1. Key points of agreement across voters for different candidates
    2. Core disagreements and their underlying reasons
    3. Potential bridge positions that accommodate multiple perspectives
    4. Meta-level consensus (agreement about what they disagree about)
    5. Emerging novel positions not explicitly stated by any voter
    
    Return ONLY a JSON object with these categories.
  `;
  
  const response = await callGroqAPI(prompt);
  let consensusMap;
  
  try {
    consensusMap = JSON.parse(response);
    consensusMap.timestamp = new Date().toISOString();
    consensusMap.voterCount = justificationAnalyses.length;
    window.currentConsensusMap = consensusMap; // Store globally for access
  } catch (e) {
    log.error(e, { context: 'updateConsensusModel', response });
    consensusMap = {
      error: "Could not generate consensus map",
      timestamp: new Date().toISOString()
    };
  }
  
  return consensusMap;
}

// Make a call to the Groq API - securely through proxy in production
async function callGroqAPI(prompt, systemMessage = null) {
  // Use secure API proxy if available and configured for production
  if (useProductionApi) {
    try {
      const systemContent = systemMessage || 
        "You are a research assistant specialized in analyzing argumentation and voting behavior. Respond with JSON only.";
      
      return await window.productionConfig.secureGroqApiCall(prompt, systemContent);
    } catch (error) {
      log.error(error, { context: 'callGroqAPI', prompt: prompt.substring(0, 100) + '...' });
      throw error;
    }
  } 
  // Fall back to demo mode if available
  else if (window.demoMode && window.demoMode.isDemoModeActive()) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return sample data that's formatted as a string (to mimic API response format)
    return JSON.stringify({
      mainClaim: "Demo mode sample response",
      keyPremises: ["This is a simulated API response", "No actual API call was made"],
      logicalStructure: "simulated",
      evidenceTypes: ["demo"]
    });
  }
  // Fallback for development without demo mode
  else {
    log.warn("No secure API proxy configured and demo mode not active - analysis will be limited");
    throw new Error("Groq API access not configured. Enable demo mode to see simulated results.");
  }
}

// Get all justification analyses
function getJustificationAnalyses() {
  return justificationAnalyses;
}

// Get the current consensus map
function getCurrentConsensusMap() {
  return window.currentConsensusMap || {};
}

// Clear analyses (for testing)
function clearAnalyses() {
  justificationAnalyses = [];
  window.currentConsensusMap = null;
}

// Deliberative metrics calculation
function calculateDeliberativeMetrics() {
  if (justificationAnalyses.length === 0) {
    return {
      argumentQualityAverage: 0,
      biasPrevalence: 0,
      evidenceTypeDistribution: {},
      reasoningPatterns: {},
      consensusDistance: 0
    };
  }
  
  // Calculate average argument quality
  const argumentQualityAverage = justificationAnalyses
    .filter(analysis => analysis.researchInsights && analysis.researchInsights.argumentQuality)
    .reduce((sum, analysis) => sum + analysis.researchInsights.argumentQuality.score, 0) / 
    justificationAnalyses.length;
  
  // Calculate bias prevalence
  const biasPrevalence = justificationAnalyses
    .filter(analysis => analysis.biasAnalysis && analysis.biasAnalysis.detectedBiases)
    .reduce((sum, analysis) => sum + analysis.biasAnalysis.detectedBiases.length, 0) / 
    justificationAnalyses.length;
  
  // Calculate evidence type distribution
  const evidenceTypeDistribution = {};
  justificationAnalyses.forEach(analysis => {
    if (analysis.argumentAnalysis && analysis.argumentAnalysis.evidenceTypes) {
      analysis.argumentAnalysis.evidenceTypes.forEach(evidenceType => {
        evidenceTypeDistribution[evidenceType] = (evidenceTypeDistribution[evidenceType] || 0) + 1;
      });
    }
  });
  
  // Calculate reasoning patterns
  const reasoningPatterns = {};
  justificationAnalyses.forEach(analysis => {
    if (analysis.argumentAnalysis && analysis.argumentAnalysis.logicalStructure) {
      const structure = analysis.argumentAnalysis.logicalStructure;
      reasoningPatterns[structure] = (reasoningPatterns[structure] || 0) + 1;
    }
  });
  
  // A simplified consensus distance metric (placeholder)
  const consensusDistance = 0.5; // Would be calculated based on the consensus map
  
  return {
    argumentQualityAverage,
    biasPrevalence,
    evidenceTypeDistribution,
    reasoningPatterns,
    consensusDistance
  };
}

// Export the functions
window.groqAnalysis = {
  analyzeJustification,
  getJustificationAnalyses,
  getCurrentConsensusMap,
  clearAnalyses,
  calculateDeliberativeMetrics
};