'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Mark } from '../visual';
import { api, errorText, validateState, type ConsoleState } from './api';
import { RunPanel } from './run-panel';
import { WalletPanel } from './wallet-panel';
import { AuditPanel } from './audit-panel';
import { MerchantPanel } from './merchant-panel';

export function ProductConsole() {
  const [state, setState] = useState<ConsoleState | null>(null);
  const [fresh, setFresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [leaving, setLeaving] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const expired = useRef(false);
  const refresh = useCallback(async () => {
    if (lock.current || expired.current) return;
    lock.current = true;
    try {
      const result = validateState(await api<ConsoleState>('/api/v1/state'));
      if (mounted.current && !expired.current) { setState(result); setFresh(true); setError(''); setObservedAt(new Date().toISOString().replace('T', ' ').slice(0,19) + ' UTC'); }
    } catch (e) { if (mounted.current) { setFresh(false); setError(errorText(e)); } }
    finally { lock.current = false; if (mounted.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const sessionExpired = () => { expired.current = true; setState(null); setFresh(false); window.location.replace('/login?expired=1'); };
    window.addEventListener('aegis-session-expired', sessionExpired);
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20000);
    return () => { mounted.current = false; window.removeEventListener('aegis-session-expired', sessionExpired); window.clearInterval(timer); };
  }, [refresh]);

  return <div className="product-console"><a href="#pc-main" className="pc-skip">Skip to console</a>
    <header className="pc-header"><a className="pc-brand" href="/" aria-label="AegisPay public proof"><Mark />AegisPay<span>.</span></a><div className="pc-header-meta"><span className="pc-network">Stellar Testnet</span><span>Private console{state ? ` / ${state.role}` : ''}</span></div>{state && <button className="pc-button" disabled={leaving} onClick={async () => { if (leaving) return; setLeaving(true); try { await api('/api/session', { method: 'DELETE' }); expired.current = true; setState(null); window.location.replace('/login'); } catch(e) { setError(errorText(e)); setLeaving(false); } }}>Sign out</button>}</header>
    <main id="pc-main" className="pc-main" tabIndex={-1}><div className="pc-masthead"><div><span className="pc-eyebrow">Bounded authority / observable outcomes</span><h1>{state?.role === 'merchant' ? 'Your terms. Your claim.' : 'A little autonomy.\nA clear boundary.'}</h1></div><p>Testnet assets. Fictional reports.<br />Human consent stays with your wallet.<br /><a href="/">Open the recorded public proof ↗</a></p></div>
      {!state ? <section className="pc-loading" aria-busy={loading}><h2>{loading ? 'Checking private session…' : 'Console unavailable'}</h2><p role="status">{error || 'Protected data loads only through your authenticated session.'}</p>{!loading && <button className="pc-button" onClick={() => { void refresh(); }}>Retry state observation</button>}</section> : <>
        <div className="pc-navigation"><nav aria-label="Console sections">{(state.role === 'owner' ? [['policy','Policy'],['run','Run'],['audit','Audit']] : [['claims','Pending & claim'],['offers','Offers'],['claim-audit','Claim history']]).map(([id,label]) => <a key={id} href={`#${id}`}>{label}</a>)}</nav><button className="pc-button" onClick={() => { void refresh(); }}>Refresh console state</button></div>
        <div className="pc-freshness" role="status"><span className={fresh ? 'pc-live-dot' : 'pc-stale-dot'} aria-hidden /><span>{fresh ? 'Authenticated database snapshot' : 'Stale snapshot · mutations paused'} · last received {observedAt}</span><span>Chain observation is separate</span></div>
        {error && <p className="pc-error pc-banner" role="alert">{error} Previously received data may be stale.</p>}
        <WalletPanel state={state} fresh={fresh} refresh={refresh} />
        {state.role === 'owner' ? <><RunPanel runs={state.runs ?? []} offers={state.offers} fresh={fresh} ready={state.agent?.status === 'active'} refresh={refresh} /><AuditPanel attempts={state.attempts ?? []} /></> : <MerchantPanel offers={state.offers} claims={state.claims ?? []} fresh={fresh} refresh={refresh} />}
      </>}
    </main><footer className="pc-footer"><span>AegisPay / private Testnet workspace</span><span>Submitted ≠ authorized ≠ claimed</span></footer>
  </div>;
}
