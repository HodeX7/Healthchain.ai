# Fabric Healthcare Network - Channel Creation Walkthrough

## Overview

Successfully set up a complete Hyperledger Fabric network for the HealthChain project with 7 organizations and created the `healthchain-channel` with all peers joined.

## What Was Accomplished

### 1. Configuration Files Created

#### [configtx.yaml](file:///Users/aksharmehta/Projects/HealthChain/network/configtx/configtx.yaml)
- Defines 7 organizations:
  - **OrdererOrg** (MSP: OrdererMSP)
  - **PatientOrg** (MSP: PatientOrgMSP, Port: 7051)
  - **HospitalAOrg** (MSP: HospitalAOrgMSP, Port: 8051)
  - **HospitalBOrg** (MSP: HospitalBOrgMSP, Port: 9051)
  - **LabOrg** (MSP: LabOrgMSP, Port: 10051)
  - **PharmacyOrg** (MSP: PharmacyOrgMSP, Port: 11051)
  - **InsuranceOrg** (MSP: InsuranceOrgMSP, Port: 12051)
- Channel profiles:
  - `HealthchainOrdererGenesis`: System channel profile
  - `HealthchainChannel`: Application channel with all 6 peer orgs
- Capabilities: Fabric v2.5 (Application), v2.0 (Channel/Orderer)
- Consensus: etcdRaft

### 2. Scripts Created

#### [03-create-channel.sh](file:///Users/aksharmehta/Projects/HealthChain/network/scripts/03-create-channel.sh)
- Generates channel genesis block using `configtxgen`
- Joins orderer to channel using `osnadmin` API
- ⚠️ **Issue**: FABRIC_CFG_PATH pointed to configtx directory, causing peer join failures

#### [04-join-peers-to-channel.sh](file:///Users/aksharmehta/Projects/HealthChain/network/scripts/04-join-peers-to-channel.sh)
- Fixed script to join all peers to the channel
- Corrected FABRIC_CFG_PATH to point to config directory
- Successfully joined all 6 peer organizations

#### [full_build.sh](file:///Users/aksharmehta/Projects/HealthChain/network/scripts/full_build.sh)
- Orchestrates the complete network build
- Runs scripts 01, 02, and 03 in sequence

### 3. Environment Setup

#### Fabric Binaries
- **Source**: Moved from `~/bin/` to `network/bin/`
- **Binaries included**:
  - `cryptogen` (20MB)
  - `configtxgen` (25MB)
  - `peer` (45MB)
  - `osnadmin` (19MB)
  - `configtxlator` (21MB)
  - `orderer` (37MB)
  - `discover` (26MB)
  - `fabric-ca-client` (30MB)
- **Total size**: ~221MB
- **Git**: Added `network/bin/` to `.gitignore`

#### Crypto Material
- **Generated using**: `cryptogen` with `crypto-config.yaml`
- **Organizations**: 7 (1 orderer + 6 peers)
- **Removed from git**: 182 certificate/key files
- **Location**: `network/organizations/`
- **Git**: Already in `.gitignore`

## Running Containers

All 14 containers are running and healthy:

| Container Name | Type | Port(s) | Status |
|----------------|------|---------|--------|
| orderer.orderer.healthchain.com | Orderer | 7050, 7053, 9443 | ✅ Up |
| peer0.patient.healthchain.com | Peer | 7051 | ✅ Up |
| peer0.hospitalA.healthchain.com | Peer | 8051 | ✅ Up |
| peer0.hospitalB.healthchain.com | Peer | 9051 | ✅ Up |
| peer0.lab.healthchain.com | Peer | 10051 | ✅ Up |
| peer0.pharmacy.healthchain.com | Peer | 11051 | ✅ Up |
| peer0.insurance.healthchain.com | Peer | 12051 | ✅ Up |
| couchdb.patient | Database | 5984 | ✅ Up |
| couchdb.hospitalA | Database | 6984 | ✅ Up |
| couchdb.hospitalB | Database | 7984 | ✅ Up |
| couchdb.lab | Database | 8984 | ✅ Up |
| couchdb.pharmacy | Database | 9984 | ✅ Up |
| couchdb.insurance | Database | 10984 | ✅ Up |
| cli | CLI Tool | - | ✅ Up |

## Channel Status

### healthchain-channel
- **Status**: Active ✅
- **Orderer**: Joined (consenter, height: 1)
- **Peers joined**: 6/6
  - ✅ peer0.patient.healthchain.com
  - ✅ peer0.hospitalA.healthchain.com
  - ✅ peer0.hospitalB.healthchain.com
  - ✅ peer0.lab.healthchain.com
  - ✅ peer0.pharmacy.healthchain.com
  - ✅ peer0.insurance.healthchain.com

## Issues Encountered & Resolved

### Issue 1: Missing Fabric Binaries
**Problem**: `cryptogen: command not found`
**Solution**: Copied binaries from `~/bin/` to `network/bin/` and updated PATH in scripts

### Issue 2: Incorrect PATH in Scripts
**Problem**: Scripts had `../../bin` instead of `../bin`
**Solution**: Updated `03-create-channel.sh` to use correct relative path

### Issue 3: Missing Orderer Section in configtx.yaml
**Problem**: `HealthchainChannel` profile missing orderer configuration
```
Error: refusing to generate block which is missing orderer section
```
**Solution**: Added Orderer section with OrdererOrg to the channel profile

### Issue 4: FABRIC_CFG_PATH for Peer Commands
**Problem**: Peers failed to join channel - `peer` CLI looking for `core.yaml` in configtx directory
```
Error: Config File "core" Not Found in "/network/configtx"
```
**Solution**: Created separate script (`04-join-peers-to-channel.sh`) with FABRIC_CFG_PATH pointing to config directory

## Verification

### Check Channel Membership
```bash
cd network/scripts
export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="PatientOrgMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/../organizations/peerOrganizations/patient.healthchain.com/peers/peer0.patient.healthchain.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/../organizations/peerOrganizations/patient.healthchain.com/users/Admin@patient.healthchain.com/msp
export CORE_PEER_ADDRESS=localhost:7051

peer channel list
```

**Expected Output**:
```
Channels peers has joined:
healthchain-channel
```

### Check All Containers
```bash
docker ps
```

All 14 containers should show "Up" status.

## Git Repository Cleanup

### Removed from Git
- 182 crypto material files (certificates, private keys)
- Staged for deletion in current commit

### Added to .gitignore
```gitignore
# Hyperledger Fabric binaries
network/bin/

# Hyperledger Fabric generated files
network/organizations/ordererOrganizations/
network/organizations/peerOrganizations/
network/channel-artifacts/*.block
network/channel-artifacts/*.tx
```

### Files Staged for Commit
- ✅ `network/configtx/configtx.yaml` (new)
- ✅ `network/scripts/03-create-channel.sh` (new)
- ✅ `.gitignore` (modified)
- 📝 182 file deletions (crypto material)

## Next Steps

1. **Commit your changes**:
   ```bash
   git add .gitignore network/configtx/configtx.yaml network/scripts/
   git commit -m "Add channel creation configuration and scripts
   
   - Add configtx.yaml with 7 org definitions (OrdererOrg + 6 peer orgs)
   - Add 03-create-channel.sh for channel genesis block generation
   - Add 04-join-peers-to-channel.sh to join all peers
   - Add full_build.sh orchestration script
   - Update .gitignore to exclude binaries and crypto material
   - Remove committed crypto material (182 files)"
   ```

2. **Proceed to Skill 04**: Private Data Collections (PDC) configuration

3. **Deploy chaincode** to the channel

## Commands Reference

### Full Network Build (from scratch)
```bash
cd /Users/aksharmehta/Projects/HealthChain/network/scripts
./full_build.sh                    # Runs all 3 scripts
./04-join-peers-to-channel.sh      # If peers didn't join
```

### Individual Scripts
```bash
./01-generate-crypto.sh     # Generate crypto material
./02-start-network.sh       # Start Docker containers
./03-create-channel.sh      # Create channel (orderer only)
./04-join-peers-to-channel.sh  # Join peers to channel
```

### Cleanup
```bash
docker-compose -f network/docker/docker-compose.yml down -v
rm -rf network/organizations/ordererOrganizations
rm -rf network/organizations/peerOrganizations
rm -rf network/channel-artifacts
```
