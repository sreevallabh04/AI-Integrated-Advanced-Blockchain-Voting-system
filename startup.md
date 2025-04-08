# Facial Authentication Voting System - Startup Guide

This guide will help you set up and run the facial authentication voting system. The system uses CNN-based facial recognition to verify voters' identities before allowing them to cast their votes.

## System Components

The system consists of the following components:
1. **Voting Web Application**: The main application where users can vote after authentication
2. **Facial Authentication Server**: A Python Flask server that performs CNN-based facial recognition
3. **Image Management Tool**: A utility for administrators to register user reference images

## Prerequisites

Make sure you have the following installed:
- Python 3.7+ with pip
- Node.js and npm (optional, only needed if you want to build the frontend)
- Web browser with webcam support
- Required Python packages (install using the command below)

```bash
pip install flask flask-cors opencv-python pillow numpy tensorflow
```

## Step 1: Register User Images

Before users can authenticate with facial recognition, you need to add reference images to the system. Use the image management tool for this:

```bash
# To capture an image from webcam and register a user
python image_manager.py --capture --user-id "user123"

# To add an existing image file for a user
python image_manager.py --add-user "user123" --image "/path/to/image.jpg"

# To list all registered users
python image_manager.py --list
```

The tool will store reference images in the `images/users` directory, organized by user ID.

## Step 2: Start the Facial Authentication Server

The facial authentication server handles the CNN-based face verification process:

```bash
# Start the facial authentication server
python facial_auth_server.py
```

The server runs on http://localhost:5000 by default. It provides the following API endpoints:
- `POST /api/auth/verify`: Verifies a user's face against stored references
- `GET /api/users`: Lists all registered users
- `GET /api/health`: Health check endpoint

## Step 3: Start the Voting Web Application

Start the web application using a simple HTTP server:

```bash
# Using Python's built-in HTTP server
python -m http.server 8000
```

The application will be available at http://localhost:8000.

## Step 4: User Authentication Flow

1. Open the application in your browser at http://localhost:8000
2. You'll see the facial authentication section at the top of the page
3. Enter your user ID (must match an ID registered in Step 1)
4. Click "Start Authentication" to activate your webcam
5. Position your face in the center of the frame
6. When your face is detected, click "Capture Image"
7. The system will verify your identity against the stored reference images
8. Upon successful verification, you'll be able to proceed to the voting section

## Security Considerations

For production use, consider these security enhancements:
1. Use HTTPS for all connections
2. Set up proper API key authentication
3. Configure the production environment in `production-config.js`
4. Use a more robust web server than the built-in Python server
5. Implement rate limiting to prevent brute force attacks
6. Add audit logging for all authentication attempts

## Troubleshooting

### Camera Access Issues
- Ensure your browser has permission to access the camera
- Try a different browser if the camera doesn't work
- Check browser console for errors related to camera access

### Authentication Failures
- Verify that reference images are properly stored in `images/users/{user_id}`
- Ensure good lighting when capturing authentication images
- Try different facial angles or expressions if authentication fails
- Check the facial authentication server logs for more details

### Server Connection Issues
- Verify that both servers are running
- Check for any firewall or network issues
- Ensure the API endpoints are correctly configured in `facial-auth.js`

## System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│  Web Browser    │     │ Facial Auth      │     │ Image         │
│  - HTML/JS/CSS  │────▶│ Server           │◀────│ Management    │
│  - WebRTC       │     │ - Flask API      │     │ Tool          │
│  - TensorFlow.js│     │ - CNN Model      │     │               │
└─────────────────┘     └──────────────────┘     └───────────────┘
         │                       │                      │
         │                       │                      │
         ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   File System Storage                        │
│                                                              │
│  ┌─────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │  Web Files  │   │ Reference      │   │ Model Files    │  │
│  │             │   │ Images         │   │                │  │
│  └─────────────┘   └────────────────┘   └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

This completes the setup and usage instructions for the facial authentication voting system.