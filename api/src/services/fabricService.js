const { Gateway, Wallets } = require('fabric-network');
const fs = require('fs');
const path = require('path');
const { CHANNEL_NAME, CHAINCODE_NAME, CRYPTO_PATH, getOrgDetails, buildCCP } = require('../config/fabricConfig');

class FabricService {

    // In a real app, users would be registered dynamically. 
    // Here we use the pre-generated 'User1' identity for the selected org.
    static async buildWallet(orgRole, userId = 'User1') {
        const wallet = await Wallets.newInMemoryWallet();
        const mspId = getOrgDetails(orgRole).mspId;
        const orgDomain = orgRole;

        const userPath = path.join(CRYPTO_PATH, `${orgDomain}.healthchain.com`, 'users', `${userId}@${orgDomain}.healthchain.com`, 'msp');

        if (!fs.existsSync(userPath)) {
            throw new Error(`Identity for ${userId} at ${orgRole} does not exist in the local crypto folder. (Path: ${userPath})`);
        }

        const certPath = path.join(userPath, 'signcerts');
        const keyPath = path.join(userPath, 'keystore');

        const certFile = fs.readdirSync(certPath)[0];
        const keyFile = fs.readdirSync(keyPath)[0];

        const certificate = fs.readFileSync(path.join(certPath, certFile)).toString();
        const privateKey = fs.readFileSync(path.join(keyPath, keyFile)).toString();

        const identity = { credentials: { certificate, privateKey }, mspId, type: 'X.509' };
        await wallet.put(userId, identity);

        return wallet;
    }

    static async connectToNetwork(orgRole, userId = 'User1') {
        const ccp = buildCCP(orgRole);
        const wallet = await this.buildWallet(orgRole, userId);

        const gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: userId,
            discovery: { enabled: false, asLocalhost: true },
        });

        const network = await gateway.getNetwork(CHANNEL_NAME);
        const contract = network.getContract(CHAINCODE_NAME);

        return { gateway, contract };
    }

    // Use query() for fast read operations
    static async query(orgRole, userId, functionName, ...args) {
        let gateway;
        try {
            const networkConn = await this.connectToNetwork(orgRole, userId);
            gateway = networkConn.gateway;
            const contract = networkConn.contract;

            const safeArgs = args.map(arg => arg === undefined || arg === null ? '' : String(arg));
            const result = await contract.evaluateTransaction(functionName, ...safeArgs);
            return JSON.parse(result.toString() || 'null');
        } catch (error) {
            console.error(`Query Error [${functionName}]:`, error.message);
            throw new Error(error.message);
        } finally {
            if (gateway) gateway.disconnect();
        }
    }

    // Use invoke() for state-changing operations
    static async invoke(orgRole, userId, functionName, ...args) {
        let gateway;
        try {
            const networkConn = await this.connectToNetwork(orgRole, userId);
            gateway = networkConn.gateway;
            const contract = networkConn.contract;

            const safeArgs = args.map(arg => arg === undefined || arg === null ? '' : String(arg));
            const result = await contract.submitTransaction(functionName, ...safeArgs);
            return (result && result.toString()) ? JSON.parse(result.toString()) : { success: true };
        } catch (error) {
            console.error(`Invoke Error [${functionName}]:`, error.message);
            throw new Error(error.message);
        } finally {
            if (gateway) gateway.disconnect();
        }
    }
}

module.exports = FabricService;
