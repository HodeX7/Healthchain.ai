# HealthChain Deployment Walkthrough

This document outlines the steps to deploy the HealthChain Hyperledger Fabric network and chaincode, and summarizes the key fixes applied during the debugging process.

## 1. Deployment Instructions

To deploy the entire network and chaincode from scratch, run the full build script:

```bash
./network/scripts/full_build.sh
```

This script performs the following actions:
1.  **Clean Environment**: Removes existing Docker containers and volumes.
2.  **Generate Crypto**: Creates crypto material using `cryptogen`.
3.  **Start Network**: Launches 6 peers (Patient, HospitalA, HospitalB, Lab, Pharmacy, Insurance) and 1 Orderer using `docker-compose`.
4.  **Create Channel**: Generates the genesis block and joins all 6 peers to `healthchain-channel`.
5.  **Deploy Chaincode**:
    - Packages the chaincode (with `node_modules` cleanup).
    - Installs it on ALL 6 peers.
    - Approves it for ALL 6 organizations.
    - Commits it with endorsement from ALL 6 peers (satisfying the MAJORITY policy).
6.  **Initialize Chaincode**: Invokes the `initLedger` function to set up initial metadata.

## 2. Key Fixes & Improvements

During the deployment process, we resolved several critical issues:

### Endorsement Policy (MAJORITY)
- **Issue**: The default deployment only targeted 3 peers, but the `MAJORITY` policy requires >50% (4 out of 6) endorsements.
- **Fix**: Updated `04-deploy-chaincode.sh` and `05-init-chaincode.sh` to explicitly target **all 6 peers** for commit and invoke transactions.

### Chaincode Runtime Crash ("exited with 0")
- **Issue**: Chaincode containers were starting but immediately exiting.
- **Root Cause**:
    1.  **Architecture Mismatch**: `npm install` on macOS created binaries incompatible with the Linux chaincode container.
    2.  **Network Connectivity**: Chaincode containers were running in the default bridge network and couldn't resolve peer hostnames.
    3.  **CaaS Config**: `CHAINCODE_AS_A_SERVICE` env var was conflicting with standard lifecycle.
- **Fix**:
    1.  Updated script to **remove `node_modules`** before packaging, forcing a fresh install inside the Linux container.
    2.  Added `CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=fabric_healthchain` to all peers in `docker-compose.yml` to attach chaincode containers to the correct network.
    3.  Removed `CHAINCODE_AS_A_SERVICE_BUILDER_CONFIG` from `docker-compose.yml`.

### Non-Deterministic Execution
- **Issue**: `ProposalResponsePayloads do not match` error during initialization.
- **Root Cause**: The chaincode used `new Date().toISOString()` for timestamps. Since each peer executed this at a slightly different time, the ledgers diverged.
- **Fix**: Refactored **all chaincode modules** to use `ctx.stub.getTxTimestamp()`, ensuring all peers generate the exact same timestamp for a given transaction.

## 3. Verification

You can verify the chaincode is active by querying the initialized network metadata:

```bash
# Set environment variables for PatientOrg
export FABRIC_CFG_PATH=$PWD/network/config/
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/network/organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=$PWD/network/organizations/peerOrganizations/patient.healthchain.com/users/Admin@patient.healthchain.com/msp
export CORE_PEER_ADDRESS=localhost:7051

# Query the network metadata
peer chaincode query -C healthchain-channel -n healthchain -c '{"Args":["getNetworkMetadata"]}'
```

Expected Output:
```json
{"docType":"networkMetadata","version":"1.0.0","hospitals":["HospitalAOrgMSP","HospitalBOrgMSP"],"createdAt":"..."}
```
