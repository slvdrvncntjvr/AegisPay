# Confirmed-wallet local setup — 2026-11-14

The separate local application is running at http://127.0.0.1:3019/login, with its worker on loopback3020. Owner and merchant are the historical public accounts explicitly confirmed by the user. Access tokens are in ignored, current-user-only `.fmd-work/release-setup/access.md`; no token or signing key is published. This is ready for **manual Freighter setup**, not model purchasing or complete release.

## Actual state and scope

The exact owned `aegispay_release_20261114` database now contains confirmed owner/merchant metadata, two catalog offers and new independent agent `23d4540c-fe96-494b-9a54-41fcad4dad4a`, public key `GBN5A36EOGRYXCZBLTCBCFY6MGGKMVNT445PFZ6ADF6FMLKHRKOXIAII`, device `ff3f426f69a771e7fc959b5d4ce89154de871de81bd32c93289e5e9de5292100`. Policy remains zero/epoch/unprovisioned, nonce0, with no wallet operations, quotes, runs, payments, evidence, entitlements, claims or jobs. These are metadata preparations, never seeded chain success. [Actual context](local-context.json) records the initial fresh deployed-contract and Horizon observations.

One exclusive-marker-protected request to official Friendbot activated **only the new Testnet source account**. Independent Horizon readback matched that public account. [Account receipt](agent-account-1794663072002.json) establishes account presence, not device registration, escrow funding or a purchase. No owner/merchant funds were transferred. The old context, registration, nonce and reservation were never replaced. Faucet account balance is separate from the device's bounded escrow.

Worker configuration selectively uses only required current Gemini/model/Velo fields and the newly generated independent signer. Owner/merchant keys, original agent keys and signed journals are excluded. Worker-only credentials are absent from web configuration. Both processes persist `RUN_TESTNET=0`; that blocks agent purchase dispatch but does not globally disable human wallet submissions, observations or model jobs. No model task is submitted by this preparation. [Startup](setup-startup.json) and [access checks](access-check.json) record actual local availability and two created/revoked test sessions.

## Funding authority and repeat submission repair

The new trusted server configuration binds `DEMO_ESCROW_FUNDING_CEILING_STROOPS=1000000` to the exact configured agent public key/device. Confirmed funding and prepared/submitting/unknown reservations consume this lifetime ceiling. Spending or reclaiming does not replenish it. Preparation and final signed handoff lock agent before wallet rows and recheck both cumulative authority and observed escrow. Unconfigured contexts keep their existing per-operation maximum. Browser fields cannot widen the authority; HTTP rejects extra authority fields and excessive funding with a stable error. UI displays the lifetime ceiling and prevents excessive preparation.

The reviewer accepted the guard's structure but identified a repeat-submit race: both calls could snapshot prepared state; after the winner funded, the loser rechecked balance and returned422 instead of the saved identity. Coordinator reproduced this with two independent PostgreSQL connections blocked on the agent lock, then repaired it by rereading/locking the saved wallet operation before mutable-state guards. A committed/nonprepared operation is observed rather than counted or submitted again. Regression verifies two successful identity responses, one handoff and one observation job. [Reproduction](repeat-submit-reproduction.txt), [focused final checks](wallet-http-final.txt).

Both Orca workers exhausted quota and stopped before final acceptance. Their exact archived assignments were released before coordinator edits. The earlier review was a partial source review; **no independent post-repair acceptance is claimed**. The coordinator reviewed the final guard, tests, isolated startup, private boundaries and receipts. Existing accepted Nov14 manifests remain unchanged.

## Observed final checks

| Command / check | Result |
|---|---|
| `corepack.cmd pnpm typecheck` | exit0, root/web; [receipt](types-coordinator.txt) |
| `corepack.cmd pnpm lint` | exit0; [receipt](lint-coordinator.txt) |
| `corepack.cmd pnpm test:integration` | exit0,150/150 in11files, isolated PostgreSQL/synthetic chain; [receipt](integration-coordinator.txt) |
| Wallet/worker/HTTP focused suites | exit0,34/34; [receipt](wallet-http-final.txt) |
| `corepack.cmd pnpm build` | exit0; [receipt](build-coordinator.txt) |
| Authenticated-console Playwright on actual production3019, explicit installed Chromium | exit0,17/17 with synthetic protected transport; [receipt](browser-coordinator.txt) |
| Actual local owner/merchant login/state/logout/revoked-cookie checks |22assertions passed, two sessions revoked, eight execution tables0 before/after; [receipt](access-check.json) |

Earlier worker ACL/config/type failures and initial coordinator lock-wait test-filter failure remain preserved. The first coordinator failure was in its regression's `pg_stat_activity` filter; correcting the search-path-aware filter then reproduced the real race before repairing source. No assertion was relaxed or funding guard bypassed.

## User steps and remaining release

1. Open the local login in the browser with Freighter installed, select owner, and use the owner token from the protected access file. Freighter must use Testnet and the confirmed owner endingQLTR.
2. Select Register device, prepare, review the exact new device/agent and sign in Freighter. Observe the saved operation until independently confirmed. Unknown means observe the same identity; do not sign another preparation.
3. Set finite policy with max1000000stroops (0.1TestnetXLM), expiry within one hour. After confirmation, fund at most1000000stroops total. No top-ups beyond the lifetime cap. Each displayed wallet signature is the human's approval; no additional generic chat approval ritual is needed.
4. Report setup complete before starting a model task: purchase execution is not enabled yet. The planned0.03/0.04XLM purchases remain separate fresh user tasks under the actual0.1XLM escrow ceiling, not an exact two-purchase authority mechanism.

Hosted PostgreSQL is still external: official public Render OpenAPI exposes no workspace-create operation; [schema inspection](render-schema-review.json) records the reviewed schema. User dashboard creation of an eligible separate Hobby workspace is the minimal step. No paid capacity or existing preview database reuse is authorized. Root reviews new resources before remote mutations.

One signer-free, SELECT-only [original-identity observation](original-identity-observation.json) still finds Velo409/RPCNOT_FOUND and the original unknown attempt held300000/spent0 with zero entitlement. No database write, signature, sponsorship or submission occurred. Absence is not authoritative failure. The local [support draft](velo-support-draft.md) requests execution/fencing evidence; it has not been sent. This incident remains open independently of new setup.

Complete live release still requires genuine wallet signatures, two distinct application purchases and delivered resources, actual over-cap/expiry refusals, separate merchant claim, revoke/reclaim, real model price/no-purchase behavior, payment/recovery joins, hosted security/cold-start/restart checks and actual purchase media. TASK-024/025 complete their local engineering/setup scope; TASK-005/006/007/009/010/012/013 remain incomplete. No full-demo claim follows from this checkpoint.

Final documentation/strict plan checks pass with25tasks/no overlaps: [docs receipt](docs-coordinator.txt), [plan receipt](plan-coordinator.txt). [Hygiene](hygiene-coordinator.json) found zero matches across51changed files,14current client JS files and11known private values checked in memory; private custody remains ignored. This is bounded local hygiene, not a hosted full-response release scan. The new [source manifest](source-coordinator.json) records this checkpoint without modifying accepted earlier manifests.
