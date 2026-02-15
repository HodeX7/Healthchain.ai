'use strict';

const { createAuditLog, getPDCName, verifyIdentity, verifyPatientOwnership, getNetworkMetadata, getTimestamp } = require('./utils');

class PatientFunctions {
  static async getNetworkMetadata(ctx) {
     return require('./utils').getNetworkMetadata(ctx);
  }

  
  static async registerPatient(ctx, patientId, firstName, lastName, dateOfBirth, bloodGroup, email, phone) {
    // Verify caller is from PatientOrg
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    // Check if patient already exists
    const existingPatient = await ctx.stub.getState(patientId);
    if (existingPatient && existingPatient.length > 0) {
      throw new Error(`Patient ${patientId} already exists`);
    }
    
    // Create patient record (stored on public ledger)
    const patient = {
      docType: 'patient',
      patientId,
      firstName,
      lastName,
      dateOfBirth,
      bloodGroup,
      email,
      phone,
      createdAt: getTimestamp(ctx),
      updatedAt: getTimestamp(ctx)
    };
    
    await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
    
    // Create audit log
    await createAuditLog(ctx, {
      action: 'REGISTER_PATIENT',
      patientId,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    return JSON.stringify(patient);
  }

  static async getPatient(ctx, patientId) {
    const patientBytes = await ctx.stub.getState(patientId);
    
    if (!patientBytes || patientBytes.length === 0) {
      throw new Error(`Patient ${patientId} does not exist`);
    }
    
    return patientBytes.toString();
  }

  static async updatePatientProfile(ctx, patientId, updatesJSON) {
    // Verify caller is the patient or admin
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    const patientBytes = await ctx.stub.getState(patientId);
    if (!patientBytes || patientBytes.length === 0) {
      throw new Error(`Patient ${patientId} does not exist`);
    }
    
    const patient = JSON.parse(patientBytes.toString());
    const updates = JSON.parse(updatesJSON);
    
    // Update allowed fields
    const allowedFields = ['email', 'phone', 'address'];
    for (const field of allowedFields) {
      if (updates[field]) {
        patient[field] = updates[field];
      }
    }
    
    patient.updatedAt = getTimestamp(ctx);
    
    await ctx.stub.putState(patientId, Buffer.from(JSON.stringify(patient)));
    
    return JSON.stringify(patient);
  }

  static async grantAccess(ctx, patientId, hospitalOrg, authorizedPDCsJSON) {
    // Verify caller is the patient
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    // Verify patient ownership
    verifyPatientOwnership(ctx, patientId);
    
    // Verify patient exists
    const patientBytes = await ctx.stub.getState(patientId);
    if (!patientBytes || patientBytes.length === 0) {
      throw new Error(`Patient ${patientId} does not exist`);
    }
    
    // Parse authorized PDCs
    const authorizedPDCs = JSON.parse(authorizedPDCsJSON);
    
    // Create consent record
    const consentKey = `CONSENT_${patientId}_${hospitalOrg}`;
    const consent = {
      docType: 'consent',
      patientId,
      hospitalOrg,
      status: 'active',
      authorizedPDCs, // List of PDCs hospital can access
      grantedAt: getTimestamp(ctx),
      revokedAt: null,
      grantedBy: ctx.clientIdentity.getID()
    };
    
    await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(consent)));
    
    // Create audit log
    await createAuditLog(ctx, {
      action: 'GRANT_ACCESS',
      patientId,
      hospitalOrg,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    // Emit event
    ctx.stub.setEvent('AccessGranted', Buffer.from(JSON.stringify({
      patientId,
      hospitalOrg,
      grantedAt: consent.grantedAt
    })));
    
    return JSON.stringify(consent);
  }

  static async revokeAccess(ctx, patientId, hospitalOrg) {
    // Verify caller is the patient
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    // Verify patient ownership
    verifyPatientOwnership(ctx, patientId);
    
    const consentKey = `CONSENT_${patientId}_${hospitalOrg}`;
    const consentBytes = await ctx.stub.getState(consentKey);
    
    if (!consentBytes || consentBytes.length === 0) {
      throw new Error(`No consent found for ${hospitalOrg}`);
    }
    
    const consent = JSON.parse(consentBytes.toString());
    
    // Update consent status
    consent.status = 'revoked';
    consent.revokedAt = getTimestamp(ctx);
    consent.revokedBy = ctx.clientIdentity.getID();
    
    await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(consent)));
    
    // Create audit log
    await createAuditLog(ctx, {
      action: 'REVOKE_ACCESS',
      patientId,
      hospitalOrg,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    // Emit event
    ctx.stub.setEvent('AccessRevoked', Buffer.from(JSON.stringify({
      patientId,
      hospitalOrg,
      revokedAt: consent.revokedAt
    })));
    
    return JSON.stringify(consent);
  }

  static async getMyConsents(ctx, patientId) {
    // Verify caller is the patient
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    // Query all consents for this patient
    const startKey = `CONSENT_${patientId}_`;
    const endKey = `CONSENT_${patientId}_\uffff`;
    
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    const consents = [];
    
    let result = await iterator.next();
    while (!result.done) {
      const consent = JSON.parse(result.value.value.toString());
      consents.push(consent);
      result = await iterator.next();
    }
    
    await iterator.close();
    
    return JSON.stringify(consents);
  }

  static async getMyMedicalRecords(ctx, patientId) {
    // Verify caller is the patient
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    // Verify patient ownership
    verifyPatientOwnership(ctx, patientId);
    
    // Patient can query ALL hospital PDCs (they're members of all)
    const { hospitals } = await this.getNetworkMetadata(ctx);
    const allRecords = [];
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('MedicalRecords', hospital);
      
      try {
        // Query this hospital's PDC
        const startKey = `RECORD_${patientId}_`;
        const endKey = `RECORD_${patientId}_\uffff`;
        
        const iterator = await ctx.stub.getPrivateDataByRange(pdcName, startKey, endKey);
        
        let result = await iterator.next();
        while (!result.done) {
          const record = JSON.parse(result.value.value.toString());
          allRecords.push(record);
          result = await iterator.next();
        }
        
        await iterator.close();
      } catch (error) {
        console.log(`No data in ${pdcName}:`, error.message);
      }
    }
    
    return JSON.stringify(allRecords);
  }

  static async getAuditLog(ctx, patientId) {
    // Verify caller is the patient
    verifyIdentity(ctx, 'PatientOrgMSP');
    
    const startKey = `AUDIT_${patientId}_`;
    const endKey = `AUDIT_${patientId}_\uffff`;
    
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    const logs = [];
    
    let result = await iterator.next();
    while (!result.done) {
      const log = JSON.parse(result.value.value.toString());
      logs.push(log);
      result = await iterator.next();
    }
    
    await iterator.close();
    
    return JSON.stringify(logs);
  }
}

module.exports = PatientFunctions;
