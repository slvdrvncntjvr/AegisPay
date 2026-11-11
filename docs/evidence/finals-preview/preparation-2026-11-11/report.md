# TASK-020 separate Free authenticated preview preparation

**Prepared for coordinator review; no deployment or hosted qualification performed.** The bounded authenticated provider inventory passed, the final focused offline check passed15cases, every prepared executable passed syntax checking, the targeted preview TypeScript check exited0 and both documentation checks exited0. TASK-020 remains unfinished until the coordinator reviews/applies the exact artifacts and the actual hosted gate passes.

Work ref: Orca task `task_8714968f4d18`, dispatch `ctx_6668650a627e`, accepted checkpoint `edbd15f955190e1b12f93a3990a24248c8ee6318`, tree `49a30597da11b6ecad4cc05c9b2bdde81cfeb9d8`. All writes are new files in `deployment/finals/preview`, this new evidence directory and new ignored protected preview custody. No tracked application, package, lockfile, canonical document or prior report was edited. The original held/unentitled payment database was not opened.

## Actual authenticated read-only observations

At 2026-11-11T04:41:33.138ZÃ¢â‚¬â€œ2026-11-11T04:41:40.369Z, seven Render GETs confirmed the exact staging workspace and active ADMIN membership, a complete bounded inventory of five services, and **zero services named `aegispay-auth-preview`**. Unrelated names, IDs, URLs and configuration were not exported. Exact DB readback matches resource hash `feaa345c7d4172d22feb6dd8c92794128061a2f357b2e5372c0739138b6f8f85`, expected owner, Free plan, Singapore, PostgreSQL17, available status, one existing allowlist rule and expiry **2026-12-10T11:55:40.452333Z**. Connection information was read privately; no DB connection or SQL was made. These reads do not prove free capacity, remaining shared usage, billing status or future service creation acceptance. [Safe provider receipt](provider-readonly.json)

Two authenticated Vercel GETs confirmed the existing `aegispay-live` project and submitted alias still refer to that project. The project currently has **no Git link**, root `apps/web` and outside-root sources enabled. Three authenticated GitHub reads confirmed default `main` still at `91f968011b8a8966512928579d85f745c2de38e7` and zero repository hooks. Repository hooks cannot prove the absence of app-installation hooks. No source was published or alias setting changed. Recheck deployment integrations immediately before a deliberate coordinator push.

The internal DB host is privately resolved and differs from the external host. [Render documents self-signed internal certificates without verify-full support](https://render.com/docs/postgresql-creating-connecting#ssl-modes-for-internal-connections). The installed pg8.23.1 / pg-connection-string2.14.1 parser was inspected offline: the bare internal URL requests no TLS, while external `sslmode=verify-full` retains default certificate/hostname verification. **No internal TLS success is claimed.** The internal connection is unsuitable for the task's unchanged strict verification requirement without a new trust design, which this packet does not introduce.

## Concrete proposed service and remaining network decision

The reviewable create body is [request-template.json](../../../../deployment/finals/preview/request-template.json). Only the private workspace owner is substituted. It selects `web_service`, `aegispay-auth-preview`, existing GitHub repo, branch `main`, root directory empty (repository root), runtime `node`, plan `free`, region `singapore`, one instance, service previews off, automatic deploy trigger off and `/api/health`. No disk, autoscaling, paid build tier, pre-deploy migration, background/private service or worker command is selected. The proposed new HTTPS URL will be the actual returned service URL, never the submitted Vercel alias.

The exact build/start commands are `node deployment/finals/preview/build.mjs` and `node deployment/finals/preview/start.mjs`. Node is pinned24.22.1. Build runs `npx --yes pnpm@12.18.0 install --frozen-lockfile --prod=false`, then `npx --yes pnpm@12.18.0 --filter @aegispay/web build`, with DB/auth/provider values excluded from both child environments. Installed Next16.4.5/React19.3.1/pg8.23.1 are checked. Normal Next binds `0.0.0.0` to provider `PORT`; root server/shared sources remain available. No app build was executed here and Free build memory/time feasibility remains unproved.

Creation may trigger an initial provider build even with autodeploy off. Its exact initial environment includes `AEGIS_PREVIEW_ENABLED=0` and no DB/auth values, so the prepared build exits before install or startup. The later environment enables only the reviewed exact commit. Runtime validates provider service ID/URL/commit, HTTPS origin, strict external DB mode and secret exclusions. Every create/env/deploy/suspend mutation requires a fresh private coordinator permit and exclusive durable attempt marker before dispatch. Unknown results must be reconciled by identity, never resent.

The prepared alternative networking path uses the existing external URL with `sslmode=verify-full`. After exactly one new service exists, `network-plan.mjs` reads its official `GET /services/{serviceId}/outbound-ips` and exact DB rule readback, preserving the original client /32 while preparing only returned IPv4 /24-or-narrower additions. It never applies a PATCH. [Render outbound ranges are shared regionally](https://render.com/docs/outbound-ip-addresses), so this is **not** a service-exclusive allowlist; larger/unknown ranges stop for separate review. The exact CIDRs are unavailable until service readback. A concrete network expansion requires coordinator review/application before environment activation; there is no broad rule, paid dedicated-IP fallback or TLS bypass in this preparation.

## Private auth and environment custody

[environment.json](../../../../deployment/finals/preview/environment.json) names all **21** uploaded variables. After review, the environment step generates three independent48-byte base64url secrets for owner, merchant and receipt signing, in new protected preview custody; it does not reuse staging auth or alter its credentials. Generation has not occurred. Public Testnet/owner/merchant/agent/device/contract values are copied by exact names from staging. `APP_ORIGIN` must be the exact provider-returned HTTPS origin with no path/trailing slash. Existing agent/device identity remains unprovisioned, nonce0 and policy0. Auth routes already require exact origin, HttpOnly/Secure/Strict cookies and no-store; the focused offline check verified the actual cookie function.

`AGENT_MODEL`, wake URL/token, `TRUST_VERCEL_PROXY`, signing/Velo/Gemini/encryption/spike credentials, Render API key, TLS overrides and `NEXT_PUBLIC_*` uploads are excluded. Start task is disabled by the existing unprovisioned-agent state, and missing model configuration blocks run creation. No financial, wallet or report-grant endpoint is invoked by the prepared gate. Privileged DB/provider custody remains ignored; no credential, signed data or raw body is present in public artifacts.

## Executable future qualification and rollback

The prepared entry is:

```text
node deployment/finals/preview/qualify.mjs
```

It is **unrun** and refuses to start without a fresh reviewed qualification permit. It checks owned URL/IDs, actual live source SHA, exact environment names/values, initial16revoked sessions, strict helper TLS and natural login budget. Bounded cold readiness precedes real public HTML/RSC, asset/build fingerprint comparison, anonymous/invalid-session denial, exact HTTPS origin checks and owner/merchant HTTP auth/state/logout/revoked-cookie checks.

Four real HTTPS desktop/mobile role cases cover login, database state, reload, logout, previous-cookie rejection, secure cookie attributes, storage/body/finding hygiene, layout and runtime/network errors. Browser responses are scanned from their actual response objects and every observed request requires its own captured body; missing bodies remain failures, with no later-GET or fabricated-event substitute. Interception only aborts forbidden traffic and continues allowed traffic, never fabricating responses. This may affect browser caching; native-cache behavior is not claimed. No screenshots/traces/video/input tokens/storage state/raw responses are exported.

The future gate independently reads safe provider build/TLS attestations for the exact commit: source closure, built client assets and actual application-pool strict TLS must match. Final DB checks require22total/22revoked/0unrevoked sessions from the16preserved plus six new sessions, all11financial/execution tables empty, unchanged checksum migrations and the same unprovisioned identity. Cleanup revokes only observed invocation session hashes; failures stay failed. Accepted terminal publication is reused, with the parent entry separately recording the actual child exit. Native HTTPS capture and provider log availability/format/timing remain actual-gate obligations.

Rollback initially means suspension of only the new owned service through a new exact-service permit. No delete, paid fallback, existing-DB action or submitted-alias change is prepared. Free rollback history is limited, and no qualified prior preview deployment exists yet. Full command and permit fields are in [the handoff guide](../../../../deployment/finals/preview/README.md).

## Observed checks and honest limits

| Check | Actual exit/outcome |
| --- | --- |
| `node deployment/finals/preview/inspect.mjs` | 0; authenticated read-only inventory passed |
| `node deployment/finals/preview/schema.mjs` | 0; official structural schema snapshot saved |
| `node deployment/finals/preview/seal.mjs` | 0; offline source closure sealed |
| `node deployment/finals/preview/offline-check.mjs`, final execution | 0;15cases; all prepared executables syntax passed |
| Closed build/start fence probes | each exited1 as explicitly expected before install/start |
| Targeted TypeScript check, exact arguments in validation receipt | 0 |
| `python tools/check-docs.py` | 0 |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | 0 |
| Host build, apply operations, remote gate | not run |

The first offline checker exited1 because the dependency does not export its package-metadata subpath; its failed receipt remains intact and the reader was corrected. Earlier targeted TypeScript invocation/typing failures and their concrete repairs are recorded in [validation.json](validation.json); the final targeted check is0. Initial public schema exploration also hit a missing-user-agent403 and reader-shape error before the corrected final structural snapshot succeeded. There were no blind authenticated retries or provider mutations.

The first final packet hygiene scan rejected two credential-shaped synthetic DSN literals in the offline checker; no known secret, finding, full-provider-ID or client-IP matched. The fixtures now construct credentials only in memory, and the failed safe receipt remains in `hygiene-first-failure.json`. This narrow correction changed the sealed helper/source-closure fingerprint; earlier validation receipts retain their pre-correction fingerprints as historical observations.

The official schema snapshot verifies the selected web/native request branch and exact field enums; it is not a successful provider POST. Response shapes for create/service/deploy/log/env readbacks were checked against the same official public API. [Schema](official-schema.json), [response review](api-response-review.json), [final offline receipt](offline-check-5.json)

The sealed source packet covers72accepted application Git blobs, two additional runtime files and16prepared helper/manifest/document files, plus the separately permit-bound source-closure manifest. Accepted app Git-blob closure SHA256 is `724b45046b27aed73a4d671b9cfe6fa30ede9d75a7b1411c65e3353e6b5e1a55`; historical Windows rehearsal closure remains `1eca1bfbfc838513ced491d53aedeb5e173400e935125f45f03694e4874acc00`. Both refer to explicit file inventories with distinct newline representations. The new delivery commit is necessarily pending coordinator commit/publication, and every apply/deploy requires that exact reviewed descendant SHA; no branch mutation was performed.

| Artifact | SHA-256 |
| --- | --- |
| `deployment/finals/preview/request-template.json` | `27ebe895597986f2872043dff65bd77bb152447fe96a652108d374ee70105a46` |
| `deployment/finals/preview/environment.json` | `984bafe89e845e6d5fb2fd53cd02645172a583f6eaae1102dd1447647a86985b` |
| `deployment/finals/preview/source-closure.json` | `0aa0f3c92a606a1f613791222e787f8716e7cf15328b54337988b3b2ebecbf7a` |
| `deployment/finals/preview/apply.mjs` | `b4f00689cd2e4bc5c0af4e5b5eb792bfb5c79988b01405914f1141cba929172a` |
| `deployment/finals/preview/build.mjs` | `b42ca55feec1d5b73e173955d3583778a7a42f9bbaf83150260c7344114bf00a` |
| `deployment/finals/preview/start.mjs` | `3a337eac923e527032ff47742b510527ef08c74fbb046c69e401ffd86a51142d` |
| `deployment/finals/preview/network-plan.mjs` | `22558043cab6f7b877ff2d1fdf2b9c520127a8c4ec1e057285b212fb6ea0f344` |
| `deployment/finals/preview/qualify.mjs` | `9cff96403ea4b2ad765d7eb01ce1997894e2f52eac10d17236c354a4c2800307` |
| `deployment/finals/preview/qualify.ts` | `bc243d276cf06334ad505a1b93e39d6b805ce0ea132555066ef86d62906568d8` |
| `docs/evidence/finals-preview/preparation-2026-11-11/provider-readonly.json` | `5f3a166f29ee19a042dfb7d2a5ed78a4aef46bbfce776e8ac54d47c4948c1271` |
| `docs/evidence/finals-preview/preparation-2026-11-11/official-schema.json` | `1dc3600c24a77c924c2a7f0e57f8af7a5e7ca9c4f633034f830c73a0e8f12ee1` |
| `docs/evidence/finals-preview/preparation-2026-11-11/offline-check-5.json` | `6cf630bdcf8ed272849b6562caa10f7d66edba916625b99c3fd6b293c006faab` |
| `docs/evidence/finals-preview/preparation-2026-11-11/validation.json` | `2859f529257d399c93380cae5b992e20d3890c62a729082e260403971c10c02d` |

The original TASK019 result/build/session/financial facts remain accepted historical evidence, not fresh SQL observations in this handoff. No service creation, environment upload, token generation, deployment, DB connection/SQL/login/browser action, migration/seed, worker/model/financial/wallet/chain call, source stage/commit/push or alias change occurred. Provider Free quotas/capacity, actual build resource use, exact egress readback, live HTTPS and actual app TLS remain unproved until the next reviewed phase.

[Free limits](https://render.com/docs/free) include idle spin-down after15minutes and roughly1minute cold wake, ephemeral local storage and shared monthly instance/build/bandwidth limits. No paid/billing activation or autoscaling is authorized. The exact existing DB expires December10 as recorded above. TASK020/full MVP release is not complete.
