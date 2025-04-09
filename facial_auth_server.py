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
import sqlite3
from dotenv import load_dotenv
import face_recognition
from werkzeug.security import generate_password_hash, check_password_hash
import time
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

load_dotenv()

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
except ImportError as e:
    print(f"Required libraries not found: {str(e)}")
    print("Please install with: pip install -r requirements.txt")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('facial_auth.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize rate limiter
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Security headers
@app.after_request
def add_security_headers(response):
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

# Error handlers
@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify(error="Rate limit exceeded. Please try again later."), 429

@app.errorhandler(500)
def internal_error(e):
    logger.error(f"Internal server error: {str(e)}")
    return jsonify(error="An internal error occurred. Please try again later."), 500

@app.errorhandler(404)
def not_found_error(e):
    return jsonify(error="Resource not found."), 404

# Health check endpoint
@app.route('/health', methods=['GET'])
def health_check():
    try:
        # Check database connection
        conn = get_db_connection()
        conn.close()
        return jsonify({"status": "healthy", "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({"status": "unhealthy", "error": str(e)}), 500

# App configuration
app.config['IMAGES_DIR'] = "images/users"
app.config['REFERENCE_IMAGE_PATH'] = os.path.join(app.config['IMAGES_DIR'], "Screenshot 2024-06-18 203605.png") # Specific image for voting comparison
app.config['METADATA_FILE'] = f"{app.config['IMAGES_DIR']}/metadata.json"
app.config['TEMP_DIR'] = "images/temp"
app.config['MODEL_DIR'] = "models"
app.config['VERIFICATION_THRESHOLD'] = 0.6  # Adjust this threshold based on testing

# Groq API configuration
app.config['GROQ_API_KEY'] = os.getenv("GROQ_API_KEY", "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")
app.config['GROQ_API_URL'] = "https://api.groq.com/v1/chat/completions"
app.config['USE_GROQ_API'] = False # Defaulting to False as we are implementing Face++

# Face++ API configuration
app.config['FACE_API_KEY'] = os.getenv("FACE_API_KEY")
app.config['FACE_API_SECRET'] = os.getenv("FACE_API_SECRET")
app.config['FACE_API_URL'] = os.getenv("FACE_API_URL", "https://api-us.faceplusplus.com/facepp/v3/compare")
app.config['FACEPLUSPLUS_CONFIDENCE_THRESHOLD'] = float(os.getenv("VERIFICATION_THRESHOLD", 75.0)) # Face++ uses 0-100 scale often

# Ensure directories exist
os.makedirs(app.config['IMAGES_DIR'], exist_ok=True)
os.makedirs(app.config['TEMP_DIR'], exist_ok=True)
os.makedirs(app.config['MODEL_DIR'], exist_ok=True)

# Global model variables
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
face_model = None
reference_embedding = None # Global variable to store the reference embedding

# Temporary database for development
voter_database = {}  # Maps Aadhar+VoterID to face embeddings

# Database initialization
def init_db():
    conn = sqlite3.connect('voter_verification.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS voter_verification
        (aadhar_number TEXT PRIMARY KEY,
         voter_id TEXT,
         mobile_number TEXT,
         face_encoding BLOB,
         verification_time TIMESTAMP)
    ''')
    conn.commit()
    conn.close()

# Initialize database on startup
init_db()

class FaceVerification:
    def __init__(self):
        self.known_face_encodings = {}
        self.load_known_faces()

    def load_known_faces(self):
        conn = sqlite3.connect('voter_verification.db')
        c = conn.cursor()
        c.execute('SELECT aadhar_number, face_encoding FROM voter_verification')
        for row in c.fetchall():
            aadhar_number, face_encoding_blob = row
            face_encoding = np.frombuffer(face_encoding_blob, dtype=np.float64)
            self.known_face_encodings[aadhar_number] = face_encoding
        conn.close()

    def verify_face(self, image_data, aadhar_number):
        try:
            # Decode base64 image
            image_bytes = base64.b64decode(image_data.split(',')[1])
            nparr = np.frombuffer(image_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            # Convert to RGB (face_recognition uses RGB)
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Find faces in the image
            face_locations = face_recognition.face_locations(rgb_image)
            if not face_locations:
                return {'isMatch': False, 'error': 'No face detected'}

            # Get face encoding
            face_encoding = face_recognition.face_encodings(rgb_image, face_locations)[0]

            # Check if we have a known face for this Aadhar number
            if aadhar_number not in self.known_face_encodings:
                return {'isMatch': False, 'error': 'No registered face found'}

            # Compare faces
            known_encoding = self.known_face_encodings[aadhar_number]
            matches = face_recognition.compare_faces([known_encoding], face_encoding, tolerance=0.6)
            face_distance = face_recognition.face_distance([known_encoding], face_encoding)[0]
            confidence = 1 - face_distance

            return {
                'isMatch': matches[0],
                'confidence': float(confidence),
                'faceData': base64.b64encode(face_encoding.tobytes()).decode('utf-8')
            }
        except Exception as e:
            return {'isMatch': False, 'error': str(e)}

face_verifier = FaceVerification()

# --- Database Connection ---
DATABASE_URL = os.getenv('DATABASE_URL', 'voter_verification.db')

def get_db_connection():
    """Establishes a connection to the SQLite database."""
    conn = sqlite3.connect(DATABASE_URL)
    conn.row_factory = sqlite3.Row # Return rows as dictionary-like objects
    return conn

def load_metadata():
    """Load the user metadata."""
    if not os.path.exists(app.config['METADATA_FILE']):
        with open(app.config['METADATA_FILE'], 'w') as f:
            json.dump({}, f)
    
    with open(app.config['METADATA_FILE'], 'r') as f:
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
    with open(app.config['METADATA_FILE'], 'w') as f:
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
    
    if app.config['USE_GROQ_API']:
        logger.info("Using Groq API for facial recognition, skipping local model initialization")
        return
    
    model_path = os.path.join(app.config['MODEL_DIR'], "facenet_model.h5")
    
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
    if app.config['USE_GROQ_API']:
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
            "Authorization": f"Bearer {app.config['GROQ_API_KEY']}",
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
        response = requests.post(app.config['GROQ_API_URL'], headers=headers, json=data)
        
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
    if not os.path.exists(app.config['REFERENCE_IMAGE_PATH']):
        logger.error(f"CRITICAL: Reference image not found at {app.config['REFERENCE_IMAGE_PATH']}")
        reference_embedding = None
        return

    logger.info(f"Loading reference image from {app.config['REFERENCE_IMAGE_PATH']}")
    ref_img = cv2.imread(app.config['REFERENCE_IMAGE_PATH'])
    if ref_img is None:
        logger.error(f"CRITICAL: Failed to load reference image: {app.config['REFERENCE_IMAGE_PATH']}")
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
    if max_similarity >= app.config['VERIFICATION_THRESHOLD']:
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
            "threshold": app.config['VERIFICATION_THRESHOLD']
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

@app.route('/api/auth/verify-credentials', methods=['POST'])
def verify_credentials():
    try:
        data = request.json
        aadhar_number = data.get('aadharNumber')
        voter_id = data.get('voterId')
        mobile_number = data.get('mobileNumber')

        # In production, implement actual credential verification logic
        # This is a placeholder that always returns True
        return jsonify({'isValid': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/verify-face', methods=['POST'])
def verify_face():
    try:
        data = request.json
        image_data = data.get('imageData')
        aadhar_number = data.get('aadharNumber')

        if not image_data or not aadhar_number:
            return jsonify({'error': 'Missing required data'}), 400

        result = face_verifier.verify_face(image_data, aadhar_number)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/register-face', methods=['POST'])
def register_face():
    try:
        data = request.json
        image_data = data.get('imageData')
        aadhar_number = data.get('aadharNumber')
        voter_id = data.get('voterId')
        mobile_number = data.get('mobileNumber')

        if not all([image_data, aadhar_number, voter_id, mobile_number]):
            return jsonify({'error': 'Missing required data'}), 400

        # Decode and process image
        image_bytes = base64.b64decode(image_data.split(',')[1])
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Get face encoding
        face_locations = face_recognition.face_locations(rgb_image)
        if not face_locations:
            return jsonify({'error': 'No face detected'}), 400

        face_encoding = face_recognition.face_encodings(rgb_image, face_locations)[0]

        # Store in database
        conn = sqlite3.connect('voter_verification.db')
        c = conn.cursor()
        c.execute('''
            INSERT OR REPLACE INTO voter_verification
            (aadhar_number, voter_id, mobile_number, face_encoding, verification_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (aadhar_number, voter_id, mobile_number, face_encoding.tobytes(), datetime.now()))
        conn.commit()
        conn.close()

        # Update in-memory cache
        face_verifier.known_face_encodings[aadhar_number] = face_encoding

        return jsonify({'success': True})
    except Exception as e:
        logger.error(f"Error registering face: {str(e)}")
        return jsonify({'error': str(e)}), 500

# --- New Face++ Match Endpoint ---
@app.route('/api/face-match', methods=['POST'])
@limiter.limit("10 per minute") # Add rate limiting
def face_match_endpoint():
    """
    Handles face verification requests using Face++ API.
    Expects: { capturedImage: base64_string, userId: string, voterId: string }
    Returns: { success: boolean, message: string, data: { isMatch: boolean, confidence: float, ... } }
    """
    start_time = time.time()
    try:
        # --- Input Validation ---
        data = request.json
        if not data:
            return jsonify({"success": False, "message": "No data provided"}), 400

        captured_image_b64 = data.get('capturedImage')
        user_id = data.get('userId') # Using userId passed from frontend
        voter_id = data.get('voterId') # Also passed

        if not captured_image_b64:
            return jsonify({"success": False, "message": "capturedImage is required"}), 400
        if not user_id:
            return jsonify({"success": False, "message": "userId is required"}), 400

        # --- Retrieve Reference Image Path ---
        # In a real app, fetch from DB based on userId/voterId
        # For now, use the sample data logic or a default
        reference_image_path = None
        # Check sample data first (development)
        for key, voter_data in voter_database.items():
             # Use voter_id for matching as it's more likely unique from frontend perspective
            if voter_data.get("voter_id") == voter_id or voter_data.get("voter_id") == user_id:
                reference_image_path = voter_data.get("image_path")
                logger.info(f"Found reference image path for {user_id}/{voter_id} in sample data: {reference_image_path}")
                break

        # Fallback if not in sample data (or if sample data loading failed)
        if not reference_image_path:
             # Use the default reference image if no specific one found
             reference_image_path = app.config.get('REFERENCE_IMAGE_PATH', 'images/users/WIN_20250408_19_12_01_Pro.jpg')
             logger.warning(f"User {user_id}/{voter_id} not found in sample data. Using default reference: {reference_image_path}")

        if not reference_image_path or not os.path.exists(reference_image_path):
             logger.error(f"Reference image path not found or invalid: {reference_image_path}")
             return jsonify({"success": False, "message": f"Reference image not found for user {user_id}"}), 404

        # --- Prepare Face++ API Call ---
        api_key = app.config.get('FACE_API_KEY')
        api_secret = app.config.get('FACE_API_SECRET')
        api_url = app.config.get('FACE_API_URL')

        if not api_key or not api_secret:
            logger.error("Face++ API Key or Secret not configured in environment.")
            return jsonify({"success": False, "message": "Server configuration error: Face++ credentials missing."}), 500

        payload = {
            'api_key': api_key,
            'api_secret': api_secret,
            'image_base64_1': captured_image_b64.split(',', 1)[1] if captured_image_b64.startswith('data:') else captured_image_b64,
            # 'image_url2': 'URL_OF_REFERENCE_IMAGE', # Option 1: If reference is URL
            # 'image_base64_2': 'BASE64_OF_REFERENCE_IMAGE', # Option 2: If reference is base64
            # 'face_token1': 'TOKEN_FROM_DETECT', # Option 3: Using face tokens
            # 'face_token2': 'TOKEN_FROM_DETECT'
        }

        files = {
             'image_file2': (os.path.basename(reference_image_path), open(reference_image_path, 'rb'), 'image/jpeg')
             # Sending reference image as file upload
        }

        logger.info(f"Calling Face++ Compare API for user {user_id} against {os.path.basename(reference_image_path)}")

        # --- Make API Call ---
        try:
            response = requests.post(api_url, data=payload, files=files, timeout=15) # Added timeout
            response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
            faceplusplus_result = response.json()
        except requests.exceptions.RequestException as e:
             logger.error(f"Face++ API request failed: {str(e)}")
             return jsonify({"success": False, "message": f"Failed to connect to Face++ API: {str(e)}"}), 503 # Service Unavailable
        finally:
             # Ensure file handle is closed
             if 'image_file2' in files:
                 files['image_file2'][1].close()


        # --- Process Face++ Response ---
        logger.debug(f"Face++ API Raw Response: {faceplusplus_result}")

        if "error_message" in faceplusplus_result:
            error_msg = faceplusplus_result["error_message"]
            logger.error(f"Face++ API Error: {error_msg}")
            # Handle specific errors if needed, e.g., face not detected
            if "NO_FACE_FOUND" in error_msg:
                 return jsonify({
                     "success": True, # API call succeeded, but no face found
                     "message": "No face detected in the captured image.",
                     "data": {"isMatch": False, "confidence": 0.0, "error": "NO_FACE_FOUND"}
                 }), 200
            else:
                 return jsonify({"success": False, "message": f"Face++ API Error: {error_msg}"}), 500

        confidence = faceplusplus_result.get('confidence', 0.0)
        # Face++ thresholds are complex, often involving multiple values (e.g., 1e-3, 1e-4, 1e-5)
        # We'll use the configured single threshold for simplicity here.
        threshold = app.config['FACEPLUSPLUS_CONFIDENCE_THRESHOLD']
        is_match = confidence >= threshold

        # --- Format Response for Frontend ---
        response_data = {
            "isMatch": is_match,
            "confidence": float(confidence),
            "threshold": float(threshold),
            "livenessConfirmed": None, # Face++ might provide this in other APIs or specific modes
            "spoofingDetected": None,
            "processing": { # Add some basic processing info if available
                "faceDetected": True, # Assumed if confidence > 0
                "apiResponse": faceplusplus_result # Include raw response for debugging if needed (optional)
            }
        }

        end_time = time.time()
        logger.info(f"Face++ verification for {user_id} completed in {end_time - start_time:.2f}s. Match: {is_match}, Confidence: {confidence}")

        return jsonify({
            "success": True,
            "message": "Verification check complete",
            "data": response_data
        })

    except Exception as e:
        logger.exception(f"Unhandled error in /api/face-match: {str(e)}") # Log full traceback
        return jsonify({"success": False, "message": f"Internal server error: {str(e)}"}), 500


# --- Main Execution ---
if __name__ == "__main__":
    # Initialize face recognition model (if not using Groq API or Face++)
    if not app.config['USE_GROQ_API'] and not app.config['FACE_API_KEY']:
        logger.info("Initializing local face model as neither Groq nor Face++ is configured.")
        init_face_model()
    elif app.config['FACE_API_KEY']:
        logger.info("Face++ API is configured. Local model/Groq will not be used for primary verification.")
    elif app.config['USE_GROQ_API']:
         logger.info("Groq API is configured. Local model will not be used.")

    # Load the reference embedding at startup (only needed for local compare)
    # load_reference_embedding() # Commented out as Face++ handles comparison
    
    # Load sample data for development (still useful for user info lookup)
    load_sample_data()

    # Import and register authentication endpoints (ensure they don't conflict)
    try:
        # Check if auth_handlers exists and has the function
        if 'auth_handlers' in sys.modules and hasattr(sys.modules['auth_handlers'], 'register_endpoints'):
            import auth_handlers
            app = auth_handlers.register_endpoints(
                app,
                api_auth_required,
                voter_database,
                get_voter_key,
                extract_face_from_image,
                verify_voter_by_face, # This uses local/Groq, might need update for Face++
                get_face_embedding,   # This uses local/Groq
                register_voter,       # This uses local/Groq
                TEMP_DIR
            )
            logger.info("Successfully registered additional authentication endpoints from auth_handlers")
        else:
             logger.warning("auth_handlers module or register_endpoints function not found. Skipping.")
    except ImportError:
        logger.warning("auth_handlers.py not found. Skipping additional endpoint registration.")
    # Removed duplicated block here
    except Exception as e:
        logger.error(f"Error registering authentication endpoints from auth_handlers: {str(e)}") # Clarified error source
    
    # Start the server
    port = int(os.getenv("PORT", 5000)) # Use port 5000 as expected by frontend config
    debug_mode = os.getenv("FLASK_ENV", "development") == "development"
    logger.info(f"Starting Facial Auth Server on port {port} (Debug: {debug_mode})")
    # Use waitress or gunicorn in production instead of Flask's built-in server
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
