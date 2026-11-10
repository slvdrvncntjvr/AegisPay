'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { PUBLIC_PROOF as proof } from '../lib/public-proof';
import { Icon } from '../components/visual';

type Path = 'authorization' | 'refusal' | 'recovery';
const paths = [ ['authorization', 'Authorization'], ['refusal', 'Over-cap refusal'], ['recovery', 'Recovery rule'] ] as const;
const steps = [
  { name: 'Intent', icon: 'intent', title: 'A request is not permission.', description: 'The recorded spike used a configured 0.03 Testnet XLM request. No autonomous model choice or protected report delivery is established.' },
  { name: 'Noir', icon: 'shield', title: 'Authority has a boundary.', description: 'The historical policy allowed up to 0.10 Testnet XLM per payment, with finite escrow and an expiry. Noir signed the constrained authorization; that policy has now expired.' },
  { name: 'Velo', icon: 'send', title: 'One authorization, carried through.', description: 'Velo sponsored and submitted the same signed Noir invocation. Its outer fee-bump transaction and the inner authorization have distinct hashes.' },
  { name: 'Evidence', icon: 'receipt', title: 'A result needs independent evidence.', description: 'Successful Velo execution was matched against the Noir envelope, invocation and event. The event alone cannot establish the asset and agent.' },
] as const;
const money = (value: string) => (Number(value) / 10_000_000).toFixed(2);

export function ProofConsole() {
  const [path, setPath] = useState<Path>('authorization');
  const [step, setStep] = useState(3);
  const [highlight, setHighlight] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const denied = path === 'refusal';
  const recovery = path === 'recovery';
  const inspectedStep = steps[step] ?? steps[3];
  useEffect(() => {
    function restore() {
      const params = new URLSearchParams(window.location.search);
      const savedPath = params.get('proof');
      const next: Path = savedPath === 'refusal' || savedPath === 'recovery' ? savedPath : 'authorization';
      const boundary = steps.findIndex(item => item.name.toLowerCase() === params.get('boundary'));
      setPath(next);
      setStep(boundary >= 0 ? boundary : next === 'refusal' ? 1 : 3);
      if (window.location.hash === '#receipt') {
        const receipt = document.getElementById('receipt');
        if (receipt instanceof HTMLDetailsElement) receipt.open = true;
      }
    }
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  function saveSelection(next: Path, boundary: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('proof', next);
    url.searchParams.set('boundary', (steps[boundary] ?? steps[3]).name.toLowerCase());
    window.history.replaceState(null, '', url);
  }
  function select(next: Path) {
    const boundary = next === 'refusal' ? 1 : 3;
    setPath(next); setStep(boundary); setHighlight(n => n + 1);
    saveSelection(next, boundary);
  }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === 'ArrowRight') next = (index + 1) % paths.length;
    else if (event.key === 'ArrowLeft') next = (index + paths.length - 1) % paths.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = paths.length - 1;
    else return;
    event.preventDefault(); select((paths[next] ?? paths[0])[0]); tabs.current[next]?.focus();
  }
  return <section id="proof" className="proof" aria-labelledby="proof-title">
    <div className="proof-heading"><h2 id="proof-title">Follow the proof.</h2><div className="proof-context"><span className="record-label"><span className="record-dot" />Recorded Testnet · 7 Nov 2026</span><a className="presentation-link" href="#proof" onClick={event => { event.preventDefault(); document.getElementById('proof')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }}>Focus the evidence<Icon name="arrow" /></a></div></div>
    <div className={`instrument ${denied ? 'is-refused' : ''} ${recovery ? 'is-recovery' : ''}`}>
      <div className="instrument-toolbar"><div className="path-tabs" role="tablist" aria-label="Evidence paths">{paths.map(([id, label], index) => <button key={id} ref={el => { tabs.current[index] = el; }} id={`tab-${id}`} aria-controls="evidence-panel" type="button" role="tab" aria-selected={path === id} tabIndex={path === id ? 0 : -1} onKeyDown={event => tabKeys(event, index)} onClick={() => select(id)}>{label}</button>)}</div><span className="inspection-label">Read-only inspection<Icon name="shield" /></span></div>
      <div id="evidence-panel" role="tabpanel" aria-labelledby={`tab-${path}`} className="instrument-body" tabIndex={0}>
        <div className="trace-surface">
          <div className="trace-caption"><span>{recovery ? 'Design preview · not executed' : 'Historical integration evidence'}</span><span className="trace-network">Stellar Testnet</span></div>
          <div className={`flow ${denied ? 'flow-refused' : ''}`} aria-label="Inspect the authorization boundaries">
            <span className="invocation-bracket">{denied ? 'Authority boundary' : recovery ? 'Saved operation identity' : 'Same signed invocation'}</span>
            <svg key={`${path}-${highlight}`} className={`flow-lines ${highlight ? 'was-selected' : ''}`} viewBox="0 0 600 120" preserveAspectRatio="none" fill="none" aria-hidden="true"><path className="flow-base" d="M65 60H535"/><path className="flow-active" d={denied ? 'M65 60H220' : recovery ? 'M65 60H375' : 'M65 60H535'} pathLength="1"/>{denied ? <path className="flow-stop" d="m210 47 20 26m0-26-20 26"/> : null}</svg>
            {steps.map((item, index) => <button key={item.name} type="button" className={`flow-step ${step === index ? 'is-inspected' : ''} ${denied && index > 1 ? 'not-crossed' : ''}`} aria-pressed={step === index} onClick={() => { setStep(index); setHighlight(n => n + 1); saveSelection(path, index); }} aria-label={`Inspect ${item.name} boundary`}><span className="node"><Icon name={denied && index === 1 ? 'close' : recovery && index === 3 ? 'pause' : item.icon} /></span><span>{item.name}</span><small>{denied ? ['Requested', 'Refused', 'Not submitted', 'No transaction'][index] : recovery ? ['Saved intent', 'No new signature', 'Observe identity', 'Access locked'][index] : ['Requested', 'Authorized', 'Sponsored', 'Matched'][index]}</small></button>)}
          </div>
          <div className="boundary-copy" aria-live="polite"><h3>{recovery ? 'Keep the operation. Resolve the uncertainty.' : denied && step > 1 ? 'This boundary was never crossed.' : denied && step === 1 ? 'The policy refused 0.12 XLM.' : inspectedStep.title}</h3><p>{recovery ? 'A timeout is not proof of failure. The application must observe the saved identity, keep access locked and avoid a second financial handoff. This is a design rule, not an executed recovery trace.' : denied && step > 1 ? 'The over-cap request was refused in unsigned contract simulation. Nothing was signed, sponsored or submitted; there is no included failed transaction.' : denied && step === 1 ? 'The request exceeded the historical 0.10 XLM cap. Live contract simulation returned AgentNotAuthorized before any signing or submission.' : denied ? 'The refused request asked for 0.12 Testnet XLM against a 0.10 XLM per-payment cap. It was a contract simulation, not an autonomous model choice.' : inspectedStep.description}</p></div>
          <div className="trace-footnote"><span className={`trace-status ${denied ? 'denied' : ''}`}><Icon name={denied ? 'close' : recovery ? 'pause' : 'check'} />{denied ? 'Unsigned simulation · no submission' : recovery ? 'No entitlement while unknown' : 'Envelope + invocation + event matched'}</span></div>
        </div>
        <aside className="decision" aria-label="Evidence decision">
          <div className="decision-top"><span>{recovery ? 'Recovery principle' : denied ? 'Requested amount' : 'Authorized amount'}</span><span className={`decision-status ${denied ? 'refused' : recovery ? 'unknown' : ''}`}>{denied ? 'REFUSED' : recovery ? 'UNRESOLVED' : 'VERIFIED'}<Icon name={denied ? 'close' : recovery ? 'pause' : 'check'} /></span></div>
          <div className={`amount ${recovery ? 'amount-unknown' : ''}`}>{recovery ? 'Unknown' : money(denied ? proof.refusal.amountStroops : proof.run.amountStroops)}{!recovery ? <span>XLM<span>Testnet</span></span> : null}</div>
          <div className="cap-label"><span>Historical per-payment cap</span><strong>{money(proof.policy.maxStroops)} XLM</strong></div>
          <div className="cap-measure" aria-hidden="true"><span style={{ width: recovery ? '0' : denied ? '100%' : '30%' }} /><i /><b /></div>
          <p className="decision-title">{recovery ? 'Observe the saved operation.' : denied ? 'No payment submitted.' : proof.run.authorizationState}</p>
          <p className="decision-description">{recovery ? 'No recovery run is claimed here. Unknown stays unresolved and access stays locked.' : denied ? 'Unsigned simulation refusal. No included failed transaction.' : 'One authorization verified. Merchant claim recorded separately.'}</p>
          <div className="policy-expiry"><Icon name="pause" /><span>Historical policy expired <time dateTime={proof.policy.expiresAt}>7 Nov, 15:32 UTC</time></span></div>
        </aside>
      </div>
      <div className="instrument-bottom"><p>{recovery ? 'Recovery behavior is a required application gate.' : 'Recorded SDK spike. Not a completed autonomous model purchase.'}</p><a href={proof.githubRepo + '/blob/main/' + proof.evidencePath} target="_blank" rel="noreferrer">Redacted evidence<Icon name="external" /></a></div>
    </div>
    {recovery ? <div className="recovery-rule"><div><h3>One operation survives the timeout.</h3><p>Keep the reservation identity, budget reservation and submission boundary. Independent evidence must resolve the result before access changes.</p></div><button className="button secondary" type="button" aria-expanded={recoveryOpen} aria-controls="recovery-detail" onClick={() => setRecoveryOpen(!recoveryOpen)}>{recoveryOpen ? 'Hide recovery rule' : 'Read recovery rule'}<Icon name="arrow" /></button>{recoveryOpen ? <p id="recovery-detail">There is no live status observation in this public viewer. The future console must observe the persisted operation by identity. It must not create another signature, submit again, or unlock a report while that operation remains unknown.</p> : null}</div> : <div className="receipt-strip"><div><span>{denied ? 'Simulation outcome' : 'Authorization → separate claim'}</span><strong>{denied ? proof.refusal.errorName : proof.run.claimState}</strong></div><p>{denied ? '0 signatures. 0 submissions. The 0.12 XLM refusal is simulation evidence only.' : '0.03 XLM entered merchant-pending escrow. A later, separate claim reduced that pending balance to zero.'}</p><a href="#receipt" onClick={() => { const receipt = document.getElementById('receipt'); if (receipt instanceof HTMLDetailsElement) { receipt.open = true; receipt.querySelector('summary')?.focus({ preventScroll: true }); } }}>Inspect full receipt<Icon name="arrow" /></a></div>}
    <ReceiptDetails />
  </section>;
}

function Identity({ label, value, href }: { label: string; value: string; href?: string }) {
  const [notice, setNotice] = useState('');
  return <div className="identity"><div className="identity-heading"><span>{label}</span><div>{href ? <a href={href} target="_blank" rel="noreferrer" aria-label={`Open ${label} in explorer`}>Explorer<Icon name="external" /></a> : null}<button type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice(`${label} copied`); } catch { setNotice(`Copy unavailable. Select the full ${label} below.`); } }} aria-label={`Copy ${label}`}><Icon name={notice.endsWith('copied') ? 'check' : 'copy'} />Copy</button></div></div><code>{value}</code><span className="copy-notice" role="status">{notice}</span></div>;
}

function ReceiptDetails() {
  return <details className="receipt-details" id="receipt"><summary><span>Inspect the full historical receipt<small>Transaction mapping, policy and safe public identities</small></span><span className="details-plus" aria-hidden="true" /></summary><div className="receipt-content"><div className="receipt-intro"><h3>One authorization. Two mapped hashes.</h3><p>The inner hash identifies the Noir authorization. The outer hash identifies Velo’s fee-bump transaction and observed event. They are distinct identities mapped to the same authorization; the claim is a third, separate transaction.</p></div><div className="receipt-facts"><div><span>Observed evidence</span><strong><time dateTime={proof.observedAt}>7 Nov 2026, 15:23:19 UTC</time></strong></div><div><span>Historical authorization fee</span><strong>{proof.fees.actualFeeStroops} stroops</strong><small>Outer ledger matched Velo · not a general cost</small></div><div><span>Escrow originally funded</span><strong>{money(proof.policy.escrowStroops)} Testnet XLM</strong></div><div><span>Authorization nonce</span><strong>{proof.run.nonce}</strong></div></div><Identity label="Inner Noir authorization" value={proof.txs.inner.hash} href={proof.txs.inner.url}/><Identity label="Outer fee-bump and event transaction" value={proof.txs.outer.hash} href={proof.txs.outer.url}/><Identity label="Separate merchant claim" value={proof.txs.claim.hash} href={proof.txs.claim.url}/><div className="balance-table"><h3>Escrow and pending are separate.</h3><table><caption>Historical balances in Testnet XLM</caption><thead><tr><th scope="col">Checkpoint</th><th scope="col">Escrow</th><th scope="col">Merchant pending</th></tr></thead><tbody><tr><th scope="row">After authorization</th><td>{money(proof.balances.afterAuthorization.escrow)}</td><td>{money(proof.balances.afterAuthorization.pending)}</td></tr><tr><th scope="row">After claim</th><td>{money(proof.balances.afterClaim.escrow)}</td><td>{money(proof.balances.afterClaim.pending)}</td></tr></tbody></table></div><details className="technical-details"><summary>Policy and integration identities<span className="details-plus" aria-hidden="true" /></summary><div><Identity label="Operation ID" value={proof.operationId}/><Identity label="Agent public address" value={proof.run.agent}/><Identity label="Merchant public address" value={proof.run.merchant}/><Identity label="Testnet XLM asset" value={proof.policy.asset}/><Identity label="Device registry" value={proof.contracts.deviceRegistry}/><Identity label="Agent registry" value={proof.contracts.agentRegistry}/><Identity label="Payment escrow" value={proof.contracts.paymentEscrow}/><p className="sdk-versions">Recorded SDK versions: Noir {proof.sdkVersions.noir} · Stellar {proof.sdkVersions.stellar} · Velo {proof.sdkVersions.velo}. Historical policy expiry: {proof.policy.expiresAt}.</p></div></details><a className="text-link" href={proof.githubRepo + '/blob/main/' + proof.evidencePath} target="_blank" rel="noreferrer">Open the redacted source evidence<Icon name="external" /></a></div></details>;
}
