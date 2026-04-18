'use strict';
const { getPDCName, verifyIdentity, createAuditLog, getTimestamp } = require('./utils');

class LabFunctions {
  static async viewLabOrders(ctx, labOrg) {
    verifyIdentity(ctx, 'LabOrgMSP');
    
    // Use targeted key prefix instead of full world-state scan
    const iterator = await ctx.stub.getStateByRange('ORD', 'ORD\uffff');
    const orders = [];
    let result = await iterator.next();
    while (!result.done) {
      try {
        const record = JSON.parse(result.value.value.toString());
        if (record.docType === 'labOrder' && record.status === 'ordered') {
          orders.push(record);
        }
      } catch (e) {
        // Skip non-JSON or malformed entries
      }
      result = await iterator.next();
    }
    await iterator.close();
    return JSON.stringify(orders);
  }

  static async uploadLabReport(ctx, reportId, orderId, patientId, testType, resultsJSON, s3Key, fileHash) {
    verifyIdentity(ctx, 'LabOrgMSP');
    const results = JSON.parse(resultsJSON);
    
    // Get order to determine which hospital PDC to use
    const orderBytes = await ctx.stub.getState(orderId);
    const order = JSON.parse(orderBytes.toString());
    
    const report = {
      docType: 'labReport',
      reportId,
      orderId,
      patientId,
      hospitalOrg: order.hospitalOrg,
      labOrg: ctx.clientIdentity.getMSPID(),
      technicianId: ctx.clientIdentity.getID(),
      testType,
      results,
      s3Key,
      fileHash,
      status: 'completed',
      completedAt: getTimestamp(ctx)
    };
    
    // Store in hospital-specific lab PDC
    const pdcName = getPDCName('LabReports', order.hospitalOrg);
    await ctx.stub.putPrivateData(pdcName, reportId, Buffer.from(JSON.stringify(report)));
    
    // Update order status
    order.status = 'completed';
    await ctx.stub.putState(orderId, Buffer.from(JSON.stringify(order)));
    
    await createAuditLog(ctx, {
      action: 'UPLOAD_LAB_REPORT',
      patientId,
      reportId,
      testType,
      results,
      s3Key,
      fileHash,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });
    
    return JSON.stringify(report);
  }

  static async getLabReport(ctx, reportId) {
    // Try both hospital PDCs
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    for (const hospital of hospitals) {
      const pdcName = getPDCName('LabReports', hospital);
      try {
        const reportBytes = await ctx.stub.getPrivateData(pdcName, reportId);
        if (reportBytes && reportBytes.length > 0) {
          return reportBytes.toString();
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error(`Report ${reportId} not found`);
  }
}

module.exports = LabFunctions;
