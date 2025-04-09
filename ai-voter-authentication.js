/**
 * AI-Powered Voter Authentication Module
 * 
 * This module provides advanced facial recognition and identity verification for the voting system.
 * It ensures that only verified individuals can cast votes on the blockchain by performing
 * AI-based facial recognition and matching against registered user data.
 */

// Initialize the authentication module
const aiVoterAuthentication = (() => {
    // Private state variables
    let isInitialized = false;
    let confidenceThreshold = 0.85; // Minimum confidence level required for a match
    let maxAttempts = 3; // Maximum number of verification attempts
    let attemptsRemaining = maxAttempts;
    let currentUserData = null;
    let verificationResult = null;
    let isBusy = false;
    let cameraStream = null;

    // Module configuration
    const config = {
        // Production vs development mode
        productionMode: window.productionConfig?.isProd || false,
        
        // API endpoints for production environment
        endpoints: {
            faceMatchEndpoint: 'http://localhost:5000/api/face-match',
            userDataEndpoint: 'http://localhost:5000/api/user-data',
            verificationLogEndpoint: 'http://localhost:5000/api/verification-log'
        },
        
        // Feature flags
        enableLivenessDetection: true,       // Check if the face is a real person (not a photo)
        enableSpoofingDetection: true,       // Detect attempts to spoof the system
        enableMultiFactorAuth: true,         // Require multiple forms of verification
        enableAuditLogging: true,            // Log all verification attempts for audit purposes
        
        // Error thresholds for auto-locking
        consecutiveFailures: 3,              // Number of consecutive failures before locking
        lockoutPeriod: 30 * 60 * 1000        // 30 minutes in milliseconds
    };

    /**
     * Initialize the authentication module
     * @param {Object} options - Configuration options
     * @returns {Promise<boolean>} - True if initialization was successful
     */
    const initialize = async (options = {}) => {
        if (isInitialized) {
            console.warn("AI Voter Authentication module is already initialized.");
            return true;
        }
        
        try {
            console.log("Initializing AI Voter Authentication module...");
            
            // Override default configuration with provided options
            Object.assign(config, options);
            
            // Check if we're running in production mode
            if (config.productionMode) {
                console.log("Running in production mode with secure API endpoints");
            } else {
                console.log("Running in development mode with local verification");
            }
            
            // Initialize resources
            attemptsRemaining = maxAttempts;
            
            // All done
            isInitialized = true;
            console.log("AI Voter Authentication module initialized successfully");
            return true;
        } catch (error) {
            console.error("Failed to initialize AI Voter Authentication:", error);
            return false;
        }
    };

    /**
     * Load user data based on provided credentials
     * @param {string} aadhaarNumber - Aadhaar identification number
     * @param {string} voterId - Voter ID
     * @param {string} mobileNumber - Registered mobile number
     * @returns {Promise<Object>} - User data object
     */
    const loadUserData = async (aadhaarNumber, voterId, mobileNumber) => {
        try {
            if (!isInitialized) await initialize();
            
            // Validate input parameters
            if (!aadhaarNumber || !voterId || !mobileNumber) {
                throw new Error("Missing required credentials");
            }
            
            console.log(`Loading user data for Aadhaar: ${aadhaarNumber.substring(0, 4)}XXXX, Voter ID: ${voterId}`);
            
            let userData;
            
            // In production mode, fetch from secure API
            if (config.productionMode) {
                const response = await fetch(config.endpoints.userDataEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        aadhaarNumber,
                        voterId,
                        mobileNumber
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status} ${response.statusText}`);
                }
                
                userData = await response.json();
                
                if (!userData.success) {
                    throw new Error(userData.message || "Failed to load user data");
                }
                
                // Extract the actual user data from the response
                userData = userData.data;
            } else {
                // In development mode, simulate server response
                // In a real system, this would come from a secure database
                userData = {
                    id: voterId,
                    aadhaarNumber: aadhaarNumber,
                    voterId: voterId,
                    mobileNumber: mobileNumber,
                    name: "Test Voter",
                    registeredFaceImage: "/images/users/WIN_20250408_19_12_01_Pro.jpg", // Path to reference image
                    isEligibleToVote: true,
                    hasVoted: false,
                    registrationDate: "2025-01-15T00:00:00.000Z"
                };
            }
            
            // Validate the user data
            if (!userData.registeredFaceImage) {
                throw new Error("User does not have a registered face image");
            }
            
            if (!userData.isEligibleToVote) {
                throw new Error("User is not eligible to vote");
            }
            
            if (userData.hasVoted && config.productionMode) {
                throw new Error("User has already voted");
            }
            
            // Store the user data for later use
            currentUserData = userData;
            
            return userData;
        } catch (error) {
            console.error("Error loading user data:", error);
            logAuthenticationEvent({
                type: 'error',
                stage: 'user_data_load',
                error: error.message,
                aadhaarNumber,
                voterId
            });
            throw error;
        }
    };

    /**
     * Start the camera for facial verification
     * @param {HTMLVideoElement} videoElement - The video element for camera display
     * @returns {Promise<boolean>} - True if camera started successfully
     */
    const startCamera = async (videoElement) => {
        try {
            if (!videoElement) {
                throw new Error("No video element provided for camera display");
            }
            
            console.log("Requesting camera access...");
            
            const constraints = {
                video: {
                    facingMode: 'user', // Use front camera for smartphones
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            // Access the user's camera
            cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Display the camera feed
            videoElement.srcObject = cameraStream;
            await videoElement.play();
            
            console.log("Camera started successfully");
            return true;
        } catch (error) {
            console.error("Error starting camera:", error);
            logAuthenticationEvent({
                type: 'error',
                stage: 'camera_start',
                error: error.message
            });
            throw error;
        }
    };

    /**
     * Stop the camera
     */
    const stopCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
            console.log("Camera stopped");
        }
    };

    /**
     * Capture an image from the camera
     * @param {HTMLVideoElement} videoElement - The video element with camera feed
     * @param {HTMLCanvasElement} canvasElement - The canvas element for capturing the image
     * @returns {Promise<string>} - Base64-encoded image data
     */
    const captureImage = (videoElement, canvasElement) => {
        return new Promise((resolve, reject) => {
            try {
                if (!videoElement || !canvasElement) {
                    throw new Error("Video or canvas element is missing");
                }
                
                const context = canvasElement.getContext('2d');
                
                // Set canvas dimensions to match video
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                
                // Draw the current video frame to the canvas
                context.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                
                // Convert the canvas to a base64-encoded image
                const imageData = canvasElement.toDataURL('image/jpeg', 0.8);
                resolve(imageData);
            } catch (error) {
                console.error("Error capturing image:", error);
                reject(error);
            }
        });
    };

    /**
     * Verify a captured face against the registered reference image
     * @param {string} capturedImage - Base64-encoded image data
     * @returns {Promise<Object>} - Verification result object
     */
    const verifyFace = async (capturedImage) => {
        try {
            if (!currentUserData) {
                throw new Error("No user data loaded. Please load user data first.");
            }
            
            if (!capturedImage) {
                throw new Error("No image captured for verification");
            }
            
            console.log("Verifying face...");
            isBusy = true;
            
            let result;

            // Always use the backend API endpoint for verification
            // The backend will handle Face++ API calls using credentials from .env
            console.log(`Sending verification request to: ${config.endpoints.faceMatchEndpoint}`);
            const response = await fetch(config.endpoints.faceMatchEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // No API key needed here; backend handles authentication
                },
                body: JSON.stringify({
                    capturedImage: capturedImage, // Base64 image data
                    userId: currentUserData.id, // Send user ID for backend lookup
                    voterId: currentUserData.voterId, // Also send voterId for redundancy/lookup
                    // Backend can decide if liveness/spoofing checks are needed based on its config
                })
            });

            if (!response.ok) {
                let errorMsg = `API error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMsg = errorData.message || errorMsg;
                } catch (e) { /* Ignore parsing error */ }
                throw new Error(errorMsg);
            }

            result = await response.json();

            if (!result.success) {
                throw new Error(result.message || "Face verification failed via backend");
            }

            // Extract the actual result data returned by the backend
            // Ensure the backend returns a structure like:
            // { isMatch: boolean, confidence: number, livenessConfirmed: boolean, spoofingDetected: boolean, processing: object }
            result = result.data;

            // Check if the verification passed our confidence threshold
            const passed = result.isMatch && 
                        result.confidence >= confidenceThreshold && 
                        (!config.enableLivenessDetection || result.livenessConfirmed) &&
                        (!config.enableSpoofingDetection || !result.spoofingDetected);
            
            // Create the verification result object
            verificationResult = {
                timestamp: new Date().toISOString(),
                userId: currentUserData.id,
                passed: passed,
                confidence: result.confidence,
                threshold: confidenceThreshold,
                livenessConfirmed: result.livenessConfirmed,
                spoofingDetected: result.spoofingDetected,
                attemptNumber: maxAttempts - attemptsRemaining + 1,
                processingDetails: result.processing
            };
            
            // Log the verification attempt
            logAuthenticationEvent({
                type: passed ? 'success' : 'failure',
                stage: 'face_verification',
                result: verificationResult
            });
            
            // Update attempts remaining
            if (!passed) {
                attemptsRemaining--;
            }
            
            return verificationResult;
        } catch (error) {
            console.error("Error verifying face:", error);
            logAuthenticationEvent({
                type: 'error',
                stage: 'face_verification',
                error: error.message
            });
            throw error;
        } finally {
            isBusy = false;
        }
    };

    /**
     * Complete the full verification process for a voter
     * @param {HTMLVideoElement} videoElement - The video element with camera feed
     * @param {HTMLCanvasElement} canvasElement - The canvas element for capturing the image
     * @param {string} aadhaarNumber - Aadhaar identification number
     * @param {string} voterId - Voter ID
     * @param {string} mobileNumber - Registered mobile number
     * @returns {Promise<Object>} - Verification result object
     */
    const completeVerification = async (videoElement, canvasElement, aadhaarNumber, voterId, mobileNumber) => {
        try {
            // Initialize if not already done
            if (!isInitialized) await initialize();
            
            // Reset attempts for new verification
            attemptsRemaining = maxAttempts;
            verificationResult = null;
            
            // Step 1: Load user data
            await loadUserData(aadhaarNumber, voterId, mobileNumber);
            
            // Step 2: Start camera
            await startCamera(videoElement);
            
            // Step 3: Capture image
            const capturedImage = await captureImage(videoElement, canvasElement);
            
            // Step 4: Verify face
            const result = await verifyFace(capturedImage);
            
            // Step 5: Stop camera
            stopCamera();
            
            // Step 6: Return verification result
            return {
                success: result.passed,
                message: result.passed ? 
                    "Face verification successful" : 
                    `Face verification failed. Confidence: ${(result.confidence * 100).toFixed(1)}%`,
                details: result,
                user: {
                    id: currentUserData.id,
                    name: currentUserData.name,
                    aadhaarNumber: aadhaarNumber,
                    voterId: voterId
                },
                attemptsRemaining: attemptsRemaining,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error("Error during verification process:", error);
            
            // Stop camera if still running
            stopCamera();
            
            return {
                success: false,
                message: error.message || "Verification process failed",
                attemptsRemaining: attemptsRemaining,
                timestamp: new Date().toISOString()
            };
        }
    };

    /**
     * Get the last verification result
     * @returns {Object|null} - The last verification result or null if none
     */
    const getLastVerificationResult = () => {
        return verificationResult;
    };

    /**
     * Check if a user has been verified
     * @returns {boolean} - True if the user has been successfully verified
     */
    const isUserVerified = () => {
        return verificationResult !== null && verificationResult.passed;
    };

    /**
     * Log authentication events for audit purposes
     * @param {Object} event - The event to log
     * @private
     */
    const logAuthenticationEvent = async (event) => {
        if (!config.enableAuditLogging) return;
        
        try {
            // Add timestamp and user context if available
            const logEntry = {
                ...event,
                timestamp: new Date().toISOString(),
                userId: currentUserData?.id || null,
                voterId: currentUserData?.voterId || null
            };
            
            // In production, send to server
            if (config.productionMode) {
                await fetch(config.endpoints.verificationLogEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(logEntry)
                });
            } else {
                // In development, just log to console
                console.log("Auth Log:", logEntry);
            }
        } catch (error) {
            console.error("Error logging authentication event:", error);
        }
    };

    /**
     * Create verification session data for storing in browser session
     * This allows the verification state to persist across page refreshes
     * @returns {Object} - Session data object
     */
    const createVerificationSession = () => {
        if (!isUserVerified() || !currentUserData) {
            throw new Error("Cannot create session: User not verified");
        }
        
        const sessionData = {
            verified: true,
            userId: currentUserData.id,
            voterId: currentUserData.voterId,
            name: currentUserData.name,
            timestamp: new Date().toISOString(),
            expiry: new Date(Date.now() + 1800000).toISOString() // 30 minutes expiry
        };
        
        // Store in session storage
        sessionStorage.setItem('voterVerification', JSON.stringify(sessionData));
        
        return sessionData;
    };

    /**
     * Validate a verification session
     * @returns {Object|null} - Session data if valid, null otherwise
     */
    const validateVerificationSession = () => {
        try {
            const sessionData = JSON.parse(sessionStorage.getItem('voterVerification'));
            
            if (!sessionData) return null;
            
            // Check if session has expired
            if (new Date(sessionData.expiry) < new Date()) {
                sessionStorage.removeItem('voterVerification');
                return null;
            }
            
            return sessionData;
        } catch (error) {
            console.error("Error validating verification session:", error);
            return null;
        }
    };

    /**
     * Clear the verification session
     */
    const clearVerificationSession = () => {
        sessionStorage.removeItem('voterVerification');
    };

    // Public API
    return {
        initialize,
        loadUserData,
        startCamera,
        stopCamera,
        captureImage,
        verifyFace,
        completeVerification,
        getLastVerificationResult,
        isUserVerified,
        createVerificationSession,
        validateVerificationSession,
        clearVerificationSession,
        
        // Getters for module state
        getConfig: () => ({ ...config }),
        getAttemptsRemaining: () => attemptsRemaining,
        isInitialized: () => isInitialized,
        isBusy: () => isBusy
    };
})();

// Export for use in other modules
window.aiVoterAuthentication = aiVoterAuthentication;

console.log("AI Voter Authentication module loaded");
