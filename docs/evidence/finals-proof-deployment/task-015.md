# TASK-015 — accepted recorded-proof UI published at the submitted URL

**Outcome: succeeded.** At 10:37 UTC on 9 November 2026, provider readback confirms [https://aegispay-live.vercel.app/](https://aegispay-live.vercel.app/) points to the tested redesign deployment `dpl_FjfihhCpDKGCzrzxhTSvhHVb6jid`, state **READY**, in the original project. Anonymous production browser checks and exact-origin HTTP checks passed. This is the restricted **public recorded-proof viewer**, not TASK-012 completion or a full application release.

Work ref: Orca `run_3bfef6dba661`, task `task_5aa06a79ca95`, dispatch `ctx_77fd54e70892`; sole deployment executor. User-authorized publication followed coordinator acceptance of TASK-014. No helper agents, Git checkout/stage/commit/push, PDF edits, app/backend/shared-source edits, package-version changes, DB access, model calls, wallet/sign/sponsor/submit operations or paid resources occurred. The coordinator owns canonical task state and subsequent integration.

## Delivered identity and provider evidence

| Item | Observed value |
| --- | --- |
| Public alias | `aegispay-live.vercel.app` |
| Project | `aegispay-live` / `prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq` |
| Scope / team | `vincent-s-projects-57de271b` / `team_u8Iy5bGxaqRVmGiBtx6t57LN` |
| Deployment | `dpl_FjfihhCpDKGCzrzxhTSvhHVb6jid`, READY, production target |
| Immutable candidate | `https://aegispay-live-4hvi9y3h0-vincent-s-projects-57de271b.vercel.app` |
| Previous alias deployment, retained | `dpl_HrHpE7AynXusUNLs73kACPgBnqy6` |
| Project root / inclusion | `apps/web`; outside-root source inclusion enabled |
| Provider environment | **Zero configured environment variables**, no application env injection |
| Local runtime | Node **24.22.1**, pnpm **12.18.0**, Next **16.4.5** |
| Actual hosted build runtime | `node --version` printed **v24.22.2**; project Node setting **24.x** |
| CLI | Cached local **65.12.1**; provider build log reports its own **65.11.0** |
| Browser | Playwright **1.65.0**, cached Chromium **156.0.8078.4**, revision directory `chromium-1248` |

Alias UID, read back unchanged across publication: `fa6542ef9cb9290b0640f7a9d99e80ce34c514b48b4f059d024cf18aa7e2080239eee28ca69dc34d869cc047b9713aa47b95e9eaa29329156d1831201f91b5a2`.

[Before](provider-before.json), [candidate](candidate-readback.json), [production](production-readback.json) and [final provider readback](final-readback.json) record project/alias/deployment identities and uploaded source paths. The final recent-deployments list contains only this new candidate plus the two historical deployments; failed local attempts created no additional deployment. The deployment object's empty `alias` array is not treated as authority: the separate alias API explicitly maps the exact submitted alias to the new deployment.

Vercel warned that only a Node major version can be selected despite the unchanged exact package engine. Its observed hosted build patch is therefore recorded separately from the local pin; no package upgrade or engine edit was made. The function's exact runtime patch was not exposed by health and is not claimed from the build log.

## Sanitized source and reproducibility

All **15/15** files in TASK-014's accepted source manifest matched SHA256 before packaging and again at final sealing. The uploader used the unique ignored directory `.fmd-work/proof-refresh-ctx77fd54/`, with its own dependency tree and production build. The shared root `.next` and preview were never used to build this artifact.

[Initial source manifest](source-closure-manifest.json) records every explicitly copied/generated staging input and exclusions. [Final upload manifest](upload-manifest.json) records **27 uploaded files, 399,808 bytes**, every source SHA256, byte provenance, generated declaration provenance, complete local import edges, **zero unresolved imports**, accepted-file checks and the independent local build ID. [CLI dry run](deploy-dry.json) lists the same upload. Final provider source paths match all 27 entries under `src/` and contain no environment, provider config, Git, DB, journal, private fixture, signing, worker or model implementation files.

The allowlist preserves the exact root manifest/lock/workspace policy and all four real workspace manifests for frozen installation. Public page, console, CSS, layout, original SVG/font/license assets and public-proof constants are copied byte for byte. Shared schema implementation is included only because the liveness route uses `healthSchema`. Private workspace manifests do not make their absent implementation reachable.

The canonical health runtime also imports a tool-intent schema, so the package instead generates one minimal **staging-only** Node health route that imports only the shared health schema and returns the existing `{status:"ok",network:"testnet"}` shape with `no-store`. It checks public-slice liveness, not DB, worker, wallet, model or payment readiness. The unfinished API catchall, login route and wallet helper are omitted. There is no public login link. Generated `.gitignore`/`.vercelignore` and Next's `next-env.d.ts` are packaging/build scaffolds, not canonical app changes; `.gitignore` itself is ignored by the uploader.

[Reproducible helpers and instructions](../../../deployment/finals/proof-refresh/README.md) contain the explicit allowlist, sealing, secure CLI runner, browser, anonymous HTTP, public-link and memory-only scan tools. `prepare.py [unique-id]` refuses an existing target rather than overwriting it. Provider authentication stays in the existing secure CLI config or process memory; it is absent from the source package and evidence.

## Exact commands and results

Repository-root preparation: `python deployment/finals/proof-refresh/prepare.py`; `git check-ignore .fmd-work/proof-refresh-ctx77fd54` confirmed the staging directory is ignored. For local package commands, set process-only `COREPACK_ENABLE_NETWORK=0`, prepend `C:/nvm4w/nodejs/node_modules/corepack/shims` to PATH, and set `NEXT_TELEMETRY_DISABLED=1` for the build.

| Command / working directory | Actual result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile --prefer-offline` / staging root | Exit **0**, all five workspace projects; **238 packages reused, zero downloads**, strict peer policy preserved; [install output](install.txt) |
| `corepack pnpm --filter @aegispay/web build` / staging root | Exit **0**, compiled, TypeScript and static generation passed; only `/`, Next 404 and Node `/api/health`; [local build output](build-local.txt) |
| `node node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3026` / staging root | Ready; dedicated staged production preview |
| `node --import tsx deployment/finals/proof-refresh/browser.mjs` / repo root, local defaults | Exit **0**, **15 state/viewport combinations**, interaction/route checks; [local browser report](local/browser-results.json) |
| Cached CLI `deploy --dry --json --project prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq --scope vincent-s-projects-57de271b --yes` / staging root | Exit **0**; exactly 27 upload files |
| `python deployment/finals/proof-refresh/seal.py` / repo root | Exit **0**; 27 files; zero unresolved imports or accepted-source mismatches |
| `python -X utf8 deployment/finals/proof-refresh/run_cli.py deploy-diagnostic.txt deploy --prod --skip-domain --verify --project prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq --scope vincent-s-projects-57de271b --yes --debug` | Hosted frozen install and production build **passed**, candidate **READY**; CLI exit **1** only because its subsequent optional URL verifier timed out; [complete sanitized diagnostic/build output](deploy-diagnostic.txt) |
| Browser command with `PROOF_BASE_URL` set to immutable candidate, `PROOF_LABEL=candidate-verified`, `PROOF_AUTHENTICATED=1` | Exit **0**, **15 combinations**, exact asset hashes and omitted-route checks; [candidate browser report](candidate-verified/browser-results.json) |
| `python -X utf8 deployment/finals/proof-refresh/run_cli.py promote.txt promote dpl_FjfihhCpDKGCzrzxhTSvhHVb6jid --scope vincent-s-projects-57de271b --yes` | Exit **0**; promotion succeeded in 3 seconds; [promotion output](promote.txt) |
| Browser command with `PROOF_BASE_URL=https://aegispay-live.vercel.app/`, `PROOF_LABEL=production`, authentication flag unset | Exit **0**, **15 combinations**, anonymous exact submitted origin; [production browser report](production/browser-results.json) |
| `python -X utf8 deployment/finals/proof-refresh/anonymous.py` | Exit **0**; exact-path anonymous root/health/RSC and omitted-route checks; [HTTP evidence](anonymous-origin-checks.json) |
| `python -X utf8 deployment/finals/proof-refresh/links.py` | Exit **0**; all eight public destinations HTTP **200**, unchanged submitted PDF bytes; [links](external-links.json) |
| Both documentation commands after report creation | Exit **0**; canonical links/IDs and **15-task** dependency/state DAG passed; [gate output](documentation-gates.txt) |

The cached CLI path used throughout is `C:/Users/Vincent/AppData/Local/npm-cache/_npx/29d463b7a51d914c/node_modules/vercel/dist/vc.js`. Its actual `deploy`, `promote`, `curl` and global help were inspected. Hosted build commands remained the exact copied web config: `cd ../.. && npx --yes pnpm@12.18.0 install --frozen-lockfile` and `node --version && cd ../.. && npx --yes pnpm@12.18.0 --filter @aegispay/web build`. No forced peer override or global Vercel41.4.1 invocation occurred.

The [official deploy documentation](https://vercel.com/docs/cli/deploy) confirms `--prod --skip-domain` withholds production aliases for later [promotion](https://vercel.com/docs/cli/promote). This allowed verification of the already-built candidate before moving the submitted URL.

## Browser, runtime and leakage verification

The local, authenticated-candidate and anonymous-production runs each verified Authorization, Over-cap refusal and Recovery rule at **320×740, 390×844, 768×1024, 1280×720 and 1440×1000**. Document scroll width never exceeded viewport width in those 45 combined state/viewport checks. Expanded receipt and policy identities also fit at 320px. The projector instrument fits its initial viewport, and the focus link exposes the evidence/claim strip together.

All successful runs retained historical labels, expired policy, distinct authorization and claim, the unsigned simulation refusal, and “Design preview · not executed” recovery. Keyboard Left/Right/Home/End navigation, focused boundary selection, URL/reload state, native receipt disclosure/focus, exact inner/outer/claim links, successful clipboard writes of all three exact hashes, denied-copy fallback and reduced motion passed. No new payment or retry action exists in this viewer. Actual unknown backend payment `f69178b7-0b0b-46fa-8e82-65c2dd5deee5` was not observed or modified by this executor and is not portrayed as recovered.

Production browser evidence records **zero page errors, failed requests, external runtime requests or non-read requests**. It saved **97 public response bodies** for inspection. Explicit independent anonymous HTTP reads additionally saved HTML and **text/x-component RSC** bodies. `/` returns200; `/api/health` returns200 and `Cache-Control:no-store`; `/app`, `/login`, session/state/catalog/run/receipt/report paths are absent/404. These 404s establish deliberate route omission, not authenticated access-control acceptance.

The deployed local font and icon return200 and exactly match the accepted source SHA256. All repository, PDF, folder, evidence, explorer and fixed-origin href values match byte for byte. Anonymous GETs of their eight destinations returned200. Remote/local submitted PDF SHA256 remains `45a46a0681cfbc8b11d904ec2a3c40b54c3954deb0dfd13a495e7e707a17762c`; no PDF or repository history changed. Explorer200 is a destination check, not new chain verification; folder200 is not MP4 playback.

Memory-only scans compare **15 known credential/provider-bypass values** without emitting them, plus private-report sentinels, Stellar secret-key patterns and signed-envelope markers. Results: [staged source/build](scan-source-and-build.json) zero matches across219 files before bypass creation; [built client assets](scan-built-client.json) zero across11 files; [verified candidate runtime](scan-candidate-runtime.json) zero across127 files; [final production HTML/RSC/JS/assets/responses](scan-production-runtime.json) zero across131 files. The final complete evidence-directory scan also reports zero matches in [scan-all-evidence.json](scan-all-evidence.json). Scans do not read journals or protected fixtures, and do not claim formal security certification.

## Visuals inspected and coordinator handoff

I opened and inspected the deployed production screenshots myself: desktop/full page, projector and focused projector, tablet, both phone widths, refusal, recovery, receipt and expanded 320px identities. The accepted ivory/petrol/mint design and local display font match; no unexpected clipping or horizontal document overflow was found. Authoritative independent-review paths are under `docs/evidence/finals-proof-deployment/production/`:

- [Desktop](production/desktop-viewport.png), [complete page](production/desktop-full.png)
- [Projector](production/projector-viewport.png), [focused evidence and claim](production/projector-focused.png)
- [Tablet](production/tablet-viewport.png)
- [390px phone](production/mobile390-viewport.png), [320px phone](production/mobile320-viewport.png)
- [Unsigned refusal](production/desktop-refusal.png), [recovery design](production/desktop-recovery.png)
- [Full receipt](production/desktop-receipt.png), [320px identities](production/mobile320-identities.png)

Only the executor's staged preview on **3026**, verified PID8588 with the matching Next command line, was stopped after delivery. Original accepted preview **3017** was preserved and independently returned HTTP200 after that teardown. Ignored staging is retained for reproducibility; no project, historical deployment or proof record was deleted.

## Recovered failures and limits

The initial combined prepare/install shell call used the not-yet-created staging working directory and was rejected before executing; preparation and installation were then run in dependency order. One scan was invoked from the wrong working directory, and another raced Next's transient lock; neither was counted as a pass. Corrected root invocation and excluding only the inaccessible build lock produced the recorded successful source/build scans.

The first provider attempt returned `fetch failed` before any deployment ID ([output](deploy.txt)); a read-only `whoami` subsequently succeeded. A diagnostic wrapper initially hit Windows stdout's Unicode encoding before logging its first API response ([output](deploy-retry.txt)); UTF-8 was fixed, its own orphaned CLI process12256 was identity-checked and stopped, and final provider history confirms no deployment was created by it. The successful retry created the single candidate above. Its optional CLI `--verify` hit a connection timeout after READY; we inspected that existing deployment rather than rebuilding/retrying publication.

The first anonymous candidate browser was correctly sent to Vercel login; that failed capture is retained under `candidate/` and is not an app-runtime pass. `vercel curl --deployment` without a linked project had no existing bypass and returned the authentication wall. A staging-only CLI `link` confirmed the same existing project but also generated an unwanted OIDC `.env.local`; that generated file was immediately removed by its verified absolute staging path without reading/printing its value, and neither it nor `.vercel/` appears in the upload. No later deployment was needed.

Supported authenticated candidate testing then used the exact automation-bypass endpoint/body implemented by pinned Vercel CLI support (`PATCH /v1/projects/{id}/protection-bypass` with `{}`), preserving normal Vercel authentication protection. One provider-managed automation secret was generated, kept only in provider storage and memory, attached solely to the exact candidate-origin request header, and never put in argv, URLs, evidence or source. [Vercel's automation-bypass documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation) describes this supported testing mechanism. The final public-origin test used a fresh anonymous browser with no bypass.

The first authenticated candidate suite completed its functional checks but treated a navigation-cancelled favicon as a fatal failed request. The harness now distinguishes only that precise `icon.svg`/`ERR_ABORTED` cancellation and separately fetches/hash-checks both favicon and font; the repeated immutable-candidate run passed. Production had zero cancellations. No accepted app source was changed to satisfy a test.

Full durable purchase/recovery, real model purchase, protected report entitlement, authenticated console and complete hosted backend/release gates remain unfinished. No unavailable backend route, liveness response, browser mock or historical spike is claimed as that product acceptance. TASK-015's same-link public refresh is complete; coordinator task reconciliation and the separate product gates remain outside this executor's write scope.
