# TASK-020 F1/F2/F3 repair

The three reviewer findings are repaired in the prepared qualifier. The final source-bound synthetic regression passes16cases, all18 targeted syntax/type commands exit0, and resealing succeeds from the authorized descendant commit. **The hosted HTTPS gate and deployment remain unrun.** Coordinator independent recheck and commit/publication/application remain required; no TASK020/full-MVP acceptance is claimed.

Work ref: Orca task `task_8ef7369b23fc`, dispatch `ctx_a1af7d86b86f`, prepared checkpoint `9710aefde3d74ef2c1189cd7599e501481c34824`; accepted application remains `edbd15f955190e1b12f93a3990a24248c8ee6318`. Changes are limited to preview tooling and this new repair evidence. Preparation reports/receipts/final packet and reviewer evidence remain byte-identical; their earlier helper fingerprints are historical and are not rewritten. [Reviewer findings](../../finals-review/preview-preapply-2026-11-11/report.md)

## F1 — original response ownership

`OriginalResponses` uses the installed Chromium CDP Fetch request and response stages. Request-stage inspection preserves the original origin/method/financial-route guard and forwards allowed requests with only their existing request ID. The response-stage handler retains that Fetch ID, matching network ID, original method/URL key and numeric status. It reads `Fetch.getResponseBody` while the actual response is paused, scans its bytes in memory, then calls `Fetch.continueResponse` with only the request ID. No status/header/body override, fulfillment, stream replacement, retry, cookie jar, TLS bypass, alternate authority or new network load is used.

There is no high-level Playwright response-body reader in the repaired browser path. No `Network.loadNetworkResource` or `Network.getResponseBody` fallback participates in coverage. Per-context request-count maps must match actual browser request events. Safe response evidence separately records identity hashes, status, entity kind, body length/hash, cancellation and continuation; raw IDs/URLs/headers/bodies remain in memory. End-of-context cleanup rechecks capture state after disposal so a late missing response cannot preserve a green case.

HEAD and status204/205/304 are explicitly HTTP non-entity responses, not fabricated empty captures. Recognized followed redirects with Location account for headers only; their unavailable intermediary body is not called a captured entity. A missing redirect successor fails. Entity responses require the original body operation; empty entity bytes require an explicit zero Content-Length, and nonzero/zero mismatches fail. Undeclared empty or compressed-empty responses without that proof may conservatively fail. An unavailable or canceled unscanned body fails closed. Captured bodies are never recovered through a later GET. Context closure settles pending protocol reads before cleanup. [Installed/official API provenance](protocol-browser.json)

Interception and paused full-body reads affect delivery timing/streaming. Browser cache is disabled and service workers blocked. This does not qualify native-cache behavior. These limitations remain explicit; no missing-body waiver or fabricated native CDP completion event was added.

## F2 — real installed browser prerequisite

Before provider, DB or login work, the qualifier validates the reviewed executable file, hashes it and actually launches it. It explicitly uses `C:/Users/Vincent/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe` rather than the absent default headless shell. The future permit must bind `browser_sha256`; mismatch fails before integration/authentication. The same path/function was used by the synthetic regression.

Observed full Chromium version: **156.0.8078.4**, binary SHA256 `7f08161bbeb2853ffe1780a9ded4985087f52efb9725d7d8207aabdd42f7cfb9`. This is the installed revision1248 browser, independently launched against pinned Playwright1.65.0; no assertion that the package's default revision1254 is installed is made. No browser was downloaded or installed. Real future HTTPS/UI compatibility still needs its actual gate.

## F3 — header-first session cleanup identity

Direct HTTP login fetches register any valid session cookie synchronously as soon as response headers arrive, before body retrieval/scanning, expected status, no-store or cookie-flag assertions. Browser login Fetch response headers do the same before response identity/status/body checks, including a cookie on an unexpected status. The token hash goes to the invocation cleanup set and plaintext only to the memory-only secret checker. Browser cookie inspection also records a valid identity before its attribute checks.

Login attempts lacking a known cookie or an exact pre-creation application rejection remain uncertain. A lost/unidentified possible commit marks cleanup failed; there is no blanket revocation, state reset or invented clean outcome. Browser contexts close and all pending capture/header work settle before invocation-only token-hash revocation. The synthetic regression confirms direct tracked identities survive malformed cache/flags/body assertions and separately confirms browser header identity registration before a deliberately failed response-identity assertion. Its synthetic cleanup revokes three known fixture sessions while preserving16prior synthetic revoked entries; no real session/DB action occurred.

A future qualification permit must explicitly name the reviewed `prior_revoked_sessions` checkpoint. The observed starting count must match it, with all revoked; final success requires that baseline plus the six newly identified/revoked sessions. The historical real baseline remains16revoked, untouched here. A partial future attempt needs a fresh reviewed checkpoint, never an assumed22or a reset. Helper permit hashes now include `browser.mjs`, `original-responses.mjs` and `session-tracking.mjs` along with the original entry/qualifier/common modules.

## Focused observed verification

The regression uses an invocation-owned loopback HTTP fixture and the explicit installed Chromium. Its successful original-response context has8browser requests,8fixture requests and8covered request records:4original entities,1declared-empty entity,2non-entity responses and1followed redirect with headers-only accounting. Exact maps match; original entity scan hash matches and no extra fixture GET/refetch occurs. It exercises fast navigation, real204, HEAD, declared-empty200, foreign response identity, unjustified empties/length mismatches, cancellation and context disposal. Cancellation/disposal intentionally produce unavailable-entity failures and settle pending work. Cookie assertion failures intentionally retain known cleanup identities. All these results are synthetic, not remote login or TLS evidence. [Final source-bound regression](regression-4.json)

| Command/check | Exit |
| --- | --- |
| `node deployment/finals/preview/repair-check.mjs`, final source-bound execution | 0;16cases |
| Same focused entry, earlier executions1–3 | 0 each; preserved receipts |
| Targeted qualifier TypeScript check, full arguments in receipt | 0 |
| `node --check` on17preview executable sources | 0 each |
| `node deployment/finals/preview/seal.mjs` | 0 |
| Hosted HTTPS qualifier, provider inspector, apply, DB/SQL/login | not run |

The later focused executions added separate completion evidence, an actual pending-disposal scenario and final source binding; they did not replace failed receipts or rerun unrelated application suites. [Exact type/syntax commands](checks-before-seal.json)

## Descendant reseal and preservation

`seal.mjs` and the preparation inspector now require accepted-commit ancestry and the exact72accepted application blobs plus two runtime blobs. Resealing verifies committed HEAD blobs match accepted content and the canonical application closure remains `724b45046b27aed73a4d671b9cfe6fa30ede9d75a7b1411c65e3353e6b5e1a55`. It no longer rejects the authorized9710aefdescendant merely because HEAD differs from the accepted application checkpoint. The inspector was edited but **not rerun**: consumed provider reads/custody remain intact.

Helper LF normalization applies only to known text extensions; binary bytes are hashed unchanged. Accepted application/runtime Git blobs, including the binary font, are read and compared as raw Git blob bytes. Twenty helper/manifest/document/test files are now sealed. No new deployment permit, private configuration or credential was created, and no source stage/commit/push occurred. Exact delivery SHA remains the coordinator's responsibility.

| Closure | SHA-256 |
| --- | --- |
| Preserved old closure | `0aa0f3c92a606a1f613791222e787f8716e7cf15328b54337988b3b2ebecbf7a` |
| New closure | `29c2bb753fbf73b9fde3eb8a78ce8495d8fd2899c72ef53ea42ba52b4ece201f` |
| Accepted application Git-LF closure | `724b45046b27aed73a4d671b9cfe6fa30ede9d75a7b1411c65e3353e6b5e1a55` |

| Final helper | Canonical Git-LF SHA-256 |
| --- | --- |
| `README.md` | `a841b73c861e3da5ef3d4cd664fd9f4a9dba4c93175856f43928725a5c3d5408` |
| `apply.mjs` | `b4f00689cd2e4bc5c0af4e5b5eb792bfb5c79988b01405914f1141cba929172a` |
| `browser.mjs` | `89f87d248235ef105aca9f5e745e9be303276e76d9acfc8781a032ea18e05b8c` |
| `build.mjs` | `b42ca55feec1d5b73e173955d3583778a7a42f9bbaf83150260c7344114bf00a` |
| `common.mjs` | `31ed631a03682f0fb117108c7fc953845ce5483d798dd9797a4cc32bef71b97b` |
| `environment.json` | `984bafe89e845e6d5fb2fd53cd02645172a583f6eaae1102dd1447647a86985b` |
| `guards.mjs` | `9f8feeb6d9dffcddddb20bf18ba2a7e3ff9e575c07d11b57fbf773458725a1b8` |
| `inspect.mjs` | `ae40bea50341f4b711d9323e7382400c9c06aa24b538929860aae777d07a99b1` |
| `network-plan.mjs` | `22558043cab6f7b877ff2d1fdf2b9c520127a8c4ec1e057285b212fb6ea0f344` |
| `offline-check.mjs` | `7d58c437e3e7ffb6ec5a2ff90b9a54ea5c85c08615630647ee8aa39921ff2ff4` |
| `original-responses.mjs` | `145d42d7a7c7945f5b2206d1a5803250ce01dc9f94fe7e556e3b2dd3013a3943` |
| `qualify.mjs` | `70ba6910869cdca86aa8f0b297c151a6f0532eac7477592a17e04c4ee8a048e4` |
| `qualify.ts` | `7b1752ad05f2214bcbc9a1c381016edb3c4f0f3af6e0a1f7f428fdac74e1eb12` |
| `repair-check.mjs` | `c11367c7127e8dc2c21f26b87497df7b27d268904069b11800092357aad84382` |
| `request-template.json` | `27ebe895597986f2872043dff65bd77bb152447fe96a652108d374ee70105a46` |
| `schema.mjs` | `36c90502ecedd698dbf666f2d744fa2eef22ec6857c19d21cb74b729425cbdd0` |
| `seal.mjs` | `579c7789d0f6f50d5d13aad31ce502e7d038e088d11d173d868cce6d349cfb9c` |
| `session-tracking.mjs` | `d92a4f946e7e1d14cc34444a0c1559e149bee955b3238be6867f780025dd81fa` |
| `start.mjs` | `3a337eac923e527032ff47742b510527ef08c74fbb046c69e401ffd86a51142d` |
| `tls-observer.cjs` | `cb2879ea959de75df21f5dfe156fb229147471f89669087f19d4a34269232825` |

[Seal receipt](seal.json) records the old/new join and preserved-artifact count. The final packet supplies all new artifact hashes, exact private-value hygiene and preservation checks. Browser version/binary identity and all final regression source hashes are explicit in the linked receipts.

No actual provider/DB/login/model/worker/financial/wallet/chain call, migration/seed, application/package/lockfile/canonical edit, deployment, source publication or submitted-alias change occurred. Original held payment state remains untouched. The next step is coordinator independent recheck and a deliberate reviewed commit; provider capacity, source publication, exact egress/network/env readback, host build/deploy, actual HTTPS browser security and strict actual app-pool TLS remain future obligations. Original Free limits and the exact DB December10expiry remain unchanged.
