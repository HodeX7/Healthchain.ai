#!/bin/bash

DOCKER_COMPOSE_FILE="../docker/docker-compose.yml"

echo "Starting Hyperledger Fabric network..."

# Start the network
docker compose -f ${DOCKER_COMPOSE_FILE} up -d

if [ $? -ne 0 ]; then
  echo "Failed to start network..."
  exit 1
fi

echo "Waiting for containers to be healthy..."
sleep 10

# Check if all containers are running
docker ps -a

echo ""
echo "Network started successfully!"
echo "Orderer: localhost:7050"
echo "PatientOrg Peer: localhost:7051"
echo "HospitalAOrg Peer: localhost:8051"
echo "HospitalBOrg Peer: localhost:9051"
echo "LabOrg Peer: localhost:10051"
echo "PharmacyOrg Peer: localhost:11051"
echo "InsuranceOrg Peer: localhost:12051"
