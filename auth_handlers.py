"""
Authentication Handlers for Blockchain Voting System

This module provides handlers for the multi-factor authentication flow:
1. Credential verification (Aadhar, Voter ID, mobile)
2. OTP verification 
3. Facial recognition verification

These handlers ensure secure voter authentication before allowing voting access.
"""

import os
import uuid
import json
import logging
import random
import base64
from datetime import datetime, timedelta

from flask import jsonify, request

# Configure logging
logger = logging.getLogger("facial-auth-api")

# In-memory storage for OTPs during development
otp_storage = {}

def register_endpoints(app, api_auth_required, voter_database, get_voter_key, 
                       extract_face_from_image, verify_voter_by_face, 
                       get_face_embedding, register_voter, TEMP_DIR):
    """Register authentication endpoints with the Flask app."""
    
    @app.route('/api/auth/verify-credentials', methods=['POST'])
    @api_auth_required
    def verify_credentials():
        """Verify voter credentials (Aadhar, Voter ID, Mobile) and generate OTP."""
        try:
            data = request.json
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            aadhar = data.get('aadhar')
            voter_id = data.get('voterId')
            mobile = data.get('mobile')
            
            if not aadhar:
                return jsonify({"error": "Aadhar number is required"}), 400
            if not voter_id:
                return jsonify({"error": "Voter ID is required"}), 400
            if not mobile:
                return jsonify({"error": "Mobile number is required"}), 400
            
            # Create unique voter key
            voter_key = get_voter_key(aadhar, voter_id)
            found_in_db = voter_key in voter_database
            
            # Generate a random 6-digit OTP
            otp = ''.join(random.choices('0123456789', k=6))
            
            # Store OTP for verification
            otp_storage[voter_key] = {
                'otp': otp,
                'created_at': datetime.now().isoformat(),
                'verified': False
            }
            
            # In a production system, send OTP via SMS to the mobile number
            # For development/testing, we'll just return it in the response
            
            return jsonify({
                "success": True,
                "found_in_db": found_in_db,
                "otp": otp,  # Only included for development; in production, this would be sent to the user's mobile
                "message": "OTP sent successfully" if found_in_db else "New voter registration initiated",
                "voter_key": voter_key[:8] + "..."
            })
            
        except Exception as e:
            logger.error(f"Error verifying credentials: {str(e)}")
            return jsonify({"error": f"Server error: {str(e)}"}), 500

    @app.route('/api/auth/verify-otp', methods=['POST'])
    @api_auth_required
    def verify_otp():
        """Verify the OTP provided by the user."""
        try:
            data = request.json
            if not data:
                return jsonify({"error": "No data provided"}), 400
            
            aadhar = data.get('aadhar')
            voter_id = data.get('voterId')
            otp = data.get('otp')
            
            if not aadhar or not voter_id:
                return jsonify({"error": "Aadhar and Voter ID are required"}), 400
            if not otp:
                return jsonify({"error": "OTP is required"}), 400
            
            # Get voter key
            voter_key = get_voter_key(aadhar, voter_id)
            
            # Check OTP
            otp_data = otp_storage.get(voter_key)
            
            if not otp_data:
                return jsonify({
                    "verified": False,
                    "error": "No OTP request found for this voter"
                }), 400
            
            # Check if OTP matches
            if otp_data['otp'] != otp:
                return jsonify({
                    "verified": False,
                    "error": "Invalid OTP"
                }), 400
            
            # Calculate time since OTP generation (for expiration check)
            created_at = datetime.fromisoformat(otp_data['created_at'])
            time_elapsed = (datetime.now() - created_at).total_seconds() / 60  # minutes
            
            if time_elapsed > 10:  # OTP expired after 10 minutes
                return jsonify({
                    "verified": False,
                    "error": "OTP has expired"
                }), 400
            
            # Mark as verified
            otp_data['verified'] = True
            otp_storage[voter_key] = otp_data
            
            return jsonify({
                "verified": True,
                "message": "OTP verified successfully"
            })
            
        except Exception as e:
            logger.error(f"Error verifying OTP: {str(e)}")
            return jsonify({"error": f"Server error: {str(e)}"}), 500

    @app.route('/api/auth/verify-voter', methods=['POST'])
    @api_auth_required
    def verify_voter():
        """Verify a voter's identity with Aadhar, Voter ID and face after OTP verification."""
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
            
            # Get voter key
            voter_key = get_voter_key(aadhar, voter_id)
            
            # Check OTP verification
            otp_data = otp_storage.get(voter_key, {})
            if not otp_data.get('verified', False):
                return jsonify({
                    "verified": False,
                    "error": "OTP verification required before face verification",
                    "required_step": "otp_verification"
                }), 400
            
            # Extract face from image
            face_img, error = extract_face_from_image(image_data)
            if error:
                return jsonify({"error": error}), 400
            
            # Generate a unique ID for this verification
            verification_id = str(uuid.uuid4())
            
            # Save the processed face temporarily (for debugging)
            temp_path = os.path.join(TEMP_DIR, f"voter_verify_{verification_id}.jpg")
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            import cv2
            cv2.imwrite(temp_path, face_img)
            
            # Verify the voter
            verified, details = verify_voter_by_face(aadhar, voter_id, face_img)
            
            # If first time (not found in DB), register this voter
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
    
    return app  # Return the app with the registered endpoints