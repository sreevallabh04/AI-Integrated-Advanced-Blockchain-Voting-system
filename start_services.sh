#!/bin/bash

# Exit on error
set -e

echo "Starting Voting System Services..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Check if pip is installed
if ! command -v pip3 &> /dev/null; then
    echo "pip3 is not installed. Please install pip3 first."
    exit 1
fi

# Create and activate virtual environment
echo "Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if Redis is installed and running
if ! command -v redis-cli &> /dev/null; then
    echo "Redis is not installed. Please install Redis first."
    exit 1
fi

# Start Redis if not running
if ! redis-cli ping &> /dev/null; then
    echo "Starting Redis server..."
    redis-server --daemonize yes
fi

# Create necessary directories
echo "Creating required directories..."
mkdir -p images/users images/temp models logs

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from template..."
    cp .env.example .env
    echo "Please update the .env file with your configuration values."
    exit 1
fi

# Start the facial authentication server
echo "Starting facial authentication server..."
gunicorn --bind 0.0.0.0:5000 --workers 4 --timeout 120 facial_auth_server:app &

# Start the frontend server (if using Node.js)
if [ -f "package.json" ]; then
    echo "Installing Node.js dependencies..."
    npm install
    
    echo "Starting frontend server..."
    npm start &
fi

echo "All services started successfully!"
echo "Facial Authentication Server: http://localhost:5000"
echo "Frontend Server: http://localhost:3000"
echo "Health Check: http://localhost:5000/health"

# Keep the script running
wait 