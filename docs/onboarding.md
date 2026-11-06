# AegisPay onboarding

## What this is

A Testnet agent paid-API demo described in [IDEA.md](../IDEA.md). This checkout currently contains an execution guide, not an implemented app. FMD prepares the guide; the coding agent follows the tasks to build it.

## Read first

1. [Index §0](index.md) — which document owns each decision.
2. [PRD](prd.md) and [system design](system-design.md) — scope and selected stack.
3. [Implementation plan](implementation-plan.md) — start TASK-001, then prove the live SDK path before UI.

## Run it locally

**Available now:** `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` validate documentation. They do not test the future app.

**After TASK-001 implements the scripts:** use the pinned Node/pnpm from system design, `pnpm install --frozen-lockfile`, and create untracked environment files using `.env.example` as a variable catalog. `.env.local` is for web configuration only; `.env.worker.local` contains worker configuration plus shared DB/network/receipt settings. Remove worker secret fields from the web file before populating it. Run `pnpm verify:sdk-imports`. The first integration milestone is `pnpm verify:contracts` then `pnpm spike:noir-velo`.

**After the remaining slices exist:** `docker compose up -d db`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` and, in a second terminal, `pnpm worker`. Open `http://localhost:3000`; use the configured role login. Next loads the web-only `.env.local`; standalone worker/scripts explicitly load their own file, never assume Next loads it. An implementation target for the worker script is `node --env-file=.env.worker.local --import tsx src/worker/main.ts`. Spike-only disposable owner/merchant keys, if needed for headless integration tests, belong in separate `.env.spike.local` and never in the web/normal worker files. See [QA](qa-test-plan.md) for verification and [pitch kit](pitch-kit.md) for rehearsal.

Required external inputs: Velo Gas Testnet key plus enabled funded relayer/contract allowlist, model API key, owner and merchant Freighter wallets on Testnet, configured agent key and verified contract IDs/SAC. Local inference cannot manufacture those credentials. Do useful bootstrap work before recording a missing input as an integration blocker.

## Where things live

[System design](system-design.md) owns the future source tree; [API](api-spec.md), [schema](data-model.md), [security](security-compliance.md) and [QA](qa-test-plan.md) define its boundaries. [Research](research.md) distinguishes inspected metadata from live evidence.

## Conventions

Follow [AGENTS.md](../AGENTS.md). Claim the next ready task, retain stable IDs, record actual command output and checkpoint the plan. No credential values, raw signed agent XDR or fabricated chain receipts enter docs, source control or prompts. No additional routine product intake is required.
