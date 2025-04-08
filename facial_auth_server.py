#!/usr/bin/env python3
"""
Facial Authentication API Server

This Flask-based server provides facial recognition authentication services for the voting application.
It uses CNN-based facial recognition with Groq API integration to verify user identities against stored reference images.

Usage:
  python facial_auth_server.py
"""

import os
import sys
import json
import base64
import logging
import uuid
import requests
import hashlib
from datetime import datetime
from functools import wraps

try:
    from flask import Flask, request, jsonify, Response
    from flask_cors import CORS
    import cv2
    import numpy as np
    from PIL import Image
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, Model, load_model
    from tensorflow.keras.layers import ZeroPadding2D, Convolution2D, MaxPooling2D
    from tensorflow.keras.layers import Dense, Dropout, Flatten, Activation, BatchNormalization
except ImportError:
    print("Required libraries not found. Please install with:")
    print("pip install flask flask-cors opencv-python pillow numpy tensorflow requests")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger("facial-auth-api")

# App configuration
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for API access

# Configuration
IMAGES_DIR = "images/users"
REFERENCE_IMAGE_PATH = os.path.join(IMAGES_DIR, "Screenshot 2024-06-18 203605.png") # Specific image for voting comparison
METADATA_FILE = f"{IMAGES_DIR}/metadata.json"
TEMP_DIR = "images/temp"
MODEL_DIR = "models"
VERIFICATION_THRESHOLD = 0.6  # Adjust this threshold based on testing

# Groq API configuration
GROQ_API_KEY = "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"
GROQ_API_URL = "https://api.groq.com/v1/chat/completions"  # Endpoint for LLM with vision capabilities
USE_GROQ_API = True  # Set to False to use local model, True to use Groq API

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Global model variables
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
face_model = None
reference_embedding = None # Global variable to store the reference embedding

# Temporary database for development
voter_database = {}  # Maps Aadhar+VoterID to face embeddings

def load_metadata():
    """Load the user metadata."""
    if not os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'w') as f:
            json.dump({}, f)
    
    with open(METADATA_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def get_voter_key(aadhar, voter_id):
    """Create a unique key for a voter based on Aadhar and Voter ID."""
    # Hash the combination for privacy and consistent key generation
    key_string = f"{aadhar}:{voter_id}"
    return hashlib.sha256(key_string.encode()).hexdigest()

def save_metadata(metadata):
    """Save the user metadata."""
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def register_voter(aadhar, voter_id, face_embedding, image_path=None):
    """Register a voter in the temporary database."""
    voter_key = get_voter_key(aadhar, voter_id)
    
    voter_database[voter_key] = {
        "aadhar": aadhar[:4] + "****" + aadhar[-4:],  # Mask for privacy
        "voter_id": voter_id,
        "embedding": face_embedding.tolist() if hasattr(face_embedding, 'tolist') else face_embedding,
        "registration_time": datetime.now().isoformat(),
        "image_path": image_path
    }
    
    logger.info(f"Registered voter with key: {voter_key[:8]}...")
    return voter_key

def init_face_model():
    """Initialize or load the facial recognition model.
    Only needed when not using Groq API."""
    global face_model
    
    if USE_GROQ_API:
        logger.info("Using Groq API for facial recognition, skipping local model initialization")
        return
    
    model_path = os.path.join(MODEL_DIR, "facenet_model.h5")
    
    # Check if we have a saved model
    if os.path.exists(model_path):
        logger.info(f"Loading existing facial recognition model from {model_path}")
        try:
            face_model = load_model(model_path)
            return
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            logger.info("Creating new model instead")
    
    # Create a simplified CNN for facial embedding
    logger.info("Initializing facial recognition model")
    
    model = Sequential()
    
    # First convolutional block
    model.add(ZeroPadding2D((1,1), input_shape=(96, 96, 3)))
    model.add(Convolution2D(64, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(64, (3, 3), activation='relu'))
    model.add(MaxPooling2D((2,2), strides=(2,2)))
    
    # Second convolutional block
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(128, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(128, (3, 3), activation='relu'))
    model.add(MaxPooling2D((2,2), strides=(2,2)))
    
    # Third convolutional block
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(256, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(256, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(256, (3, 3), activation='relu'))
    model.add(MaxPooling2D((2,2), strides=(2,2)))
    
    # Fourth convolutional block
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(512, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(512, (3, 3), activation='relu'))
    model.add(ZeroPadding2D((1,1)))
    model.add(Convolution2D(512, (3, 3), activation='relu'))
    model.add(MaxPooling2D((2,2), strides=(2,2)))
    
    # Flatten and dense layers
    model.add(Flatten())
    model.add(Dense(512, activation='relu'))
    model.add(Dropout(0.5))
    model.add(Dense(256, activation='relu'))
    model.add(Dropout(0.5))
    model.add(Dense(128, activation='relu'))  # Embedding size
    
    # Save the model
    model.save(model_path)
    face_model = model

def preprocess_face(face_img):
    """Preprocess a face image for the model."""
    # Resize to expected dimensions
    face_img = cv2.resize(face_img, (96, 96))
    
    # Convert to RGB if grayscale
    if len(face_img.shape) == 2:
        face_img = cv2.cvtColor(face_img, cv2.COLOR_GRAY2RGB)
    elif face_img.shape[2] == 1:
        face_img = cv2.cvtColor(face_img, cv2.COLOR_GRAY2RGB)
    
    # Normalize pixel values
    face_img = face_img.astype(np.float32) / 255.0
    
    return face_img

def get_face_embedding(face_img):
    """Get the embedding vector for a face using local model or Groq API."""
    if USE_GROQ_API:
        return get_groq_embedding(face_img)
    else:
        if face_model is None:
            init_face_model()
        
        # Preprocess the face
        processed_face = preprocess_face(face_img)
        
        # Expand dimensions to create a batch of size 1
        batch = np.expand_dims(processed_face, axis=0)
        
        # Get the embedding
        embedding = face_model.predict(batch, verbose=0)[0]
        
        return embedding

def get_groq_embedding(face_img):
    """Get face embedding using Groq API."""
    try:
        # Convert image to base64
        _, buffer = cv2.imencode('.jpg', face_img)
        img_str = base64.b64encode(buffer).decode('utf-8')
        
        # Prepare request to Groq API
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        # Format request for chat completions API with vision
        data = {
            "model": "llama3-70b-8192",
            "messages": [
                {
                    "role": "system",
                    "content": "You are a computer vision system that generates face embeddings. Extract the key facial features as a vector of 128 floating point numbers."
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Generate a face embedding vector for this image."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{img_str}"
                            }
                        }
                    ]
                }
            ],
            "temperature": 0.0,
            "response_format": {"type": "json_object"}
        }
        
        # Make request to Groq API
        response = requests.post(GROQ_API_URL, headers=headers, json=data)
        
        if response.status_code != 200:
            logger.error(f"Groq API error: {response.status_code}, {response.text}")
            raise Exception(f"Groq API returned status code {response.status_code}")
        
        # Extract the embedding from the response
        result = response.json()
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")
        
        try:
            # Parse the content which should be a JSON string containing the embedding
            embedding_data = json.loads(content)
            embedding = embedding_data.get("embedding", [])
            
            # If embedding is empty or not a list, synthesize one using the local model
            if not embedding or not isinstance(embedding, list) or len(embedding) < 128:
                raise ValueError("Invalid embedding format returned by Groq API")
                
            # Ensure we have exactly 128 dimensions
            embedding = embedding[:128]
            while len(embedding) < 128:
                embedding.append(0.0)
                
            return np.array(embedding)
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Error parsing Groq API response: {str(e)} - {content}")
            raise Exception(f"Failed to extract embedding from Groq API response: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error getting Groq embedding: {str(e)}")
        # Fallback to local model if Groq API fails
        if face_model is None:
            init_face_model()
            
        if face_model is None:
            # If we still don't have a model, generate a random embedding
            # This is just for development purposes when neither API nor model works
            logger.warning("Using random embedding as fallback (development only)")
            random_embedding = np.random.randn(128)
            return random_embedding / np.linalg.norm(random_embedding)
        
        processed_face = preprocess_face(face_img)
        batch = np.expand_dims(processed_face, axis=0)
        embedding = face_model.predict(batch, verbose=0)[0]
        
        return embedding

def load_reference_embedding():
    """Load the embedding for the single reference image used in voting."""
    global reference_embedding
    if not os.path.exists(REFERENCE_IMAGE_PATH):
        logger.error(f"CRITICAL: Reference image not found at {REFERENCE_IMAGE_PATH}")
        reference_embedding = None
        return

    logger.info(f"Loading reference image from {REFERENCE_IMAGE_PATH}")
    ref_img = cv2.imread(REFERENCE_IMAGE_PATH)
    if ref_img is None:
        logger.error(f"CRITICAL: Failed to load reference image: {REFERENCE_IMAGE_PATH}")
        reference_embedding = None
        return

    # Encode the image to bytes to pass to extract_face_from_image
    is_success, buffer = cv2.imencode(".png", ref_img)
    if not is_success:
        logger.error("Failed to encode reference image to PNG format.")
        reference_embedding = None
        return
    image_data_bytes = buffer.tobytes()

    # Extract face from reference image (best practice, though might be pre-cropped)
    ref_face, error = extract_face_from_image(base64.b64encode(image_data_bytes).decode('utf-8')) # Needs base64 string
    if error:
        # Fallback: try using the whole image if face extraction fails on reference
        logger.warning(f"Could not extract face from reference image ({error}), attempting to use whole image.")
        ref_face = ref_img # Use the whole image if face extraction fails

    if ref_face is not None:
        try:
            reference_embedding = get_face_embedding(ref_face)
            if reference_embedding is not None:
                 logger.info("Reference embedding loaded successfully.")
            else:
                 logger.error("Failed to generate embedding for the reference face.")
        except Exception as e:
            logger.error(f"Error generating embedding for reference image: {e}")
            reference_embedding = None
    else:
         logger.error("Could not process reference image face.")
         reference_embedding = None

def load_sample_data():
    """Load sample data for development and testing."""
    logger.info("Loading sample data for development mode")
    
    # Sample Aadhar and Voter IDs
    sample_voters = [
        {"aadhar": "123456789012", "voter_id": "ABC1234567", "image_path": "images/users/WIN_20250408_19_12_01_Pro.jpg"},
        {"aadhar": "987654321098", "voter_id": "XYZ7654321", "image_path": "images/users/WIN_20250408_19_12_02_Pro.jpg"},
    ]
    
    # Register each sample voter
    sample_count = 0
    for voter in sample_voters:
        # Check if image exists
        if not os.path.exists(voter["image_path"]):
            logger.warning(f"Sample image not found: {voter['image_path']}")
            continue
            
        try:
            # Read and process image
            img = cv2.imread(voter["image_path"])
            if img is None:
                logger.warning(f"Could not read image: {voter['image_path']}")
                continue
                
            # Get face from image
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            faces = face_cascade.detectMultiScale(gray, 1.3, 5)
            
            if len(faces) == 0:
                logger.warning(f"No face detected in sample image: {voter['image_path']}")
                continue
                
            # Extract largest face
            faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
            x, y, w, h = faces[0]
            face_img = img[y:y+h, x:x+w]
            
            # Get embedding and register voter
            embedding = get_face_embedding(face_img)
            register_voter(voter["aadhar"], voter["voter_id"], embedding, voter["image_path"])
            sample_count += 1
            
        except Exception as e:
            logger.error(f"Error processing sample voter: {str(e)}")
    
    logger.info(f"Loaded {sample_count} sample voters for development")


def compute_similarity(embedding1, embedding2):
    """Compute the cosine similarity between two embeddings."""
    embedding1_array = np.array(embedding1)
    embedding2_array = np.array(embedding2)
    
    dot_product = np.dot(embedding1_array, embedding2_array)
    norm1 = np.linalg.norm(embedding1_array)
    norm2 = np.linalg.norm(embedding2_array)
    similarity = dot_product / (norm1 * norm2)
    
    return similarity

def extract_face_from_image(image_data):
    """Extract a face from an image."""
    # Decode base64 image
    try:
        # Handle data URL format
        if image_data.startswith('data:image'):
            image_data = image_data.split(',', 1)[1]
        
        image_bytes = base64.b64decode(image_data)
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return None, "Failed to decode image data"
    except Exception as e:
        return None, f"Error decoding image: {str(e)}"
    
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        return None, "No face detected in the image"
    if len(faces) > 1:
        logger.warning(f"Multiple faces detected. Using the largest face.")
    
    # Sort faces by area (width * height) in descending order
    faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
    
    # Extract the largest face
    x, y, w, h = faces[0]
    face = img[y:y+h, x:x+w]
    
    return face, None

def verify_face(user_id, face_img):
    """Verify a face against stored references for a user."""
    metadata = load_metadata()
    
    # Check if user exists
    if user_id not in metadata:
        return False, "User not found"
    
    user_data = metadata[user_id]
    if not user_data.get("images"):
        return False, "No reference images for user"
    
    # Get embedding for the provided face
    face_embedding = get_face_embedding(face_img)
    
    # Compare with all reference images
    max_similarity = 0
    best_match = None
    
    for image_info in user_data["images"]:
        image_path = image_info["path"]
        if not os.path.exists(image_path):
            logger.warning(f"Reference image not found: {image_path}")
            continue
        
        # Load reference image
        ref_img = cv2.imread(image_path)
        if ref_img is None:
            logger.warning(f"Failed to load reference image: {image_path}")
            continue
        
        # Get embedding for reference face
        ref_embedding = get_face_embedding(ref_img)
        
        # Compute similarity
        similarity = compute_similarity(face_embedding, ref_embedding)
        logger.info(f"Similarity with {os.path.basename(image_path)}: {similarity:.4f}")
        
        if similarity > max_similarity:
            max_similarity = similarity
            best_match = os.path.basename(image_path)
    
    # Determine verification result
    if max_similarity >= VERIFICATION_THRESHOLD:
        logger.info(f"Verification successful for user {user_id} with similarity {max_similarity:.4f}")
        return True, {
            "match": True,
            "similarity": float(max_similarity),
            "best_match": best_match
        }
    else:
        logger.info(f"Verification failed for user {user_id} with similarity {max_similarity:.4f}")
        return False, {
            "match": False,
            "similarity": float(max_similarity),
            "threshold": VERIFICATION_THRESHOLD
        }

def verify_voter_by_face(aadhar, voter_id, face_img):
    """Verify a voter by face against stored references by Aadhar and Voter ID."""
    voter_key = get_voter_key(aadhar, voter_id)
    
    # Check if voter exists in database
    if voter_key not in voter_database:
        logger.warning(f"Voter not found: {voter_key[:8]}...")
        return False, "Voter not found"
    
    # Get voter record
    voter_record = voter_database[voter_key]
    
    # Get embedding for the provided face
    face_embedding = get_face_embedding(face_img)
    
    # Compare with stored embedding
    stored_embedding = np.array(voter_record["embedding"])
    similarity = compute_similarity(face_embedding, stored_embedding)
    
    logger.info(f"Voter verification similarity: {similarity:.4f} (threshold: {VERIFICATION_THRESHOLD})")
    
    # Determine verification result
    if similarity >= VERIFICATION_THRESHOLD:
        logger.info(f"Verification successful for voter with key: {voter_key[:8]}...")
        return True, {
            "match": True,
            "similarity": float(similarity),
            "voter_id": voter_record["voter_id"]
        }
    else:
        logger.info(f"Verification failed for voter with key: {voter_key[:8]}...")
        return False, {
            "match": False,
            "similarity": float(similarity),
            "threshold": VERIFICATION_THRESHOLD
        }

def api_auth_required(f):
    """Simple API key authentication decorator."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get API key from request headers
        api_key = request.headers.get('X-API-Key') or request.headers.get('Authorization', '').replace('Bearer ', '')
        if not api_key:
            return jsonify({"error": "API key required"}), 401
        
        # Check if this is our Groq API key or development keys
        valid_keys = [
            GROQ_API_KEY,  # The Groq API key
            "dev_facial_auth_key",  # Development key
            "voting_system_dev_key"  # Alternative development key
        ]
        
        if api_key not in valid_keys:
            return jsonify({"error": "Invalid API key"}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "facial-auth-api",
        "groq_api": "configured" if GROQ_API_KEY else "not configured"
    })

@app.route('/api/auth/verify', methods=['POST'])
@api_auth_required
def verify_user():
    """Verify a user's face."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        user_id = data.get('userId')
        image_data = data.get('imageData')
        
        if not user_id:
            return jsonify({"error": "User ID is required"}), 400
        if not image_data:
            return jsonify({"error": "Image data is required"}), 400
        
        # Extract face from image
        face_img, error = extract_face_from_image(image_data)
        if error:
            return jsonify({"error": error}), 400
        
        # Save the processed face temporarily (for debugging)
        temp_path = os.path.join(TEMP_DIR, f"verify_{user_id}_{uuid.uuid4()}.jpg")
        cv2.imwrite(temp_path, face_img)
        
        # Verify the face
        verified, details = verify_face(user_id, face_img)
        
        response = {
            "verified": verified,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error processing verification request: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/auth/verify-voter', methods=['POST'])
@api_auth_required
def verify_voter():
    """Verify a voter's identity with Aadhar, Voter ID and face."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        aadhar = data.get('aadhar')
        voter_id = data.get('voterId')
        image_data = data.get('imageData')
        
        if not aadhar:
            return jsonify({"error": "Aadhar number is required"}), 400
        if not voter_id:
            return jsonify({"error": "Voter ID is required"}), 400
        if not image_data:
            return jsonify({"error": "Image data is required"}), 400
        
        # Extract face from image
        face_img, error = extract_face_from_image(image_data)
        if error:
            return jsonify({"error": error}), 400
        
        # Generate a unique ID for this verification
        verification_id = str(uuid.uuid4())
        
        # Save the processed face temporarily (for debugging)
        temp_path = os.path.join(TEMP_DIR, f"voter_verify_{verification_id}.jpg")
        cv2.imwrite(temp_path, face_img)
        
        # Verify the voter
        verified, details = verify_voter_by_face(aadhar, voter_id, face_img)
        
        # If first time (not found in DB), register this voter
        voter_key = get_voter_key(aadhar, voter_id)
        if voter_key not in voter_database and not verified:
            logger.info(f"New voter registration: {voter_key[:8]}...")
            # Register the voter for future verifications
            register_voter(aadhar, voter_id, get_face_embedding(face_img), temp_path)
            verified = True
            details = {
                "match": True,
                "similarity": 1.0,
                "voter_id": voter_id,
                "newly_registered": True
            }
        
        response = {
            "verified": verified,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "verification_id": verification_id
        }
        
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error processing voter verification request: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/users', methods=['GET'])
@api_auth_required
def list_users():
    """List all registered users."""
    try:
        metadata = load_metadata()
        users = []
        
        for user_id, data in metadata.items():
            user_info = {
                "userId": user_id,
                "created": data.get("created"),
                "imageCount": len(data.get("images", []))
            }
            users.append(user_info)
        
        return jsonify({
            "users": users,
            "total": len(users)
        })
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/voters', methods=['GET'])
@api_auth_required
def list_voters():
    """List all registered voters."""
    try:
        voters = []
        
        for voter_key, data in voter_database.items():
            # Exclude the actual embedding for privacy/bandwidth
            voter_info = {
                "id": voter_key[:8] + "...",  # First 8 chars of hash
                "aadhar": data.get("aadhar"),  # Already masked
                "voter_id": data.get("voter_id"),
                "registered": data.get("registration_time")
            }
            voters.append(voter_info)
        
        return jsonify({
            "voters": voters,
            "total": len(voters)
        })
    except Exception as e:
        logger.error(f"Error listing voters: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/vote/compare', methods=['POST'])
@api_auth_required
def compare_face_for_vote():
    """Compare a live face image against the single reference image for voting."""
    global reference_embedding
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        image_data = data.get('imageData')
        if not image_data:
            return jsonify({"error": "Image data is required"}), 400

        if reference_embedding is None:
            logger.error("Reference embedding is not loaded. Cannot perform comparison.")
            # Attempt to reload it just in case
            load_reference_embedding()
            if reference_embedding is None:
                return jsonify({"error": "Server configuration error: Reference embedding not available."}), 500

        # Extract face from the live image
        live_face_img, error = extract_face_from_image(image_data)
        if error:
            logger.warning(f"Face extraction failed for comparison: {error}")
            # Return a specific status if no face is detected in the live feed
            return jsonify({
                "match": False,
                "similarity": 0.0,
                "error": error,
                "details": {"message": "Could not detect face in the provided image."}
            }), 200 # Return 200 OK but indicate no match due to detection failure

        # Get embedding for the live face
        try:
            live_embedding = get_face_embedding(live_face_img)
            if live_embedding is None:
                 raise ValueError("Embedding generation returned None")
        except Exception as e:
             logger.error(f"Error generating embedding for live image: {e}")
             return jsonify({"error": f"Server error during embedding generation: {str(e)}"}), 500

        # Compute similarity
        similarity = compute_similarity(live_embedding, reference_embedding)
        logger.info(f"Comparison similarity: {similarity:.4f}")

        # Determine match based on threshold
        is_match = similarity >= VERIFICATION_THRESHOLD

        response = {
            "match": is_match,
            "similarity": float(similarity),
            "threshold": VERIFICATION_THRESHOLD,
            "timestamp": datetime.now().isoformat()
        }

        return jsonify(response)

    except Exception as e:
        logger.error(f"Error processing comparison request: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/voters/add', methods=['POST'])
@api_auth_required
def add_voter():
    """Add a new voter to the system."""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        aadhar = data.get('aadhar')
        voter_id = data.get('voterId')
        image_data = data.get('imageData')
        
        if not aadhar:
            return jsonify({"error": "Aadhar number is required"}), 400
        if not voter_id:
            return jsonify({"error": "Voter ID is required"}), 400
        if not image_data:
            return jsonify({"error": "Image data is required"}), 400
        
        # Extract face from image
        face_img, error = extract_face_from_image(image_data)
        if error:
            return jsonify({"error": error}), 400
        
        # Save the processed face
        voter_key = get_voter_key(aadhar, voter_id)
        filename = f"{voter_key[:8]}_{uuid.uuid4()}.jpg"
        image_path = os.path.join(IMAGES_DIR, filename)
        cv2.imwrite(image_path, face_img)
        
        # Get embedding and register voter
        embedding = get_face_embedding(face_img)
        register_voter(aadhar, voter_id, embedding, image_path)
        
        return jsonify({
            "success": True,
            "voter_key": voter_key[:8] + "...",
            "message": "Voter added successfully",
            "timestamp": datetime.now().isoformat()
        })
    except Exception as e:
        logger.error(f"Error adding voter: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500


@app.route('/api/users/<user_id>', methods=['GET'])
@api_auth_required
def get_user(user_id):
    """Get information about a specific user."""
    try:
        metadata = load_metadata()
        
        if user_id not in metadata:
            return jsonify({"error": "User not found"}), 404
        
        user_data = metadata[user_id]
        images = []
        
        for img_info in user_data.get("images", []):
            # Don't include the full path in the response
            file_name = os.path.basename(img_info.get("path", ""))
            images.append({
                "filename": file_name,
                "added": img_info.get("added"),
                "source": img_info.get("source")
            })
        
        return jsonify({
            "userId": user_id,
            "created": user_data.get("created"),
            "images": images
        })
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

@app.route('/api/voters/random', methods=['GET'])
@api_auth_required
def get_random_voter():
    """Get a random voter for testing."""
    try:
        if not voter_database:
            # If database is empty, add sample data
            load_sample_data()
            
        if not voter_database:
            return jsonify({"error": "No voters available"}), 404
            
        # Get a random voter
        import random
        voter_key = random.choice(list(voter_database.keys()))
        voter_data = voter_database[voter_key]
        
        return jsonify({
            "aadhar": voter_data["aadhar"],
            "voter_id": voter_data["voter_id"],
            "registered": voter_data["registration_time"]
        })
    except Exception as e:
        logger.error(f"Error getting random voter: {str(e)}")
        return jsonify({"error": f"Server error: {str(e)}"}), 500

if __name__ == "__main__":
    # Initialize face recognition model (if not using Groq API)
    if not USE_GROQ_API:
        init_face_model()
        
    # Load the reference embedding at startup
    load_reference_embedding()
    
    # Load sample data for development
    load_sample_data()
    
    # Import and register authentication endpoints
    try:
        import auth_handlers
        app = auth_handlers.register_endpoints(
            app, 
            api_auth_required, 
            voter_database, 
            get_voter_key,
            extract_face_from_image, 
            verify_voter_by_face, 
            get_face_embedding, 
            register_voter,
            TEMP_DIR
        )
        logger.info("Successfully registered authentication endpoints")
    except Exception as e:
        logger.error(f"Error registering authentication endpoints: {str(e)}")
    
    # Start the server
    port = int(os.environ.get("PORT", 5001)) # Changed port to 5001 to avoid potential conflicts
    logger.info(f"Starting Facial Auth Server on port {port}")
    app.run(host="0.0.0.0", port=port, debug=True)
