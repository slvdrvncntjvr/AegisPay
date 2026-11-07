# Decision ledger — AegisPay

**Last reconciled:** 2026-11-07. Append decisions; do not use this as a second product specification or task tracker. [Index](index.md) identifies canonical owners.

## 1. Names & immutable identifiers

| Name / ID | Kind | Where | Rule |
|-----------|------|-------|------|
| AegisPay | Public product name | Console, README, pitch | Preserve unless a logged rebrand is requested |
| aegispay-402/1 | Protocol version | Quote/receipt schemas | Incompatible changes need a new version |
| F-001 through F-012; INV-001 through INV-010 | Stable requirement IDs | IDEA addendum → docs → tests | Never renumber or reuse |
| TASK-001 through TASK-010 | Stable task IDs | Implementation plan | Append new IDs; preserve done/cut history |
| Verified deployment tuple | Immutable per payment | Network/passphrase, contract IDs, SAC, signed operation | Capture at verification; never rewrite historical evidence on redeploy |
| Quote/operation/nonce/inner/event IDs | Immutable payment identities | DB/evidence | Never change to repair an uncertain payment |

At preparation no cloud project, Git remote, live wallet or verified contract tuple existed. Follow-up: local Testnet wallets and an explicit verified October tuple exist, and Velo project kh73f627zex1newmypn19qvcmx8hrc7v has one evidenced authorization. No Git remote is configured. November contract candidates remain rejected by the documented ABI check.

## 2. Decision assumptions & evidence

| SUPPORTED | PROVISIONAL | UNVALIDATED |
|-----------|-------------|-------------|
| Public npm metadata and Noir declarations establish runtime/peer requirements and an authorize preparation API; local Node is 24.22.1 | A small Next/worker/Postgres codebase is the fastest fit; selected direct tool-loop and DB queue designs | Actual Velo↔Noir interoperability, organizer Gas eligibility, mandatory deployment, virtual-device behavior, real model quality, commercial demand and economics |

`SUPPORTED` here means the stated inspection happened, not that the application was installed or that a payment succeeded. Resolve provisional/unknown assumptions only with dated inspectable evidence.

## 3. Pivots & decisions (newest first)

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

Live integration and official event eligibility remain open. Package installation, synthetic spike safeguards, disposable Testnet funding and read-only deployment checks have execution evidence. Model access, DB migrations, application APIs, UI, additional release scenarios remain unproved. One early sponsored authorization, over-cap contract simulation refusal and separate merchant claim now have evidence; the complete release and organizer-eligibility gates remain open. Capacity estimate is an assumption. No market interviews or positive unit economics were established. See task plan for status.
