#!/bin/bash
export PATH=${PWD}/network/bin:$PATH
export FABRIC_CFG_PATH=${PWD}/network/config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="HospitalAOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/network/organizations/peerOrganizations/hospitalA.healthchain.com/peers/peer0.hospitalA.healthchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/network/organizations/peerOrganizations/hospitalA.healthchain.com/users/Admin@hospitalA.healthchain.com/msp
export CORE_PEER_ADDRESS=localhost:8051

echo "Reading RECORD_PAT001_REC001 from public state..."
peer chaincode query -C healthchain-channel -n healthchain -c '{"Args":["org.hyperledger.fabric:GetState", "RECORD_PAT001_REC001"]}' 2>&1

echo "Reading RECORD_PAT001_REC001 from private state..."
peer chaincode query -C healthchain-channel -n healthchain -c '{"Args":["org.hyperledger.fabric:GetPrivateData", "collectionMedicalRecords_HospitalA", "RECORD_PAT001_REC001"]}' 2>&1
