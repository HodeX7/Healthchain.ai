#!/bin/bash

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../config/

CRYPTO_CONFIG_DIR="../organizations/cryptogen"
OUTPUT_DIR="../organizations"

echo "Generating crypto material using cryptogen..."

# Remove existing crypto material
rm -rf ${OUTPUT_DIR}/peerOrganizations
rm -rf ${OUTPUT_DIR}/ordererOrganizations

# Generate crypto material
cryptogen generate --config=${CRYPTO_CONFIG_DIR}/crypto-config.yaml --output=${OUTPUT_DIR}

if [ $? -ne 0 ]; then
  echo "Failed to generate crypto material..."
  exit 1
fi

echo "Crypto material generated successfully!"
echo ""
echo "Organizations created:"
echo "  - OrdererOrg (orderer.healthchain.com)"
echo "  - PatientOrg (patient.healthchain.com)"
echo "  - HospitalAOrg (hospitalA.healthchain.com)"
echo "  - HospitalBOrg (hospitalB.healthchain.com)"
echo "  - LabOrg (lab.healthchain.com)"
echo "  - PharmacyOrg (pharmacy.healthchain.com)"
echo "  - InsuranceOrg (insurance.healthchain.com)"
