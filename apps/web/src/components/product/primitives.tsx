'use client';
import { useState } from 'react';
import { Icon } from '../visual';

export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = { authorized: 'Authorized in escrow', manual_review: 'Manual review', waiting_payment: 'Waiting for payment observation', submitted: 'Submitted · unverified', confirmed: 'Confirmed on chain', unknown: 'Status unknown', queued: 'Queued · not executed' };
  return <span className={`pc-status pc-status-${['authorized', 'confirmed', 'completed'].includes(value) ? 'good' : ['failed', 'refused', 'manual_review', 'disabled'].includes(value) ? 'stop' : 'wait'}`}>{labels[value] ?? value.replaceAll('_', ' ')}</span>;
}
export function Identifier({ label, value }: { label: string; value?: string | null | undefined }) {
  const [notice, setNotice] = useState('');
  return <div className="pc-identifier"><span>{label}</span><div><code>{value || 'Unavailable'}</code>{value && <button type="button" className="pc-copy" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(value); setNotice(`${label} copied`); } catch { setNotice('Copy unavailable; select the identifier.'); } }}><Icon name="copy" /></button>}</div><small role="status">{notice}</small></div>;
}
export function SectionTitle({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="pc-section-title"><span className="pc-index">{number}</span><div><h2>{title}</h2><p>{detail}</p></div></div>;
}
