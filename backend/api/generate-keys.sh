#!/bin/bash

# Generate a secure random JWT secret
echo "JWT_SECRET=$(openssl rand -base64 32)"

# Generate a 32-byte encryption key (for AES-256)
echo "ENCRYPTION_KEY=$(openssl rand -base64 32)"

echo ""
echo "Copy these values to your .env file!"
