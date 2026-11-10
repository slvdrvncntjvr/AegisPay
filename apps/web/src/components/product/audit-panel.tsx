'use client';
import { useRef, useState } from 'react';
import { amount, api, ApiError, errorText, record, time, type Attempt, type Receipt, type Report } from './api';
import { Identifier, SectionTitle, Status } from './primitives';

export function AuditPanel({ attempts }: { attempts: Attempt[] }) {
  return <section id="audit" className="pc-section"><SectionTitle number="03" title="Follow the evidence." detail="Submission, authorization and merchant claim are separate facts." />
    <p className="pc-section-note">Observe only the saved identity. Unknown and manual review retain held budget and grant no report access.</p>
    {attempts.length ? <div className="pc-attempts">{attempts.map(a => <AttemptRow key={a.attemptId} initial={a} />)}</div> : <p className="pc-empty">No payment attempts returned. There are no seeded purchases or receipts.</p>}
  </section>;
}

function AttemptRow({ initial }: { initial: Attempt }) {
  const [observed, setObserved] = useState<Attempt | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const a = observed ?? initial;
  async function action(kind: 'observe' | 'receipt' | 'resource') {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (kind === 'observe') {
        const result = await api<Attempt>(`/api/v1/payment-attempts/${encodeURIComponent(a.attemptId)}`);
        if (result.attemptId !== a.attemptId || result.operationId !== a.operationId || result.quoteId !== a.quoteId || typeof result.status !== 'string') throw new ApiError('ATTEMPT_IDENTITY_MISMATCH');
        setObserved({ ...result, veloRequestId: initial.veloRequestId ?? null });
        if (result.status !== 'authorized' || result.receiptId !== a.receiptId) { setReceipt(null); setReport(null); }
      } else if (kind === 'receipt' && a.status === 'authorized' && a.receiptId) {
        const result = await api<Receipt>(`/api/v1/receipts/${encodeURIComponent(a.receiptId)}`);
        if (result.receiptId !== a.receiptId || result.quoteId !== a.quoteId || !record(result.evidence) || typeof result.validUntil !== 'string') throw new ApiError('RECEIPT_IDENTITY_MISMATCH');
        // Intentionally omit the receipt bearer returned by the metadata route.
        setReceipt({ receiptId: result.receiptId, quoteId: result.quoteId, resourceKey: result.resourceKey, fixtureVersion: result.fixtureVersion, validUntil: result.validUntil, evidence: result.evidence });
        setReport(null);
      } else if (kind === 'resource' && receipt && a.status === 'authorized' && receipt.receiptId === a.receiptId) {
        setReport(null);
        const result = await api<Report>(`/api/v1/receipts/${encodeURIComponent(receipt.receiptId)}/resource`);
        if (result.receiptId !== receipt.receiptId || result.resourceKey !== receipt.resourceKey || result.isDemo !== true || !record(result.report) || typeof result.report.title !== 'string' || typeof result.report.label !== 'string' || !Array.isArray(result.report.findings) || result.report.findings.some(v => typeof v !== 'string')) throw new ApiError('INVALID_RESOURCE_RESPONSE');
        setReport(result);
      }
    } catch (e) { setReport(null); if (kind !== 'resource') setReceipt(null); setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <article className="pc-attempt"><div className="pc-row"><Status value={a.status} /><button className="pc-button" type="button" disabled={busy} onClick={() => { void action('observe'); }}>Observe saved operation</button></div>
    <div className="pc-attempt-context"><p>{a.status === 'authorized' ? 'Independent authorization verified by the server. Funds credit merchant-pending escrow; a merchant claim is separate.' : ['unknown', 'manual_review'].includes(a.status) ? 'Unresolved and unentitled. Keep the original operation, nonce and reservation; observation never signs or submits again.' : 'This state does not establish authorization or access. Local refusal does not establish an included failed transaction.'}</p>{a.errorCode && <code className="pc-error">{a.errorCode}</code>}</div>
    <details><summary>Payment identities &amp; evidence</summary><div className="pc-id-grid"><Identifier label="Attempt ID" value={a.attemptId} /><Identifier label="Quote ID" value={a.quoteId} /><Identifier label="Operation ID" value={a.operationId} /><Identifier label="Velo reservation ID" value={a.veloRequestId} /><Identifier label="Inner Noir hash" value={a.innerHash} /><Identifier label="Outer fee-bump hash" value={a.outerHash} /></div><p className="pc-caption">Velo status: {a.veloStatus ?? 'Unavailable'}. Inner, outer and event transaction hashes stay distinct until independently mapped.</p></details>
    {a.status === 'authorized' && a.receiptId && <button className="pc-button" disabled={busy} onClick={() => { void action('receipt'); }}>View receipt metadata</button>}
    {a.status === 'authorized' && !a.receiptId && <p className="pc-notice">Receipt identity has not been observed. Observe the saved operation to check entitlement.</p>}
    {error && <p className="pc-error" role="alert">{error}</p>}
    {receipt && <div className="pc-receipt"><div className="pc-row"><h3>Resource-scoped receipt</h3><span className="pc-caption">{receipt.fixtureVersion}</span></div><p>{receipt.resourceKey}</p><p>Original access window ends {time(receipt.validUntil)}. Expiry never extends on refresh.</p>
      <p><strong>Authorized amount: {amount(receipt.evidence.amountStroops)}</strong> <code>{String(receipt.evidence.amountStroops ?? 'Unavailable')} stroops</code></p>
      <p>Actual fee: {amount(receipt.evidence.actualFeeStroops)} · provenance: {String(receipt.evidence.feeProvenance ?? 'unavailable')}</p>
      <div className="pc-id-grid">{[['innerHash','Verified inner hash'],['outerHash','Verified outer hash'],['observedEventTxHash','Observed event transaction hash'],['noirEventId','Noir event ID'],['ledgerSequence','Ledger'],['nonce','Authorization nonce'],['merchantAddress','Receipt merchant'],['assetContractId','Receipt asset'],['evidenceDigest','Evidence digest']].map(([field,label]) => <Identifier key={field} label={label!} value={typeof receipt.evidence[field!] === 'string' ? receipt.evidence[field!] as string : null} />)}</div>
      <button className="pc-button pc-primary" disabled={busy || Date.parse(receipt.validUntil) <= Date.now()} onClick={() => { void action('resource'); }}>Read entitled demo report</button>
      {Date.parse(receipt.validUntil) <= Date.now() && <p className="pc-notice">Entitlement expired. Receipt metadata remains available; report access is closed.</p>}
      {report && <div className="pc-report"><h3>{report.report.title}</h3><p>{report.report.label}</p><ul>{report.report.findings.map((finding, i) => <li key={i}>{String(finding)}</li>)}</ul></div>}
    </div>}
  </article>;
}
