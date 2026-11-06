# AegisPay

Policy-controlled agent purchasing of demo API data on Stellar Testnet, using Noir and Velo. Original product brief: [IDEA.md](IDEA.md).

**Current state:** execution documentation prepared; application and live integration are not implemented. FMD produces the guide and task ledger. A coding agent executes that plan.

Start with [the docs index](docs/index.md), [the implementation plan](docs/implementation-plan.md) and [AGENTS.md](AGENTS.md). Routine scope/stack/auth/recovery choices are selected; no repeated product intake is needed. [Research](docs/research.md) records public-source checks and remaining live dependencies.

The selected stack is Next.js/TypeScript/Tailwind, PostgreSQL/Drizzle and a private Node worker with a direct tool-calling model SDK. Runtime and dependency pins live in [system design](docs/system-design.md). The first build milestone proves one signed Noir authorization can be sponsored/submitted through Velo; UI work follows that proof.

Check the guide now:

```text
python tools/check-docs.py
python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict
```

[Onboarding](docs/onboarding.md) distinguishes available checks from future app commands. [.env.example](.env.example) lists external inputs without supplying keys. [QA](docs/qa-test-plan.md) defines the real Testnet and safety gates; [the pitch kit](docs/pitch-kit.md) defines the demo. No payment success, hackathon eligibility or production readiness is implied by completing this documentation.
