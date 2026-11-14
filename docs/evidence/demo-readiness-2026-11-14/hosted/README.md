# Free hosted release preparation — review only

No hosted service, hosted database, hosted environment or submitted alias was created or changed. This packet prepares TASK-012; it does not complete that task. [Service plan](service-plan.json) specifies two separate new Free Node web services in Singapore, one running the web app and one the authenticated queue worker. Existing preview service/configuration remains isolated. No Free background/private worker, paid capacity, second Free database, automatic deploy or disk is requested.

## Concrete source and build configuration

Select the final independently reviewed commit from `task/TASK-009-demo-readiness`, publish only through the coordinator, then set the exact same 40-character commit in each service's `AEGIS_RELEASE_COMMIT`. Set `AEGIS_RELEASE_ENABLED=1` only after provider readback confirms the exact source, Free plan and owned service. Set `NODE_VERSION=24.22.1`, `NODE_ENV=production` and disable automatic deploys. Render service names in the plan are proposals, not allocated names/URLs.

Build command for web:

```text
node docs/evidence/demo-readiness-2026-11-14/hosted/build.mjs web
```

Build command for worker:

```text
node docs/evidence/demo-readiness-2026-11-14/hosted/build.mjs worker
```

The launcher validates runtime/accepted source before installation, then forwards only OS path/temp/home variables and fixed production/telemetry settings. It does not forward DB, signing, model, login, receipt, wake or provider credentials. It installs the locked workspace including required runtime tsx, builds web or performs the worker's import-only check. Actual host build/install remains unrun. Source/asset attestations and leak checks must still be collected from the deployed build; a successful import check is not worker readiness.

Use the exact start argv in service-plan.json after environment review. Web Next binds `0.0.0.0` and reads Render's injected PORT; worker sets `WORKER_HOST=0.0.0.0` and reads PORT. The existing sealed preview build/start helpers reject worker/model credentials and current-source changes; **do not reuse, edit or relax them**. The release start commands currently rely on coordinator review/readback rather than those preview custody fences; exact-service startup/asset/TLS attestation still requires qualification.

## Exact unresolved database and private-input selection

**An independent hosted database has not been selected or provisioned.** The existing workspace's Free database is the isolated preview database, expires 2026-12-10T11:55:40.452333Z, and cannot be copied or repurposed under this task. Render permits one Free database per workspace. Before host activation, the coordinator/user must identify an already-authorized independent compatible PostgreSQL target with adequate lifetime and verified access, or explicitly choose a separate eligible Free workspace/target. Billing, paid capacity, a replacement/deletion of preview state, or broad access rules require stopping the dependent step; none is authorized here.

The new owned loopback database `aegispay_release_20261114` is now created with checksum migrations0000–0004 and private config skeletons. Exact Docker5432-to-configured-loopback binding and database ownership comment are corroborated. [Preparation](local-preparation.json) and [real startup/ingress qualification](local-qualification.json) record five migration hashes,17HTTP passes,16emptytables, and separate user-only ACL custody. No owner/merchant/agent/catalog was seeded while public-address confirmation remains pending; agentId is null. Temporary web3019/worker3020 processes were stopped after qualification, corroborated independently. No original or preview DB was changed.

The public generators are inert by default. `node --import tsx docs/evidence/demo-readiness-2026-11-14/hosted/prepare-local.mjs --prepare` was run once. An initial Windows PowerShell module-path/ACL failure occurred after creation; it is preserved in the [preparation incident receipt](local-preparation-recovery.json). The repaired `--resume` path verifies exact private custody/ownership and preserves existing secrets; it recovered that interrupted preparation without recreating/adopting/resetting a DB. `--resume` is **only** for an interrupted not-yet-finalized preparation: successful proposal.databaseCreated blocks later reruns. It is not a reset or general startup command. `node docs/evidence/demo-readiness-2026-11-14/hosted/qualify-local.mjs --qualify` starts only the exact owned empty target, validates private config separation and checksums, tests actual nonfinancial ingress, then stops its own child processes. It refuses actor/provider/signer credentials and nonempty tables; it cannot qualify a funded context.

After actual owner/merchant public-address selection, seed metadata only into this exact local target and record its actual DB agent UUID. Policy stays zero/epoch/unprovisioned until genuine wallet observations; never seed registration, balance, payment, event or entitlement. Local preparation needs no further generic approval. Human wallet consent/spending and independent **remote** database selection are the actual dependent external steps.

Private input names are DATABASE_URL, RECEIPT_SIGNING_KEY and WORKER_WAKE_TOKEN shared as needed; web-only DEMO_OWNER_LOGIN_TOKEN and DEMO_MERCHANT_LOGIN_TOKEN; worker-only AGENT_SECRET, ENVELOPE_ENCRYPTION_KEY, VELO_GAS_API_KEY and GEMINI_API_KEY. Use independent login/receipt/wake/encryption secrets and the newly prepared agent identity in ignored `.env.release.identity.local`; its Windows ACL is restricted to the current user. Do not copy original/preview worker config. Existing Gemini connectivity passed unchanged; no replacement credential/account repair is currently required. Model ID `models/gemini-3.5-flash` is public and required in both web and worker; the web needs the identifier to create a run, never the model key.

Use strict certificate/hostname validation for actual application-pool DB connections, with external DATABASE_URL `sslmode=verify-full`. Inspect exact Render egress rules before any proposed narrow access change; no broad allowlist or TLS override. Web wake destination must be the returned worker **HTTPS /wake** URL, token shared only server-to-server. Initial RUN_TESTNET=0 and empty execution tables are required before first worker startup; this flag alone does not disable model jobs or manually signed wallet submissions. Review queued rows before every funded activation.

## Bounded anonymous HTTPS qualifier

The helper is inert without explicit origins (exit2), reads no env/config/credentials, performs no login/task/quote/wallet/payment call and sends no valid wake token. Each request has a60-second deadline and a1MiB body limit, no redirect and no retry. At most12 requests run sequentially, so the worst-case whole command can approach12minutes; its Node network calls remain interruptible. Health equality, anonymous401, invalid-wake401 and unknown404 are the only assertions. It does not export response bodies or native exceptions.

```text
node docs/evidence/demo-readiness-2026-11-14/hosted/qualify-ingress.mjs
node docs/evidence/demo-readiness-2026-11-14/hosted/qualify-ingress.mjs --app-url https://aegispay-auth-preview.onrender.com
```

For a new worker use `--worker-url` with its provider-returned origin, optionally alongside `--app-url`. No worker URL currently exists in this packet. A passed anonymous qualifier establishes neither current authenticated role access nor hosted-worker/payment release.

## Remaining exact HTTPS qualification matrix

| Gate | Required procedure / evidence | Current status |
|---|---|---|
| Source/custody | Provider service/deploy/environment name-only readback joins accepted commit, root lockfile and service identity; independently fingerprint actual public client assets | Not run for release services |
| Strict DB TLS | Capture safe actual application-pool protocol/certificate authorization, never DSN/password/host secrets; verify migrations and zero execution rows before first start | Not run |
| Web roles/session | Existing preview qualifier is reference only: private owner/merchant login, Secure/HttpOnly/Strict cookie, exact Origin, logout/revoked-cookie denial, foreign-owner denial, no-store; no session/token capture | Nov11 preview only; new source unrun |
| Worker ingress | Anonymous helper plus authenticated malformed/extra-field/oversize1KiB/Origin requests, wrong methods/routes; valid empty wake only after exact independent empty DB is confirmed | Local existing ingress tests pass; hosted unrun |
| Cold start/restart | Observe natural Free idle/cold wake, exact accepted wake202, SQL job lease and actual process termination/restart; saved identities observed without signing/submission | Hosted unrun; synthetic local OS-death tests retained |
| Content/secret hygiene | Capture every actual HTML/RSC/JS/API response, scan real private sentinel values in memory, prove no protected fixture outside entitlement; redact all auth/body/config custody | Current local browser checks retained; hosted release unrun |
| Full live join | Two distinct genuine app purchases, independent Velo/Noir verification, delivered receipt, over-cap/expired-policy refusal, separate claim, wallet lifecycle, model price/no-purchase and real recovery | Blocked on independent setup and human consent |

For failed/unknown create/deploy/start or wallet/payment outcomes, reconcile the exact saved identity. Rollback is coordinator-controlled suspension of only a new owned service, preserving DB, all reservations, historical preview/public aliases and incident state; no deletion/reset/resubmission is prepared.

## Application acceptance collector assessment

The existing release runner's `observe` phase already independently verifies two exact saved app attempts with distinct operation/nonce/inner hashes and zero signing/submission. Keep that verifier rather than introduce a second chain interpretation. The adjacent [metadata collector SQL](collect-saved-acceptance.sql) supplies a narrow read-only join of those attempts, receipts/delivery timestamps, exact claim and wallet IDs. It emits no task text, token, signed XDR, ciphertext, operation payload or report. Supply exact independent IDs as five bound parameters through an approved PostgreSQL client, inside `BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY`, with a5-second statement timeout, then ROLLBACK. This is a prepared query, **not an executed live acceptance collector**.

Database metadata alone cannot independently prove claim/refusal/lifecycle chain behavior, useful report delivery, or real model-price/no-purchase semantics. Resource GET itself updates firstDeliveredAt, so a collector promising strictly read-only behavior must not invoke it. Use actual authenticated delivery during the consented rehearsal, and observe the saved timestamp afterward. Refusal evidence lacks a canonical persisted independent chain-proof entity; require separately inspected genuine refusal artifacts. Adding generic assertions over arbitrary uploaded JSON would create misleading acceptance, so no broad proof importer was added. Manual QA remains valid and mandatory.

The optional inert `inspect-targets.mjs --inspect` was run once using only the existing protected Render key. Three GETs completed successfully with JSON; its helper verifies2xx but does not retain the exact HTTP code, so no exact200 is claimed. [Inventory](provider-targets.json) shows one accessible workspace, one existing Free preview PostgreSQL (available Singapore, unchanged expiry), six services, no proposed release-name collision and no independent existing project DB/Free slot. No connection-info, DB SQL, service environment, account mutation or credential/body export occurred. The [initial receipt](provider-targets-initial.json) retains its over-specific status label as a documented evidence error; the corrected projection does not require another provider request.

Primary sources checked Nov14: [Render Free limits](https://render.com/docs/free), [web binding/startup](https://render.com/docs/web-services), [configuration fields](https://render.com/docs/blueprint-spec), [Postgres list API](https://api-docs.render.com/reference/list-postgres). These support Free public HTTPS adaptation, single-instance/idle constraints, one-Free-DB limit and disabled auto-deploy; they do not establish capacity/account eligibility or successful service creation.
