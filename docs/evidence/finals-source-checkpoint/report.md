# Local source checkpoint inventory — 2026-11-10

Delivered under Orca Task `task_99ae5c2f2499`, dispatch `ctx_12c267cf2a70`. This is a reviewable inventory/hygiene proposal, **not staging authorization, a commit/push, deployment, or TASK-005 completion**. Only this evidence directory was written. No install, application build/test, service startup, DB/provider query or financial action ran.

## Explicit candidate lists

Every entry records the exact relative path, SHA-256, byte size, tracked state, HEAD hash where applicable and whether it actually needs staging. These are file lists, never directory-wide inclusion rules.

| Manifest | Proposed contents |
| --- | --- |
| [UI allowlist](ui-allowlist.json) | 13 accepted public source/assets/test files, 277313 bytes; 11 additions/modifications and two already-tracked unchanged dependencies |
| [Backend allowlist](backend-allowlist.json) | 25 backend/source/test/script files, 192496 bytes; four canonical changes, 57467 bytes; **23 individually selected safe evidence files**, 209203 bytes |
| [Baseline and dependencies](baseline-and-dependencies.json) | Already-tracked dependencies, source import edges, root package/pin comparison and public proof/PDF link targets |
| [Complete dirty inventory](working-tree-inventory.json) | 744 modified/untracked paths outside this audit directory, 39397121 bytes; explicit disposition for every path |

The combined proposal contains **65 paths**, of which **63** need an addition/modification. Current HEAD is `91f968011b8a8966512928579d85f745c2de38e7`: the submitted pitch checkpoint, following `180a88d`. The UI/backend source is still uncommitted relative to that older tracked implementation. Source additions include the queue/executor/adapters, gated merchant HTTP path, three purchase CLI helpers and integration tests; tracked differences include the executable worker, domain/HTTP/wallet changes and UI redesign.

All **13/13** accepted UI implementation/asset/test hashes match, as do the unchanged root lockfile and all **six/six** independently rechecked backend repair hashes. The original 15-entry UI manifest's only current mismatch is root `package.json`. Its current HEAD-relative semantic delta is solely the added `purchase:smoke` script; dependency/dev-dependency pins, engines, package manager and workspaces are unchanged. The root manifest belongs to the backend candidate list; its changed bytes are not represented as a match to the old UI manifest.

The four canonical candidates are `docs/DECISION-LEDGER.md`, `docs/design-system.md`, `docs/implementation-plan.md` and `docs/index.md`. They preserve the blocked real gate and the separately accepted public UI/pitch work. `.env.example` has a ten-line listener/wake catalog addition, but remains **excluded** under this task's configuration exclusion; no environment file or provider-local configuration is proposed. Other unrelated assessment, preflight, presentation-helper and deployment-preparation files are not blanket-added.

## One explicit source-closure hold

**The backend proposal is deliberately not a self-contained runnable checkout.** `src/server/merchant/receipts.ts` imports the untracked `src/server/merchant/reports.ts`, which contains the protected fictional fixture bodies. The instruction to exclude private reports takes precedence over silently treating that module as approved public source. Its path/hash/size are recorded only under `quarantinedRequiredDependencies`, outside the allowlist; its body is not copied into this audit.

The coordinator must resolve the scope of that exact server-fixture module before treating a future source checkpoint as complete: retain the exclusion, or obtain a clear server-source exception/approved private-data arrangement. No relocation or source edit was attempted. All other statically resolved relative import edges lead to proposed files or existing HEAD dependencies; no missing local imports were found. Workspace aliases and the existing exact SDK dependencies rely on the unchanged four-package workspace/lock inputs. The audit is static and does not replace the previously recorded test/build gates.

## Public evidence and exclusions

[Link closure](link-closure.json) checks **62** local Markdown links from the proposed changed documents: **35** land in the explicit proposal and **27** already exist at HEAD; none is missing or omitted. It stops at existing baseline documents rather than claiming a fresh recursive audit of the whole repository. Historical UI evidence and the submitted PDF also exist as local Git objects at HEAD, including the proof URL assembled from constants. External website/explorer/video/GitHub availability relies on stored earlier readbacks; no fresh HTTP check occurred. The video remains a folder link.

The minimum evidence includes the paid-resource outcome/contract/repair reports and selected identity observations, both independent review reports/manifests, the safe provider diagnosis/source provenance/operator packet and accepted UI source manifest. It excludes raw command logs and response captures. The 23 files form the checked local report-link closure; no entire evidence directory is proposed.

Excluded dirty inventory: **565** capture/binary artifacts, **29** logs, **85** other unreviewed work files, the configuration template and the protected fixture source. About **38.7 MB** stays outside the proposal. Examples include the 692100-byte assessment reference image, repeated approximately 354 KB receipt screenshots and hundreds of captured HTML/RSC/JS response `.bin` files. Existing submitted PDF/history is preserved, not deleted or replaced. The only new binary in the public UI allowlist is the accepted **205268-byte WOFF2**, accompanied by its exact OFL/attribution files.

[Hygiene scan](hygiene-scan.json) compares known private values from existing ignored task configs **only in memory**, emitting per-path booleans and paths. Candidate files have **zero** known private-value, Stellar secret-literal or nonempty serialized XDR/receipt/session/cookie/authorization matches. No credential value, credential fingerprint, whole env file or signed journal is exported. Sentinel references in negative tests/docs are not fixture body exports. This scan cannot rule out unknown/rotated/encoded credentials or secrets in binary images; raw logs, authenticated captures, private configs/journals and report bodies remain excluded. Server-only source placement alone would not hide a fixture body from a public Git repository, which is why the dependency hold is explicit.

## Future Git push and deployment risk

[Stored deployment review](stored-deployment-review.json) uses only the saved Nov 9 project/production/final readbacks and final upload manifest. Those project projections contain root `apps/web`, Next.js, Node24.x, outside-root inclusion and then-zero environment counts, **but omit Git repository/link/branch/automatic deployment controls**. The deployment projection also omits source/gitSource. Git-triggered auto-deploy status is therefore **unknown**, not established disabled. No tracked GitHub workflow exists; that does not establish the absence of provider-side Git hooks.

The recorded successful publication used a restricted **27-file / 399808-byte** manual upload, with generated health scaffolding and no full application API catchall or worker implementation. Current tracked Vercel build configuration builds the actual workspace; it is not that sealed restricted upload. A future Git push must therefore be treated as a potential attempt to deploy unfinished full-app source until the coordinator separately verifies the real project integration/trigger settings and delivery scope. `.vercelignore` is not evidence of an automatic-deploy safety switch. This task neither changed those settings nor authorized a push.

## Audit verification and remaining work

`python docs/evidence/finals-source-checkpoint/audit.py` exited **0** and generated the explicit manifests, import/link inventories and safe scan results. These are inventory checks, not application tests. Source acceptance and 79 PostgreSQL/73 unit/50 offline-spike passes come from the existing repaired manifests/recheck; the current full production build pass was supplied by the coordinator and was not rerun. [Checkpoint deliverables](checkpoint-deliverables.json) hash this audit's own files.

Before any later local checkpoint, recheck the chosen file hashes and settle the protected source dependency/configuration-template scope; do not use a broad add or include generated/private artifacts to make the tree look clean. No staging/commit/push command is supplied or executed here. The index remains unchanged, the original unknown reservation is untouched, TASK-005 remains blocked, and Render hosting access/release gates remain outside this inventory deliverable.
