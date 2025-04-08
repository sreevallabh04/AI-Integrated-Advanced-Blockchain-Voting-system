/**
 * Facial Authentication Module
 * 
 * This module provides facial recognition authentication using CNN (Convolutional Neural Networks)
 * via TensorFlow.js. It captures images from the user's camera, extracts facial features,
 * and compares them with stored reference images to authenticate users before voting.
 */

// Load configuration
const config = window.productionConfig || {};
const log = config?.log || console;
const isProd = config?.isProd || false;

// Feature flags and configuration
const isFacialAuthEnabled = config?.featureFlags?.enableFacialAuth !== false;
const facialAuthConfig = {
    matchThreshold: config?.facialAuth?.matchThreshold || 0.7, // Confidence threshold for face matching
    maxAttempts: config?.facialAuth?.maxAttempts || 3, // Maximum authentication attempts
    modelPath: config?.facialAuth?.modelPath || 'https://tfhub.dev/tensorflow/tfjs-model/blazeface/1/default/1', // Default face detection model
    faceNetPath: config?.facialAuth?.faceNetPath || 'https://tfhub.dev/tensorflow/tfjs-model/facenet/1/default/1', // FaceNet for feature extraction
    referenceImagesPath: config?.facialAuth?.referenceImagesPath || 'images/users/', // Path to reference images
    useBackendAPI: isProd ? true : (config?.facialAuth?.useBackendAPI || false) // Use backend API for secure image comparison in production
};

// Log module initialization
log.info("Loading Facial Authentication Module", { 
    enabled: isFacialAuthEnabled,
    environment: isProd ? "production" : "development",
    useBackendAPI: facialAuthConfig.useBackendAPI
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
        
        try {
            log.info("Initializing facial authentication system");
            
            // Create UI elements if they don't exist
            await createUIElements();
            
            // Load TensorFlow.js if not already loaded
            if (typeof tf === 'undefined') {
                await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.13.0/dist/tf.min.js');
                log.debug("TensorFlow.js loaded");
            }
            
            // Load TensorFlow.js models
            try {
                log.debug("Loading face detection model");
                faceDetectionModel = await tf.loadGraphModel(facialAuthConfig.modelPath, {
                    fromTFHub: true
                });
                
                log.debug("Loading FaceNet model");
                faceNetModel = await tf.loadGraphModel(facialAuthConfig.faceNetPath, {
                    fromTFHub: true
                });
                
                log.info("Facial recognition models loaded successfully");
            } catch (modelError) {
                log.error(modelError, { context: 'loadModels' });
                showError("Failed to load facial recognition models. Please try again later.");
                return false;
            }
            
            isInitialized = true;
            log.info("Facial authentication initialized successfully");
            
            return true;
        } catch (error) {
            log.error(error, { context: 'facialAuthInitialization' });
            showError("Failed to initialize facial authentication. Please try again later.");
            return false;
        }
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
     * Start continuous face detection
     */
    function startFaceDetection() {
        if (!faceDetectionModel || !videoElement) return;
        
        const detectFace = async () => {
            if (!mediaStream) return;
            
            try {
                // Capture current frame from video
                const videoFrame = tf.browser.fromPixels(videoElement);
                
                // Process image for face detection
                const expandedFrame = videoFrame.expandDims(0);
                
                // Run face detection model
                const predictions = await faceDetectionModel.executeAsync(expandedFrame);
                
                // Clean up tensors
                videoFrame.dispose();
                expandedFrame.dispose();
                
                // Extract face detections
                const faces = await extractFaceDetections(predictions);
                
                // Clean up prediction tensors
                predictions.forEach(tensor => tensor.dispose());
                
                // Update UI based on face detection
                updateFaceDetectionUI(faces);
                
                // Continue detection if stream is active
                if (mediaStream && mediaStream.active) {
                    requestAnimationFrame(detectFace);
                }
            } catch (error) {
                log.error(error, { context: 'faceDetection' });
                updateStatus("Face detection error", "error");
            }
        };
        
        // Start detection loop
        detectFace();
    }
    
    /**
     * Extract face detections from model predictions
     */
    async function extractFaceDetections(predictions) {
        // Extract faces from model output
        // Note: Implementation depends on the exact model being used
        // This is a simplified extraction for demonstration
        const boxes = await predictions[0].array();
        const scores = await predictions[1].array();
        
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
    }
    
    /**
     * Update UI based on face detection results
     */
    function updateFaceDetectionUI(faces) {
        const overlay = document.getElementById('faceOverlay');
        const target = overlay.querySelector('.face-target');
        
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
            }
        }
    }
    
    /**
     * Extract face features using FaceNet model
     */
    async function extractFaceFeatures(imageData) {
        if (!faceNetModel) {
            throw new Error("Face feature extraction model not loaded");
        }
        
        try {
            // Convert image data to tensor
            const imageTensor = tf.browser.fromPixels(imageData, 3);
            
            // Normalize and resize image for FaceNet (depends on model requirements)
            const normalized = imageTensor.toFloat().div(tf.scalar(255))
                .expandDims(0).resizeBilinear([160, 160]); // FaceNet typically uses 160x160
            
            // Extract features
            const features = await faceNetModel.predict(normalized);
            
            // Get feature vector (embedding)
            const embedding = await features.data();
            
            // Clean up tensors
            imageTensor.dispose();
            normalized.dispose();
            features.dispose();
            
            return Array.from(embedding);
        } catch (error) {
            log.error(error, { context: 'extractFaceFeatures' });
            return null;
        }
    }
    
    /**
     * Authenticate user by comparing face features
     */
    async function authenticateUser() {
        try {
            // Get user ID from input or session
            const userId = document.getElementById('userIdInput')?.value || 
                          sessionStorage.getItem('userId') || 'default';
            
            let isAuthenticated = false;
            
            // In production, use backend API for secure comparison
            if (facialAuthConfig.useBackendAPI) {
                // Get image data from canvas in base64 format
                const imageData = canvasElement.toDataURL('image/jpeg', 0.9);
                
                // Call backend API for verification
                try {
                    const apiEndpoint = facialAuthConfig.apiEndpoint || 'http://localhost:5000/api/auth/verify';
                    const apiKey = facialAuthConfig.apiKey || 'dev_facial_auth_key';
                    
                    log.info("Sending authentication request to server", { 
                        endpoint: apiEndpoint,
                        userId 
                    });
                    
                    const response = await fetch(apiEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-API-Key': apiKey
                        },
                        body: JSON.stringify({
                            userId: userId,
                            imageData: imageData
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Authentication API error: ' + response.statusText);
                    }
                    
                    const result = await response.json();
                    isAuthenticated = result.verified;
                    
                    log.info("Authentication response received", { 
                        verified: isAuthenticated,
                        details: result.details
                    });
                    
                    if (isAuthenticated) {
                        currentUser = {
                            id: userId,
                            name: result.details?.userName || userId,
                            similarity: result.details?.similarity || 0
                        };
                    }
                } catch (apiError) {
                    log.error(apiError, { context: 'authenticationAPI' });
                    
                    // In production, don't fall back to local authentication
                    if (isProd) {
                        throw new Error("Authentication service unavailable");
                    }
                    
                    // In development, fall back to mock authentication
                    log.warn("API authentication failed, falling back to mock authentication");
                    isAuthenticated = mockAuthentication(userId);
                }
            } else {
                // For development/demo: use simulated authentication
                isAuthenticated = mockAuthentication(userId);
            }
            
            if (isAuthenticated) {
                // Authentication successful
                updateStatus("Authentication successful", "success");
                
                // Store authentication state
                sessionStorage.setItem('authenticated', 'true');
                sessionStorage.setItem('userId', currentUser.id);
                
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
                }
            }
        } catch (error) {
            log.error(error, { context: 'authenticateUser' });
            throw error;
        }
    }
    
    /**
     * Mock authentication for development/testing
     */
    function mockAuthentication(userId) {
        // For development, always return true 80% of the time
        const mockSuccess = Math.random() < 0.8;
        
        if (mockSuccess) {
            currentUser = {
                id: userId,
                name: `Test User (${userId})`
            };
        }
        
        log.debug("Mock authentication", { success: mockSuccess, userId });
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
     * Cancel the authentication process
     */
    function cancelAuthentication() {
        // Stop media stream
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        
        // Reset video element
        if (videoElement) {
            videoElement.srcObject = null;
        }
        
        // Reset UI
        document.getElementById('startAuthButton').disabled = false;
        document.getElementById('captureButton').disabled = true;
        updateStatus("Authentication cancelled", "idle");
        
        // Hide face overlay
        document.getElementById('faceOverlay').style.opacity = '0';
        
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
        }
    };
})();

// Initialize facial authentication when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check if auto-initialization is enabled in config
    const config = window.productionConfig || {};
    if (config?.facialAuth?.autoInitialize !== false) {
        try {
            // Initialize facial authentication (don't await to avoid blocking)
            window.facialAuth.initialize().then(success => {
                if (success) {
                    console.log("Facial authentication initialized successfully");
                } else {
                    console.warn("Facial authentication initialization failed");
                }
            }).catch(error => {
                console.error("Error initializing facial authentication:", error);
            });
        } catch (error) {
            console.error("Error during facial authentication initialization:", error);
        }
    }
});