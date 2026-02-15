'use strict';

const { Contract } = require('fabric-contract-api');
const { getTimestamp } = require('./utils');
const PatientFunctions = require('./patient-functions');
const HospitalFunctions = require('./hospital-functions');
const LabFunctions = require('./lab-functions');
const PharmacyFunctions = require('./pharmacy-functions');
const InsuranceFunctions = require('./insurance-functions');

class HealthchainContract extends Contract {
  constructor() {
    super('HealthchainContract');
  }

  // Initialize ledger (called once on deployment)
  async initLedger(ctx) {
    console.info('============= START : Initialize Ledger ===========');
    
    // Store network metadata
    const networkMetadata = {
      docType: 'networkMetadata',
      version: '1.0.0',
      hospitals: ['HospitalAOrgMSP', 'HospitalBOrgMSP'],
      createdAt: getTimestamp(ctx)
    };
    
    await ctx.stub.putState('NETWORK_METADATA', Buffer.from(JSON.stringify(networkMetadata)));
    
    console.info('============= END : Initialize Ledger ===========');
    return JSON.stringify(networkMetadata);
  }

  // Update network metadata (e.g., to add new hospitals)
  async updateNetworkMetadata(ctx, hospitalsJSON) {
    console.info('============= START : Update Network Metadata ===========');
    
    // Parse new hospital list
    const hospitals = JSON.parse(hospitalsJSON);
    
    // Create updated metadata
    const networkMetadata = {
      docType: 'networkMetadata',
      version: '1.0.0', 
      hospitals: hospitals,
      updatedAt: getTimestamp(ctx)
    };
    
    // Overwrite existing state
    await ctx.stub.putState('NETWORK_METADATA', Buffer.from(JSON.stringify(networkMetadata)));
    
    console.info('============= END : Update Network Metadata ===========');
    return JSON.stringify(networkMetadata);
  }

  // ==================== PATIENT FUNCTIONS ====================
  
  async registerPatient(ctx, patientId, firstName, lastName, dateOfBirth, bloodGroup, email, phone) {
    return await PatientFunctions.registerPatient(ctx, patientId, firstName, lastName, dateOfBirth, bloodGroup, email, phone);
  }

  async getPatient(ctx, patientId) {
    return await PatientFunctions.getPatient(ctx, patientId);
  }

  async updatePatientProfile(ctx, patientId, updates) {
    return await PatientFunctions.updatePatientProfile(ctx, patientId, updates);
  }

  async grantAccess(ctx, patientId, hospitalOrg, authorizedPDCs) {
    return await PatientFunctions.grantAccess(ctx, patientId, hospitalOrg, authorizedPDCs);
  }

  async revokeAccess(ctx, patientId, hospitalOrg) {
    return await PatientFunctions.revokeAccess(ctx, patientId, hospitalOrg);
  }

  async getMyConsents(ctx, patientId) {
    return await PatientFunctions.getMyConsents(ctx, patientId);
  }

  async getMyMedicalRecords(ctx, patientId) {
    return await PatientFunctions.getMyMedicalRecords(ctx, patientId);
  }

  async getAuditLog(ctx, patientId) {
    return await PatientFunctions.getAuditLog(ctx, patientId);
  }

  // ==================== HOSPITAL FUNCTIONS ====================
  
  async requestAccess(ctx, patientId) {
    return await HospitalFunctions.requestAccess(ctx, patientId);
  }

  async checkConsent(ctx, patientId, hospitalOrg) {
    return await HospitalFunctions.checkConsent(ctx, patientId, hospitalOrg);
  }

  async createMedicalRecord(ctx, recordId, patientId, recordType, diagnosis, treatment, notes, s3Key, fileHash) {
    return await HospitalFunctions.createMedicalRecord(ctx, recordId, patientId, recordType, diagnosis, treatment, notes, s3Key, fileHash);
  }

  async queryPatientRecords(ctx, patientId) {
    return await HospitalFunctions.queryPatientRecords(ctx, patientId);
  }

  async orderLabTest(ctx, orderId, patientId, testType, urgency, notes) {
    return await HospitalFunctions.orderLabTest(ctx, orderId, patientId, testType, urgency, notes);
  }

  async issuePrescription(ctx, prescriptionId, patientId, medications, diagnosis, validUntil) {
    return await HospitalFunctions.issuePrescription(ctx, prescriptionId, patientId, medications, diagnosis, validUntil);
  }

  async submitInsuranceClaim(ctx, claimId, patientId, treatmentDate, procedures, totalAmount) {
    return await HospitalFunctions.submitInsuranceClaim(ctx, claimId, patientId, treatmentDate, procedures, totalAmount);
  }

  // ==================== LAB FUNCTIONS ====================
  
  async viewLabOrders(ctx, labOrg) {
    return await LabFunctions.viewLabOrders(ctx, labOrg);
  }

  async uploadLabReport(ctx, reportId, orderId, patientId, testType, results, s3Key, fileHash) {
    return await LabFunctions.uploadLabReport(ctx, reportId, orderId, patientId, testType, results, s3Key, fileHash);
  }

  async getLabReport(ctx, reportId) {
    return await LabFunctions.getLabReport(ctx, reportId);
  }

  // ==================== PHARMACY FUNCTIONS ====================
  
  async viewPrescriptions(ctx, status) {
    return await PharmacyFunctions.viewPrescriptions(ctx, status);
  }

  async fulfillPrescription(ctx, prescriptionId) {
    return await PharmacyFunctions.fulfillPrescription(ctx, prescriptionId);
  }

  async getPrescription(ctx, prescriptionId) {
    return await PharmacyFunctions.getPrescription(ctx, prescriptionId);
  }

  // ==================== INSURANCE FUNCTIONS ====================
  
  async viewClaims(ctx, status) {
    return await InsuranceFunctions.viewClaims(ctx, status);
  }

  async approveClaim(ctx, claimId, approvedAmount, notes) {
    return await InsuranceFunctions.approveClaim(ctx, claimId, approvedAmount, notes);
  }

  async denyClaim(ctx, claimId, reason) {
    return await InsuranceFunctions.denyClaim(ctx, claimId, reason);
  }

  async getClaim(ctx, claimId) {
    return await InsuranceFunctions.getClaim(ctx, claimId);
  }
}

module.exports = HealthchainContract;
