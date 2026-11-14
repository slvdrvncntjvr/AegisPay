// Correct only the never-provisioned independent local setup to the public
// account explicitly supplied by its human owner. No signature or chain write.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { StrKey } from '@stellar/stellar-sdk';
import { createNoir, readTestnetConfig } from '../../../src/server/integrations/noir.ts';
import { localCustody, privateEnv, writePrivate, serialize, PUBLIC_PROPOSAL } from './context.mjs';
const owner = 'GAXQOA4O5YZHOXJP2TFDOA6RFKL3UXVUH3XGFEL3GMGBM3V32FRENZS7';
if (process.argv.length !== 3 || process.argv[2] !== '--select-user-provided-owner') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_CONFIRMED_PUBLIC_OWNER_REQUIRED' })); process.exitCode = 2;
} else {
  let local;
  const report = { observedAt: new Date().toISOString(), scope: 'unprovisioned-local-owner-address-correction', ownerPublicKey: owner, chainWrites: 0, financialSubmissions: 0 };
  try {
    if (!StrKey.isValidEd25519PublicKey(owner)) throw Error('VALID_PUBLIC_OWNER_REQUIRED');
    local = await localCustody();
    const prior = JSON.parse(readFileSync(PUBLIC_PROPOSAL, 'utf8'));
    const web = privateEnv('.env.release.web.local'), worker = privateEnv('.env.release.worker.local');
    if (existsSync('deployment/finals/local-release/context-current.json') || web.DEMO_OWNER_PUBLIC_KEY !== prior.ownerPublicKey || worker.DEMO_OWNER_PUBLIC_KEY !== prior.ownerPublicKey ||
      new Set([owner, prior.agentPublicKey, prior.merchantPublicKey]).size !== 3) throw Error('EXACT_INITIAL_OWNER_CORRECTION_REQUIRED');
    const noir = createNoir(readTestnetConfig(web));
    const [deviceOwner, deviceAgent, policy, escrow] = await Promise.all([noir.getDeviceOwner(prior.deviceHash), noir.getDeviceAgent(prior.deviceHash), noir.getPolicy(prior.deviceHash), noir.getEscrowBalance(prior.deviceHash)]);
    if (deviceOwner !== null || deviceAgent !== null || policy !== null || escrow !== 0n) throw Error('EXISTING_CHAIN_CONTEXT_CANNOT_BE_RETARGETED');
    const response = await fetch('https://horizon-testnet.stellar.org/accounts/' + owner, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (response.status !== 200 || (await response.json()).account_id !== owner) throw Error('ACTUAL_TESTNET_OWNER_REQUIRED');
    // Save before mutation so an interrupted correction is reconciled by identity.
    writePrivate('.fmd-work/release-setup/owner-correction-attempt.json', JSON.stringify({ previousOwner: prior.ownerPublicKey, newOwner: owner, deviceHash: prior.deviceHash, recordedAt: new Date().toISOString() }) + '\n', true);
    const client = await local.pool.connect();
    try {
      await client.query('BEGIN');
      const agents = (await client.query('SELECT id,owner_id,public_key,device_hash,status,last_nonce::text,policy_max_stroops::text FROM agent FOR UPDATE')).rows;
      if (agents.length !== 1 || agents[0].public_key !== prior.agentPublicKey || agents[0].device_hash !== prior.deviceHash || agents[0].status !== 'unprovisioned' || agents[0].last_nonce !== '0' || agents[0].policy_max_stroops !== '0') throw Error('NEVER_PROVISIONED_AGENT_REQUIRED');
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim','job']) if (Number((await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n) !== 0) throw Error('FINANCIAL_OR_EXECUTION_HISTORY_CANNOT_BE_RETARGETED');
      const wallets = (await client.query('SELECT id,actor_address,status,handoff_committed_at,tx_hash FROM wallet_operation FOR UPDATE')).rows;
      if (wallets.length !== 1 || wallets[0].id !== '4b494ed6-f71b-4f90-bcfe-b1aa480420a4' || wallets[0].actor_address !== prior.ownerPublicKey || wallets[0].status !== 'expired' || wallets[0].handoff_committed_at !== null || wallets[0].tx_hash !== null) throw Error('EXACT_EXPIRED_UNSIGNED_HISTORY_REQUIRED');
      const changed = await client.query('UPDATE owner SET wallet_address=$1 WHERE id=$2 AND wallet_address=$3 RETURNING id', [owner, agents[0].owner_id, prior.ownerPublicKey]);
      if (changed.rowCount !== 1) throw Error('EXACT_OWNER_METADATA_REQUIRED');
      await client.query('COMMIT');
      report.ownerId = changed.rows[0].id; report.agentIdentityUnchanged = true; report.expiredPreparationPreservedUnchanged = true;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    web.DEMO_OWNER_PUBLIC_KEY = owner; worker.DEMO_OWNER_PUBLIC_KEY = owner;
    writePrivate('.env.release.web.local', serialize(web)); writePrivate('.env.release.worker.local', serialize(worker));
    const current = { ...prior, ownerPublicKey: owner, ownerWalletControl: 'user-provided-current-Freighter-public-account', ownerSelectedAt: new Date().toISOString(),
      previousOwnerPublicKey: prior.ownerPublicKey, previousUnsignedPreparation: '4b494ed6-f71b-4f90-bcfe-b1aa480420a4', previousPreparationStatus: 'expired-no-handoff',
      agentId: '23d4540c-fe96-494b-9a54-41fcad4dad4a', databaseSeeded: true, deviceRegistered: false };
    writeFileSync('deployment/finals/local-release/context-current.json', JSON.stringify(current, null, 2) + '\n', { flag: 'wx' });
    const accessFile = '.fmd-work/release-setup/access.md';
    writePrivate(accessFile, readFileSync(accessFile, 'utf8').replaceAll(prior.ownerPublicKey, owner));
    Object.assign(report, { status: 'passed', setupStage: 'register-device-with-current-Freighter-owner', priorOwnerPublicKey: prior.ownerPublicKey,
      currentChainOwner: deviceOwner, currentEscrowStroops: '0', originalIncidentChanged: false, loginTokensUnchanged: true });
  } catch (error) { Object.assign(report, { status: 'not_completed_or_uncertain', code: /^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'OWNER_SELECTION_INCOMPLETE_RECONCILE_EXACT_RECORDS' }); process.exitCode = 1; }
  finally { await local?.pool.end(); writeFileSync('docs/evidence/wallet-recovery-2026-11-14/owner-selection.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(report)); }
}
