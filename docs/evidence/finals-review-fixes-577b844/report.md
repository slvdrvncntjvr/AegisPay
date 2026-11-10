# Scoped final-review repairs — 2026-11-10

Work ref: Orca `run_3bfef6dba661`, task `task_7a04682f6919`, dispatch `ctx_9318cbc7e7c0`, baseline `577b84485b00634c8566060ff8a477dc0e030ba1`. Original [independent review](../finals-review/combined-577b844/report.md) is preserved. **Both scoped repairs pass their meaningful regression and local gates and are ready for independent recheck.** This report concerns F1/F2 implementation and local regression acceptance only; full actual model purchase and hosted release remain blocked.

## F1 — unresolved transport identity

After a validated run acknowledgement, RunPanel deletes the task-digest sessionStorage recovery entry and retains the in-memory key/confirmed state until explicit composition of another task. Ambiguous/malformed responses keep the original recovery identity. On reload the owner re-enters the task; its digest locates an unresolved key and enables recovery even if the server already saved an active run. Storage contains only the digest-indexed opaque UUID, never task text or access data.

Browser regressions cover acknowledged completed and failed runs followed by reload and identical explicit Start, each creating a distinct key/run; a simulated operator model revision rejects historical key reuse. Lost acknowledgement followed by reload recovers the original key despite an already saved active run, with one synthetic run identity. The original same-mount double activation/retry test remains, together with all existing role, ownership, wallet-consent, identity, receipt-gating, unknown-state and session-expiry cases.

## F2 — explicit public commentary contract

New API007 event kind `model_choice` has exactly:

```json
{"turn":2,"decision":"tools_proposed","summary":"QuickSignal fits this task.","summaryStatus":"provided"}
```

`turn` is an integer1–8; `decision` is `tools_proposed` or `no_tool`; `summaryStatus` is `provided`, `missing`, or `withheld`. A provided summary is normalized plain text of at most280 UTF-16 code units. Missing means the model supplied no public text; withheld means display rules refused it; both have `summary:null`. `no_tool` describes that provider turn and establishes no financial outcome. Coordinator received this exact contract in `msg_726ad3142001` for canonical reconciliation.

The producer reads only the adapter's already-public non-thought `step.text`, after validation of the complete tool-call batch. Event and checkpoint/completion commit together under the existing lease fence. It never extracts from providerContent, thoughts, signatures, tool payloads/results, or checkpoints. Both the tool branch and no-tool branch suppress choice export once `state.delivered` is set, preventing report-derived later summaries entering choice events. Private provider continuation remains private for correct provider replay.

The pure helper collapses paragraph whitespace, applies NFKC normalization and conservatively refuses the entire input for excess length, markup/structured-payload delimiters, URI patterns, non-paragraph control/bidi marks, financial-status vocabulary, credential/token markers and long opaque identifiers. It never truncates away a dangerous suffix. These checks harden display; they do not prove factuality, confidentiality against arbitrary semantic encoding, financial validity or model quality. Trusted immutable quote/receipt/payment fields remain separate and unchanged.

The event schema strips unknown fields and rejects invalid payloads. Existing API007 owner/scoped-worker/merchant boundaries, ascending bounded cursor including advancement over filtered rows, and no-store behavior remain unchanged; historical tool events still project. The UI renders the summary as React plain text, labels it **Untrusted model commentary**, says it is not financial authority/payment evidence, and renders precise missing/withheld copy without inventing a reason.

Synthetic wire-adapter tests return a public tool explanation and separate private thought/signature, then a no-purchase explanation: only public bounded commentary reaches events. Further assertions cover missing/withheld text, overlong/HTML/URI/control/financial prose, API redaction/ownership, and post-delivery tool plus final-answer exclusion. The original unmatched legacy-attempt quarantine and unknown-payment hold/no-entitlement assertions remain.

## Observed gates

Gate receipts and exact commands/exits/timestamps are append-only in [gates.jsonl](gates.jsonl); raw logs are local synthetic validation evidence.

| Gate | Actual result |
|---|---|
| Targeted model unit + PostgreSQL model/events | 69/69, three files, exit0,74.88s; preceding final helper hardening/post-delivery test extension |
| Full PostgreSQL integration, sequential files | 123/123, nine files, exit0,266.04s; final source |
| Unit | 107/107, five files, exit0,8.24s |
| Offline spike | 50/50, zero failed/skipped, exit0 |
| Root/web TypeScript | exit0 |
| Lint | exit0 |
| Next16.4.5 production build | exit0; `/`, `/app`, `/login`, API and health routes |
| Production browser, cached Chromium1248 | 19/19, exit0,1.2m, matching built source at loopback3033 |
| Documentation structure/task DAG | both exit0; 21 canonical Markdown files and strict task DAG |

Initial lint failed on two unnecessary regex escapes; repaired before final lint/build. Initial typecheck reached a nested `pnpm` invocation absent from the scrubbed PATH; the existing pinned Corepack shim directory was added to the validation harness, then root/web passed. No package, dependency, installation or tool version changed; initial failed exits are retained. All gates use Corepack network installation disabled. PostgreSQL uses only the existing guarded local integration database and per-invocation unique schemas, with synthetic provider/chain transport. Docker was already running; no reset, provisioning or retained container mutation was needed.

Coordinator explicitly transferred exclusive .next/build ownership in `msg_dd8a59d8b567` and reported no3029 listener. A fresh3033 bind probe passed before the owned production child started; no other preview/process was stopped. After browser acceptance, exact owned Next PID25296 was verified by executable/command line and stopped; final listener check found neither3029 nor3033. Preview stdin was closed by the execution harness, so exact-PID shutdown replaced its stdin stop command. Web build/preview/browser processes inherit only allowlisted OS environment, never worker/app configuration or private env files. Browser API fixtures intercept every protected request; no real authentication, wallet, model, queue, provider or financial execution is claimed. The protected HTML/RSC/static release sentinel gate and actual browser/backend/wallet rehearsal remain required elsewhere.

[Source receipt](source-receipt.json) fingerprints all ten repaired application/test files and the preserved original review. Desktop [1280px](synthetic-choice-1280.png) and mobile [390px](synthetic-choice-390.png) captures were visually inspected: public/missing/withheld text wraps within the console, with synthetic transport labeling and separate immutable quote panel. These captures deliberately exercise display states using controlled browser fixtures, not a real provider history.

No canonical documents, schema, payment domain/executor, public proof source, private environment, package/lockfile or historical financial state was changed by this worker. No staging, commit, push, deployment, actual Gemini generation, live appDB/journal/key access or financial call occurred. Original incident remains unresolved/held/unentitled; scope success must not be promoted to full MVP or release acceptance.
