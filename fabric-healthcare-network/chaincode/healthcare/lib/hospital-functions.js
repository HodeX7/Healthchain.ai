'use strict';

const { createAuditLog, getPDCName, verifyIdentity, getConsent, getTimestamp } = require('./utils');

class HospitalFunctions {
  
  static async requestAccess(ctx, patientId) {
    // Verify caller is from a hospital
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (!callerMSP.includes('Hospital')) {
      throw new Error('Only hospitals can request access');
    }
    
    // Verify patient exists
    const patientBytes = await ctx.stub.getState(patientId);
    if (!patientBytes || patientBytes.length === 0) {
      throw new Error(`Patient ${patientId} does not exist`);
    }
    
    // Create access request (stored on public ledger)
    const requestKey = `ACCESS_REQUEST_${patientId}_${callerMSP}`;
    const request = {
      docType: 'accessRequest',
      patientId,
      hospitalOrg: callerMSP,
      status: 'pending',
      requestedAt: getTimestamp(ctx),
      requestedBy: ctx.clientIdentity.getID()
    };
    
    await ctx.stub.putState(requestKey, Buffer.from(JSON.stringify(request)));
    
    // Emit event so patient can be notified
    ctx.stub.setEvent('AccessRequested', Buffer.from(JSON.stringify({
      patientId,
      hospitalOrg: callerMSP,
      requestedAt: request.requestedAt
    })));
    
    return JSON.stringify(request);
  }

  static async checkConsent(ctx, patientId, hospitalOrg) {
    const consentKey = `CONSENT_${patientId}_${hospitalOrg}`;
    const consentBytes = await ctx.stub.getState(consentKey);
    
    if (!consentBytes || consentBytes.length === 0) {
      return JSON.stringify({ hasConsent: false });
    }
    
    const consent = JSON.parse(consentBytes.toString());
    
    return JSON.stringify({
      hasConsent: consent.status === 'active',
      consent
    });
  }

  static async createMedicalRecord(ctx, recordId, patientId, recordType, diagnosis, treatment, notes, s3Key, fileHash) {
    // Verify caller is from a hospital
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (!callerMSP.includes('Hospital')) {
      throw new Error('Only hospitals can create medical records');
    }
    
    // Verify consent
    const consent = await getConsent(ctx, patientId, callerMSP);
    if (!consent || consent.status !== 'active') {
      throw new Error(`No active consent for ${callerMSP}`);
    }
    
    // Create medical record
    const record = {
      docType: 'medicalRecord',
      recordId,
      patientId,
      hospitalOrg: callerMSP,
      createdBy: ctx.clientIdentity.getID(),
      recordType, // diagnosis, procedure, consultation
      diagnosis,
      treatment,
      notes,
      s3Key,
      fileHash,
      createdAt: getTimestamp(ctx),
      updatedAt: getTimestamp(ctx)
    };
    
    // Store in hospital-specific PDC
    const pdcName = getPDCName('MedicalRecords', callerMSP);
    const recordKey = `RECORD_${patientId}_${recordId}`;
    
    await ctx.stub.putPrivateData(pdcName, recordKey, Buffer.from(JSON.stringify(record)));
    
    // Create audit log
    await createAuditLog(ctx, {
      action: 'CREATE_RECORD',
      patientId,
      recordId,
      hospitalOrg: callerMSP,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    return JSON.stringify(record);
  }

  static async queryPatientRecords(ctx, patientId) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    
    // Verify consent
    const consent = await getConsent(ctx, patientId, callerMSP);
    if (!consent || consent.status !== 'active') {
      throw new Error(`No active consent for ${callerMSP}`);
    }
    
    // Get authorized PDCs from consent
    const authorizedPDCs = consent.authorizedPDCs || [];
    
    // Always include own PDC
    const ownPDC = getPDCName('MedicalRecords', callerMSP);
    if (!authorizedPDCs.includes(ownPDC)) {
      authorizedPDCs.push(ownPDC);
    }
    
    // Query authorized PDCs
    const allRecords = [];
    
    for (const pdcName of authorizedPDCs) {
      try {
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
        console.log(`Cannot query ${pdcName}:`, error.message);
      }
    }
    
    // Create audit log for read operation
    await createAuditLog(ctx, {
      action: 'READ_RECORDS',
      patientId,
      hospitalOrg: callerMSP,
      recordCount: allRecords.length,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    return JSON.stringify(allRecords);
  }

  static async orderLabTest(ctx, orderId, patientId, testType, urgency, notes) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    
    // Verify consent
    const consent = await getConsent(ctx, patientId, callerMSP);
    if (!consent || consent.status !== 'active') {
      throw new Error(`No active consent for ${callerMSP}`);
    }
    
    const order = {
      docType: 'labOrder',
      orderId,
      patientId,
      hospitalOrg: callerMSP,
      doctorId: ctx.clientIdentity.getID(),
      testType,
      urgency, // routine, urgent, stat
      status: 'ordered',
      notes,
      orderedAt: getTimestamp(ctx)
    };
    
    await ctx.stub.putState(orderId, Buffer.from(JSON.stringify(order)));
    
    // Emit event for lab
    ctx.stub.setEvent('LabTestOrdered', Buffer.from(JSON.stringify(order)));
    
    return JSON.stringify(order);
  }

  static async issuePrescription(ctx, prescriptionId, patientId, medicationsJSON, diagnosis, validUntil) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    
    // Verify consent
    const consent = await getConsent(ctx, patientId, callerMSP);
    if (!consent || consent.status !== 'active') {
      throw new Error(`No active consent for ${callerMSP}`);
    }
    
    const medications = JSON.parse(medicationsJSON);
    
    const prescription = {
      docType: 'prescription',
      prescriptionId,
      patientId,
      hospitalOrg: callerMSP,
      doctorId: ctx.clientIdentity.getID(),
      medications,
      diagnosis,
      status: 'issued',
      issuedAt: getTimestamp(ctx),
      validUntil
    };
    
    // Store in hospital-specific prescription PDC
    const pdcName = getPDCName('Prescriptions', callerMSP);
    await ctx.stub.putPrivateData(pdcName, prescriptionId, Buffer.from(JSON.stringify(prescription)));
    
    return JSON.stringify(prescription);
  }

  static async submitInsuranceClaim(ctx, claimId, patientId, treatmentDate, proceduresJSON, totalAmount) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    
    const procedures = JSON.parse(proceduresJSON);
    
    const claim = {
      docType: 'insuranceClaim',
      claimId,
      patientId,
      hospitalOrg: callerMSP,
      treatmentDate,
      procedures,
      totalAmount,
      status: 'submitted',
      submittedAt: getTimestamp(ctx)
    };
    
    // Store in hospital-specific insurance PDC
    const pdcName = getPDCName('InsuranceClaims', callerMSP);
    await ctx.stub.putPrivateData(pdcName, claimId, Buffer.from(JSON.stringify(claim)));
    
    // Emit event
    ctx.stub.setEvent('ClaimSubmitted', Buffer.from(JSON.stringify(claim)));
    
    return JSON.stringify(claim);
  }
}

module.exports = HospitalFunctions;
