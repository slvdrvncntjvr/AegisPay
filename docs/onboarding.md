# AegisPay onboarding

## What this is

A Testnet agent paid-API demo described in [IDEA.md](../IDEA.md). The pinned runtime/SDK harness and guarded integration helpers exist; the application and complete live payment flow are still being built. FMD supplies the guide; [the task plan](implementation-plan.md) records execution.

## Read first

1. [Index §0](index.md) — which document owns each decision.
2. [PRD](prd.md) and [system design](system-design.md) — scope and selected stack.
3. [Implementation plan](implementation-plan.md) — start TASK-001, then prove the live SDK path before UI.

## Run it locally

**Available now:** `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` validate documentation. They do not test the future app.

**Implemented local gates:** `pnpm verify:sdk-imports`, `pnpm typecheck`, `pnpm lint` and offline `pnpm test:spike`. If pnpm is not on PATH, use `npx --yes pnpm@12.18.0` in its place. The complete application build, unit/integration/E2E/demo commands remain future gates. `pnpm test:testnet` includes a mandatory live case and currently fails; do not omit that case and describe the result as live acceptance.

**Testnet setup:** `pnpm setup:spike` creates .env.spike.local with distinct disposable signers, an encryption key, the pinned SDK's derived native SAC and official public Testnet network settings. Existing files are preserved. `pnpm setup:spike --fund` requests free Testnet account creation through official Friendbot and independently observes the accounts; it does not register Noir devices, fund Noir escrow or activate Velo. This checkout has completed that account setup locally. Secrets never print and the file is Git-ignored.

The coordinator explicitly selected the October contract tuple after read-only network/ABI/Wasm/link/SAC checks; see the [ledger](DECISION-LEDGER.md). November candidates failed the required owner field check. Organizer confirmation of the permitted deployment remains outstanding. `pnpm verify:contracts` reads the selected tuple without signing. Do not substitute a deployment or remove required ABI checks to obtain a pass.

**Your Velo account step:** open the [Velo console](https://www.velo-build.dev/dashboard), connect your Testnet wallet and create/select the AegisPay project. In its Gas Station configuration, create a **Gas Station · Testnet** key (`tg_test_...`) and save it directly as VELO_GAS_API_KEY in .env.spike.local. Check the project's managed relayer address, fund that address with free Testnet XLM, verify its balance, review daily/wallet limits and the approved Noir contract allowlist, and explicitly enable sponsorship. A generated relayer is not automatically enabled. The [official SDK onboarding](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md#dashboard-gas-station-guidance) describes these requirements; availability depends on the hosted deployment. Keep RUN_TESTNET=0 until the live driver is completed and its explicit opt-in is needed.

Local follow-up: the user saved VELO_GAS_API_KEY (presence/prefix checked without exposing it), and the supplied project relayer received free Testnet funding with an independently observed native balance. Next, refresh that balance in Velo and enable/save its sponsorship policy; signer readiness and actual key/provider authorization are still unverified. RUN_TESTNET=1 is deliberately unset. Noir fixture provisioning and the full durable payment/refusal/claim driver are incomplete code work, not configuration steps you must invent. The current spike is a safe preflight, not a ready-to-pay demo.

**After TASK-001 implements the scripts:** use the pinned Node/pnpm from system design, `pnpm install --frozen-lockfile`, and create untracked environment files using `.env.example` as a variable catalog. `.env.local` is for web configuration only; `.env.worker.local` contains worker configuration plus shared DB/network/receipt settings. Remove worker secret fields from the web file before populating it. Run `pnpm verify:sdk-imports`. The first integration milestone is `pnpm verify:contracts` then `pnpm spike:noir-velo`.

**After the remaining slices exist:** `docker compose up -d db`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` and, in a second terminal, `pnpm worker`. Open `http://localhost:3000`; use the configured role login. Next loads the web-only `.env.local`; standalone worker/scripts explicitly load their own file, never assume Next loads it. An implementation target for the worker script is `node --env-file=.env.worker.local --import tsx src/worker/main.ts`. Spike-only disposable owner/merchant keys, if needed for headless integration tests, belong in separate `.env.spike.local` and never in the web/normal worker files. See [QA](qa-test-plan.md) for verification and [pitch kit](pitch-kit.md) for rehearsal.

Required external inputs: Velo Gas Testnet key plus enabled funded relayer/contract allowlist, model API key, owner and merchant Freighter wallets on Testnet, configured agent key and verified contract IDs/SAC. Local inference cannot manufacture those credentials. Do useful bootstrap work before recording a missing input as an integration blocker.

## Where things live

[System design](system-design.md) owns the future source tree; [API](api-spec.md), [schema](data-model.md), [security](security-compliance.md) and [QA](qa-test-plan.md) define its boundaries. [Research](research.md) distinguishes inspected metadata from live evidence.

## Conventions

Follow [AGENTS.md](../AGENTS.md). Claim the next ready task, retain stable IDs, record actual command output and checkpoint the plan. No credential values, raw signed agent XDR or fabricated chain receipts enter docs, source control or prompts. No additional routine product intake is required.
