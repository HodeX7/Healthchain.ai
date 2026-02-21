const path = require('path');
const fs = require('fs');

const CHANNEL_NAME = 'healthchain-channel';
const CHAINCODE_NAME = 'healthchain';

// Paths relative to this file's location (api/src/config/)
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CRYPTO_PATH = path.join(PROJECT_ROOT, 'network', 'organizations', 'peerOrganizations');

const ORG_MAP = {
    patient: { mspId: 'PatientOrgMSP', port: 7051 },
    hospitalA: { mspId: 'HospitalAOrgMSP', port: 8051 },
    hospitalB: { mspId: 'HospitalBOrgMSP', port: 9051 },
    lab: { mspId: 'LabOrgMSP', port: 10051 },
    pharmacy: { mspId: 'PharmacyOrgMSP', port: 11051 },
    insurance: { mspId: 'InsuranceOrgMSP', port: 12051 },
};

function getOrgDetails(orgRole) {
    const details = ORG_MAP[orgRole];
    if (!details) throw new Error(`Unknown organization role: ${orgRole}`);
    return details;
}

function buildCCP(orgRole) {
    const { port } = getOrgDetails(orgRole);
    const orgDomain = orgRole;

    const tlsCACertPath = path.join(CRYPTO_PATH, `${orgDomain}.healthchain.com`, 'peers', `peer0.${orgDomain}.healthchain.com`, 'tls', 'ca.crt');
    const ordererTlsCACertPath = path.join(PROJECT_ROOT, 'network', 'organizations', 'ordererOrganizations', 'orderer.healthchain.com', 'orderers', 'orderer.orderer.healthchain.com', 'msp', 'tlscacerts', 'tlsca.orderer.healthchain.com-cert.pem');

    const tlsCACert = fs.readFileSync(tlsCACertPath).toString();
    const ordererTlsCACert = fs.readFileSync(ordererTlsCACertPath).toString();

    return {
        name: `healthchain-${orgDomain}`,
        version: '1.0.0',
        client: { organization: orgDomain },
        organizations: {
            [orgDomain]: {
                mspid: getOrgDetails(orgRole).mspId,
                peers: [`peer0.${orgDomain}.healthchain.com`],
            },
        },
        peers: {
            [`peer0.${orgDomain}.healthchain.com`]: {
                url: `grpcs://localhost:${port}`,
                tlsCACerts: { pem: tlsCACert },
                grpcOptions: {
                    'ssl-target-name-override': `peer0.${orgDomain}.healthchain.com`,
                    'hostnameOverride': `peer0.${orgDomain}.healthchain.com`,
                },
            },
        },
        orderers: {
            'orderer.orderer.healthchain.com': {
                url: 'grpcs://localhost:7050',
                tlsCACerts: { pem: ordererTlsCACert },
                grpcOptions: { 'ssl-target-name-override': 'orderer.orderer.healthchain.com' },
            },
        },
    };
}

module.exports = {
    CHANNEL_NAME,
    CHAINCODE_NAME,
    CRYPTO_PATH,
    getOrgDetails,
    buildCCP
};
