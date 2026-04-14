'use strict';
const { verifyIdentity, getTimestamp, createAuditLog } = require('./utils');

class InsuranceFunctions {
  static async viewClaims(ctx, status) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');

    const claims = [];
    const iterator = await ctx.stub.getStateByRange('\x00', '~');
    let result = await iterator.next();

    while (!result.done) {
      if (result.value && result.value.value) {
        try {
          const item = JSON.parse(result.value.value.toString());
          if (item.procedures && item.totalAmount) { // it's a claim
            if (!status || item.status === status) {
              claims.push(item);
            }
          }
        } catch (e) { }
      }
      result = await iterator.next();
    }
    await iterator.close();

    return JSON.stringify(claims);
  }

  static async approveClaim(ctx, claimId, approvedAmount, notes) {
    verifyIdentity(ctx, 'InsuranceOrgMSP');

    const claimBytes = await ctx.stub.getState(claimId);
    if (!claimBytes || claimBytes.length === 0) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const claim = JSON.parse(claimBytes.toString());

    if (claim.status !== 'submitted') {
      throw new Error(`Claim ${claimId} cannot be approved. Current status: ${claim.status}`);
    }

    const timestamp = getTimestamp(ctx);

    claim.status = 'approved';
    claim.approvedAmount = parseFloat(approvedAmount);
    claim.reviewedBy = ctx.clientIdentity.getID();
    claim.reviewedAt = timestamp;
    claim.notes = notes || '';

    await ctx.stub.putState(claimId, Buffer.from(JSON.stringify(claim)));

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

    const claimBytes = await ctx.stub.getState(claimId);
    if (!claimBytes || claimBytes.length === 0) {
      throw new Error(`Claim ${claimId} not found`);
    }

    const claim = JSON.parse(claimBytes.toString());

    if (claim.status !== 'submitted') {
      throw new Error(`Claim ${claimId} cannot be denied. Current status: ${claim.status}`);
    }

    const timestamp = getTimestamp(ctx);

    claim.status = 'denied';
    claim.denialReason = reason;
    claim.reviewedBy = ctx.clientIdentity.getID();
    claim.reviewedAt = timestamp;

    await ctx.stub.putState(claimId, Buffer.from(JSON.stringify(claim)));

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
    const claimBytes = await ctx.stub.getState(claimId);
    if (!claimBytes || claimBytes.length === 0) {
      throw new Error(`Claim ${claimId} not found`);
    }

    return claimBytes.toString();
  }
}

module.exports = InsuranceFunctions;
