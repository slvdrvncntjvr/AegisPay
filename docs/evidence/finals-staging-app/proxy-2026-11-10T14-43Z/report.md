# TASK-019 bounded proxy capture follow-up — 2026-11-10

**Tool preflight: PASSED. Actual full application gate: FAILED, exit 1 during database verification. TASK-019 remains unfinished.** The single authorized staging invocation was attempted; it reached no HTTP checks, browser cases or logins. No hosted app, deployment, TASK-012 or complete MVP is established.

Work ref: Orca task `task_ecd4a8e7358b`, dispatch `ctx_736b10348d14`. This is a distinct bounded coordinator-directed tooling scope. All earlier failures and their original reports, receipts, README and audits are preserved byte-identically. There was no Git operation, canonical document edit, provider mutation, new identity/configuration, app source/build change, source push or alias change.

## Exact executions and observed outcomes

All commands ran from the repository root, with the already installed pinned Node/Playwright and real installed Chromium 156.0.8078.4. No dependency install or browser download ran.

| Execution | Exit | Observed result |
| --- | --- | --- |
| `node --import tsx deployment/finals/staging-app/capture-preflight.ts`, synthetic execution 1 | 1 | [Immutable receipt](preflight-1.json): `BROWSER_CAPTURE_DRAIN_TIMEOUT`; one incomplete context, 11 browser requests matching 11 upstream requests, all 11 upstream bodies captured, zero missing delivered bodies; one abandoned request lacked a CDP completion event |
| Same synthetic command, execution 2 | 0 | [Immutable passing receipt](preflight-2.json): two complete independent contexts, 21 browser requests = 21 proxy requests = 21 fixture upstream requests, exact per-context count maps, zero proxy/capture failures and zero missing delivered bodies |
| Synthetic execution 3 | Not run | Unused; there was no additional synthetic execution after the complete pass |
| `node --import tsx deployment/finals/staging-app/qualify.ts --resume` | 1 | [Actual receipt](actual/result.json): `QUALIFICATION_ASSERTION_OR_DEPENDENCY_FAILED` at stage `database`, before TLS verification completed and before the database-time/login-budget check; zero HTTP checks, browser cases, app TLS observations or response bodies |
| `node --check` for proxy-capture, capture-preflight and qualify helpers | 0 | Syntax checks before synthetic execution 2 |

The prior distinct CDP-fulfillment preflight failure remains at its original `capture-2026-11-10T14-33Z` path and was neither overwritten nor relabeled. The new scope has two exclusive synthetic execution markers and exactly one exclusive actual execution marker. A failed actual attempt ends this scope: there was no second actual invocation, database diagnostic reconnect, additional synthetic rerun or automatic repair after it.

## Selected capture method and synthetic evidence

The qualification-only normal Node HTTP reverse observation proxy has a fixed constructor-owned loopback target. In the integrated actual gate, the existing protected `APP_ORIGIN` remains `http://127.0.0.1:3037`, the browser-facing proxy binds only that address, and production Next would bind only `127.0.0.1:3038`. Both ports are verified unused before startup. Neither process was started by the failed actual attempt.

Each received HTTP request is buffered with a 64 KiB cap and forwarded once with its original method, path/query, Host, Origin, raw headers and body. The target never comes from request input. There is no redirect-following loop, retry loop or cookie jar. CONNECT, upgrades and invalid target/Host requests are rejected. The upstream response entity is buffered with a 16 MiB cap, scanned in memory, and, for gzip/br/deflate, decoded under the same output cap and scanned again. Only after scanning does normal HTTP deliver the original status, status message, duplicate raw headers and original raw entity. It does not replace app responses or insert fixtures. Upstream requests have a 20-second total bound and a 25-second front-request bound. No raw header, cookie, payload, URL/query or error is exported.

CDP is used only for browser lifecycle observation and disabling browser cache, not request fulfillment. A per-context record correlates every delivered response, including redirect hops, with its already captured upstream body. Pending captures and browser requests must drain before navigation, logout and disposal. Diagnostics always survive context failure in `finally`; they contain fixed categories, safe method, numeric status and path category. No later GET is used as body evidence. Independent previous-cookie security GETs remain separate checks.

The first synthetic execution preserved compressed/binary entities, status messages, headers, POST body/Host/Origin/header fidelity, duplicate cookies, 204 semantics and redirect bytes. It then exposed a real lifecycle observation gap: Chromium omitted `loadingFailed` for the held fetch abandoned by navigation. Its failed receipt retains the safe diagnostics and the exact pending counts.

The one narrow repair accepts a missing lifecycle completion only when the proxy independently observed the browser client socket close before response completion **and** retained/scanned the full upstream response. Production additionally requires a prefetch marker for an undelivered canceled request; synthetic stress cases are explicitly labeled. Missing delivered bodies still fail. An absent event, thrown error or disposed context alone never establishes cancellation or coverage.

The second execution deterministically verified, with separate gzip/binary booleans and synthetic-only hashes:

- Browser-decoded gzip text matched; original content-encoding, compressed content-length and status message matched; both raw compressed and decoded forms were scanned.
- Binary bytes, content-length and status message matched exactly and the upstream bytes were scanned.
- Original request method/body/Host/Origin/custom-header fidelity had zero fixture failures; duplicate HttpOnly/SameSite cookies, redirect cookies, redirect bodies, 204 and logout clearing passed.
- Fast navigation canceled a deliberately held prefetch while the proxy retained its eventual body; per-context drains ended with zero pending requests/captures and zero missing delivered bodies.
- Both independent browser contexts completed with exact browser/proxy/upstream request maps, including canceled and automatic favicon requests. Context counts were 12/12 and 9/9; no replay, amplification or omitted upstream response was observed.
- Upstream ownership was verified before disposal; later `Response.body()` retrieval after disposal failed in both contexts while upstream capture had already completed. This demonstrates capture ownership across the lifecycle condition rather than substituting another GET.

The immutable passing receipt SHA-256 is `0f76d9995132b83f3e3bdfee92881aedfa33adcb05b3408d19bf42539fb3d198`. It binds the exact proxy, preflight and integrated qualifier source hashes. The qualifier requires a matching passing receipt with both complete contexts and creates an exclusive one-invocation marker; it cannot bypass this requirement unconditionally. The helpers were not edited after that passing receipt.

This is a fully buffered reverse-proxied HTTP flow. It changes timing, streaming and HTTP hop framing, and disables browser cache in capture contexts. It does not qualify native-browser cache, unintercepted transport, hosted app egress or live deployment. The synthetic fixture has no application, database, custody, private login, model, provider or financial imports/calls and is never app/payment evidence.

## Actual staging attempt and safe stop

The actual attempt ran from 2026-11-10T14:55:11.793Z to 14:55:15.551Z. It accepted the immutable matching preflight, the unchanged exact staging resource/configuration, protected custody and existing distinct public identity, then failed within the database verification stage. The sanitizing catch records only `QUALIFICATION_ASSERTION_OR_DEPENDENCY_FAILED`; it does not establish the underlying connection, TLS, SQL or assertion cause. No raw vendor error or credential was retained. A more specific dependency diagnosis requires a separately authorized scope, not a second gate here.

The read-only database-time/throttle-budget block was **not reached**; actual database time, natural expiry and remaining login budget were not observed. There is no evidence-backed not-before timestamp to publish. No login, throttle reset, expiry wait, session issuance/revocation, migration, seed, build, app process or proxy startup ran. The integrated gate preserves zero-state seed/source/build/identity checks, reads existing migration checksums and catalog rather than rewriting them, and refuses a rebuild or new configuration. Its security checks replace the prior absent `/runs` reads with session/catalog/receipt denials to respect this scope's no-runs restriction; none of those HTTP checks executed.

No newly created session exists in this attempt, and no code path performing a database mutation was reached. The previous final audit's eight revoked sessions and zero financial/execution rows remain **historical observations**, not freshly measured counts. Original sessions, throttle history, financial state and the unresolved old incident were not changed by this scope. No old financial database, run, quote, wallet, signing, RPC, Gemini, Velo, Noir, funding, job, wake or report-grant operation ran.

## Preservation, hygiene and remaining work

The [separate offline audit](final-offline-audit.json) opens no database or provider. It verifies all 23 preserved public historical artifacts, four protected custody/configuration files, the original 72-file application source closure, BUILD_ID and 233 original build files, then scans public helpers/evidence against known secrets, protected findings, full provider IDs, raw DSNs and the privately retained client IP. It checks that neither app/proxy port has a listener. Protected values stay in memory.

The unchanged application source SHA-256 is `1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00`; BUILD_ID SHA-256 is `8377827b6c1b2e97c1ceabca1c0a1e00b8407c51ead728dfdff07100973b9a9c`; the original 233-file build inventory SHA-256 is `3e6d864cf2f90759c110bbb283cbe53d4028a6b63c199a8a03f81662c12f07b0`. [Final checks](checks.json) record actual syntax/documentation exits and artifact hashes. Documentation and offline hygiene success do not convert the failed application gate into a pass.

Tool preflight is complete and reviewable; full staging application qualification remains unfinished. Further coordinator direction must first authorize a narrow, safe database dependency diagnosis and decide whether to authorize a new gate after that blocker is understood. The required actual app-pool TLS, HTTP/HTML/RSC/bundle/body leak checks, four owner/merchant desktop/mobile flows, fresh session revocation and zero financial-table audit remain unproved by this scope. No second real invocation is authorized here.
