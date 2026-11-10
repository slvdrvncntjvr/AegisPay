'use client';
import { useState } from 'react';
import { Icon, Mark } from '../../components/visual';

export default function LoginPage() {
  const [role, setRole] = useState('owner');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  return <main className="login-shell"><a className="brand" href="/"><Mark />AegisPay<span className="brand-period">.</span></a><div className="login-main"><section className="login-story"><h1>Human limits.<br />Agent potential.</h1><p>Private access is for the Testnet owner and merchant. Wallet setup and merchant claims require human consent.</p><div className="login-note">The live product console is not available yet. You can inspect the recorded public proof without signing in.</div></section><section className="login-form" aria-labelledby="login-title"><h2 id="login-title">Private access</h2><p>Use your private demo access token.</p>
    {signedIn ? <div className="login-success" role="status"><h3>Session established.</h3><p>Your sign-in was accepted. The authenticated product console is still awaiting integration; no wallet action or payment has started.</p><a className="button primary" href="/">Return to public proof<Icon name="arrow" /></a></div> : <form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, token }) }); if (!response.ok) { const data = await response.json(); throw new Error(data.error?.message ?? 'Sign in unavailable'); } setToken(''); setSignedIn(true); } catch (e) { setError(e instanceof Error ? e.message : 'Sign in unavailable'); } finally { setBusy(false); } }}>
      <label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="owner">Owner</option><option value="merchant">Merchant</option></select></label>
      <label>Demo access token<input type="password" autoComplete="current-password" required value={token} onChange={e => setToken(e.target.value)} /></label>
      <button className="button primary" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}<Icon name="arrow" /></button><p className="login-error" role="alert">{error}</p>
    </form>}</section></div><p className="login-footer">Stellar Testnet only · Fictional report fixtures · No live console release claimed</p></main>;
}
