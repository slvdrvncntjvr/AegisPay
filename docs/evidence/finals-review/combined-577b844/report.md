# Independent final-source review — 2026-11-10

Reviewed commit `577b84485b00634c8566060ff8a477dc0e030ba1` in existing Orca task `task_66a91e78fcbc`, dispatch `ctx_0528d0d38d7d`. **Two P2 defects; no confirmed P0/P1 defect found in the reviewed paths. This is a scoped source review, not full-release or live-MVP acceptance.** No implementation was changed.

Read AGENTS, the index/plan/decision ledger and relevant PRD, architecture, data, API, security and QA requirements; inspected the final validation report/receipt, TASK-008 report, TASK-007 draft and TASK-017 report/acceptance. The coordinator's reported 120 PostgreSQL / 88 unit / 50 offline spike / 15 browser passes and type/lint/build results are inherited evidence, not tests rerun by this reviewer. No tests, builds, services, installs, private configuration/journal reads, DB/provider/model/chain requests, browser authentication, Git mutation or deployment occurred.

## Prioritized defects

### F1 — P2: a new Start after reload can replay an acknowledged old task

**Files:** `apps/web/src/components/product/run-panel.tsx:68`, `:75`, `:77`, `:90`; server behavior at `src/server/domain/purchases.ts:47`.

**Trigger:** successfully submit task T, let its run finish, reload the console before using “Compose a new task,” then enter T and press “Start task.” The digest-indexed sessionStorage key survives a successful response; only the in-memory confirmed flag resets on reload. The only storage deletion is behind the old component's confirmed-state compose button. The reloaded Start therefore submits the previous key; createRun correctly returns the old run without creating a new job. A failed old run is similarly replayed. If operator model configuration changed, the stale key can instead produce an idempotency conflict.

**Impact:** an explicit new intent silently receives historical execution, particularly damaging a repeated-task/changed-price rehearsal. This does not cause duplicate spend; it prevents the requested new execution.

**Minimal repair:** distinguish an unresolved transport intent from a confirmed run. Clear the persisted unresolved key once a valid acknowledgement is obtained while retaining the in-memory key for that submission; keep the original persisted key on ambiguous failures. An explicit new Start must allocate a fresh key, even for identical task text.

**Missing regression:** extend `tests/e2e/authenticated-console.spec.ts:97` with acknowledged completion → reload → same task → different key/new run, and ambiguous response → reload → recovery → original key. The current test covers only same-mount retry/double activation.

### F2 — P2: model tool-choice explanations never reach the authenticated console

**Files:** `apps/server/src/worker/run.ts:67`, `:112`, `:121`; `src/server/agent/events.ts:11`; `apps/web/src/components/product/run-panel.tsx:102`. Requirement: PRD F-005 and its owner/developer journey require a concise stated choice reason.

**Trigger:** the provider returns a tool call with a public, non-thought explanation. The calls branch saves providerContent privately and never projects step.text; tool_selected exports only the tool name. The console renders identifiers/status/tool names, with no choice-reason field. A later final report summary is neither required nor bound to the earlier offer decision. Thus even an otherwise successful purchase cannot expose the promised choice rationale through the implemented API/UI.

**Impact:** the judge/owner cannot inspect why a report was selected or declined, weakening the specified agentic demonstration. Financial enforcement remains independent.

**Minimal repair:** define a short, explicitly public choice-summary contract, keep it separate from provider continuation/thought parts, validate and display it as untrusted model commentary, and retain trusted financial state separately. Do not publish raw providerContent or infer a rationale from payment success.

**Missing regression:** a synthetic adapter response with public explanation plus private thought/signature must expose only the bounded public explanation in events/UI, including a no-purchase choice.

## Financial and API inspection

The transaction adapter at `run.ts:27` deliberately executes nested domain work on the existing transaction connection. trustedTool calls an in-process Request/Response handler, not network fetch; its injected wake is a no-op. Inspected reachable catalog/quote/accept/attempt/receipt paths use scoped db/transaction, not a fresh pool connection. Reacquiring agent/run row locks on that same connection does not self-deadlock. The model path locks job → agent → run → quote/attempt; inspected payment updates use agent → run → quote/attempt and do not acquire that run-job lock while holding the agent. Browser throttle writes finish outside the subsequent domain transaction. **No concrete nested-transaction or lock-cycle defect was found in these paths.** This is static analysis, not a contention/deadlock execution test.

Lease owner/kind/entity/deadline checks fence model state and completion writes; provider work happens outside SQL locks. A turn/time allowance is persisted before provider work. Timeout racing and a second fenced checkpoint prevent late provider responses from executing tools. Quote acceptance, nonce/budget mutation, reconcile job, operation mapping, response and checkpoint commit together; process death before commit cannot leave a visible financial attempt without its model mapping. Waiting resumes the saved tool without recounting it. The legacy unmatched-attempt guard completes only the model job, preserving original payment/run/hold.

The inspected 402 producer matches quoteChallengeSchema, including network/header/immutable SQL comparison. Attempt identity and receipt/resource responses match trustedTool consumption. State/run/event producers match UI field names and string serialization. API007 checks owner or exact worker-run scope, rejects merchant/foreign ownership, validates positive int64 cursors, orders/caps rows, advances over filtered rows and applies an explicit payload projection plus no-store. No raw checkpoint, report, provider continuation or receipt bearer is exported by events.

## Death-test and browser limits

TASK-017 actually terminates owned OS children, asserts SIGKILL exit, absence of killed-child finally/done events, retained agent lease, denied early recovery, and fresh-process/fresh-connection recovery. Its assertions preserve operation/nonce/terms/envelope fingerprint/reservation/handoff; post-marker/no-send stays unknown with zero submits, post-submit recovery grants/accounts once. Exact-owner lease expiry acceleration is explicit. These are meaningful payment-executor crash assertions, not merely injected exceptions.

The harness directly invokes processPayment; it does **not** kill processRun/runConsumer, terminate inside quote/accept/checkpoint or evidence-grant SQL transactions, exercise queue startup, wait natural lease expiry, or establish hosted/provider/chain recovery. Model tests simulate stale leases, budget reservation and timeout in-process. Add real model-child termination around turn reservation, tool transaction before commit and after commit/before finishJob, plus a one-connection/concurrent consumer regression for the scoped transaction adapter, before claiming those boundaries empirically qualified. These are qualification gaps, not demonstrated financial defects, and do not invalidate the narrower TASK-017 acceptance.

Browser tests intercept every protected API call. They check consent gating but never execute a Freighter signature/submission; they do not join browser, real HTTP auth, database and worker. Source uses same-origin no-store requests, clears protected UI on401, checks operation/receipt identity, gates report reads, and keeps wallet review/sign/submit separate. No client product import reaches protected report fixtures or worker modules. A read-only scan of the existing 16 static build files found neither protected report sentinel prefix; fingerprints are recorded. Those artifacts were not rebuilt or independently tied to a deployment. The supplied 15 browser tests do not implement QA's comprehensive HTML/RSC/static sentinel gate; retain that gate and genuine wallet/browser integration acceptance.

## Provider and source receipt

Static generation construction at `src/server/integrations/model.ts:94` / `:367` normalizes exactly one models/ prefix and constructs the fixed Google v1beta models/{name}:generateContent endpoint with POST and header authentication. No concrete URL/configuration defect explaining POST404 was found without accessing private configuration/network. Discovery success does not establish generation access; keep the recorded MODEL_UNAVAILABLE/POST404 unresolved rather than declaring the model absent or guessing a replacement.

[source-fingerprints.json](source-fingerprints.json) records 67 file SHA-256 fingerprints, commit tree entries and all 30 receipt comparisons: **30 matched, zero mismatched**. Source/test/script/package paths have no diff from577b844. The canonical plan/ledger had coordinator-owned working changes before this review; those are contextual documents, not evidence that application source changed. Existing static artifact fingerprints have separate, explicitly limited provenance.

The original Velo incident remains held, unresolved and unentitled. No current model generation, new real model purchase, same-invocation verification, real wallet lifecycle or hosted release is established by this review. Preserve historical reports and the TASK-010/012 release gates; worker_done success means this review was delivered.
