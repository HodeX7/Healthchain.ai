#!/bin/bash

# Script to download and install Hyperledger Fabric binaries
# This will download the binaries to network/bin/

echo "Downloading Hyperledger Fabric binaries..."
echo ""

# Set version
FABRIC_VERSION="2.5.11"
CA_VERSION="1.5.15"

# Create bin directory
mkdir -p bin

# Download install script
curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary

# Check if download was successful
if [ -d "bin" ] && [ -f "bin/cryptogen" ]; then
    echo ""
    echo "✅ Fabric binaries installed successfully in $(pwd)/bin/"
    echo ""
    echo "Binaries installed:"
    ls -lh bin/
else
    echo ""
    echo "❌ Failed to install Fabric binaries"
    exit 1
fi
