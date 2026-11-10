# Authenticated Render and exact-project Vercel prerequisite check

Observed **2026-11-10, 07:29–07:33 UTC**. Orca task `task_16356808693b`, dispatch `ctx_5d133f72d7ee`; local source HEAD observed as `6765edb`. User reported Render access ready and authorized this bounded prerequisite pass. **Render authentication and workspace ADMIN access are now verified; hosted application readiness is not.** Historical missing-key findings remain valid for their dates and are superseded only as described below.

Evidence: [redacted authenticated observations](authenticated-host-access-2026-11-10.json), [GET-only probe](render-authenticated-access-2026-11-10.py). The helper reads only `RENDER_API_KEY` from the existing `.env.deploy.local` for Render and existing local Vercel CLI auth for the exact AegisPay project. It uses no redirects/retries, bounded response sizes and explicit GET targets, persists only allowlisted fields, and never emits keys, headers, raw account responses, environment values, DB URLs or automation-bypass secrets.

## Verified Render prerequisites

| Check | Actual result | Limit |
|---|---|---|
| Local credential | `.env.deploy.local` exists; `RENDER_API_KEY` populated | Value not emitted or copied |
| Authenticated identity | GET `/v1/users` HTTP200; Salvador Vincent Javier, user `usr-cu...ctog` | Email excluded |
| Workspace selection | GET `/v1/owners?limit=20` HTTP200; **one** accessible workspace, **My Workspace**, `tea-cu...ctmg`, type `team` | No unrelated workspace was explored |
| Workspace read | GET `/v1/owners/{selectedId}` HTTP200 | Returned only `id`, `name`, `email`, `type`; plan/billing fields absent |
| Role | GET `/v1/owners/{selectedId}/members` HTTP200; matched authenticated caller is **ADMIN**, **active** | Only caller role/status retained; other membership data excluded |
| Existing services | Workspace-filtered GET `/v1/services?ownerId={selectedId}&limit=100` HTTP200; **five** services, all **Free web services**, all **suspended**, all **Singapore** | Names/status/redacted IDs retained; no service detail, logs, environment, repo or suspension changes requested |
| Existing PostgreSQL | Workspace-filtered GET `/v1/postgres?ownerId={selectedId}&limit=100` HTTP200; **zero records** | No connection-info endpoint, DB connection or resource creation |
| Free DB occupancy | No existing PostgreSQL instance occupies the workspace's single active Free slot | Creation-time account verification or other restrictions not tested |
| Actual DB expiry | Not applicable to the empty inventory; no existing expiry to report | No new DB creation date or expiry invented |

Both resource lists fit within their requested limits. No existing service was named AegisPay or the planned AegisPay worker. These observations do not authorize repurposing, deleting or resuming the workspace's existing services.

The fetched **official current OpenAPI schema** defines all six Render GET paths used above; its SHA256 is `569ee51f78fd5991732e98552bf60d3d9f5fe16947f70b9cccdb42fa216253b0`. The authenticated role establishes normal workspace administrative capability. No POST/PATCH was made to prove actual service or database creation. [Render API schema](https://api-docs.render.com/openapi/render-public-api-1.json), [workspace role permissions](https://render.com/docs/team-members).

## Capacity, quota and billing: exposed facts versus unknowns

**Inventory-based finding:** the workspace currently has no PostgreSQL instance, so there is no observed existing Free PostgreSQL resource consuming its single active slot. Free database provisioning remains conditional on the account's actual creation checks and later authorized resource creation; this pass does not prove provisioning will succeed.

**Not exposed by these supported account reads:** workspace billing plan, payment-method/verification state, remaining monthly Free instance-hours, pipeline minutes, bandwidth allowance or spend limit. No account billing/free-hours quota GET endpoint was found in the inspected public schema. The returned `RateLimit-Limit: 400` and remaining398–399 values are **API request-rate counters**, not hosting hours or Free resource capacity. Five suspended services do not establish why they were suspended or how much monthly allowance remains. No billing portal, unrelated account or unsupported internal endpoint was inspected.

Official Free behavior remains: one active Free PostgreSQL instance/workspace; 1GB storage; expiry30 days after creation and deletion after the subsequent14-day upgrade grace period. Free web services share750 instance-hours/workspace/month, sleep after15 idle minutes and take roughly a minute to wake. Filesystem changes are ephemeral. Bandwidth/build overages can bill if a payment method is available; without it they can suspend service or stop builds. Free background/private workers are unavailable. These published limits do not establish this account's remaining usage or creation exemption. [Render Free documentation, checked in this pass](https://render.com/docs/free).

For a later authorized deployment, record the actual new PostgreSQL `createdAt` and `expiresAt` fields; do not assign expiry from this preflight date. Preserve the selected Node web/API + authenticated isolated worker + SQL architecture and explicit Free selections. No paid account/compute change was performed or proposed.

## One bounded read of the exact Vercel project

Using existing CLI auth, **exactly one** GET `/v9/projects/prj_87hFYLDrQpbUsSlAgoFMsTIE7aTq` with its existing scope returned HTTP200. The response was filtered in memory; no environment listing, deploy hook, bypass token or whole account/project enumeration was requested. [Official exact-project endpoint](https://vercel.com/docs/rest-api/projects/find-a-project-by-id-or-name).

| Exact project field | Current observed value |
|---|---|
| Project | `aegispay-live`, ID `prj_87...7aTq` |
| `link` | **Absent** from returned project; no linked Git repository object reported |
| Linked provider/org/repo/production branch | Unavailable because `link` is absent; no branch inferred as `main` |
| Top-level `productionBranch` | Absent |
| `gitProviderOptions.createDeployments` | `disabled` |
| `gitProviderOptions.disableRepositoryDispatchEvents` | `true` |
| `gitDeploymentEnabled` | Absent; no explicit boolean value asserted |
| Ignore-build command | Not configured |
| Automatic custom-domain assignment | `true` |
| Root / Node family / outside-root source | `apps/web` / `24.x` / `true` |

**Push implication:** this exact project currently reports no built-in Git repository link or production branch. That materially narrows the earlier uncertainty, but the two `gitProviderOptions` fields alone are not treated as proof that all deployment automation is disabled. No external CI, repository hook or other Vercel project was inspected; a future source push is not certified globally incapable of triggering a deploy. Existing automatic domain assignment also means a separately triggered production deployment may affect aliases. Coordinator owns any Git push/deployment decision; this pass changed neither source nor host settings. [Vercel Git deployment behavior](https://vercel.com/docs/git).

## What remains before hosting

- **Access blocker removed:** usable `RENDER_API_KEY`, one selected accessible workspace and active ADMIN membership are verified. Do not ask the user to paste the key or reconnect it again.
- **Account limits still unverified:** actual remaining monthly quota, billing/payment-method/verification state and whether Free creation is accepted. No service/database was created to test them.
- **Hosted resources still absent:** no AegisPay worker or PostgreSQL instance was observed. A later authorized dispatch must create only the approved Free resources, record actual region/expiry and apply separated host configuration; this prerequisite pass uploads no secrets.
- **Application gates unchanged:** TASK-012 remains blocked on its existing upstream release requirements. No payment, queue, Gas-provider observation, DB connection/mutation, migration, signing, deploy, account signup/payment or source push occurred. Existing unknown payment, held budget, nonce history, site alias and submitted PDF path were untouched.

`python docs/evidence/finals-preflight/render-authenticated-access-2026-11-10.py` completed exit0. All seven authenticated provider GETs returned200 (six Render plus one Vercel); the separate public schema GET also returned200. Initial documentation-discovery attempts at two guessed reference-page slugs were inaccessible, and a default-User-Agent schema fetch returned403; the official documentation index and schema link supplied the supported paths, and the final declared-Agent/Accept schema fetch succeeded. Those public-document reads contained no credentials. This report establishes account access prerequisites only, not an application test or release pass.

Validation at **07:36 UTC**: both documentation commands passed (21 canonical Markdown files; 16 valid task rows); local report links resolved; four new/updated artifacts had **zero Render/Vercel credential-value matches** and **zero unredacted Render identity/resource IDs**. [Hygiene and documentation results](authenticated-access-2026-11-10-checks.json). No application or release test was run.
