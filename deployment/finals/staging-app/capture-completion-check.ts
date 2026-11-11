/** Real loopback proxy and HTTP body, with controlled browser lifecycle input. */
import { EventEmitter } from 'node:events';
import http from 'node:http';
import { mkdir, readdir } from 'node:fs/promises';
import type { BrowserContext, Page } from '@playwright/test';
import { ObservationProxy } from './proxy-capture.ts';
import { exclusive, sha } from './evidence-terminal.ts';
import { FOLLOWUP } from './continuation.ts';

function check(condition: unknown, category: string) {
  if (!condition) throw new Error(category);
}

function browserLifecycle() {
  const session = Object.assign(new EventEmitter(), { send: async () => {}, detach: async () => {} });
  const context = { newCDPSession: async () => session } as unknown as BrowserContext;
  return { session, context, page: {} as Page };
}

const entity = 'synthetic proxy completion fixture';
let releaseResponse: () => void = () => {};
let observeRequest: () => void = () => {};
const responseGate = new Promise<void>(resolve => { releaseResponse = resolve; });
const upstreamRequested = new Promise<void>(resolve => { observeRequest = resolve; });
const upstream = http.createServer((_request, response) => {
  observeRequest();
  void responseGate.then(() => response.end(entity));
});
const report: Record<string, unknown> = { outcome: 'failed', scope: 'synthetic lifecycle regression with real loopback proxy and ServerResponse finish', started_at: new Date().toISOString() };
let proxy: ObservationProxy | undefined;
await mkdir(FOLLOWUP, { recursive: true });
const attempt = (await readdir(FOLLOWUP)).filter(name => /^completion-check(?:-\d+)?\.json$/.test(name)).length + 1;
await exclusive(FOLLOWUP + `/completion-check-execution-${attempt}.json`, JSON.stringify({ started_at: report.started_at, synthetic: true }) + '\n');
try {
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  const port = (upstream.address() as { port: number }).port;
  const scanned = new Set<string>();
  proxy = new ObservationProxy(port, bytes => { scanned.add(sha(bytes)); });
  const origin = await proxy.start(0);
  const browser = browserLifecycle();
  const capture = await proxy.capture(browser.context, browser.page);
  const url = origin + '/fixture/completion';
  browser.session.emit('Network.requestWillBeSent', { requestId: 'held', request: { url, method: 'GET', headers: {} } });
  const response = fetch(url, { signal: AbortSignal.timeout(8000) });
  let requestTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([upstreamRequested, new Promise<never>((_, reject) => {
      requestTimer = setTimeout(() => reject(new Error('SYNTHETIC_UPSTREAM_NOT_REACHED')), 5000);
    })]);
  } finally { clearTimeout(requestTimer); }
  let drainSettled = false;
  const drain = capture.drain('AFTER_TRANSITION').then(() => { drainSettled = true; });
  await new Promise(resolve => setTimeout(resolve, 250));
  const pending = capture.summary();
  check(!drainSettled && pending.pending_captures === 1 && pending.pending_proxy_responses === 1, 'GENUINELY_PENDING_PROXY_WORK_SETTLED');
  releaseResponse();
  const delivered = await response;
  browser.session.emit('Network.responseReceived', { requestId: 'held', response: { status: delivered.status } });
  check(await delivered.text() === entity && scanned.has(sha(entity)), 'EXACT_SYNTHETIC_ENTITY_NOT_SCANNED');
  // The fixture supplies responseReceived but omits both CDP terminal events.
  await drain;
  const completion = capture.summary();
  check(completion.completed_by_matched_proxy_finish === 1 && completion.upstream_response_finished === 1 && completion.pending_browser_requests === 0 && completion.pending_proxy_responses === 0 && completion.exact_request_count_maps_match, 'MISSING_TERMINAL_EVENT_NOT_RECONCILED');
  check(completion.completion_evidence.cdp_loading_finished === 0 && completion.completion_evidence.cdp_loading_failed === 0 && completion.completion_evidence.matched_proxy_response_finish === 1, 'COMPLETION_EVIDENCE_MISCLASSIFIED');
  await capture.detach();
  report.pending_before_delivery = pending.pending_categories;
  report.matched_completion = completion;

  const mismatch = browserLifecycle();
  const mismatchCapture = await proxy.capture(mismatch.context, mismatch.page);
  const mismatchUrl = origin + '/fixture/mismatch';
  mismatch.session.emit('Network.requestWillBeSent', { requestId: 'mismatch', request: { url: mismatchUrl, method: 'GET', headers: {} } });
  await (await fetch(mismatchUrl, { signal: AbortSignal.timeout(8000) })).arrayBuffer();
  mismatch.session.emit('Network.responseReceived', { requestId: 'mismatch', response: { status: 201 } });
  const rejected = await mismatchCapture.drain('AFTER_TRANSITION').then(() => false, () => true);
  const mismatchSummary = mismatchCapture.summary();
  check(rejected && mismatchSummary.completed_by_matched_proxy_finish === 0 && mismatchSummary.diagnostics.some(item => item.category === 'DELIVERED_STATUS_CHANGED'), 'MISMATCHED_STATUS_ACCEPTED');
  report.mismatched_status_rejected = true;
  report.outcome = 'passed';
} catch (error) {
  report.safe_failure = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : 'SYNTHETIC_COMPLETION_CHECK_FAILED';
} finally {
  releaseResponse();
  await proxy?.close();
  await new Promise<void>(resolve => upstream.close(() => resolve()));
  report.finished_at = new Date().toISOString();
  const receipt = FOLLOWUP + `/completion-check-${attempt}.json`;
  await exclusive(receipt, JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ outcome: report.outcome, safe_failure: report.safe_failure, receipt }) + '\n');
  process.exitCode = report.outcome === 'passed' ? 0 : 1;
}
