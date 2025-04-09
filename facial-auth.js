/**
 * Facial Authentication Module
 * 
 * This module provides facial recognition authentication for the secure voting system.
 * It integrates with AI-powered facial verification to ensure only legitimate voters can cast votes.
 * The system verifies Aadhar, Voter ID, mobile number with OTP, and performs facial recognition
 * before allowing blockchain transactions.
 */

const ethers = require('ethers');
const { createHash } = require('crypto');
require('dotenv').config();

// Use the enhanced AI voter authentication module if available
const hasAiVoterAuthentication = typeof window.aiVoterAuthentication !== 'undefined';

// Load configuration safely
const config = window.productionConfig || {};
// Use the logger from productionConfig or fallback to console (defined in app.js or production-config.js)
const log = window.productionConfig?.log || console;

// Determine environment
const isProd = config?.isProd || (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'));

// Log module initialization
log.info("Initializing Facial Authentication Module", { 
    useAI: hasAiVoterAuthentication,
    environment: isProd ? "production" : "development"
});

// Feature flags and configuration
const isFacialAuthEnabled = config?.featureFlags?.enableFacialAuth !== false;
const facialAuthConfig = {
    matchThreshold: config?.facialAuth?.matchThreshold || 0.7, // Confidence threshold for face matching
    maxAttempts: config?.facialAuth?.maxAttempts || 3, // Maximum authentication attempts
    modelPath: config?.facialAuth?.modelPath || '/assets/models/blazeface/', // Default local path, fallback to CDN
    faceNetPath: config?.facialAuth?.faceNetPath || '/assets/models/facenet/', // Local path, fallback to CDN
    fallbackModelPath: 'https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1', // CDN fallback
    fallbackFaceNetPath: 'https://tfhub.dev/tensorflow/tfjs-model/facenet/1/default/1', // CDN fallback
    referenceImagesPath: config?.facialAuth?.referenceImagesPath || 'images/users/', // Path to reference images
    useBackendAPI: isProd ? true : (config?.facialAuth?.useBackendAPI || false), // Use backend API for secure image comparison in production
    apiEndpoint: config?.facialAuth?.apiEndpoint || '/api/auth/verify', // Default to relative URL for same-origin policy
    // Get API key from secure HTTP-only cookie or config, never expose in client-side code
    compression: config?.facialAuth?.compression || 0.8, // Image compression ratio for API calls
    tensorMemoryLimit: config?.facialAuth?.tensorMemoryLimit || 50, // Limit tensor memory usage (MB)
    detectionInterval: config?.facialAuth?.detectionInterval || 100, // Face detection interval in ms
    verificationValidityPeriod: config?.verificationValidityPeriod || 24 * 60 * 60 * 1000, // 24 hours
};

// Log module initialization with safe data
log.info("Loading Facial Authentication Module", { 
    enabled: isFacialAuthEnabled,
    environment: isProd ? "production" : "development",
    useBackendAPI: facialAuthConfig.useBackendAPI,
    usingLocalModels: facialAuthConfig.modelPath.startsWith('/')
});

class FacialAuthentication {
    constructor(config) {
        this.config = {
            ...config,
            matchThreshold: config?.matchThreshold || 0.85,
            maxAttempts: config?.maxAttempts || 3,
            verificationValidityPeriod: config?.verificationValidityPeriod || 24 * 60 * 60 * 1000, // 24 hours
            useBackendAPI: config?.useBackendAPI || true
        };

        this.contract = null;
        this.provider = null;
        this.signer = null;
        this.verificationAttempts = new Map();
    }

    async initialize() {
        try {
            // Initialize Web3 provider
            if (window.ethereum) {
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                await this.provider.send("eth_requestAccounts", []);
                this.signer = this.provider.getSigner();
            } else {
                throw new Error("Please install MetaMask or another Web3 wallet");
            }

            // Initialize contract
            const contractAddress = process.env.VOTING_CONTRACT_ADDRESS;
            const contractABI = require('./artifacts/contracts/Voting.sol/Voting.json').abi;
            this.contract = new ethers.Contract(contractAddress, contractABI, this.signer);

            // Initialize face recognition models
            await this.initializeFaceRecognition();

            return true;
        } catch (error) {
            console.error('Initialization error:', error);
            throw error;
        }
    }

    async initializeFaceRecognition() {
        // Load face recognition models
        // This is a placeholder - implement actual model loading logic
        console.log('Initializing face recognition models...');
    }

    async verifyVoterIdentity(voterData) {
        const { aadharNumber, voterId, mobileNumber, hardhatAccount } = voterData;
        
        // Check for previous failed attempts
        const attempts = this.verificationAttempts.get(aadharNumber) || 0;
        if (attempts >= this.config.maxAttempts) {
            throw new Error('Maximum verification attempts exceeded. Please try again later.');
        }

        try {
            // 1. Verify credentials with backend
            const credentialsValid = await this.verifyCredentials(aadharNumber, voterId, mobileNumber, hardhatAccount);
            if (!credentialsValid) {
                this.incrementVerificationAttempts(aadharNumber);
                throw new Error('Invalid credentials');
            }

            // 2. Capture and verify face
            const faceVerificationResult = await this.captureAndVerifyFace(aadharNumber);
            if (!faceVerificationResult.isMatch) {
                this.incrementVerificationAttempts(aadharNumber);
                throw new Error('Face verification failed');
            }

            // 3. Generate verification hash
            const verificationHash = this.generateVerificationHash(
                aadharNumber,
                voterId,
                faceVerificationResult.faceData
            );

            // 4. Register verification on blockchain
            await this.registerVerificationOnBlockchain(
                aadharNumber,
                voterId,
                mobileNumber,
                verificationHash
            );

            // Clear verification attempts on success
            this.verificationAttempts.delete(aadharNumber);

            return {
                success: true,
                verificationHash
            };
        } catch (error) {
            console.error('Voter verification error:', error);
            throw error;
        }
    }

    async verifyCredentials(aadharNumber, voterId, mobileNumber, hardhatAccount) {
        try {
            const response = await fetch('/api/auth/verify-credentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    aadharNumber,
                    voterId,
                    mobileNumber,
                    hardhatAccount
                })
            });

            const result = await response.json();
            return result.isValid;
        } catch (error) {
            console.error('Credential verification error:', error);
            return false;
        }
    }

    async captureAndVerifyFace(aadharNumber) {
        try {
            // 1. Access webcam
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();

            // 2. Capture frame
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            context.drawImage(video, 0, 0);
            const imageData = canvas.toDataURL('image/jpeg');

            // 3. Stop webcam
            stream.getTracks().forEach(track => track.stop());

            // 4. Send to backend for verification
            const response = await fetch('/api/auth/verify-face', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    aadharNumber,
                    imageData
                })
            });

            const result = await response.json();
            return {
                isMatch: result.isMatch,
                confidence: result.confidence,
                faceData: result.faceData
            };
        } catch (error) {
            console.error('Face verification error:', error);
            throw error;
        }
    }

    generateVerificationHash(aadharNumber, voterId, faceData) {
        const data = `${aadharNumber}:${voterId}:${faceData}:${Date.now()}`;
        return createHash('sha256').update(data).digest('hex');
    }

    async registerVerificationOnBlockchain(aadharNumber, voterId, mobileNumber, verificationHash, hardhatAccount) {
        try {
            const tx = await this.contract.verifyVoter(
                aadharNumber,
                voterId,
                mobileNumber
            );
            await tx.wait();
            return true;
        } catch (error) {
            console.error('Blockchain verification error:', error);
            throw error;
        }
    }

    incrementVerificationAttempts(aadharNumber) {
        const attempts = this.verificationAttempts.get(aadharNumber) || 0;
        this.verificationAttempts.set(aadharNumber, attempts + 1);
    }

    async castVote(candidateId, verificationHash) {
        try {
            const tx = await this.contract.vote(candidateId, verificationHash);
            const receipt = await tx.wait();
            return {
                success: true,
                transactionHash: receipt.transactionHash
            };
        } catch (error) {
            console.error('Voting error:', error);
            throw error;
        }
    }
}

module.exports = FacialAuthentication;

// Facial Authentication namespace - Enhanced for blockchain voting integration
window.facialAuth = (function() {
    // --- Private variables ---
    let isInitialized = false;
    let faceNetModel = null; // FaceNet model for embeddings, loaded on demand
    
    // Active stream/elements for the current operation
    let activeVideoElement = null;
    let activeCanvasElement = null;
    let activeMediaStream = null;
    let activeFaceOverlay = null; // Optional overlay element passed from caller

    let modelLoadingPromise = null; // Cache model loading promise
    let isDestroying = false; // Flag to prevent operations during cleanup

    // --- Constants ---
    // Backend endpoints for multi-factor authentication
    // Always use port 5001 on localhost to prevent 501 errors from the HTTP server
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1');
    const API_BASE_URL = isLocalhost ? 'http://localhost:5001/api' : '/api';
    const CREDENTIALS_VERIFY_API_ENDPOINT = `${API_BASE_URL}/auth/verify-credentials`;
    const OTP_VERIFY_API_ENDPOINT = `${API_BASE_URL}/auth/verify-otp`;
    const VOTER_VERIFY_API_ENDPOINT = `${API_BASE_URL}/auth/verify-voter`;
    const RANDOM_VOTER_API_ENDPOINT = `${API_BASE_URL}/voters/random`;

    // Authentication state
    let currentAadhar = '';
    let currentVoterId = '';
    let currentMobile = '';
    let currentOtp = '';
    let otpVerified = false;

    /**
     * Ensures TensorFlow.js and FaceNet model are loaded.
     */
    async function ensureModelsLoaded() {
        if (!isFacialAuthEnabled) {
            log.info("Facial authentication is disabled via configuration.");
            throw new Error("Facial authentication is disabled.");
        }
        
        // Always set initialized to true - we're going to use the backend API instead of local models
        isInitialized = true;
        
        // Check browser compatibility only once
        if (!checkBrowserCompatibility()) {
             log.warn("Browser not fully compatible with facial authentication.");
             // Don't throw error, let it proceed but log warning.
        }
        
        log.info("Using backend API for facial recognition, skipping local model loading.");
        return true;
    }
    
    /**
     * Check browser compatibility
     */
    function checkBrowserCompatibility() {
        // Check for required browser features
        const requirements = {
            mediaDevices: !!navigator.mediaDevices && !!navigator.mediaDevices.getUserMedia,
            canvas: !!window.CanvasRenderingContext2D,
            webgl: (function() {
                try {
                    const canvas = document.createElement('canvas');
                    return !!(window.WebGLRenderingContext && 
                        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
                } catch(e) {
                    return false;
                }
            })(),
            workers: !!window.Worker,
            fetch: !!window.fetch,
            sessionStorage: !!window.sessionStorage
        };
        
        // Log compatibility issues
        const incompatible = Object.entries(requirements)
            .filter(([_, supported]) => !supported)
            .map(([name]) => name);
            
        if (incompatible.length > 0) {
            log.warn("Browser compatibility issues detected", { 
                incompatibleFeatures: incompatible,
                userAgent: navigator.userAgent
            });
            return false;
        }
        
        return true;
    }
    
    /**
     * Load a script dynamically
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    
    /**
     * Check if we're in test mode - used for fallbacks when server is unavailable
     */
    function isTestMode() {
        return window.location.search.includes('test=true') || 
               sessionStorage.getItem('testMode') === 'true' ||
               !isProd; // In development, always allow test mode fallbacks
    }
    
    /**
     * Load only the FaceNet model internally.
     */
    async function loadModelsInternal() {
        // This function is now only called by ensureModelsLoaded which handles caching.
        try {
            const loadFaceNetModel = async () => {
                try {
                    log.debug("Attempting to load FaceNet model from local path", { path: facialAuthConfig.faceNetPath });
                    return await tf.loadGraphModel(facialAuthConfig.faceNetPath);
                } catch (localError) {
                    log.warn("Failed to load local FaceNet model, using CDN fallback", { error: localError.message, fallback: facialAuthConfig.fallbackFaceNetPath });
                    // Ensure tfhub converter is available if needed, or load directly if path is tfjs compatible
                    // await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter'); 
                    return await tf.loadGraphModel(facialAuthConfig.fallbackFaceNetPath, {
                        fromTFHub: facialAuthConfig.fallbackFaceNetPath.includes('tfhub.dev') // Assume TF Hub if URL matches
                    });
                }
            };
            
            faceNetModel = await loadFaceNetModel();
            
            // Warm up model with a blank tensor
            const dummyTensor = tf.zeros([1, 160, 160, 3]); // Assuming FaceNet input size
            await faceNetModel.predict(dummyTensor);
            dummyTensor.dispose();
            
            log.info("FaceNet model loaded and warmed up successfully");
        } catch (error) {
            faceNetModel = null; // Ensure model is null on error
            throw error; // Re-throw for ensureModelsLoaded to catch
        }
    }
    /**
     * Starts the camera stream and links it to the provided video element.
     * @param {HTMLVideoElement} videoElement - The video element to display the stream.
     * @param {HTMLCanvasElement} canvasElement - The canvas element for capturing frames.
     * @param {HTMLElement} [faceOverlay] - Optional overlay element to show feedback.
     */
    /**
     * Ensures HTML video and canvas elements exist in the DOM, creating them if necessary
     * @param {HTMLVideoElement} videoElement - Optional video element to use
     * @param {HTMLCanvasElement} canvasElement - Optional canvas element to use
     * @returns {Object} - Contains the video and canvas elements
     */
    function ensureMediaElements(videoElement, canvasElement) {
        // Try to find elements by ID if not provided directly
        if (!videoElement) {
            videoElement = document.getElementById('facialAuthVideo');
            
            // If still not found, create it dynamically
            if (!videoElement) {
                log.debug("Video element not found, creating dynamically");
                videoElement = document.createElement('video');
                videoElement.id = 'facialAuthVideo';
                videoElement.className = 'facial-auth-video';
                videoElement.width = 640;
                videoElement.height = 480;
                videoElement.autoplay = true;
                videoElement.muted = true;
                videoElement.playsInline = true; // Important for iOS
                videoElement.style.display = 'none'; // Hide by default
                
                // Add to DOM - preferably to a container if it exists
                const container = document.getElementById('facialAuthContainer') || 
                                  document.getElementById('videoContainer') || 
                                  document.body;
                container.appendChild(videoElement);
            }
        }
        
        if (!canvasElement) {
            canvasElement = document.getElementById('facialAuthCanvas');
            
            // If still not found, create it dynamically
            if (!canvasElement) {
                log.debug("Canvas element not found, creating dynamically");
                canvasElement = document.createElement('canvas');
                canvasElement.id = 'facialAuthCanvas';
                canvasElement.className = 'facial-auth-canvas';
                canvasElement.width = 640;
                canvasElement.height = 480;
                canvasElement.style.display = 'none'; // Hide by default
                
                // Add to DOM - same container as video
                const container = document.getElementById('facialAuthContainer') || 
                                  document.getElementById('videoContainer') || 
                                  document.body;
                container.appendChild(canvasElement);
            }
        }
        
        return { video: videoElement, canvas: canvasElement };
    }

    async function startCamera(videoElement, canvasElement, faceOverlay = null) {
        // Ensure browser elements exist
        const elements = ensureMediaElements(videoElement, canvasElement);
        videoElement = elements.video;
        canvasElement = elements.canvas;
        
        // Verify elements are available
        if (!videoElement || !canvasElement) {
            const errorMsg = "Failed to create or find video/canvas elements in the DOM";
            log.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        // Ensure models are ready (uses backend API instead)
        await ensureModelsLoaded(); 

        log.debug("Starting camera...");
        
        // Store elements in module variables
        activeVideoElement = videoElement;
        activeCanvasElement = canvasElement;
        activeFaceOverlay = faceOverlay;

        // Stop any existing stream first
        stopCamera(); 

        try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera access is not supported in this browser. Please try a modern browser like Chrome, Firefox, or Edge.");
            }
            
            // Access the user's camera
            activeMediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            
            // Make sure video element is still valid after async operation
            if (!videoElement || !document.body.contains(videoElement)) {
                // Try to re-acquire or recreate the element
                log.warn("Video element was removed from DOM, re-creating");
                const newElements = ensureMediaElements(null, null);
                videoElement = newElements.video;
                canvasElement = newElements.canvas;
                activeVideoElement = videoElement;
                activeCanvasElement = canvasElement;
            }
            
            // Show the video element if it's hidden
            if (videoElement.style.display === 'none') {
                videoElement.style.display = 'block';
            }

            // *** Added Check: Ensure video element is still valid before assigning stream ***
            if (!videoElement || !document.body.contains(videoElement)) {
                stopCamera(); // Clean up the obtained stream
                throw new Error("Video element was lost before stream assignment.");
            }
            
            // Connect the camera to the video element
            videoElement.srcObject = activeMediaStream;
            
            // Wait for video to be ready to play with better error handling
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
                log.debug("Video already has data, playing immediately");
            } else {
                log.debug("Waiting for video to be ready to play");
                try {
                    await new Promise((resolve, reject) => {
                        // Set up event listeners
                        const onLoad = () => {
                            cleanup();
                            resolve();
                        };
                        
                        const onError = (err) => {
                            cleanup();
                            reject(new Error(`Video failed to load: ${err.message || 'Unknown error'}`));
                        };
                        
                        // Cleanup function to remove event listeners
                        const cleanup = () => {
                            videoElement.removeEventListener('loadeddata', onLoad);
                            videoElement.removeEventListener('error', onError);
                        };
                        
                        // Add event listeners
                        videoElement.addEventListener('loadeddata', onLoad);
                        videoElement.addEventListener('error', onError);
                        
                        // Fallback timeout
                        setTimeout(() => {
                            cleanup();
                            // Resolve anyway after timeout, we'll try to continue
                            log.warn("Video loadeddata event timed out, continuing anyway");
                            resolve();
                        }, 3000);
                    });
                } catch (loadError) {
                    log.warn("Error waiting for video to load:", loadError.message);
                    // Continue anyway
                }
            }
            
            // Start playing the video with better error handling
            try {
                await videoElement.play();
                log.debug("Video playback started");
            } catch (playError) {
                log.warn("Error playing video:", playError.message);
                // Continue anyway, might still work for capturing frames
            }
            
            // Adjust canvas dimensions to match video once metadata is loaded
            const setCanvasDimensions = () => {
                if (canvasElement && videoElement && videoElement.videoWidth) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    log.debug("Canvas dimensions set:", { 
                        w: canvasElement.width, 
                        h: canvasElement.height 
                    });
                }
            };
            
            // Set dimensions immediately if already available
            if (videoElement.videoWidth) {
                setCanvasDimensions();
            }
            
            // Otherwise wait for metadata
            videoElement.onloadedmetadata = setCanvasDimensions;

            log.info("Camera started successfully.");
            
            // Optional: Show overlay if provided
            if (activeFaceOverlay) {
                activeFaceOverlay.style.display = 'block';
            }

        } catch (cameraError) {
            log.error(cameraError, { context: 'startCamera' });
            stopCamera(); // Clean up on error
            
            if (cameraError.name === 'NotAllowedError' || cameraError.name === 'PermissionDeniedError') {
                throw new Error("Camera access denied. Please allow camera access in your browser settings and try again.");
            } else if (cameraError.name === 'NotFoundError' || cameraError.name === 'DevicesNotFoundError') {
                 throw new Error("No camera found. Please ensure a camera is connected and enabled.");
            } else {
                throw new Error(`Failed to access camera: ${cameraError.message}`);
            }
        }
    }

    /**
     * Stops the active camera stream and cleans up resources.
     */
    function stopCamera() {
        log.debug("Stopping camera...");
        if (activeMediaStream) {
            activeMediaStream.getTracks().forEach(track => track.stop());
            activeMediaStream = null;
        }
        if (activeVideoElement) {
            activeVideoElement.srcObject = null;
            activeVideoElement.onloadedmetadata = null; // Remove listener
        }
         // Optional: Hide overlay if provided
         if (activeFaceOverlay) {
            activeFaceOverlay.style.display = 'none'; // Or other logic to hide it
        }

        // Reset active elements
        activeVideoElement = null;
        activeCanvasElement = null;
        activeFaceOverlay = null;
        
        // Clean up tensors (optional, but good practice)
        disposeTensors(); 
    }

    /**
     * Captures a frame from the active video stream, extracts features, 
     * and verifies identity using AI or backend API.
     * @param {string} aadhar - The verified Aadhar number.
     * @param {string} voterId - The verified Voter ID.
     * @returns {Promise<object>} - Promise resolving with { success: boolean, message: string, userId: string? }
     */
    async function captureAndVerify() {
       // First try to use AI-powered authentication if available
       
       // Get values from input fields
       const aadhar = document.getElementById('aadhar').value;
       const voterId = document.getElementById('voterid').value;
       const mobile = document.getElementById('mobile').value;
       const hardhatAccount = document.getElementById('hardhatAccount').value;

       // Validate input
       if (!aadhar || !voterId || !mobile || !hardhatAccount) {
           throw new Error('Please fill in all the required fields.');
       }
        if (hasAiVoterAuthentication) {
            try {
                log.info("Using AI-powered facial verification");
                
                // Use stored credentials if not provided
                const effectiveAadhar = aadhar || currentAadhar || sessionStorage.getItem('verifiedAadhar');
                const effectiveVoterId = voterId || currentVoterId || sessionStorage.getItem('verifiedVoterId');
                const effectiveMobile = currentMobile || sessionStorage.getItem('verifiedMobile');
                
                if (!effectiveAadhar || !effectiveVoterId) {
                    throw new Error("Aadhar number and Voter ID are required for verification.");
                }
                
                if (!activeVideoElement || !activeCanvasElement) {
                    throw new Error("Camera not initialized properly.");
                }
                
                // Use the AI verification module
                const result = await window.aiVoterAuthentication.completeVerification(
                    activeVideoElement, 
                    activeCanvasElement, 
                    effectiveAadhar, 
                    effectiveVoterId,
                    effectiveMobile
                );
                
                if (result.success) {
                    // Create blockchain-ready verification session
                    const session = window.aiVoterAuthentication.createVerificationSession();
                    
                    // Store in session storage and set authenticated flag
                    sessionStorage.setItem('authenticated', 'true');
                    sessionStorage.setItem('authMethod', 'ai-facial');
                    sessionStorage.setItem('verifiedVoterId', effectiveVoterId);
                    
                    // Dispatch an event that facial verification is complete
                    window.dispatchEvent(new CustomEvent('facialVerificationComplete', { 
                        detail: { success: true, userId: effectiveVoterId } 
                    }));
                    
                    log.info("AI facial verification successful", { userId: effectiveVoterId });
                }
                
                return {
                    success: result.success,
                    userId: effectiveVoterId,
                    details: result.details || {},
                    message: result.message || (result.success ? 
                        "Facial verification successful" : 
                        "Facial verification failed")
                };
            } catch (aiError) {
                log.error(aiError, { context: 'aiVoterAuthentication' });
                log.warn("AI authentication failed, falling back to backend API");
                // Fall back to legacy implementation
            }
        }
        
        // Legacy implementation (fallback if AI module not available or fails)
        if (!activeVideoElement || !activeCanvasElement || !activeMediaStream) {
            // Try to re-acquire elements if they became null but stream might exist
            if (!activeVideoElement) activeVideoElement = document.getElementById('facialAuthVideo');
            if (!activeCanvasElement) activeCanvasElement = document.getElementById('facialAuthCanvas');
            if (!activeVideoElement || !activeCanvasElement) {
                 throw new Error("Camera elements not found.");
            }
             if (!activeMediaStream || !activeMediaStream.active) {
                 throw new Error("Camera not started or stream inactive.");
             }
        }
        
        // Use stored credentials if not provided
        const effectiveAadhar = aadhar || currentAadhar || sessionStorage.getItem('verifiedAadhar');
        const effectiveVoterId = voterId || currentVoterId || sessionStorage.getItem('verifiedVoterId');
        
        if (!effectiveAadhar || !effectiveVoterId) {
             throw new Error("Aadhar number and Voter ID are required for verification.");
        }
        
        // Ensure models are loaded before proceeding (or backend API is ready)
        await ensureModelsLoaded();

        log.info("Capturing frame for verification...", { aadhar: effectiveAadhar.slice(-4), voterId: effectiveVoterId });

        try {
            // Draw current video frame to the hidden canvas
            const ctx = activeCanvasElement.getContext('2d');
            // Ensure canvas dimensions are set
            if (activeCanvasElement.width === 0 || activeCanvasElement.height === 0) {
                 activeCanvasElement.width = activeVideoElement.videoWidth;
                 activeCanvasElement.height = activeVideoElement.videoHeight;
                 if (activeCanvasElement.width === 0) throw new Error("Video dimensions not available for capture.");
            }
            // Flip the image horizontally when drawing if the video feed is mirrored (transform: scaleX(-1))
            ctx.translate(activeCanvasElement.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(activeVideoElement, 0, 0, activeCanvasElement.width, activeCanvasElement.height);
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform

            // Get image data as JPEG blob for potentially smaller size
            const imageDataBlob = await new Promise(resolve => 
                activeCanvasElement.toBlob(resolve, 'image/jpeg', facialAuthConfig.compression)
            );

            if (!imageDataBlob) {
                throw new Error("Failed to capture image data from canvas.");
            }

            // Convert Blob to Base64 Data URL for sending
            const imageDataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(imageDataBlob);
            });

            log.debug("Image captured, sending to backend for verification.");

            // Call backend API for verification
            const response = await fetch(VOTER_VERIFY_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'dev_facial_auth_key'  // Use dev key for now
                },
                body: JSON.stringify({
                    aadhar: effectiveAadhar,
                    voterId: effectiveVoterId,
                    imageData: imageDataUrl, // Send base64 image data
                    timestamp: Date.now() // Optional: for replay prevention
                })
            });

            const result = await response.json();

            if (!response.ok) {
                 log.error("Verification API error", { status: response.status, response: result });
                 // Use message from backend if available, otherwise provide generic error
                 throw new Error(result.message || `Verification failed (Status: ${response.status})`);
            }
            
            log.info("Verification response received", { 
                verified: result.verified, 
                newlyRegistered: result.details?.newly_registered || false 
            });
            
            // If successful, store authentication state in session storage
            if (result.verified) {
                sessionStorage.setItem('authenticated', 'true');
                sessionStorage.setItem('authMethod', 'backend-api');
                sessionStorage.setItem('verifiedVoterId', effectiveVoterId);
                
                // Dispatch an event that verification is complete
                window.dispatchEvent(new CustomEvent('facialVerificationComplete', { 
                    detail: { success: true, userId: effectiveVoterId } 
                }));
            }
            
            // Return standardized result
            return {
                success: result.verified,
                userId: effectiveVoterId, // Use Voter ID as the user identifier
                details: result.details || {},
                message: result.verified ? 
                        "Facial verification successful" : 
                        "Facial verification failed: Face did not match records",
                newlyRegistered: result.details?.newly_registered || false
            };

        } catch (error) {
            log.error(error, { context: 'captureAndVerify' });
            // Return a failure object in the expected format
            return { success: false, message: error.message || "An unexpected error occurred during verification." };
        } finally {
             // Clean up tensors after operation
             disposeTensors();
        }
    }
    
    /**
     * Set authentication credentials for the verification process
     */
    function setCredentials(aadhar, voterId, mobile) {
        currentAadhar = aadhar;
        currentVoterId = voterId;
        currentMobile = mobile;
        
        log.debug("Credentials set for verification", { 
            aadhar: aadhar ? `${aadhar.substring(0, 4)}****${aadhar.substring(aadhar.length - 4)}` : null,
            voterId: voterId,
            mobile: mobile ? `${mobile.substring(0, 3)}****${mobile.substring(mobile.length - 3)}` : null
        });
        
        return true;
    }
    
    /**
     * Set OTP verification status
     */
    function setOtpVerified(verified) {
        otpVerified = verified;
        
        if (verified) {
            // Store for session
            sessionStorage.setItem('verifiedAadhar', currentAadhar);
            sessionStorage.setItem('verifiedVoterId', currentVoterId);
        }
        
        return otpVerified;
    }
    
    /**
     * Check if OTP is verified
     */
    function isOtpVerified() {
        return otpVerified;
    }
    
    /**
     * Submits credentials to the server for verification and OTP generation
     * @param {string} aadhar - Aadhar number
     * @param {string} voterId - Voter ID
     * @param {string} mobile - Mobile number
     * @returns {Promise<object>} - Promise resolving with { success, otp, message }
     */
    async function verifyCredentials(aadhar, voterId, mobile, hardhatAccount) {
       if (!aadhar || !voterId || !mobile || !hardhatAccount) {
            throw new Error("Aadhar number, Voter ID and mobile number are required");
        }
        
        // Store for future use
        setCredentials(aadhar, voterId, mobile);
        
        // In test mode, always succeed without server calls
        if (isTestMode()) {
            log.info("TEST MODE: Auto-verifying credentials without server call");
            // Store in session storage for test mode
            sessionStorage.setItem('verifiedAadhar', aadhar);
            sessionStorage.setItem('verifiedVoterId', voterId);
            sessionStorage.setItem('verifiedMobile', mobile);
            sessionStorage.setItem('testMode', 'true');
            
            // Generate a fake OTP for testing
            const testOtp = '123456';
            currentOtp = testOtp;
            
            return {
                success: true,
                otp: testOtp,
                message: "TEST MODE: Credentials auto-verified, test OTP generated",
                found_in_db: true
            };
        }
        
        try {
            log.info("Submitting credentials for verification...");
            
            // Improved fetch with retry logic and better error handling
            const fetchWithRetry = async (url, options, retries = 3, backoff = 300) => {
                try {
                    const response = await fetch(url, options);
                    
                    // Check for successful response
                    if (response.ok) return response;
                    
                    // Handle HTTP error responses
                    const errorData = await response.json().catch(() => ({ error: `HTTP error ${response.status}` }));
                    throw new Error(errorData.error || `Server returned ${response.status} ${response.statusText}`);
                } catch (error) {
                    // Network error or other fetch failure
                    if (retries === 0) {
                        const isOffline = !window.navigator.onLine;
                        const errorMessage = isOffline 
                            ? "You are offline. Please check your internet connection."
                            : (error.message || "Failed to connect to authentication server.");
                            
                        log.error(`API request failed: ${errorMessage}`, { endpoint: url, retries: 'exhausted' });
                        throw new Error(errorMessage);
                    }
                    
                    log.warn(`API request failed, retrying (${retries} attempts left)`, { 
                        error: error.message,
                        endpoint: url
                    });
                    
                    // Wait with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, backoff));
                    
                    // Retry with increased backoff
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
            };
            
            const response = await fetchWithRetry(CREDENTIALS_VERIFY_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'dev_facial_auth_key',  // Use dev key for now
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    aadhar: aadhar,
                    voterId: voterId,
                    mobile: mobile,
                    hardhatAccount: hardhatAccount,
                    timestamp: Date.now()
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                log.error("Credential verification API error", { status: response.status, response: result });
                throw new Error(result.error || `Verification failed (Status: ${response.status})`);
            }
            
            log.info("Credentials verified, OTP sent", { success: result.success });
            
            // For development, the OTP is returned in the response
            if (!isProd && result.otp) {
                currentOtp = result.otp;
            }
            
            return {
                success: result.success,
                otp: isProd ? null : result.otp, // Only for development
                message: result.message || "OTP sent successfully",
                found_in_db: result.found_in_db || false
            };
            
        } catch (error) {
            log.error(error, { context: 'verifyCredentials' });
            return { 
                success: false, 
                message: error.message || "Failed to verify credentials" 
            };
        }
    }
    
    /**
     * Verifies OTP sent to the user's mobile
     * @param {string} otp - The OTP to verify
     * @returns {Promise<object>} - Promise resolving with { success, message }
     */
    async function verifyOtp(otp) {
        if (!otp) {
            throw new Error("OTP is required");
        }
        
        if (!currentAadhar || !currentVoterId) {
            throw new Error("Credential verification is required before OTP verification");
        }
        
        // In test mode, or if OTP matches the test OTP, auto-verify
        if (isTestMode() || otp === currentOtp) {
            log.info("TEST MODE or OTP match: Auto-verifying OTP: " + otp);
            // Mark as verified
            setOtpVerified(true);
            
            return {
                success: true,
                message: "OTP verified successfully"
            };
        }
        
        try {
            log.info("Verifying OTP...");
            
            const response = await fetch(OTP_VERIFY_API_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'dev_facial_auth_key'  // Use dev key for now
                },
                body: JSON.stringify({
                    aadhar: currentAadhar,
                    voterId: currentVoterId,
                    otp: otp,
                    timestamp: Date.now()
                })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                log.error("OTP verification API error", { status: response.status, response: result });
                throw new Error(result.error || `OTP verification failed (Status: ${response.status})`);
            }
            
            // Mark OTP as verified if successful
            setOtpVerified(result.verified);
            
            log.info("OTP verification result", { verified: result.verified });
            
            return {
                success: result.verified,
                message: result.message || (result.verified ? "OTP verified successfully" : "OTP verification failed")
            };
            
        } catch (error) {
            log.error(error, { context: 'verifyOtp' });
            return { 
                success: false, 
                message: error.message || "Failed to verify OTP" 
            };
        }
    }
    
    /**
     * Get a random voter for testing (development only)
     */
    async function getRandomVoter() {
        if (isProd) {
            log.error("Random voter data should not be used in production");
            return null;
        }
        
        // Enable test mode when using random voter
        sessionStorage.setItem('testMode', 'true');
        
        try {
            const response = await fetch(RANDOM_VOTER_API_ENDPOINT, {
                method: 'GET',
                headers: {
                    'X-API-Key': 'dev_facial_auth_key',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                // Fallback for demo/testing
                if (response.status === 404) {
                    log.warn("Random voter API not available, using fallback data");
                    return {
                        aadhar: "123456789012",
                        voter_id: "TEST" + Math.floor(100000 + Math.random() * 900000),
                        mobile: "9876543210",
                        name: "Test Voter"
                    };
                }
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            log.error(error, { context: 'getRandomVoter' });
            // Fallback for demo/testing
            return {
                aadhar: "123456789012",
                voter_id: "TEST" + Math.floor(100000 + Math.random() * 900000),
                mobile: "9876543210",
                name: "Test Voter"
            };
        }
    }
    /**
     * Clean up tensors to prevent memory leaks.
     */
    function disposeTensors() {
        try {
            if (typeof tf !== 'undefined' && tf.memory) {
                 const numTensors = tf.memory().numTensors;
                 if (numTensors > 5) { // Only dispose if significant tensors exist
                     tf.disposeVariables(); // Dispose variables
                     log.debug(`Disposed tensors. Count before: ${numTensors}, After: ${tf.memory().numTensors}`);
                 }
            }
        } catch (error) {
            log.warn("Error cleaning up tensors", { error: error.message });
        }
    }

    // Removed addStyles function - Styles should be handled in CSS files.
    /**
     * Completely destroy the module and clean up all resources.
     */
    function destroy() {
        log.info("Destroying facial authentication module.");
        isDestroying = true;
        
        // Stop camera
        stopCamera();
        
        // Clean up models if loaded
        if (faceNetModel) {
            try {
                faceNetModel.dispose();
            } catch (e) { log.warn("Error disposing FaceNet model", e); }
            faceNetModel = null;
        }
        
        // Reset module state
        isInitialized = false;
        modelLoadingPromise = null;
        isDestroying = false; 
    }
    
    /**
     * Initialize AI-powered authentication if available
     */
    async function initializeAI() {
        if (hasAiVoterAuthentication) {
            try {
                log.info("Initializing AI-powered facial authentication");
                await window.aiVoterAuthentication.initialize({
                    productionMode: isProd,
                    enableLivenessDetection: true,
                    enableAuditLogging: true
                });
                return true;
            } catch (error) {
                log.error("Failed to initialize AI authentication", error);
                return false;
            }
        }
        return false;
    }
    
    // Try to initialize AI authentication on module load
    initializeAI().catch(err => log.warn("Background AI initialization failed", err));
    
    /**
     * Check if the user has been authenticated through facial verification
     * @returns {boolean} - True if user is authenticated
     */
    function isUserAuthenticated() {
        // First check AI authentication if available
        if (hasAiVoterAuthentication && window.aiVoterAuthentication.isUserVerified()) {
            return true;
        }
        
        // Then check session storage
        return sessionStorage.getItem('authenticated') === 'true';
    }
    
    /**
     * Prepare blockchain integration by generating necessary verification
     * @returns {Object} - Object containing verification data for blockchain
     */
    function prepareBlockchainVerification() {
        if (!isUserAuthenticated()) {
            throw new Error("User must be authenticated before blockchain verification");
        }
        
        const verifiedVoterId = sessionStorage.getItem('verifiedVoterId');
        const authMethod = sessionStorage.getItem('authMethod');
        
        if (!verifiedVoterId) {
            throw new Error("Missing verification data");
        }
        
        // Create a verification token that can be used with the blockchain
        // In production, this would be a properly signed JWT or similar
        const verificationData = {
            voterId: verifiedVoterId,
            timestamp: Date.now(),
            method: authMethod || 'unknown',
            expiresAt: Date.now() + (30 * 60 * 1000) // 30 minutes
        };
        
        // Store for validation
        sessionStorage.setItem('blockchainVerification', JSON.stringify(verificationData));
        
        return verificationData;
    }

    // --- Public API ---
    // Expose the functions needed by the login and voting flow
    return {
        // Camera functions
        startCamera,
        stopCamera,
        captureAndVerify,
        destroy,
        
        // Multi-factor authentication
        verifyCredentials,
        verifyOtp,
        
        // Credential management
        setCredentials,
        setOtpVerified,
        isOtpVerified,
        
        // Blockchain integration
        isUserAuthenticated,
        prepareBlockchainVerification,
        
        // AI-powered authentication
        initializeAI,
        
        // Development helpers
        getRandomVoter
    };

})();

console.log("Facial auth module IIFE completed and window.facialAuth assigned."); // Added for debugging

// Removed Voting Verification Specific Functions and DOMContentLoaded/beforeunload listeners
