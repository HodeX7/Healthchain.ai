'use strict';
const { getPDCName, verifyIdentity, getTimestamp } = require('./utils');

class InsuranceFunctions {
  static async viewClaims(ctx, status) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    const claims = [];
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('InsuranceClaims', hospital);
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
        console.log(`Cannot access ${pdcName}`);
      }
    }
    
    return JSON.stringify(claims);
  }

  static async approveClaim(ctx, claimId, approvedAmount, notes) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('InsuranceClaims', hospital);
      try {
        const claimBytes = await ctx.stub.getPrivateData(pdcName, claimId);
        if (claimBytes && claimBytes.length > 0) {
          const claim = JSON.parse(claimBytes.toString());
          claim.status = 'approved';
          claim.approvedAmount = approvedAmount;
          claim.reviewedBy = ctx.clientIdentity.getID();
          claim.reviewedAt = getTimestamp(ctx);
          claim.notes = notes;
          
          await ctx.stub.putPrivateData(pdcName, claimId, Buffer.from(JSON.stringify(claim)));
          
          ctx.stub.setEvent('ClaimApproved', Buffer.from(JSON.stringify(claim)));
          return JSON.stringify(claim);
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Claim ${claimId} not found`);
  }

  static async denyClaim(ctx, claimId, reason) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    
    for (const hospital of hospitals) {
      const pdcName = getPDCName('InsuranceClaims', hospital);
      try {
        const claimBytes = await ctx.stub.getPrivateData(pdcName, claimId);
        if (claimBytes && claimBytes.length > 0) {
          const claim = JSON.parse(claimBytes.toString());
          claim.status = 'denied';
          claim.denialReason = reason;
          claim.reviewedBy = ctx.clientIdentity.getID();
          claim.reviewedAt = getTimestamp(ctx);
          
          await ctx.stub.putPrivateData(pdcName, claimId, Buffer.from(JSON.stringify(claim)));
          
          ctx.stub.setEvent('ClaimDenied', Buffer.from(JSON.stringify(claim)));
          return JSON.stringify(claim);
        }
      } catch (error) {
        continue;
      }
    }
    
    throw new Error(`Claim ${claimId} not found`);
  }

  static async getClaim(ctx, claimId) {
    const { hospitals } = await require('./utils').getNetworkMetadata(ctx);
    for (const hospital of hospitals) {
      const pdcName = getPDCName('InsuranceClaims', hospital);
      try {
        const claimBytes = await ctx.stub.getPrivateData(pdcName, claimId);
        if (claimBytes && claimBytes.length > 0) {
          return claimBytes.toString();
        }
      } catch (error) {
        continue;
      }
    }
    throw new Error(`Claim ${claimId} not found`);
  }
}

module.exports = InsuranceFunctions;
