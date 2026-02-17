# HealthChain: Blockchain-Based Healthcare Data Exchange

**HealthChain** is a decentralized, patient-centric healthcare data exchange platform built on **Hyperledger Fabric**. It enables secure, interoperable sharing of medical records, lab reports, prescriptions, and insurance claims between patients, hospitals, labs, pharmacies, and insurance providers, while ensuring patients maintain full control over their data privacy.

---

## 🏗️ Project Architecture

The network consists of **7 Organizations** operating on a permissioned channel (`healthchain-channel`).

### Organizations & Roles

| Organization | MSP ID | Role |
|--------------|--------|------|
| **PatientOrg** | `PatientOrgMSP` | Represents patients. Manages identity, consents, and audit logs. |
| **HospitalA** | `HospitalAOrgMSP` | Healthcare Provider. Creates medical records, orders tests, issues prescriptions. |
| **HospitalB** | `HospitalBOrgMSP` | Second Healthcare Provider (illustrates interoperability/roaming). |
| **LabOrg** | `LabOrgMSP` | Diagnostic Lab. Receives orders and uploads test results. |
| **PharmacyOrg** | `PharmacyOrgMSP` | Pharmacy. Fulfils prescriptions. |
| **InsuranceOrg**| `InsuranceOrgMSP` | Payer. Processes insurance claims. |
| **OrdererOrg** | `OrdererMSP` | Consensus service (Solo/Raft). |

### Network Services & Ports

All services are containerized via Docker.

| Service | Container Name | Port (Host) | Internal Port |
|---------|----------------|-------------|---------------|
| **Orderer** | `orderer.orderer.healthchain.com` | `7050` | `7050` |
| **Patient Peer** | `peer0.patient.healthchain.com` | `7051` | `7051` |
| **HospitalA Peer** | `peer0.hospitalA.healthchain.com` | `8051` | `8051` |
| **HospitalB Peer** | `peer0.hospitalB.healthchain.com` | `9051` | `9051` |
| **Lab Peer** | `peer0.lab.healthchain.com` | `10051` | `10051` |
| **Pharmacy Peer** | `peer0.pharmacy.healthchain.com` | `11051` | `11051` |
| **Insurance Peer** | `peer0.insurance.healthchain.com` | `12051` | `12051` |
| **CouchDBs** | `couchdb.*` | `5984`-`10984` | `5984` |

---

## 💻 Codebase Structure

```
HealthChain/
├── chaincode/                  # Smart Contract (Symlink/Reference)
├── fabric-healthcare-network/  # Main Network Logic
│   └── chaincode/
│       └── healthcare/         # Node.js Chaincode Source
│           ├── index.js        # Entry point
│           ├── lib/            # Business Logic Functions
│           │   ├── healthchain-contract.js # Main Contract Class
│           │   ├── patient-functions.js    # Patient Logic
│           │   └── ... (hospital, lab, etc.)
│           └── collections_config.json # Private Data Configuration
├── network/                    # Network Configuration
│   ├── config/                 # Core Fabric Config (core.yaml, orderer.yaml)
│   ├── docker/                 # Docker Compose Files
│   ├── organizations/          # Crypto Materials (certs, keys)
│   └── scripts/                # Deployment Scripts
├── demo/                       # Usage Demonstrations
│   └── scenarios/              # Shell Scripts for User Flows
└── docs/                       # Detailed Documentation
```

---

## 🧠 Business Logic & Data Model

The chaincode (`healthchain`) handles the core business logic using two types of data storage:

1.  **Public Ledger (State Database)**: Stores consents, patient profiles, audit logs, and network metadata. Visible to all channel members (authorized by policy).
2.  **Private Data Collections (PDC)**: Stores sensitive medical data (Records, Reports, Claims). Only shared between strictly authorized organizations (e.g., Patient + Hospital A).

### Key Concepts

*   **Consent Management**: Patients explicitly `grantAccess` and `revokeAccess` for specific hospitals.
*   **Private Data**: A medical record created by Hospital A is stored in `private_HospitalA` collection. If the patient grants access to Hospital B, the system facilitates secure sharing (or logically allows Hospital B to query it if distinct policies allowed, currently implemented via authorized PDC lists).
*   **Audit Trail**: Every significant action (Access Grant, Record View) is logged on the ledger for transparency.

### Main Functions

| Module | Function | Description |
|--------|----------|-------------|
| **Patient** | `registerPatient` | Creates a new patient identity on the ledger. |
| | `grantAccess` | Authorizes a hospital to access data. |
| | `revokeAccess` | Revokes a hospital's access. |
| | `getAuditLog` | Views history of access to their data. |
| **Hospital**| `createMedicalRecord` | Adds a diagnosis/treatment record (stored in PDC). |
| | `orderLabTest` | Sends a test request to the Lab. |
| | `issuePrescription` | Creates a digital prescription. |
| | `submitInsuranceClaim`| Sends a claim to Insurance. |
| **Lab** | `uploadLabReport` | Uploads test results (linked to an Order). |
| **Pharmacy**| `fulfillPrescription` | Marks a prescription as dispensed. |
| **Insurance**| `approveClaim` | Processes and approves a claim. |

---

## 🚀 Getting Started

### Prerequisites
*   Docker & Docker Compose
*   Node.js (for client apps)
*   Unix-based shell (macOS/Linux)

### Deployment

1.  **Full Network Reset & Build**:
    ```bash
    ./network/scripts/full_build.sh
    ```
    *This stops containers, generates crypto material, starts the network, creates the channel, and deploys the chaincode.*

2.  **Monitor Network**:
    ```bash
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    ```

### Running Scenarios (Backend/Frontend Devs)

The `demo/scenarios` folder contains scripts that simulate backend API calls.

To run the full end-to-end user journey:
```bash
./demo/scenarios/run-all-demos.sh
```

**Scenario flow:**
1.  **Registration**: Patient Alice registers.
2.  **Checkin**: Alice grants access to Hospital A.
3.  **Consultation**: Doctor creates a medical record.
4.  **Lab Work**: Doctor orders blood test -> Lab results uploaded.
5.  **Pharmacy**: Prescription issued -> Pharmacy fulfills.
6.  **Billing**: Insurance claim submitted -> Approved.
7.  **Roaming (Hero Flow)**: Alice moves to Hospital B, grants them access to her Hospital A history.

---

## 📡 Integation details

### Communication Flow
1.  **Client Application** (Frontend/Backend) connects to a **Gateway Peer** (e.g., `peer0.patient.healthchain.com`).
2.  Uses a **Wallet** containing a valid X.509 identity (User Cert + Private Key).
3.  Submits a **Transaction Proposal** to peers.
    *   *Read operations*: Evaluated on the local peer, checks `Access Control` and `PDC policies`.
    *   *Write operations*: Endorsed by required organizations (e.g., `MAJORITY` or specific Collection Policy), then sent to **Orderer** for distinct block ordering.

### Access Control Rules
*   **PatientOrg** can see *everything* about their own patients.
*   **Hospitals** can only see records they created OR were granted access to.
*   **Labs/Pharmacies** have restricted views (Orders/Prescriptions only).

---

## ℹ️ Troubleshooting

*   **Error: "Access Denied"**: Check if `grantAccess` was called for that specific Organization MSP.
*   **Error: "Private data not available"**: Ensure the peer you are querying is part of the collection definition in `collections_config.json`.
*   **Logs**: View peer logs for detailed error messages:
    ```bash
    docker logs peer0.hospitalA.healthchain.com
    ```
