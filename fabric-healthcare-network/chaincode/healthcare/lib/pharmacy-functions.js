'use strict';
const { getPDCName, verifyIdentity, getTimestamp, createAuditLog } = require('./utils');

// Utility to wait for gossip propagation
function waitForGossip(ms) {
  return new Promise(resolve => {
    const start = Date.now();
    const checkInterval = setInterval(() => {
      if (Date.now() - start >= ms) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 10);
  });
}

async function readPrescriptionWithGossipWait(ctx, prescriptionId, maxAttempts = 5, waitMs = 100) {
  const hospitals = ['HospitalAOrgMSP', 'HospitalBOrgMSP'];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Try to read from all hospital PDCs
    for (const hospital of hospitals) {
      const pdcName = `collectionPrescriptions_${hospital.replace('OrgMSP', '')}`;

      try {
        const prescriptionBytes = await ctx.stub.getPrivateData(pdcName, prescriptionId);

        if (prescriptionBytes && prescriptionBytes.length > 0) {
          // Found it!
          return {
            prescription: JSON.parse(prescriptionBytes.toString()),
            pdcName: pdcName
          };
        }
      } catch (error) {
        // Not in this PDC, try next
        console.log(`Prescription ${prescriptionId} not in ${pdcName}, attempt ${attempt + 1}`);
      }
    }

    // Not found yet, wait for gossip if not last attempt
    if (attempt < maxAttempts - 1) {
      console.log(`Waiting ${waitMs}ms for gossip to propagate...`);
      await waitForGossip(waitMs);
    }
  }

  // After all attempts, still not found
  return null;
}

class PharmacyFunctions {
  static async viewPrescriptions(ctx, status) {
    verifyIdentity(ctx, 'PharmacyOrgMSP');

    const hospitals = ['HospitalAOrgMSP', 'HospitalBOrgMSP'];
    const prescriptions = [];

    // Wait a bit for any recent gossip to complete
    await waitForGossip(150);

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

    // Use retry logic with gossip wait
    const result = await readPrescriptionWithGossipWait(ctx, prescriptionId, 5, 100);

    if (!result) {
      throw new Error(`Prescription ${prescriptionId} not found after waiting for gossip synchronization. It may not exist or gossip propagation failed.`);
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
    const result = await readPrescriptionWithGossipWait(ctx, prescriptionId, 5, 100);

    if (!result) {
      throw new Error(`Prescription ${prescriptionId} not found`);
    }

    return JSON.stringify(result.prescription);
  }
}

module.exports = PharmacyFunctions;
