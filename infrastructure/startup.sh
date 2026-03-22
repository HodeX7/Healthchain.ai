#!/bin/bash
echo "Starting Cloud-Init for HealthChain Server..."
exec > >(tee -i /var/log/startup-script.log)
exec 2>&1

sudo apt-get update -y

# 1. Install Node.js & PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs jq git
sudo npm install -g pm2

# 2. Install Docker & Docker Compose
sudo apt-get install -y ca-certificates curl gnupg lsb-release
sudo mkdir -m 0755 -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 3. Configure permissions
sudo usermod -aG docker ubuntu
sudo systemctl enable docker
sudo systemctl restart docker

echo "✅ VM Initialized. Node.js, PM2, and Docker are ready for Hyperledger deployments."
