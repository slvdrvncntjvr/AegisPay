# TASK-034 — Same-link presentation publication

**Delivered 18 November 2026.** The tested presentation is published at both existing website URLs and the public repository README/docs/PDF paths. TASK-034 is done for this bounded cleanup; every broader original task and production/live qualification retains its separate scope and status. The prior [local report](report.md), transcript/PDF receipts and all historical payment evidence remain preserved.

## Actual destinations and identities

| Destination | Actual delivery/readback |
|---|---|
| [Finals login](https://aegispay-finals-app.onrender.com/login) | Existing Free web `srv-dbs8k4t6e07s7395g9jg`, deploy `dep-dbuic30m7kps73cgblc0` **LIVE**, source `a60798a418abbdd97bffb198a2703c7dda926bd6` |
| [Public proof](https://aegispay-live.vercel.app/) | Existing project `prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq`; READY production candidate `dpl_7V2A2m3ZiPbRCuv6Va3EhDnZnUuF` passed before promotion; actual unchanged alias maps to that exact ID |
| Immutable candidate | `https://aegispay-live-gzv7t8gzy-vincent-s-projects-57de271b.vercel.app`; existing automation bypass was used only in memory and attached only to that exact origin |
| Public repository | Normal source-branch push and fast-forward public `main`, `017afa3` → `a60798a`; no force, conflict resolution, history rewrite or branch switch |
| [Unchanged public PDF path](https://github.com/slvdrvncntjvr/AegisPay/blob/main/docs/submission/AegisPay-pitch-draft.pdf) | Raw `main` bytes:274483, SHA256 `5855551530b8511bf55b23f8c56a9bf3665ef9274e5b8c1e1214ef98d018cd87`, matching the reviewed local PDF |

The initial implementation commit is `a3be63f`; `a60798a` preserves raw generated transcripts in an archive and normalizes only their display whitespace. A final documentary checkpoint follows these deployment commits without changing deployed application code; its exact remote refs are reported after push. The earlier authenticated preview, MP4 and Drive folder were not modified or redeployed.

## Web-only boundary and unchanged state

Fresh provider preflight matched exact owned Free services, auto-deploy **off**, active worker and database identity; the proof project had zero environment variables and no Git auto-deploy link. The entire application API/domain/worker/shared-package/runtime configuration/package/lock paths match the actual hosted `d42cb96` source byte-for-byte at the Git path level. The changed web start path executes Next only, with no migration, seed, worker or model invocation. [Runtime comparison](publish-runtime-preservation.json) records the paths examined.

The only existing service environment mutation was a provider-supported per-variable PUT of the web's `AEGIS_RELEASE_COMMIT`. All other web environment/configuration, the worker environment/configuration/deployment and database configuration compared equal to the protected preflight snapshot. One saved web deploy request was observed by its exact ID; no configure, activate, cutover/history, migration, seed, payment/model/wallet or live-login helper was invoked.

The independent worker remains `srv-dbs8kh3rjlhs73dgnmc0`, deploy `dep-dbsj216c6qcc739akjpg`, source `d42cb96d43e2c82e98cb2bd8eba8b8637809f0c9`, LIVE. Subsequent provider observations corroborate the unchanged worker and database configuration. These are configuration/source/start-boundary checks, not a fresh SQL-row or chain-balance observation; the publication made no application DB connection and created no application sessions, tasks, quotes or financial handoffs.

## Proof-only staging and actual checks

The fresh `.fmd-work/presentation-proof-20261118` packet has explicit per-file provenance/hashes and frozen pnpm12.18.0/Node24.22.1/Next16.4.5 inputs. Its only routes are the public homepage and minimal liveness health. Login/backend/worker/model/fixtures/environment/provider-config/Git-history contents are absent. The historical accepted manifests and one-shot guards were not reused or changed. Frozen install reused238packages with0downloads; the scoped production build passed. CLI dry output sealed27upload files, and actual provider file-tree readback confirms27source files plus14generated outputs, with no unexpected private source or application route.

| Scope | Observed result | Receipt |
|---|---|---|
| Final doubled-wording correction | Fresh full production build exit0; proof packet build and all later actual homepage checks include the corrected text | [Build](publish-copy-build.txt) |
| Frozen proof install/build | exit0, exact existing pins; no peer overrides | [Install](publish-proof-install.txt), [build](publish-proof-build.txt) |
| Local proof production check |12GET/asset checks,7client assets,3viewports, controls;0non-GET/external requests | [Local result](publish-local-proof-checks.json) |
| Immutable READY candidate |12GET/asset checks,7client assets,3viewports and all proof tabs;0non-GET/external requests | [Candidate result](publish-candidate-checks.json) |
| Actual proof alias after promotion |12GET/asset checks,7client assets,3viewports and controls; actual alias-ID match | [Alias result](publish-proof-alias-checks.json), [mapping](publish-proof-alias.json) |
| Actual active app |12GET/asset checks,8client assets,3home viewports and login; neutral Access token label, unauthenticated state401 | [App result](publish-app-checks.json) |
| Anonymous repository readback |5raw `main` files matched committed Git blobs; PDF binary SHA matches reviewed bytes | [Repository result](publish-repository-readback.json) |
| Actual upload closure |27source files,14generated build outputs; provider `src/` prefix normalized for comparison | [Remote files](publish-proof-remote-files.json) |
| Interactive Orca inspection | Public proof and active login, desktop1440 and mobile390, all4screenshots opened and visually reviewed; no sign-in | [Visual result](publish-orca-visual.json) |
| Final source/documentation checks | Root/web typecheck and lint/local26browser/PDF checks remain in the local report; final docs/strict34-task DAG/source-preservation/complete diff checks pass | [Final checks](publish-final-docs.txt) |

All36actual HTTP/asset checks across candidate, alias and app were anonymous GET-only except the candidate's origin-scoped provider protection bypass; no app session token was used. Browser automation blocked non-GET and outside-origin runtime requests and observed none. Known credential/secret-key/fixture markers were absent from checked HTML/assets; no protected report body or signed agent XDR was published. Existing explorer hashes, proof controls, historical dates, fictional-report/Testnet disclosures and expired policy/report-window qualifications remain visible. Screenshots: [proof desktop](publish-orca-proof-desktop.png), [proof mobile](publish-orca-proof-mobile.png), [login desktop](publish-orca-app-login-desktop.png), [login mobile](publish-orca-app-login-mobile.png).

## Factual repairs and preserved evidence

- Initial fresh helper lint found undeclared standard globals; explicit imports/globalThis repaired them, then lint passed without changing rules.
- The first staged whitespace check included newly tracked command transcripts and reported progress-output spaces/final blank lines; the initial local commit was created before that exit propagated, so a separate follow-up commit preserved their original bytes in [an archive](publish-original-transcripts.zip) and normalized display whitespace before any push; [the mapping](publish-transcript-normalization.json) records original hashes, and the complete-baseline whitespace gate then passed.
- CLI65.12.1 returns deployment identity inside `deployment`; an initial read attempted the top-level shape and returned404, then the saved nested ID was observed successfully without another create.
- Initial raw README comparison used Windows working-copy CRLF bytes; comparing committed LF Git blobs passed all5files and the PDF. No PDF hash mismatch occurred.
- Actual Vercel file-tree output wraps uploaded files in `src/` and adds generated `out/` build artifacts; correcting that comparison passed without changing or redeploying any source.

No dependent condition reached three unsuccessful repairs, no paid resource/new service was created, and there is no remaining publication blocker. Existing identity/pending/nonce/quote/report invariants and broader deferred obligations are unchanged. The owned3035local proof listener is stopped after its exact process identity is verified; ignored staging/protected operation markers remain for provenance and safe future observation.
