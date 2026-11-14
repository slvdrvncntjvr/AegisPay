// User-provided public merchant selection before ANY quote/payment/claim.
// Owner wallet operations are preserved and are never signed/submitted here.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { StrKey } from '@stellar/stellar-sdk';
import { localCustody, privateEnv, writePrivate, serialize, publicContext } from './context.mjs';
const merchant = 'GAD7HS6DXSAZG7LQRXJWGK322LORGCI2BZP5S3TQ75ATWLJQKKRTXCHK';
if (process.argv.length !== 3 || process.argv[2] !== '--select-user-provided-merchant') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_CONFIRMED_PUBLIC_MERCHANT_REQUIRED' })); process.exitCode = 2;
} else {
  let local;
  const report = { observedAt: new Date().toISOString(), scope: 'actual-public-merchant-selection-before-financial-history', merchantPublicKey: merchant, financialSubmissions: 0, escrowDeposits: 0, friendbotRequests: 0 };
  try {
    if (!StrKey.isValidEd25519PublicKey(merchant)) throw Error('VALID_PUBLIC_MERCHANT_REQUIRED');
    local = await localCustody();
    const current = publicContext(), web = privateEnv('.env.release.web.local'), worker = privateEnv('.env.release.worker.local');
    const previous = current.merchantPublicKey;
    if (previous !== 'GC3SHUY27GQV7Z5IPHFQWPQJR6SL2CCS72FVNZALHQVX5D7IGGPWHVEX' || current.ownerPublicKey !== 'GAXQOA4O5YZHOXJP2TFDOA6RFKL3UXVUH3XGFEL3GMGBM3V32FRENZS7' ||
      web.DEMO_MERCHANT_PUBLIC_KEY !== previous || worker.DEMO_MERCHANT_PUBLIC_KEY !== previous || new Set([current.ownerPublicKey, current.agentPublicKey, merchant]).size !== 3) throw Error('EXACT_CURRENT_PUBLIC_CONTEXT_REQUIRED');
    writePrivate('.fmd-work/release-setup/merchant-correction-attempt.json', JSON.stringify({ previousMerchant: previous, newMerchant: merchant, recordedAt: new Date().toISOString() }) + '\n', true);
    const client = await local.pool.connect();
    try {
      await client.query('BEGIN');
      const agents = (await client.query('SELECT id,last_nonce::text FROM agent FOR UPDATE')).rows;
      if (agents.length !== 1 || agents[0].id !== current.agentId || agents[0].last_nonce !== '0') throw Error('UNSPENT_CURRENT_CONTEXT_REQUIRED');
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','merchant_claim']) if (Number((await client.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n) !== 0) throw Error('EXISTING_FINANCIAL_HISTORY_CANNOT_BE_RETARGETED');
      const rows = (await client.query('SELECT id,wallet_address FROM merchant FOR UPDATE')).rows;
      if (rows.length !== 1 || rows[0].wallet_address !== previous) throw Error('EXACT_MERCHANT_METADATA_REQUIRED');
      const claims = (await client.query("SELECT id FROM wallet_operation WHERE role='merchant' FOR UPDATE")).rows;
      if (claims.length) throw Error('EXISTING_MERCHANT_OPERATION_CANNOT_BE_RETARGETED');
      await client.query('UPDATE merchant SET wallet_address=$1 WHERE id=$2', [merchant, rows[0].id]);
      await client.query('COMMIT');
      report.ownerWalletOperationsChanged = false;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    web.DEMO_MERCHANT_PUBLIC_KEY = merchant; worker.DEMO_MERCHANT_PUBLIC_KEY = merchant;
    writePrivate('.env.release.web.local', serialize(web)); writePrivate('.env.release.worker.local', serialize(worker));
    writeFileSync('deployment/finals/local-release/context-current.json', JSON.stringify({ ...current, merchantPublicKey: merchant,
      merchantWalletControl: 'user-provided-second-Freighter-account', previousMerchantPublicKey: previous, merchantSelectedAt: new Date().toISOString() }, null, 2) + '\n');
    const access = '.fmd-work/release-setup/access.md'; writePrivate(access, readFileSync(access, 'utf8').replaceAll(previous, merchant));
    const accountUrl = 'https://horizon-testnet.stellar.org/accounts/' + merchant;
    async function observed() {
      const response = await fetch(accountUrl, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (response.status === 404) { await response.body?.cancel(); return false; }
      if (response.status !== 200) { await response.body?.cancel(); throw Error('MERCHANT_ACCOUNT_OBSERVATION_UNAVAILABLE'); }
      if ((await response.json()).account_id !== merchant) throw Error('MERCHANT_ACCOUNT_IDENTITY_MISMATCH');
      return true;
    }
    const marker = '.fmd-work/release-setup/merchant-friendbot-attempt.json';
    if (!await observed()) {
      if (existsSync(marker)) throw Error('SAVED_MERCHANT_ACTIVATION_OBSERVE_ONLY');
      writePrivate(marker, JSON.stringify({ publicKey: merchant, recordedAt: new Date().toISOString(), activationMayOccur: true }) + '\n', true);
      report.friendbotRequests = 1;
      try {
        const response = await fetch('https://friendbot.stellar.org/?addr=' + encodeURIComponent(merchant), { redirect: 'error', signal: AbortSignal.timeout(20000) });
        report.friendbotHttpStatus = response.status; await response.body?.cancel();
      } catch { report.accountActivationTransport = 'unresolved-observe-public-identity-only'; }
    }
    report.merchantTestnetAccountObserved = await observed();
    if (!report.merchantTestnetAccountObserved) throw Error('MERCHANT_ACCOUNT_SETUP_UNRESOLVED');
    Object.assign(report, { status: 'passed', runtimeReloadPending: true, ownerPublicKey: current.ownerPublicKey, distinctOwnerMerchantAgent: true,
      originalIncidentChanged: false, limit: 'Merchant source account activation only; no claim, pending credit, escrow funding or purchase proof.' });
  } catch (error) { Object.assign(report, { status: 'not_completed_or_uncertain', code: /^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'MERCHANT_SELECTION_INCOMPLETE' }); process.exitCode = 1; }
  finally { await local?.pool.end(); writeFileSync('docs/evidence/wallet-recovery-2026-11-14/merchant-selection.json', JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(report)); }
}
