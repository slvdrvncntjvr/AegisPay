# Stack research and integration findings

**Checked:** 2026-11-07. Preparation findings record public documentation/package inspection; dated follow-ups distinguish actual installation and live evidence. Runtime observed locally: Node 24.22.1; Python 3.12.9. The project initially contained only IDEA.md and the FMD kit and was not a Git repository.

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
| [Railway worker guide](https://docs.railway.com/guides/ai-agent-workers) | Separate API and always-on worker services can share one repository. | Selected host target for required web/worker/PostgreSQL deployment; no claim of a free tier or provisioned deployment. |

Preparation added no customer claims, regulatory conclusions or market numbers. The later supplied handbook establishes official judging weights; see reconciliation below. Market sources in the original idea are not revalidated and are not needed for the build.

## Inspection method and limits

Read public npm metadata over HTTPS without installing packages. Inspect Noir's published tarball as data; execute none of its code. Relevant files: `package.json`, `dist/client.d.ts`, `dist/events.d.ts`, `dist/networks.js`. Record registry integrity in the research artifact. Metadata is an upstream statement, not a supply-chain audit or dependency-install check. Direct registry HTTP access required the environment's network escalation; public metadata reads succeeded.

The web reader could not retrieve several GitHub package paths. The published npm artifact supplied the missing signatures. All selected dependency versions were observed in public registry metadata. At preparation, runtime/peer ranges were checked while installation, compilation and Testnet interoperability were future TASK-001/TASK-002 gates; dated follow-ups below record the actual results.

## Specific live unknowns

Implementation follow-up, 2026-11-07: the exact packages were installed and the runtime import/typecheck/lint gates passed (TASK-001). The November candidate registry's actual Wasm ABI omitted AgentPolicy.owner and was rejected. The October published tuple passed read-only network, Wasm hash, lifecycle ABI, registry-link and native-SAC verification; the selected explicit configuration and public artifacts are in the [ledger](DECISION-LEDGER.md). Distinct disposable Testnet accounts were generated and funded, with their credentials kept local. These observations do not prove any Noir authorization, Velo execution or claim.

1. Historical unknown, now partly resolved: the supplied handbook mandates the verified October 24 tuple. November brief candidates are not mandatory configuration. Organizer-specific Gas approval remains unverified.
2. Whether Velo accepts the prepared Noir invocation and the enabled project sponsors it.
3. How the fee-bump outer transaction maps to the inner authorization in returned RPC/event data.
4. Virtual-device acceptance, authorization nonce behavior, actual owner lifecycle and merchant claim on that deployment.
5. Model account access, latency and actual choice behavior.

These were preparation work items with explicit evidence gates. Subsequent live observations below resolve technical interoperability/hash mapping and the exercised fixture/claim path; complete app/model/hosting gates remain open.

Implementation follow-up: Velo managed custody has a separate first-activation route. Published `updatePolicy` rejects disabled-to-enabled changes when custody is ready; `activateManagedSponsorship` enables only with active linked project contracts. The contract-linking UI requires a registered/synced project. This explains a likely cause of the user screenshot?s generic policy-save error; no authenticated backend error or successful activation was independently observed. Corrected onboarding now follows register ? active escrow link ? managed activation.

Live follow-up, 2026-11-07: fixture setup, one 300000-stroop Noir authorization sponsored via Velo, an actual over-cap contract simulation refusal and a separate 300000-stroop merchant claim passed. The saved inner/outer hashes and event were independently matched; escrow changed 10000000 ? 9700000 and merchant pending 0 ? 300000 ? 0. The RPC omitted the legacy event success flag, requiring the metadata-matching adapter recorded in the ledger. Reports docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794062462560.json and docs/evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794062575156.json describe the same unique operation. One success does not satisfy the complete QA release gates.


## Builder Handbook reconciliation — 2026-11-07

**Provenance:** `Velo x Noir Agentic Payment Hackathon — Builder Handbook.pdf`; updated Nov 5, 2026; SHA256 `ac77495fd5512dc2d62924dbbe9d6fed6b18ea1b64d72a99c010e8a1ba0cd55b`. Read all 13 pages with PyMuPDF (`fitz`) using `sys.stdout.reconfigure(encoding='utf-8')`; computed the supplied file's hash and it matched. The PDF remains local ignored source, not copied into the public repo. This record avoids a broken public link to the ignored file; no public download URL is asserted.

| Pages | Supplied handbook finding | Reconciliation / limit |
|-------|---------------------------|------------------------|
| 1–3 | Six mandatory requirements: agent chooses/requests/makes payment; deployed Noir contracts via SDK; Velo SDK for other app parts; Testnet only; public workspaces monorepo/ordered README; deployed working public website | Context/PRD/system design/task plan now require these; localhost and SDK spike alone are insufficient |
| 1–2 | Registration: Luma plus Google Form by Nov 4 23:59 Philippine time; build Nov 5 through Nov 7 noon | Registration confirmation absent. Submission deadline already passed; no extension supplied; user asks continue without on-time eligibility claim |
| 3–6 | Server-only agent keys, per-app environment files, simulation, integer amounts, optional NFC, compatible Node/Stellar 16 | Existing boundaries retained; virtual device valid; real model access unverified |
| 6–8 | Mandatory October 24 tuple; October 7 IDs retired; authorize credits pending escrow, merchant claim separate | All three IDs exactly match saved artifact, closing mandatory-tuple uncertainty; no custom redeploy |
| 8–9 | Velo examples use checkout/status/signed webhooks and alpha-tag install; agent is where systems meet | Actual pinned 1.0.0 Gas sponsor/submit/status retained; no unrelated checkout, unsupported webhook claim or organizer-specific Gas approval |
| 10–11 | Root package.json must declare workspaces; one root install; folder names flexible; exact ordered README; real source links | TASK-011 before DB slice; README links actual spike sources and marks future folders; no manifests changed here |
| 11 | Two-minute video, public deck, short write-up, names/Discord/registration, live website, Testnet proof; form https://forms.gle/hQ73PnsR1w2YwAq57 | Draft sources prepared; app/video/deck URLs and Discord/registration missing; reported form max five minutes does not relax stricter two-minute target |
| 11–12 | Rubric agentic 30%, technical 25%, innovation 20%, real-world 15%, pitch/demo 10%; five-minute pitch plus three-minute Q&A | Pitch kit/eight-slide draft mapped without unsupported product claims |
| 12–13 | Testnet only, protect keys, credit reused code, English/Filipino, Discord help/community links | Existing safety scope/credits retained; no messages or forms sent |

Mandatory IDs: device `CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5`, agent `CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV`, escrow `CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS`. These match the [latest report](evidence/testnet/spike-c080d947-714b-43cf-92d0-ad9ed7c01439-1794062575156.json), independently recording network/ABI/Wasm/links/SAC and one actual authorization. This closes tuple identification, not every eligibility issue or full behavioral audit. October 7 retired IDs and incompatible November brief candidates are different sets.

Public delivery is configured at https://github.com/slvdrvncntjvr/AegisPay with origin and pushed main/TASK-002 branches. No new push, hosting or code test occurred here. TASK-002 remains in_progress: review identified terminal-envelope cleanup recovery and fee-source reconciliation fixes. Historical 41 offline / 42 opt-in passes predate repairs. Do not use the artifact fee field as a resolved fee-source claim before the fix gate. Real workspace/app/model/DB/UI/deployment and public video/deck completion remain absent.
