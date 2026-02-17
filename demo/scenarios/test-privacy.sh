#!/bin/bash

echo "========================================="
echo "   PRIVACY VERIFICATION TEST"
echo "========================================="
echo ""


# Resolve script directory to handle running from any location
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

# Setup (same as above)
export PATH=${PROJECT_ROOT}/network/scripts:${PROJECT_ROOT}/network/bin:${PROJECT_ROOT}/bin:$PATH
export FABRIC_CFG_PATH=${PROJECT_ROOT}/network/config
CHANNEL_NAME="healthchain-channel"
CC_NAME="healthchain"

queryChaincode() {
  local FUNCTION=$1
  local ARGS=$2
  local ORG=$3
  local PORT=$4
  local MSP_ID=$5
  
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  
  peer chaincode query \
    -C ${CHANNEL_NAME} \
    -n ${CC_NAME} \
    -c "{\"function\":\"${FUNCTION}\",\"Args\":[${ARGS}]}"
}

echo "Test 1: Hospital B tries to access Hospital A's records WITHOUT consent"
echo "Expected: Error (no active consent)"
echo ""

queryChaincode "queryPatientRecords" '"PAT001"' "hospitalB" "9051" "HospitalBOrgMSP" 2>&1

if [ $? -ne 0 ]; then
  echo "✅ PASS: Hospital B correctly blocked"
else
  echo "❌ FAIL: Hospital B should not have access"
fi

echo ""
echo "Test 2: Lab tries to access medical records"
echo "Expected: Error (Lab not in medical records PDC)"
echo ""

queryChaincode "queryPatientRecords" '"PAT001"' "lab" "10051" "LabOrgMSP" 2>&1

if [ $? -ne 0 ]; then
  echo "✅ PASS: Lab correctly blocked from medical records"
else
  echo "❌ FAIL: Lab should not access medical records"
fi

echo ""
echo "Test 3: Patient can always access own records"
echo "Expected: Success"
echo ""

queryChaincode "getMyMedicalRecords" '"PAT001"' "patient" "7051" "PatientOrgMSP"

if [ $? -eq 0 ]; then
  echo "✅ PASS: Patient can access own records"
else
  echo "❌ FAIL: Patient should access own records"
fi

echo ""
echo "========================================="
echo "   PRIVACY TEST COMPLETE"
echo "========================================="
