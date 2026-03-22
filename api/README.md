# HealthChain Backend API — Documentation for Frontend Engineering

This is the central Express.js REST API for the HealthChain Hyperledger Fabric network. It securely links the Web Frontend and Google Cloud Storage securely to the underlying blockchain Smart Contracts.

---

> **Note for Frontend:** To hit these APIs in production, point your requests to `http://<HOST_IP>:3000`. 
> *(Example: `http://34.46.78.234:3000/api/patient/register`)*

---

## 📁 0. Google Cloud Storage (PDF Handling)
Endpoints to handle gigabyte-sized files (Scans, Lab Reports, PDFs) efficiently without overloading the blockchain.

### `POST /api/documents/upload-url`
Retrieves a cryptographically signed URL to upload a file directly from the browser to Google Cloud Storage.
* **Body:**
  ```json
  { 
    "fileName": "scan.pdf", 
    "contentType": "application/pdf" 
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "message": "Signed URL generated...",
    "uploadUrl": "https://storage.googleapis.com/...&X-Goog-Signature=...",
    "documentUrl": "gs://healthchain-secure-docs/scan.pdf"
  }
  ```
*(Frontend usage flow: 1. Fetch `uploadUrl`. 2. `PUT` the actual file buffer to `uploadUrl`. 3. Take the `documentUrl` and pass it into the APIs below under the `documentUrl` field!)*

### `POST /api/documents/download-url`
Converts a raw Blockchain `gs://...` link into a short-lived, clickable HTTPS download link for the end-user.
* **Body:**
  ```json
  { "documentUrl": "gs://healthchain-secure-docs/scan.pdf" }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "downloadUrl": "https://storage.googleapis.com/...&X-Goog-Signature=..."
  }
  ```

---

## 👤 1. Patient Operations (`/api/patient`)

### Register Patient
`POST /api/patient/register`
* **Body:**
  ```json
  {
    "id": "PAT001",
    "firstName": "Alice",
    "lastName": "Smith",
    "dob": "1990-05-15",
    "bloodGroup": "O+",
    "email": "alice@mail.com",
    "phone": "1234567890"
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "message": "Patient registered successfully",
    "data": { "docType": "patient", "patientId": "PAT001", "firstName": "Alice", "createdAt": "..." }
  }
  ```

### Fetch Patient Profile
`GET /api/patient/:id`
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "patient", "firstName": "Alice", "bloodGroup": "O+", "email": "alice@mail.com" }
  }
  ```

### Patient Grants Access
`POST /api/patient/:id/consents/grant`
* **Body:**
  ```json
  {
    "hospitalMsp": "HospitalAOrgMSP",
    "collections": [
      "collectionMedicalRecords_HospitalA",
      "collectionLabReports_HospitalA",
      "collectionPrescriptions_HospitalA",
      "collectionInsuranceClaims_HospitalA"
    ]
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "message": "Access granted to HospitalAOrgMSP",
    "data": { "docType": "consent", "status": "active", "authorizedPDCs": [...] }
  }
  ```

### View Audit Logs (Ledger History)
`GET /api/patient/:id/audit-logs`
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": [
      { "docType": "auditLog", "action": "CREATE_RECORD", "hospitalOrg": "HospitalAOrgMSP", "timestamp": "..." },
      { "docType": "auditLog", "action": "UPLOAD_LAB_REPORT", "timestamp": "..." }
    ]
  }
  ```

---

## 🏥 2. Hospital Operations (`/api/hospital`)

### Request Access to Records
`POST /api/hospital/access/request`
* **Body:**
  ```json
  { "patientId": "PAT001" }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "accessRequest", "hospitalOrg": "HospitalAOrgMSP", "status": "pending" }
  }
  ```

### Create Medical Record
`POST /api/hospital/records`
* **Body:**
  ```json
  {
    "recordId": "REC001",
    "patientId": "PAT001",
    "recordType": "diagnosis",
    "diagnosis": "Asthma",
    "treatment": "Inhaler",
    "documentUrl": "gs://healthchain/..." // Optional (Attach PDF)
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "medicalRecord", "recordId": "REC001", "diagnosis": "Asthma", "s3Key": "gs://..." }
  }
  ```

### View Full Decrypted Medical Profile
`GET /api/hospital/patients/:id/records`
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": [
      { "docType": "medicalRecord", "recordId": "REC001", "diagnosis": "Asthma" },
      { "docType": "labReport", "reportId": "REP001", "testType": "Chest X-Ray", "results": {...} }
    ]
  }
  ```

### Order Lab Test
`POST /api/hospital/lab-orders`
* **Body:**
  ```json
  {
    "orderId": "ORD427",
    "patientId": "PAT001",
    "testName": "Chest X-Ray",
    "priority": "high"
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "labOrder", "orderId": "ORD427", "status": "ordered" }
  }
  ```

### Issue Prescription
`POST /api/hospital/prescriptions`
* **Body:**
  ```json
  {
    "prescriptionId": "RX001",
    "patientId": "PAT001",
    "diagnosis": "Asthma",
    "medications": [{"name": "Albuterol", "dosage": "2 puffs"}],
    "validUntil": "2026-12-31",
    "documentUrl": "gs://..." // Optional (Attach PDF)
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "prescription", "status": "issued", "medications": [...] }
  }
  ```

### Submit Insurance Claim
`POST /api/hospital/insurance-claims`
* **Body:**
  ```json
  {
    "claimId": "CLM001",
    "patientId": "PAT001",
    "serviceDate": "2026-03-21",
    "procedures": [{"code": "12345", "cost": 100}],
    "totalAmount": 100,
    "documentUrl": "gs://..." // Optional (Attach PDF)
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "insuranceClaim", "status": "submitted", "totalAmount": 100 }
  }
  ```

---

## 🔬 3. Diagnostic Lab Operations (`/api/lab`)

### Upload Lab Report
`POST /api/lab/reports`
* **Body:**
  ```json
  {
    "reportId": "REP544",
    "orderId": "ORD427",
    "patientId": "PAT001",
    "testName": "Chest X-Ray",
    "testResults": { "Lungs": "Clear" },
    "documentUrl": "gs://..." // Optional (Attach PDF)
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "labReport", "status": "completed", "results": {"Lungs": "Clear"} }
  }
  ```

---

## 💊 4. Pharmacy Operations (`/api/pharmacy`)

### View Pending Prescriptions
`GET /api/pharmacy/prescriptions/pending`
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": [
      { "docType": "prescription", "prescriptionId": "RX001", "status": "issued", "medications": [...] }
    ]
  }
  ```

### Fulfill Prescription
`POST /api/pharmacy/prescriptions/fulfill`
* **Body:**
  ```json
  { "prescriptionId": "RX001" }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "prescription", "prescriptionId": "RX001", "status": "fulfilled" }
  }
  ```

---

## 🛡️ 5. Insurance Operations (`/api/insurance`)

### View Pending Claims
`GET /api/insurance/claims/pending`
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": [
      { "docType": "insuranceClaim", "claimId": "CLM001", "status": "submitted", "totalAmount": 100 }
    ]
  }
  ```

### Approve Claim
`POST /api/insurance/claims/approve`
* **Body:**
  ```json
  {
    "claimId": "CLM001",
    "approvedAmount": 100,
    "remarks": "Verified"
  }
  ```
* **Expected Output:**
  ```json
  {
    "success": true,
    "data": { "docType": "insuranceClaim", "claimId": "CLM001", "status": "approved", "approvedAmount": 100 }
  }
  ```
