// Web process contains only this shared wake token, never worker signing keys.
export async function wakeWorker(env: NodeJS.ProcessEnv) {
  if (!env.WORKER_WAKE_URL || !env.WORKER_WAKE_TOKEN) return;
  try {
    const target = new URL(env.WORKER_WAKE_URL);
    if (target.pathname !== '/wake' || target.username || target.password || target.search || target.hash || target.protocol !== 'https:' && !(target.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(target.hostname))) return;
    await fetch(target, { method: 'POST', headers: { Authorization: `Bearer ${env.WORKER_WAKE_TOKEN}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(1500), redirect: 'error' });
  } catch { /* Failed wake is not a payment failure. Durable SQL job remains. */ }
}
