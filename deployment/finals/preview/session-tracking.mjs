/** Register login identities before assertions and reconcile scoped cookies. */
import {check, sha} from './common.mjs';

export class SessionTracking {
  constructor(hashes, secrets) {
    this.hashes = hashes;
    this.secrets = secrets;
    this.attempts = [];
  }

  begin() {
    const attempt = {
      headers: false, identity: false, rejected: false, conflicting: false,
      headerIdentity: false, cookieIdentity: false, identityHash: null,
    };
    this.attempts.push(attempt);
    return attempt;
  }

  identify(attempt, token, source) {
    check(this.attempts.includes(attempt), 'UNKNOWN_LOGIN_ATTEMPT');
    check(/^[A-Za-z0-9_-]{43}$/.test(token), 'INVALID_SESSION_IDENTITY');
    const digest = sha(token);
    // Preserve every observed identity for cleanup, including contradictions.
    this.hashes.add(digest);
    this.secrets.add(token);
    if (attempt.identityHash && attempt.identityHash !== digest) {
      attempt.conflicting = true;
      throw Error('CONFLICTING_LOGIN_IDENTITIES');
    }
    attempt.identityHash = digest;
    attempt.identity = true;
    attempt[source === 'header' ? 'headerIdentity' : 'cookieIdentity'] = true;
  }

  headers(attempt, status, cookies) {
    attempt.headers = true;
    for (const value of cookies) {
      for (const match of value.trim().matchAll(/(?:^|[,\n]\s*)aegispay_session=([A-Za-z0-9_-]{43})(?=;|$)/g)) {
        this.identify(attempt, match[1], 'header');
      }
    }
    // These exact application rejections precede session creation.
    attempt.rejected = !attempt.identity && [400, 401, 403, 429].includes(status);
  }

  browserCookie(attempt, token) {
    check(attempt.headers && !attempt.rejected, 'LOGIN_RESPONSE_REQUIRED_FOR_COOKIE');
    this.identify(attempt, token, 'cookie');
  }

  summary() {
    return {
      login_requests: this.attempts.length,
      identified_sessions: this.hashes.size,
      identities_from_headers: this.attempts.filter(a => a.headerIdentity).length,
      identities_from_browser_cookie_only: this.attempts.filter(a => a.cookieIdentity && !a.headerIdentity).length,
      conflicting_identities: this.attempts.filter(a => a.conflicting).length,
      uncertain_commits: this.attempts.filter(a => a.conflicting || (!a.identity && !a.rejected)).length,
    };
  }
}

export async function fetchWithSessionTracking(url, options, tracking) {
  const login = (options.method ?? 'GET') === 'POST' && new URL(url).pathname === '/api/session';
  const attempt = login ? tracking.begin() : null;
  const response = await fetch(url, options);
  if (attempt) tracking.headers(attempt, response.status, response.headers.getSetCookie());
  return response;
}
