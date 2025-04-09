/**
 * Multi-Agent Deliberative Democracy (MADD) Framework
 * A research-grade implementation for blockchain voting applications
 * Integrates Groq API for multi-agent deliberation on vote justifications
 */

// Check if production config is available
const useProductionApi = window.productionConfig && window.productionConfig.isProd && 
                         window.productionConfig.featureFlags.useSecureApiProxy;

// Set up logging
const log = window.productionConfig?.log || console;

// Check if the MADD system is enabled in production configuration
const isMaddEnabled = !window.productionConfig?.featureFlags || 
                     window.productionConfig.featureFlags.enableMaddSystem;

// Global state to track deliberation data for research purposes
let deliberationHistory = [];
let consensusMap = {
  agreements: [],
  disagreements: [],
  bridgePositions: [],
  metaConsensus: [],
  timestamp: new Date().toISOString(),
  voterCount: 0
};

// Log initialization status
log.info(`MADD system initializing. Production API: ${useProductionApi}, Enabled: ${isMaddEnabled}`);

/**
 * Agent class - represents a single AI agent with a distinct reasoning profile
 */
class DeliberativeAgent {
  constructor(agentProfile) {
    this.name = agentProfile.name;
    this.reasoningStyle = agentProfile.reasoningStyle;
    this.valueFramework = agentProfile.valueFramework;
    this.description = agentProfile.description;
    this.biasProfile = agentProfile.biasProfile || {};
    this.responseHistory = [];
  }
  
  /**
   * Generate a system prompt for this agent based on its profile
   */
  generateSystemPrompt() {
    return `You are ${this.name}, an AI agent with a ${this.reasoningStyle} reasoning style
    and a value framework centered on ${this.valueFramework}. 
    ${this.description}
    
    IMPORTANT: You must stay true to your reasoning style and values. Do not try to achieve
    consensus simply to be agreeable - represent your distinct perspective faithfully.
    
    Return your response as a structured JSON object with these fields:
    {
      "mainArgument": "Your central argument in 1-2 sentences",
      "keyPoints": ["3-5 bullet points supporting your position"],
      "agreements": ["Points you agree with from other perspectives"],
      "disagreements": ["Points you disagree with from other perspectives"],
      "questions": ["Questions you would ask to clarify other positions"],
      "bridgeProposal": "A potential compromise position that addresses multiple perspectives"
    }`;
  }
  
  /**
   * Generate a user prompt for this agent including the context
   */
  generateUserPrompt(justification, candidateName, otherResponses) {
    let prompt = `Analyze this vote justification for candidate ${candidateName}:
    "${justification}"
    
    `;
    
    if (otherResponses && otherResponses.length > 0) {
      prompt += `Consider these perspectives from other agents:\n\n`;
      otherResponses.forEach(response => {
        if (response && response.agent && response.content) {
          prompt += `${response.agent.name} (${response.agent.reasoningStyle}): ${response.content.mainArgument}\n`;
          if (response.content.keyPoints && response.content.keyPoints.length > 0) {
            prompt += `Key points:\n`;
            response.content.keyPoints.forEach(point => {
              prompt += `- ${point}\n`;
            });
          }
          prompt += `\n`;
        }
      });
    }
    
    prompt += `
    Based on your ${this.reasoningStyle} perspective and value framework centered on ${this.valueFramework},
    analyze this justification and provide your reasoned response.`;
    
    return prompt;
  }
  
  /**
   * Get this agent's response to a justification and other agents' perspectives
   */
  async respondToJustification(justification, candidateName, otherResponses = []) {
    try {
      // Check if we're in demo mode
      if (window.demoMode && window.demoMode.isDemoModeActive() && 
          typeof window.demoMode.getSampleDeliberation === 'function') {
        
        // Get a sample response for this agent from demo mode
        log.info(`Using demo mode for agent ${this.name} response`);
        const demoDeliberation = window.demoMode.getSampleDeliberation(candidateName, this.reasoningStyle);
        
        // Find a response matching this agent's style in the sample
        if (demoDeliberation && demoDeliberation.deliberationRounds && demoDeliberation.deliberationRounds.length > 0) {
          const agentResponse = demoDeliberation.deliberationRounds[0].find(r => 
            r.agent.reasoningStyle === this.reasoningStyle || r.agent.name === this.name
          );
          
          if (agentResponse) {
            // Add to agent's history
            this.responseHistory.push({
              timestamp: new Date().toISOString(),
              justification: justification,
              candidateName: candidateName,
              response: agentResponse.content
            });
            
            return {
              agent: {
                name: this.name,
                reasoningStyle: this.reasoningStyle,
                valueFramework: this.valueFramework
              },
              content: agentResponse.content,
              timestamp: new Date().toISOString()
            };
          }
        }
      }
      
      // If not in demo mode or demo didn't yield results, make a real API call
      const systemPrompt = this.generateSystemPrompt();
      const userPrompt = this.generateUserPrompt(justification, candidateName, otherResponses);
      
      const response = await callGroqAPI(systemPrompt, userPrompt);
      
      // Store in agent's history
      this.responseHistory.push({
        timestamp: new Date().toISOString(),
        justification: justification,
        candidateName: candidateName,
        response: response
      });
      
      return {
        agent: {
          name: this.name,
          reasoningStyle: this.reasoningStyle,
          valueFramework: this.valueFramework
        },
        content: response,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error(error, { context: `agent_${this.name}`, reasoningStyle: this.reasoningStyle });
      return {
        agent: {
          name: this.name,
          reasoningStyle: this.reasoningStyle,
          valueFramework: this.valueFramework
        },
        content: {
          mainArgument: "Error generating response",
          keyPoints: ["Error occurred during deliberation"],
          agreements: [],
          disagreements: [],
          questions: [],
          bridgeProposal: "Unable to generate bridge proposal due to error"
        },
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

/**
 * Initialize the population of deliberative agents
 */
const deliberativeAgents = [
  new DeliberativeAgent({
    name: "Consequentia",
    reasoningStyle: "consequentialist",
    valueFramework: "maximizing overall welfare and minimizing harm",
    description: "You evaluate proposals based on their expected outcomes and consequences. You prioritize actions that create the greatest good for the greatest number of people.",
    biasProfile: { status_quo: 0.2, recency: 0.4 }
  }),
  new DeliberativeAgent({
    name: "Principia",
    reasoningStyle: "deontological",
    valueFramework: "universal principles and moral duties",
    description: "You evaluate actions based on whether they adhere to moral rules and principles, regardless of their outcomes. You believe certain acts are inherently right or wrong.",
    biasProfile: { authority: 0.5, black_and_white: 0.6 }
  }),
  new DeliberativeAgent({
    name: "Libertas",
    reasoningStyle: "rights-based",
    valueFramework: "individual rights and freedoms",
    description: "You prioritize the protection of individual rights and believe these rights cannot be sacrificed even for the greater good. You're especially concerned with minority protections.",
    biasProfile: { individualism: 0.7 }
  }),
  new DeliberativeAgent({
    name: "Communis",
    reasoningStyle: "communitarian",
    valueFramework: "community values and shared goals",
    description: "You emphasize the importance of community bonds, shared values, and collective identity. You believe individual interests should sometimes yield to community welfare.",
    biasProfile: { in_group: 0.6, conformity: 0.4 }
  }),
  new DeliberativeAgent({
    name: "Empirica",
    reasoningStyle: "empirical",
    valueFramework: "evidence and data-driven decision making",
    description: "You prioritize verifiable evidence and demand data to support claims. You're skeptical of arguments based purely on values or principles without empirical backing.",
    biasProfile: { quantification: 0.5 }
  }),
  new DeliberativeAgent({
    name: "Futura", 
    reasoningStyle: "future-oriented",
    valueFramework: "long-term sustainability and future generations",
    description: "You consider the long-term implications of decisions, especially how they affect future generations. You value sustainability and are willing to sacrifice short-term gains.",
    biasProfile: { present_bias: -0.6 }
  }),
  new DeliberativeAgent({
    name: "Critica",
    reasoningStyle: "critical",
    valueFramework: "rigorous scrutiny and identification of weaknesses",
    description: "You probe for weaknesses in all arguments, regardless of position. You believe the best decisions emerge from thorough criticism and revision of proposals.",
    biasProfile: { negativity: 0.4, contrarian: 0.5 }
  })
];

/**
 * Orchestrate a multi-turn deliberation among the agents
 */
async function orchestrateDeliberation(humanJustification, candidateName) {
  log.info("Starting deliberation process", { candidateName, justificationLength: humanJustification.length });
  
  // Check if MADD system is disabled in production
  if (!isMaddEnabled) {
    log.warn("MADD system is disabled in production configuration");
    throw new Error("Multi-Agent Deliberative Democracy system is disabled in the current configuration");
  }

  // Check if we're in demo mode
  if (window.demoMode && window.demoMode.isDemoModeActive() && 
      typeof window.demoMode.getSampleDeliberation === 'function') {
    
    log.info("Using demo mode for deliberation");
    
    // Get a sample deliberation from demo mode
    try {
      const sampleDeliberation = window.demoMode.getSampleDeliberation(candidateName, getJustificationType(humanJustification));
      if (sampleDeliberation) {
        // Add to history for tracking
        deliberationHistory.push(sampleDeliberation);
        return sampleDeliberation;
      }
    } catch (demoError) {
      log.error(demoError, { context: 'demoDeliberation' });
      // Continue with normal flow if demo fails
    }
  }
  
  // Phase 1: Initial agent responses to human justification
  console.log("Phase 1: Initial agent responses");
  const initialResponses = await Promise.all(
    deliberativeAgents.map(agent => 
      agent.respondToJustification(humanJustification, candidateName, [])
    )
  );
  
  // Phase 2: Cross-agent deliberation (2 additional turns)
  console.log("Phase 2: Cross-agent deliberation");
  let currentResponses = initialResponses;
  const deliberationRounds = [currentResponses];
  
  for (let turn = 0; turn < 2; turn++) {
    console.log(`Deliberation turn ${turn + 1}`);
    currentResponses = await Promise.all(
      deliberativeAgents.map((agent, i) => 
        agent.respondToJustification(
          humanJustification,
          candidateName,
          deliberationRounds.flatMap(responses => 
            responses.filter((_, j) => j !== i)
          )
        )
      )
    );
    deliberationRounds.push(currentResponses);
  }
  
  // Phase 3: Meta-analysis and synthesis
  console.log("Phase 3: Meta-analysis and synthesis");
  const deliberativeSynthesis = await synthesizeDeliberation(
    humanJustification,
    deliberationRounds,
    candidateName
  );
  
  // Phase 4: Update consensus map
  console.log("Phase 4: Update consensus map");
  const updatedConsensusMap = await updateConsensusMap(
    deliberativeSynthesis,
    consensusMap
  );
  
  // Store the complete deliberation for research purposes
  const fullDeliberation = {
    humanJustification,
    candidateName,
    deliberationRounds,
    deliberativeSynthesis,
    consensusMap: updatedConsensusMap,
    timestamp: new Date().toISOString()
  };
  
  deliberationHistory.push(fullDeliberation);
  consensusMap = updatedConsensusMap;
  
  return fullDeliberation;
}

/**
 * Helper function to determine justification type for demo mode
 */
function getJustificationType(justification) {
  const text = justification.toLowerCase();
  
  if (text.includes("econom") || text.includes("fiscal") || text.includes("budget") || text.includes("tax")) {
    return "Economic";
  } else if (text.includes("environment") || text.includes("climate") || text.includes("green")) {
    return "Environmental";
  } else if (text.includes("social") || text.includes("healthcare") || text.includes("education")) {
    return "Social";
  } else if (text.includes("foreign") || text.includes("international") || text.includes("security")) {
    return "Foreign";
  } else if (text.includes("technolog") || text.includes("digital") || text.includes("innovation")) {
    return "Technology";
  }
  
  return null;
}

/**
 * Synthesize the multi-agent deliberation into a coherent summary
 */
async function synthesizeDeliberation(justification, deliberationRounds, candidateName) {
  try {
    const systemPrompt = `You are a meta-analysis agent responsible for synthesizing a multi-agent deliberation process. 
    Your task is to identify the strongest arguments, areas of consensus and disagreement, and potential bridge positions.
    Respond with a structured JSON object containing your analysis.`;
    
    let userPrompt = `Analyze this multi-agent deliberation about a vote justification for candidate ${candidateName}:
    
    Original justification: "${justification}"
    
    Deliberation history:
    `;
    
    // Format the deliberation history for the prompt
    deliberationRounds.forEach((round, roundIndex) => {
      userPrompt += `\nRound ${roundIndex + 1}:\n`;
      round.forEach(response => {
        userPrompt += `${response.agent.name} (${response.agent.reasoningStyle}): ${response.content.mainArgument}\n`;
        if (response.content.keyPoints && response.content.keyPoints.length > 0) {
          userPrompt += `Key points:\n`;
          response.content.keyPoints.forEach(point => {
            userPrompt += `- ${point}\n`;
          });
        }
        userPrompt += `\n`;
      });
    });
    
    userPrompt += `
    Based on this deliberation, provide:
    1. A summary of the strongest arguments from each perspective
    2. Areas of consensus that emerged across different reasoning styles
    3. Core disagreements that persisted throughout the deliberation
    4. Potential bridge positions that could accommodate multiple perspectives
    5. A meta-level analysis of the reasoning quality and deliberative patterns
    
    Return your analysis as a JSON object with these fields:
    {
      "summary": "Overall summary of the deliberation",
      "strongestArguments": [{"agent": "agent name", "argument": "argument summary"}],
      "consensusAreas": ["list of points with broad agreement"],
      "coreDisagreements": ["list of fundamental points of contention"],
      "bridgePositions": ["potential compromise positions"],
      "metaAnalysis": "analysis of reasoning patterns and deliberative quality",
      "researchImplications": ["implications for democratic theory and governance"]
    }`;
    
    const response = await callGroqAPI(systemPrompt, userPrompt);
    
    return {
      ...response,
      timestamp: new Date().toISOString(),
      justification: justification,
      candidateName: candidateName
    };
  } catch (error) {
    log.error(error, { context: 'synthesizeDeliberation', candidateName });
    return {
      summary: "Error occurred during deliberation synthesis",
      strongestArguments: [],
      consensusAreas: [],
      coreDisagreements: [],
      bridgePositions: [],
      metaAnalysis: "Could not complete meta-analysis due to an error",
      researchImplications: [],
      timestamp: new Date().toISOString(),
      error: error.message
    };
  }
}

/**
 * Update the global consensus map based on new deliberation
 */
async function updateConsensusMap(deliberativeSynthesis, currentConsensusMap) {
  try {
    const systemPrompt = `You are a consensus mapping agent responsible for tracking how collective understanding evolves across multiple deliberations.
    Your task is to update a consensus map with new insights from a recent deliberation.`;
    
    const userPrompt = `Current consensus map:
    ${JSON.stringify(currentConsensusMap, null, 2)}
    
    New deliberative synthesis:
    ${JSON.stringify(deliberativeSynthesis, null, 2)}
    
    Update the consensus map to incorporate insights from this new deliberation.
    Preserve existing consensus points that remain valid, remove any that have been invalidated,
    and add new points that emerged from this deliberation.
    
    Return the updated consensus map as a JSON object with these fields:
    {
      "agreements": ["Points with broad consensus across deliberations"],
      "disagreements": ["Fundamental points of contention across deliberations"],
      "bridgePositions": ["Potential compromise positions that address multiple perspectives"],
      "metaConsensus": ["Areas where there is agreement about the nature of disagreements"],
      "emergingPatterns": ["Patterns in reasoning or argumentation across deliberations"],
      "researchInsights": ["Implications for democratic theory and collective decision-making"]
    }`;
    
    const response = await callGroqAPI(systemPrompt, userPrompt);
    
    return {
      ...response,
      timestamp: new Date().toISOString(),
      voterCount: (currentConsensusMap.voterCount || 0) + 1
    };
  } catch (error) {
    log.error(error, { context: 'updateConsensusMap' });
    // If there's an error, return the current map with minimal changes
    return {
      ...currentConsensusMap,
      timestamp: new Date().toISOString(),
      voterCount: (currentConsensusMap.voterCount || 0) + 1,
      error: error.message
    };
  }
}

/**
 * Call the Groq API with system and user prompts - securely through proxy in production
 */
async function callGroqAPI(systemPrompt, userPrompt) {
  try {
    // Use secure API proxy if available and configured for production
    if (useProductionApi) {
      log.debug("Making secure API call for MADD system");
      const response = await window.productionConfig.secureGroqApiCall(userPrompt, systemPrompt);
      
      // In production mode, the response should already be a JSON object
      return response;
    } 
    // Fall back to demo mode if available
    else if (window.demoMode && window.demoMode.isDemoModeActive()) {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a plausible response format similar to what the real API would return
      const demoResponse = {
        mainArgument: "This is a simulated response for the MADD system in demo mode",
        keyPoints: ["Demo mode is active", "No actual API call was made"],
        agreements: ["Demo mode can be used for testing without API keys"],
        disagreements: ["Demo mode cannot provide actual AI analysis"],
        bridgeProposal: "Use demo mode for development and secure API for production"
      };
      
      return demoResponse;
    } 
    // Fallback for development without demo mode
    else {
      log.warn("No secure API proxy configured and demo mode not active - MADD analysis will be limited");
      throw new Error("MADD API access not configured. Enable demo mode to see simulated results.");
    }
  } catch (error) {
    // If we get a string response that needs parsing
    if (error.message && error.message.includes("SyntaxError") && typeof systemPrompt === 'string') {
      try {
        log.debug("Attempting to parse string response as JSON");
        return JSON.parse(systemPrompt);
      } catch (parseError) {
        log.error(parseError, { context: 'parseGroqResponse' });
        log.debug("Raw response that failed parsing:", systemPrompt.substring(0, 200) + '...');
        
        // Attempt fallback parsing for malformed JSON
        return extractJSONFromText(systemPrompt);
      }
    }
    
    log.error(error, { context: 'callGroqAPI' });
    throw error;
  }
}

/**
 * Fallback function to attempt extraction of JSON from partially malformed text
 */
function extractJSONFromText(text) {
  try {
    // Try to find content between curly braces, assuming it's JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    
    // If no JSON structure found, create a basic object with the text
    return {
      mainArgument: text.substring(0, 200) + "...",
      keyPoints: ["Could not parse structured response"],
      error: "Malformed response from API"
    };
  } catch (error) {
    log.error(error, { context: 'extractJSONFromText' });
    return {
      mainArgument: "Error parsing response",
      keyPoints: ["Response could not be structured properly"],
      error: error.message
    };
  }
}

/**
 * Get deliberation metrics for research purposes
 */
function getDeliberationMetrics() {
  if (deliberationHistory.length === 0) {
    return {
      deliberationCount: 0,
      averageTurns: 0,
      consensusRate: 0,
      argumentQuality: 0,
      crossPerspectiveIntegration: 0,
      bridgePositionGeneration: 0
    };
  }
  
  // Calculate basic metrics
  const metrics = {
    deliberationCount: deliberationHistory.length,
    averageTurns: deliberationHistory.reduce((sum, d) => sum + (d.deliberationRounds ? d.deliberationRounds.length : 0), 0) / deliberationHistory.length,
    consensusRate: consensusMap.agreements.length / (consensusMap.agreements.length + consensusMap.disagreements.length || 1),
    argumentQuality: 0, // Would need a specific evaluation function
    crossPerspectiveIntegration: 0, // Would need content analysis
    bridgePositionGeneration: deliberationHistory.reduce((sum, d) => sum + (d.deliberativeSynthesis?.bridgePositions?.length || 0), 0) / deliberationHistory.length
  };
  
  return metrics;
}

/**
 * Render the deliberation visualization UI
 */
function renderDeliberationUI(deliberation, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    log.error(new Error(`Deliberation UI container not found`), { containerId });
    return;
  }
  
  // Create HTML for the deliberation timeline
  let timelineHTML = `
    <div class="deliberation-header">
      <h3>Multi-Agent Deliberative Process</h3>
      <p><strong>Original Justification:</strong> "${deliberation.humanJustification}"</p>
      <p><strong>Candidate:</strong> ${deliberation.candidateName}</p>
      <p><strong>Timestamp:</strong> ${new Date(deliberation.timestamp).toLocaleString()}</p>
    </div>
  `;
  
  // Add each round of deliberation
  deliberation.deliberationRounds.forEach((round, roundIndex) => {
    timelineHTML += `
      <div class="deliberation-round">
        <h4>Deliberation Round ${roundIndex + 1}</h4>
        <div class="agent-responses">
    `;
    
    round.forEach(response => {
      const agent = response.agent;
      const content = response.content;
      
      timelineHTML += `
        <div class="agent-response ${agent.reasoningStyle}">
          <div class="agent-header">
            <span class="agent-name">${agent.name}</span>
            <span class="agent-type">${agent.reasoningStyle}</span>
          </div>
          <p class="main-argument">${content.mainArgument || 'No main argument provided'}</p>
          
          <div class="key-points">
            <h5>Key Points:</h5>
            <ul>
              ${(content.keyPoints || []).map(point => `<li>${point}</li>`).join('')}
            </ul>
          </div>
          
          ${content.agreements && content.agreements.length > 0 ? `
          <div class="agreements">
            <h5>Points of Agreement:</h5>
            <ul>
              ${content.agreements.map(point => `<li>${point}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${content.disagreements && content.disagreements.length > 0 ? `
          <div class="disagreements">
            <h5>Points of Disagreement:</h5>
            <ul>
              ${content.disagreements.map(point => `<li>${point}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          ${content.bridgeProposal ? `
          <div class="bridge-proposal">
            <h5>Bridge Proposal:</h5>
            <p>${content.bridgeProposal}</p>
          </div>
          ` : ''}
        </div>
      `;
    });
    
    timelineHTML += `
        </div>
      </div>
    `;
  });
  
  // Add the synthesis
  if (deliberation.deliberativeSynthesis) {
    const synthesis = deliberation.deliberativeSynthesis;
    
    timelineHTML += `
      <div class="deliberation-synthesis">
        <h4>Deliberative Synthesis</h4>
        
        <div class="synthesis-section">
          <h5>Summary</h5>
          <p>${synthesis.summary || 'No summary available'}</p>
        </div>
        
        <div class="synthesis-section">
          <h5>Strongest Arguments</h5>
          <ul>
            ${(synthesis.strongestArguments || []).map(item => 
              `<li><strong>${item.agent || 'Unknown'}:</strong> ${item.argument || 'No argument'}</li>`
            ).join('')}
          </ul>
        </div>
        
        <div class="synthesis-columns">
          <div class="synthesis-column">
            <h5>Consensus Areas</h5>
            <ul>
              ${(synthesis.consensusAreas || []).map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          
          <div class="synthesis-column">
            <h5>Core Disagreements</h5>
            <ul>
              ${(synthesis.coreDisagreements || []).map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <div class="synthesis-section">
          <h5>Bridge Positions</h5>
          <ul>
            ${(synthesis.bridgePositions || []).map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
        
        <div class="synthesis-section">
          <h5>Meta-Analysis</h5>
          <p>${synthesis.metaAnalysis || 'No meta-analysis available'}</p>
        </div>
        
        <div class="synthesis-section">
          <h5>Research Implications</h5>
          <ul>
            ${(synthesis.researchImplications || []).map(item => `<li>${item}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
  
  // Render to container
  container.innerHTML = timelineHTML;
}

/**
 * Render the consensus map visualization
 */
function renderConsensusMap(consensusMap, containerId) {
  const container = document.getElementById(containerId);
  if (!container) {
    log.error(new Error(`Consensus map container not found`), { containerId });
    return;
  }
  
  let consensusHTML = `
    <div class="consensus-header">
      <h3>Dynamic Consensus Map</h3>
      <p><strong>Last Updated:</strong> ${new Date(consensusMap.timestamp).toLocaleString()}</p>
      <p><strong>Based on ${consensusMap.voterCount || 0} voter${consensusMap.voterCount !== 1 ? 's' : ''}</strong></p>
    </div>
    
    <div class="consensus-columns">
      <div class="consensus-column agreements">
        <h4>Points of Agreement</h4>
        <ul>
          ${(consensusMap.agreements || []).length > 0 
            ? consensusMap.agreements.map(item => `<li>${item}</li>`).join('') 
            : '<li>No consensus points identified yet</li>'}
        </ul>
      </div>
      
      <div class="consensus-column disagreements">
        <h4>Points of Disagreement</h4>
        <ul>
          ${(consensusMap.disagreements || []).length > 0 
            ? consensusMap.disagreements.map(item => `<li>${item}</li>`).join('') 
            : '<li>No disagreement points identified yet</li>'}
        </ul>
      </div>
    </div>
    
    <div class="consensus-row">
      <h4>Potential Bridge Positions</h4>
      <ul>
        ${(consensusMap.bridgePositions || []).length > 0 
          ? consensusMap.bridgePositions.map(item => `<li>${item}</li>`).join('') 
          : '<li>No bridge positions identified yet</li>'}
      </ul>
    </div>
    
    <div class="consensus-row">
      <h4>Meta-Consensus</h4>
      <ul>
        ${(consensusMap.metaConsensus || []).length > 0 
          ? consensusMap.metaConsensus.map(item => `<li>${item}</li>`).join('') 
          : '<li>No meta-consensus identified yet</li>'}
      </ul>
    </div>
    
    ${consensusMap.emergingPatterns ? `
    <div class="consensus-row">
      <h4>Emerging Patterns</h4>
      <ul>
        ${(consensusMap.emergingPatterns || []).length > 0 
          ? consensusMap.emergingPatterns.map(item => `<li>${item}</li>`).join('') 
          : '<li>No emerging patterns identified yet</li>'}
      </ul>
    </div>
    ` : ''}
    
    ${consensusMap.researchInsights ? `
    <div class="consensus-row">
      <h4>Research Insights</h4>
      <ul>
        ${(consensusMap.researchInsights || []).length > 0 
          ? consensusMap.researchInsights.map(item => `<li>${item}</li>`).join('') 
          : '<li>No research insights identified yet</li>'}
      </ul>
    </div>
    ` : ''}
  `;
  
  container.innerHTML = consensusHTML;
}

// Export functions for use in the main application
window.maddSystem = {
  orchestrateDeliberation,
  getDeliberationHistory: () => deliberationHistory,
  getCurrentConsensusMap: () => consensusMap,
  getDeliberationMetrics,
  renderDeliberationUI,
  renderConsensusMap,
  agentProfiles: deliberativeAgents.map(agent => ({
    name: agent.name,
    reasoningStyle: agent.reasoningStyle,
    valueFramework: agent.valueFramework,
    description: agent.description
  }))
};

log.info("Multi-Agent Deliberative Democracy (MADD) framework loaded");