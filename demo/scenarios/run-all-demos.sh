
# Resolve script directory to handle running from any location
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(dirname "$(dirname "$SCRIPT_DIR")")

export PATH=${PROJECT_ROOT}/network/scripts:${PROJECT_ROOT}/network/bin:${PROJECT_ROOT}/bin:$PATH
export FABRIC_CFG_PATH=${PROJECT_ROOT}/network/config

CHANNEL_NAME="healthchain-channel"
CC_NAME="healthchain"

# Helper function to invoke chaincode (targets ALL peers to satisfy endorsement policy)
# Helper function to invoke chaincode (targets specified peers or ALL by default)
invokeChaincode() {
  local FUNCTION=$1
  local ARGS=$2
  local ORG=$3
  local PORT=$4
  local MSP_ID=$5
  local TARGETS=$6 # Optional: specific orgs (e.g., "pharmacy hospitalA")
  
  # Configure CLI client identity
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="${MSP_ID}"
  export CORE_PEER_TLS_ROOTCERT_FILE=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/peers/peer0.${ORG}.healthchain.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=${PROJECT_ROOT}/network/organizations/peerOrganizations/${ORG}.healthchain.com/users/Admin@${ORG}.healthchain.com/msp
  export CORE_PEER_ADDRESS=localhost:${PORT}
  export ORDERER_CA=${PROJECT_ROOT}/network/organizations/ordererOrganizations/orderer.healthchain.com/orderers/orderer.orderer.healthchain.com/msp/tlscacerts/tlsca.orderer.healthchain.com-cert.pem

  # Base connection parameters
  local PEER_CONN_PARMS="-o localhost:7050 --ordererTLSHostnameOverride orderer.orderer.healthchain.com --tls --cafile ${ORDERER_CA}"

  # Define peer connection details
  local PATIENT_PEER="--peerAddresses localhost:7051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt"
  local HOSPA_PEER="--peerAddresses localhost:8051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/hospitalA.healthchain.com/peers/peer0.hospitalA.healthchain.com/tls/ca.crt"
  local HOSPB_PEER="--peerAddresses localhost:9051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/hospitalB.healthchain.com/peers/peer0.hospitalB.healthchain.com/tls/ca.crt"
  local LAB_PEER="--peerAddresses localhost:10051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/lab.healthchain.com/peers/peer0.lab.healthchain.com/tls/ca.crt"
  local PHARMACY_PEER="--peerAddresses localhost:11051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/pharmacy.healthchain.com/peers/peer0.pharmacy.healthchain.com/tls/ca.crt"
  local INSURANCE_PEER="--peerAddresses localhost:12051 --tlsRootCertFiles ${PROJECT_ROOT}/network/organizations/peerOrganizations/insurance.healthchain.com/peers/peer0.insurance.healthchain.com/tls/ca.crt"

  if [ -z "$TARGETS" ]; then
    # Target ALL peers
    PEER_CONN_PARMS="$PEER_CONN_PARMS $PATIENT_PEER $HOSPA_PEER $HOSPB_PEER $LAB_PEER $PHARMACY_PEER $INSURANCE_PEER"
  else
    # Target specific peers
    for TARGET in $TARGETS; do
      case $TARGET in
        "patient") PEER_CONN_PARMS="$PEER_CONN_PARMS $PATIENT_PEER" ;;
        "hospitalA") PEER_CONN_PARMS="$PEER_CONN_PARMS $HOSPA_PEER" ;;
        "hospitalB") PEER_CONN_PARMS="$PEER_CONN_PARMS $HOSPB_PEER" ;;
        "lab") PEER_CONN_PARMS="$PEER_CONN_PARMS $LAB_PEER" ;;
        "pharmacy") PEER_CONN_PARMS="$PEER_CONN_PARMS $PHARMACY_PEER" ;;
        "insurance") PEER_CONN_PARMS="$PEER_CONN_PARMS $INSURANCE_PEER" ;;
      esac
    done
  fi
   
  peer chaincode invoke \
    $PEER_CONN_PARMS \
    -C ${CHANNEL_NAME} \
    -n ${CC_NAME} \
    -c "{\"function\":\"${FUNCTION}\",\"Args\":[${ARGS}]}"
}

# Helper function to query chaincode
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

echo "========================================="
echo "   HEALTHCHAIN BLOCKCHAIN DEMO"
echo "========================================="
echo ""

# Scenario 1: Patient Registration
echo "📋 SCENARIO 1: Patient Registration"
echo "-----------------------------------"
echo "Registering patient Alice..."

invokeChaincode \
  "registerPatient" \
  '"PAT001","Alice","Smith","1990-05-15","O+","alice@email.com","+1234567890"' \
  "patient" "7051" "PatientOrgMSP"

sleep 3

echo "✅ Patient registered: PAT001 (Alice Smith)"
echo ""
echo "Querying patient data..."
queryChaincode "getPatient" '"PAT001"' "patient" "7051" "PatientOrgMSP"
echo ""
sleep 2

# Scenario 2: First Hospital Visit (Hospital A)
echo "📋 SCENARIO 2: First Hospital Visit (Hospital A)"
echo "------------------------------------------------"
echo "Hospital A requesting access..."

invokeChaincode \
  "requestAccess" \
  '"PAT001"' \
  "hospitalA" "8051" "HospitalAOrgMSP"

sleep 3

echo "✅ Access requested by Hospital A"
echo ""
echo "Patient Alice granting access to Hospital A..."

# Grant access with Hospital A's PDCs
invokeChaincode \
  "grantAccess" \
  '"PAT001","HospitalAOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionLabReports_HospitalA\",\"collectionPrescriptions_HospitalA\"]"' \
  "patient" "7051" "PatientOrgMSP"

sleep 3

echo "✅ Access granted to Hospital A"
echo ""
echo "Checking consent..."
queryChaincode "checkConsent" '"PAT001","HospitalAOrgMSP"' "hospitalA" "8051" "HospitalAOrgMSP"
echo ""
sleep 2

# Scenario 3: Medical Record Creation
echo "📋 SCENARIO 3: Medical Record Creation"
echo "--------------------------------------"
echo "Doctor at Hospital A creating medical record..."

invokeChaincode \
  "createMedicalRecord" \
  '"REC001","PAT001","diagnosis","Hypertension","Prescribed Lisinopril 10mg","Follow-up in 3 months","patients/PAT001/records/REC001.pdf","sha256:abc123"' \
  "hospitalA" "8051" "HospitalAOrgMSP"

sleep 3

echo "✅ Medical record created: REC001"
echo ""
echo "Hospital A querying patient records..."
queryChaincode "queryPatientRecords" '"PAT001"' "hospitalA" "8051" "HospitalAOrgMSP"
echo ""
sleep 2

# Scenario 4: Lab Test
echo "📋 SCENARIO 4: Lab Test Order and Report"
echo "----------------------------------------"
echo "Doctor ordering blood test..."

invokeChaincode \
  "orderLabTest" \
  '"ORDER001","PAT001","Blood Test - Complete Panel","routine","Fasting required"' \
  "hospitalA" "8051" "HospitalAOrgMSP"

sleep 3

echo "✅ Lab test ordered: ORDER001"
echo ""
echo "Lab viewing pending orders..."
queryChaincode "viewLabOrders" '"LabOrgMSP"' "lab" "10051" "LabOrgMSP"
echo ""
sleep 2

echo "Lab uploading test results..."

invokeChaincode \
  "uploadLabReport" \
  '"LAB001","ORDER001","PAT001","Blood Test - Complete Panel","{\"WBC\":\"7.5\",\"RBC\":\"4.8\",\"glucose\":\"95\"}","labs/PAT001/LAB001.pdf","sha256:def456"' \
  "lab" "10051" "LabOrgMSP"

sleep 3

echo "✅ Lab report uploaded: LAB001"
echo ""
sleep 2

# Scenario 5: Prescription
echo "📋 SCENARIO 5: Prescription Issuance"
echo "------------------------------------"
echo "Doctor issuing prescription..."

invokeChaincode \
  "issuePrescription" \
  '"PRES001","PAT001","[{\"name\":\"Lisinopril\",\"dosage\":\"10mg\",\"frequency\":\"Once daily\",\"duration\":\"30 days\"}]","Hypertension","2026-03-01"' \
  "hospitalA" "8051" "HospitalAOrgMSP"

sleep 3

echo "✅ Prescription issued: PRES001"
echo ""
echo "Pharmacy viewing prescriptions..."
queryChaincode "viewPrescriptions" '"issued"' "pharmacy" "11051" "PharmacyOrgMSP"
echo ""
sleep 2

echo "Pharmacy fulfilling prescription..."

invokeChaincode \
  "fulfillPrescription" \
  '"PRES001"' \
  "pharmacy" "11051" "PharmacyOrgMSP" "pharmacy hospitalA"

sleep 3

echo "✅ Prescription fulfilled"
echo ""
sleep 2

# Scenario 6: Insurance Claim
echo "📋 SCENARIO 6: Insurance Claim Submission"
echo "-----------------------------------------"
echo "Hospital A submitting insurance claim..."

invokeChaincode \
  "submitInsuranceClaim" \
  '"CLAIM001","PAT001","2026-02-01","[{\"code\":\"99213\",\"description\":\"Office visit\",\"cost\":150.00}]","150.00"' \
  "hospitalA" "8051" "HospitalAOrgMSP"

sleep 3

echo "✅ Claim submitted: CLAIM001"
echo ""
echo "Insurance viewing pending claims..."
queryChaincode "viewClaims" '"submitted"' "insurance" "12051" "InsuranceOrgMSP"
echo ""
sleep 2

echo "Insurance approving claim..."

invokeChaincode \
  "approveClaim" \
  '"CLAIM001","150.00","Standard office visit approved"' \
  "insurance" "12051" "InsuranceOrgMSP" "insurance hospitalA"

sleep 3

echo "✅ Claim approved"
echo ""
sleep 2

# Scenario 7: Patient Views Own Records
echo "📋 SCENARIO 7: Patient Viewing Own Records"
echo "------------------------------------------"
echo "Alice querying her own medical records..."

queryChaincode "getMyMedicalRecords" '"PAT001"' "patient" "7051" "PatientOrgMSP"
echo ""
sleep 2

echo "Alice viewing consent history..."
queryChaincode "getMyConsents" '"PAT001"' "patient" "7051" "PatientOrgMSP"
echo ""
sleep 2

# Scenario 8: HERO FLOW - Hospital Switch
echo "📋 SCENARIO 8: HOSPITAL SWITCH (Hero Flow)"
echo "=========================================="
echo ""
echo "🏥 Alice moves to a new city and visits Hospital B"
echo ""
sleep 2

echo "Step 1: Alice revokes Hospital A's access..."

invokeChaincode \
  "revokeAccess" \
  '"PAT001","HospitalAOrgMSP"' \
  "patient" "7051" "PatientOrgMSP"

sleep 3

echo "✅ Access revoked from Hospital A"
echo ""
sleep 2

echo "Step 2: Hospital B requests access..."

invokeChaincode \
  "requestAccess" \
  '"PAT001"' \
  "hospitalB" "9051" "HospitalBOrgMSP"

sleep 3

echo "✅ Access requested by Hospital B"
echo ""
sleep 2

echo "Step 3: Alice grants access to Hospital B with Hospital A's history..."

invokeChaincode \
  "grantAccess" \
  '"PAT001","HospitalBOrgMSP","[\"collectionMedicalRecords_HospitalA\",\"collectionLabReports_HospitalA\",\"collectionMedicalRecords_HospitalB\"]"' \
  "patient" "7051" "PatientOrgMSP"

sleep 3

echo "✅ Access granted to Hospital B (with access to Hospital A's records)"
echo ""
sleep 2

echo "Step 4: Doctor at Hospital B queries patient history..."
echo ""
echo "🔍 Hospital B can now see:"
echo "  - Medical records from Hospital A"
echo "  - Lab reports from Hospital A"
echo "  - No need for duplicate tests!"
echo ""

queryChaincode "queryPatientRecords" '"PAT001"' "hospitalB" "9051" "HospitalBOrgMSP"
echo ""
sleep 2

echo "✅ Hospital B successfully accessed Alice's full medical history!"
echo ""
sleep 2

# Scenario 9: Audit Log
echo "📋 SCENARIO 9: Audit Trail"
echo "-------------------------"
echo "Viewing complete audit log for Alice..."

queryChaincode "getAuditLog" '"PAT001"' "patient" "7051" "PatientOrgMSP"
echo ""

echo "========================================="
echo "   ✅ DEMO COMPLETE"
echo "========================================="
echo ""
echo "Summary of what was demonstrated:"
echo "1. ✅ Patient registration"
echo "2. ✅ Hospital access request and consent"
echo "3. ✅ Medical record creation (private data)"
echo "4. ✅ Lab test ordering and reporting"
echo "5. ✅ Prescription issuance and fulfillment"
echo "6. ✅ Insurance claim submission and approval"
echo "7. ✅ Patient viewing own records"
echo "8. ✅ Hospital switching with data portability"
echo "9. ✅ Complete audit trail"
echo ""
echo "Key achievements:"
echo "✅ No duplicate medical tests"
echo "✅ Patient controls data access"
echo "✅ Privacy maintained between hospitals"
echo "✅ Full audit trail preserved"
echo "✅ Seamless hospital switching"
echo ""
