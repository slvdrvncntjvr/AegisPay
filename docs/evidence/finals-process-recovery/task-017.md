# TASK-017 — actual process-death qualification

Targeted gate: **9/9 passed, exit 0** on Windows / Node 24.22.1, against actual local PostgreSQL 17 and explicitly synthetic payment/provider data. The full sequential PostgreSQL integration suite subsequently passed **119/119 across nine files, exit 0** in the coordinator-granted stable-source slot. Shared root/web typecheck and full lint await the UI source-stability notice. This qualifies process-death behavior independently of the blocked live TASK-005 purchase; it does not complete TASK-005, TASK-006, hosted recovery or release acceptance.

Work ref: Orca task `task_a52076175ac0`, dispatch `ctx_21b965ed5a03`, local HEAD `6765edbe76405a5398d25c7098ebabb678e87b37`. The only source additions are `tests/integration/process-death.test.ts`, `tests/integration/support/payment-process-child.ts` and `tests/integration/support/process-death.ts`. No application source, accepted tests, manifests, lockfiles, configuration, canonical documents, commits, pushes or deployments were changed by this worker.

## What actually died

Each case forks Node with the pinned installed tsx loader and invokes the real `processPayment`. A deterministic executor hook commits a synthetic `blocked` event and sends an IPC handshake, then waits on a promise with no rejection/release path. The parent inspects the attempt and active lease through a second PostgreSQL store before invoking `child.kill('SIGKILL')` on its exact owned ChildProcess. Node reports **code null / signal SIGKILL** after OS termination (Windows TerminateProcess semantics). There is no thrown crash exception, signal handler or graceful shutdown path.

After exit, the attempt remains exactly as it was at the hook, and the same lease owner/deadline remains durable. The killed actor has neither the wrapper's `finally` event nor its `done` event; preservation of the executor-owned lease additionally demonstrates that the executor's lease-clearing `finally` did not run. Before accelerating expiry, an early fresh process completes with no provider work and cannot clear the dead owner's lease.

Recovery uses fresh OS processes, fresh PostgreSQL connections (independent backend PIDs), and provider history persisted in `synthetic_process_provider`. Signing, sponsorship, submission, observation and verification calls are counted in append-only `synthetic_process_event` rows committed before adapter calls return. No in-memory provider map is reconstructed to manufacture recovery. The only synthetic provider success is created by the test adapter's actual single `submit` call; observation reads that persisted history and cannot create success for a marker with no submit.

## Targeted observations

Counts include the killed process, the lease-denied process and all recovery processes. `sign` denotes a synthetic adapter invocation, never an actual cryptographic agent signature. Every amount below is a synthetic fixture amount in integer stroops.

| OS-death hook | Sign | Sponsor | Submit | Observe | Verify | Final status | Grants | Held / spent |
|---|---:|---:|---:|---:|---:|---|---:|---|
| after_sign_before_persist | 1 | 0 | 0 | 0 | 0 | manual_review / PREPARATION_INTERRUPTED | 0 | 300000 / 0 |
| after_envelope | 1 | 1 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |
| after_reserve_before_persist | 1 | 2 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |
| after_reservation | 1 | 1 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |
| before_handoff | 1 | 1 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |
| after_handoff_before_send | 1 | 1 | 0 | 3 | 0 | unknown | 0 | 300000 / 0 |
| after_submit | 1 | 1 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |
| before_grant | 1 | 1 | 1 | 2 | 2 | authorized (synthetic) | 1 | 0 / 300000 |
| after_submit, recover after quote expiry | 1 | 1 | 1 | 1 | 1 | authorized (synthetic) | 1 | 0 / 300000 |

The interrupted reservation-persistence case makes two sponsor calls using the same immutable idempotency key and exact envelope fingerprint; it recovers the same durable synthetic reservation and submits once. The post-submit case proves provider history contains a successful synthetic outer identity while the attempt still has `submitting` and no outer hash saved. A fresh process observes the original request/inner hash and grants once. At `before_grant`, the killed process has no proof or entitlement row and budget remains entirely held; recovery creates one linked proof/grant, one authorization audit and one accounting conversion. Further fresh-process execution does not duplicate them.

Assertions preserve operation/idempotency key, increasing allocated nonce and agent last nonce, immutable terms hash/amount/deadline/acceptance, any saved inner/reservation identity and the original handoff timestamp. Saved-envelope recovery decrypts the actual persisted GCM ciphertext and compares its fingerprint to the original durable provider fingerprint; submission must use that same fingerprint. The handoff and all final states require null ciphertext/IV/tag/key-version. No envelope, receipt secret, key value or private connection string is exported.

## Isolation, timing and limits

The existing `createTestDatabase` guard permits only the loopback `aegispay_integration` database. Every case owns a fresh UUID schema with the existing exact ownership comment; cleanup drops only that verified schema. Existing Docker services/volumes remain intact. No application database, funded fixture, signed journal, Gas/RPC/model endpoint or cloud resource is queried. No real queue consumer or worker entrypoint runs.

The child receives an explicit environment allowlist: test DB/schema and SystemRoot/WINDIR/TEMP/TMP where present. Windows/libuv otherwise supplies parent profile/PATH variables automatically, so the harness explicitly passes those defaults as empty and the child removes them before DB work; its strict environment-name guard rejects any unexpected variable. No parent `NODE_OPTIONS`, worker login, agent/Velo/model/receipt credentials or worker env file is inherited. DB connection strings never appear in argv, IPC evidence, output or reports.

Only after proven OS exit, preserved active lease, absent finally cleanup and denied early restart does a test-only SQL compare-and-swap expire the exact killed owner/deadline inside the isolated schema. PostgreSQL's original microsecond lease timestamp is retained for that comparison. **The production 120-second wait is accelerated; production code and lease rules are unchanged.** Regular fixture quotes use the allowed 120000 ms TTL. The late-observation case declares a 10000 ms immutable fixture TTL and waits for the actual database deadline predicate before restarting; the quote is never rewritten and the system clock is never changed.

Each child has a 15-second owned-process watchdog; IPC waits time out after 12 seconds. Parent `finally` terminates any remaining owned children and invokes guarded schema cleanup. No process-name/global kill, broad filesystem deletion or service reset occurs. Timing is descriptive; handshakes, durable DB predicates and actual exit events establish the assertions.

All eight available requested hooks are established. This does not kill inside the grant transaction (there is no such hook), simulate a cold host/database outage, run a deployed worker/queue or independently qualify actual provider fencing/chain verification. The post-marker case proves zero submits over three tested fresh recoveries and unchanged durable identity; unlimited future behavior is not an empirical claim. Production conservative recovery branches remain responsible for later executions. All proof/grant rows are synthetic and disappear with their UUID test schema; nothing enters `docs/evidence/testnet` or the live proof namespace.

## Gates and artifacts

- Targeted: `COREPACK_ENABLE_NETWORK=0 corepack.cmd pnpm exec vitest run tests/integration/process-death.test.ts` with `AEGISPAY_PROCESS_DEATH_EVIDENCE=1`: **exit 0, 9/9, 110.57 s**. [Output](targeted.txt), [redacted synthetic assertions/timing/events](synthetic-process-assertions.json).
- Full sequential PostgreSQL integration suite: `COREPACK_ENABLE_NETWORK=0 corepack.cmd pnpm test:integration` **exit 0, 119/119 across nine files, 166.56 s**, including the nine actual process-death cases ([output](integration.txt)). Coordinator granted the first slot after the model worker's stable-source pause; both were notified immediately on completion/release. No overlapping full integration suite was run by this worker.
- Root + web typecheck and full lint: pending both model/UI stable-source notices. One interim root typecheck ran before the coordinator hold notice and exited 2 on the in-progress model worker's `src/server/agent/state.ts:9` (`role`/`parts` on `object`); no TASK-017 file error was reported. [Interim output](typecheck.txt).
- Frozen-scope lint: `corepack.cmd pnpm exec eslint tests/integration/process-death.test.ts tests/integration/support/process-death.ts tests/integration/support/payment-process-child.ts` **exit 0**, no diagnostics ([output](scoped-lint.txt)); full lint remains separate.
- Documentation: `python tools/check-docs.py` **exit 0**, 21 canonical Markdown files checked ([output](docs-check.txt)); `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` **exit 0**, 17 valid task rows and coherent dependency/state DAG ([output](plan-check.txt)). These are documentation checks, not application tests.
- [SHA-256 source/config/toolchain receipt](source-hashes.json): 23 inspected/tested source and configuration files. The [full-suite receipt](full-suite-source-hashes.json) covers 67 integration-related source/test/migration/configuration files. The [closing full-suite consistency check](full-suite-consistency.json), at 2026-11-10T08:14:41.865796Z, confirms **67/67 and 23/23 unchanged**, at the same HEAD, after the actual full gate.

Harness bring-up initially failed because the proposed 300000 ms fixture quote violated the existing 120-second SQL limit, and because Windows injected standard environment defaults into a minimally supplied environment. A second isolated run identified those environment names without exposing their values. Correcting only the new harness produced the passing isolated envelope case and then the complete 9/9 targeted run; no executor defect or production-rule relaxation was needed.
