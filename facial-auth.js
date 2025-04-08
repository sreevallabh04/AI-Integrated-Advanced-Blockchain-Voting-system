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

// Facial Authentication namespace
window.facialAuth = (function() {
    // Private variables
    let isInitialized = false;
    let faceDetectionModel = null;
    let faceNetModel = null;
    let videoElement = null;
    let canvasElement = null;
    let mediaStream = null;
    let currentUser = null;
    let authAttempts = 0;
    let authListeners = [];
    let detectionTimer = null;
    let activeTensors = []; // Track tensors for proper cleanup
    let modelLoadingPromise = null; // Cache model loading promise
    let tensorMemoryUsage = 0; // Track tensor memory usage
    let isDestroyed = false; // Track if module has been destroyed
    
    /**
     * Initialize the facial authentication system
     */
    async function initialize() {
        if (!isFacialAuthEnabled) {
            log.info("Facial authentication is disabled via configuration");
            return false;
        }
        
        if (isInitialized) {
            log.debug("Facial authentication already initialized");
            return true;
        }
        
        // Check browser compatibility
        if (!checkBrowserCompatibility()) {
            log.warn("Browser not fully compatible with facial authentication");
            showError("Your browser may not fully support facial authentication. Some features may not work correctly.");
            // Continue anyway but user is warned
        }
        
        try {
            log.info("Initializing facial authentication system");
            
            // Create UI elements if they don't exist
            await createUIElements();
            
            // Load TensorFlow.js if not already loaded
            if (typeof tf === 'undefined') {
                try {
                    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.13.0/dist/tf.min.js');
                    log.debug("TensorFlow.js loaded");
                    
                    // Set memory management options
                    if (tf.env) {
                        tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0); // Aggressive cleanup
                        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true); // Use smaller textures
                        tf.env().set('WEBGL_RENDER_FLOAT32_CAPABLE', true);
                        
                        // Check WebGL capabilities
                        if (!tf.env().getBackend()) {
                            tf.setBackend('cpu');
                            log.warn("WebGL not available, using CPU backend");
                        }
                    }
                } catch (tfError) {
                    log.error(tfError, { context: 'loadTensorFlow' });
                    showError("Failed to load TensorFlow.js. Please check your internet connection and try again.");
                    return false;
                }
            }
            
            // Load TensorFlow.js models with caching and fallbacks
            try {
                await loadModels();
            } catch (modelError) {
                log.error(modelError, { context: 'loadModels' });
                showError("Failed to load facial recognition models. Please try again later.");
                return false;
            }
            
            isInitialized = true;
            log.info("Facial authentication initialized successfully");
            
            // Set up periodic memory management
            if (typeof tf !== 'undefined') {
                setInterval(() => {
                    if (tensorMemoryUsage > facialAuthConfig.tensorMemoryLimit) {
                        disposeTensors();
                        tf.tidy(() => {}); // Force garbage collection
                        tensorMemoryUsage = 0;
                    }
                }, 30000); // Check every 30 seconds
            }
            
            return true;
        } catch (error) {
            log.error(error, { context: 'facialAuthInitialization' });
            showError("Failed to initialize facial authentication. Please try again later.");
            return false;
        }
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
     * Load models with caching and fallbacks
     */
    async function loadModels() {
        // Only load models once
        if (faceDetectionModel && faceNetModel) {
            return;
        }
        
        // Use cached promise if already loading
        if (modelLoadingPromise) {
            return modelLoadingPromise;
        }
        
        // Create and cache the loading promise
        modelLoadingPromise = (async () => {
            try {
                // Set up model loading
                const loadDetectionModel = async () => {
                    try {
                        log.debug("Attempting to load face detection model from local path");
                        return await tf.loadGraphModel(facialAuthConfig.modelPath);
                    } catch (localError) {
                        log.warn("Failed to load local face detection model, using CDN fallback", { error: localError.message });
                        return await tf.loadGraphModel(facialAuthConfig.fallbackModelPath, {
                            fromTFHub: true
                        });
                    }
                };
                
                const loadFaceNetModel = async () => {
                    try {
                        log.debug("Attempting to load FaceNet model from local path");
                        return await tf.loadGraphModel(facialAuthConfig.faceNetPath);
                    } catch (localError) {
                        log.warn("Failed to load local FaceNet model, using CDN fallback", { error: localError.message });
                        return await tf.loadGraphModel(facialAuthConfig.fallbackFaceNetPath, {
                            fromTFHub: true
                        });
                    }
                };
                
                // Load models concurrently
                [faceDetectionModel, faceNetModel] = await Promise.all([
                    loadDetectionModel(),
                    loadFaceNetModel()
                ]);
                
                // Warm up models with a blank tensor
                const dummyTensor = tf.zeros([1, 160, 160, 3]);
                await faceDetectionModel.executeAsync(dummyTensor);
                await faceNetModel.predict(dummyTensor);
                dummyTensor.dispose();
                
                log.info("Facial recognition models loaded successfully");
            } catch (error) {
                modelLoadingPromise = null; // Clear cache on error
                throw error;
            }
        })();
        
        return modelLoadingPromise;
    }
    
    /**
     * Create UI elements for facial authentication
     */
    async function createUIElements() {
        try {
            // Check if elements already exist
            if (document.getElementById('facialAuthContainer')) {
                return;
            }
            
            // Create the container
            const container = document.createElement('div');
            container.id = 'facialAuthContainer';
            container.className = 'facial-auth-container';
            
            // Create HTML structure
            container.innerHTML = `
                <div class="auth-header">
                    <h3>Facial Recognition Authentication</h3>
                    <p class="auth-description">Please look at the camera to verify your identity before voting.</p>
                </div>
                
                <div class="camera-container">
                    <video id="facialAuthVideo" playsinline autoplay muted></video>
                    <canvas id="facialAuthCanvas" style="display: none;"></canvas>
                    <div id="faceOverlay" class="face-overlay">
                        <div class="face-target"></div>
                    </div>
                </div>
                
                <div class="auth-status" id="authStatus">
                    <div class="status-icon"></div>
                    <div class="status-message">Waiting for camera access</div>
                </div>
                
                <div class="auth-controls">
                    <button id="startAuthButton" class="auth-button">Start Authentication</button>
                    <button id="captureButton" class="auth-button" disabled>Capture Image</button>
                    <button id="cancelAuthButton" class="auth-button secondary">Cancel</button>
                </div>
                
                <div class="auth-error" id="authError" style="display: none;"></div>
            `;
            
            // Add to page before the voting section
            const votingSection = document.querySelector('.voting-section') || 
                                document.getElementById('votingContainer');
            
            if (votingSection) {
                votingSection.parentNode.insertBefore(container, votingSection);
            } else {
                // Fallback: add to the main container
                const mainContainer = document.querySelector('main') || document.querySelector('body');
                mainContainer.insertBefore(container, mainContainer.firstChild);
            }
            
            // Store references to elements
            videoElement = document.getElementById('facialAuthVideo');
            canvasElement = document.getElementById('facialAuthCanvas');
            
            // Add event listeners
            document.getElementById('startAuthButton').addEventListener('click', startAuthentication);
            document.getElementById('captureButton').addEventListener('click', captureAndAuthenticate);
            document.getElementById('cancelAuthButton').addEventListener('click', cancelAuthentication);
            
            // Add CSS styles
            addStyles();
            
            log.debug("Facial authentication UI elements created");
        } catch (error) {
            log.error(error, { context: 'createUIElements' });
            throw new Error("Failed to create UI elements: " + error.message);
        }
    }
    
    /**
     * Start the facial authentication process
     */
    async function startAuthentication() {
        try {
            if (!isInitialized) {
                await initialize();
            }
            
            // Update UI
            document.getElementById('startAuthButton').disabled = true;
            document.getElementById('captureButton').disabled = false;
            updateStatus("Starting camera...", "in-progress");
            
            // Check for camera permissions
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Your browser doesn't support camera access");
            }
            
            try {
                // Access the user's camera
                mediaStream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                
                // Connect the camera to the video element
                videoElement.srcObject = mediaStream;
                await videoElement.play();
                
                // Adjust canvas dimensions to match video
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                
                // Show face overlay
                document.getElementById('faceOverlay').style.opacity = '1';
                
                // Update UI
                updateStatus("Position your face in the center", "in-progress");
                
                // Start face detection
                startFaceDetection();
            } catch (cameraError) {
                if (cameraError.name === 'NotAllowedError') {
                    throw new Error("Camera access denied. Please allow camera access and try again.");
                } else {
                    throw new Error("Failed to access camera: " + cameraError.message);
                }
            }
        } catch (error) {
            log.error(error, { context: 'startAuthentication' });
            showError(error.message);
            document.getElementById('startAuthButton').disabled = false;
            document.getElementById('captureButton').disabled = true;
            updateStatus("Authentication failed", "error");
        }
    }
    
    /**
     * Start continuous face detection with throttling and memory management
     */
    function startFaceDetection() {
        if (!faceDetectionModel || !videoElement) return;
        
        // Clear any existing timer
        if (detectionTimer) {
            clearInterval(detectionTimer);
        }
        
        // Set up throttled detection
        detectionTimer = setInterval(async () => {
            if (!mediaStream || !mediaStream.active || isDestroyed) {
                clearInterval(detectionTimer);
                return;
            }
            
            try {
                await tf.tidy(() => {  // Use tidy for automatic tensor cleanup
                    // Capture current frame from video
                    const videoFrame = tf.browser.fromPixels(videoElement);
                    
                    // Process image for face detection
                    const expandedFrame = videoFrame.expandDims(0);
                    
                    // Run face detection model
                    return faceDetectionModel.executeAsync(expandedFrame).then(async predictions => {
                        // Extract face detections
                        const faces = extractFaceDetections(predictions);
                        
                        // Clean up prediction tensors
                        predictions.forEach(tensor => tensor.dispose());
                        
                        // Update UI based on face detection
                        updateFaceDetectionUI(faces);
                    });
                });
                
                // Track memory usage
                if (typeof tf !== 'undefined' && tf.memory) {
                    const memoryInfo = tf.memory();
                    tensorMemoryUsage = memoryInfo.numBytes / (1024 * 1024); // Convert to MB
                    
                    // Cleanup if threshold exceeded
                    if (tensorMemoryUsage > facialAuthConfig.tensorMemoryLimit) {
                        disposeTensors();
                    }
                }
            } catch (error) {
                log.error(error, { context: 'faceDetection' });
                updateStatus("Face detection error", "error");
                
                // If there's a critical error, pause and retry after delay
                clearInterval(detectionTimer);
                setTimeout(() => {
                    if (!isDestroyed && mediaStream && mediaStream.active) {
                        startFaceDetection();
                    }
                }, 5000);
            }
        }, facialAuthConfig.detectionInterval);
    }
    
    /**
     * Extract face detections from model predictions
     */
    function extractFaceDetections(predictions) {
        // Use tf.tidy to automatically clean up tensors
        return tf.tidy(() => {
            // Extract faces from model output synchronously to avoid memory leaks
            const boxes = predictions[0].arraySync();
            const scores = predictions[1].arraySync();
            
            const faces = [];
            for (let i = 0; i < scores[0].length; i++) {
                if (scores[0][i] > 0.5) { // Confidence threshold
                    const box = boxes[0][i];
                    faces.push({
                        yMin: box[0],
                        xMin: box[1],
                        yMax: box[2],
                        xMax: box[3],
                        score: scores[0][i]
                    });
                }
            }
            
            return faces;
        });
    }
    
    /**
     * Update UI based on face detection results
     */
    function updateFaceDetectionUI(faces) {
        const overlay = document.getElementById('faceOverlay');
        if (!overlay) return;
        
        const target = overlay.querySelector('.face-target');
        if (!target) return;
        
        if (faces.length === 0) {
            // No face detected
            target.classList.remove('detected');
            document.getElementById('captureButton').disabled = true;
            updateStatus("No face detected. Please position your face in the center.", "warning");
        } else if (faces.length === 1) {
            // Single face detected
            target.classList.add('detected');
            document.getElementById('captureButton').disabled = false;
            updateStatus("Face detected. Ready to authenticate.", "ready");
        } else {
            // Multiple faces detected
            target.classList.remove('detected');
            document.getElementById('captureButton').disabled = true;
            updateStatus("Multiple faces detected. Please ensure only your face is visible.", "warning");
        }
    }
    
    /**
     * Capture image and authenticate user
     */
    async function captureAndAuthenticate() {
        try {
            if (!videoElement || !canvasElement) {
                throw new Error("Video or canvas element not found");
            }
            
            // Update UI
            updateStatus("Capturing image...", "in-progress");
            document.getElementById('captureButton').disabled = true;
            
            // Temporarily pause face detection to free up resources
            if (detectionTimer) {
                clearInterval(detectionTimer);
                detectionTimer = null;
            }
            
            // Clean up any existing tensors
            disposeTensors();
            
            await tf.tidy(async () => {
                // Draw current video frame to canvas
                const ctx = canvasElement.getContext('2d');
                ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                
                // Get image data from canvas
                const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
                
                // Extract face features
                updateStatus("Analyzing facial features...", "in-progress");
                const faceFeatures = await extractFaceFeatures(imageData);
                
                if (!faceFeatures) {
                    throw new Error("Failed to extract facial features");
                }
                
                // Authenticate user
                updateStatus("Comparing with reference image...", "in-progress");
                await authenticateUser(faceFeatures);
            });
        } catch (error) {
            log.error(error, { context: 'captureAndAuthenticate' });
            showError(error.message);
            document.getElementById('captureButton').disabled = false;
            updateStatus("Authentication failed", "error");
            
            // Increment failed attempts
            authAttempts++;
            
            if (authAttempts >= facialAuthConfig.maxAttempts) {
                showError("Maximum authentication attempts reached. Please try again later.");
                cancelAuthentication();
            } else {
                document.getElementById('captureButton').disabled = false;
                
                // Resume face detection
                startFaceDetection();
            }
        }
    }
    
    /**
     * Extract face features using FaceNet model
     */
    async function extractFaceFeatures(imageData) {
        if (!faceNetModel) {
            await loadModels();
            if (!faceNetModel) {
                throw new Error("Face feature extraction model not loaded");
            }
        }
        
        return tf.tidy(() => {
            try {
                // Convert image data to tensor
                const imageTensor = tf.browser.fromPixels(imageData, 3);
                
                // Normalize and resize image for FaceNet (depends on model requirements)
                const normalized = imageTensor.toFloat().div(tf.scalar(255))
                    .expandDims(0).resizeBilinear([160, 160]); // FaceNet typically uses 160x160
                
                // Extract features
                const features = faceNetModel.predict(normalized);
                
                // Get feature vector (embedding)
                return features.dataSync();
            } catch (error) {
                log.error(error, { context: 'extractFaceFeatures' });
                return null;
            }
        });
    }
    
    /**
     * Authenticate user by comparing face features
     */
    async function authenticateUser(faceFeatures) {
        try {
            // Get user ID from input or session
            const userId = document.getElementById('userIdInput')?.value || 
                          sessionStorage.getItem('userId') || 
                          localStorage.getItem('userId') || 'default';
            
            let isAuthenticated = false;
            
            // In production, use backend API for secure comparison
            if (facialAuthConfig.useBackendAPI) {
                // Get image data from canvas in base64 format with compression
                const imageData = canvasElement.toDataURL('image/jpeg', facialAuthConfig.compression);
                
                // Call backend API for verification
                try {
                    const apiEndpoint = facialAuthConfig.apiEndpoint;
                    
                    // Get API key from secure context (HTTP-only cookie is best practice)
                    // Never expose API keys in client-side code or localStorage
                    const apiKey = config?.facialAuth?.apiKey || 
                                  document.cookie.split('; ')
                                      .find(row => row.startsWith('facialAuthKey='))
                                      ?.split('=')[1] || 
                                  null;
                    
                    log.info("Sending authentication request to server", { 
                        endpoint: apiEndpoint,
                        userId 
                    });
                    
                    const headers = {
                        'Content-Type': 'application/json'
                    };
                    
                    // Only add API key if available
                    if (apiKey) {
                        headers['Authorization'] = `Bearer ${apiKey}`;
                    }
                    
                    // Add CSRF token if available
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
                    if (csrfToken) {
                        headers['X-CSRF-Token'] = csrfToken;
                    }
                    
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers,
                        credentials: 'same-origin', // Include cookies in the request
                        body: JSON.stringify({
                            userId: userId,
                            imageData: imageData,
                            timestamp: Date.now(), // Prevent replay attacks
                            // Include faceFeatures for higher security implementations
                            // where the server does the comparison
                            faceFeatures: isProd ? faceFeatures : undefined
                        })
                    });
                    
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Authentication API error: ${response.status} - ${errorText}`);
                    }
                    
                    const result = await response.json();
                    isAuthenticated = result.verified === true;
                    
                    log.info("Authentication response received", { 
                        verified: isAuthenticated,
                        details: { 
                            userId: result.details?.userId,
                            timestamp: result.details?.timestamp
                        }
                    });
                    
                    if (isAuthenticated) {
                        currentUser = {
                            id: userId,
                            name: result.details?.userName || userId,
                            similarity: result.details?.similarity || 0,
                            authTime: new Date().toISOString()
                        };
                    }
                } catch (apiError) {
                    log.error(apiError, { context: 'authenticationAPI' });
                    
                    // In production, don't fall back to local authentication
                    if (isProd) {
                        throw new Error("Authentication service unavailable. Please try again later.");
                    }
                    
                    // In development only, fall back to mock authentication
                    log.warn("API authentication failed, falling back to mock authentication");
                    isAuthenticated = mockAuthentication(userId);
                }
            } else {
                // For development/demo only: use simulated authentication
                if (isProd) {
                    log.error(new Error("Mock authentication attempted in production"), { context: 'securityViolation' });
                    throw new Error("Authentication configuration error");
                }
                isAuthenticated = mockAuthentication(userId);
            }
            
            if (isAuthenticated) {
                // Authentication successful
                updateStatus("Authentication successful", "success");
                
                // Store authentication state
                // Use more secure alternatives in production
                if (isProd) {
                    // In production, don't store sensitive auth state in client
                    // The server should maintain the authenticated state via secure HTTP-only cookies
                    sessionStorage.setItem('facialAuthComplete', 'true');
                } else {
                    // For development/testing only
                    sessionStorage.setItem('authenticated', 'true');
                    sessionStorage.setItem('userId', currentUser.id);
                }
                
                // Notify listeners
                notifyAuthListeners(true, currentUser);
                
                // Hide authentication UI or transition to voting
                setTimeout(() => {
                    document.getElementById('facialAuthContainer').classList.add('authenticated');
                    displayAuthSuccess();
                    
                    // Enable voting section
                    enableVotingSection();
                }, 1000);
            } else {
                // Authentication failed
                authAttempts++;
                updateStatus(`Authentication failed (Attempt ${authAttempts}/${facialAuthConfig.maxAttempts})`, "error");
                
                // Notify listeners
                notifyAuthListeners(false);
                
                if (authAttempts >= facialAuthConfig.maxAttempts) {
                    showError("Maximum authentication attempts reached. Please try again later.");
                    cancelAuthentication();
                } else {
                    // Enable retry
                    document.getElementById('captureButton').disabled = false;
                    
                    // Resume face detection
                    startFaceDetection();
                }
            }
        } catch (error) {
            log.error(error, { context: 'authenticateUser' });
            throw error;
        }
    }
    
    /**
     * Mock authentication for development/testing only
     */
    function mockAuthentication(userId) {
        // Security check - never allow in production
        if (isProd) {
            log.error("Attempted to use mock authentication in production", { userId });
            return false;
        }
        
        // For development only, return true 80% of the time
        const mockSuccess = Math.random() < 0.8;
        
        if (mockSuccess) {
            currentUser = {
                id: userId,
                name: `Test User (${userId})`,
                similarity: 0.85,
                isMock: true,
                authTime: new Date().toISOString()
            };
        }
        
        log.debug("DEVELOPMENT MODE: Mock authentication", { success: mockSuccess, userId });
        return mockSuccess;
    }
    
    /**
     * Display authentication success UI
     */
    function displayAuthSuccess() {
        // Create success message
        const successMessage = document.createElement('div');
        successMessage.className = 'auth-success';
        successMessage.innerHTML = `
            <div class="success-icon">✓</div>
            <div class="success-message">
                <h4>Authentication Successful</h4>
                <p>Welcome ${currentUser?.name || 'User'}!</p>
                <p>You can now proceed to vote.</p>
            </div>
        `;
        
        // Replace camera container with success message
        const cameraContainer = document.querySelector('.camera-container');
        if (cameraContainer) {
            cameraContainer.innerHTML = '';
            cameraContainer.appendChild(successMessage);
        }
        
        // Update controls
        const authControls = document.querySelector('.auth-controls');
        if (authControls) {
            authControls.innerHTML = `
                <button id="proceedToVoteButton" class="auth-button primary">Proceed to Vote</button>
            `;
            
            // Add event listener
            document.getElementById('proceedToVoteButton').addEventListener('click', () => {
                // Hide auth container and show voting section
                document.getElementById('facialAuthContainer').style.display = 'none';
                
                // Show voting section
                const votingSection = document.querySelector('.voting-section') || 
                                    document.getElementById('votingContainer');
                if (votingSection) {
                    votingSection.style.display = 'block';
                    // Scroll to voting section
                    votingSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }
    }
    
    /**
     * Enable the voting section after successful authentication
     */
    function enableVotingSection() {
        const votingSection = document.querySelector('.voting-section') || 
                            document.getElementById('votingContainer');
        
        if (votingSection) {
            // Show voting section but keep it disabled until "Proceed to Vote" is clicked
            votingSection.style.display = 'none';
            
            // Remove disabled class/attribute from inputs
            votingSection.querySelectorAll('button, input, select').forEach(element => {
                element.disabled = false;
                element.classList.remove('disabled');
            });
            
            // Add user info to voting form if applicable
            const userIdField = votingSection.querySelector('.voter-id');
            if (userIdField && currentUser) {
                userIdField.value = currentUser.id;
                userIdField.disabled = true;
            }
        }
    }
    
    /**
     * Cancel the authentication process and clean up resources
     */
    function cancelAuthentication() {
        // Stop detection timer
        if (detectionTimer) {
            clearInterval(detectionTimer);
            detectionTimer = null;
        }
        
        // Stop media stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // Reset video element
        if (videoElement) {
            videoElement.srcObject = null;
        }
        
        // Clean up tensors
        disposeTensors();
        
        // Reset UI
        document.getElementById('startAuthButton').disabled = false;
        document.getElementById('captureButton').disabled = true;
        updateStatus("Authentication cancelled", "idle");
        
        // Hide face overlay
        const overlay = document.getElementById('faceOverlay');
        if (overlay) {
            overlay.style.opacity = '0';
        }
        
        // Reset attempts
        authAttempts = 0;
        
        // Notify listeners
        notifyAuthListeners(false);
    }
    
    /**
     * Update authentication status UI
     */
    function updateStatus(message, status = 'idle') {
        const statusElement = document.getElementById('authStatus');
        if (!statusElement) return;
        
        // Update status class
        statusElement.className = 'auth-status ' + status;
        
        // Update message
        const messageElement = statusElement.querySelector('.status-message');
        if (messageElement) {
            messageElement.textContent = message;
        }
    }
    
    /**
     * Show error message
     */
    function showError(message) {
        const errorElement = document.getElementById('authError');
        if (!errorElement) return;
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Register authentication listener
     */
    function registerAuthListener(callback) {
        if (typeof callback === 'function') {
            authListeners.push(callback);
        }
    }
    
    /**
     * Notify all authentication listeners
     */
    function notifyAuthListeners(isAuthenticated, user = null) {
        authListeners.forEach(listener => {
            try {
                listener(isAuthenticated, user);
            } catch (error) {
                log.error(error, { context: 'authListener' });
            }
        });
    }
    
    /**
     * Clean up tensors to prevent memory leaks
     */
    function disposeTensors() {
        try {
            if (typeof tf !== 'undefined') {
                // Dispose tracked tensors
                activeTensors.forEach(tensor => {
                    if (tensor && !tensor.isDisposed) {
                        tensor.dispose();
                    }
                });
                activeTensors = [];
                
                // Run garbage collection
                tf.disposeVariables();
                tf.tidy(() => {});
            }
        } catch (error) {
            log.warn("Error cleaning up tensors", { error: error.message });
        }
    }
    
    /**
     * Add CSS styles for facial authentication UI
     */
    function addStyles() {
        // Check if styles already exist
        if (document.getElementById('facialAuthStyles')) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = 'facialAuthStyles';
        styleElement.textContent = `
            .facial-auth-container {
                background-color: #f8f9fa;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 30px;
                padding: 20px;
                transition: all 0.3s ease;
            }
            
            .facial-auth-container.authenticated {
                background-color: #e8f5e9;
                border-left: 4px solid #4caf50;
            }
            
            .auth-header {
                margin-bottom: 20px;
                text-align: center;
            }
            
            .auth-header h3 {
                margin-top: 0;
                color: #333;
            }
            
            .auth-description {
                color: #666;
                margin-bottom: 0;
            }
            
            .camera-container {
                position: relative;
                width: 100%;
                max-width: 640px;
                margin: 0 auto 20px;
                border-radius: 8px;
                overflow: hidden;
                background-color: #000;
            }
            
            #facialAuthVideo {
                width: 100%;
                height: auto;
                display: block;
                transform: scaleX(-1); /* Mirror video */
            }
            
            #facialAuthCanvas {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
            }
            
            .face-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .face-target {
                width: 200px;
                height: 200px;
                border: 2px dashed rgba(255, 255, 255, 0.7);
                border-radius: 50%;
                transition: all 0.3s ease;
            }
            
            .face-target.detected {
                border-color: rgba(76, 175, 80, 0.8);
                border-style: solid;
                box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
            }
            
            .auth-status {
                display: flex;
                align-items: center;
                padding: 10px 15px;
                background-color: #f5f5f5;
                border-radius: 5px;
                margin-bottom: 20px;
            }
            
            .auth-status.in-progress {
                background-color: #e3f2fd;
                border-left: 3px solid #2196f3;
            }
            
            .auth-status.ready {
                background-color: #e8f5e9;
                border-left: 3px solid #4caf50;
            }
            
            .auth-status.warning {
                background-color: #fff8e1;
                border-left: 3px solid #ffc107;
            }
            
            .auth-status.error {
                background-color: #ffebee;
                border-left: 3px solid #f44336;
            }
            
            .auth-status.success {
                background-color: #e8f5e9;
                border-left: 3px solid #4caf50;
            }
            
            .status-icon {
                width: 20px;
                height: 20px;
                margin-right: 10px;
            }
            
            .status-message {
                flex: 1;
            }
            
            .auth-controls {
                display: flex;
                justify-content: center;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .auth-button {
                padding: 10px 20px;
                border-radius: 5px;
                border: none;
                cursor: pointer;
                font-size: 16px;
                transition: all 0.2s ease;
            }
            
            .auth-button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            
            .auth-button:not(.secondary) {
                background-color: #3f51b5;
                color: white;
            }
            
            .auth-button:not(.secondary):hover:not(:disabled) {
                background-color: #303f9f;
            }
            
            .auth-button.secondary {
                background-color: #f5f5f5;
                color: #333;
            }
            
            .auth-button.secondary:hover:not(:disabled) {
                background-color: #e0e0e0;
            }
            
            .auth-button.primary {
                background-color: #4caf50;
                color: white;
            }
            
            .auth-button.primary:hover:not(:disabled) {
                background-color: #388e3c;
            }
            
            .auth-error {
                background-color: #ffebee;
                color: #d32f2f;
                padding: 10px 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                text-align: center;
            }
            
            .auth-success {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
            }
            
            .success-icon {
                font-size: 48px;
                color: #4caf50;
                margin-bottom: 20px;
                width: 80px;
                height: 80px;
                background-color: #e8f5e9;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .success-message h4 {
                margin-top: 0;
                color: #333;
            }
            
            /* Responsive styles */
            @media (max-width: 768px) {
                .auth-controls {
                    flex-direction: column;
                    gap: 10px;
                }
                
                .auth-button {
                    width: 100%;
                }
                
                .face-target {
                    width: 150px;
                    height: 150px;
                }
            }
        `;
        
        document.head.appendChild(styleElement);
    }
    
    /**
     * Completely destroy the module and clean up all resources
     */
    function destroy() {
        isDestroyed = true;
        
        // Cancel any ongoing authentication
        cancelAuthentication();
        
        // Clean up models if loaded
        if (faceDetectionModel) {
            try {
                faceDetectionModel.dispose();
            } catch (e) { /* ignore */ }
            faceDetectionModel = null;
        }
        
        if (faceNetModel) {
            try {
                faceNetModel.dispose();
            } catch (e) { /* ignore */ }
            faceNetModel = null;
        }
        
        // Reset module state
        isInitialized = false;
        modelLoadingPromise = null;
        
        // Clean up UI elements if needed
        const container = document.getElementById('facialAuthContainer');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        
        log.info("Facial authentication module destroyed");
    }
    
    // Public API
    return {
        initialize,
        startAuthentication,
        cancelAuthentication,
        registerAuthListener,
        isAuthenticated: () => !!currentUser,
        getCurrentUser: () => currentUser,
        getAuthenticationStatus: () => {
            return {
                initialized: isInitialized,
                authenticated: !!currentUser,
                user: currentUser
            };
        },
        destroy  // Add destroy method for complete cleanup
    };
})();

// Initialize facial authentication when the page loads, with error handling
document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-initialization is enabled in config
    const config = window.productionConfig || {};
    if (config?.facialAuth?.autoInitialize !== false) {
        // Delay initialization slightly to not block page rendering
        setTimeout(() => {
            try {
                // Initialize facial authentication (don't await to avoid blocking)
                window.facialAuth.initialize().then(success => {
                    if (success) {
                        log.info("Facial authentication initialized successfully");
                    } else {
                        log.warn("Facial authentication initialization failed");
                    }
                }).catch(error => {
                    log.error(error, { context: 'initializationError' });
                });
            } catch (error) {
                log.error(error, { context: 'criticalInitializationError' });
            }
        }, 500);
    }
});

// Handle page unload to clean up resources
window.addEventListener('beforeunload', () => {
    try {
        // Cancel any ongoing authentication to release camera
        if (window.facialAuth) {
            window.facialAuth.cancelAuthentication();
        }
    } catch (error) {
        // Ignore errors during page unload
    }
});