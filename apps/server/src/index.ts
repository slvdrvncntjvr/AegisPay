import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { configuredStore } from '../../../src/server/db/connection.ts';
import { safeError } from '../../../src/server/http/boundaries.ts';
import { receiptTokens } from '../../../src/server/merchant/receipts.ts';
import { encryptionKey } from './worker/payment.ts';
import { createLivePaymentAdapter } from './worker/live-adapter.ts';
import { workerIngress } from './worker/ingress.ts';
import { paymentConsumer } from './worker/runtime.ts';

export async function startWorker(env: NodeJS.ProcessEnv = process.env) {
  const key = encryptionKey(env.ENVELOPE_ENCRYPTION_KEY), receipt = receiptTokens(env.RECEIPT_SIGNING_KEY);
  if (!env.WORKER_WAKE_TOKEN || env.WORKER_WAKE_TOKEN.length < 32) throw new Error('MISSING_WORKER_WAKE_TOKEN');
  const port = Number(env.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INVALID_WORKER_PORT');
  const store = configuredStore(env);
  let adapter: ReturnType<typeof createLivePaymentAdapter> | undefined;
  const consumer = paymentConsumer({ store, key, receiptHash: receipt.hash, adapter: () => {
    adapter ??= createLivePaymentAdapter(env, store).catch(error => { adapter = undefined; throw error; });
    return adapter;
  } });
  const wake = () => { void consumer.wake().catch(() => console.info(JSON.stringify({ component: 'payment-worker', code: 'WORKER_DEPENDENCY_UNAVAILABLE' }))); };
  const handler = workerIngress(env.WORKER_WAKE_TOKEN, wake);
  const server = createServer(async (incoming, outgoing) => {
    try {
      // Fixed base ignores untrusted Host/forwarded headers. Stream body to the
      // bounded reader instead of buffering an arbitrary incoming payload.
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value);
      const init: RequestInit & { duplex?: 'half' } = { method: incoming.method ?? 'GET', headers };
      if (!['GET', 'HEAD'].includes(init.method!)) { init.body = Readable.toWeb(incoming) as ReadableStream<Uint8Array>; init.duplex = 'half'; }
      const response = await handler(new Request(new URL(incoming.url ?? '/', 'http://localhost'), init));
      outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(await response.text());
    } catch (error) { const response = safeError(error); outgoing.writeHead(response.status, Object.fromEntries(response.headers)); outgoing.end(await response.text()); }
  });
  server.requestTimeout = 10000; server.headersTimeout = 10000;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, env.WORKER_HOST ?? '127.0.0.1', resolve); });
  const timer = setInterval(wake, 2000);
  wake();
  console.info(JSON.stringify({ component: 'payment-worker', state: 'listening', network: 'testnet', port, modelExecution: 'TASK-007' }));
  return async () => {
    clearInterval(timer);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await consumer.idle().catch(() => {}); await store.close(); key.fill(0);
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) console.info(JSON.stringify({ component: 'payment-worker', network: 'testnet', jobExecution: 'durable-payment', check: 'imports-only-no-live-readiness' }));
  else {
    try { const stop = await startWorker(); const shutdown = () => { void stop().catch(() => { process.exitCode = 1; }); }; process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown); }
    catch { console.error(JSON.stringify({ component: 'payment-worker', code: 'WORKER_STARTUP_UNAVAILABLE' })); process.exitCode = 1; }
  }
}
