#!/bin/bash

set -e  # Exit on any error

# Change to the scripts directory
cd "$(dirname "$0")"

echo "🧹 Cleaning up any existing containers and volumes..."
cd ../docker
docker compose down -v 2>/dev/null || true
cd ../scripts

echo "Step 1: Generating crypto material..."
./01-generate-crypto.sh
echo ""

echo "Step 2: Starting the Docker network..."
./02-start-network.sh
echo ""

echo "Step 3: Creating channel..."
./03-create-channel.sh
echo ""

echo "✅ Full build complete!"
