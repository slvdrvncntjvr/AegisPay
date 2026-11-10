'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon, Mark } from '../../components/visual';

export default function LoginPage() {
  const [role, setRole] = useState('owner');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get('expired') === '1') setError('Your session expired. Sign in again to continue.'); }, []);
  return <main className="login-shell"><a className="brand" href="/"><Mark />AegisPay<span className="brand-period">.</span></a><div className="login-main"><section className="login-story"><h1>Human limits.<br />Agent potential.</h1><p>Private access is for the Testnet owner and merchant. Wallet setup and merchant claims require human consent.</p><div className="login-note">Enter the authenticated product console. The recorded public proof remains available without signing in.</div></section><section className="login-form" aria-labelledby="login-title"><h2 id="login-title">Private access</h2><p>Use your private demo access token.</p>
    <form onSubmit={async event => { event.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { const response = await fetch('/api/session', { method: 'POST', cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, token }) }); if (!response.ok) { let message = response.status === 429 ? 'Too many sign-in attempts. Please wait before trying again.' : 'Sign in unavailable. Check your access token and try again.'; try { const data: unknown = await response.json(); if (typeof data === 'object' && data !== null && 'error' in data && typeof data.error === 'object' && data.error !== null && 'message' in data.error && typeof data.error.message === 'string' && data.error.message.length <= 160) message = data.error.message; } catch { /* Proxy and non-JSON errors use the safe default. */ } setError(message); return; } setToken(''); window.location.replace('/app'); } catch { setError('Sign in unavailable. Check your connection and try again.'); } finally { setToken(''); setBusy(false); lock.current = false; } }}>
      <label>Role<select disabled={busy} value={role} onChange={e => { setRole(e.target.value); setToken(''); }}><option value="owner">Owner</option><option value="merchant">Merchant</option></select></label>
      <label>Demo access token<input type="password" autoComplete="current-password" disabled={busy} maxLength={512} required value={token} onChange={e => setToken(e.target.value)} /></label>
      <button className="button primary" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" /></button><p className="login-error" role="alert">{error}</p>
    </form></section></div><p className="login-footer">Stellar Testnet only · Fictional report fixtures · Private session required</p></main>;
}
