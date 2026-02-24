#!/bin/bash

# Stress-tests gossip synchronisation: issues 10 prescriptions and immediately
# tries to fulfil each one without any sleep between write and read.

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "${SCRIPT_DIR}/../.." && pwd )"

export PATH=${PROJECT_ROOT}/network/bin:$PATH
export FABRIC_CFG_PATH=${PROJECT_ROOT}/network/config
export ORDERER_CA=${PROJECT_ROOT}/network/organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

CHANNEL_NAME="healthchain-channel"
CC_NAME="healthchain"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SUCCESSES=0
FAILURES=0

set_peer_env() {
  local ORG=$1 PORT=$2 MSP=$3
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="$MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
}

invokeCC() {
  local JSON=$1 ORG=$2 PORT=$3 MSP=$4
  set_peer_env "$ORG" "$PORT" "$MSP"
  peer chaincode invoke \
    -o localhost:7050 \
    --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
    --tls --cafile "${ORDERER_CA}" \
    -C "${CHANNEL_NAME}" -n "${CC_NAME}" \
    --peerAddresses "localhost:${PORT}" \
    --tlsRootCertFiles "${CORE_PEER_TLS_ROOTCERT_FILE}" \
    --waitForEvent \
    -c "$JSON" 2>&1
}

echo "==========================================="
echo "     GOSSIP STRESS TEST"
echo "==========================================="
echo ""
echo "Prerequisites: PAT001 must be registered and"
echo "HospitalAOrgMSP consent must be active."
echo "Run test-blockchain-comprehensive.sh first."
echo ""

# ── Prerequisite: ensure PAT001 exists and HospitalA has consent ─────────────
echo -e "${YELLOW}Setting up prerequisites...${NC}"

J='{"function":"registerPatient","Args":["PAT001","Alice","Smith","1990-05-15","O+","alice@email.com","+1234567890"]}'
invokeCC "$J" patient 7051 PatientOrgMSP > /dev/null 2>&1

sleep 2

J='{"function":"requestAccess","Args":["PAT001"]}'
invokeCC "$J" hospitalA 8051 HospitalAOrgMSP > /dev/null 2>&1

sleep 2

J='{"function":"grantAccess","Args":["PAT001","HospitalAOrgMSP","[\"collectionPrescriptions_HospitalA\"]"]}'
invokeCC "$J" patient 7051 PatientOrgMSP > /dev/null 2>&1

sleep 3
echo -e "${GREEN}Prerequisites done.${NC}"
echo ""
echo "This test issues 10 prescriptions and immediately"
echo "tries to fulfil each one to stress-test the gossip"
echo "wait mechanism in fulfillPrescription()."
echo ""

# ── Stress loop ───────────────────────────────────────────────────────────────

for i in {1..10}; do
  PRES_ID="PRES_STRESS_$(printf "%03d" $i)"

  echo -e "${YELLOW}Test $i/10: Issue → immediately fulfil $PRES_ID${NC}"

  # Issue as HospitalA (--waitForEvent ensures block is committed before we proceed)
  J="{\"function\":\"issuePrescription\",\"Args\":[\"${PRES_ID}\",\"PAT001\",\"[{\\\"name\\\":\\\"Medication${i}\\\",\\\"dosage\\\":\\\"10mg\\\"}]\",\"Test\",\"2026-12-31\"]}"
  echo "  → Issuing..."
  ISSUE_R=$(invokeCC "$J" hospitalA 8051 HospitalAOrgMSP)

  if echo "$ISSUE_R" | grep -qE "successful|${PRES_ID}"; then
    echo -e "    ${GREEN}✓${NC} Issued"
  else
    echo -e "    ${RED}✗${NC} Issue failed: $ISSUE_R"
    ((FAILURES++))
    continue
  fi

  # Fulfil as Pharmacy — NO extra sleep — this is the gossip stress test
  echo "  → Fulfilling immediately (gossip wait inside chaincode)..."
  START=$(date +%s%N)
  J="{\"function\":\"fulfillPrescription\",\"Args\":[\"${PRES_ID}\"]}"
  FULFILL_R=$(invokeCC "$J" pharmacy 11051 PharmacyOrgMSP)
  END=$(date +%s%N)
  MS=$(( (END - START) / 1000000 ))

  if echo "$FULFILL_R" | grep -qE "fulfilled|successful"; then
    echo -e "    ${GREEN}✓${NC} Fulfilled in ${MS}ms"
    ((SUCCESSES++))
  else
    echo -e "    ${RED}✗${NC} Fulfil failed (${MS}ms): $FULFILL_R"
    ((FAILURES++))
  fi
  echo ""
done

# ── Summary ───────────────────────────────────────────────────────────────────
echo "==========================================="
echo "     STRESS TEST RESULTS"
echo "==========================================="
echo -e "${GREEN}Successes: $SUCCESSES/10${NC}"
echo -e "${RED}Failures:  $FAILURES/10${NC}"
echo ""

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}✓ Gossip wait mechanism is working perfectly!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some transactions failed — consider increasing waitMs in readPrescriptionWithGossipWait()${NC}"
  exit 1
fi
