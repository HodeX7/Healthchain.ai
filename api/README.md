# HealthChain Backend API

This is the central Express.js REST API for the HealthChain Hyperledger Fabric network. It provides a modular, easily consumable interface to interact with the blockchain's smart contracts.

---

## 🚀 Setup & Running

**1. Start the Blockchain Network**
The API requires the underlying Hyperledger Fabric network to be running first.
```bash
./network/scripts/full_build.sh
```

**2. Start the API Server**
Open a new terminal window:
```bash
cd api
npm install
npm start
```
*The server will start on `http://localhost:3000`.*

---

## ⚡ Quick Test Full Suite

If you want to run every single endpoint sequentially from beginning to end to verify the network is healthy, you can copy and paste this combined command into your terminal:

```bash
# Wait for the background server to stabilize, then run all 14 tests:
echo "1. Registering Patient..."
curl -sX POST "http://localhost:3000/api/patient/register" -H "Content-Type: application/json" -d '{"id":"PAT001", "firstName":"Alice", "lastName":"Smith", "dob":"1990-05-15", "bloodGroup":"O+", "email":"alice@mail.com", "phone":"1234567890"}' && echo -e "\n" && sleep 2

echo "2. Fetching Patient Profile..."
curl -s "http://localhost:3000/api/patient/PAT001" && echo -e "\n"

echo "3. Hospital Requesting Access..."
curl -sX POST "http://localhost:3000/api/hospital/access/request" -H "Content-Type: application/json" -d '{"patientId":"PAT001"}' && echo -e "\n" && sleep 2

echo "4. Patient Granting Access to HospitalA..."
curl -sX POST "http://localhost:3000/api/patient/PAT001/consents/grant" -H "Content-Type: application/json" -d '{"hospitalMsp":"HospitalAOrgMSP","collections":["collectionMedicalRecords_HospitalA","collectionLabReports_HospitalA","collectionPrescriptions_HospitalA", "collectionInsuranceClaims_HospitalA"]}' && echo -e "\n" && sleep 2

echo "5. Ordering Lab Test..."
curl -sX POST "http://localhost:3000/api/hospital/lab-orders" -H "Content-Type: application/json" -d '{"orderId":"ORD001", "patientId":"PAT001", "testName":"Blood Panel", "priority":"high"}' && echo -e "\n" && sleep 2

echo "6. Lab Uploading Report..."
curl -sX POST "http://localhost:3000/api/lab/reports" -H "Content-Type: application/json" -d '{"reportId":"REP001", "orderId":"ORD001", "patientId":"PAT001", "testName":"Blood Panel", "testResults":{"WBC":7.5,"RBC":4.8}}' && echo -e "\n" && sleep 2

echo "7. Creating Medical Record..."
curl -sX POST "http://localhost:3000/api/hospital/records" -H "Content-Type: application/json" -d '{"recordId":"REC001", "patientId":"PAT001", "recordType":"diagnosis", "diagnosis":"Hypertension", "treatment":"Rest and medication"}' && echo -e "\n" && sleep 2

echo "8. Issuing Prescription..."
curl -sX POST "http://localhost:3000/api/hospital/prescriptions" -H "Content-Type: application/json" -d '{"prescriptionId":"RX001","patientId":"PAT001","diagnosis":"Hypertension","medications":[{"name":"Lisinopril","dosage":"10mg"}],"validUntil":"2026-12-31"}' && echo -e "\n" && sleep 4

echo "9. Pharmacy Viewing Pending Prescriptions..."
curl -s "http://localhost:3000/api/pharmacy/prescriptions/pending" && echo -e "\n"

echo "10. Pharmacy Fulfilling Prescription..."
curl -sX POST "http://localhost:3000/api/pharmacy/prescriptions/fulfill" -H "Content-Type: application/json" -d '{"prescriptionId":"RX001"}' && echo -e "\n" && sleep 2

echo "11. Submitting Insurance Claim..."
curl -sX POST "http://localhost:3000/api/hospital/insurance-claims" -H "Content-Type: application/json" -d '{"claimId":"CLM001","patientId":"PAT001","serviceDate":"2026-03-09","procedures":[{"code":"99213","cost":150.00}],"totalAmount":150}' && echo -e "\n" && sleep 4

echo "12. Insurance Viewing Pending Claims..."
curl -s "http://localhost:3000/api/insurance/claims/pending" && echo -e "\n"

echo "13. Insurance Approving Claim..."
curl -sX POST "http://localhost:3000/api/insurance/claims/approve" -H "Content-Type: application/json" -d '{"claimId":"CLM001","approvedAmount":150,"remarks":"Approved in full"}' && echo -e "\n" && sleep 2

echo "14. Patient Viewing Audit Trail..."
curl -s "http://localhost:3000/api/patient/PAT001/audit-logs" && echo -e "\n"
```

---

## 📡 API Endpoints & Testing Flow

To properly test the blockchain, actions must happen in a logical medical sequence. Below is the step-by-step flow and the `curl` commands to test each API.

### Phase 1: Patient Onboarding

**1. Register a Patient (Patient Org)**
Creates a new identity on the global ledger.
```bash
curl -X POST http://localhost:3000/api/patient/register \
-H "Content-Type: application/json" \
-d '{"id":"PAT001", "firstName":"Alice", "lastName":"Smith", "dob":"1990-05-15", "bloodGroup":"O+", "email":"alice@mail.com", "phone":"1234567890"}'
```

**2. Verify Registration (Patient Org)**
```bash
curl http://localhost:3000/api/patient/PAT001
```

---

### Phase 2: Hospital Visit & Consent

**3. Hospital Requests Access (Hospital Org)**
When Alice visits Hospital A, the hospital signals intent to access her history.
```bash
curl -X POST http://localhost:3000/api/hospital/access/request \
-H "Content-Type: application/json" \
-d '{"patientId":"PAT001"}'
```

**4. Patient Grants Access (Patient Org)**
Alice explicitly approves Hospital A to read/write to her private medical collections.
```bash
curl -X POST http://localhost:3000/api/patient/PAT001/consents/grant \
-H "Content-Type: application/json" \
-d '{
  "hospitalMsp": "HospitalAOrgMSP",
  "collections": [
    "collectionMedicalRecords_HospitalA",
    "collectionLabReports_HospitalA",
    "collectionPrescriptions_HospitalA"
  ]
}'
```

---

### Phase 3: Medical Treatment

**5. Doctor Creates Medical Record (Hospital Org)**
The doctor securely logs a diagnosis to Alice's Private Data Collection.
```bash
curl -X POST http://localhost:3000/api/hospital/records \
-H "Content-Type: application/json" \
-d '{"recordId":"REC001", "patientId":"PAT001", "recordType":"diagnosis", "diagnosis":"Hypertension", "treatment":"Rest and medication"}'
```

**6. Doctor Orders Lab Test (Hospital Org)**
```bash
curl -X POST http://localhost:3000/api/hospital/lab-orders \
-H "Content-Type: application/json" \
-d '{"orderId":"ORD001", "patientId":"PAT001", "testName":"Blood Panel", "priority":"high"}'
```

---

### Phase 4: Diagnostic Lab

**7. Lab Views Pending Orders (Lab Org)**
```bash
curl http://localhost:3000/api/lab/orders
```

**8. Lab Uploads Test Results (Lab Org)**
The lab fulfills the order and adds the data to Alice's records.
```bash
curl -X POST http://localhost:3000/api/lab/reports \
-H "Content-Type: application/json" \
-d '{"reportId":"REP001", "orderId":"ORD001", "patientId":"PAT001", "testName":"Blood Panel", "testResults":{"WBC":7.5,"RBC":4.8}}'
```

---

### Phase 5: Pharmacy & Medicine

**9. Doctor Issues Prescription (Hospital Org)**
```bash
curl -X POST http://localhost:3000/api/hospital/prescriptions \
-H "Content-Type: application/json" \
-d '{
  "prescriptionId":"RX001",
  "patientId":"PAT001",
  "diagnosis":"Hypertension",
  "medications":[{"name":"Lisinopril","dosage":"10mg"}],
  "validUntil":"2026-12-31"
}'
```

**10. Pharmacy Views Pending Prescriptions (Pharmacy Org)**
```bash
curl http://localhost:3000/api/pharmacy/prescriptions/pending
```

**11. Pharmacy Fulfills Prescription (Pharmacy Org)**
```bash
curl -X POST http://localhost:3000/api/pharmacy/prescriptions/fulfill \
-H "Content-Type: application/json" \
-d '{"prescriptionId":"RX001"}'
```

---

### Phase 6: Billing & Insurance

**12. Hospital Submits Insurance Claim (Hospital Org)**
```bash
curl -X POST http://localhost:3000/api/hospital/insurance-claims \
-H "Content-Type: application/json" \
-d '{
  "claimId":"CLM001",
  "patientId":"PAT001",
  "serviceDate":"2026-02-20",
  "procedures":[{"code":"99213","cost":150.00}],
  "totalAmount": 150.00
}'
```

**13. Insurance Approves Claim (Insurance Org)**
```bash
curl -X POST http://localhost:3000/api/insurance/claims/approve \
-H "Content-Type: application/json" \
-d '{"claimId":"CLM001", "approvedAmount":150.00, "remarks":"Approved in full"}'
```

---

### Phase 7: Verification & Audit

**14. View Patient's Total History (Hospital Org or Patient Org)**
```bash
curl http://localhost:3000/api/hospital/patients/PAT001/records
```

**15. View Immutable Audit Log (Patient Org)**
See the blockchain trail of exactly who touched Alice's data.
```bash
curl http://localhost:3000/api/patient/PAT001/audit-logs
```
