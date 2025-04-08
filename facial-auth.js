/**
 * Facial Authentication Module
 * 
 * This module provides facial recognition authentication using CNN (Convolutional Neural Networks)
 * via TensorFlow.js. It captures images from the user's camera, extracts facial features,
 * and compares them with stored reference images to authenticate users before voting.
 */

// Load configuration safely
const config = window.productionConfig || {};
// Create a safe logger that doesn't expose sensitive info in production
const log = (function() {
    const isProd = config?.isProd || (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'));
    const logger = config?.log || console;
    
    return {
        info: (message, data = {}) => {
            if (isProd) {
                // In production, strip potentially sensitive data
                const safeData = {...data};
                delete safeData.apiKey;
                delete safeData.imageData;
                logger.info(message, safeData);
            } else {
                logger.info(message, data);
            }
        },
        debug: (message, data = {}) => {
            if (!isProd) {
                logger.debug ? logger.debug(message, data) : logger.log(message, data);
            }
        },
        warn: logger.warn ? logger.warn.bind(logger) : logger.log.bind(logger),
        error: (error, context = {}) => {
            if (isProd) {
                // In production, log errors without sensitive data
                const safeContext = {...context};
                delete safeContext.apiKey;
                delete safeContext.imageData;
                logger.error(error.message || error, safeContext);
            } else {
                logger.error(error, context);
            }
        }
    };
})();

// Determine environment
const isProd = config?.isProd || (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1'));

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
    detectionInterval: config?.facialAuth?.detectionInterval || 100 // Face detection interval in ms
};

// Log module initialization with safe data
log.info("Loading Facial Authentication Module", { 
    enabled: isFacialAuthEnabled,
    environment: isProd ? "production" : "development",
    useBackendAPI: facialAuthConfig.useBackendAPI,
    usingLocalModels: facialAuthConfig.modelPath.startsWith('/')
});

// Facial Authentication namespace - Refactored for Login Flow
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
     * and sends data to the backend for verification.
     * @param {string} aadhar - The verified Aadhar number.
     * @param {string} voterId - The verified Voter ID.
     * @returns {Promise<object>} - Promise resolving with { success: boolean, message: string, userId: string? }
     */
    async function captureAndVerify(aadhar, voterId) {
        if (!activeVideoElement || !activeCanvasElement || !activeMediaStream) {
            // Try to re-acquire elements if they became null but stream might exist
            if (!activeVideoElement) activeVideoElement = document.getElementById('facialAuthVideo'); // Assuming ID from login.html
            if (!activeCanvasElement) activeCanvasElement = document.getElementById('facialAuthCanvas'); // Assuming ID from login.html
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
        
        // Ensure models are loaded before proceeding
        await ensureModelsLoaded();
        if (!faceNetModel) {
             throw new Error("FaceNet model failed to load. Cannot verify.");
        }

        log.info("Capturing frame for verification...", { aadhar: effectiveAadhar.slice(-4), voterId: effectiveVoterId }); // Log partial Aadhar

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
    async function verifyCredentials(aadhar, voterId, mobile) {
        if (!aadhar || !voterId || !mobile) {
            throw new Error("Aadhar number, Voter ID and mobile number are required");
        }
        
        // Store for future use
        setCredentials(aadhar, voterId, mobile);
        
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
    
    // --- Public API ---
    // Expose the functions needed by the login page script
    return {
        // Camera functions
        startCamera,
        stopCamera,
        captureAndVerify,
        destroy,
        
        // Multi-factor authentication
        verifyCredentials, // NEW: Send Aadhar, Voter ID, mobile, get OTP
        verifyOtp,         // NEW: Verify the OTP
        
        // Credential management
        setCredentials,
        setOtpVerified,
        isOtpVerified,
        
        // Development helpers
        getRandomVoter
    };

})();

// Removed Voting Verification Specific Functions and DOMContentLoaded/beforeunload listeners
