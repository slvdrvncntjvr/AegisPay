# AegisPay

Policy-controlled agent purchasing of demo API data on Stellar Testnet, using Noir and Velo. Original product brief: [IDEA.md](IDEA.md).

**Current state:** pinned SDK/runtime harness installed; synthetic integration safeguards and disposable Testnet account setup implemented. The early real Noir/Velo authorization, contract simulation refusal and separate merchant claim gates passed; the application and database slice remain incomplete. FMD supplies the guide and task ledger.

Start with [the docs index](docs/index.md), [the implementation plan](docs/implementation-plan.md) and [AGENTS.md](AGENTS.md). Routine scope/stack/auth/recovery choices are selected; no repeated product intake is needed. [Research](docs/research.md) records public-source checks and remaining live dependencies.

The selected stack is Next.js/TypeScript/Tailwind, PostgreSQL/Drizzle and a private Node worker with a direct tool-calling model SDK. Runtime and dependency pins live in [system design](docs/system-design.md). The first build milestone proves one signed Noir authorization can be sponsored/submitted through Velo; UI work follows that proof.

Check the guide now:

```text
python tools/check-docs.py
python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
```

Run implemented local checks with `npx --yes pnpm@12.18.0 verify:sdk-imports`, `typecheck`, `lint`, and `test:spike` (repeat the same command prefix for each). Testnet setup and the Velo account step are in [onboarding](docs/onboarding.md). `test:spike` is synthetic (41 cases passed); explicit opt-in `test:testnet` passed 42 cases including the required real saved-operation acceptance. This proves one paid authorization, not the complete release gates. No runnable dashboard is claimed.

[Onboarding](docs/onboarding.md) distinguishes available checks from future app commands. [.env.example](.env.example) lists external inputs without supplying keys. [QA](docs/qa-test-plan.md) defines the real Testnet and safety gates; [the pitch kit](docs/pitch-kit.md) defines the demo. No payment success, hackathon eligibility or production readiness is implied by completing this documentation.
