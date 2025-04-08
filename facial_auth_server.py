#!/usr/bin/env python3
"""
Facial Authentication API Server

This Flask-based server provides facial recognition authentication services for the voting application.
It uses CNN-based facial recognition to verify user identities against stored reference images.

Usage:
  python facial_auth_server.py
"""

import os
import sys
import json
import base64
import logging
import uuid
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
    print("pip install flask flask-cors opencv-python pillow numpy tensorflow")
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
METADATA_FILE = f"{IMAGES_DIR}/metadata.json"
TEMP_DIR = "images/temp"
MODEL_DIR = "models"
VERIFICATION_THRESHOLD = 0.6  # Adjust this threshold based on testing

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
os.makedirs(MODEL_DIR, exist_ok=True)

# Global model variables
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
face_model = None

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

def save_metadata(metadata):
    """Save the user metadata."""
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def init_face_model():
    """Initialize or load the facial recognition model."""
    global face_model
    
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
    """Get the embedding vector for a face."""
    if face_model is None:
        init_face_model()
    
    # Preprocess the face
    processed_face = preprocess_face(face_img)
    
    # Expand dimensions to create a batch of size 1
    batch = np.expand_dims(processed_face, axis=0)
    
    # Get the embedding
    embedding = face_model.predict(batch, verbose=0)[0]
    
    return embedding

def compute_similarity(embedding1, embedding2):
    """Compute the cosine similarity between two embeddings."""
    dot_product = np.dot(embedding1, embedding2)
    norm1 = np.linalg.norm(embedding1)
    norm2 = np.linalg.norm(embedding2)
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

def api_auth_required(f):
    """Simple API key authentication decorator."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # In production, you'd check a proper API key
        # For this demo, we're using a simple API key mechanism
        api_key = request.headers.get('X-API-Key')
        if not api_key:
            return jsonify({"error": "API key required"}), 401
        
        # Check if this is our development key
        if api_key != "dev_facial_auth_key" and api_key != "voting_system_dev_key":
            return jsonify({"error": "Invalid API key"}), 401
            
        return f(*args, **kwargs)
    return decorated

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "service": "facial-auth-api"
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

if __name__ == "__main__":
    # Initialize face recognition model
    init_face_model()
    
    # Start the server
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)