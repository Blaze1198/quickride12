#!/bin/bash
# Expo startup script with proper tunnel configuration

cd /app/frontend

# Load .env file
export $(cat .env | grep -v '^#' | xargs)

# Start Expo with tunnel mode and proper configuration
exec yarn expo start --tunnel --port 3000
