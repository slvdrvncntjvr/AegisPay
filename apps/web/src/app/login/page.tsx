'use client';
import { useState } from 'react';

export default function LoginPage() {
  const [role, setRole] = useState('owner');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="login-shell"><a className="brand" href="/">AegisPay</a><section className="panel"><p className="eyebrow">Private Testnet console</p><h1>Enter your workspace</h1><p>Use your private demo access token. Wallet connection happens after sign in.</p>
    <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, token }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message ?? 'Sign in unavailable'); } window.location.assign('/app'); } catch (e) { setError(e instanceof Error ? e.message : 'Sign in unavailable'); } finally { setBusy(false); } }}>
      <label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="owner">Owner</option><option value="merchant">Merchant</option></select></label>
      <label>Demo access token<input type="password" autoComplete="current-password" required value={token} onChange={e => setToken(e.target.value)} /></label>
      <button disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button><p role="alert">{error}</p>
    </form></section><p className="footer">Stellar Testnet · Fictional report fixtures · Human wallet consent for setup and claim</p></main>;
}
