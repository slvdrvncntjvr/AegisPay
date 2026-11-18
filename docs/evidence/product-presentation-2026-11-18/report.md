# TASK-034 — Product presentation cleanup

Local implementation is tested and ready for coordinator review, from clean `6494881a82d18ca975bbc09fef6af87f81bb0c57` on `task/TASK-009-demo-readiness`. TASK-034 remains **in_progress** because same-link publication is pending. No commit, push, deployment, real session, financial operation, model call, wallet action, database helper, cutover or external resource change occurred.

[Changed-file inventory](changed-files.txt) · [Source hashes](source-files.json) · [Factual command records](local-gates.json)

## Delivered local changes

The README leads with bounded agent payments and the active Finals application, keeps prior proof/preview/video/PDF destinations and distinguishes the active Dec14 database expiry from the old preview Dec10 expiry. Current canonical prose, UX copy rules, index, onboarding and operator handoff describe the delivered Testnet profile, fictional reports and deferred broader qualifications. Dated Nov7 integration proof, Nov9 unresolved incident, Nov14 purchase/report and separate Nov15Manila claim remain distinct; future400000-stroop metadata does not change the paid300000-stroop quote. Balance statements are attributed to the last verified checkpoint, not newly observed chain state.

Login and report controls use neutral labels. Exact-key QuickSignal/DeepTrace aliases and fictional descriptions are display-only; raw resource keys remain in expandable technical details, unknown keys/descriptions fall back unchanged (including `constructor`), and API payloads, `isDemo` validation, stored tasks/answers and protected fixtures remain unchanged. The public homepage links the existing Finals login while the proof instrument retains its Nov7 financial values and existing query/receipt controls. An illustrative task is labeled a fictional report workflow rather than a fabricated transcript of the real run.

HTML/Markdown speaker notes and hidden Q&A now acknowledge the actual model purchase/report and hosted history. Slides4/5 retain Nov7 balances/transaction links; slide6 preserves the Nov9 unknown incident. The regenerated PDF stays at `docs/submission/AegisPay-pitch-draft.pdf`. The historical MP4, submission receipts, existing task rows and deployment guard receipts are unchanged; new export results are appended to deck-rendering.md.

## Actual local verification

| Command | Observed result | Artifact |
|---|---|---|
| `corepack.cmd pnpm typecheck` | exit0; root and web | [Output](typecheck.txt) |
| `corepack.cmd pnpm lint` | final exit0 | [Final output](lint-repaired.txt) |
| `corepack.cmd pnpm build` | final exit0; Next16.4.5 production routes built | [Final output](build-final.txt) |
| `corepack.cmd pnpm exec playwright test tests/e2e/public-proof.spec.ts tests/e2e/authenticated-console.spec.ts --workers=1 --reporter=line` | final exit0;26/26 pass in29.9s after an explicit server restart on the final build | [Final output](browser-restarted.txt) |
| `node scripts/render-pitch-deck.mjs` | exit0;8slides,0layout violations,0JS errors | [HTML layout](html-layout.json), [output](pdf-export.txt) |
| `python scripts/check-presentation.py --pdf` | exit0;8pages960×540,23HTTPS annotations/17distinct targets; prior PDF links preserved; no outside text or printed notes/Q&A | [PDF result](pdf-validation.json) |
| `node scripts/check-presentation-deck.mjs` | exit0;559words/300scheduled seconds,8synchronized notes; controls and print exclusion pass;0external requests | [Presenter result](presenter-validation.json) |
| `python scripts/check-presentation.py` | exit0; existing links/HTML anchors, original task rows, append-only ledger/run history and PUBLIC_PROOF values preserved | [Source result](source-preservation.json) |
| `python tools/check-docs.py` | exit0;22root/canonical Markdown files,12features,10invariants,31QA cases | [Final documentation checks](documentation-checks.txt) |
| `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | exit0;34valid tasks, coherent DAG, no same-wave scope overlaps | [Final documentation checks](documentation-checks.txt) |
| `git diff --check` | exit0 | [Final documentation checks](documentation-checks.txt) |

The production web process was bound only to127.0.0.1:3034 without a worker or application environment files. Browser API transport stayed intercepted: synthetic actions do not create application SQL/financial state or live evidence. Existing security, unexpected-request and no-retry assertions remain; the accepted-quote test additionally checks friendly names, hostile/unknown fallback and raw identity preservation. Browser viewport/focus checks remain part of the26. No integration DB gate or new live acceptance is claimed. Existing installed Next page/static-metadata docs were read before editing.

All eight final PDF PNGs were individually opened and visually reviewed: [1](page-1.png), [2](page-2.png), [3](page-3.png), [4](page-4.png), [5](page-5.png), [6](page-6.png), [7](page-7.png), [8](page-8.png). Layout and disclosure text are readable with no clipping; the SHA256/byte count in pdf-validation.json identify the reviewed file.

## Repairs and limits

The initial TASK-034 plan check rejected a missing backticked gate command; a first edit attempt used the host's default cp1252 reader and failed without writing, then the explicit UTF-8 repair passed the strict34-task check. One long shell edit was rejected by the execution policy and one combined delete/add patch was rejected; neither changed files, and smaller scoped edits completed the work. The new presenter helper initially failed lint for undeclared Node/browser globals; explicit Node imports and browser `globalThis` repaired it, followed by passing lint and presenter gates. Raw lint output is retained in lint-final.txt.

The first26-test run passed in33.2s; after one final homepage label edit, another26passed in35.9s. A server restart attempt returned EADDRINUSE because Ctrl-C ended the supervising session but left its owned Node child; its exact PID/commandline were checked, that child was stopped, and the final production server was explicitly restarted before the authoritative26/26 rerun recorded above. The owned listener is stopped at handoff; no existing local/hosted service was touched. No three consecutive repair failures remain and there is no local implementation blocker.

## Intentional visible-term exceptions

Exact URLs/filenames/path segments, command/env/API/schema/resource names and old heading-fragment aliases retain `demo`, `draft` or `MVP` where identity requires it. Original IDEA/context, historical task/evidence/ledger/change-record receipts and specification Draft lifecycle status are not rewritten or falsely Locked. Dated QA handoff/full-qualification paragraphs retain their historical scope; the official handbook rubric/format may still say “demo”. Stored task/model text and server-returned protected report labels are unchanged. These exceptions do not describe the delivered product as a draft or prototype.

## Safest same-link publication sequence (not executed)

1. Review this diff, new source/asset hashes and local gates, then commit/publish the approved source and same-path PDF on the coordinator's authorized branch flow; do not mark TASK-034 done before actual delivery readback, and do not complete any broader task merely from presentation checks.
2. For the active Finals app, target **only its existing web service** with the reviewed new source commit; preserve every existing service/database identity, all secrets, worker state and financial records. Render auto-deploy is off. Both the configured host build (`docs/evidence/demo-readiness-2026-11-14/hosted/build.mjs web`) and `deployment/finals/demo-release/start.mjs web` require Node24.22.1 and matching `AEGIS_RELEASE_COMMIT`/`RENDER_GIT_COMMIT`, so update only the web source pin through a newly reviewed operation while retaining other values. Use a fresh request/observation marker namespace and observe the saved deployment ID rather than repeating a create. Existing deploy.mjs has an old one-shot marker/configuration and must not be reset or repurposed by deleting historical receipts.
3. Do not rerun configure.mjs (rewrites environment/network and resets worker execution), activate.mjs, archive-history.mjs, database/seed/migration helpers or worker deployment for this copy change. No model/payment/wallet helper or financial handoff is required. The existing hosted asset/handoff helpers are not read-only presentation checks: one reads protected credential files and the other creates/revokes sessions and touches metadata; avoid them under this task's constraints.
4. For `https://aegispay-live.vercel.app/`, prepare a **new** restricted proof-only staging packet containing the reviewed public viewer files, workspace/package/build inputs and minimal public health route, with new hash/provenance attestation and frozen pinned install/build. The old proof-refresh/prepare.py validates15historical hashes and run_cli.py pins ctx77fd54 staging, so do not overwrite their manifests or reuse old accepted receipts. Keep login/backend/worker/fixtures/env files out of this proof packet. Use an immutable candidate (`deploy --prod --skip-domain` in the reviewed provider flow), validate its anonymous HTML/assets/controls/link identities, then promote that exact tested candidate to the unchanged alias; record actual source/deploy/alias readback.
5. The public PDF is served from the unchanged GitHub main path; publish the approved bytes there through the repository flow without renaming the file. Check actual raw PDF bytes/SHA256, eight pages and all anonymous destinations after publication; a200GitHub HTML/blob page alone does not prove updated PDF content. Keep the existing Drive folder and MP4 untouched and do not claim a new recording or upload. Record new factual publication evidence without overwriting earlier receipts.


## Publication addendum — 18 November 2026

The earlier local checkpoint above is preserved as dated history; TASK-034 is now delivered at both existing websites and public main README/docs/PDF paths. [Publication evidence](publication.md) owns actual deploy IDs,36GET-only checks,raw PDF hash,unchanged worker/DB configuration and final documentary checkpoint. No broader task or production gate is completed by this presentation delivery.
