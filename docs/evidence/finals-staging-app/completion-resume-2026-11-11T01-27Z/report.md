# TASK-019 same-state staging gate recovery

The actual staging qualification **passed, observed process exit 0**, from 2026-11-11T04:26:00.978Z through 2026-11-11T04:26:54.214Z. All four real owner/merchant desktop/mobile flows passed, together with 41 HTTP checks, 16 emitted client asset scans, actual application-pool TLS verification and final database/session checks. Coordinator review and task acceptance remain pending; this is a local production application connected to the isolated cloud staging database, with no hosted-release or complete-MVP claim.

Work ref: Orca task `task_35cf627dcc9a`, active dispatch `ctx_95b52e773108`, continuing committed checkpoint `4dc3889`. Coordinator recovery message `msg_c3489b89e7ae` authorized the same-state gate after the preceding quota stop. Inspection found no execution marker or actual result in this prepared recovery directory before this invocation. Original consumed markers and historical receipts were preserved.

## Current prerequisite and reused tests

One current strict exact-database `createStore` connection passed TLS1.3, authorized certificate, correct hostname and negative hostname verification. Its read-only DB clock/budget check observed naturally expired owner/merchant/global login windows with remaining budgets 5/5/50 against required 3/3/6. The qualifier repeated its own read-only budget guard before login. No access policy, throttle, credential, configuration, identity or stored metadata was reset or changed by this recovery. [Current precheck](current-precheck.json)

The existing focused regression and source-bound Chromium preflight were reused as directed, because the proxy, focused-test and preflight-test sources are byte-identical to their passing receipts. The focused regression omitted both CDP terminal events for an actual loopback proxy response and required exact captured/scanned body plus real response finish; it kept genuinely pending work unresolved and rejected mismatched status. The preflight covered gzip/binary scanning, request fidelity, cookies/204, redirects, cancellation, navigation, contexts and body ownership. [Focused regression](../completion-2026-11-11T01-15Z/completion-check-2.json), [Chromium preflight](../completion-2026-11-11T01-15Z/preflight-1.json)

| Check | Observed exit |
| --- | --- |
| Prior focused completion regression, final execution (reused) | 0 |
| Prior source-bound Chromium preflight (reused) | 0 |
| `node --import tsx deployment/finals/staging-app/current-precheck.ts` | 0 |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 0 |
| `node --import tsx deployment/finals/staging-app/final-audit.ts` | 0 |
| `python tools/check-docs.py` (actual gate) | 0 |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` (actual gate) | 0 |

The final audit's directory-local preflight list is empty because this recovery reused a receipt in the preceding directory. The actual result and source binding explicitly identify and validate that receipt; no preflight result was fabricated or overwritten.

## Separate response completion evidence

The retained repair binds each browser-delivered response to its selected upstream record. Missing terminal events settle only after the browser reports delivery, the status matches, the upstream body was fully captured and scanned, the unique retained match finished its actual `ServerResponse` send (`finish` / `writableFinished`), and neither side is canceled. Existing quiet/drain deadlines, forwarding behavior and exact per-context request-map checks remain enforced. No CDP event was invented and no later GET substitutes for a browser body.

| Viewport | Role | Browser / upstream requests | Delivered and captured | CDP finished | CDP failed | Matched proxy finish | Pending / failures |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop | owner | 62 / 62 | 62 | 59 | 2 | 1 | 0 |
| desktop | merchant | 62 / 62 | 62 | 59 | 2 | 1 | 0 |
| mobile | owner | 62 / 62 | 62 | 59 | 2 | 1 | 0 |
| mobile | merchant | 62 / 62 | 62 | 59 | 2 | 1 | 0 |

Each of the four missing terminal events was a delivered `GET`, status 401, safe path category `STATE`; each settled through separate matched-proxy-finish evidence. The eight recorded CDP failures were observed canceled requests after response delivery (two in each context), with captured bodies retained; they were not settled through the missing-event fallback. Redirect-response and socket-cancellation completion counts were zero. All 248 browser responses matched captured upstream bodies, all 248 proxy responses finished, and each context had exact request count maps, zero missing delivered captures, zero pending capture/browser/proxy work and zero failures. [Full context diagnostics](actual/result.json)

Safe unresolved categories remain `AWAITING_BROWSER_RESPONSE_OR_PROVED_CANCELLATION`, `DELIVERED_WITHOUT_CAPTURE`, `DELIVERED_STATUS_MISMATCH`, `AMBIGUOUS_UPSTREAM_MATCH`, `CANCELED_WITHOUT_TERMINAL_EVIDENCE`, `AWAITING_PROXY_RESPONSE_FINISH`, `AWAITING_BROWSER_TERMINAL_EVENT` and `PROXY_RESPONSE_NOT_FINISHED`. Missing/mismatched body and upstream capture failures still fail. Actual final pending-category lists were empty. The focused regression records genuinely pending capture/proxy categories before delivery.

## Application, hygiene and database evidence

All four flows verified real login, role-specific persisted database state, reload session continuity, logout and rejection of the previous cookie. They also passed HttpOnly/SameSite cookie, private-storage, horizontal-overflow and page-error checks, with no external or forbidden financial browser requests. The HTTP matrix covers actual HTML/RSC, anonymous/invalid sessions, role/ownership/origin boundaries, denied protected report objects, logout and previous-cookie rejection.

The actual Next pool observed one strict TLS1.3 connection with encryption, authorized certificate, correct-hostname verification, wrong-hostname rejection, exact resource match and pool maximum 10. The independent read-only audit separately passed TLS1.3 after the actual gate. These are direct observations, not inferred from the preliminary helper connection.

The proxy captured/scanned/finished all 306 upstream responses across HTTP, assets and browser checks, with zero proxy failures or pending requests. Hygiene recorded 576 in-memory scan calls totaling 19,612,716 bytes, including compressed/raw entities and browser state/storage/HTML checks; this is not a count of distinct responses. Protected-finding, known-secret, full-provider-ID, raw-DSN and client-IP matches were all zero. No raw bodies, signed data, credentials, cookie values, logs, screenshots, video, traces or storage state were exported. The 233-file build check found zero client fixture matches and the expected ten server fixture matches.

Six test sessions were created and revoked; all ten earlier revoked sessions were preserved, giving **16 total / 16 revoked / 0 unrevoked**. Both role throttle counters finished at three, within the unchanged limit of five; history remains intact. Both actual cleanup and independent read-only final audit observed zero rows in `agent_run`, `quote`, `payment_attempt`, `payment_evidence`, `entitlement`, `job`, `wallet_operation`, `merchant_claim`, `run_event`, `audit_event` and `payment_accept_key`. Metadata remains one owner, one merchant, one agent, two resources and four unchanged checksum migrations. The independent agent remains unprovisioned, nonce zero, policy zero, epoch expiry and no observed policy ledger. [Independent audit](final-terminal-audit.json)

Only the owned Next process and proxy were stopped; Next exit was observed after SIGTERM and both loopback ports were free. F1 evidence contains exclusive result/inventory/finalization with an externally recorded actual exit 0. `readTerminal` accepted their hash and exit bindings. F2 startup diagnostics retain the READY classification, successful TCP probe and pre-cleanup status separately from process termination.

## Preserved source and receipts

The audit verified 135 historical public files and seven protected custody/configuration/permit files unchanged. The original 72-file application source closure, BUILD_ID and all 233 build-file hashes remained unchanged. No rebuild occurred; the reused build object's historical reason string describes the old build receipt, while `fresh_build: false` and `source_and_build_receipt_match: true` describe this run. The previous actual failure and the preceding quota-stop bookkeeping remain historical and unmodified.

| Fingerprint | SHA-256 |
| --- | --- |
| Application source closure | `1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00` |
| Existing BUILD_ID | `8377827b6c1b2e97c1ceabca1c0a1e00b8407c51ead728dfdff07100973b9a9c` |
| Full build inventory | `3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0` |
| Reused passing preflight | `d16653a4e6bc1d02aec46ea9f1ba0488a3b3f908837709c4d158dffeeed8148e` |

| New artifact | SHA-256 |
| --- | --- |
| `actual/result.json` | `02205d2c1bce707fb21db584a48dcd7d0485f62cf5b256d7642a30fa1071fec4` |
| `actual/inventory.json` | `d0f4240becc23fa285eb7a14d80c2fe118874f4f268a14cca6d82d43a9717e6d` |
| `actual/finalization.json` | `f320e1807480505142764f6b43b909b81a2b534718ea15b0e81d4d2bc63d9e6f` |
| `actual/observed-exit.json` | `ddae64e2a6d94000acf1f2560b0575f117fc58526d8d568f3dc9110d9afaa176` |
| `final-terminal-audit.json` | `c0a757c86899c5f758b243331e8bd2257dc22a2f0e2bc63f50be6344a629e72d` |
| `current-precheck.json` | `d6d8718c4d2af53eb97be2d97f821bfdaca49412e6f8e4659b6cb057b34b08d9` |
| `continuation-authorization.json` | `008875201e6e01792a28132e93cf87ec21b62cca41e2a13c09df3efcf0dd73f1` |
| `continuation-source-binding.json` | `6f07e42c2ec9565c8ec8130a1d0caf4fb62d86f234f2c183853fb9fb05b266b1` |

| Bound staging helper | SHA-256 |
| --- | --- |
| `proxy-capture.ts` | `d1fbf66b6b8bdb0c56a0e5d16e606f1adbcc334a8efc3b7e978132658bdddfa9` |
| `capture-preflight.ts` | `80932c305f4b374135d0a001a1924934f13778f72f151adf4089d902726f1b8a` |
| `qualify.ts` | `32455a87b9aa7c121b3594f946e0a94928ba083456efcd87ff9a32e5ef74d686` |
| `continuation.ts` | `28d2be66074df2a27824935220398e0e867de9c449fc1e4456b3609f18a0a356` |
| `evidence-terminal.ts` | `7fad6673fdcabd4455d9758460ae532314ad12f40985062d1d23939db3596dc3` |
| `startup.ts` | `32f6bfd7cd150000b54cfbed9fbd39b902bbe74c08da26df74a354f897534c54` |
| `startup-only.ts` | `75b32720af0f259d6f4401d5d10ea70f17e42e6c94cfeaa2aedeb6dcf46f0d9b` |
| `tooling-checks.ts` | `ad7e74f749acf5d7e0f0b81f3df9aa0dbb194d08c3cd544167ab160d33d8b9b7` |
| `final-audit.ts` | `a11692c5c825aae4c856b52980d4ac145a94a75a770304e26a3fc628893285ae` |
| `capture-completion-check.ts` | `a31f8d9c0d033f7b2ac13ad94bbbbe76ab76099f30a12a7f7a78a6f0cb10ee25` |
| `current-precheck.ts` (linked by authorization) | `e2bd250dffebcdb1fd931e201637272005169cb1304c0da384ab75a3be339cc8` |

This recovery changed only the active dispatch check in the prepared qualifier and added the standalone bounded read-only prerequisite probe; earlier preserved changes supply the completion repair, namespace, preflight receipt reuse and current-IP hygiene. No dependency, application source, build, migration, seed, new configuration, provider policy, financial/wallet/chain/model/worker/job action, deployment, push or alias update occurred. Canonical task status belongs to the coordinator.

The capture method remains a fully buffered loopback reverse observation proxy, which affects timing, streaming and hop framing; browser cache was disabled and service workers blocked. Hosted egress, native-cache behavior, live financial/model flows and the original held/unentitled incident are outside this result. No task acceptance or full release is inferred from this gate.
