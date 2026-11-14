# Independent demo-readiness review — 2026-11-14

Reviewer dispatch `ctx_2a1feb5491e5`, task `task_a1994a208e3a`; initial HEAD `017afa337ac7b29bfef55f5de282eb9f0396bc9b`, shared working tree with one writing executor. This is review evidence, not a release receipt. No source/canonical edit, checkout, build, application test suite, protected environment/login read, authenticated session, DB/provider/chain mutation, worker startup, signing or financial submission was performed by this reviewer.

## Acceptance and source provenance

TASK-021 and narrowed TASK-022 are accepted **within their stated local scopes**. Initial independent SHA256 comparison found all **78/78** entries of `final-source.json` matched disk, including test receipts. Preserved receipts show 112 unit, 143 real isolated PostgreSQL, 50 offline spike and 21 production-browser checks, plus types/lint/build. These are executor results inspected by the reviewer, not reviewer reruns. Synthetic provider/chain transport does not qualify live app acceptance. Later writer changes to model diagnostics and current documentation intentionally supersede their historical hashes; preserve the original manifest and produce a new final manifest rather than rewriting history.

Fresh reviewer commands `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` both exited 0: 22 valid tasks, coherent dependency/state DAG and no same-wave write overlaps. These prove documentation structure only. They ran before the writer's subsequent hosted preparation; final combined checks remain the executor's responsibility.

Source review covered canonical PRD/API/security/QA/pitch, task ledger, decision ledger, worker payment/run/wallet consumers, queue/continuity, HTTP/auth/receipt boundaries, independent verifier, Noir/Velo/envelope/wallet inspection, zero-budget rehearsal runner, migration/seed, Freighter client and owner/merchant/audit UI, relevant local tests and submission/evidence records.

## Findings by severity

No new critical payment, ownership or secret regression was established in this review. This is a bounded source review and cannot establish complete security or external correctness.

| Priority | Classification and exact evidence | Required outcome |
|---|---|---|
| P1 | **Missing live acceptance:** `docs/implementation-plan.md:47` (TASK-005), `:48` (TASK-006), `:49` (TASK-007), `:51` (TASK-009), `:52` (TASK-010), `:54` (TASK-012). One historical SDK payment and separate claim do not establish two app purchases, real model report use, wallet lifecycle or hosted recovery. | Complete genuine app/manual release joins before claiming full live readiness. Preserve original unknown attempt, identity, nonce, held budget and absent entitlement; no replacement submission or release by absence. |
| P1 | **Hosted execution unqualified:** `apps/server/src/index.ts:32` wires three consumers and `:51` defaults to loopback; `apps/server/src/worker/ingress.ts:11` health is liveness. No actual worker URL or hosted execution receipt has been supplied at this checkpoint. Existing preview excludes financial/model execution by `deployment/finals/preview/environment.json`. | Exact reviewed Free web/worker configuration, worker bind `0.0.0.0`, separate secrets, authenticated wake, cold-start/restart/TLS/auth/body/ownership/leak and payment/claim checks on the same source. Health 200 alone is insufficient. Prepared artifacts remain under separate review below. |
| P2 | **Missing dedicated live automation, explicitly disclosed:** `package.json:30` invokes `tests/testnet/*.test.ts`; `tests/testnet/live.test.ts:1` is TASK-002 spike acceptance. Planned `purchase.test.ts`, `policy.test.ts`, `claim.test.ts`, `lifecycle.test.ts` do not exist. `scripts/demo-smoke.ts:12` default is inert and model-only uses stub offers. `docs/qa-test-plan.md:9` correctly discloses this. | Treat these commands as their actual limited evidence scope. Manual full QA is permitted and can satisfy release; absent historical planned filenames are not an additional mandatory automation gate. |
| P2 | **Independent context remains a prerequisite:** `scripts/release-rehearsal.ts:23` excludes the original attempt/device/DB-agent identity; `:104` persists zero budget; `:52` disables purchase. Original public agent-key freshness is not independently established by this checker. | Select/verify a distinct finite rehearsal context; keep original incident untouched. Do not treat diagnostics or identity-only observation as receipt, consent, or live wallet acceptance. |
| P3 | **Stale narrative:** historical deck notes (`docs/submission/pitch-deck.md`, slide 8/Q&A) retain older backend counts/breaker and folder-upload status; dated delivery-status/final-checkpoint are historical. QA traceability contains planned filenames and an old handoff sentence. | Prefer current dated readiness report and clearly date historical proof. Writer already corrected the recording-script's obsolete no-screenshot claim and plan section 5. Avoid broad rewrites of historical evidence. |

## Payment, wallet, model and UI review

`src/server/domain/wallet.ts:68` refuses reclaim with unresolved purchases and independently reads revocation; preparation and signed handoff share agent-before-wallet order. `src/server/domain/purchases.ts` blocks acceptance while a reclaim is prepared/submitting/unknown and atomically reserves integer budget/increasing nonce. `src/server/domain/wallet.ts:151` commits one human-wallet handoff and observation job; `:161` wake failure does not resend. `:190`–`:209` requires exact independently included transaction, body/hash/source/signature and negative failure result before terminal human-wallet failure; NOT_FOUND/timeout remains unknown. `apps/server/src/worker/wallet.ts:9` resolves ownership from SQL, checks lease, supports legacy claim observation, and never signs/submits. Relevant new local tests exercise lease theft, claim event, wake loss, competing connections and lock order; consumer recreation is not OS-process death or hosted evidence.

Payment executor durably persists Velo identity before its financial marker, wipes encrypted signed bytes at handoff, uses `maxRetries:0`, and resumes by identity. `src/server/integrations/payment-verifier.ts` independently joins Velo to the successful outer/inner transaction and exact embedded Noir event; `stellar-evidence.ts` verifies signed invocation asset/agent/nonce in addition to event fields. `domain/evidence.ts` atomically binds quote/operation/nonce/identity to one entitlement and moves held budget to spend only after verification. Receipt routes check role, owner, run/resource, token and original validity; protected reports stay server-side. This review did not re-observe the original financial database or prove current chain/provider status.

Owner UI contains explicit prepare/review/Freighter consent, configured wallet/network checks, unknown observation and reclaim refusal. Merchant UI implements integer future-price edits and separate wallet claim/history; HTTP quote-immutability tests exist. The actual Freighter register/policy/fund/revoke/reclaim and separate claim remain unrun, as do genuine current-price/changed-price/no-purchase model traces. Current public proof labels itself historical integration, with no fabricated report delivery or second purchase.

Pinned installed `@stellar/freighter-api@6.0.1` declarations corroborate the actual `signTransaction(unsignedXdr,{networkPassphrase,address})` call and returned `signedTxXdr`/`signerAddress`, plus `getNetworkDetails.networkPassphrase` and optional error checks used by `apps/web/src/components/wallet.ts`. The official Freighter web guide redirected to an inaccessible documentation host during review; live extension behavior remains unverified, and installed types are not a substitute for human wallet rehearsal.

## Newly accepted provider connectivity diagnostic

Reviewed `scripts/model-smoke.ts:45`–`:57`: the opt-in wrapper forwards the exact input/init to native fetch and emits only request ordinal, method, HTTP status, elapsed time and abort boolean; no URL/header/body/native exception/key is emitted. Adapter deadline remains 30 seconds. No DB, payment SDK, catalog, signer or execution tool implementation is imported. `:72` constructs synthetic empty-offer tool response data directly and `:73` checks the exact final marker. `model-transport.txt` shows two GET200 and two POST200, one expected discover_offers call, preserved call-ID/thought-signature presence booleans, exact roundtrip pass and zero financial actions. The previous MODEL_TIMEOUT receipt remains historical. The successful bounded result removes the **provider connectivity** blocker; it does not prove full TASK-007, model purchasing, prices, useful report access or future quota/availability. No new key/account change is established as necessary.

Primary references inspected: [Google function calling](https://ai.google.dev/gemini-api/docs/function-calling), [generateContent REST](https://ai.google.dev/api/generate-content), [Render Free services](https://render.com/docs/free), [Render Node deployment](https://render.com/docs/deploy-node-express-app). Function-call proposals require application-supplied tool results; Free Render services have inbound-idle/cold-start and ephemeral-storage limitations. No model availability/free-tier assertion is inferred from a general model list.

## Fresh anonymous network observations

Bounded `curl.exe --max-time 15 --connect-timeout 5` requests, no credentials/cookies, no retry loop:

| Endpoint | Observation | Scope |
|---|---|---|
| `https://aegispay-auth-preview.onrender.com/login` | GET200, 1.296s | Login shell availability only |
| Preview `/api/health` | GET200, 0.505s | Web liveness only |
| Preview `/api/v1/state` | GET401, 1.087s | Anonymous protected-state denial only |
| `https://aegispay-live.vercel.app/` | GET200, 0.383s | Public proof shell availability only |
| Raw GitHub `docs/submission/AegisPay-pitch-draft.pdf` | Redirect-following HEAD200, 0.412s | Anonymous file availability; no remote checksum/render verification |
| Raw GitHub `docs/submission/aegispay-demo.mp4` | Redirect-following HEAD200, 0.578s | Anonymous file availability; no remote playback verification |

An earlier Python urllib bundle stalled and was explicitly interrupted without usable output; it provides no network conclusion. No rendered-browser session, login, asset scan, worker request, Drive playback or current authenticated journey was performed by this reviewer. Historical Nov11 four journeys/45HTTP remain historical qualification, not fresh release evidence. Free staging DB expiry remains the recorded `2026-12-10T11:55:40.452333Z`; provider billing/lifecycle was not re-read.

Three additional bounded anonymous GETs to official `https://horizon-testnet.stellar.org/transactions/:hash` re-observed the **historical public proof only**. Outer `6e898ad8...` and inner `1d39c3e3...` queries both returned successful at ledger5607680, `2026-11-07T14:34:01Z`, charged fee82496; Horizon canonicalized the outer query's returned hash to the inner. Separate claim `94cea8bb...` returned successful at ledger5607763, `2026-11-07T14:40:56Z`, fee10068. Only hash/status/ledger/time/fee were printed; returned envelopes were not written or exposed. These are still one authorization and its separate claim, not two purchases, a new complete Noir/Velo verification, current balances, or observation of the original Nov9 unknown incident.

## Ranked next demo checklist and honest present capability

1. Approve/select independent finite Testnet agent/device/DB/escrow context and verify nonce registration history; user reviews/signs genuine Freighter owner lifecycle. Never reset/reuse original unknown context.
2. Obtain fresh explicit purchase intent and record **two distinct actual application** Velo/Noir successes with operation/nonce/inner/outer/event joins, entitlement and protected-resource delivery. Original incident needs authoritative execution/fencing evidence; missing RPC data is not failure.
3. Record actual over-cap and expired-policy deployed-contract refusal with simulation/inclusion labels, separate merchant claim/balance evidence, revoke/reclaim and receipt/recovery behavior.
4. Record actual provider current/changed-price and sensible no-purchase-with-available-budget traces. Provider-only smoke and zero-budget diagnostic are insufficient.
5. Qualify exact hosted app/worker source, authenticated wake/cold-start/restart, TLS/security/content boundaries and payment/claim evidence; then update full release task statuses.
6. Record <=120-second actual model-purchase media, verify final playback/links, and obtain user-only Discord/registration/finals/organizer confirmations. Preserve submitted identities until gates justify promotion.

Today: demonstrate the labeled Nov7 same-invocation Noir/Velo saved authorization, over-cap simulation and separate claim in the public proof viewer; show published PDF/112-second evidence replay, implementation/local test evidence, authenticated console preview with private user access, and newly successful bounded provider tool connectivity. Do not narrate a completed live model-purchase demo, two app purchases, hosted worker or genuine wallet lifecycle. Local MP4 is 7,032,553 bytes, SHA256 `0abb3bdaf17508dce2a4c8d1cbca25a69a86c54de658a10d67148e410b3dd1fc`; PDF SHA256 `1856daa7a76675936647dbed78845f5671bad00dee3fd337362dcf01ad81fad5`.

## Reviewed source hashes (SHA256)

| File | Digest |
|---|---|
| `apps/server/src/worker/wallet.ts` | `8c0a2d326a5a7a1cb4cba3928145858fd0cc57168325f8d1bd6c077ae3c4dfa2` |
| `src/server/domain/wallet.ts` | `8314ddaa56dcaf52c2c6d89cac128be9f0a216f38f9537eae237b38305e24cd6` |
| `apps/server/src/index.ts` | `8f16d4d169e02c8d6bd3ca953fbb850c1f88961ab74d2e26946af406bc03bbf6` |
| `scripts/release-rehearsal.ts` | `1f1fce2da5a1035b1a7df8a20dc597f4b5797553c1ee94b94bbc1ea4ae9f3163` |
| `src/server/integrations/payment-verifier.ts` | `aa0289ca1d27b82f5f32eb35c2cbb4fa26f204483153d94c888cbc077965bfa4` |
| `scripts/model-smoke.ts` (new diagnostic) | `38565ded51d5f89767658ee542cc428ea62189752c2c338f663b5a025468e291` |
| `src/server/integrations/model.ts` | `97b5d79900fdc237baa2f930170605e68d33b757c2dcc5ded4c218a6e5afaad5` |
| `model-transport.txt` | `e26812fc29949de07b78a47dc8cbebf7bf1f40a7c73445b78bc4b3ad548b3e67` |

## Hosted preparation and metadata collector acceptance

Accepted the exact delivered `hosted/README.md`, `service-plan.json`, `build.mjs`, `qualify-ingress.mjs`, `collect-saved-acceptance.sql`, `context-proposal.json` and `wallet-steps.md` for their **preparation-only scope**. Reviewer `node --check` of both JavaScript helpers exited0; neither helper was executed against a live host by the reviewer. An actionable draft mismatch was repaired: JSON originally prescribed raw unsanitized install/build commands despite README requiring the sanitized launcher, and omitted launcher fence names. Revised `service-plan.json:5`–`:6` calls only `build.mjs web|worker`, removes bypass install commands, and `:10` includes `AEGIS_RELEASE_ENABLED/COMMIT`.

`hosted/build.mjs:10` validates exact runtime and approved-source environment before any child starts; `:13`–`:27` passes a fixed allowlist of OS path/temp/home plus production/telemetry values to fixed child argv. DB/model/signing/login/wake/receipt/provider secrets are not forwarded. The import-only worker check cannot start a worker. Expected inert exit2 and source-fence exit1 receipts are retained; host installation/build remains unrun. Release start argv relies on coordinator source/service/environment readback rather than a sealed startup launcher, and this limitation is explicitly documented. Actual startup/asset/TLS/custody attestation remains a release gate.

The anonymous helper reads no configuration/environment/credential files, sends no valid wake token and performs no login/task/quote/wallet/payment operation. It has at most12 sequential requests, 60seconds per request, 1MiB bodies, no redirect/retry; total worst case can approach12minutes. Its stored preview receipt reports six correct anonymous checks, including three401s, with zero financial actions. This is not authenticated role/wake/body/origin/ownership, content-leak, cold-start/restart or live acceptance. The reviewer did not rerun this receipt.

`hosted/collect-saved-acceptance.sql:7` is parameterized SELECT/CTEs only; exact independent agent/device plus two attempt IDs, optional exact claim and wallet IDs exclude original incident identities. It exports bounded-purpose metadata, no task text/token/XDR/ciphertext/operation payload/report. Its output explicitly says `fullRelease:false`, and two stored rows are not chain or delivery proof. Caller must establish a read-only repeatable-read transaction and5second statement timeout. Stored `sql-offline.txt` reports execution on an owned isolated integration schema, false empty context and SQLSTATE25006 for a forbidden write. This is syntax/nonmutation/empty-fail-closed coverage only, not live collector acceptance. No arbitrary JSON proof importer or second chain interpretation was introduced; existing identity-only independent verifier remains authoritative.

The initial public context proposal fixed a new agent/device, local3019/uncreated database and finite policy/escrow at1000000stroops with proposed300000+400000 purchases. Subsequent nonfinancial local schema preparation is accepted below. Actual DB agentId is still null; account/device/policy/funding remain unprovisioned; human control of historical owner/merchant public addresses is unconfirmed. User-only ACL/private key custody is writer-reported and was not inspected by opening protected files. Each purchase still requires fresh exact intent. Wallet steps correctly warn that merchant claim sweeps all merchant pending SAC balance and cannot automatically attribute historical credits to the new pair of purchases. These are proposals, not financial authority.

Independent **hosted** DB selection remains unresolved: existing preview Free DB cannot be reused under this packet, and [Render permits one active Free Postgres per workspace](https://render.com/docs/free). Exact accepted commit, actual provider capacity/service identity, strict actual DB TLS/migrations, environment separation, source/assets, security/recovery/live joins and media all remain before release. Reversible independent **local** DB/schema/config preparation can continue without chain actions or seeding unconfirmed human actors; its subsequently requested receipts remain pending below. Missing wallet consent or hosted DB does not block all independent engineering work.

| Hosted file | Reviewed SHA256 |
|---|---|
| `hosted/build.mjs` | `7636fc7ea1f5ec434de23bb0d9640fc7c42a759fd398c11f3371658c1673a80a` |
| `hosted/qualify-ingress.mjs` | `5aa3af92a577fcd0d277965118ec815e630a1706bf83cb17abbc336364bbe1ba` |
| `hosted/collect-saved-acceptance.sql` | `656d38a538a1fcb111feb21f91faa4b5983789a676a9045b24992b254f01b152` |
| `hosted/service-plan.json` (repaired) | `911fb58b3ae4f3ae1c96157540bf0a406a2de88aacb76630436a501d1c17e4db` |
| `hosted/context-proposal.json` (initial, superseded by local schema receipt below) | `804038647e2386f00acc2409a70c1b46d511fb5c002de6ed59426641b7247acd` |
| `hosted/wallet-steps.md` | `ed4eae66231ef8983c068dc95528c2d85335663bf2d889bb0eb909d47f896c7e` |
| `hosted/sql-offline.txt` | `31cd57619cce18f8b0a8d1bb7ad8e74b4c1c932fc7ce2bc1ce097d33ebf8b3ed` |

## Independent local schema and empty-process acceptance

Reviewed `hosted/prepare-local.mjs`, `qualify-local.mjs`, `local-preparation.json` and `local-qualification.json`; **accepted only as reversible empty local preparation and ingress qualification**. No protected config contents were read and neither script nor DB/app/worker was executed by the reviewer.

Preparation created exact new owned loopback database `aegispay_release_20261114` on PostgreSQL17.11 with a saved ownership comment, five applied migrations and three separate ignored config skeletons. Independent file comparison confirms **5/5 migration digests** match current source using the canonical `migrate.ts` CRLF-to-LF normalization; raw byte hashes of CRLF SQL are intentionally different and are not a discrepancy. All16 actor/catalog/execution/auth tables are empty. No owner/merchant agent metadata or catalog was seeded; no model/Velo/agent signer credential is present in either prepared config. Web and worker private variable-name lists preserve separation. Current-user ACL/private config handling is represented by the source and sanitized executor receipt; no values were exported to the reviewer.

One concrete custody gap was identified and repaired: original preparation checked workspace-labelled Docker container ownership and loopback URL separately, without joining the target port to that container. Revised `prepare-local.mjs` checks exact container5432/tcp publication to127.0.0.1 and the configured port **before database actions**; the final `qualify-local.mjs` rechecks that endpoint mapping, workspace labels/cwd, exact DB identity/comment and config match. `local-qualification.json` records `ownedContainerPortBindingMatched:true`, corroborating the actual already-created target without recreating it. Preparation refuses existing targets/configs; `--resume` is only interrupted-preparation recovery while the proposal is still unprepared, never an instruction to recreate/adopt/reset the completed target.

The final qualification receipt records actual temporary empty local Next production web3019 and worker3020 startup with **17/17 HTTP checks**: shells/health200, protected APIs401, worker unknown/wrong-method404, missing/wrong-auth401, valid-token browser-Origin403, extra/malformed/unsupported bodies400, oversized body413 and exact authenticated empty wake202. The source proves both child environments omit signer/model/provider/human identity fields, have RUN_TESTNET0, no web dotenv file, matching safe custody and an empty queue before startup. Final16 table counts remain zero after wake and migration digests remain unchanged. This proves real local ingress wiring without owner/merchant login, model, chain, wallet, purchase, hosted TLS or recovery acceptance. Reviewer fresh `orca ports --all --json` showed neither3019nor3020 listening afterward; no unrelated process was changed. The earlier qualification receipt is retained separately; final receipt adds the independently requested port-map join.

Current independent local DB/schema/config preparation is therefore complete within its narrow scope. User public-address confirmation and bounded wallet/setup/purchase consent remain before metadata seeding or financial execution. Independent hosted database selection remains a distinct external prerequisite. Final canonical documents must reconcile the earlier uncreated-local wording to these observed results; this review does not treat stale preparatory prose as current state.

| Local file | Reviewed SHA256 |
|---|---|
| `hosted/prepare-local.mjs` (endpoint guard repaired) | `88e38cc8e1627e9e96c8af6939d24bc8505a3c8974735caced820d48e612541f` |
| `hosted/qualify-local.mjs` | `cc9c37679729c5e1132c583cc0739c8e4bbf43e3161a5967533819b091a55bd2` |
| `hosted/local-preparation.json` | `bf0c6f3f7d4aef7315fe19227380f332c86f9bbeae77d55dae3fbe06159413ce` |
| `hosted/local-qualification.json` | `cba084b843c887b0031658f2f489ece5e349ddef55785aae51422c093bb2a2db` |
| `hosted/context-proposal.json` (local schema prepared, no actor seed) | `645951d56488873223070449fdb611d135aad698203aedb238534ef028461b7b` |

This review artifact is frozen for the final delivery manifest. Final combined manifest/documentation/plan verification will be reported through Orca orchestration after the writer supplies the reconciled packet; no unseen future changes are accepted here.
