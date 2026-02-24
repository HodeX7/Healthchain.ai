#!/bin/bash

# Resolve script directory to handle running from any location
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
NETWORK_DIR=$(dirname "$SCRIPT_DIR")
PROJECT_ROOT=$(dirname "$NETWORK_DIR")

export PATH=${NETWORK_DIR}/bin:$PATH
export FABRIC_CFG_PATH=${NETWORK_DIR}/config
export ORDERER_CA=${NETWORK_DIR}/organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

CC_NAME="healthchain"
CC_VERSION="2.2"
CC_SEQUENCE="2"
CHANNEL_NAME="healthchain-channel"
CC_PATH="${PROJECT_ROOT}/fabric-healthcare-network/chaincode/healthcare"
COLLECTIONS_CONFIG="${PROJECT_ROOT}/fabric-healthcare-network/chaincode/healthcare/collections_config.json"

echo "========== Upgrading Chaincode to v${CC_VERSION} =========="

# Step 1: Package chaincode
echo "Step 1: Packaging chaincode..."
rm -rf ${CC_PATH}/node_modules
rm -f ${CC_PATH}/package-lock.json

peer lifecycle chaincode package ${CC_NAME}_v${CC_VERSION}.tar.gz \
  --path ${CC_PATH} \
  --lang node \
  --label ${CC_NAME}_${CC_VERSION}

if [ $? -ne 0 ]; then
  echo "Failed to package chaincode"
  exit 1
fi

echo "✅ Chaincode packaged: ${CC_NAME}_v${CC_VERSION}.tar.gz"
echo ""

# Function to install chaincode on a peer
installChaincode() {
  local ORG=$1
  local PORT=$2
  local MSP_ID=$3
  
  echo "Installing chaincode on ${ORG}..."
  
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  
  peer lifecycle chaincode install ${CC_NAME}_v${CC_VERSION}.tar.gz
  
  if [ $? -ne 0 ]; then
    echo "Failed to install on ${ORG}"
    return 1
  fi
  
  echo "✅ Installed on ${ORG}"
  echo ""
}

# Step 2: Install on all peers
echo "Step 2: Installing chaincode on all peers..."
installChaincode "patient" "7051" "PatientOrgMSP"
installChaincode "hospitalA" "8051" "HospitalAOrgMSP"
installChaincode "hospitalB" "9051" "HospitalBOrgMSP"
installChaincode "lab" "10051" "LabOrgMSP"
installChaincode "pharmacy" "11051" "PharmacyOrgMSP"
installChaincode "insurance" "12051" "InsuranceOrgMSP"

# Step 3: Get package ID
echo "Step 3: Querying installed chaincode..."
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/patient.healthchain.com/users/Admin@patient.healthchain.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer lifecycle chaincode queryinstalled > installed_v2.txt
cat installed_v2.txt

PACKAGE_ID=$(sed -n "/${CC_NAME}_${CC_VERSION}/{s/^Package ID: //; s/, Label:.*$//; p;}" installed_v2.txt)

if [ -z "$PACKAGE_ID" ]; then
  echo "Failed to get package ID"
  exit 1
fi

echo "Package ID: $PACKAGE_ID"
echo ""

# Function to approve chaincode for organization
approveChaincode() {
  local ORG=$1
  local PORT=$2
  local MSP_ID=$3
  
  echo "Approving chaincode for ${ORG}..."
  
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${NETWORK_DIR}/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NETWORK_DIR}/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  
  peer lifecycle chaincode approveformyorg \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
    --tls \
    --cafile ${ORDERER_CA} \
    --channelID ${CHANNEL_NAME} \
    --name ${CC_NAME} \
    --version ${CC_VERSION} \
    --package-id ${PACKAGE_ID} \
    --sequence ${CC_SEQUENCE} \
    --collections-config ${COLLECTIONS_CONFIG} \
    --signature-policy "OR('PatientOrgMSP.member','HospitalAOrgMSP.member','HospitalBOrgMSP.member','LabOrgMSP.member','PharmacyOrgMSP.member','InsuranceOrgMSP.member')"
  
  if [ $? -ne 0 ]; then
    echo "Failed to approve for ${ORG}"
    return 1
  fi
  
  echo "✅ Approved for ${ORG}"
  echo ""
}

# Step 4: Approve for all organizations
echo "Step 4: Approving chaincode for all organizations..."
approveChaincode "patient" "7051" "PatientOrgMSP"
approveChaincode "hospitalA" "8051" "HospitalAOrgMSP"
approveChaincode "hospitalB" "9051" "HospitalBOrgMSP"
approveChaincode "lab" "10051" "LabOrgMSP"
approveChaincode "pharmacy" "11051" "PharmacyOrgMSP"
approveChaincode "insurance" "12051" "InsuranceOrgMSP"

# Step 5: Check commit readiness
echo "Step 5: Checking commit readiness..."
peer lifecycle chaincode checkcommitreadiness \
  --channelID ${CHANNEL_NAME} \
  --name ${CC_NAME} \
  --version ${CC_VERSION} \
  --sequence ${CC_SEQUENCE} \
  --collections-config ${COLLECTIONS_CONFIG} \
  --output json

echo ""

# Step 6: Commit chaincode
echo "Step 6: Committing chaincode..."
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
  --tls \
  --cafile ${ORDERER_CA} \
  --channelID ${CHANNEL_NAME} \
  --name ${CC_NAME} \
  --version ${CC_VERSION} \
  --sequence ${CC_SEQUENCE} \
  --collections-config ${COLLECTIONS_CONFIG} \
  --signature-policy "OR('PatientOrgMSP.member','HospitalAOrgMSP.member','HospitalBOrgMSP.member','LabOrgMSP.member','PharmacyOrgMSP.member','InsuranceOrgMSP.member')" \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:8051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/hospitalA.healthchain.com/peers/peer0.hospitalA.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/hospitalB.healthchain.com/peers/peer0.hospitalB.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:10051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/lab.healthchain.com/peers/peer0.lab.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:11051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/pharmacy.healthchain.com/peers/peer0.pharmacy.healthchain.com/tls/ca.crt \
  --peerAddresses localhost:12051 \
  --tlsRootCertFiles ${NETWORK_DIR}/organizations/peerOrganizations/insurance.healthchain.com/peers/peer0.insurance.healthchain.com/tls/ca.crt

if [ $? -ne 0 ]; then
  echo "Failed to commit chaincode"
  exit 1
fi

echo "✅ Chaincode upgraded to v${CC_VERSION} successfully!"
echo ""

# Step 7: Verify deployment
echo "Step 7: Verifying deployment..."
peer lifecycle chaincode querycommitted \
  --channelID ${CHANNEL_NAME} \
  --name ${CC_NAME}

echo ""
echo "========== Chaincode Upgrade Complete =========="
