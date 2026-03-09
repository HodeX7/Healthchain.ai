'use strict';
const { getPDCName, verifyIdentity, getTimestamp, createAuditLog, getNetworkMetadata } = require('./utils');

// Utility to read from multiple hospital PDCs
async function readPrescriptionFromPDCs(ctx, prescriptionId) {
  const metadata = await getNetworkMetadata(ctx);
  const hospitals = metadata.hospitals || ['HospitalAOrgMSP', 'HospitalBOrgMSP'];

  for (const hospital of hospitals) {
    const pdcName = `collectionPrescriptions_${hospital.replace('OrgMSP', '')}`;

    try {
      const prescriptionBytes = await ctx.stub.getPrivateData(pdcName, prescriptionId);

      if (prescriptionBytes && prescriptionBytes.length > 0) {
        return {
          prescription: JSON.parse(prescriptionBytes.toString()),
          pdcName: pdcName
        };
      }
    } catch (error) {
      // Log and continue to next PDC
      console.log(`Prescription ${prescriptionId} not found in ${pdcName}`);
    }
  }

  return null;
}

class PharmacyFunctions {
  static async viewPrescriptions(ctx, status) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');

    const metadata = await getNetworkMetadata(ctx);
    const hospitals = metadata.hospitals || ['HospitalAOrgMSP', 'HospitalBOrgMSP'];
    const prescriptions = [];

    for (const hospital of hospitals) {
      const pdcName = `collectionPrescriptions_${hospital.replace('OrgMSP', '')}`;

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
        console.log(`Cannot access ${pdcName}: ${error.message}`);
      }
    }

    return JSON.stringify(prescriptions);
  }

  static async fulfillPrescription(ctx, prescriptionId) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');

    // Read from PDCs
    const result = await readPrescriptionFromPDCs(ctx, prescriptionId);

    if (!result) {
      throw new Error(`Prescription ${prescriptionId} not found. If this was just issued, please retry after a second to allow for gossip synchronization.`);
    }

    const { prescription, pdcName } = result;

    // Verify prescription is in 'issued' status
    if (prescription.status !== 'issued') {
      throw new Error(`Prescription ${prescriptionId} cannot be fulfilled. Current status: ${prescription.status}`);
    }

    // Update prescription
    prescription.status = 'fulfilled';
    prescription.fulfilledBy = ctx.clientIdentity.getID();
    prescription.fulfilledAt = getTimestamp(ctx);

    await ctx.stub.putPrivateData(pdcName, prescriptionId, Buffer.from(JSON.stringify(prescription)));

    // Create audit log
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
    const result = await readPrescriptionFromPDCs(ctx, prescriptionId);

    if (!result) {
      throw new Error(`Prescription ${prescriptionId} not found`);
    }

    return JSON.stringify(result.prescription);
  }
}

module.exports = PharmacyFunctions;
