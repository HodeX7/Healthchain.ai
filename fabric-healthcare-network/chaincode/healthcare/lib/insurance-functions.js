'use strict';
const { getPDCName, verifyIdentity, getTimestamp, createAuditLog, getNetworkMetadata } = require('./utils');

async function readClaimFromPDCs(ctx, claimId) {
  const metadata = await getNetworkMetadata(ctx);
  const hospitals = metadata.hospitals || ['HospitalAOrgMSP', 'HospitalBOrgMSP'];
  
  for (const hospital of hospitals) {
    const pdcName = `collectionInsuranceClaims_${hospital.replace('OrgMSP', '')}`;
    
    try {
      const claimBytes = await ctx.stub.getPrivateData(pdcName, claimId);
      
      if (claimBytes && claimBytes.length > 0) {
        return {
          claim: JSON.parse(claimBytes.toString()),
          pdcName: pdcName
        };
      }
    } catch (error) {
      console.log(`Claim ${claimId} not found in ${pdcName}`);
    }
  }
  
  return null;
}

class InsuranceFunctions {
  static async viewClaims(ctx, status) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    
    const metadata = await getNetworkMetadata(ctx);
    const hospitals = metadata.hospitals || ['HospitalAOrgMSP', 'HospitalBOrgMSP'];
    const claims = [];
    
    for (const hospital of hospitals) {
      const pdcName = `collectionInsuranceClaims_${hospital.replace('OrgMSP', '')}`;
      
      try {
        const iterator = await ctx.stub.getPrivateDataByRange(pdcName, '', '');
        let result = await iterator.next();
        
        while (!result.done) {
          const claim = JSON.parse(result.value.value.toString());
          if (!status || claim.status === status) {
            claims.push(claim);
          }
          result = await iterator.next();
        }
        
        await iterator.close();
      } catch (error) {
        console.log(`Cannot access ${pdcName}: ${error.message}`);
      }
    }
    
    return JSON.stringify(claims);
  }

  static async approveClaim(ctx, claimId, approvedAmount, notes) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    
    const result = await readClaimFromPDCs(ctx, claimId);
    
    if (!result) {
      throw new Error(`Claim ${claimId} not found. Please retry after a second to allow for gossip synchronization.`);
    }
    
    const { claim, pdcName } = result;
    
    if (claim.status !== 'submitted') {
      throw new Error(`Claim ${claimId} cannot be approved. Current status: ${claim.status}`);
    }
    
    const timestamp = getTimestamp(ctx);
    
    claim.status = 'approved';
    claim.approvedAmount = parseFloat(approvedAmount);
    claim.reviewedBy = ctx.clientIdentity.getID();
    claim.reviewedAt = timestamp;
    claim.notes = notes || '';
    
    await ctx.stub.putPrivateData(pdcName, claimId, Buffer.from(JSON.stringify(claim)));
    
    await createAuditLog(ctx, {
      action: 'APPROVE_CLAIM',
      claimId,
      patientId: claim.patientId,
      approvedAmount: claim.approvedAmount,
      actor: ctx.clientIdentity.getID(),
      timestamp: timestamp
    });
    
    ctx.stub.setEvent('ClaimApproved', Buffer.from(JSON.stringify({
      claimId,
      approvedAmount: claim.approvedAmount,
      approvedAt: claim.reviewedAt
    })));
    
    return JSON.stringify(claim);
  }

  static async denyClaim(ctx, claimId, reason) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    
    const result = await readClaimFromPDCs(ctx, claimId);
    
    if (!result) {
      throw new Error(`Claim ${claimId} not found. Please retry after a second to allow for gossip synchronization.`);
    }
    
    const { claim, pdcName } = result;
    
    if (claim.status !== 'submitted') {
      throw new Error(`Claim ${claimId} cannot be denied. Current status: ${claim.status}`);
    }
    
    const timestamp = getTimestamp(ctx);
    
    claim.status = 'denied';
    claim.denialReason = reason;
    claim.reviewedBy = ctx.clientIdentity.getID();
    claim.reviewedAt = timestamp;
    
    await ctx.stub.putPrivateData(pdcName, claimId, Buffer.from(JSON.stringify(claim)));
    
    await createAuditLog(ctx, {
      action: 'DENY_CLAIM',
      claimId,
      patientId: claim.patientId,
      denialReason: reason,
      actor: ctx.clientIdentity.getID(),
      timestamp: timestamp
    });
    
    ctx.stub.setEvent('ClaimDenied', Buffer.from(JSON.stringify({
      claimId,
      deniedAt: claim.reviewedAt,
      reason
    })));
    
    return JSON.stringify(claim);
  }

  static async getClaim(ctx, claimId) {
    const result = await readClaimFromPDCs(ctx, claimId);
    
    if (!result) {
      throw new Error(`Claim ${claimId} not found`);
    }
    
    return JSON.stringify(result.claim);
  }
}

module.exports = InsuranceFunctions;
