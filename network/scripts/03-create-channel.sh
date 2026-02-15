#!/bin/bash

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../configtx
export ORDERER_CA=${PWD}/../organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

CHANNEL_NAME="healthchain-channel"
CHANNEL_ARTIFACTS_DIR="../channel-artifacts"

# Create channel artifacts directory
mkdir -p ${CHANNEL_ARTIFACTS_DIR}

echo "Creating channel genesis block..."

# Generate channel configuration transaction
configtxgen -profile HealthchainChannel \
  -outputBlock ${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block \
  -channelID ${CHANNEL_NAME}

if [ $? -ne 0 ]; then
  echo "Failed to generate channel configuration transaction..."
  exit 1
fi

echo "Channel genesis block created: ${CHANNEL_NAME}.block"
echo ""

# Switch FABRIC_CFG_PATH to config directory for peer commands
# (configtxgen uses configtx.yaml, peer CLI uses core.yaml)
export FABRIC_CFG_PATH=${PWD}/../config

# Create the channel using osnadmin
echo "Creating channel on orderer..."

export OSN_TLS_CA_ROOT_CERT=${PWD}/../organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/tls/ca.crt
export ADMIN_TLS_SIGN_CERT=${PWD}/../organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/tls/server.crt
export ADMIN_TLS_PRIVATE_KEY=${PWD}/../organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/tls/server.key

osnadmin channel join \
  --channelID ${CHANNEL_NAME} \
  --config-block ${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block \
  -o localhost:7053 \
  --ca-file "$OSN_TLS_CA_ROOT_CERT" \
  --client-cert "$ADMIN_TLS_SIGN_CERT" \
  --client-key "$ADMIN_TLS_PRIVATE_KEY"

if [ $? -ne 0 ]; then
  echo "Failed to create channel on orderer..."
  exit 1
fi

echo "Channel created successfully on orderer!"
echo ""

# Function to join peer to channel
joinPeerToChannel() {
  local ORG=$1
  local PEER=$2
  local PORT=$3
  local MSP_ID=$4
  
  echo "Joining ${PEER}.${ORG}.healthchain.com to ${CHANNEL_NAME}..."
  
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/${ORG}.healthchain.com/peers/${PEER}.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  
  peer channel join -b ${CHANNEL_ARTIFACTS_DIR}/${CHANNEL_NAME}.block
  
  if [ $? -ne 0 ]; then
    echo "Failed to join ${PEER}.${ORG}.healthchain.com to channel..."
    return 1
  fi
  
  echo "${PEER}.${ORG}.healthchain.com joined successfully!"
  echo ""
}

# Join all peers to the channel
joinPeerToChannel "patient" "peer0" "7051" "PatientOrgMSP"
joinPeerToChannel "hospitalA" "peer0" "8051" "HospitalAOrgMSP"
joinPeerToChannel "hospitalB" "peer0" "9051" "HospitalBOrgMSP"
joinPeerToChannel "lab" "peer0" "10051" "LabOrgMSP"
joinPeerToChannel "pharmacy" "peer0" "11051" "PharmacyOrgMSP"
joinPeerToChannel "insurance" "peer0" "12051" "InsuranceOrgMSP"

echo "All peers joined to ${CHANNEL_NAME} successfully!"
echo ""

# Update anchor peers
echo "Updating anchor peers..."

updateAnchorPeer() {
  local ORG=$1
  local PORT=$2
  local MSP_ID=$3
  
  echo "Updating anchor peer for ${ORG}..."
  
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  
  # Fetch the latest config block
  peer channel fetch config ${CHANNEL_ARTIFACTS_DIR}/config_block.pb \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
    -c ${CHANNEL_NAME} \
    --tls \
    --cafile ${ORDERER_CA}
  
  # Decode config block to JSON
  configtxlator proto_decode \
    --input ${CHANNEL_ARTIFACTS_DIR}/config_block.pb \
    --type common.Block \
    --output ${CHANNEL_ARTIFACTS_DIR}/config_block.json
  
  # Extract config
  jq .data.data[0].payload.data.config ${CHANNEL_ARTIFACTS_DIR}/config_block.json > ${CHANNEL_ARTIFACTS_DIR}/${ORG}_config.json
  
  # Modify the configuration to append the anchor peer
  jq '.channel_group.groups.Application.groups.'${MSP_ID}'.values += {"AnchorPeers":{"mod_policy": "Admins","value":{"anchor_peers": [{"host": "peer0.'${ORG}'.healthchain.com","port": '${PORT}'}]},"version": "0"}}' ${CHANNEL_ARTIFACTS_DIR}/${ORG}_config.json > ${CHANNEL_ARTIFACTS_DIR}/${ORG}_modified_config.json
  
  # Encode original config
  configtxlator proto_encode \
    --input ${CHANNEL_ARTIFACTS_DIR}/${ORG}_config.json \
    --type common.Config \
    --output ${CHANNEL_ARTIFACTS_DIR}/${ORG}_original_config.pb
  
  # Encode modified config
  configtxlator proto_encode \
    --input ${CHANNEL_ARTIFACTS_DIR}/${ORG}_modified_config.json \
    --type common.Config \
    --output ${CHANNEL_ARTIFACTS_DIR}/${ORG}_modified_config.pb
  
  # Compute delta
  configtxlator compute_update \
    --channel_id ${CHANNEL_NAME} \
    --original ${CHANNEL_ARTIFACTS_DIR}/${ORG}_original_config.pb \
    --updated ${CHANNEL_ARTIFACTS_DIR}/${ORG}_modified_config.pb \
    --output ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update.pb
  
  # Decode update
  configtxlator proto_decode \
    --input ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update.pb \
    --type common.ConfigUpdate \
    --output ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update.json
  
  # Wrap in envelope
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'${CHANNEL_NAME}'", "type":2}},"data":{"config_update":'$(cat ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update.json)'}}}' | jq . > ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update_envelope.json
  
  # Encode envelope
  configtxlator proto_encode \
    --input ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update_envelope.json \
    --type common.Envelope \
    --output ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update_envelope.pb
  
  # Update channel config
  peer channel update \
    -f ${CHANNEL_ARTIFACTS_DIR}/${ORG}_anchor_update_envelope.pb \
    -c ${CHANNEL_NAME} \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
    --tls \
    --cafile ${ORDERER_CA}
  
  echo "Anchor peer updated for ${ORG}!"
  echo ""
}

updateAnchorPeer "patient" "7051" "PatientOrgMSP"
updateAnchorPeer "hospitalA" "8051" "HospitalAOrgMSP"
updateAnchorPeer "hospitalB" "9051" "HospitalBOrgMSP"
updateAnchorPeer "lab" "10051" "LabOrgMSP"
updateAnchorPeer "pharmacy" "11051" "PharmacyOrgMSP"
updateAnchorPeer "insurance" "12051" "InsuranceOrgMSP"

echo "Channel ${CHANNEL_NAME} setup complete!"
