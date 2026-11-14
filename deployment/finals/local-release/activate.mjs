// Confirmed historical wallet metadata and selective independent configuration.
// No owner/merchant key, journal, signing, funding, sponsor, submit or run call.
import { writeFileSync, mkdirSync } from 'node:fs';
import { Keypair } from '@stellar/stellar-sdk';
import { createStore } from '../../../src/server/db/connection.ts';
import { seedDemo } from '../../../src/server/db/seed.ts';
import { verifyContracts } from '../../../scripts/verify-contracts.ts';
import { createNoir, readTestnetConfig } from '../../../src/server/integrations/noir.ts';
import { OUT, publicContext, privateEnv, selectedEnv, serialize, writePrivate, localCustody } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--prepare-confirmed-wallets') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_CONFIRMED_WALLET_PREPARATION_REQUIRED', financialActions: 0 })); process.exitCode = 2;
} else {
  let local, store, stage = 'exact-local-custody';
  try {
    local = await localCustody();
    const proposal = publicContext(), web = privateEnv('.env.release.web.local'), worker = privateEnv('.env.release.worker.local');
    if (proposal.ownerPublicKey !== 'GBU2TW5W74HRGWIHWKUUF7VOIM6DPYUQD4AWQ25VH4LGUAOCYLLKQLTR' ||
      proposal.merchantPublicKey !== 'GC3SHUY27GQV7Z5IPHFQWPQJR6SL2CCS72FVNZALHQVX5D7IGGPWHVEX' || proposal.agentPublicKey === 'GB7YL3X5MJ5QSZR3ABWVVOE2QNRVVLFJTXI6GQ55A2SPGAVL6R2F7XBR' ||
      proposal.deviceHash === '790905edd7c6d36e300d0149ed6d73ef60db6bcc6635c50fa2b7312dc7bbeb7c' ||
      [web, worker].some(env => env.DATABASE_URL !== local.custody.DATABASE_URL || env.APP_ORIGIN !== 'http://127.0.0.1:3019' || env.DEMO_DEVICE_HASH !== proposal.deviceHash || env.DEMO_AGENT_PUBLIC_KEY !== proposal.agentPublicKey)) throw Error('EXACT_INDEPENDENT_CONTEXT_REQUIRED');
    const executionTables = ['agent_run', 'quote', 'payment_attempt', 'payment_evidence', 'entitlement', 'wallet_operation', 'merchant_claim', 'job'];
    const counts = {};
    for (const table of executionTables) {
      counts[table] = Number((await local.pool.query(`SELECT count(*)::text AS n FROM "${table}"`)).rows[0].n);
    }
    if (Object.values(counts).some(count => count !== 0)) throw Error('EXISTING_EXECUTION_OBSERVE_ONLY');
    stage = 'read-only-chain-verification';
    const publicEnv = { ...web, DEMO_OWNER_PUBLIC_KEY: proposal.ownerPublicKey, DEMO_MERCHANT_PUBLIC_KEY: proposal.merchantPublicKey,
      DEMO_ESCROW_FUNDING_CEILING_STROOPS: '1000000' };
    const { proof } = await verifyContracts(publicEnv);
    const noir = createNoir(readTestnetConfig(publicEnv));
    const [deviceOwner, deviceAgent, policy, escrow, token] = await Promise.all([
      noir.getDeviceOwner(proposal.deviceHash), noir.getDeviceAgent(proposal.deviceHash), noir.getPolicy(proposal.deviceHash),
      noir.getEscrowBalance(proposal.deviceHash), noir.getEscrowToken(proposal.deviceHash),
    ]);
    if (deviceOwner !== null || deviceAgent !== null || policy !== null || escrow !== 0n || token !== null) throw Error('NEW_CHAIN_CONTEXT_NOT_EMPTY');
    const accounts = {};
    for (const [role, key] of [['owner', proposal.ownerPublicKey], ['merchant', proposal.merchantPublicKey], ['agent', proposal.agentPublicKey]]) {
      const response = await fetch('https://horizon-testnet.stellar.org/accounts/' + key, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      const status = response.status;
      if (![200, 404].includes(status)) throw Error('ACCOUNT_OBSERVATION_UNAVAILABLE');
      if (status === 200) { const body = await response.json(); if (body.account_id !== key) throw Error('ACCOUNT_IDENTITY_MISMATCH'); }
      else await response.body?.cancel();
      accounts[role] = { httpStatus: status, exists: status === 200 };
    }
    if (!accounts.owner.exists || !accounts.merchant.exists) throw Error('CONFIRMED_HUMAN_ACCOUNTS_NOT_PRESENT');
    stage = 'metadata-only-seed';
    store = createStore(local.custody.DATABASE_URL);
    await seedDemo(store, { ownerAddress: proposal.ownerPublicKey, merchantAddress: proposal.merchantPublicKey,
      agentAddress: proposal.agentPublicKey, deviceHash: proposal.deviceHash, assetContractId: proposal.asset,
      deviceContractId: proposal.contracts.deviceRegistry, agentContractId: proposal.contracts.agentRegistry, escrowContractId: proposal.contracts.paymentEscrow });
    const [agent] = (await local.pool.query('SELECT id,public_key,device_hash,status,policy_max_stroops::text,policy_expires_at,policy_observed_ledger,last_nonce::text FROM agent')).rows;
    if (!agent || agent.public_key !== proposal.agentPublicKey || agent.device_hash !== proposal.deviceHash || agent.status !== 'unprovisioned' ||
      agent.policy_max_stroops !== '0' || new Date(agent.policy_expires_at).getTime() !== 0 || agent.policy_observed_ledger !== null || agent.last_nonce !== '0') throw Error('ZERO_POLICY_NONCE_REQUIRED');
    stage = 'selective-worker-configuration';
    const providerNames = ['GEMINI_API_KEY', 'AGENT_MODEL', 'VELO_GAS_API_KEY', 'VELO_GAS_BASE_URL'];
    const providers = selectedEnv('.env.worker.local', providerNames);
    // The pinned adapter selects environment:testnet and verifies the network.
    // Do not invent an additional credential-prefix API rule.
    if (providerNames.some(name => !providers[name]?.trim())) throw Error('SELECTIVE_TESTNET_PROVIDER_INPUT_REQUIRED');
    const identity = selectedEnv('.env.release.identity.local', ['AGENT_SECRET']);
    if (!identity.AGENT_SECRET || Keypair.fromSecret(identity.AGENT_SECRET).publicKey() !== proposal.agentPublicKey) throw Error('NEW_AGENT_IDENTITY_REQUIRED');
    for (const env of [web, worker]) Object.assign(env, { DEMO_OWNER_PUBLIC_KEY: proposal.ownerPublicKey, DEMO_MERCHANT_PUBLIC_KEY: proposal.merchantPublicKey, DEMO_ESCROW_FUNDING_CEILING_STROOPS: '1000000' });
    Object.assign(worker, providers, identity, { RUN_TESTNET: '0' });
    if (['AGENT_SECRET', 'GEMINI_API_KEY', 'VELO_GAS_API_KEY', 'ENVELOPE_ENCRYPTION_KEY'].some(name => web[name])) throw Error('WEB_PRIVATE_BOUNDARY_REQUIRED');
    writePrivate('.env.release.web.local', serialize(web)); writePrivate('.env.release.worker.local', serialize(worker));
    const access = '.fmd-work/release-setup/access.md';
    const instructions = '# Private local AegisPay access — never publish or paste in chat\n\nOpen http://127.0.0.1:3019/login in the browser with Freighter installed.\n\nChoose owner and paste this private demo access token:\n' + web.DEMO_OWNER_LOGIN_TOKEN + '\n\nMerchant access token (separate role):\n' + web.DEMO_MERCHANT_LOGIN_TOKEN + '\n\nOwner wallet: ' + proposal.ownerPublicKey + '\nMerchant wallet: ' + proposal.merchantPublicKey + '\nNew agent: ' + proposal.agentPublicKey + '\nDevice: ' + proposal.deviceHash + '\n\nTestnet only. First Register device and explicitly review/sign in Freighter, then observe the saved hash. Set finite policy max1000000stroops (0.1TestnetXLM), expiry no later than one hour ahead. Fund at most1000000stroops TOTAL; no top-up after spending/reclaim. Planned prices0.03then0.04XLM do not enforce an exact0.07total; actual finite funding maximum0.1XLM. Never sign a replacement for an unknown action.\n\nNew agent account is currently ' + (accounts.agent.exists ? 'observed present' : 'not present; it needs separately reviewed Testnet account activation before a purchase') + '. No owner/merchant private key belongs in this file or chat.\n\nDo not submit a model task until genuine setup is confirmed and the coordinator reports purchase execution ready. The worker currently persists RUN_TESTNET0; no model/payment task was started by this preparation. Starting an exact disclosed fresh task in the reviewed app is fresh user intent, without another generic chat approval.\n';
    writePrivate(access, instructions, true);
    mkdirSync(OUT, { recursive: true });
    const report = { status: 'passed', classification: 'actual-local-confirmed-wallet-metadata-preparation-no-chain-writes', observedAt: new Date().toISOString(),
      sourceBase: '8f715dbfe4baba211f39b105a1a5a6b2403eeb43', endpointAndDatabaseOwnershipVerified: true,
      origin: web.APP_ORIGIN, agentId: agent.id, ownerPublicKey: proposal.ownerPublicKey, merchantPublicKey: proposal.merchantPublicKey,
      agentPublicKey: proposal.agentPublicKey, deviceHash: proposal.deviceHash, walletControl: 'user-confirmed-through-coordinator',
      policyStatus: agent.status, policyMaxStroops: agent.policy_max_stroops, lastNonce: agent.last_nonce,
      nonceContinuity: 'zero saved attempts; no genuine registration yet, so financial nonce gate remains unavailable', expectedFirstNonceAfterRegistration: '1',
      chain: { deviceOwner, deviceAgent, policy, escrowStroops: escrow.toString(), token, accounts }, deploymentVerification: proof,
      offers: (await local.pool.query('SELECT resource_key,price_stroops::text FROM resource ORDER BY resource_key')).rows,
      executionTableCounts: counts, fundingLifetimeCeilingStroops: '1000000', workerPersistentRunTestnet: worker.RUN_TESTNET,
      privateLoginInstructions: access, workerSelectivelyCopiedNames: providerNames, newAgentKeySource: 'independent-new-identity-only',
      originalAgentKeysSpikeJournalsOrFullConfigCopied: false, privateValuesExported: false, financialActions: 0,
      nextHumanAction: 'Owner login then Register device and explicit Freighter review/sign; no automatic approval or model purchase' };
    writeFileSync(OUT + '/local-context.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ status: report.status, origin: report.origin, agentId: report.agentId, privateLoginInstructions: access, accounts, financialActions: 0 }));
  } catch (error) {
    const codes = new Set(['EXACT_INDEPENDENT_CONTEXT_REQUIRED', 'EXISTING_EXECUTION_OBSERVE_ONLY', 'NEW_CHAIN_CONTEXT_NOT_EMPTY', 'ACCOUNT_OBSERVATION_UNAVAILABLE', 'ACCOUNT_IDENTITY_MISMATCH', 'CONFIRMED_HUMAN_ACCOUNTS_NOT_PRESENT', 'ZERO_POLICY_NONCE_REQUIRED', 'SELECTIVE_TESTNET_PROVIDER_INPUT_REQUIRED', 'NEW_AGENT_IDENTITY_REQUIRED', 'WEB_PRIVATE_BOUNDARY_REQUIRED', 'PRIVATE_ACL_REQUIRED']);
    const report = { status: 'failed', code: 'CONFIRMED_LOCAL_PREPARATION_INCOMPLETE', stage, detail: codes.has(error?.message) ? error.message : 'LOCAL_DEPENDENCY_UNAVAILABLE', financialActions: 0 };
    mkdirSync(OUT, { recursive: true }); writeFileSync(OUT + '/activation-failure.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report)); process.exitCode = 1;
  } finally { await store?.close(); await local?.pool.end(); }
}
