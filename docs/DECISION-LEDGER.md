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

No cloud project ID, Git remote, live wallet or verified contract tuple exists yet. The brief's contract candidates are not labeled verified here.

## 2. Decision assumptions & evidence

| SUPPORTED | PROVISIONAL | UNVALIDATED |
|-----------|-------------|-------------|
| Public npm metadata and Noir declarations establish runtime/peer requirements and an authorize preparation API; local Node is 24.22.1 | A small Next/worker/Postgres codebase is the fastest fit; selected direct tool-loop and DB queue designs | Actual Velo↔Noir interoperability, organizer Gas eligibility, mandatory deployment, virtual-device behavior, real model quality, commercial demand and economics |

`SUPPORTED` here means the stated inspection happened, not that the application was installed or that a payment succeeded. Resolve provisional/unknown assumptions only with dated inspectable evidence.

## 3. Pivots & decisions (newest first)

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

Live integration and official event eligibility are the first execution gates. Model access, package installation, DB migrations, API controls, tests and UI remain unexecuted. Capacity estimate is an assumption. No market interviews or positive unit economics were established. See task plan for work ownership; do not duplicate task status here.
