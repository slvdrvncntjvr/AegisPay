# Stack research and integration findings

**Checked:** 2026-11-07. This records public documentation and package inspection, not a successful live integration. Runtime observed locally: Node 24.22.1; Python 3.12.9. The project initially contained only IDEA.md and the FMD kit and was not a Git repository.

## Research result

Use a Next.js Node application, PostgreSQL/Drizzle and one private worker. Keep the model SDK direct and the merchant fixtures local. This is an engineering choice to reduce setup and deployment boundaries. The selected stack and exact pins are owned by [system design](system-design.md); downloaded metadata and integrity values are in [package-research.json](evidence/package-research.json).

## Primary-source findings

| Source | Observed finding | Decision / remaining verification |
|--------|------------------|-----------------------------------|
| [Published Noir 0.3.0 metadata](https://registry.npmjs.org/@noirx402/agent-sdk/0.3.0) and its npm tarball | Peer requires Stellar SDK `^16.0.1`; Node engine accepts local 24.22.1. Published declarations contain `NoirOperation` with `kind: 'authorize'`, explicit `nonce`, and `prepare(source, op): Promise<string>`. | Use Stellar 16.4.1, not registry latest 17.4.0. Source support exists; composition still needs Testnet proof. |
| Same Noir tarball, `dist/events.d.ts` and `dist/networks.js` | Authorization event includes device, merchant and amount, but no asset or agent. Embedded Testnet IDs match the public October deployment, not the brief's November IDs. | Decode transaction invocation as well as event; explicitly configure all contracts after live verification. |
| [Velo SDK documentation](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md) | Supports Testnet signed Soroban sponsorship, separate submission and identity-only recovery; an intermediate response is insufficient evidence. | Persist reservation before handoff. Live eligibility, relayer and contract allowlist remain unchecked. |
| [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) | App Router offers a single UI/API codebase and supports this runtime. | Use Node handlers and plain polling; no Edge runtime. |
| [Drizzle transactions](https://orm.drizzle.team/docs/transactions) | Database transactions and PostgreSQL isolation controls are available. | Put unique constraints and budget reservation in PostgreSQL. |
| [PostgreSQL 17 SELECT](https://www.postgresql.org/docs/17/sql-select.html) | Locking reads support `FOR UPDATE` and `SKIP LOCKED`. | Small DB-backed worker queue; Redis adds no required MVP capability. This queue design is our inference. |
| [Claude tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview) and [model catalog](https://platform.claude.com/docs/en/models/overview) | The API supports client-executed tools; the catalog lists `claude-haiku-5-5`. | Default to that model through an environment setting. Key/account access and actual demo behavior require a smoke run. |
| [Freighter signing](https://docs.freighter.app/extension-freighter-api/signing.md) | Browser wallet signs transaction XDR and returns signed XDR with a signer address. | Owner/merchant keys remain in their wallet; server verifies the prepared transaction on return. |
| [Stellar getTransaction](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransaction) | Transaction evidence can be queried independently; RPC history is bounded. | Archive verified redacted evidence promptly; unavailable history is manual review, never inferred success. |
| [Railway worker guide](https://docs.railway.com/guides/ai-agent-workers) | Separate API and always-on worker services can share one repository. | One optional host for web, worker and PostgreSQL; no claim of a free tier or provisioned deployment. |

No customer claims, regulatory conclusions, market numbers or official judging weights were added. Market sources in the original idea are not revalidated and are not needed for the build.

## Inspection method and limits

Read public npm metadata over HTTPS without installing packages. Inspect Noir's published tarball as data; execute none of its code. Relevant files: `package.json`, `dist/client.d.ts`, `dist/events.d.ts`, `dist/networks.js`. Record registry integrity in the research artifact. Metadata is an upstream statement, not a supply-chain audit or dependency-install check. Direct registry HTTP access required the environment's network escalation; public metadata reads succeeded.

The web reader could not retrieve several GitHub package paths. The published npm artifact supplied the missing signatures. All selected dependency versions were observed in public registry metadata. Runtime and peer ranges have been checked, but installation, TypeScript compilation and Testnet interoperability are still TASK-001/TASK-002 gates.

## Specific live unknowns

1. Which organizer deployment is mandatory and live, and whether Gas Station qualifies for this hackathon. The November IDs in IDEA.md are candidates, not verified config.
2. Whether Velo accepts the prepared Noir invocation and the enabled project sponsors it.
3. How the fee-bump outer transaction maps to the inner authorization in returned RPC/event data.
4. Virtual-device acceptance, authorization nonce behavior, actual owner lifecycle and merchant claim on that deployment.
5. Model account access, latency and actual choice behavior.

These are work items with explicit evidence gates, not unanswered routine product questions. No successful payment, deployment, registration or contract read is claimed in this documentation handoff.
