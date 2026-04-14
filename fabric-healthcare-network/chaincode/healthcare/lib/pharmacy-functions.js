'use strict';
const { verifyIdentity, getTimestamp, createAuditLog } = require('./utils');

class PharmacyFunctions {
  static async viewPrescriptions(ctx, status) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');

    const prescriptions = [];
    const iterator = await ctx.stub.getStateByRange('PRES', 'PRET');

    // In our tests, keys are like RX001, PRES001, so we should just search all keys 
    // Wait, the tests use keys like "PRES001", "RX001", "PRES_B001", etc.
    // getStateByRange('', '') gets everything. Since we just have prescriptions and claims,
    // we can iterate over them all OR just iterate everything and filter by type?
    // Actually, `issuePrescription` creates it with custom IDs like PRES001, RX001. 
    // Without a composite key, getStateByRange('', '') will return EVERYTHING in public state (which could include some other things if we are not careful).
    // Let's filter by checking if the object has `medications` array (which implies a prescription).

    // Better: let's scan all keys
    const allIterator = await ctx.stub.getStateByRange('', '~');
    let result = await allIterator.next();

    while (!result.done) {
      if (result.value && result.value.value) {
        try {
          const item = JSON.parse(result.value.value.toString());
          if (item.medications) { // it's a prescription
            if (!status || item.status === status) {
              prescriptions.push(item);
            }
          }
        } catch (e) { }
      }
      result = await allIterator.next();
    }
    await allIterator.close();

    return JSON.stringify(prescriptions);
  }

  static async fulfillPrescription(ctx, prescriptionId) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');

    const prescriptionBytes = await ctx.stub.getState(prescriptionId);
    if (!prescriptionBytes || prescriptionBytes.length === 0) {
      throw new Error(`Prescription ${prescriptionId} not found`);
    }

    const prescription = JSON.parse(prescriptionBytes.toString());

    if (prescription.status !== 'issued') {
      throw new Error(`Prescription ${prescriptionId} cannot be fulfilled. Current status: ${prescription.status}`);
    }

    prescription.status = 'fulfilled';
    prescription.fulfilledBy = ctx.clientIdentity.getID();
    prescription.fulfilledAt = getTimestamp(ctx);

    await ctx.stub.putState(prescriptionId, Buffer.from(JSON.stringify(prescription)));

    await createAuditLog(ctx, {
      action: 'FULFILL_PRESCRIPTION',
      prescriptionId,
      patientId: prescription.patientId,
      actor: ctx.clientIdentity.getID(),
      timestamp: getTimestamp(ctx)
    });

    ctx.stub.setEvent('PrescriptionFulfilled', Buffer.from(JSON.stringify({
      prescriptionId,
      fulfilledAt: prescription.fulfilledAt
    })));

    return JSON.stringify(prescription);
  }

  static async getPrescription(ctx, prescriptionId) {
    const prescriptionBytes = await ctx.stub.getState(prescriptionId);
    if (!prescriptionBytes || prescriptionBytes.length === 0) {
      throw new Error(`Prescription ${prescriptionId} not found`);
    }

    return prescriptionBytes.toString();
  }
}

module.exports = PharmacyFunctions;
