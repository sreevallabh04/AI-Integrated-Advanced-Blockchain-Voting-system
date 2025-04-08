/**
 * Production Configuration Module
 * 
 * This module provides configuration and setup for production deployment of the voting application.
 * It handles secure API key management, network configuration, feature flags, and error reporting.
 * It integrates with real Ethereum wallets for blockchain interactions.
 */

// Production configuration object
const productionConfig = (() => {
  // Environment detection
  const isProd = window.location.hostname !== 'localhost' && 
                !window.location.hostname.includes('127.0.0.1') &&
                !window.location.hostname.includes('.local');
  
  // Try to load deployed contract address from environment or localStorage
  const getDeployedContractAddress = (network) => {
    // Check for a stored contract address (updated after deployment)
    const storedAddress = localStorage.getItem(`CONTRACT_ADDRESS_${network.toUpperCase()}`);
    if (storedAddress) return storedAddress;
    
    // Return empty string if not found
    return '';
  };
  
  // Default network configurations
  const networks = {
    // Ethereum Mainnet
    mainnet: {
      name: 'Ethereum Mainnet',
      rpcUrl: '', // Will be fetched from wallet provider or .env in backend
      chainId: '0x1',
      contractAddress: getDeployedContractAddress('mainnet'),
      blockExplorer: 'https://etherscan.io'
    },
    // Goerli Testnet
    goerli: {
      name: 'Goerli Testnet',
      rpcUrl: '', // Will be fetched from wallet provider or .env in backend
      chainId: '0x5',
      contractAddress: getDeployedContractAddress('goerli'),
      blockExplorer: 'https://goerli.etherscan.io'
    },
    // Sepolia Testnet
    sepolia: {
      name: 'Sepolia Testnet',
      rpcUrl: '', // Will be fetched from wallet provider or .env in backend
      chainId: '0xaa36a7',
      contractAddress: getDeployedContractAddress('sepolia'),
      blockExplorer: 'https://sepolia.etherscan.io'
    },
    // Local development (Hardhat)
    localhost: {
      name: 'Local Hardhat Node',
      rpcUrl: 'http://127.0.0.1:8545',
      chainId: '0x539',
      contractAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9', // Local deployment address
      blockExplorer: ''
    }
  };
  
  // Feature flags for enabling/disabling features in production
  const featureFlags = {
    enableGroqIntegration: true,      // Enable/disable Groq API integration
    enableZkpIntegration: true,       // Enable/disable ZKP functionality
    enableMaddSystem: true,           // Enable/disable Multi-Agent Deliberative Democracy
    enableDemoMode: !isProd,          // Demo mode disabled by default in production
    enableConsoleLogging: !isProd,    // Disable verbose console logging in production
    useSecureApiProxy: isProd,        // Use API proxy in production
    useLocalZkpComputation: true,     // Compute ZKP locally rather than server-side
    requireWalletConnection: true,    // Require real wallet connection (now always true)
    enableFaceAuth: true,             // Enable facial authentication
    enableContractAddressUpdate: true // Allow updating contract address after deployment
  };
  
  // Current network - start with default but will be updated based on wallet
  let currentNetwork = isProd ? 'sepolia' : 'localhost';
  
  // Secure API configuration
  const apiConfig = {
    // Base URL for the secure API proxy
    baseUrl: isProd 
      ? 'https://your-api-proxy-endpoint.com/api/v1' // Replace with your secure API proxy
      : 'http://localhost:3000/api',
    
    // Endpoints
    endpoints: {
      groqAnalysis: '/analysis',
      maddDeliberation: '/deliberation',
      zkpVerification: '/verify-proof'
    },
    
    // Request headers factory (adds auth tokens if available)
    getHeaders: () => {
      const headers = {
        'Content-Type': 'application/json'
      };
      
      // Add authorization if available
      const userToken = localStorage.getItem('user_auth_token');
      if (userToken) {
        headers['Authorization'] = `Bearer ${userToken}`;
      }
      
      return headers;
    }
  };
  
  // Error reporting configuration
  const errorConfig = {
    // Whether to report errors to a monitoring service
    reportErrors: isProd,
    
    // Error reporting endpoint
    reportingEndpoint: 'https://your-error-reporting-service.com/api/errors',
    
    // Error reporting function
    reportError: (error, context = {}) => {
      if (!errorConfig.reportErrors) return;
      
      try {
        const errorData = {
          message: error.message,
          stack: error.stack,
          context: {
            url: window.location.href,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            ...context
          }
        };
        
        // Send error to reporting service
        fetch(errorConfig.reportingEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(errorData),
          // Use keepalive to ensure the request completes even if the page unloads
          keepalive: true
        }).catch(e => {
          // Silently fail if the error reporting itself fails
          if (featureFlags.enableConsoleLogging) {
            console.error('Failed to report error:', e);
          }
        });
      } catch (e) {
        // Ensure error reporting never crashes the app
        if (featureFlags.enableConsoleLogging) {
          console.error('Error during error reporting:', e);
        }
      }
    }
  };
  
  /**
   * Safe console logging that respects production settings
   */
  const log = {
    debug: (...args) => {
      if (featureFlags.enableConsoleLogging) {
        console.debug(...args);
      }
    },
    info: (...args) => {
      if (featureFlags.enableConsoleLogging) {
        console.info(...args);
      }
    },
    warn: (...args) => {
      if (featureFlags.enableConsoleLogging) {
        console.warn(...args);
      }
    },
    error: (...args) => {
      // We always log errors but optionally report them
      console.error(...args);
      
      if (args[0] instanceof Error) {
        errorConfig.reportError(args[0], args[1] || {});
      }
    }
  };
  
  /**
   * Make secure API calls through the proxy instead of directly exposing API keys
   */
  const secureApiCall = async (endpoint, data) => {
    try {
      const response = await fetch(`${apiConfig.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: apiConfig.getHeaders(),
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      log.error(error, { endpoint, context: 'secureApiCall' });
      throw error;
    }
  };
  
  /**
   * Make a secure Groq API call through the proxy
   */
  const secureGroqApiCall = async (prompt, systemMessage = null) => {
    // Use the demo mode if API integration is disabled
    if (!featureFlags.enableGroqIntegration) {
      if (window.demoMode && window.demoMode.isDemoModeActive()) {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        return JSON.stringify({
          result: "Demo mode active. This is a simulated response.",
          status: "success"
        });
      }
      throw new Error("Groq API integration is disabled");
    }
    
    // Prepare the payload
    const payload = {
      prompt: prompt,
      ...(systemMessage && { systemMessage })
    };
    
    // Make the secure API call
    return secureApiCall(apiConfig.endpoints.groqAnalysis, payload);
  };
  
  /**
   * Update contract address for the current network
   * Called after contract deployment or when manually setting address
   */
  const updateContractAddress = (address, network = currentNetwork) => {
    if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
      throw new Error('Invalid contract address format');
    }
    
    if (!networks[network]) {
      throw new Error(`Unknown network: ${network}`);
    }
    
    // Update in memory
    networks[network].contractAddress = address;
    
    // Store in localStorage for persistence
    try {
      localStorage.setItem(`CONTRACT_ADDRESS_${network.toUpperCase()}`, address);
      log.info(`Contract address updated for ${network}: ${address}`);
      return true;
    } catch (error) {
      log.error(error, { context: 'updateContractAddress' });
      return false;
    }
  };
  
  /**
   * Detect current network from connected wallet
   */
  const detectNetworkFromWallet = async () => {
    if (window.ethereum) {
      try {
        // Get network/chain ID
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        
        // Find matching network
        for (const [key, network] of Object.entries(networks)) {
          if (network.chainId === chainId) {
            // Update current network
            currentNetwork = key;
            log.info(`Detected network from wallet: ${network.name}`);
            return key;
          }
        }
        
        log.warn(`Unknown network detected with chainId: ${chainId}`);
        return null;
      } catch (error) {
        log.error(error, { context: 'detectNetworkFromWallet' });
        return null;
      }
    }
    return null;
  };
  
  /**
   * Configure the application for production
   */
  const configureForProduction = async () => {
    // Initialize error handlers
    window.addEventListener('error', (event) => {
      errorConfig.reportError(event.error || new Error(event.message), {
        type: 'uncaught_error',
        lineNumber: event.lineno,
        fileName: event.filename
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      errorConfig.reportError(event.reason || new Error('Unhandled Promise rejection'), {
        type: 'unhandled_promise_rejection'
      });
    });
    
    // Configure demo mode based on feature flags
    if (window.demoMode) {
      if (!featureFlags.enableDemoMode && window.demoMode.isDemoModeActive()) {
        window.demoMode.toggleDemoMode(); // Turn off if enabled but shouldn't be
      }
    }
  
    // Try to detect network from wallet
    await detectNetworkFromWallet();
    
    // Set up wallet network change listener
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        log.info(`Chain changed to ${chainId}`);
        detectNetworkFromWallet().then(detectedNetwork => {
          if (detectedNetwork && networks[detectedNetwork].contractAddress) {
            log.info(`Using contract address for ${networks[detectedNetwork].name}: ${networks[detectedNetwork].contractAddress}`);
          } else {
            log.warn(`No contract address configured for the current network`);
          }
        });
      });
    }
    
    // Log initialization
    log.info(`Application configured for ${isProd ? 'production' : 'development'}`);
    log.info(`Selected network: ${networks[currentNetwork].name}`);
    
    // Check contract address
    if (!networks[currentNetwork].contractAddress) {
      log.warn(`No contract address configured for ${networks[currentNetwork].name}`);
    } else {
      log.info(`Using contract address: ${networks[currentNetwork].contractAddress}`);
    }
    
    return {
      isProd,
      currentNetwork: networks[currentNetwork],
      features: { ...featureFlags }
    };
  };
  
  /**
   * Switch to a different network
   */
  const switchNetwork = (networkKey) => {
    if (!networks[networkKey]) {
      throw new Error(`Unknown network: ${networkKey}`);
    }
    currentNetwork = networkKey;
    return networks[currentNetwork];
  };
  
  /**
   * Get current network configuration
   */
  const getNetwork = () => {
    return networks[currentNetwork];
  };
  
  /**
   * Get all available networks
   */
  const getAvailableNetworks = () => {
    return Object.keys(networks).map(key => ({
      key,
      name: networks[key].name,
      chainId: networks[key].chainId
    }));
  };
  
  /**
   * Request wallet to switch to a specific network
   */
  const requestNetworkSwitch = async (networkKey) => {
    if (!networks[networkKey]) {
      throw new Error(`Unknown network: ${networkKey}`);
    }
    
    if (!window.ethereum) {
      throw new Error('No wallet provider detected');
    }
    
    try {
      // Try to switch to the network
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networks[networkKey].chainId }],
        });
      } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask
        if (switchError.code === 4902) {
          // For adding networks, we would need more details (currency, rpc urls, etc.)
          // This is simplified - in production you'd want complete network details
          throw new Error(`Network ${networks[networkKey].name} needs to be added to your wallet first`);
        } else {
          // Other errors
          throw switchError;
        }
      }
      
      // Update current network
      currentNetwork = networkKey;
      return networks[currentNetwork];
    } catch (error) {
      log.error(error, { context: 'requestNetworkSwitch' });
      throw error;
    }
  };
  
  // Public API
  return {
    isProd,
    configureForProduction,
    switchNetwork,
    getNetwork,
    getAvailableNetworks,
    secureGroqApiCall,
    secureApiCall,
    log,
    featureFlags,
    // New methods for real wallet integration
    detectNetworkFromWallet,
    requestNetworkSwitch,
    updateContractAddress
  };
})();

// Export for use in other modules
window.productionConfig = productionConfig;

console.log("Production configuration module loaded");

// Try to detect network from wallet on load if wallet is available
if (window.ethereum) {
  window.ethereum.request({ method: 'eth_accounts' })
    .then(accounts => {
      if (accounts && accounts.length > 0) {
        // Wallet is already connected, detect network
        productionConfig.detectNetworkFromWallet()
          .catch(err => console.error("Error detecting network:", err));
      }
    })
    .catch(err => console.error("Error checking wallet accounts:", err));
}