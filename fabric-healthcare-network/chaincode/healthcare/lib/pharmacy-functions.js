'use strict';
const { getPDCName, verifyIdentity, getTimestamp } = require('./utils');

class PharmacyFunctions {
  static async viewPrescriptions(ctx, status) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    const prescriptions = [];
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('Prescriptions', hospital);
      try {
        const iterator = await ctx.stub.getPrivateDataByRange(pdcName, '', '');
        let result = await iterator.next();
        while (!result.done) {
          const prescription = JSON.parse(result.value.value.toString());
          if (!status || prescription.status === status) {
            prescriptions.push(prescription);
          }
          result = await iterator.next();
        }
        await iterator.close();
      } catch (error) {
        console.log(`Cannot access ${pdcName}`);
      }
    }
    
    return JSON.stringify(prescriptions);
  }

  static async fulfillPrescription(ctx, prescriptionId) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('Prescriptions', hospital);
      try {
        const prescriptionBytes = await ctx.stub.getPrivateData(pdcName, prescriptionId);
        if (prescriptionBytes && prescriptionBytes.length > 0) {
          const prescription = JSON.parse(prescriptionBytes.toString());
          prescription.status = 'fulfilled';
          prescription.fulfilledBy = ctx.clientIdentity.getID();
          prescription.fulfilledAt = getTimestamp(ctx);
          
          await ctx.stub.putPrivateData(pdcName, prescriptionId, Buffer.from(JSON.stringify(prescription)));
          return JSON.stringify(prescription);
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Prescription ${prescriptionId} not found`);
  }

  static async getPrescription(ctx, prescriptionId) {
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    for (const hospital of hospitals) {
      const pdcName = getPDCName('Prescriptions', hospital);
      try {
        const prescriptionBytes = await ctx.stub.getPrivateData(pdcName, prescriptionId);
        if (prescriptionBytes && prescriptionBytes.length > 0) {
          return prescriptionBytes.toString();
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error(`Prescription ${prescriptionId} not found`);
  }
}

module.exports = PharmacyFunctions;
