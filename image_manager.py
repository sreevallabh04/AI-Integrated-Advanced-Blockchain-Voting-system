#!/usr/bin/env python3
"""
Facial Recognition Image Manager

This script helps manage reference images for the facial authentication system.
It allows administrators to add new user images, capture images from a webcam,
and associate them with user IDs for facial verification.

Usage:
  - Add a user: python image_manager.py --add-user <user_id> --image <path_to_image>
  - Capture from webcam: python image_manager.py --capture --user-id <user_id>
  - List users: python image_manager.py --list
"""

import os
import sys
import argparse
import shutil
import time
import json
from datetime import datetime

try:
    import cv2
    import numpy as np
    from PIL import Image
except ImportError:
    print("Required libraries not found. Please install with:")
    print("pip install opencv-python pillow numpy")
    sys.exit(1)

# Configuration
IMAGES_DIR = "images/users"
METADATA_FILE = f"{IMAGES_DIR}/metadata.json"
FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def ensure_directories():
    """Ensure the required directories exist."""
    os.makedirs(IMAGES_DIR, exist_ok=True)
    if not os.path.exists(METADATA_FILE):
        with open(METADATA_FILE, 'w') as f:
            json.dump({}, f)

def load_metadata():
    """Load the user metadata."""
    with open(METADATA_FILE, 'r') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}

def save_metadata(metadata):
    """Save the user metadata."""
    with open(METADATA_FILE, 'w') as f:
        json.dump(metadata, f, indent=2)

def add_user(user_id, image_path):
    """Add a new user with a reference image."""
    if not os.path.exists(image_path):
        print(f"Error: Image file not found: {image_path}")
        return False
    
    # Load and preprocess the image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image: {image_path}")
        return False
    
    # Convert to grayscale for face detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Detect faces
    faces = FACE_CASCADE.detectMultiScale(gray, 1.3, 5)
    if len(faces) == 0:
        print("Error: No face detected in the image.")
        return False
    if len(faces) > 1:
        print("Warning: Multiple faces detected. Using the largest face.")
    
    # Sort faces by area (width * height) in descending order
    faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
    
    # Extract the largest face
    x, y, w, h = faces[0]
    face = img[y:y+h, x:x+w]
    
    # Create user directory if it doesn't exist
    user_dir = os.path.join(IMAGES_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    
    # Save the extracted face
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    face_filename = f"{user_id}_{timestamp}.jpg"
    face_path = os.path.join(user_dir, face_filename)
    cv2.imwrite(face_path, face)
    
    # Update metadata
    metadata = load_metadata()
    if user_id not in metadata:
        metadata[user_id] = {
            "created": datetime.now().isoformat(),
            "images": []
        }
    
    metadata[user_id]["images"].append({
        "filename": face_filename,
        "path": face_path,
        "added": datetime.now().isoformat(),
        "source": "imported"
    })
    
    save_metadata(metadata)
    print(f"Successfully added user {user_id} with reference image.")
    return True

def capture_from_webcam(user_id):
    """Capture an image from the webcam and add it as a reference for the user."""
    print("Opening webcam... Press SPACE to capture or ESC to cancel.")
    
    # Open webcam
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return False
    
    face_detected = False
    while True:
        # Read frame
        ret, frame = cap.read()
        if not ret:
            print("Error: Could not read frame from webcam.")
            break
        
        # Convert to grayscale for face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Detect faces
        faces = FACE_CASCADE.detectMultiScale(gray, 1.3, 5)
        
        # Draw rectangle around detected faces
        for (x, y, w, h) in faces:
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            face_detected = True
        
        # Display status
        if face_detected:
            cv2.putText(frame, "Face detected! Press SPACE to capture.", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        else:
            cv2.putText(frame, "No face detected. Position your face in the frame.", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        # Display the frame
        cv2.imshow("Capture Reference Image", frame)
        
        # Wait for key press
        key = cv2.waitKey(1)
        
        # ESC key to exit
        if key == 27:
            print("Capture cancelled.")
            break
        
        # SPACE key to capture
        if key == 32 and face_detected and len(faces) > 0:
            # Sort faces by area (width * height) in descending order
            faces = sorted(faces, key=lambda x: x[2] * x[3], reverse=True)
            
            # Extract the largest face
            x, y, w, h = faces[0]
            face = frame[y:y+h, x:x+w]
            
            # Create user directory if it doesn't exist
            user_dir = os.path.join(IMAGES_DIR, user_id)
            os.makedirs(user_dir, exist_ok=True)
            
            # Save the extracted face
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            face_filename = f"{user_id}_{timestamp}.jpg"
            face_path = os.path.join(user_dir, face_filename)
            cv2.imwrite(face_path, face)
            
            # Update metadata
            metadata = load_metadata()
            if user_id not in metadata:
                metadata[user_id] = {
                    "created": datetime.now().isoformat(),
                    "images": []
                }
            
            metadata[user_id]["images"].append({
                "filename": face_filename,
                "path": face_path,
                "added": datetime.now().isoformat(),
                "source": "webcam"
            })
            
            save_metadata(metadata)
            print(f"Successfully captured and added reference image for user {user_id}.")
            break
    
    # Release webcam and close windows
    cap.release()
    cv2.destroyAllWindows()
    return True

def list_users():
    """List all registered users."""
    metadata = load_metadata()
    if not metadata:
        print("No users found.")
        return
    
    print(f"Total users: {len(metadata)}")
    print("-" * 50)
    for user_id, data in metadata.items():
        print(f"User ID: {user_id}")
        print(f"Created: {data['created']}")
        print(f"Reference images: {len(data['images'])}")
        print("-" * 50)

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Manage facial recognition reference images")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--add-user", help="Add a new user with the specified ID")
    group.add_argument("--capture", action="store_true", help="Capture an image from webcam")
    group.add_argument("--list", action="store_true", help="List all registered users")
    
    parser.add_argument("--user-id", help="User ID for capture mode")
    parser.add_argument("--image", help="Path to image file for add-user mode")
    
    args = parser.parse_args()
    
    # Ensure directories exist
    ensure_directories()
    
    # Process command
    if args.list:
        list_users()
    elif args.add_user:
        if not args.image:
            parser.error("--add-user requires --image")
        add_user(args.add_user, args.image)
    elif args.capture:
        if not args.user_id:
            parser.error("--capture requires --user-id")
        capture_from_webcam(args.user_id)

if __name__ == "__main__":
    main()