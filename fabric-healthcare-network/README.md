
# Healthchain Blockchain Network - Complete Setup Guide

## Overview

This project implements a **Hyperledger Fabric blockchain network** for healthcare data management with the following key features:

- ✅ **Patient-owned medical records** with consent-based access control
- ✅ **Privacy-preserving architecture** using separate Private Data Collections (PDCs) per hospital
- ✅ **Seamless hospital switching** without data loss or duplicate tests
- ✅ **Complete audit trail** of all data access
- ✅ **Multi-organization network** (6 organizations + orderer)

## Architecture Summary

### Organizations

```
OrdererOrg (7050) - Network admin
PatientOrg (7051) - Patient identities
HospitalAOrg (8051) - First hospital
HospitalBOrg (9051) - Second hospital
LabOrg (10051) - Laboratory services
PharmacyOrg (11051) - Pharmacy services
InsuranceOrg (12051) - Insurance provider
```

### Private Data Collections (8 total)

Each hospital has 4 PDCs to ensure data isolation:
- `collectionMedicalRecords_<Hospital>` - Diagnoses, treatments
- `collectionLabReports_<Hospital>` - Lab test results
- `collectionPrescriptions_<Hospital>` - Medications
- `collectionInsuranceClaims_<Hospital>` - Billing claims

**Why separate PDCs?**
- Prevents HospitalA from seeing HospitalB's data at the infrastructure level.
- The Patient is a member of all PDCs, acting as the data bridge.
- Consent logic controls which PDCs a hospital can access.

## Quick Start

### Prerequisites (Mac M1 / Apple Silicon)

Ensure you have the following installed:

1.  **Docker Desktop for Mac** (Apple Silicon version)
    -   Enable "Use Docker Compose V2" in preferences.
    -   Memory: Increase to at least 4GB (preferably 6GB+) in Docker Resources.
2.  **Node.js**: v16.x or v18.x (LTS)
    -   Verify: `node --version`
3.  **Hyperledger Fabric Binaries**:
    -   Install binaries and docker images:
        ```bash
        curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.0 1.5.5
        ```
    -   Add binaries to your PATH:
        ```bash
        export PATH=$PWD/bin:$PATH
        ```
4.  **Utilities**:
    -   `jq`: Required for JSON processing in scripts (`brew install jq`).

### Step-by-Step Execution Guide

**Note:** Run all commands from the root of the repository (`HealthChain/`).

#### 1. Network Setup
Start the network infrastructure (CAs, Peers, Orderers).

```bash
cd network/scripts
./01-generate-crypto.sh
./02-start-network.sh
```

#### 2. Channel Creation
Create the channel `healthchain-channel` and join all peers.

```bash
# Still in network/scripts/
./03-create-channel.sh
```

#### 3. Chaincode Deployment
Deploy the `healthchain` smart contract.

```bash
# Still in network/scripts/
./04-deploy-chaincode.sh
./05-init-chaincode.sh
```

#### 4. Run the Demo
Execute the full end-to-end scenario.

```bash
cd ../../demo/scenarios
./run-all-demos.sh
```

## Demo Explanation

The demo script (`run-all-demos.sh`) walks through a complete patient journey:

1.  **Patient Registration**: Alice registers in the system.
2.  **First Hospital Visit**: Alice visits Hospital A.
3.  **Medical Record**: Doctor creates a diagnosis (Hypertension).
4.  **Lab Test**: Blood test ordered and results uploaded.
5.  **Prescription**: Doctor prescribes Lisinopril.
6.  **Pharmacy**: Prescription fulfilled.
7.  **Insurance**: Claim submitted and approved.
8.  **Hospital Switch (Hero Flow)**: 
    -   Alice moves to Hospital B.
    -   She revokes Hospital A's access.
    -   She grants Hospital B access.
    -   **Result**: Hospital B can see her full history (including Hospital A's records) without needing duplicate tests.
9.  **Audit Trail**: A complete log of all access is displayed.

## Troubleshooting regarding Mac M1

### "Function not implemented" or "gRPC" errors
-   **Cause**: Node.js native modules for the wrong architecture.
-   **Fix**: Ensure your `chaincode/healthchain/node_modules` are built for arm64.
    ```bash
    cd chaincode/healthchain
    rm -rf node_modules package-lock.json
    npm install
    ```

### Docker "exec format error"
-   **Cause**: Trying to run an AMD64 binary on ARM64 without Rosetta, or using an incompatible image.
-   **Fix**: Fabric 2.5 images support multi-arch. Ensure you are not forcing `platform: linux/amd64` in docker-compose unless necessary (and have Rosetta enabled in Docker Desktop).

### Network functionality issues
-   **Problem**: Peers exit immediately.
-   **Fix**: Check logs.
    ```bash
    docker logs peer0.patient.healthchain.com
    ```
    Often due to path mounting issues or certificates not being found. Ensure `FABRIC_CFG_PATH` is set correctly in scripts (the provided scripts handle this).

### "No active consent" during demo
-   **Cause**: The chaincode state might be stale or previous runs conflicted.
-   **Fix**: detailed in the script, but ensure you bring down the network fully before restarting:
    ```bash
    cd network/scripts
    ./02-start-network.sh down
    ```
    Then restart from Step 1.

## Accessing the Code

-   **Network Config**: `network/`
-   **Smart Contract**: `chaincode/healthchain/`
-   **Demo Scripts**: `demo/scenarios/`

---
**Built with Hyperledger Fabric 2.5**
