'use client';
import { useRef, useState } from 'react';
import { amount, api, ApiError, errorText, jsonMutation, pendingWallet, positiveInteger, time, type ConsoleState, type Prepared, type WalletOperation, type WalletState } from './api';
import { Identifier, SectionTitle, Status } from './primitives';

const actionNames: Record<string, string> = { registerDevice: 'Register device', registerAgent: 'Set finite policy', fundEscrow: 'Fund escrow', revokeAgent: 'Revoke agent', sweepOnRevoke: 'Reclaim after revocation', claim: 'Claim merchant pending' };

export function WalletPanel({ state, fresh, refresh }: { state: ConsoleState; fresh: boolean; refresh: () => Promise<void> }) {
  const [observation, setObservation] = useState<WalletState | null>(null);
  const [observationError, setObservationError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [prepared, setPrepared] = useState<(Prepared & { kind: string }) | null>(null);
  const [consent, setConsent] = useState(false);
  const [kind, setKind] = useState('registerDevice');
  const [integer, setInteger] = useState('');
  const [expiry, setExpiry] = useState('');
  const [localOperation, setLocalOperation] = useState<WalletOperation | null>(null);
  const lock = useRef(false);
  const role = state.role;
  const operations = localOperation ? [localOperation, ...state.walletOperations.filter(o => o.operationId !== localOperation.operationId)] : state.walletOperations;
  const pending = operations.some(pendingWallet);
  const actualKind = role === 'merchant' ? 'claim' : kind;
  const unresolvedPayment = (state.attempts ?? []).some(a => !['authorized', 'refused', 'expired', 'failed'].includes(a.status));
  const reclaimBlocked = actualKind === 'sweepOnRevoke' && unresolvedPayment;
  const needsAmount = ['registerAgent', 'fundEscrow'].includes(actualKind);
  const integerValid = !needsAmount || positiveInteger(integer, actualKind === 'registerAgent' ? 1000000n : 10000000n);

  async function observeBalance() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setObservationError('');
    try {
      const result = await api<WalletState>('/api/v1/wallet-state');
      if (typeof result.observedAt !== 'string' || result.observedLedger == null || role === 'owner' && typeof result.escrowStroops !== 'string' || role === 'merchant' && typeof result.pendingStroops !== 'string') throw new ApiError('INVALID_WALLET_RESPONSE');
      setObservation(result); await refresh();
    } catch (e) { setObservationError(`Current chain observation unavailable. ${errorText(e)}`); }
    finally { lock.current = false; setBusy(false); }
  }
  async function prepare() {
    if (lock.current || pending || !fresh || !integerValid || reclaimBlocked) return;
    lock.current = true; setBusy(true); setError(''); setConsent(false);
    try {
      let input: Record<string, string> = { kind: actualKind };
      if (actualKind === 'registerAgent') {
        if (!Number.isFinite(Date.parse(expiry))) throw new ApiError('INVALID_EXPIRY');
        const end = new Date(expiry).getTime();
        if (end <= Date.now() || end > Date.now() + 3600000) throw new ApiError('EXPIRY_MUST_BE_WITHIN_ONE_HOUR');
        input = { ...input, maxAmountStroops: integer, expiresAt: new Date(end).toISOString() };
      } else if (actualKind === 'fundEscrow') input.amountStroops = integer;
      const result = await api<Prepared>('/api/v1/wallet-operations', jsonMutation('POST', input));
      if (typeof result.operationId !== 'string' || typeof result.unsignedXdr !== 'string' || result.signerAddress !== state.walletAddress || result.networkPassphrase !== 'Test SDF Network ; September 2015') throw new ApiError('INVALID_WALLET_PREPARATION');
      setPrepared({ ...result, kind: actualKind });
      setLocalOperation({ operationId: result.operationId, kind: actualKind, status: 'prepared', expiresAt: result.expiresAt });
    } catch (e) { setError(`Wallet preparation unconfirmed. ${errorText(e)} Refresh console state before preparing another action.`); await refresh(); }
    finally { lock.current = false; setBusy(false); }
  }
  async function sign() {
    if (lock.current || !prepared || !consent || !fresh) return;
    lock.current = true; setBusy(true); setError('');
    let submitStarted = false;
    try {
      if (Date.parse(prepared.expiresAt) <= Date.now()) throw new ApiError('PREPARATION_EXPIRED');
      const { signPreparedWallet } = await import('../wallet');
      const signedXdr = await signPreparedWallet(prepared);
      // Clear review material before the single handoff. Any response loss leaves
      // only the original operation observation action, never a second submit.
      const id = prepared.operationId;
      setPrepared(null); setConsent(false); submitStarted = true;
      setLocalOperation({ operationId: id, kind: prepared.kind, status: 'unknown', expiresAt: prepared.expiresAt });
      const result = await api<WalletOperation>(`/api/v1/wallet-operations/${encodeURIComponent(id)}/submit`, jsonMutation('POST', { signedXdr }));
      if (result.operationId !== id || typeof result.status !== 'string') throw new ApiError('INVALID_WALLET_RESPONSE');
      setLocalOperation({ ...result, kind: prepared.kind, expiresAt: prepared.expiresAt });
      await refresh();
    } catch (e) { setError(submitStarted ? `Wallet handoff unresolved. Observe the saved operation only. ${errorText(e)}` : 'Wallet signature unavailable or declined. Nothing was submitted by this action; the original preparation remains saved.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function observeOperation(op: WalletOperation) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await api<WalletOperation>(`/api/v1/wallet-operations/${encodeURIComponent(op.operationId)}`);
      if (result.operationId !== op.operationId || typeof result.status !== 'string') throw new ApiError('WALLET_IDENTITY_MISMATCH');
      setLocalOperation({ ...result, kind: op.kind, expiresAt: op.expiresAt });
      if (result.status !== 'prepared') setPrepared(null);
      await refresh();
    } catch (e) { setError(errorText(e)); }
    finally { lock.current = false; setBusy(false); }
  }

  return <section id={role === 'owner' ? 'policy' : 'claims'} className="pc-section"><SectionTitle number="01" title={role === 'owner' ? 'Authority, with an edge.' : 'Pending is not claimed.'} detail={role === 'owner' ? 'A per-payment cap, a finite escrow and an expiry. Human signatures only.' : 'Authorization credits escrow. Claiming requires a separate merchant signature.'} />
    <div className="pc-wallet-grid"><div className="pc-policy-observation"><div className="pc-row"><h3>{role === 'owner' ? 'Policy & escrow' : 'Merchant pending'}</h3><button className="pc-button" disabled={busy} onClick={() => { void observeBalance(); }}>Refresh chain observation</button></div>
      <div className="pc-balance"><span>{role === 'owner' ? 'Observed finite escrow' : 'Observed pending balance'}</span><strong>{observation ? amount(role === 'owner' ? observation.escrowStroops : observation.pendingStroops) : 'Unknown'}</strong><p>{observation ? `${role === 'owner' ? observation.escrowStroops : observation.pendingStroops} integer stroops` : 'CHAIN_REFRESH_REQUIRED · no current balance observation'}</p></div>
      {observationError && <p className="pc-error" role="alert">{observationError} {observation && 'The displayed values are the last successful observation.'}</p>}
      {observation && <p className="pc-caption">Observed ledger {String(observation.observedLedger)} · {time(observation.observedAt)}. This snapshot does not guarantee current readiness.</p>}
      {role === 'owner' && <><div className="pc-policy-facts"><div><span>Configured agent</span><Status value={state.agent?.status ?? 'unprovisioned'} /></div><div><span>Observed per-payment cap</span><strong>{observation ? observation.policy ? amount(observation.policy.maxAmountStroops) : 'No active policy observed' : 'Unknown · refresh required'}</strong></div><div><span>Observed policy expiry</span><strong>{observation?.policy ? time(observation.policy.expiresAt) : 'Unavailable'}</strong></div></div>
        {observation?.policy && Date.parse(observation.policy.expiresAt) <= Date.now() && <p className="pc-error">Observed policy has expired. New authorization is unavailable.</p>}
        {state.agent && <details><summary>Configured policy snapshot &amp; contracts</summary><p>Last stored cap {amount(state.agent.policyMaxStroops)} · expiry {time(state.agent.policyExpiresAt)} · ledger {state.agent.policyObservedLedger ?? 'Unavailable'}. These are stored observations.</p><Identifier label="Agent public key" value={state.agent.publicKey} /><Identifier label="Device hash" value={state.agent.deviceHash} />{(['deviceContractId', 'agentContractId', 'escrowContractId', 'assetContractId'] as const).map(k => <Identifier key={k} label={k} value={state.agent![k]} />)}</details>}</>}
      <Identifier label={role === 'owner' ? 'Owner wallet' : 'Merchant wallet'} value={state.walletAddress} />
    </div><div className="pc-consent"><h3>{role === 'owner' ? 'Human wallet controls' : 'Separate merchant claim'}</h3><p>Preparing does not sign. Review the Testnet action, then explicitly open Freighter with the configured wallet.</p>
      <form onSubmit={e => { e.preventDefault(); void prepare(); }}>
        {role === 'owner' && <label>Wallet action<select value={kind} disabled={busy || pending} onChange={e => { setKind(e.target.value); setInteger(''); }}>{Object.entries(actionNames).filter(([key]) => key !== 'claim').map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>}
        {needsAmount && <div className="pc-field"><label htmlFor="pc-wallet-amount">{actualKind === 'registerAgent' ? 'Per-payment cap in integer stroops (max 1000000)' : 'Funding in integer stroops (max 10000000)'}</label><input id="pc-wallet-amount" aria-describedby="pc-wallet-amount-help" inputMode="numeric" pattern="[1-9][0-9]*" value={integer} disabled={busy || pending} onChange={e => setInteger(e.target.value)} required maxLength={39} /><small id="pc-wallet-amount-help">{amount(integer)} · 1 XLM = 10000000 stroops</small></div>}
        {actualKind === 'registerAgent' && <label>Policy expiry (your local time, within one hour)<input type="datetime-local" step="1" value={expiry} disabled={busy || pending} onChange={e => setExpiry(e.target.value)} required /></label>}
        {actualKind === 'sweepOnRevoke' && <p className="pc-notice">Reclaim requires independently confirmed revocation and no unresolved purchase. {reclaimBlocked ? 'An unresolved purchase blocks reclaim. Observe its saved identity; held funds remain reserved.' : 'The server rechecks both conditions before preparation and submission.'}</p>}
        {role === 'merchant' && <p className="pc-notice">The contract determines the claim amount from merchant pending. No client amount or proof is accepted.</p>}
        <button className="pc-button" type="submit" disabled={busy || pending || !fresh || !integerValid || reclaimBlocked}>Prepare {actionNames[actualKind]?.toLowerCase()}</button>
      </form>
      {pending && !prepared && <p className="pc-notice">An operation is already saved. Observe its original identity. A saved preparation cannot be resumed here without its review material; wait for its expiry before preparing again.</p>}
      {prepared && <div className="pc-wallet-review"><h4>Review: {actionNames[prepared.kind]}</h4><p>Stellar Testnet · expires {time(prepared.expiresAt)}</p><Identifier label="Prepared operation ID" value={prepared.operationId} /><Identifier label="Required signer" value={prepared.signerAddress} /><label className="pc-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />I reviewed this action and will verify the transaction in Freighter.</label><button className="pc-button pc-primary" disabled={busy || !consent || !fresh || Date.parse(prepared.expiresAt) <= Date.now()} onClick={() => { void sign(); }}>Review &amp; sign in Freighter</button></div>}
      {error && <p role="alert" className="pc-error">{error}</p>}
    </div></div>
    {operations.length > 0 && <details className="pc-wallet-history"><summary>Saved human wallet operations ({operations.length})</summary>{operations.map(op => <div className="pc-wallet-op" key={op.operationId}><div className="pc-row"><strong>{actionNames[op.kind] ?? op.kind}</strong><Status value={op.status} /></div><Identifier label="Wallet operation ID" value={op.operationId} /><Identifier label="Wallet transaction hash" value={op.txHash} /><button className="pc-button" disabled={busy} onClick={() => { void observeOperation(op); }}>Observe wallet operation</button></div>)}</details>}
  </section>;
}
