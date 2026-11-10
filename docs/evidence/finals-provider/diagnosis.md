# Velo Gas reservation recovery investigation

Observed **2026-11-10, approximately 05:50–05:56 UTC** under Orca dispatch `ctx_d51512897f34`. This is a read-only source/documentation investigation. **The original payment remains unresolved; no authoritative terminal status or outer transaction hash was obtained.** No signing, sponsorship, reserve/submit/retry/cancel/fund operation, provider configuration change, DB query, queue consumer, support contact or deployment was performed. This worker made **zero Gas status calls**, avoiding duplication of backend's existing identity-only observation.

## Saved identity and evidence boundary

The following are safe saved identifiers, not fresh provider/chain observations:

| Field | Saved value |
|---|---|
| Network | Stellar Testnet |
| Velo API origin | `https://www.velo-build.dev` |
| Velo request / reservation ID | `3ef113f6-0bb4-449a-ac6a-29407adb4ee5` |
| Inner transaction hash | `36f71d7ddee16271b6c23e73fa5ef1f1ca4f0e44e3d0a52ef6eca2115f80d0f8` |
| Outer transaction hash | Unknown / null in saved evidence |
| Application attempt | `f69178b7-0b0b-46fa-8e82-65c2dd5deee5` |
| Operation | `3ced1846-a7cd-4455-bb27-0b21a253f2c3` |
| Quote | `2919ccca-2d31-4bc4-9140-649c8b1fc0ae` |
| Persisted handoff | `2026-11-09T09:36:16.026075Z` |
| Application nonce | `1` |
| Held amount / application spent / entitlements | `300000` stroops / `0` / `0` |

Backend's [05:33 UTC identity-only observation](../finals-payment/actual-identity-only-observation-1794288823393.json) records Velo HTTP409, inner RPC `NOT_FOUND`, saved last Velo DTO status `claimed`, and no entitlement. `claimed` in the persisted row is the last validated DTO, **not a successful DTO returned by that later 409**. The saved snapshot is not a current DB query by this worker. Its balances and elapsed time cannot establish failure. Earlier [Nov 9 status observation](../finals-payment/actual-velo-status-1794217433978.json) also contains HTTP409 and no stable provider error code. Source: [backend task evidence](../finals-payment/task-005.md).

## What the installed pinned SDK proves

Installed `@carts1024/velo-sdk` is exactly **1.0.0**. Read `README.md`, `CHANGELOG.md`, `dist/gas.js`, `dist/errors.js`, `dist/http.js`, and `dist/gas.d.ts`; file hashes are in [local-sdk-provenance.json](local-sdk-provenance.json). No package installation, upgrade or execution of a financial SDK method occurred.

| Method / result | Pinned implementation | Consequence |
|---|---|---|
| `gas.sponsor` | POST `/api/gas/sponsor`, signed input and stable idempotency key | Reserves fee exposure; separate from submission. Prohibited in this recovery investigation |
| `gas.submit` | POST `/api/gas/submit`, identity plus signed input; transport retries forcibly zero | Financial handoff; never repeat for this unresolved attempt |
| `gas.getStatus` | POST `/api/gas/submit`, body containing **only** `requestId` and `transactionHash`; `submission:false`, retries forcibly zero | Published identity-only recovery path; neither GET nor a separate guessed `/status` endpoint |
| `gas.waitForResult` | Bounded repeated `getStatus`; terminal statuses are `succeeded`, `failed`, `cancelled` | No authorization to keep polling forever; 409 validation errors terminate this observer |
| `claimed`, `submission_unknown`, `submitted` | Valid running DTO states | Unresolved; none permits entitlement |
| HTTP409 | `mapErrorResponse` maps it to `VeloValidationError`; allowlisted stable `code`, `requestId`, `param` and retry hint may survive | It is an error response, not a `gas_submit_result` and not definitive transaction failure |
| DTO identity validation | Returned request ID and inner hash must exactly match input; outer hash is a distinct nullable field | Preserve inner/outer distinction and independently verify the matching chain evidence |

SDK status parsing also validates the object discriminator, decimal fee strings, expiry and reconciliation boolean. A null actual fee is unknown, not zero. The SDK's published `GasApi` contains only sponsor, submit, status, bounded wait and composed sponsor-and-submit; **no project list, owner-console read or operator reconciliation method exists in the installed API**. Local wait expiry/cancellation does not cancel or expire a backend transaction. [Official SDK recovery documentation](https://github.com/Velo-Ecosystem-Collection/Velo/blob/main/packages/velo-sdk/README.md).

## Official primary source: concrete branches, deployment compatibility unverified

Public GitHub API returned official repository main commit **`c63b3308ad69d2c5a919f94052571a38a2188121`**, with a complete non-truncated source tree. The repository identifies `velo-build.dev` as its site. Targeted raw-file GETs succeeded even though the web tool's GitHub `/raw/refs/...` request was restricted. [Primary-source index](primary-source-index.json) records exact immutable URLs, SHA256, line counts and semantic line references; [inspect-primary.py](inspect-primary.py) can reproduce this public read-only inspection.

**This public commit was not verified as the server version deployed at the Nov 9 handoff or today.** Source behavior below is diagnostic evidence about that commit, not proof of this reservation's actual internal record. Do not upgrade the SDK or rewrite recovery based on an assumed version match.

- `gas-route-handlers.ts`, lines675–713, maps valid running execution DTOs to HTTP202 and terminal DTOs to HTTP200. In its **submit/status** result mapper, `reservation_expired` and `invalid_lifecycle` map to HTTP409; `handoff_unavailable` maps to HTTP503. Other 409 occurrences belong to sponsorship/rejection mappings and must not be attributed to this status request without the stable code. [Immutable route mapper](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/apps/web/core/api/gas-route-handlers.ts#L675).
- `public_api.ts`, lines392–458, authorizes the Gas-scoped key, then routes requests with signed input to execution and requests **without** it to `internal.gas.submit.submit`. No-XDR status therefore cannot dispatch a new transaction through this branch. [Immutable public action](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/public_api.ts#L392).
- `submit.ts`, lines194–220, returns an existing matching execution projection, maps an already expired attempt to `reservation_expired`, and may expire a `claimed` attempt only when reservation time has passed, `sendCount===0`, and its execution lease is expired/cleared. Hash mismatch returns `invalid_lifecycle`. This is an **internal mutation**, so the documented no-XDR status call is read-oriented recovery, not a guarantee of zero provider bookkeeping changes. This worker did not invoke it. [Immutable status backend](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/submit.ts#L194).
- `reconciliation.ts`, lines637–656, parks unresolved reconciliation at its deadline with `reconciliationRequired:true`; that code does not turn missing chain evidence into terminal failure. Operator reconciliation is implemented through **internal actions/mutations**, not a public read-only REST query. It is outside this dispatch and was not called. [Immutable reconciliation branch](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/reconciliation.ts#L637), [internal operator action](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/reconciliation_action.ts#L289).

## Existing project-scoped read path

Official source supplies a **pure query** `api.gas.queries.getExecutionDetail({ projectId, requestId })`. `queries.ts`, lines425–443, requires project read access, normalizes the request ID, finds only that project's retained execution and returns the same sanitized execution DTO or null. It does not expose raw attempt/custody fields. `authorization.ts` sets minimum read role to **viewer**. `gas-activity.tsx`, lines628–631, consumes that query in the activity detail view. [Exact query](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/queries.ts#L424), [access roles](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/packages/backend/convex/gas/authorization.ts#L11), [dashboard detail consumer](https://github.com/Velo-Ecosystem-Collection/Velo/blob/c63b3308ad69d2c5a919f94052571a38a2188121/apps/web/features/projects/gas-activity.tsx#L628).

The project Gas page exists at `/projects/<projectId>/gas`; Activity can show the retained request detail. A related project-scoped `listLogsPage` read is paginated, but no whole-project/account export is needed here. Use the exact request detail first. These are authenticated Convex console queries, **not newly discovered public REST endpoints**; a Gas API key is not established as authentication for these console roles. A null projection is not evidence of nonexecution.

Current availability: `VELO_GAS_API_KEY` and `VELO_GAS_BASE_URL` are present in the existing worker/spike files; the configured origin matches the published Gas origin. Only presence booleans were recorded, never values. No Velo connector appeared in available-tool metadata. Scoped `orca tab list --json` returned an empty tabs array; no reusable authenticated Velo console session was established in this workspace. Sessions in other applications/workspaces are unverified and were not searched. No login, wallet challenge/signature, cookie/token extraction or unrelated project access was attempted.

**Specific blocker:** the already authorized Gas key and known reservation identity have not yielded an authoritative DTO in backend's bounded read; the available evidence collapses the conflict to HTTP409 and omits the stable code. A project-member console session or provider operator with access to the same request can read the retained detail and supply the missing execution/audit fields. This is not a missing signing-key problem and does not justify credential replacement or another handoff.

## Diagnosis versus hypotheses

| Assessment | Evidence / limit |
|---|---|
| Confirmed | Saved state is unknown/unentitled with one original handoff; repeated backend identity reads report409. SDK and official docs preserve that uncertainty |
| Confirmed source capability | Official source has a sanitized, project-scoped execution-detail query and concrete status-conflict branches |
| Hypothesis: expired unsent provider attempt | The inspected source can return409 for that branch, but the observed error code, provider send count, lease fence and deployed version are unavailable |
| Hypothesis: invalid lifecycle or identity conflict | Also a409 source branch; no stable error code or matching provider row proves it applies |
| Hypothesis: provider worker/reconciliation/version problem | Requires operator records/version; public source does not prove a stuck worker, a server bug or a version mismatch |
| Unsupported | Treating HTTP409, `NOT_FOUND`, zero pending balance, stale `claimed`, quote/reservation expiry or elapsed observation time as definitive failure |

The operator request is prepared in [operator-request.md](operator-request.md). It was **not sent**. Backend retains sole ownership of configuration, original-identity observation, independent chain verification and any separately authorized audited resolution. No app source or state was changed; submitted website/PDF remain unchanged. The earlier local Docker/DB-unavailable snapshot is superseded by coordinator's backend-startup and 66 PostgreSQL-test checkpoint; no DB check was performed here.

Validation at **05:57 UTC**: both documentation commands exited0 (21 canonical Markdown files; 16 valid task rows), all local report links resolved, and known private values had zero matches in five investigation artifacts. [Verification](verification.json). These checks establish report hygiene only; they do not resolve the payment or pass an application/release gate.
