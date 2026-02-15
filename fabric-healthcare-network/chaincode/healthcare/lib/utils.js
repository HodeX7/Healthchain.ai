'use strict';

class Utils {
  static getPDCName(dataType, hospitalOrg) {
    const hospitalName = hospitalOrg.replace('OrgMSP', '');
    return `collection${dataType}_${hospitalName}`;
  }

  static verifyIdentity(ctx, expectedMSP) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    if (callerMSP !== expectedMSP) {
      throw new Error(`Unauthorized: Expected ${expectedMSP}, got ${callerMSP}`);
    }
  }

  static async getConsent(ctx, patientId, hospitalOrg) {
    const consentKey = `CONSENT_${patientId}_${hospitalOrg}`;
    const consentBytes = await ctx.stub.getState(consentKey);
    
    if (!consentBytes || consentBytes.length === 0) {
      return null;
    }
    
    return JSON.parse(consentBytes.toString());
  }

  static async createAuditLog(ctx, logData) {
    const logKey = `AUDIT_${logData.patientId}_${new Date().getTime()}`;
    const log = {
      docType: 'auditLog',
      ...logData
    };
    
    await ctx.stub.putState(logKey, Buffer.from(JSON.stringify(log)));
  }

  static async getNetworkMetadata(ctx) {
    const metadataBytes = await ctx.stub.getState('NETWORK_METADATA');
    if (!metadataBytes || metadataBytes.length === 0) {
      // Fallback for initialization or if metadata is missing
      return { hospitals: ['HospitalAOrgMSP', 'HospitalBOrgMSP'] };
    }
    return JSON.parse(metadataBytes.toString());
  }

  static extractPatientIdFromIdentity(ctx) {
    // Assuming Enrollment ID (CN) acts as the patientId
    return ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');
  }

  static verifyPatientOwnership(ctx, patientId) {
    const callerMSP = ctx.clientIdentity.getMSPID();
    const enrollmentID = ctx.clientIdentity.getAttributeValue('hf.EnrollmentID');
    
    if (callerMSP !== 'PatientOrgMSP') {
      throw new Error(`Unauthorized: Only patients can access this function. Caller MSP: ${callerMSP}`);
    }
    
    if (enrollmentID !== patientId) {
      throw new Error(`Unauthorized: Access Denied. You ( ${enrollmentID} ) are trying to access data for patient: ${patientId}`);
    }
  }
}

module.exports = Utils;
