# AegisPay onboarding

## What this is

The current implementation runbook for the Testnet MVP. Local checks and saved proof are distinct from full live release.

## Read first

Start with [index](index.md), [implementation plan](implementation-plan.md), [decision ledger](DECISION-LEDGER.md), then [PRD](prd.md), [system design](system-design.md), [security](security-compliance.md) and [QA](qa-test-plan.md). The [Nov 14 readiness report](evidence/demo-readiness-2026-11-14/report.md) distinguishes implemented behavior, current tests and remaining release evidence. Historical checkpoints retain their original dates.

## Run it locally

Use Node24.22.1, Corepack pnpm12.18.0, Python3 and Docker Desktop. On this Windows host use `corepack.cmd pnpm`; bare pnpm is absent. Root delegating scripts invoke Corepack too. From the root:

```text
corepack.cmd pnpm install --frozen-lockfile
corepack.cmd pnpm db:setup
corepack.cmd pnpm workspace:smoke
corepack.cmd pnpm verify:sdk-imports
corepack.cmd pnpm typecheck
corepack.cmd pnpm lint
corepack.cmd pnpm test:unit
corepack.cmd pnpm test:integration
corepack.cmd pnpm test:spike
corepack.cmd pnpm build
python tools/check-docs.py
python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
```

`db:setup` starts only its workspace-owned loopback PostgreSQL17.11 project and preserves ignored `.env.integration.local`. Each integration invocation uses a fresh owned UUID schema in `aegispay_integration`; cleanup proves ownership. No live database, signer or provider is required for these gates. `db:migrate` and `db:seed` instead load `.env.worker.local`; inspect their intended target before invoking, and never use them as a shortcut against the original incident or hosted preview.

Browser tests require a production Next process bound to loopback3017 (or explicit `UI_BASE_URL`) and an installed Chromium (`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when needed). Run `corepack.cmd pnpm test:e2e --workers=1`. Existing protected-API transport mocks are synthetic and stay outside live evidence. They do not prove wallet consent, actual purchases or hosted recovery.

## Where things live

apps/web owns Next UI/routes; apps/server owns durable consumers; packages/agent owns bounded tools; packages/shared owns schemas; src/server retains shared domain/integrations; scripts and tests own executable checks; docs owns specifications/evidence.

## Configuration and startup

[.env.example](../.env.example) catalogs names; it is not a safe all-process environment. Next commands run in `apps/web`, so a local web-only file belongs at `apps/web/.env.local`, or supply an isolated web process environment. Root `.env.worker.local` is explicitly loaded by `pnpm worker` and named worker scripts. The optional spike uses separate `.env.spike.local`. Never copy agent/provider/encryption or spike signing keys into web, browser, model prompts, logs or evidence.

Web needs its database, exact `APP_ORIGIN`, Testnet/public actor/contract fields, independent owner/merchant login secrets, receipt key and optional worker wake URL/token. Worker needs the shared database/receipt/network/public context, constrained agent key, envelope key, Velo Gas key/base URL, Gemini key/model and wake token. Hosting uses separate isolated service environments; no `NEXT_PUBLIC_` secret. Login tokens are entered only in the private login form.

`corepack.cmd pnpm dev` / `start` run web. `corepack.cmd pnpm worker` runs durable payment, bounded model and wallet observation consumers. Review the exact isolated context and queued jobs before starting a funded worker. `RUN_TESTNET=0` remains the generated persistent default; authorization for live work uses an explicit per-process opt-in. It does not globally disable model calls, read-only recovery or human-wallet submissions. The setup serializer now enforces persistent0; existing ignored env files were not rewritten or inspected for values in this checkpoint.

Migration0004 supports trusted internal zero-budget diagnostic runs and forbids increasing a saved run budget. Public run creation still accepts only task text and uses the PRD1000000-stroop default. New migration execution is a separately reviewed database operation; current tests applied it only inside isolated local test schemas.

## Model and release rehearsal

The existing bounded nonfinancial provider check is:

```text
node --import tsx scripts/model-smoke.ts --worker-env-file .env.worker.local
```

Only `GEMINI_API_KEY` and `AGENT_MODEL` are read from that file. It uses no application DB or financial SDK. Nov14 initial discovery succeeded but generation timed out (`MODEL_TIMEOUT`, exit1). A later single bounded call with `--diagnostic` before `--worker-env-file` passed the actual tool roundtrip (both POST200, exit0), without config/account changes or automatic retries. The flag emits only method/status/timing/abort metadata. No replacement key/account repair is currently required; actual app-model price/no-purchase/purchase gates remain open.

`demo:smoke` is inert by default. `--offline` qualifies synthetic tools/DB; `--model-only` requests a bounded stub choice. `test:testnet` is the guarded historical spike acceptance, not the full app release suite. The QA purchase/policy/claim/lifecycle paths remain planned dedicated live coverage, not tests that already exist.

The [release rehearsal runner](../scripts/release-rehearsal.ts) has an inert default and explicit independent-manifest phases. [Detailed steps](evidence/demo-readiness-2026-11-14/rehearsal.md) describe diagnostics, zero-budget app-model runs, fresh-consent purchase, identity-only resume and two-distinct-application-attempt verification. Live phases remain unrun. They do not automatically establish hosted behavior, receipt delivery, contract refusals or Freighter lifecycle.

## Human wallet boundary

Freighter must be on Stellar Testnet with the exact configured owner or merchant wallet. Prepare each action, inspect its unsigned body and finite terms, then explicitly review/sign in Freighter. No programmatic wallet approval. Independently confirm each saved hash before proceeding. Device registration, finite policy and funding precede purchases; merchant claim follows independently verified pending credit and is separate from entitlement.

Revocation must confirm before reclaim, and unresolved purchases prohibit reclaim. Reclaim preparation/submission and new purchase acceptance serialize on the agent row. A lost wallet response is recovered by original operation ID/hash; no second submit. Exact independently included human-wallet failures can release only that wallet operation's active slot; timeout, expiry and NOT_FOUND stay unknown. The worker's saved-hash observer cannot prepare, sign or submit.

The original unknown application attempt `f69178b7-0b0b-46fa-8e82-65c2dd5deee5`, nonce, reservation and holds remain quarantined. Never rerun setup, change its identity, resend, reclaim, reset or release its budget. A new independent demo context needs its own reviewed setup and fresh explicit user purchase consent.

## Hosting and delivery

The public site replays saved proof. The separate authenticated Render preview was qualified Nov11 without model/financial execution; Nov14 anonymous health/login/console checks pass and protected APIs return401. Current authenticated release qualification remains open. Free staging DB expires2026-12-10T11:55:40.452333Z. [New hosted preparation](evidence/demo-readiness-2026-11-14/hosted/README.md) has a sanitized build launcher, service/environment plan and bounded anonymous qualifier; an independent hosted DB target remains unselected. Full worker/app release needs authenticated wake, cold-start/restart and all remote security/payment gates; no deployment or preview credentials/scope changes occurred.

A112-second evidence-replay video and public eight-page PDF already exist. The full live recording, release, Discord/registration confirmation and finals logistics remain open. See [submission packet](submission/README.md) and [pitch kit](pitch-kit.md). The historical Nov7deadline passed; no extension, late acceptance or organizer-specific Gas approval is asserted.

## Conventions

Use strict integer amounts, immutable quote terms, persisted nonce/reservation identity and one financial handoff. Unknown stays held and unentitled; recovery observes its saved identity. Keep secrets and signed agent XDR server-only. Record factual gate evidence in the implementation plan and run evidence; do not modify historical artifacts or fmd/.

## Confirmed-wallet local setup — 2026-11-14

The [latest setup checkpoint](evidence/live-setup-2026-11-14/report.md) supersedes the earlier unseeded-local status: confirmed actors/catalog and a new independent agent/device now exist only in the owned local release DB. Real app3019/worker3020 are running for human Freighter registration, finite policy and escrow setup. Protected access instructions are in ignored `.fmd-work/release-setup/access.md`; never publish tokens. New-agent account activation used one Friendbot request and independent account readback, not an escrow deposit/purchase. A trusted lifetime funding bound1000000stroops now persists after spend/reclaim; browser cannot widen it. Human signatures remain required and purchase execution stays disabled until actual setup/nonce continuity is verified. Current source passes150PostgreSQL/17authenticated-console browser checks and22actual role/session assertions. No full live or hosted release is implied.
