# AegisPay onboarding

## What this is

A Testnet agent paid-API demo described in [IDEA.md](../IDEA.md). The pinned runtime/SDK harness and guarded integration helpers exist; the application and complete live payment flow are still being built. FMD supplies the guide; [the task plan](implementation-plan.md) records execution.

## Read first

1. [Index §0](index.md) — which document owns each decision.
2. [PRD](prd.md) and [system design](system-design.md) — scope and selected stack.
3. [Implementation plan](implementation-plan.md) — TASK-001 is done; finish TASK-002 review fixes, then TASK-011 workspaces before TASK-003. Preserve payment-before-UI.

## Run it locally

**Available now:** `python tools/check-docs.py` and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` validate documentation. They do not test the future app.

**Implemented local gates:** `pnpm verify:sdk-imports`, `pnpm typecheck`, `pnpm lint` and offline `pnpm test:spike`. If pnpm is not on PATH, use `npx --yes pnpm@12.18.0` in its place. The complete application build, unit/integration/E2E/demo commands remain future gates. `pnpm test:testnet` includes a mandatory live case and requires explicit RUN_TESTNET=1. The authorized acceptance run passed 42/42 with zero skips; invocation with the default RUN_TESTNET=0 remains intentionally refused. Reverification observes the saved operation and claim; it does not buy again.

**Testnet setup:** `pnpm setup:spike` creates .env.spike.local with distinct disposable signers, an encryption key, the pinned SDK's derived native SAC and official public Testnet network settings. Existing files are preserved. `pnpm setup:spike --fund` requests free Testnet account creation through official Friendbot and independently observes the accounts; it does not register Noir devices, fund Noir escrow or activate Velo. This checkout has completed that account setup locally. Secrets never print and the file is Git-ignored.

The coordinator explicitly selected the October contract tuple after read-only network/ABI/Wasm/link/SAC checks; see the [ledger](DECISION-LEDGER.md). November candidates failed the required owner field check. The supplied Nov 5 handbook requires this October 24 tuple and retires October 7 IDs, resolving permitted-tuple uncertainty. Organizer-specific approval of the Gas role remains unverified. `pnpm verify:contracts` reads the selected tuple without signing. Do not substitute a deployment or remove required ABI checks to obtain a pass.

**Your Velo account step:** open the [Velo console](https://www.velo-build.dev/dashboard), connect your Testnet wallet and create/select the AegisPay project. In its Gas Station configuration, create a **Gas Station · Testnet** key (`tg_test_...`) and save it directly as VELO_GAS_API_KEY in .env.spike.local. Check the project's managed relayer address, fund that address with free Testnet XLM, verify its balance, review daily/wallet limits and the approved Noir contract allowlist, and explicitly enable sponsorship. A generated relayer is not automatically enabled. The [official SDK onboarding](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md#dashboard-gas-station-guidance) describes these requirements; availability depends on the hosted deployment. RUN_TESTNET=0 remains the persistent default. The executor can use an explicit per-process RUN_TESTNET=1 for the authorized capped live gates after offline checks pass; this never removes the guard or changes the persistent default.

Local follow-up: the user saved VELO_GAS_API_KEY (presence/prefix checked without exposing it), and the supplied project relayer received free Testnet funding with an independently observed native balance. Activation/funding steps below are retained for reproducibility; this checkout already has screenshot evidence of registration, active linked escrow and Enabled policy, and actual Gas execution is proved by the live spike artifact. RUN_TESTNET=1 is deliberately unset. The full durable spike driver is implemented. With explicit per-process RUN_TESTNET=1, run `pnpm setup:noir-fixture`, then `pnpm spike:noir-velo`, then the required `pnpm test:testnet` acceptance command. Initial setup caps escrow at 10000000 stroops (1 Testnet XLM), policy at 1000000 per authorization with one-hour expiry, and the single purchase at 300000 (0.03 XLM). A random virtual device, saved nonce 1 and operation are created before sponsorship; retries reuse that operation and observe saved hashes. Do not delete .aegispay-spike or regenerate a payment after an unknown result.

**Managed-relayer activation correction:** the published backend deliberately rejects first-time activation through `Policy controls` / `Save policy` when managed custody is ready. Its generic UI error can obscure this. Reset the unsaved toggle, register/sync the AegisPay project on Testnet from Dashboard (`Register Project On-Chain`), add the verified existing escrow through the project Contracts page and wait for its link to become Active, then return to Gas Station and use `Review sponsorship settings` / `Enable sponsorship with these settings`. The review requires at least one active linked contract; a manually entered allowlist alone does not satisfy that prerequisite. Linking references an existing contract and does not redeploy it. Primary sources: [policy mutation](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/backend/convex/gas/mutations.ts), [activation UI](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/apps/web/features/projects/gas-managed-activation.tsx), [contract linking](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/apps/web/features/projects/project-contracts.tsx).
 The full driver passed 41 offline cases and the real opt-in 42-case acceptance run. One authorization/refusal/claim flow is evidenced; terminal-envelope cleanup recovery and fee-source reconciliation review fixes/gates are pending. These 41/42 results predate the fixes. This remains an early integration slice, not the application or a release-ready demo.

**Installed harness:** use the pinned Node/pnpm from system design, `pnpm install --frozen-lockfile`, and create untracked environment files using `.env.example` as a variable catalog. `.env.local` is for web configuration only; `.env.worker.local` contains worker configuration plus shared DB/network/receipt settings. Remove worker secret fields from the web file before populating it. Run `pnpm verify:sdk-imports`. The first integration milestone is `pnpm verify:contracts` then `pnpm spike:noir-velo`.

**After the remaining slices exist:** `docker compose up -d db`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` and, in a second terminal, `pnpm worker`. Open `http://localhost:3000`; use the configured role login. Next loads the web-only `.env.local`; standalone worker/scripts explicitly load their own file, never assume Next loads it. After TASK-011 maps the logical worker into apps/server, the root worker command must explicitly load the worker-only environment; no runnable worker entrypoint exists yet. Spike-only disposable owner/merchant keys, if needed for headless integration tests, belong in separate `.env.spike.local` and never in the web/normal worker files. See [QA](qa-test-plan.md) for verification and [pitch kit](pitch-kit.md) for rehearsal.

Required external inputs: Velo Gas Testnet key plus enabled funded relayer/contract allowlist, model API key, owner and merchant Freighter wallets on Testnet, configured agent key and verified contract IDs/SAC. Local inference cannot manufacture those credentials. Do useful bootstrap work before recording a missing input as an integration blocker.

## Where things live

[System design](system-design.md) owns the future source tree; [API](api-spec.md), [schema](data-model.md), [security](security-compliance.md) and [QA](qa-test-plan.md) define its boundaries. [Research](research.md) distinguishes inspected metadata from live evidence.

## Conventions

Follow [AGENTS.md](../AGENTS.md). Claim the next ready task, retain stable IDs, record actual command output and checkpoint the plan. No credential values, raw signed agent XDR or fabricated chain receipts enter docs, source control or prompts. No additional routine product intake is required.

**Event compatibility:** current RPC events omitted the legacy `inSuccessfulContractCall` flag expected by Noir SDK 0.3.0. The adapter decodes an event only after matching its exact serialized topics/data, contract, ledger and mapped transaction hash against an independently successful transaction and embedded event. It never fabricates the missing flag. A bounded pending result stays unresolved and resumes by saved identity; do not sign or submit again.


## Required workspaces and public delivery

The handbook requires a working public website and public workspaces monorepo. [Repository](https://github.com/slvdrvncntjvr/AegisPay) is public with origin and pushed main/TASK-002 branches. TASK-011 must declare root workspaces and implement real apps/web (Next UI/routes), apps/server (private worker), packages/agent (tool-loop library) and packages/shared (consumed schemas/types). Keep spike files/root server integrations stable initially; system-design mapping applies to older logical paths. One root `pnpm install --frozen-lockfile` must install all parts and root commands delegate without separate installs. These folders/manifests are targets, not existing app code.

TASK-010 establishes local release gates; TASK-012 then deploys the same commit/lockfile to public web + private worker + PostgreSQL and verifies real model/payment/receipt/recovery behavior remotely. Configure public origin, secure sessions and isolated server environments; do not expose worker keys or fixtures. Hosting account/access and actual URL remain unverified. A static deck/README deployment cannot substitute for the working app.

TASK-013 publishes a <=2-minute real recording and public deck, validates anonymous access to all links, confirms Salvador Vincent Javier's Discord handle/registration and prepares the short write-up. Draft sources: [recording](submission/recording-script.md), [deck](submission/pitch-deck.md), [packet](submission/README.md). No public video/deck URL exists yet.

The Nov 7 noon Philippine-time deadline has passed; no extension supplied. User asks continue. Registration/late acceptance and organizer-specific Gas interpretation remain external; no on-time eligibility or guaranteed win is claimed. F-005 real model access/tool behavior must pass; rule-based logic is not a scope replacement.
