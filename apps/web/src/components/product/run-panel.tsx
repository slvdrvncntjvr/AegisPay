'use client';
import { useEffect, useRef, useState } from 'react';
import { activeRun, amount, api, ApiError, errorText, jsonMutation, record, time, type Offer, type Run, type RunEvent } from './api';
import { Identifier, SectionTitle, Status } from './primitives';

const eventLabels: Record<string, string> = { run_started: 'Worker started', model_turn: 'Model turn', model_choice: 'Public model choice', tool_selected: 'Tool selected', quote_received: 'Immutable quote received', payment_accepted: 'Quote accepted', payment_observed: 'Original payment observed', resource_delivered: 'Entitled resource delivered', run_completed: 'Run completed', run_stopped: 'Run stopped' };

async function intentStorageKey(task: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(task.trim()));
  return `aegis-run-intent:${Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')}`;
}

export function RunPanel({ runs, offers, fresh, ready, refresh }: { runs: Run[]; offers: Offer[]; fresh: boolean; ready: boolean; refresh: () => Promise<void> }) {
  const [task, setTask] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Run | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [traceState, setTraceState] = useState('');
  const [error, setError] = useState('');
  const [pollError, setPollError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const lock = useRef(false);
  const key = useRef<string | null>(null);
  const storageIntent = useRef<string | null>(null);
  const selected = selectedId || runs[0]?.id || '';
  const listed = runs.find(r => r.id === selected);
  const current = detail?.id === selected ? detail : listed;
  // Detail polling can finish before the parent state snapshot refreshes.
  // Use that observation for the matching run while preserving other holds.
  const observedRuns = runs.map(run => current && run.id === current.id ? current : run);
  const active = observedRuns.some(activeRun) || !!current && activeRun(current);

  useEffect(() => {
    if (!selected) return;
    let disposed = false, polling = false, traceAvailable = true;
    let cursor: string | null = null;
    let collected: RunEvent[] = [];
    setDetail(null); setEvents([]); setTraceState('Loading recorded run events…'); setPollError('');
    async function observe() {
      if (disposed || polling || document.hidden) return;
      polling = true;
      try {
        const run = await api<{ runId: string; task: string; status: string; finalAnswer: string | null; errorCode: string | null }>(`/api/v1/runs/${encodeURIComponent(selected)}`);
        if (run.runId !== selected || !['queued', 'running', 'waiting_payment', 'completed', 'failed'].includes(run.status) || typeof run.task !== 'string') throw new ApiError('INVALID_RUN_RESPONSE');
        if (!disposed) { setDetail({ ...run, id: run.runId }); setPollError(''); }
        if (traceAvailable) {
          try {
            const result = await api<{ events: RunEvent[]; nextCursor: string | null }>(`/api/v1/runs/${encodeURIComponent(selected)}/events${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`);
            if (!Array.isArray(result.events) || result.events.some(e => !record(e) || !/^\d+$/.test(e.id) || typeof e.kind !== 'string' || !record(e.safePayload))) throw new ApiError('INVALID_EVENTS_RESPONSE');
            collected = [...collected, ...result.events.filter(e => !collected.some(old => old.id === e.id))].slice(-300);
            cursor = result.nextCursor ?? cursor;
            if (!disposed) { setEvents(collected); setTraceState(collected.length ? '' : 'No worker events recorded. Queued is not executed.'); }
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) traceAvailable = false;
            if (!disposed) setTraceState(e instanceof ApiError && e.status === 404 ? 'Run trace unavailable: GET /api/v1/runs/:id/events is not available on this server.' : `Trace observation unavailable. ${errorText(e)}`);
          }
        }
      } catch (e) { if (!disposed) setPollError(`Last run observation may be stale. ${errorText(e)}`); }
      finally { polling = false; }
    }
    void observe();
    const timer = window.setInterval(() => { void observe(); }, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [selected]);

  // After reload, recovery also works when the server saved an active run but
  // its acknowledgement was lost. The owner re-enters the task to find its key;
  // raw task text is never restored from storage.
  useEffect(() => {
    if (!task.trim() || confirmed || uncertain) return;
    let disposed = false;
    void intentStorageKey(task).then(storageKey => {
      let saved: string | null = null;
      try { saved = sessionStorage.getItem(storageKey); } catch { /* optional storage */ }
      if (!disposed && saved && /^[a-f0-9-]{36}$/.test(saved)) {
        key.current = saved; storageIntent.current = storageKey; setUncertain(true);
      }
    });
    return () => { disposed = true; };
  }, [task, confirmed, uncertain]);

  async function submit() {
    if (lock.current || confirmed || !task.trim() || !fresh || !ready || active && !uncertain) return;
    lock.current = true; setBusy(true); setError('');
    try {
      // Remember only a task digest and opaque key for ambiguous reload recovery.
      // A transport retry of this intent must never generate another run key.
      const storageKey = await intentStorageKey(task);
      storageIntent.current = storageKey;
      if (!key.current) {
        try { key.current = sessionStorage.getItem(storageKey); } catch { /* Memory still preserves the key in this tab. */ }
        if (!key.current || !/^[a-f0-9-]{36}$/.test(key.current)) key.current = crypto.randomUUID();
        try { sessionStorage.setItem(storageKey, key.current); } catch { /* Storage is optional. */ }
      }
      const result = await api<{ runId: string; status: string }>('/api/v1/runs', { ...jsonMutation('POST', { task: task.trim() }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key.current } });
      if (typeof result.runId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(result.runId) || !['queued', 'running', 'waiting_payment', 'completed', 'failed'].includes(result.status)) throw new ApiError('INVALID_RUN_RESPONSE');
      // Persistent storage represents only an unresolved transport intent. Keep
      // the in-memory identity until the owner explicitly composes another task.
      try { sessionStorage.removeItem(storageKey); } catch { /* optional storage */ }
      storageIntent.current = null;
      setSelectedId(result.runId); setUncertain(false); setConfirmed(true);
      await refresh();
    } catch (e) { setUncertain(true); setError(`Run request has not been confirmed. ${errorText(e)} Recovering this request reuses its original key.`); }
    finally { setBusy(false); lock.current = false; }
  }

  const accepted = [...events].reverse().find(e => e.kind === 'payment_accepted');
  return <section id="run" className="pc-section"><SectionTitle number="02" title="Give the agent a task." detail="Trusted offers. Finite authority. A recorded decision trail." />
    <div className="pc-run-grid"><div className="pc-composer">
      <form onSubmit={event => { event.preventDefault(); void submit(); }}>
        <label htmlFor="pc-task">Task for the demo dependency</label><textarea id="pc-task" maxLength={2000} rows={4} value={task} disabled={busy || uncertain || confirmed} onChange={e => { setTask(e.target.value); key.current = null; }} placeholder="Assess demo-parser using the available fictional reports. Buy only what the task needs." required />
        <div className="pc-form-foot"><span>{task.length}/2000 · task ceiling is server enforced</span><button className="pc-button pc-primary" type="submit" disabled={busy || confirmed || !fresh || !ready || !task.trim() || active && !uncertain}>{busy ? 'Confirming run…' : confirmed ? 'Run saved' : uncertain ? 'Recover run request' : 'Start task'} <span aria-hidden>↗</span></button></div>
      </form>
      {confirmed && !active && <button type="button" className="pc-button" onClick={() => { if (storageIntent.current) { try { sessionStorage.removeItem(storageIntent.current); } catch { /* optional storage */ } } key.current = null; storageIntent.current = null; setTask(''); setConfirmed(false); setError(''); }}>Compose a new task</button>}
      {!ready && <p className="pc-notice">New tasks unavailable until the configured agent is active. Refresh policy observation; setup requires human consent.</p>}
      {active && <p className="pc-notice">An active run is already saved. Observe it before starting a separate task.</p>}
      {error && <p role="alert" className="pc-error">{error}</p>}
      <div className="pc-offers"><h3>Current offers <span>Future quotes only</span></h3>{offers.length ? offers.map(o => <div className="pc-offer" key={o.id}><div><strong>{o.resourceKey}</strong><p>{o.description}</p><small>{o.isDemo ? 'Fictional demo resource' : 'Resource metadata'} · {o.enabled ? 'Enabled' : 'Disabled'}</small></div><div><b>{amount(o.priceStroops)}</b><code>{o.priceStroops} stroops</code></div></div>) : <p>No offers available.</p>}</div>
    </div><div className="pc-run-observation">
      <div className="pc-row"><h3>Run observation</h3><span className="pc-caption">Polls every 10s while visible</span></div>
      {observedRuns.length > 0 && <label className="pc-run-select">Saved run<select value={selected} onChange={e => setSelectedId(e.target.value)}>{observedRuns.map(r => <option key={r.id} value={r.id}>{r.status} · {r.id}</option>)}</select></label>}
      {current ? <><Status value={current.status} /><Identifier label="Run ID" value={selected} /><p className="pc-task-summary">{current.task}</p>
        {current.status === 'queued' && <p className="pc-notice">Queued for the worker. No model choice, purchase or execution is implied.</p>}
        {current.errorCode && <p className="pc-error">Run stopped · {current.errorCode}</p>}
        {pollError && <p role="alert" className="pc-error">{pollError}</p>}
        {traceState && <p className="pc-notice">{traceState}</p>}
        <ol className="pc-timeline">{events.map(event => <li key={event.id}><div><strong>{eventLabels[event.kind] ?? 'Recorded event'}</strong><time>{time(event.createdAt)}</time></div>{event.kind === 'model_choice' && <div className="pc-choice"><p className="pc-choice-label">Untrusted model commentary · {event.safePayload.decision === 'no_tool' ? 'No tool proposed' : 'Tools proposed'}</p><p>{event.safePayload.summaryStatus === 'provided' && typeof event.safePayload.summary === 'string' ? event.safePayload.summary : event.safePayload.summaryStatus === 'withheld' ? 'Public choice summary withheld by display rules.' : 'Public choice summary unavailable: the model supplied none.'}</p><small>Commentary is not financial authority or payment evidence.</small></div>}<div className="pc-event-fields">{['tool', 'turn', 'resourceKey', 'quoteId', 'attemptId', 'operationId', 'status', 'code'].map(field => { const value = event.safePayload[field]; return typeof value === 'string' || typeof value === 'number' ? <p key={field}><span>{field}</span><code>{String(value)}</code></p> : null; })}</div></li>)}</ol>
        <div className="pc-quote"><h3>Accepted quote · immutable</h3>{accepted ? <><p>{String(accepted.safePayload.resourceKey ?? 'Unavailable')}</p><strong>{amount(accepted.safePayload.amountStroops)}</strong><p><code>{String(accepted.safePayload.amountStroops ?? 'Unavailable')} stroops</code> · expires {time(accepted.safePayload.expiresAt)}</p><Identifier label="Accepted quote ID" value={typeof accepted.safePayload.quoteId === 'string' ? accepted.safePayload.quoteId : null} /><Identifier label="Quote merchant" value={typeof accepted.safePayload.merchantAddress === 'string' ? accepted.safePayload.merchantAddress : null} /><Identifier label="Quote asset" value={typeof accepted.safePayload.assetContractId === 'string' ? accepted.safePayload.assetContractId : null} /></> : <p>No accepted quote snapshot returned for this run. Current offer prices cannot establish past payment terms.</p>}</div>
        {current.status === 'completed' && current.finalAnswer && <div className="pc-answer"><h3>Final answer</h3><p>{current.finalAnswer}</p><small>Fictional demo reports. Review the linked receipt in Audit for entitlement and independent evidence.</small></div>}
      </> : <p className="pc-empty">Your task history begins here. No model execution or payment is seeded.</p>}
    </div></div>
  </section>;
}
