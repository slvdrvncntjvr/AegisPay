// Real local login/role/logout checks. No wallet, quote, run, provider or chain call.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { OUT, privateEnv, publicContext, localCustody } from './context.mjs';

if (process.argv.length !== 3 || process.argv[2] !== '--check-access') {
  console.log(JSON.stringify({ status: 'not_run', code: 'EXPLICIT_LOCAL_ACCESS_CHECK_REQUIRED' })); process.exitCode = 2;
} else {
  let local, failure = false;
  const sessions = [], checks = [];
  const report = { scope: 'actual-local-confirmed-owner-merchant-login-no-financial-execution', observedAt: new Date().toISOString(), financialActions: 0, fullLiveRelease: false };
  try {
    local = await localCustody();
    const web = privateEnv('.env.release.web.local'), proposal = publicContext();
    if (web.DATABASE_URL !== local.custody.DATABASE_URL || web.APP_ORIGIN !== 'http://127.0.0.1:3019') throw Error('CONTEXT_MISMATCH');
    const secretValues = Object.entries(web).filter(([name]) => /TOKEN|SIGNING_KEY|DATABASE_URL/.test(name)).map(([, value]) => value).filter(value => value?.length > 16);
    const counts = async () => {
      const result = {};
      for (const table of ['agent_run','quote','payment_attempt','payment_evidence','entitlement','wallet_operation','merchant_claim','job']) result[table] = Number((await local.pool.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n);
      if (Object.values(result).some(value => value !== 0)) throw Error('EXISTING_EXECUTION_OBSERVE_ONLY');
      return result;
    };
    report.executionCountsBefore = await counts();
    const assert = (name, passed) => { checks.push({ name, passed }); if (!passed) throw Error('ACCESS_CHECK_FAILED'); };
    async function request(path, init = {}) {
      const response = await fetch(web.APP_ORIGIN + path, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) });
      const setCookie = response.headers.get('set-cookie');
      // Track identity before status, body or cookie assertions.
      const cookie = setCookie?.split(';')[0];
      const token = cookie?.split('=')[1];
      if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) sessions.push({ cookie, hash: createHash('sha256').update(token).digest('hex') });
      const body = await response.text();
      assert('response-no-config-secret', !secretValues.some(value => body.includes(value)));
      return { response, body, cookie, setCookie };
    }
    for (const role of ['owner','merchant']) {
      const login = await request('/api/session', { method: 'POST', headers: { origin: web.APP_ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ role, token: web[role === 'owner' ? 'DEMO_OWNER_LOGIN_TOKEN' : 'DEMO_MERCHANT_LOGIN_TOKEN'] }) });
      assert(role + '-login', login.response.status === 204 && !!login.cookie && /HttpOnly/i.test(login.setCookie) && /SameSite=Strict/i.test(login.setCookie));
      const headers = { cookie: login.cookie };
      const stateResponse = await request('/api/v1/state', { headers });
      assert(role + '-state-status', stateResponse.response.status === 200);
      const state = JSON.parse(stateResponse.body);
      assert(role + '-identity', state.role === role && state.walletAddress === proposal[role + 'PublicKey']);
      assert(role + '-catalog', state.offers?.length === 2 && state.offers.every(offer => offer.priceStroops === proposal.expectedPrices[offer.resourceKey]));
      if (role === 'owner') assert('owner-new-unprovisioned-context-and-trusted-ceiling', state.agent?.publicKey === proposal.agentPublicKey && state.agent?.deviceHash === proposal.deviceHash && state.agent?.status === 'unprovisioned' && state.agent?.policyMaxStroops === '0' && state.walletFundingCeilingStroops === '1000000' && state.runs.length === 0 && state.attempts.length === 0);
      else assert('merchant-no-owner-state', state.runs === undefined && state.agent === undefined && state.claims.length === 0);
      const logout = await request('/api/session', { method: 'DELETE', headers: { ...headers, origin: web.APP_ORIGIN } });
      assert(role + '-logout', logout.response.status === 204);
      const denied = await request('/api/v1/state', { headers });
      assert(role + '-old-cookie-denied', denied.response.status === 401);
    }
    report.executionCountsAfter = await counts();
  } catch { failure = true; }
  finally {
    if (local) {
      try {
        for (const session of sessions) await local.pool.query('UPDATE session SET revoked_at=coalesce(revoked_at,clock_timestamp()) WHERE token_hash=$1', [session.hash]);
        let revoked = 0;
        for (const session of sessions) revoked += Number((await local.pool.query('SELECT count(*)::int AS n FROM session WHERE token_hash=$1 AND revoked_at IS NOT NULL', [session.hash])).rows[0].n);
        report.sessionsCreatedAndRevoked = revoked;
        if (sessions.length !== 2 || revoked !== 2) failure = true;
      } catch { failure = true; }
      await local.pool.end();
    }
    Object.assign(report, { status: failure ? 'failed' : 'passed', checks });
    writeFileSync(OUT + '/access-check.json', JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ status: report.status, checks: checks.length, sessionsCreatedAndRevoked: report.sessionsCreatedAndRevoked, financialActions: 0 }));
    if (failure) process.exitCode = 1;
  }
}
