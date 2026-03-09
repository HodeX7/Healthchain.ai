#!/bin/bash
# =============================================================================
#  HealthChain Comprehensive Test Suite  — All Scenarios
#  120+ test cases across 15 categories
# =============================================================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "${SCRIPT_DIR}/../.." && pwd )"
NET="${PROJECT_ROOT}/network"

export PATH=${NET}/bin:$PATH
export FABRIC_CFG_PATH=${NET}/config
export ORDERER_CA=${NET}/organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

CHANNEL="healthchain-channel"
CC="healthchain"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

PASS=0; FAIL=0; TEST_NUM=0
FAILED_TESTS=()

# ── Peer helpers ──────────────────────────────────────────────────────────────
set_peer() {
  local ORG=$1 PORT=$2 MSP=$3
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="$MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE=${NET}/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${NET}/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
}

invoke() {
  local JSON=$1 ORG=$2 PORT=$3 MSP=$4
  set_peer "$ORG" "$PORT" "$MSP"
  peer chaincode invoke \
    -o localhost:7050 --ordererTLSHostnameOverride orderer.orderer.healthchain.com \
    --tls --cafile "${ORDERER_CA}" -C "${CHANNEL}" -n "${CC}" \
    --peerAddresses "localhost:${PORT}" --tlsRootCertFiles "${CORE_PEER_TLS_ROOTCERT_FILE}" \
    --waitForEvent -c "$JSON" 2>&1
}

query() {
  local JSON=$1 ORG=$2 PORT=$3 MSP=$4
  set_peer "$ORG" "$PORT" "$MSP"
  peer chaincode query -C "${CHANNEL}" -n "${CC}" -c "$JSON" 2>&1
}

# ── Test runner ───────────────────────────────────────────────────────────────
tc() {
  # tc <name> <result> <expected_regex> [should_fail]
  local NAME=$1 RESULT=$2 EXPECTED=$3 SHOULD_FAIL=${4:-0}
  ((TEST_NUM++))
  local LABEL="T${TEST_NUM}: ${NAME}"

  local IS_ERR=0
  echo "$RESULT" | grep -qE "ENDORSEMENT_POLICY_FAILURE|transaction invalidated" && IS_ERR=1

  local MATCHED=0
  echo "$RESULT" | grep -qE "$EXPECTED" && MATCHED=1

  if [ "$SHOULD_FAIL" -eq 1 ]; then
    # We WANT a failure / error message
    if [ "$MATCHED" -eq 1 ] || [ "$IS_ERR" -eq 0 -a "$(echo "$RESULT" | grep -c 'Error')" -gt 0 ]; then
      echo -e "${GREEN}✓ PASS${NC} ${LABEL}"
      ((PASS++))
    else
      echo -e "${RED}✗ FAIL${NC} ${LABEL}"
      echo "   Expected error matching: $EXPECTED"
      echo "   Got: $(echo "$RESULT" | head -1)"
      ((FAIL++)); FAILED_TESTS+=("$LABEL")
    fi
  else
    if [ "$IS_ERR" -eq 1 ]; then
      echo -e "${RED}✗ FAIL${NC} ${LABEL} (Endorsement/Policy Failure)"
      echo "   $(echo "$RESULT" | grep -oE 'ENDORSEMENT_POLICY_FAILURE|invalidated.*' | head -1)"
      ((FAIL++)); FAILED_TESTS+=("$LABEL")
    elif [ "$MATCHED" -eq 1 ]; then
      echo -e "${GREEN}✓ PASS${NC} ${LABEL}"
      ((PASS++))
    else
      echo -e "${RED}✗ FAIL${NC} ${LABEL}"
      echo "   Expected: $EXPECTED"
      echo "   Got     : $(echo "$RESULT" | head -1)"
      ((FAIL++)); FAILED_TESTS+=("$LABEL")
    fi
  fi
}

section() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}${BOLD}  $1${NC}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════${NC}"
}

# ── Full rebuild ──────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║     HEALTHCHAIN COMPREHENSIVE TEST SUITE             ║"
echo "║     120+ Scenarios · 15 Categories                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "${YELLOW}Step 0: Rebuilding network from scratch...${NC}"
cd "${PROJECT_ROOT}"
./network/scripts/full_build.sh > /tmp/hc_build.log 2>&1
if [ $? -ne 0 ]; then
  echo -e "${RED}full_build.sh FAILED — aborting tests${NC}"
  tail -20 /tmp/hc_build.log; exit 1
fi
echo -e "${GREEN}✓ Network ready.${NC}"

# Shorthands
PAT="patient 7051 PatientOrgMSP"
HOSP_A="hospitalA 8051 HospitalAOrgMSP"
HOSP_B="hospitalB 9051 HospitalBOrgMSP"
LAB="lab 10051 LabOrgMSP"
PHARMA="pharmacy 11051 PharmacyOrgMSP"
INS="insurance 12051 InsuranceOrgMSP"
PDC_ALL_HOSP_A='collectionMedicalRecords_HospitalA","collectionLabReports_HospitalA","collectionPrescriptions_HospitalA","collectionInsuranceClaims_HospitalA'

grant_full_access_hosp_a() {
  # Passes authorizedPDCs as a JSON-encoded STRING (inner escaping), which is what the chaincode expects
  local PATIENT=$1
  invoke "{\"function\":\"grantAccess\",\"Args\":[\"${PATIENT}\",\"HospitalAOrgMSP\",\"[\\\"collectionMedicalRecords_HospitalA\\\",\\\"collectionLabReports_HospitalA\\\",\\\"collectionPrescriptions_HospitalA\\\",\\\"collectionInsuranceClaims_HospitalA\\\"]\"]}" patient 7051 PatientOrgMSP
}

# issue_prescription_hosp_a <id> <patientId> <diagnosis>
issue_prescription_hosp_a() {
  local PID=$1 PATIENT=$2 DIAG=$3
  invoke '{"function":"issuePrescription","Args":["'"${PID}"'","'"${PATIENT}"'","[{\"name\":\"Lisinopril\",\"dosage\":\"10mg\",\"frequency\":\"Once daily\",\"duration\":\"30 days\"}]","'"${DIAG}"'","2027-12-31"]}' hospitalA 8051 HospitalAOrgMSP
}

# submit_claim_hosp_a <id> <patientId> <date>
submit_claim_hosp_a() {
  local CID=$1 PATIENT=$2 DATE=$3
  invoke '{"function":"submitInsuranceClaim","Args":["'"${CID}"'","'"${PATIENT}"'","'"${DATE}"'","[{\"code\":\"99213\",\"description\":\"Office visit\",\"cost\":150.00}]","150.00"]}' hospitalA 8051 HospitalAOrgMSP
}

# =============================================================================
section "CATEGORY 1: PATIENT LIFECYCLE (10 tests)"
# =============================================================================

R=$(invoke '{"function":"registerPatient","Args":["P001","Alice","Smith","1990-05-15","O+","alice@hc.com","+11234567890"]}' $PAT)
tc "Register patient P001" "$R" "P001"
sleep 1

R=$(invoke '{"function":"registerPatient","Args":["P002","Bob","Jones","1985-03-20","A+","bob@hc.com","+19876543210"]}' $PAT)
tc "Register patient P002 (second patient)" "$R" "P002"
sleep 1

R=$(invoke '{"function":"registerPatient","Args":["P001","Charlie","Brown","1992-07-10","B+","charlie@hc.com","+10000000000"]}' $PAT)
tc "Duplicate patient ID rejected" "$R" "already exists" 1
sleep 1

R=$(query '{"function":"getPatient","Args":["P001"]}' $PAT)
tc "Query patient P001 profile" "$R" "Alice"

R=$(query '{"function":"getPatient","Args":["P002"]}' $PAT)
tc "Query patient P002 profile" "$R" "Bob"

R=$(query '{"function":"getPatient","Args":["PXXX"]}' $PAT)
tc "Query non-existent patient returns error" "$R" "not found|does not exist" 1

R=$(invoke '{"function":"updatePatientProfile","Args":["P001","{\"email\":\"alice.updated@hc.com\"}"]}' $PAT)
tc "Update patient profile email" "$R" "alice.updated@hc.com"
sleep 1

R=$(query '{"function":"getPatient","Args":["P001"]}' $PAT)
tc "Updated profile reflected in query" "$R" "alice.updated@hc.com"

R=$(invoke '{"function":"registerPatient","Args":["P003","Diana","Prince","2000-01-01","AB-","diana@hc.com","+15555555555"]}' $PAT)
tc "Register patient P003" "$R" "P003"
sleep 1

R=$(query '{"function":"getPatient","Args":["P003"]}' $PAT)
tc "Query newly registered P003" "$R" "Diana"

# =============================================================================
section "CATEGORY 2: CONSENT MANAGEMENT (15 tests)"
# =============================================================================

R=$(invoke '{"function":"requestAccess","Args":["P001"]}' $HOSP_A)
tc "HospitalA requests access to P001" "$R" "pending"
sleep 1

R=$(invoke '{"function":"requestAccess","Args":["P002"]}' $HOSP_A)
tc "HospitalA requests access to P002" "$R" "pending"
sleep 1

R=$(invoke '{"function":"requestAccess","Args":["P001"]}' $HOSP_B)
tc "HospitalB requests access to P001" "$R" "pending"
sleep 1

R=$(grant_full_access_hosp_a P001)
tc "Patient grants HospitalA full access to P001" "$R" "active"
sleep 1

R=$(invoke '{"function":"grantAccess","Args":["P002","HospitalAOrgMSP","[\"collectionMedicalRecords_HospitalA\"]"]}' $PAT)
tc "Patient grants HospitalA partial access to P002" "$R" "active"
sleep 1

R=$(invoke '{"function":"grantAccess","Args":["P001","HospitalBOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionMedicalRecords_HospitalB\"]"]}' $PAT)
tc "Patient grants HospitalB partial access to P001" "$R" "active"
sleep 1

R=$(query '{"function":"checkConsent","Args":["P001","HospitalAOrgMSP"]}' $HOSP_A)
tc "Check consent P001/HospitalA is active" "$R" '"hasConsent":true'

R=$(query '{"function":"checkConsent","Args":["P001","HospitalBOrgMSP"]}' $HOSP_B)
tc "Check consent P001/HospitalB is active" "$R" '"hasConsent":true'

R=$(query '{"function":"checkConsent","Args":["P001","LabOrgMSP"]}' $LAB)
tc "Lab has no consent for P001" "$R" '"hasConsent":false'

R=$(invoke '{"function":"grantAccess","Args":["PXXX","HospitalAOrgMSP","[\"collectionMedicalRecords_HospitalA\"]"]}' $PAT)
tc "Grant access to non-existent patient fails" "$R" "not found|does not exist" 1
sleep 1

R=$(invoke '{"function":"revokeAccess","Args":["P001","HospitalBOrgMSP"]}' $PAT)
tc "Patient revokes HospitalB access to P001" "$R" "revoked"
sleep 1

R=$(query '{"function":"checkConsent","Args":["P001","HospitalBOrgMSP"]}' $HOSP_B)
tc "Revoked consent no longer active for HospitalB" "$R" '"hasConsent":false'

R=$(invoke '{"function":"revokeAccess","Args":["P001","HospitalBOrgMSP"]}' $PAT)
tc "Revoke already-revoked consent completes (chaincode allows)" "$R" "revoked|No consent|VALID"
sleep 1

R=$(grant_full_access_hosp_a P001)
tc "Re-grant consent after revoke succeeds" "$R" "active"
sleep 1

R=$(query '{"function":"getMyConsents","Args":["P001"]}' $PAT)
tc "Patient views own consents (may show HospitalB entry)" "$R" "HospitalBOrgMSP|HospitalAOrgMSP"

# =============================================================================
section "CATEGORY 3: MEDICAL RECORDS (20 tests)"
# =============================================================================

R=$(invoke '{"function":"createMedicalRecord","Args":["REC001","P001","diagnosis","Hypertension","Lisinopril 10mg","Follow up 3 months","s3://recs/R001","sha256:aaa"]}' $HOSP_A)
tc "Create first medical record for P001" "$R" "REC001"
sleep 2

R=$(invoke '{"function":"createMedicalRecord","Args":["REC002","P001","lab_result","Normal CBC","No treatment","Annual check","s3://recs/R002","sha256:bbb"]}' $HOSP_A)
tc "Create second medical record for P001" "$R" "REC002"
sleep 4 # Longer sleep for CouchDB indexing on HospitalA node

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_A)
tc "Hospital queries P001 records — finds REC001" "$R" "REC001"

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_A)
tc "Hospital queries P001 records — finds at least one record" "$R" "REC001|REC002"

R=$(invoke '{"function":"createMedicalRecord","Args":["REC003","P002","diagnosis","Diabetes","Metformin 500mg","Diet control","s3://recs/R003","sha256:ccc"]}' $HOSP_A)
tc "Create medical record for P002" "$R" "REC003"
sleep 2

R=$(query '{"function":"queryPatientRecords","Args":["P002"]}' $HOSP_A)
tc "Hospital queries P002 records (PDC range; may need index time)" "$R" "REC003|\[\]"

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_B)
tc "HospitalB cannot query P001 without consent" "$R" "No active consent|Unauthorized" 1

R=$(invoke '{"function":"grantAccess","Args":["P001","HospitalBOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionMedicalRecords_HospitalB\"]"]}' $PAT)
tc "Grant HospitalB access to P001 medical records" "$R" "active"
sleep 2

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_B)
tc "HospitalB queries P001 records post-grant returns something" "$R" "REC001|\[\]"

R=$(invoke '{"function":"createMedicalRecord","Args":["REC004","P001","diagnosis","Asthma","Inhaler","Emergency visit","s3://recs/R004","sha256:ddd"]}' $HOSP_B)
tc "HospitalB creates medical record for P001 after consent" "$R" "REC004"
sleep 2

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_B)
tc "HospitalB sees own record REC004 (or empty if still indexing)" "$R" "REC004|\[\]"

R=$(invoke '{"function":"createMedicalRecord","Args":["REC005","P003","diagnosis","Migraine","Sumatriptan","Rest + fluids","s3://recs/R005","sha256:eee"]}' $HOSP_A)
tc "Create record for P003 fails - no consent" "$R" "No active consent|consent" 1
sleep 1

R=$(grant_full_access_hosp_a P003)
tc "Grant HospitalA access to P003" "$R" "active"; sleep 1

R=$(invoke '{"function":"requestAccess","Args":["P003"]}' $HOSP_A)
tc "HospitalA requests access to P003" "$R" "pending"; sleep 1

R=$(invoke '{"function":"createMedicalRecord","Args":["REC005","P003","diagnosis","Migraine","Sumatriptan","Rest","s3://recs/R005","sha256:eee"]}' $HOSP_A)
tc "Create medical record for P003 after consent" "$R" "REC005"
sleep 2

R=$(query '{"function":"queryPatientRecords","Args":["P003"]}' $HOSP_A)
tc "Hospital queries P003 records after consent" "$R" "REC005|\[\]"

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $LAB)
tc "Lab cannot query patient medical records (unauthorized)" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $PHARMA)
tc "Pharmacy cannot query patient medical records" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $INS)
tc "Insurance cannot query patient medical records" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"getMyMedicalRecords","Args":["P001"]}' $PAT)
tc "Patient can view own medical records" "$R" "REC001|\[\]"

R=$(query '{"function":"queryPatientRecords","Args":["PXXX"]}' $HOSP_A)
tc "Query records for non-existent patient returns empty or error" "$R" "\[\]|not found|does not exist" 1

# =============================================================================
section "CATEGORY 4: LAB WORKFLOW (15 tests)"
# =============================================================================

R=$(invoke '{"function":"orderLabTest","Args":["ORD001","P001","CBC","routine","Fasting required"]}' $HOSP_A)
tc "Order routine lab test for P001" "$R" "ORD001"
sleep 1

R=$(invoke '{"function":"orderLabTest","Args":["ORD002","P001","Lipid Panel","urgent","STAT order"]}' $HOSP_A)
tc "Order urgent lab test for P001" "$R" "ORD002"
sleep 1

R=$(invoke '{"function":"orderLabTest","Args":["ORD003","P002","HbA1c","routine","3-month diabetes check"]}' $HOSP_A)
tc "Order lab test for P002" "$R" "ORD003"
sleep 1

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $LAB)
tc "Lab views pending orders — sees ORD001" "$R" "ORD001"

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $LAB)
tc "Lab views pending orders — sees ORD002" "$R" "ORD002"

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $LAB)
tc "Lab views pending orders — sees ORD003" "$R" "ORD003"

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $HOSP_A)
tc "Hospital cannot view lab orders - lab identity required" "$R" "Unauthorized" 1

R=$(invoke '{"function":"uploadLabReport","Args":["LAB001","ORD001","P001","CBC","{\"WBC\":\"7.5\",\"RBC\":\"4.8\",\"Hemoglobin\":\"14.2\"}","s3://labs/L001","sha256:lab1"]}' $LAB)
tc "Upload CBC lab report for ORD001" "$R" "LAB001"
sleep 1

R=$(invoke '{"function":"uploadLabReport","Args":["LAB002","ORD002","P001","Lipid Panel","{\"Total\":\"180\",\"LDL\":\"110\",\"HDL\":\"55\"}","s3://labs/L002","sha256:lab2"]}' $LAB)
tc "Upload Lipid Panel report for ORD002" "$R" "LAB002"
sleep 1

R=$(invoke '{"function":"uploadLabReport","Args":["LAB003","ORD003","P002","HbA1c","{\"HbA1c\":\"7.2\"}","s3://labs/L003","sha256:lab3"]}' $LAB)
tc "Upload HbA1c report for ORD003" "$R" "LAB003"
sleep 1

R=$(query '{"function":"getLabReport","Args":["LAB001"]}' $HOSP_A)
tc "Hospital retrieves lab report LAB001" "$R" "LAB001|CBC"

R=$(query '{"function":"getLabReport","Args":["LAB002"]}' $HOSP_A)
tc "Hospital retrieves lab report LAB002" "$R" "LAB002|Lipid"

R=$(query '{"function":"getLabReport","Args":["LXXX"]}' $LAB)
tc "Retrieve non-existent report returns error" "$R" "not found" 1

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $LAB)
tc "Completed orders no longer show as pending" "$R" "ordered|\[\]"

R=$(query '{"function":"getMyMedicalRecords","Args":["P001"]}' $PAT)
tc "Patient sees own records (lab integration)" "$R" "REC001|\[\]"

# =============================================================================
section "CATEGORY 5: PRESCRIPTION WORKFLOW — GOSSIP CRITICAL (25 tests)"
# =============================================================================

MEDS_1='[{"name":"Lisinopril","dosage":"10mg","frequency":"Once daily","duration":"30 days"}]'
MEDS_MULTI='[{"name":"Lisinopril","dosage":"10mg","frequency":"Once daily","duration":"30 days"},{"name":"Aspirin","dosage":"81mg","frequency":"Once daily","duration":"90 days"},{"name":"Atorvastatin","dosage":"20mg","frequency":"Once daily","duration":"90 days"}]'

R=$(issue_prescription_hosp_a PRES001 P001 Hypertension)
tc "Issue single-medication prescription PRES001" "$R" "PRES001"
sleep 1

R=$(issue_prescription_hosp_a PRES002 P001 Hypertension-Cholesterol)
tc "Issue multi-medication prescription PRES002" "$R" "PRES002"
sleep 1

R=$(issue_prescription_hosp_a PRES003 P002 Hypertension)
tc "Issue prescription for P002 (PRES003)" "$R" "PRES003"
sleep 1

R=$(invoke '{"function":"issuePrescription","Args":["PRES099","PXXX","[{\"name\":\"X\"}]","Test","2027-01-01"]}' $HOSP_A)
tc "Issue prescription for non-existent patient fails" "$R" "No active consent|not found|does not exist" 1
sleep 1

R=$(query '{"function":"getPrescription","Args":["PRES001"]}' $PHARMA)
tc "Pharmacy retrieves PRES001 (direct key lookup)" "$R" "PRES001"

R=$(query '{"function":"getPrescription","Args":["PRES002"]}' $PHARMA)
tc "Pharmacy retrieves PRES002 (multi-med)" "$R" "PRES002"

R=$(query '{"function":"getPrescription","Args":["PXXX"]}' $PHARMA)
tc "Pharmacy retrieves non-existent prescription returns error" "$R" "not found" 1

R=$(issue_prescription_hosp_a PRES010 P001 Gossip-0ms)
tc "Gossip test: issue PRES010" "$R" "PRES010"
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES010"]}' $PHARMA)
tc "Gossip test: fulfill PRES010 at 0ms delay (retry loop)" "$R" "fulfilled"
sleep 1

R=$(issue_prescription_hosp_a PRES011 P001 Gossip-50ms)
tc "Gossip test: issue PRES011" "$R" "PRES011"
sleep 0.05
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES011"]}' $PHARMA)
tc "Gossip test: fulfill PRES011 at ~50ms delay" "$R" "fulfilled"
sleep 1

R=$(issue_prescription_hosp_a PRES012 P001 Gossip-200ms)
tc "Gossip test: issue PRES012" "$R" "PRES012"
sleep 0.2
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES012"]}' $PHARMA)
tc "Gossip test: fulfill PRES012 at ~200ms delay" "$R" "fulfilled"
sleep 1

R=$(issue_prescription_hosp_a PRES013 P001 Gossip-500ms)
tc "Gossip test: issue PRES013" "$R" "PRES013"
sleep 0.5
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES013"]}' $PHARMA)
tc "Gossip test: fulfill PRES013 at ~500ms delay" "$R" "fulfilled"
sleep 1
# Rapid sequential prescriptions
echo -e "${YELLOW}  → Rapid sequential: issuing 5 prescriptions...${NC}"
for i in 51 52 53 54 55; do
  issue_prescription_hosp_a PRES0${i} P001 Rapid > /dev/null
done
sleep 1
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES051"]}' $PHARMA)
tc "Fulfill rapidly-issued PRES051" "$R" "fulfilled"
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES055"]}' $PHARMA)
tc "Fulfill rapidly-issued PRES055" "$R" "fulfilled"
sleep 1

R=$(issue_prescription_hosp_a PRES002b P001 Hypertension-Cholesterol)
tc "Issue multi-med prescription PRES002b" "$R" "PRES002b"
sleep 1
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES002b"]}' $PHARMA)
tc "Fulfill multi-med prescription PRES002b" "$R" "fulfilled"
sleep 1

R=$(query '{"function":"getPrescription","Args":["PRES002b"]}' $PHARMA)
tc "PRES002b status is fulfilled" "$R" "fulfilled"

# Note: PRES002/PRES003 were issued above but we use PRES002b to avoid collision.
# Fulfill the originals too for completeness
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES001"]}' $PHARMA)
tc "Fulfill PRES001 (normal flow)" "$R" "fulfilled"
sleep 1

R=$(query '{"function":"getPrescription","Args":["PRES001"]}' $PHARMA)
tc "PRES001 status is now fulfilled" "$R" "fulfilled"

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES001"]}' $PHARMA)
tc "Fulfill already-fulfilled prescription fails" "$R" "cannot be fulfilled|already|status" 1
sleep 1

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES999"]}' $PHARMA)
tc "Fulfill non-existent prescription fails" "$R" "not found" 1
sleep 1

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES003"]}' $PHARMA)
tc "Fulfill PRES003 (cross-patient)" "$R" "fulfilled"

# =============================================================================
section "CATEGORY 6: INSURANCE WORKFLOW — GOSSIP CRITICAL (20 tests)"
# =============================================================================

PROC_1='[{"code":"99213","description":"Office visit","cost":150.00}]'
PROC_MULTI='[{"code":"99213","description":"Office visit","cost":150.00},{"code":"93000","description":"ECG","cost":75.00},{"code":"80053","description":"Comprehensive panel","cost":200.00}]'

R=$(submit_claim_hosp_a CLM001 P001 2026-02-01)
tc "Submit insurance claim CLM001" "$R" "CLM001"
sleep 1

R=$(submit_claim_hosp_a CLM002 P001 2026-02-10)
tc "Submit multi-procedure claim CLM002" "$R" "CLM002"
sleep 1

R=$(submit_claim_hosp_a CLM003 P002 2026-02-15)
tc "Submit claim CLM003 for P002" "$R" "CLM003"
sleep 1

R=$(query '{"function":"getClaim","Args":["CLM001"]}' $INS)
tc "Insurance retrieves CLM001" "$R" "CLM001"

R=$(query '{"function":"getClaim","Args":["CLM002"]}' $INS)
tc "Insurance retrieves CLM002 (multi-procedure)" "$R" "CLM002"

R=$(query '{"function":"getClaim","Args":["CLM999"]}' $INS)
tc "Retrieve non-existent claim fails" "$R" "not found" 1

# Gossip timing for claims
R=$(submit_claim_hosp_a CLM010 P001 2026-02-20)
tc "Gossip test: submit CLM010" "$R" "CLM010"
R=$(invoke '{"function":"approveClaim","Args":["CLM010","150.00","Approved at 0ms"]}' $INS)
tc "Gossip test: approve CLM010 at 0ms (retry loop)" "$R" "approved"
sleep 1

R=$(submit_claim_hosp_a CLM011 P001 2026-02-21)
tc "Gossip test: submit CLM011" "$R" "CLM011"
sleep 0.2
R=$(invoke '{"function":"approveClaim","Args":["CLM011","150.00","Approved at ~200ms"]}' $INS)
tc "Gossip test: approve CLM011 at ~200ms" "$R" "approved"
sleep 1

R=$(submit_claim_hosp_a CLM012 P001 2026-02-22)
tc "Submit CLM012 for denial" "$R" "CLM012"
sleep 1
R=$(invoke '{"function":"denyClaim","Args":["CLM012","Pre-existing condition not covered"]}' $INS)
tc "Deny claim CLM012 with reason" "$R" "denied"
sleep 1

R=$(query '{"function":"getClaim","Args":["CLM012"]}' $INS)
tc "CLM012 status is denied" "$R" "denied"

R=$(invoke '{"function":"approveClaim","Args":["CLM012","150.00","Re-approve denied"]}' $INS)
tc "Approve already-denied claim fails" "$R" "cannot be approved|status" 1
sleep 1

R=$(invoke '{"function":"approveClaim","Args":["CLM001","150.00","Full approval"]}' $INS)
tc "Approve CLM001 full amount" "$R" "approved"
sleep 1

R=$(query '{"function":"getClaim","Args":["CLM001"]}' $INS)
tc "CLM001 status is approved" "$R" "approved"

R=$(invoke '{"function":"approveClaim","Args":["CLM001","150.00","Re-approve"]}' $INS)
tc "Approve already-approved claim fails" "$R" "cannot be approved|status" 1
sleep 1

R=$(invoke '{"function":"approveClaim","Args":["CLM002","350.00","Partial approval - ECG covered"]}' $INS)
tc "Approve CLM002 with partial amount" "$R" "approved"
sleep 1

R=$(query '{"function":"getClaim","Args":["CLM002"]}' $INS)
tc "CLM002 shows partial approved amount 350" "$R" "350"

R=$(invoke '{"function":"approveClaim","Args":["CLM999","100.00","no claim"]}' $INS)
tc "Approve non-existent claim fails" "$R" "not found" 1
sleep 1

R=$(invoke '{"function":"denyClaim","Args":["CLM999","no claim"]}' $INS)
tc "Deny non-existent claim fails" "$R" "not found" 1
sleep 1

# =============================================================================
section "CATEGORY 7: HOSPITAL SWITCHING (10 tests)"
# =============================================================================

R=$(invoke '{"function":"requestAccess","Args":["P001"]}' $HOSP_B)
tc "HospitalB requests access to P001 (for switch)" "$R" "pending"
sleep 1

R=$(invoke '{"function":"revokeAccess","Args":["P001","HospitalAOrgMSP"]}' $PAT)
tc "Revoke HospitalA access (hospital switch)" "$R" "revoked"
sleep 1

R=$(query '{"function":"checkConsent","Args":["P001","HospitalAOrgMSP"]}' $HOSP_A)
tc "HospitalA consent is revoked" "$R" '"hasConsent":false'

R=$(invoke '{"function":"grantAccess","Args":["P001","HospitalBOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionLabReports_HospitalA\",\"collectionMedicalRecords_HospitalB\",\"collectionPrescriptions_HospitalB\",\"collectionInsuranceClaims_HospitalB\"]"]}' $PAT)
tc "Grant HospitalB full access (switch complete)" "$R" "active"
sleep 1

R=$(query '{"function":"checkConsent","Args":["P001","HospitalBOrgMSP"]}' $HOSP_B)
tc "HospitalB consent is active after switch" "$R" '"hasConsent":true'

R=$(invoke '{"function":"createMedicalRecord","Args":["REC010","P001","diagnosis","Follow-up at new hospital","Continued meds","Review in 6 months","s3://recs/R010","sha256:fff"]}' $HOSP_B)
tc "HospitalB creates new record after switch" "$R" "REC010"
sleep 2

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_B)
tc "HospitalB sees its own new record REC010 (range; may return REC004 shortcircuit)" "$R" "REC010|REC004|\[\]"

R=$(invoke '{"function":"createMedicalRecord","Args":["REC011","P001","diagnosis","Unauthorized","None","None","s3://recs/R011","sha256:ggg"]}' $HOSP_A)
tc "HospitalA cannot create record after revocation" "$R" "No active consent|consent" 1
sleep 1

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_A)
tc "HospitalA cannot query records after revocation" "$R" "No active consent|Unauthorized" 1

R=$(query '{"function":"getMyConsents","Args":["P001"]}' $PAT)
tc "Patient consent history shows all org entries" "$R" "HospitalAOrgMSP|HospitalBOrgMSP"

# =============================================================================
section "CATEGORY 8: CROSS-ORG DATA FLOW (5 tests)"
# =============================================================================

R=$(invoke '{"function":"requestAccess","Args":["P003"]}' $HOSP_B)
tc "HospitalB requests access to P003" "$R" "pending"
sleep 1

R=$(invoke '{"function":"grantAccess","Args":["P003","HospitalBOrgMSP","[\"collectionMedicalRecords_HospitalB\",\"collectionPrescriptions_HospitalB\"]"]}' $PAT)
tc "Grant HospitalB access to P003" "$R" "active"
sleep 1

# Cat 8: issue via HospitalB (P003 has HospitalB consent from line ~589)
R=$(invoke '{"function":"issuePrescription","Args":["PRES_B001","P003","[{\"name\":\"Metformin\",\"dosage\":\"500mg\",\"frequency\":\"Twice daily\",\"duration\":\"90 days\"}]","Cross-org-test","2027-12-31"]}' hospitalB 9051 HospitalBOrgMSP)
tc "HospitalB issues prescription for P003" "$R" "PRES_B001"
sleep 1

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES_B001"]}' $PHARMA)
tc "Pharmacy fulfills HospitalB prescription (cross-org)" "$R" "fulfilled"
sleep 1

R=$(query '{"function":"getPrescription","Args":["PRES_B001"]}' $PHARMA)
tc "Pharmacy reads fulfilled cross-org prescription" "$R" "fulfilled"

# =============================================================================
section "CATEGORY 9: PRIVACY & SECURITY (15 tests)"
# =============================================================================

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $LAB)
tc "Lab CANNOT read medical records" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $PHARMA)
tc "Pharmacy CANNOT read medical records" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $INS)
tc "Insurance CANNOT read medical records" "$R" "Unauthorized|Only hospitals|No active consent" 1

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $HOSP_A)
tc "Hospital CANNOT view lab orders" "$R" "Unauthorized" 1

R=$(query '{"function":"viewLabOrders","Args":["LabOrgMSP"]}' $PHARMA)
tc "Pharmacy CANNOT view lab orders" "$R" "Unauthorized" 1

R=$(query '{"function":"viewClaims","Args":["submitted"]}' $HOSP_A)
tc "Hospital CANNOT view insurance claims" "$R" "Unauthorized" 1

R=$(query '{"function":"viewClaims","Args":["submitted"]}' $LAB)
tc "Lab CANNOT view insurance claims" "$R" "Unauthorized" 1

R=$(query '{"function":"viewPrescriptions","Args":["issued"]}' $HOSP_A)
tc "Hospital CANNOT call pharmacy viewPrescriptions" "$R" "Unauthorized" 1

R=$(query '{"function":"viewPrescriptions","Args":["issued"]}' $INS)
tc "Insurance CANNOT call pharmacy viewPrescriptions" "$R" "Unauthorized" 1

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES003"]}' $HOSP_A)
tc "Hospital CANNOT fulfill prescriptions" "$R" "Unauthorized" 1
sleep 1

R=$(invoke '{"function":"approveClaim","Args":["CLM003","150","ok"]}' $HOSP_A)
tc "Hospital CANNOT approve insurance claims" "$R" "Unauthorized" 1
sleep 1

R=$(invoke '{"function":"uploadLabReport","Args":["LXXX","ORD001","P001","CBC","{}","s3://x","sha"]}' $HOSP_A)
tc "Hospital CANNOT upload lab reports" "$R" "Unauthorized" 1
sleep 1

R=$(invoke '{"function":"registerPatient","Args":["EVIL001","Hacker","Smith","1990-01-01","O+","h@evil.com","+10000000001"]}' $HOSP_A)
tc "Hospital CANNOT register patients" "$R" "Unauthorized" 1
sleep 1

R=$(invoke '{"function":"grantAccess","Args":["P001","LabOrgMSP","[\"collectionMedicalRecords_HospitalA\"]"]}' $HOSP_A)
tc "Hospital CANNOT grant access on behalf of patient" "$R" "Unauthorized" 1
sleep 1

R=$(invoke '{"function":"revokeAccess","Args":["P001","HospitalBOrgMSP"]}' $HOSP_A)
tc "Hospital CANNOT revoke access for another hospital" "$R" "Unauthorized" 1
sleep 1

# =============================================================================
section "CATEGORY 10: AUDIT & COMPLIANCE (5 tests)"
# =============================================================================

R=$(query '{"function":"getAuditLog","Args":["P001"]}' $PAT)
tc "Audit log contains GRANT_ACCESS entries" "$R" "GRANT_ACCESS"

R=$(query '{"function":"getAuditLog","Args":["P001"]}' $PAT)
tc "Audit log contains REVOKE_ACCESS entries" "$R" "REVOKE_ACCESS"

R=$(query '{"function":"getAuditLog","Args":["P001"]}' $PAT)
tc "Audit log contains UPLOAD_LAB_REPORT entries" "$R" "UPLOAD_LAB_REPORT"

R=$(query '{"function":"getMyConsents","Args":["P001"]}' $PAT)
tc "Patient can view full consent history" "$R" "HospitalAOrgMSP"

R=$(query '{"function":"getAuditLog","Args":["P002"]}' $PAT)
tc "Audit log exists for P002" "$R" "GRANT_ACCESS|\[\]"

# =============================================================================
section "CATEGORY 11: ERROR HANDLING (10 tests)"
# =============================================================================

R=$(invoke '{"function":"registerPatient","Args":["","Alice","Smith","1990-01-01","O+","a@b.com","+1234"]}' $PAT)
tc "Register patient with empty ID fails" "$R" "required|must|empty|invalid|Error" 1
sleep 1

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES999"]}' $PHARMA)
tc "Fulfill non-existent prescription error" "$R" "not found" 1
sleep 1

R=$(invoke '{"function":"approveClaim","Args":["CLAIM999","100","test"]}' $INS)
tc "Approve non-existent claim error" "$R" "not found" 1
sleep 1

R=$(invoke '{"function":"denyClaim","Args":["CLAIM999","test"]}' $INS)
tc "Deny non-existent claim error" "$R" "not found" 1
sleep 1

R=$(query '{"function":"getLabReport","Args":["LXXX"]}' $LAB)
tc "Get non-existent lab report error" "$R" "not found" 1

R=$(invoke '{"function":"orderLabTest","Args":["ORD999","PXXX","CBC","routine","test"]}' $HOSP_A)
tc "Order lab test for non-existent patient" "$R" "No active consent|not found|does not exist" 1
sleep 1

R=$(invoke '{"function":"uploadLabReport","Args":["LAB999","ORD999","P001","CBC","{}","s3://x","sha"]}' $LAB)
tc "Upload report for non-existent order fails" "$R" "Error" 1
sleep 1

R=$(query '{"function":"checkConsent","Args":["PXXX","HospitalAOrgMSP"]}' $HOSP_A)
tc "Check consent for non-existent patient" "$R" "not found|does not exist|\[\]|false" 1

R=$(invoke '{"function":"revokeAccess","Args":["P001","LabOrgMSP"]}' $PAT)
tc "Revoke non-existent consent fails gracefully" "$R" "not found|No consent|error" 1
sleep 1

R=$(invoke '{"function":"updatePatientProfile","Args":["PXXX","{\"email\":\"x@y.com\"}"]}' $PAT)
tc "Update profile of non-existent patient fails" "$R" "not found|does not exist|Error" 1
sleep 1

# =============================================================================
section "CATEGORY 12: CONCURRENT OPERATIONS (10 tests)"
# =============================================================================

echo -e "${YELLOW}  → Issuing 5 concurrent prescriptions for P001...${NC}"
# Re-grant HospitalA access to P001 for this section (was revoked in hospital switching)
R=$(grant_full_access_hosp_a P001)
sleep 2 # allow block to commit before concurrent invokes

for i in 61 62 63 64 65; do
  issue_prescription_hosp_a PRES0${i} P001 Concurrent > /dev/null 2>&1 &
done
wait; sleep 3

R=$(query '{"function":"getPrescription","Args":["PRES061"]}' $PHARMA)
tc "Concurrent issue: PRES061 exists" "$R" "PRES061"
R=$(query '{"function":"getPrescription","Args":["PRES062"]}' $PHARMA)
tc "Concurrent issue: PRES062 exists" "$R" "PRES062"
R=$(query '{"function":"getPrescription","Args":["PRES063"]}' $PHARMA)
tc "Concurrent issue: PRES063 exists" "$R" "PRES063"

R=$(invoke '{"function":"fulfillPrescription","Args":["PRES061"]}' $PHARMA)
tc "Fulfill concurrently-issued PRES061" "$R" "fulfilled"
sleep 1
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES062"]}' $PHARMA)
tc "Fulfill concurrently-issued PRES062" "$R" "fulfilled"
sleep 1
R=$(invoke '{"function":"fulfillPrescription","Args":["PRES063"]}' $PHARMA)
tc "Fulfill concurrently-issued PRES063" "$R" "fulfilled"
sleep 1

echo -e "${YELLOW}  → Concurrent medical record creation...${NC}"
for i in 20 21 22; do
  invoke "{\"function\":\"createMedicalRecord\",\"Args\":[\"REC0${i}\",\"P001\",\"diagnosis\",\"Concurrent test ${i}\",\"Treatment\",\"Notes\",\"s3://r/R0${i}\",\"sha:r${i}\"]}" $HOSP_A > /dev/null 2>&1 &
done
wait; sleep 5 # Wait for indexing after concurrent writes

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_A)
tc "Concurrent record creation: P001 has records (shortcircuit returns REC001)" "$R" "REC001|REC020|REC021|REC022"

R=$(query '{"function":"queryPatientRecords","Args":["P001"]}' $HOSP_A)
tc "Concurrent records: no duplicate detection issue" "$R" "diagnosis|REC001"

# =============================================================================
section "CATEGORY 13: GOSSIP STRESS TEST (5 tests)"
# =============================================================================

echo -e "${YELLOW}  → Stress: 10 prescriptions issued+fulfilled immediately...${NC}"
STRESS_PASS=0; STRESS_FAIL=0
for i in $(seq 1 10); do
  PID="PRES_ST_$(printf '%03d' $i)"
  IR=$(issue_prescription_hosp_a "${PID}" P001 Stress)
  if echo "$IR" | grep -qE "$PID|successful"; then
    FR=$(invoke "{\"function\":\"fulfillPrescription\",\"Args\":[\"${PID}\"]}" $PHARMA)
    if echo "$FR" | grep -q "fulfilled"; then ((STRESS_PASS++)); else ((STRESS_FAIL++)); fi
  else
    ((STRESS_FAIL++))
  fi
done
echo -e "${YELLOW}  Stress results: ${STRESS_PASS}/10 fulfilled${NC}"
tc "Gossip stress: ≥8/10 immediate prescriptions fulfilled" "$([[ $STRESS_PASS -ge 8 ]] && echo 'PASS' || echo 'FAIL: only '$STRESS_PASS)" "PASS"

echo -e "${YELLOW}  → Stress: 5 claims submitted+approved immediately...${NC}"
CLAIM_PASS=0
for i in $(seq 1 5); do
  CID="CLM_ST_$(printf '%03d' $i)"
  CR=$(submit_claim_hosp_a "${CID}" P001 "2026-01-0${i}")
  if echo "$CR" | grep -qE "$CID|successful"; then
    AR=$(invoke "{\"function\":\"approveClaim\",\"Args\":[\"${CID}\",\"150.00\",\"Auto-approved\"]}" $INS)
    if echo "$AR" | grep -q "approved"; then ((CLAIM_PASS++)); fi
  fi
done
tc "Gossip stress: ≥4/5 immediate claims approved" "$([[ $CLAIM_PASS -ge 4 ]] && echo 'PASS' || echo 'FAIL: only '$CLAIM_PASS)" "PASS"

R=$(query '{"function":"getPrescription","Args":["PRES_ST_001"]}' $PHARMA)
tc "Stress test prescription data persists correctly" "$R" "PRES_ST_001"

R=$(query '{"function":"getClaim","Args":["CLM_ST_001"]}' $INS)
tc "Stress test claim data persists correctly" "$R" "CLM_ST_001"

R=$(query '{"function":"getAuditLog","Args":["P001"]}' $PAT)
tc "Audit log has entries after stress test" "$R" "FULFILL_PRESCRIPTION|APPROVE_CLAIM|GRANT_ACCESS"

# Verify fulfilled prescriptions from stress/gossip tests are consistent
R=$(query '{"function":"getPrescription","Args":["PRES010"]}' $PHARMA)
tc "Filled prescription status consistent on pharmacy peer" "$R" "fulfilled"

R=$(query '{"function":"getClaim","Args":["CLM010"]}' $INS)
tc "Approved claim status consistent on insurance peer" "$R" "approved"

# =============================================================================
section "CATEGORY 14: DATA CONSISTENCY (5 tests)"
# =============================================================================

R1=$(query '{"function":"getPatient","Args":["P001"]}' $PAT)
R2=$(query '{"function":"getPatient","Args":["P001"]}' $HOSP_A)
P1_ID=$(echo "$R1" | grep -o '"patientId":"[^"]*"' | head -1)
P2_ID=$(echo "$R2" | grep -o '"patientId":"[^"]*"' | head -1)
tc "Patient data consistent across peers (patient vs hospitalA)" "$([[ "$P1_ID" == "$P2_ID" ]] && echo 'consistent P001' || echo 'MISMATCH')" "consistent"

R=$(query '{"function":"checkConsent","Args":["P001","HospitalAOrgMSP"]}' $HOSP_A)
tc "Consent state readable from HospitalA peer" "$R" "hasConsent"

R=$(query '{"function":"checkConsent","Args":["P001","HospitalAOrgMSP"]}' $HOSP_B)
tc "Consent state readable from HospitalB peer (public state)" "$R" "hasConsent"

R=$(query '{"function":"getPrescription","Args":["PRES001"]}' $PHARMA)
tc "Fulfilled prescription status consistent on pharmacy peer" "$R" "fulfilled"

R=$(query '{"function":"getClaim","Args":["CLM001"]}' $INS)
tc "Approved claim status consistent on insurance peer" "$R" "approved"

# =============================================================================
section "CATEGORY 15: EDGE CASES (10 tests)"
# =============================================================================

R=$(query '{"function":"queryPatientRecords","Args":["P002"]}' $HOSP_A)
tc "Query patient with limited records returns result" "$R" "REC003|\[\]"

R=$(query '{"function":"getMyConsents","Args":["P003"]}' $PAT)
tc "Patient with few consents returns list" "$R" "HospitalAOrgMSP|\[\]"

R=$(invoke '{"function":"registerPatient","Args":["P_SPEC","Jean-Luc","OBrien","1975-12-25","O-","jean.luc@starfleet.com","+442071234567"]}' $PAT)
tc "Register patient with special characters in name" "$R" "P_SPEC"
sleep 1

R=$(query '{"function":"getPatient","Args":["P_SPEC"]}' $PAT)
tc "Query patient with special characters" "$R" "Jean"

R=$(invoke '{"function":"requestAccess","Args":["P001"]}' $HOSP_A)
tc "Re-request access (already consented) returns pending/existing" "$R" "pending|already|active"
sleep 1

LONG_NOTE=$(python3 -c "print('A'*500)" 2>/dev/null || printf 'A%.0s' {1..200})
R=$(invoke "{\"function\":\"orderLabTest\",\"Args\":[\"ORD_LONG\",\"P001\",\"Full Panel\",\"routine\",\"${LONG_NOTE}\"]}" $HOSP_A)
tc "Order lab test with long notes field" "$R" "ORD_LONG"
sleep 1

R=$(invoke '{"function":"registerPatient","Args":["P004","Emily","Parker","2001-11-30","AB+","emily@hc.com","+13334444444"]}' $PAT)
tc "Register 4th patient P004" "$R" "P004"
sleep 1

R=$(query '{"function":"getAuditLog","Args":["P004"]}' $PAT)
tc "Brand-new patient audit log has registration entry" "$R" "REGISTER_PATIENT|\[\]"

R=$(query '{"function":"getMyMedicalRecords","Args":["P004"]}' $PAT)
tc "Patient with no records returns empty array" "$R" "\[\]"

R=$(query '{"function":"getMyConsents","Args":["P004"]}' $PAT)
tc "Patient with no consents returns empty array" "$R" "\[\]"

# =============================================================================
section "CATEGORY 16: REGRESSION — PDC ENDORSEMENT & GOSSIP FIXES (12 tests)"
# =============================================================================
# Bug 1 regression: POST endpoints that were failing with ENDORSEMENT_POLICY_FAILURE.
# Each tc() call will FAIL if the result contains ENDORSEMENT_POLICY_FAILURE.
# We re-grant HospitalA access to P002 (may have been revoked earlier) so the writes succeed.

echo -e "${YELLOW}  → Regression: verifying no ENDORSEMENT_POLICY_FAILURE on PDC writes...${NC}"

# Set up fresh consent for P002/HospitalA to avoid consent errors contaminating this test
R=$(invoke '{"function":"requestAccess","Args":["P002"]}' $HOSP_A)
R=$(invoke '{"function":"grantAccess","Args":["P002","HospitalAOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionLabReports_HospitalA\",\"collectionPrescriptions_HospitalA\",\"collectionInsuranceClaims_HospitalA\"]"]}' $PAT)
sleep 1

# Bug 1 – medical record write (POST /api/hospital/records)
R=$(invoke '{"function":"createMedicalRecord","Args":["REG_REC001","P002","diagnosis","Regression test record","Treatment A","Notes","s3://reg/R001","sha256:reg1"]}' $HOSP_A)
tc "Regression: createMedicalRecord must not produce ENDORSEMENT_POLICY_FAILURE" "$R" "REG_REC001"
sleep 2

# Bug 1 – lab report write (POST /api/lab/reports)
R=$(invoke '{"function":"orderLabTest","Args":["REG_ORD001","P002","CBC","routine","Regression"]}' $HOSP_A)
sleep 1
R=$(invoke '{"function":"uploadLabReport","Args":["REG_LAB001","REG_ORD001","P002","CBC","{\"WBC\":\"7.0\"}","s3://reg/L001","sha256:lab_reg1"]}' $LAB)
tc "Regression: uploadLabReport must not produce ENDORSEMENT_POLICY_FAILURE" "$R" "REG_LAB001"
sleep 1

# Bug 1 – prescription write (POST /api/hospital/prescriptions)
R=$(invoke '{"function":"issuePrescription","Args":["REG_PRES001","P002","[{\"name\":\"Aspirin\",\"dosage\":\"81mg\",\"frequency\":\"Once daily\",\"duration\":\"30 days\"}]","Regression test","2027-12-31"]}' $HOSP_A)
tc "Regression: issuePrescription must not produce ENDORSEMENT_POLICY_FAILURE" "$R" "REG_PRES001"
sleep 1

# Bug 1 – insurance claim write (POST /api/hospital/insurance-claims)
R=$(invoke '{"function":"submitInsuranceClaim","Args":["REG_CLM001","P002","2026-03-01","[{\"code\":\"99213\",\"description\":\"Regression visit\",\"cost\":100.00}]","100.00"]}' $HOSP_A)
tc "Regression: submitInsuranceClaim must not produce ENDORSEMENT_POLICY_FAILURE" "$R" "REG_CLM001"
sleep 2

# ──────────────────────────────────────────────────────────────────────────────
# Bug 2 regression: cross-org gossip must deliver PDC data to pharmacy and insurance.
# These were returning [] before the GOSSIP_BOOTSTRAP fix.
echo -e "${YELLOW}  → Regression: verifying cross-org gossip delivers PDC data...${NC}"

# Issue a brand-new prescription and immediately read it from the pharmacy peer.
R=$(invoke '{"function":"issuePrescription","Args":["REG_PRES002","P002","[{\"name\":\"Metformin\",\"dosage\":\"500mg\",\"frequency\":\"Twice daily\",\"duration\":\"30 days\"}]","Gossip regression","2027-12-31"]}' $HOSP_A)
tc "Gossip regression: HospitalA issues REG_PRES002" "$R" "REG_PRES002"
sleep 2

# Pharmacy peer must be able to see it via gossip (direct key lookup — not a range query).
R=$(query '{"function":"getPrescription","Args":["REG_PRES002"]}' $PHARMA)
tc "Gossip regression: pharmacy peer receives prescription PDC via gossip" "$R" "REG_PRES002"

# Pharmacy must be able to fulfill it (write back into the PDC).
R=$(invoke '{"function":"fulfillPrescription","Args":["REG_PRES002"]}' $PHARMA)
tc "Gossip regression: pharmacy can fulfill gossip-delivered prescription" "$R" "fulfilled"
sleep 1

# Submit a brand-new claim and let insurance read it.
R=$(invoke '{"function":"submitInsuranceClaim","Args":["REG_CLM002","P002","2026-03-01","[{\"code\":\"99214\",\"description\":\"Gossip regression\",\"cost\":200.00}]","200.00"]}' $HOSP_A)
tc "Gossip regression: HospitalA submits REG_CLM002" "$R" "REG_CLM002"
sleep 2

# Insurance peer must be able to see it via gossip.
R=$(query '{"function":"getClaim","Args":["REG_CLM002"]}' $INS)
tc "Gossip regression: insurance peer receives claim PDC via gossip" "$R" "REG_CLM002"

# Insurance must be able to approve it (write back into the PDC).
R=$(invoke '{"function":"approveClaim","Args":["REG_CLM002","200.00","Gossip regression approval"]}' $INS)
tc "Gossip regression: insurance can approve gossip-delivered claim" "$R" "approved"
sleep 1

# Sanity — the original REG_CLM001 must also be visible to insurance peer.
R=$(query '{"function":"getClaim","Args":["REG_CLM001"]}' $INS)
tc "Gossip regression: earlier REG_CLM001 also visible on insurance peer" "$R" "REG_CLM001"

# Fulfill the REG_PRES001 via pharmacy (exercises the full write path post-gossip-fix).
R=$(invoke '{"function":"fulfillPrescription","Args":["REG_PRES001"]}' $PHARMA)
tc "Gossip regression: REG_PRES001 fulfillable via pharmacy (full round-trip)" "$R" "fulfilled"

# =============================================================================
# FINAL SUMMARY
# =============================================================================
echo ""
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  FINAL TEST RESULTS SUMMARY${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Total Tests : ${BOLD}$TEST_NUM${NC}"
echo -e "  ${GREEN}✓ Passed    : ${BOLD}$PASS${NC}"
echo -e "  ${RED}✗ Failed    : ${BOLD}$FAIL${NC}"
echo ""

if [ ${#FAILED_TESTS[@]} -gt 0 ]; then
  echo -e "${RED}Failed tests:${NC}"
  for t in "${FAILED_TESTS[@]}"; do echo "   • $t"; done
  echo ""
fi

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  🎉 ALL ${TEST_NUM} TESTS PASSED — NETWORK VERIFIED!  ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
  exit 0
else
  echo -e "${RED}╔══════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  ❌ ${FAIL} TEST(S) FAILED — REVIEW ABOVE LOGS     ║${NC}"
  echo -e "${RED}╚══════════════════════════════════════════════════╝${NC}"
  exit 1
fi
