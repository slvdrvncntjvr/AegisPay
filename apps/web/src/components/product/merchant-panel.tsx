'use client';
import { useRef, useState } from 'react';
import { amount, api, errorText, jsonMutation, positiveInteger, time, type Claim, type Offer } from './api';
import { Identifier, SectionTitle, Status } from './primitives';

export function MerchantPanel({ offers, claims, fresh, refresh }: { offers: Offer[]; claims: Claim[]; fresh: boolean; refresh: () => Promise<void> }) {
  return <><section id="offers" className="pc-section"><SectionTitle number="02" title="Set the next offer." detail="Edit public metadata. Existing quote snapshots keep their original terms." /><div className="pc-merchant-offers">{offers.map(offer => <PriceEditor key={offer.id} offer={offer} fresh={fresh} refresh={refresh} />)}</div><p className="pc-section-note">There is no merchant report preview. Protected content is delivered only through the owner's entitled resource route.</p></section>
    <section id="claim-audit" className="pc-section"><SectionTitle number="03" title="Claim history." detail="Only independently confirmed claims are marked claimed by merchant." />{claims.length ? claims.map(c => <article className="pc-attempt" key={c.id}><div className="pc-row"><Status value={c.status} /><strong>{c.status === 'confirmed' ? 'Claimed by merchant' : 'Claim not confirmed'}</strong></div><Identifier label="Claim ID" value={c.id} /><Identifier label="Separate claim hash" value={c.txHash} /><p>Observed claim amount: {amount(c.observedClaimAmountStroops)} · {time(c.confirmedAt)}</p></article>) : <p className="pc-empty">No merchant claims returned. Authorization alone is not a claim.</p>}</section></>;
}

function PriceEditor({ offer, fresh, refresh }: { offer: Offer; fresh: boolean; refresh: () => Promise<void> }) {
  const [price, setPrice] = useState(offer.priceStroops);
  const [enabled, setEnabled] = useState(offer.enabled);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  return <article className="pc-price-editor"><div><span className="pc-eyebrow">{offer.isDemo ? 'Fictional demo resource' : 'Resource metadata'}</span><h3>{offer.resourceKey}</h3><p>{offer.description}</p><p>Current offer: <strong>{amount(offer.priceStroops)}</strong><br /><code>{offer.priceStroops} stroops</code></p></div><form onSubmit={async e => {
    e.preventDefault(); if (lock.current || !fresh || !positiveInteger(price)) return;
    lock.current = true; setBusy(true); setNotice('');
    try { await api(`/api/v1/merchant/resources/${encodeURIComponent(offer.id)}`, jsonMutation('PATCH', { priceStroops: price, enabled })); await refresh(); setNotice('Future offer metadata saved. Accepted quotes remain unchanged.'); }
    catch (error) { setNotice(errorText(error)); }
    finally { lock.current = false; setBusy(false); }
  }}><label htmlFor={`price-${offer.id}`}>Future price in integer stroops<input id={`price-${offer.id}`} inputMode="numeric" pattern="[1-9][0-9]*" value={price} onChange={e => setPrice(e.target.value)} required maxLength={39} /><small>{amount(price)}</small></label><label className="pc-check"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Offer enabled for future quotes</label><button className="pc-button pc-primary" disabled={busy || !fresh || !positiveInteger(price)} type="submit">{busy ? 'Saving…' : 'Save future price'}</button><p role="status" className="pc-notice">{notice}</p></form></article>;
}
