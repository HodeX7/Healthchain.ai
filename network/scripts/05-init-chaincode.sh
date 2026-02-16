#!/bin/bash

# Ensure environment variables are set
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/patient.healthchain.com/users/Admin@patient.healthchain.com/msp
export CORE_PEER_ADDRESS=localhost:7051
export ORDERER_CA=${PWD}/../organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

# Add bin to path just in case
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/

CHANNEL_NAME="healthchain-channel"
CC_NAME="healthchain"

echo "Initializing chaincode..."

peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
  --tls \
  --cafile ${ORDERER_CA} \
  -C ${CHANNEL_NAME} \
  -n ${CC_NAME} \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:8051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/hospitalA.healthchain.com/peers/peer0.hospitalA.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/hospitalB.healthchain.com/peers/peer0.hospitalB.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:10051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/lab.healthchain.com/peers/peer0.lab.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:11051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/pharmacy.healthchain.com/peers/peer0.pharmacy.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:12051 \
  --tlsRootCertFiles ${PWD}/../organizations/peerOrganizations/insurance.healthchain.com/peers/peer0.insurance.healthchain.com/tls/ca.crt \
  -c '{"function":"initLedger","Args":[]}'

echo "✅ Chaincode initialized!"
