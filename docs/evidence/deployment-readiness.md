# Deployment and runtime readiness audit

Observed 2026-11-07 (Asia/Manila), approximately 23:05–23:18. This is an infrastructure audit and deployment proposal, not a deployed-app or payment acceptance report.

## Scope and source

- Isolated Orca worktree: `deployment-readiness`; branch `slvdrvncntjvr/deployment-readiness`.
- Audited source commit: `5ab900f3f8a8fb5c725b29eb957f877010f0b4d3`.
- Read AGENTS.md, documentation index, implementation plan, decision ledger, system design, data model, onboarding, security, API/QA requirements, package.json, environment variable catalog and ignore rules.
- No canonical documents, root manifests/lockfile, application source, financial journals or existing environment files were changed. No spike secrets or private journals were read. No signing, Git push, login flow or hosted resource creation occurred.
- Deliverables: this report and [the local PostgreSQL template](../../deployment/compose.postgres.yaml). The audit commit is identifiable with `git log -1 --format=%H -- docs/evidence/deployment-readiness.md`; its exact hash is also returned to the coordinator.

## Result

**No functioning AegisPay app is hosted.** The public GitHub repository exists and authenticated GitHub/Vercel access works. Docker Desktop's Linux engine is available; a new isolated PostgreSQL **17.11** instance passed real SQL, password-authenticated TCP and loopback port checks using a registry-verified immutable image. The temporary audit resources were removed afterward.

The shortest path preserving the specified runtime is one **Railway project** with a containerized Next 16 web/API service, a separate always-running private Node worker, and PostgreSQL 17 with persistent storage. This is a proposal supported by official platform documentation, **not account-level Railway access or a tested deployment**. Railway account/project access is missing from the inspected session. Render supplies an equivalent topology if access is made available there first.

## Existing repository and runtime observations

| Check | Actual result |
|---|---|
| `git status --short` before work | Clean |
| `git remote -v` | Public origin `https://github.com/slvdrvncntjvr/AegisPay.git` |
| `gh api user --jq .login` | Exit 0; authenticated as `slvdrvncntjvr` |
| `gh repo view slvdrvncntjvr/AegisPay --json nameWithOwner,visibility,defaultBranchRef,url` | Exit 0; PUBLIC, default branch `main` |
| `gh api repos/slvdrvncntjvr/AegisPay/branches --jq '.[].name'` | Exit 0; `main`, `task/TASK-002-noir-velo-spike` |
| GitHub commit API, main | `0b68c7e84ce9763b84e052db1f02015d8c1dc806` |
| GitHub commit API, TASK-002 branch | `54ef3f0748bc22128367b417b2e11c2b3eccfd50` |
| `node --version` / `.node-version` | Both `24.22.1` |
| `npm --version` | `11.19.1` |
| `Get-Command pnpm` | Absent from PATH; onboarding prescribes `npx --yes pnpm@12.18.0` |
| package.json | Exact `pnpm@12.18.0`, Next `16.4.5`, pg `8.23.1`, Drizzle `0.45.4`; lockfile present |
| Root `compose.yaml`, `compose.yml`, `docker-compose.yml` | All absent; `git ls-files '*compose*'` returned none |
| `src/app`, `src/worker/main.ts`, `src/server/db`, `scripts/demo-smoke.ts` | Absent |
| `node_modules`, `.env.local`, `.env.worker.local`, `.env.spike.local` in this worktree | Absent; existence checked only |
| App scripts | `build` exists as `next build`; `start`, `worker`, `dev`, `db:migrate`, `db:seed` absent |

The plan's TASK-001 scope lists `compose.yaml`, but no such tracked file exists at this source commit. The app is still the pinned SDK harness/spike, without web, DB or worker implementation. No installation, application build, migration, unit/integration/E2E or live-payment test was attempted in this audit. The public repository is not yet the requested real pnpm workspaces monorepo; the separate docs/implementation effort owns that transition. Proposed future `apps/web`, `apps/server`, `packages/agent` and `packages/shared` paths are not assumed to exist by any delivered template.

## Hosting access actually checked

`Get-Command` found `vercel` (CLI **41.4.1**), `gh`, Docker, Node/npm and AWS CLI. Railway, Render, Fly/flyctl, Heroku, DigitalOcean doctl, gcloud, Azure az and psql CLIs were absent. AWS account access was not tested because an additional platform investigation would not shorten the selected path.

Only presence booleans were checked for these environment variable names at process, user and machine scopes; **every result was false**: `RAILWAY_TOKEN`, `RAILWAY_API_TOKEN`, `RENDER_API_KEY`, `VERCEL_TOKEN`, `FLY_API_TOKEN`, `HEROKU_API_KEY`, `DIGITALOCEAN_ACCESS_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN`, `DATABASE_URL`, `ANTHROPIC_API_KEY`. This does not negate keychain/browser authentication: GitHub and Vercel authenticated successfully without those environment variables. No conclusion is drawn about credentials stored in other worktrees.

Common Railway, Render and Fly CLI credential-file locations were checked for existence only and absent. An existing generic `_netrc` and AWS credentials file were not read; their existence proves no Railway/Render permission.

| Provider | Read-only evidence | Access finding |
|---|---|---|
| GitHub | User/repository/branch/commit API reads all exit 0 | Public origin and repository read access confirmed; no remote write attempted |
| Vercel | `vercel whoami`, `vercel project ls`, `vercel teams ls` exit 0 | Account `slvdrvncntjvr`, scope `vincent-s-projects-57de271b` available; project-list first page returned existing projects |
| Vercel AegisPay | `vercel project inspect aegispay --scope vincent-s-projects-57de271b` | **Exit 1**, `There is no project for "aegispay"`; no project under that exact name in that scope |
| Railway | CLI absent, named tokens absent, common local config paths absent | No usable access verified; no authenticated provider API was possible with inspected inputs |
| Render | CLI absent, `RENDER_API_KEY` absent, common local config paths absent | No usable access verified |

Required hosting access is specifically **Railway workspace/project authorization** (account/API token `RAILWAY_API_TOKEN` or an authenticated Railway CLI session; an existing-project token may instead use `RAILWAY_TOKEN`), plus the Railway GitHub app's access to **slvdrvncntjvr/AegisPay**. Project/environment/service IDs and available quota/billing approval must then be observed. The alternative needs **Render workspace authorization / `RENDER_API_KEY`**, GitHub repository authorization and a region with the required services. No secret values should be sent through chat or committed. No interactive login was started. Platform availability documentation does not establish account quota or authorize spend.

## Compatible platform evidence

- **Railway:** persistent container services and private inter-service networking fit the two Node processes. Use Dockerfiles to pin the exact Node version rather than a moving buildpack default. See official [services](https://docs.railway.com/services), [Dockerfiles](https://docs.railway.com/builds/dockerfiles), and [private networking](https://docs.railway.com/networking/private-networking).
- **Railway PostgreSQL:** select and independently verify major 17, use durable volume storage and a private connection. Default template image selection must not silently upgrade the major. No public TCP proxy is needed for colocated services. See [PostgreSQL](https://docs.railway.com/databases/postgresql).
- **Render alternative:** a Docker web service plus one background worker and managed PostgreSQL 17 in the same workspace/region fit. Background workers run continuously without inbound listeners. PostgreSQL creation currently permits major 17. See [background workers](https://render.com/docs/background-workers), [private network](https://render.com/docs/private-network), and [Postgres creation](https://render.com/docs/postgresql-creating-connecting). Restrict external DB access separately; do not assume internal connections disable public access.
- **Vercel:** existing account access is real. Current official docs now describe containerized continuous **Daemons** (beta); it would be inaccurate to claim Vercel has no persistent worker capability. However the standard Next/Functions runtime exposes a major Node selection and automatically updates patches, which fails the task's exact **24.22.1** requirement. Daemon account entitlement, isolated secrets, external PostgreSQL and a fully containerized web alternative were not verified. It is not the shortest validated fit here. See [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) and [Daemons](https://vercel.com/docs/daemons).
- The Sites Cloudflare Workers host is excluded by this task's selected raw-TCP PostgreSQL and persistent Node-process architecture; no placeholder site was deployed as payment-app evidence.

## Local PostgreSQL evidence and usable template

`docker version --format '{{json .}}'` returned both client and server successfully: Docker **27.2.0**, Docker Desktop **4.34.3**, Linux/amd64 engine, context `desktop-linux`. `docker compose version` returned **v2.29.2-desktop.2**. Docker Desktop and its backend were already running; no start, reset, licensing prompt or engine reconfiguration was needed. The earlier absent Linux pipe finding is superseded for this inspection.

An unrelated existing PostgreSQL 16 container was observed. It was not used, restarted or modified. A cached `postgres:17-alpine` image was inspected rather than blindly pulling its mutable tag. The official Docker Hub registry request to `registry-1.docker.io/v2/library/postgres/manifests/sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24` returned HTTP **200** with the same `Docker-Content-Digest`; the short-lived anonymous registry token stayed in process memory and was never printed/stored. `docker image inspect` confirmed the matching RepoDigest; `docker run --rm --pull never --network none postgres@sha256:… postgres --version` returned **17.11**. Official image reference: [library/postgres](https://hub.docker.com/_/postgres).

Delivered `deployment/compose.postgres.yaml` pins that exact digest, uses a named data volume, a loopback-only host port (default **55432**), SCRAM host authentication, required external password and `pg_isready` health check. It is **local DB infrastructure only**, not a cloud provider configuration, migration, application schema or full stack. It contains no credentials or dependency on future source paths. `AEGISPAY_POSTGRES_PASSWORD` and optional `AEGISPAY_POSTGRES_PORT` are local template inputs, not app credentials established by this audit.

Executed with a fresh randomly generated password held only in the PowerShell process and a new project `aegispay-deployment-readiness-audit`:

```text
docker compose --project-name aegispay-deployment-readiness-audit --file deployment/compose.postgres.yaml config --quiet
docker compose --project-name aegispay-deployment-readiness-audit --file deployment/compose.postgres.yaml up -d --wait --wait-timeout 60 --pull never db
docker compose --project-name aegispay-deployment-readiness-audit --file deployment/compose.postgres.yaml exec -T db pg_isready -U aegispay -d aegispay
```

All returned **exit 0**; DB became healthy and reported accepting connections. An `ON_ERROR_STOP=1` psql probe returned `17.11|aegispay`, created a temporary table with `numeric(38,0)` and a positive-amount check in a transaction, inserted/read **300000** with `FOR UPDATE SKIP LOCKED`, then rolled back. A second startup checked a password-authenticated psql connection over TCP (`-h 127.0.0.1`, password inherited internally without printing); `inet_client_addr() IS NOT NULL` returned **true**. A host `TcpClient.Connect('127.0.0.1',55432)` also succeeded. These are DB infrastructure probes, not Drizzle migrations or application race/recovery tests.

Each startup was enclosed in cleanup, using `docker compose … down --volumes` only after confirming the dedicated audit project had no existing containers/volumes. Both cleanups returned exit 0; the audit container, network and freshly created volume were removed and the temporary password environment variable cleared. Subsequent project-label queries returned no audit containers or volumes. Normal development should retain its data volume; do not apply this disposable-audit cleanup to any live payment database.

## Shortest safe implementation and rollout

1. Finish the reviewed payment changes and the canonical monorepo plan, then implement real workspaces and the existing application task DAG. Keep Next **16.4.5**, Node **24.22.1**, pnpm **12.18.0**, PostgreSQL **17**, Drizzle, and exactly one private persistent Node worker. No restructure or Dockerfile referencing future paths was authored here.
2. Use the delivered DB template to unblock local PostgreSQL-backed migrations and independent-connection concurrency/recovery tests. Supply a private local password, run `docker compose -f deployment/compose.postgres.yaml config --quiet`, then `docker compose -f deployment/compose.postgres.yaml up -d --wait db`. A missing cached image may be fetched **by the pinned digest**, not a moving tag. Put the resulting private connection string in the relevant untracked process environments; do not print expanded Compose configuration.
3. Implement and validate the exact install/build/start/worker/migration scripts for the actual resulting workspace names. Build container targets from one reviewed commit and frozen lockfile. Verify an official Node **24.22.1** image exists and pin its digest before writing its `FROM`; this audit did not resolve a Node image digest. Use an explicit build context allowlist or reviewed ignore rules excluding `.env*`, spike journals, Git metadata and unrelated local files. Never pass runtime financial secrets as build arguments or copy them into image layers.
4. After host access and any required spend approval, create/select one Railway project/environment/region. Configure one web container, one worker container (one replica, no sleeping/serverless setting, no public domain), and private durable PostgreSQL **17**. Connect the public GitHub repository, deploy both process images from the same exact commit, and verify installed runtime/version output without printing environment values. Do not select a default database image whose major is unverified.
5. Apply reviewed Drizzle SQL once through a controlled migration job/pre-deploy step with an advisory migration lock; seed only legitimate catalog/configuration. Do not start two concurrent migrators or generate fake purchases. Railway pre-deploy commands have private-network access and block rollout on failure: [official pre-deploy behavior](https://docs.railway.com/deployments/pre-deploy-command). They must be implemented before configuring a command.
6. Keep **web-only** login tokens in the web service. Give only the **worker** `AGENT_SECRET`, `VELO_GAS_API_KEY`, `ANTHROPIC_API_KEY`, `AGENT_MODEL`, `VELO_GAS_BASE_URL`, `ENVELOPE_ENCRYPTION_KEY`. Share only required `DATABASE_URL`, receipt signing key, approved Testnet RPC/passphrase/contracts/public identities, and trusted `APP_ORIGIN`. Use service-scoped variables; a shared environment group must not inject worker credentials into web. Exclude spike owner/merchant secrets and signed XDR from both images and public evidence. Keep default `RUN_TESTNET=0` and reject mainnet.
7. Publish only the web HTTPS domain; set exact `APP_ORIGIN`, secure session cookies and host-aware proxy handling. Implement `/api/health` with only the specified safe `{status:'ok',network:'testnet'}` response. Check DB/schema readiness internally before accepting traffic and use authenticated dependency diagnostics. Railway's deployment health check is a rollout gate, not continuous monitoring: [health checks](https://docs.railway.com/deployments/healthchecks). Use worker DB heartbeats/leases and graceful shutdown; a restart or rollout resumes saved identities and must never sign/submit again after handoff.
8. Run QA's full release gates against the actual built web/worker/Postgres stack, then check the public URL over HTTPS, unauthenticated denial, owner/merchant access, real wallet/model journey and required fresh Testnet evidence. Record both service commit IDs and DB migration/version state. On rollback retain DB/payment identities and encryption-key versions; roll back only to schema-compatible code. A build, public URL alone, or this audit cannot establish paid-resource correctness.

## Outstanding blockers and handoff

- **Host:** no verified Railway workspace/project permission, GitHub app repository authorization, project/environment/service IDs or available quota/spend approval. Render has equivalent missing access. Vercel access alone does not satisfy the exact selected runtime topology.
- **Implementation:** real workspaces, Next app/API, PostgreSQL schema/migrations, private durable worker, start/dev/migration scripts, build artifacts, health/readiness and full release gates are unfinished at the audited commit. Root Compose instructions currently reference a missing artifact; this task supplies a separate allowed local DB template without altering canonical files.
- **Runtime configuration:** this worktree has no deployment `DATABASE_URL` or web/worker environment files. `ANTHROPIC_API_KEY` is absent in the checked environment scopes; model access is unverified. Existing spike Velo/key material elsewhere was deliberately not inspected or copied. Provision service-scoped application credentials through the owner's secret manager once hosts and app exist.
- **Release:** no AegisPay hosting project/domain/deployed URL/build readiness was established, and the public monorepo requirement is still pending. Existing one-operation Noir/Velo evidence does not become a hosted application by changing deployment configuration.

Validation of this audit: local DB probes above passed; `python tools/check-docs.py` returned PASS and `python fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` returned APPROVE (10 task rows). Those are documentation checks, not application tests. Only the two declared deliverable files are changed; the coordinator owns canonical/task-state reconciliation and downstream implementation.
