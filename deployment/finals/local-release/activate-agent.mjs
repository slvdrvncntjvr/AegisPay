// One Friendbot request for the new public Testnet source account only.
// No private key, signature, owner transfer, contract deposit or purchase.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { OUT, publicContext, localCustody, writePrivate } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--activate-new-testnet-account') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_NEW_TESTNET_ACCOUNT_SETUP_REQUIRED' })); process.exitCode = 2;
} else {
  let local;
  const proposal = publicContext(), marker = '.fmd-work/release-setup/friendbot-attempt.json';
  const report = { classification: 'new-testnet-account-activation-only-not-escrow-or-payment-evidence', observedAt: new Date().toISOString(),
    agentPublicKey: proposal.agentPublicKey, friendbotRequestsThisInvocation: 0, ownerFundsTransferred: false, escrowDeposits: 0, purchases: 0 };
  try {
    if (proposal.network !== 'testnet' || proposal.agentPublicKey !== 'GBN5A36EOGRYXCZBLTCBCFY6MGGKMVNT445PFZ6ADF6FMLKHRKOXIAII' ||
      proposal.deviceHash !== 'ff3f426f69a771e7fc959b5d4ce89154de871de81bd32c93289e5e9de5292100') throw Error('EXACT_NEW_CONTEXT_REQUIRED');
    local = await localCustody();
    const rows = (await local.pool.query('SELECT public_key,device_hash,last_nonce::text FROM agent')).rows;
    if (rows.length !== 1 || rows[0].public_key !== proposal.agentPublicKey || rows[0].device_hash !== proposal.deviceHash || rows[0].last_nonce !== '0') throw Error('EXACT_NEW_CONTEXT_REQUIRED');
    const accountUrl = 'https://horizon-testnet.stellar.org/accounts/' + proposal.agentPublicKey;
    async function account() {
      const response = await fetch(accountUrl, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (response.status === 404) { await response.body?.cancel(); return false; }
      if (response.status !== 200) { await response.body?.cancel(); throw Error('ACCOUNT_OBSERVATION_UNAVAILABLE'); }
      const body = await response.json();
      if (body.account_id !== proposal.agentPublicKey) throw Error('ACCOUNT_IDENTITY_MISMATCH');
      return true;
    }
    if (existsSync(marker)) {
      const prior = JSON.parse(readFileSync(marker, 'utf8'));
      if (prior.agentPublicKey !== proposal.agentPublicKey) throw Error('SAVED_ACTIVATION_IDENTITY_MISMATCH');
      report.mode = 'saved-identity-observation-only';
      report.accountObserved = await account();
    } else if (await account()) {
      report.mode = 'already-observed-no-faucet-request'; report.accountObserved = true;
    } else {
      writePrivate(marker, JSON.stringify({ agentPublicKey: proposal.agentPublicKey, recordedAt: new Date().toISOString(), handoffMayOccur: true }) + '\n', true);
      report.friendbotRequestsThisInvocation = 1;
      report.mode = 'one-new-account-activation';
      // Never read/export the faucet envelope or raw response. A transport
      // failure is observed by account identity and never sent again.
      try {
        const response = await fetch('https://friendbot.stellar.org/?addr=' + encodeURIComponent(proposal.agentPublicKey),
          { redirect: 'error', signal: AbortSignal.timeout(20000) });
        report.friendbotHttpStatus = response.status; await response.body?.cancel();
      } catch { report.friendbotTransport = 'unresolved-observe-by-identity'; }
      report.accountObserved = await account();
    }
    report.status = report.accountObserved ? 'passed' : 'unresolved';
    report.newDeviceEscrowFundingCeilingStroops = '1000000';
    report.limit = 'Account existence only; device registration/policy/escrow/purchases remain separate.';
  } catch { report.status = 'unresolved'; report.code = 'ACCOUNT_SETUP_OR_OBSERVATION_INCOMPLETE'; }
  finally {
    await local?.pool.end();
    const path = OUT + '/agent-account-' + Date.now() + '.json';
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ status: report.status, friendbotRequests: report.friendbotRequestsThisInvocation,
      accountObserved: report.accountObserved ?? null, escrowDeposits: 0, purchases: 0, artifact: path }));
    if (report.status !== 'passed') process.exitCode = 1;
  }
}
