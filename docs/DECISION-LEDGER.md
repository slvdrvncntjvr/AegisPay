# Decision ledger — AegisPay

**Last reconciled:** 2026-11-07. Append decisions; do not use this as a second product specification or task tracker. [Index](index.md) identifies canonical owners.

## 1. Names & immutable identifiers

| Name / ID | Kind | Where | Rule |
|-----------|------|-------|------|
| AegisPay | Public product name | Console, README, pitch | Preserve unless a logged rebrand is requested |
| aegispay-402/1 | Protocol version | Quote/receipt schemas | Incompatible changes need a new version |
| F-001 through F-012; INV-001 through INV-010 | Stable requirement IDs | IDEA addendum → docs → tests | Never renumber or reuse |
| TASK-001 through TASK-013 | Stable task IDs | Implementation plan | Append new IDs; preserve done/cut history |
| Verified deployment tuple | Immutable per payment | Network/passphrase, contract IDs, SAC, signed operation | Capture at verification; never rewrite historical evidence on redeploy |
| Quote/operation/nonce/inner/event IDs | Immutable payment identities | DB/evidence | Never change to repair an uncertain payment |

At preparation no cloud project, Git remote, live wallet or verified contract tuple existed. Follow-up: local Testnet wallets and an explicit verified October tuple exist, and Velo project kh73f627zex1newmypn19qvcmx8hrc7v has one evidenced authorization. The public Git remote is now configured at https://github.com/slvdrvncntjvr/AegisPay; main and TASK-002 were pushed. November contract candidates remain rejected by the documented ABI check. The supplied handbook confirms the verified October 24 tuple is mandatory; its retired October 7 deployment is distinct from those November candidates.

## 2. Decision assumptions & evidence

| SUPPORTED | PROVISIONAL | UNVALIDATED |
|-----------|-------------|-------------|
| Public npm metadata and Noir declarations establish runtime/peer requirements and an authorize preparation API; local Node is 24.22.1 | A small Next/worker/Postgres codebase remains the selected fit, now mapped into required real workspaces; direct tool-loop and DB queue designs | Organizer-specific Gas acceptance, late-submission acceptance, registration, real model quality/access, hosted app, commercial demand and economics |

`SUPPORTED` is evidence-specific: metadata inspection alone proves neither installation nor payment. Later dated entries record the installed harness and one real payment; no completed app is established. Resolve provisional/unknown assumptions only with dated inspectable evidence.

## 3. Pivots & decisions (newest first)

### 2026-11-09 — Execute finals build and replace plain visual defaults

- **Authority:** user explicitly requests the coordinator to execute improvements using Orca, strongly rejects the plain UI, and names Magic UI, Watermelon UI and Impeccable as modern craft references. This supersedes preparation-era visual defaults, not the payment/security architecture.
- **Choice:** start the earliest unfinished paid-resource worker slice at TASK-005; retain TASK-006 recovery before full model/UI integration. Append TASK-014 for an independently shippable redesign of the existing public proof surface, with disjoint UI/backend write scopes and coordinator-owned task/ledger state. No full product or release gate is bypassed.
- **Work ref:** Orca run `run_3bfef6dba661`, starting main `180a88d`; user-authorized worker execution is an equivalent recorded work ref. Preserve untracked finals assessment artifacts and historical payment identities. Review preserved unfinished source before selective integration; no wholesale stash restoration.
- **Delivery:** AegisPay, `https://aegispay-live.vercel.app/` and `docs/submission/AegisPay-pitch-draft.pdf` remain fixed submission identity. User authorizes implementation and tested same-link delivery; keep the recorded proof fallback. No paid cloud resource, mainnet or custom contract deployment is authorized.
- **Evidence:** completed Nov 9 assessment establishes a saved-proof production slice and incomplete full purchase; current type/lint/73 unit/50 offline spike/docs gates passed. The supplied newer organizer email selects Top 15 with finals logistics TBA; older schedule uncertainty is historical. New implementation outcomes require actual gates and fresh evidence.
- **Invariants:** INV-001 through INV-010 unchanged. Modern motion/copy cannot imply model purchasing, report delivery, current policy validity or new chain execution before evidence exists. Worker financial keys remain separate from web/model/browser.

### 2026-11-07 — Reconcile the supplied handbook and mandatory public delivery

- **Source:** user-supplied `Velo x Noir Agentic Payment Hackathon — Builder Handbook.pdf`, updated Nov 5, 2026, SHA256 `ac77495fd5512dc2d62924dbbe9d6fed6b18ea1b64d72a99c010e8a1ba0cd55b`; all 13 pages inspected locally via PyMuPDF. Ignored source is not copied or linked as a public repo file. [Research](research.md#builder-handbook-reconciliation--2026-11-07) records page provenance.
- **Choice / supersedes compact single-package decision below:** mandatory public root-declared workspaces, one root install and deployed working public app. Keep Next Node, PostgreSQL/Drizzle and one private Node worker. apps/web owns UI/routes; apps/server owns worker; packages/agent owns the real F-005 model loop; packages/shared owns actual schemas/types. Retain existing root server integrations/spike paths initially. These targets are unimplemented; TASK-011 precedes TASK-003, TASK-012 follows TASK-010 and TASK-013 follows TASK-012. No done state comes from this decision.
- **Resolved:** handbook requires exactly the independently verified October 24 tuple; older October 7 IDs are retired. Prior uncertainty about mandatory tuple is closed. One actual Velo-sponsored Noir payment is evidenced; two reports are one payment. TASK-002 stays in_progress pending terminal-envelope cleanup recovery and fee-source reconciliation review fixes.
- **Velo boundary:** retain installed verified Velo 1.0.0 / Noir 0.3.0 / Stellar 16.4.1. Handbook alpha-tag checkout example does not justify a downgrade or unrelated checkout. Gas is actual sponsor/submission/status integration; no organizer-specific approval of that interpretation is invented. INV-002, INV-004 and INV-009 remain unchanged.
- **Delivery:** public GitHub repo/origin are configured and main/TASK-002 pushed; PR/Issue/Project rituals are optional. User authorizes hosting and public deliverables; this isolated documentation task does not push/provision. Ordered README includes available source/proof links and explicit missing app/video/deck statuses.
- **Presentation:** two-minute video (also within the form's reported five-minute maximum); five-minute pitch plus three-minute Q&A. Rubric is 30/25/20/15/10 for agentic fit/technical/innovation/real-world/pitch. Deadline Nov 7 noon Philippine time has passed, no extension supplied; continue by user instruction without on-time eligibility or win claim. Registration and Discord handle unverified.
- **Scope / invariants:** F-001 through F-012 and INV-001 through INV-010 retained. F-005 is still a real bounded LLM loop despite handbook allowance for rule-based agents. Architecture ownership changes, not the payment/recovery boundary. Specs remain Draft; no locked-spec CR is required. Original decisions remain historical below.


### 2026-11-07 ? Match RPC events to successful transaction metadata without inventing SDK flags

- **Type:** integration compatibility. **Observed:** the real RPC authorization event omitted `inSuccessfulContractCall`; Noir SDK 0.3.0 discarded it despite a matching successful fee-bump transaction. Current [Stellar getEvents documentation](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents) describes the returned event fields.
- **Choice:** query through the pinned Stellar SDK and decode only when contract/ledger/mapped inner-or-outer hash and exact serialized topics/data match one embedded contract event in independently successful transaction evidence. An explicit false flag is rejected; no success flag is synthesized and node_modules is unchanged. Full Noir invocation/signature, Velo identity/status and balance checks remain mandatory.
- **Evidence:** an omitted-flag regression accepts only the matching successful envelope/meta and rejects false flags, failed transactions, foreign hashes, altered amounts and absent embedded events. The real saved payment then passed this verifier and the separate merchant claim.
- **Recovery observation:** initial bounded Velo observation remained unresolved; later identity-only observation showed success. No additional agent signature, nonce or financial handoff was made. Two exported reports identify the same authorization and do not satisfy the release requirement for two distinct purchases.
- **Outcome:** TASK-002 live acceptance passed; independent code review remains pending. INV-001 through INV-010 remain the application requirements; the DB and UI are not yet implemented.


### 2026-11-07 — Explicitly select the verified October tuple for the technical spike

- **Type:** integration configuration. **Observation:** the November candidate agent registry in IDEA.md is deployed but its raw Wasm spec exposes AgentPolicy without owner. Exact ABI verification rejected it with POLICY_STRUCT_ABI_MISMATCH; no signing occurred. See [read-only inspection](evidence/testnet/incompatible-november-agent-registry.json).
- **Choice:** explicitly configure the October SDK-published tuple locally after independent Testnet network, Wasm hash, complete required lifecycle ABI, policy struct, registry links and native SAC checks passed. The public [verification artifact](evidence/testnet/contracts-1794013516299.json) records the actual IDs and ledger. No silent SDK default selection or new deployment is used.
- **Limit:** this establishes technical read-only compatibility only. Organizer-mandated deployment and Gas eligibility remain unconfirmed. If November IDs are mandatory, stop for updated compatible official contracts; never relax verification to make that deployment pass.
- **Local setup:** generated distinct disposable owner/agent/merchant credentials and encryption key into ignored .env.spike.local; all three accounts were created and independently observed on Testnet. RUN_TESTNET remains 0. Velo account/key/relayer activation remains external.
- **Recovery boundary:** the new filesystem journal is a single-operation spike harness with fsynced append-only records, authenticated envelope encryption and exclusive handoff markers. It is not the application database and does not establish PostgreSQL race/recovery acceptance. Full live driver wiring and actual execution remain incomplete.
- **Verification tooling:** isolated spike tests use Node's built-in test runner with tsx; application unit/integration tests still target Vitest. An offline pass never satisfies the required live acceptance case.

### 2026-11-07 — Use the supported TypeScript lint toolchain

- **Type:** tooling. **Change:** TypeScript 7.0.2 research candidate → exact 6.0.3 with typescript-eslint 8.72.1 and ESLint 10.14.0.
- **Why:** published typescript-eslint peer range is `>=4.8.4 <6.1.0`, independently confirmed against its official dependency-version documentation; 6.0.3 exists in npm. Strict peer installation remains enabled; no overrides.
- **Impact:** system design and package manifest reconciled; application behavior and INV-001 through INV-010 unchanged.
- **Execution context:** user explicitly authorized Orca supervision and read-only review; one code-writing executor remains responsible for the serial task plan.


### 2026-11-07 — Adopt a compact execution profile

- **Type:** zoom-in. **Change:** illustrative monorepo/multiple hosts → one package, web + private worker + Postgres; five screen concepts → four console sections plus overview header.
- **Why:** user's short-time MVP instruction. Preserve all twelve P0 outcomes and hard invariants.
- **Invalidated:** any implication that the illustrative repo tree or separate Vercel/worker hosts are mandatory.
- **Architecture rationale:** recorded directly in system design; no separate ADR required for this small initial selection.

### 2026-11-07 — Pin compatible SDKs and make handoff durable

- **Type:** platform. **Change:** unspecified latest SDKs/composed call → observed compatible pins and explicit Velo reserve/persist/submit.
- **Why:** Noir peers on Stellar 16.x; reservation identity must exist durably before a submission may become uncertain.
- **Invalidated:** “latest Stellar SDK is necessarily compatible”; “prepared authorization API is entirely unknown.” Live composition is still UNVALIDATED.
- **Impact:** reconciled to system design, API, data, security, QA and task plan.

### 2026-11-07 — Infer routine intake and preserve evidence distinctions

- **Type:** use-case. **Change:** repeated intake confirmations → explicit inferred solo context and documented defaults, per user instruction.
- **Why:** user supplied product intent and authorized practical inference/research. No external fact, successful test or official rule is invented.
- **Invalidated:** none of the original commercial/production uncertainty. “Real simulation refusal” and “included failed transaction” remain distinct.

## 4. Rejected approaches

### 2026-11-11 — Prepare a separate authenticated hosting preview

TASK-019's actual production-app/cloud-DB rehearsal and independent review passed. Continued user authorization for hackathon deployment now advances TASK-020, a separate Free Node web preview using the accepted application and isolated staging metadata. Prepare and review exact source, provider schema, Free configuration, environment allowlist and qualification commands before creation. Render supports Next.js web services and same-region database connections. Actual authenticated service readiness and HTTPS security checks must be observed. The Free DB's December10 expiry and Free service idle startup remain rehearsal constraints.

The preview runs without worker/model/financial credentials or execution, and uses a separate HTTPS origin with owner/merchant authentication and zero unprovisioned policy. Existing source/metadata identities stay preserved. A tested, scanned source checkpoint can be published to the existing repository for this preview after current auto-deployment settings are checked. The submitted Vercel alias and PDF path retain their separately accepted delivery status until the complete live release gates pass. TASK-020 adds deployment evidence without removing any TASK-010/012 payment, wallet, model, recovery or content boundary requirement.

### 2026-11-10 — Rehearse the real application against isolated staging state

The exact Free staging database passed its minimal TLS/SQL prerequisite. A single corroborated current-client IPv4/32 rule replaces its empty external-access policy; no broad access rule or paid feature is selected. Its provider expiry remains December10 with finals TBA. TASK-019 may apply existing checksum migrations and metadata-only catalog seed to this exact independent database, using a freshly generated distinct agent/device identity with zero policy and unprovisioned status. Original unknown-payment state, nonce, holds and database remain untouched. No financial history or entitlement is copied or invented.

TASK-019 then qualifies a local production Next.js process against that cloud database using actual HTTP and browser sessions, independent private owner/merchant login secrets and no worker/model/financial credentials. Only login/session/throttle metadata may arise from testing; no run, quote, wallet operation, signing, funding, chain/provider call or payment job is in scope. Existing verified public wallet/contract addresses may be read from protected configuration; no old agent/device identity is reused. Strict certificate/hostname verification applies to the actual application pool, not just its preliminary SQL probe. This is an independent deployment rehearsal, not complete TASK-012, hosted egress qualification, source publication or alias promotion. Release joins and all payment invariants remain unchanged.

| Considered | Rejected because | Revisit if |
|------------|------------------|------------|
| Generate every FMD template / multi-agent roster | Slows one-executor MVP and adds duplicate authorities | Actual team/production scope needs it |
| Stellar SDK latest 17.4.0 | Does not satisfy Noir 0.3.0 peer range | A verified Noir release supports it |
| SQLite/in-memory payment store | Does not establish intended Postgres concurrency and recovery guarantees | Pure throwaway UI mock, with no live-payment claim |
| Serverless request continues payment work after response | No durable worker guarantee | A verified durable workflow product replaces worker |
| Velo checkout as proof of Noir authorize | Different operation/evidence | A separately specified real checkout feature is requested |
| Blind retry/sign on uncertain status | May double-charge | Definitive non-success is independently established, followed by explicit new purchase intent |
| New Rust contract/resource-hash binding | Exceeds MVP and organizer deployment scope | Separate audited contract project |

## 5. Invariant audit

| Date | Invariants | Change | Verdict |
|------|------------|--------|---------|
| 2026-11-07 | INV-001 through INV-010 | Normalized source IDs; specified compact architecture and failure semantics | Preserved in docs; negative QA mapped. Runtime enforcement remains to be implemented/tested |

## 6. Open items / risks

**Historical Nov7 baseline; superseded by the current task ledger and dated checkpoints below:**

Mandatory tuple is resolved by the handbook; one technical Noir/Velo integration is proved, with two review fixes still pending. Package installation, spike safeguards, account funding, contract checks, one authorization, over-cap simulation refusal and separate claim have evidence. Model access/loop, DB, APIs, UI, real workspaces, hosting and release scenarios remain unproved. Registration, Gas-specific interpretation and late acceptance remain external; the complete release and submission gates are open. Capacity estimate is an assumption. No market interviews or positive unit economics were established. See task plan for status.

### Handbook reconciliation invariant audit — 2026-11-07

INV-001 through INV-010 remain unchanged. Real workspaces/hosting add delivery obligations without permitting another financial handoff, weakening independent evidence, exposing worker keys or fulfilling unresolved purchases. No app test or review-fix acceptance is inferred from documentation checks.


## Post-review payment acceptance follow-up - 2026-11-07

Both findings were inspected and integrated as 5db51dd: terminal cleanup retries safely after interruption; actual fee independently compares the outer charged fee against Velo. Worker offline regressions passed 50/50; integrated opt-in acceptance passed 51/51, no failures/skips. Saved authorization and claim handoff markers were checked before identity-only observation; both fee sources match at 82496 stroops. No new payment was made. Latest artifact: docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794064999769.json. Earlier pending-review statements are historical. TASK-002 is done and TASK-011 ready. All ten invariants remain unchanged; app/DB/model/UI/hosting gates remain unfinished. Docker/PostgreSQL infrastructure was independently verified, superseding the earlier absent-engine observation, but no application concurrency gate is implied.

## 2026-11-08 - Recovered foundation and user provider choices

User explicitly selected Gemini AI Studio and Render to avoid Railway payment. Gemini uses a worker-only key and verified function-call API; access/quota require actual smoke evidence. Render free background/private workers do not exist: isolate one wakeable authenticated HTTPS worker service and keep all durable state in PostgreSQL; do not claim private-network-only hosting. This adaptation needs auth/body/restart tests before release. No paid resources. Integer storage is unscaled numeric with integer/range checks because i128 maximum has 39 digits; full maximum and fractional rejection are tested. TASK-004 offline auth/wallet-body gate precedes app work; actual Freighter lifecycle stays required in TASK009/010 release. UI after TASK006 may proceed while model credentials are unavailable; TASK010 joins TASK007 and TASK009. No P0/invariant/release evidence requirement is cut.

## 2026-11-10 — Qualify process death independently of the live provider blocker

The user authorizes continued Orca implementation and has now provided usable Render access, verified by authenticated prerequisite reads. The original payment remains unresolved; no deployment, replacement purchase or hold release is inferred. TASK-017 independently qualifies actual OS-process death and restart against invocation-owned local PostgreSQL integration schemas using explicitly synthetic provider transport. This addresses the independent review's concrete gap: earlier injected exceptions run catch/finally and do not prove abrupt process death. It may prepare evidence for TASK-006, but does not complete TASK-005/006, remove their dependency edge or provide real provider/chain evidence. No product/payment invariant or release requirement changes. Cloud provisioning remains deferred until its actual application gates and the free database lifetime are considered.

## 2026-11-10 — Continue feature implementation while one incident is quarantined

User explicitly asks to continue toward full hackathon deployment quality and consider alternatives rather than stop for provider support. Separate feature implementation dependencies from final release acceptance: TASK-007 and TASK-008 may build on the accepted TASK-004 foundation and reviewed TASK-005 API/executor implementation. TASK-010 explicitly joins the still-required TASK-005/006/007/009/017 gates, so this scheduling change removes no live purchase, recovery, wallet or security requirement. TASK-005 remains blocked and TASK-006 retains its dependency; synthetic fixtures never satisfy their live obligations.

The accepted recorded-proof home stays intact; the authenticated product console uses `/app` with role-aware APIs and honest queued/unknown/unavailable states. Hosted preparation may proceed separately, but live alias promotion still needs its declared gates. The original incident, nonce, signed-journal history, held budget and absent entitlement remain preserved. A future deliberately independent demo agent/device/run and separately funded budget is an alternative rehearsal context, not a resend or replacement of the unresolved operation. It requires its own verified setup, finite policy, nonce continuity and fresh explicit purchase intent, with no reuse/reset/release of the original financial identity. No new financial operation is authorized merely by changing task dependencies, and no unrelated Velo checkout substitutes for same-invocation Noir/Velo proof.

## 2026-11-10 — Provision only the independent Free staging database prerequisite

After final combined local validation and source checkpoint577b844, user-authorized hosting preparation advances independently of live alias promotion. TASK-018 may create at most one explicitly Free PostgreSQL17 staging database in the verified Render workspace, preserving unrelated resources and original financial state. Free provisioning rejection requiring billing/verification or paid capacity must stop dependent creation. Actual creation/expiry/region and minimal TLS connection are observed, not inferred. The database remains free of seeded financial state, migrations, worker/model jobs and copied live records in this phase. No worker deployment, source push or public alias change is included; independent source review and remaining live gates still precede complete release. The Free database's30-day lifetime remains a demo scheduling constraint, with finals dateTBA. No product/invariant requirement is removed.

## 2026-11-14 — Qualify wallet recovery and constrain rehearsal execution

TASK-009 readiness review found missing durable human-wallet observation and unsafe reclaim overlap. TASK-021 adds leased identity-only wallet/claim observation, authenticated wake and exact independently included human-wallet failure recovery. Preparation, reclaim submission and observation use consistent agent-before-wallet locking; original unknown agent-payment state is never resolved or released by these paths.

TASK-022 adds signer-free identity verification and a zero-budget app-model diagnostic. Internal runs may persist zero budget, while the public task API keeps its1000000-stroop default. Migration0004 forbids increasing any saved run budget; it is tested only in isolated PostgreSQL schemas here. An automated purchase executor was removed before live use because script-only exact-price/deadline checks could be bypassed by ordinary consumers. The mode now refuses before file/config/DB/provider access. Complete manual authenticated app acceptance remains permitted only after independent setup, working provider and fresh explicit user purchase intent. No P0 or QA live gate is cut. All ten payment invariants remain required.

### TASK-022 final scope reconciliation — 2026-11-14

Coordinator explicitly narrows TASK-022 to accepted safe diagnostic/identity-only tooling, excluding disabled automated exact-consent purchase execution. Remove its TASK-010 dependency: optional automation must not block the canonical manual live QA path. TASK-021 remains required, as do all original genuine wallet/payment/model/refusal/recovery/hosted/media obligations. Future exact-manifest automation needs durable resource/merchant/asset/price/deadline authority; no existing app gate is waived. This is a tooling-scope clarification, not a product-feature cut or live-release acceptance.

The final task DAG serializes actual overlapping scopes: TASK-021 follows accepted TASK-008 API/console foundations, and optional TASK-022 follows TASK-021. This satisfies strict scope checking without depending on unresolved live TASK-005/007 gates or implying those gates passed.

Strict final reconciliation places both disjoint TASK-021 and TASK-022 after TASK-008; the intermediate TASK-022-after-TASK-021 edge would overlap broad TASK-010 tests in the same wave. The final plan owns these edges. TASK-022 remains optional to complete manual live release.

After three strict-scope rejections (reported to coordinator), final write-scope reconciliation puts TASK-022 after TASK-021 and narrows TASK-010 test writes to release browser/Testnet groups. Every unit/integration/browser/live command remains required and unchanged; running tests is not claiming their write scope. Optional TASK-022 remains absent from TASK-010 dependencies.


### 2026-11-14 — Complete independent local preparation without wallet or hosted authority

A later timing/status-only Gemini diagnostic completed the configured tool roundtrip unchanged; it removes provider-connectivity blockage without completing TASK-007 app acceptance. TASK-023 prepares a new owned loopback PostgreSQL database and five checksummed migrations, private separated configuration, and actual empty web/worker startup/ingress. Owner/merchant/agent/catalog tables remain empty while exact human public-wallet control is pending. Docker endpoint binding and DB ownership are corroborated; no original/preview state is changed. Local preparation needs no repeated generic approval.

The reviewed Free host packet has a sanitized source/runtime-fenced build launcher and explicit service/environment/qualification plan. Read-only provider inventory found only the existing Free previewDB in the accessible workspace; independent hosted database selection is unresolved. Existing preview capacity/configuration and submitted identities remain preserved. No remote mutation, new financial handoff, signing, actor registration/funding or full-release promotion is inferred. Exact-price/count/deadline automated purchasing remains disabled; the manual path discloses actual per-run/policy/escrow ceilings and requires fresh explicit intent. All original live QA and INV-001 through INV-010 remain mandatory.

## 2026-11-14 — Enforce the independent setup lifetime funding bound

User confirms historical Freighter control and authorizes autonomous completion. The new independent device setup discloses a total1000000-stroop escrow ceiling, so trusted context-bound configuration now reserves cumulative funding authority from confirmed and unresolved/prepared wallet operations. Spending/reclaim does not refill it; preparation and final handoff serialize on agent-before-wallet locks. Client input cannot widen the cap. Unconfigured contexts keep their existing per-operation bound. No product invariant or actual live acceptance is waived.

Partial independent review found a repeat-submit error race; after both workers exhausted quota and their exact archived assignments were released, the coordinator reproduced and repaired it by locking/rereading saved operation identity before mutable funding/reclaim guards. Final150PostgreSQL/17authenticated-console browser checks,types/lint/build and22actual access assertions pass; no independent final agent acceptance is claimed.

Confirmed historical public actors are metadata in the new owned local DB only. A single Friendbot request activates the new public Testnet agent account; it does not fund escrow or authorize purchases. Local3019/3020 stay running for human signatures. Existing preview/original financial state remains separate. Original SELECT-only identity observation still returns Velo409/RPCNOT_FOUND and preserves hold/nonce/absence of entitlement; missing data never establishes failure. See [setup evidence](evidence/live-setup-2026-11-14/report.md).
