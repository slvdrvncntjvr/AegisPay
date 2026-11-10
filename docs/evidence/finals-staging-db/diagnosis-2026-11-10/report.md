# Read-only Free PostgreSQL request diagnosis — 2026-11-10

**Diagnosis complete; no new provisioning attempt.** Render's official MCP implementation explicitly refuses a positive custom disk size when the plan is Free, including the previously submitted `diskSizeGB: 1`. This supplies primary-source support for removing that field from a future request. The original API HTTP400 response message remains unavailable, so this does **not** prove its exact cause or guarantee a corrected request will succeed. No database or TASK-018 completion is claimed.

This dispatch used existing safe evidence plus public primary documentation/source only. It made no authenticated account request, provider mutation, environment/credential read, database/worker access, Git mutation or application edit. The original helper, manifest, report, one-shot receipt and every prior observation remain byte-identical; [preservation baseline](preserved-artifacts.json) and [checks](checks.json) cover all13 original files.

## What the sources establish

The key evidence is Render's official MCP source at revision `db8e54d13e462d7379f568e9129e25f9953f20b1`. Its `create_postgres` handler, lines182–185, checks Free plus disk size greater than zero and returns: **“Free plan does not support custom disk size.”** Therefore, an explicit1 fails that client guard. This is verified public client behavior, not recovered server-response evidence. The tool parameter is named `diskSizeGb`, which is mapped to the REST field `DiskSizeGB`; the rejected manifest used JSON `diskSizeGB`. [Pinned official source](https://github.com/render-oss/render-mcp-server/blob/db8e54d13e462d7379f568e9129e25f9953f20b1/pkg/postgres/tools.go#L174-L185).

The current OpenAPI create body lists `name`, `ownerId`, `plan`, and `version` as required. `region` is optional but remains explicit Singapore. `free`, `17`, and `singapore` appear in their respective enums. The optional integer `diskSizeGB` has no encoded Free-specific conditional; its existence cannot establish that setting1 is accepted for Free. The freshly fetched441718-byte schema retains SHA256 `569ee51f78fd5991732e98552bf60d3d9f5fe16947f70b9cccdb42fa216253b0`. [Official API schema](https://api-docs.render.com/openapi/render-public-api-1.json), [create endpoint reference](https://api-docs.render.com/reference/create-postgres).

Render's current official CLI independently supports a minimal request: its Free `minimalInput()` includes only required fields, and `TestBuildCreateRequest_OmitsOptionalsWhenUnset` expects disk size, autoscaling, HA, pooling and replicas to be nil. Empty replica names become nil. Its generic disk validator accepts1 without inspecting the plan; that weaker numeric validation does not disprove the MCP's plan-specific restriction. [Free minimal input and optional-field tests](https://github.com/render-oss/cli/blob/f672d747f0a6496ed08e90338a6605efb00cd79f/pkg/postgres/create_test.go#L124-L140), [generic size validation](https://github.com/render-oss/cli/blob/f672d747f0a6496ed08e90338a6605efb00cd79f/pkg/types/postgres/create.go#L49-L62), [empty replica conversion](https://github.com/render-oss/cli/blob/f672d747f0a6496ed08e90338a6605efb00cd79f/pkg/postgres/request.go#L9-L19).

| Previously submitted optional field | Evidence-supported interpretation | Separate proposal |
|---|---|---|
| `diskSizeGB: 1` | Official MCP rejects any positive explicit size with Free; Free storage is provider-fixed1GB | Omit; strongest supported correction |
| `enableDiskAutoscaling: false` | API default is false; presence of false is not proved invalid | Omit and later require actual false |
| `enableHighAvailability: false` | API default is false; presence of false is not proved invalid | Omit and later require actual false |
| `connectionPool: "none"` | API default is none; explicit none is not proved invalid | Omit and later require actual none |
| `readReplicas: []` | CLI constructs nil for empty input; empty-list presence is not proved invalid | Omit and later require zero replicas |

The Blueprint reference confirms provider-fixed1GB for Free and new-database defaults of disabled storage autoscaling and no connection pool. Its warnings about fixed-size legacy plans do not, alone, classify Free as legacy. The omitted-field proposal does not depend on that inference. [Blueprint storage/default semantics](https://render.com/docs/blueprint-spec).

Enabling the omitted features remains prohibited: managed pooling is unavailable on Free; HA requires at least1CPU; replicas require at least10GB and0.5CPU. The submitted false/none/empty values did not enable those features, and this review found no primary evidence that their mere presence caused the original400. [Pooling restrictions](https://render.com/docs/postgresql-connection-pooling), [HA prerequisites](https://render.com/docs/postgresql-high-availability), [replica prerequisites](https://render.com/docs/postgresql-read-replicas).

## Account prerequisites and limits of this diagnosis

The earlier authenticated observations established the sole intended workspace, active ADMIN membership and zero PostgreSQL instances before and after the rejected call. That rules out an observed occupied Free slot **at those timestamps**, not later changes or hidden account restrictions. This diagnosis did not re-read account state. [Earlier post-result inventory](../observation-20261110T110853800186Z.json).

Official Free documentation requires at most one active Free PostgreSQL database per workspace, fixes storage at1GB and describes expiry30days after actual creation, followed by14days before deletion. Those published limits do not reveal this account's verification/payment state or capacity. No primary source reviewed establishes a mandatory payment-method requirement for this specific failed request; no billing/verification/capacity failure is inferred from HTTP400. Finals date remains TBA, and actual expiry is still not applicable because no database exists in the recorded inventory. [Render Free documentation](https://render.com/docs/free).

The creation guide supports PostgreSQL13–18 for new instances, including17. Region enum support establishes that Singapore is a valid selection, not that Free capacity is currently available there. No alternate region, paid plan, resource deletion, new signup or payment-method flow was inspected or proposed. [Creation guide](https://render.com/docs/postgresql-creating-connecting).

## Concrete future request and safe error handling

The separate [minimal proposal](../../../../deployment/finals/staging-db/future-minimal-request-2026-11-10.json) has four public request fields plus privately bound `ownerId`:

```json
{
  "name": "aegispay-finals-staging",
  "plan": "free",
  "version": "17",
  "region": "singapore"
}
```

It removes custom disk size and all unnecessary feature fields. It is explicitly unexecuted, does not feed the original helper and grants zero attempts in this dispatch. The original [create receipt](../create-attempt.json) remains exhausted. Any future mutation needs a separate coordinator-authorized scope, current identity/inventory/schema checks and its own durable attempt identity while preserving the original400 history. There is no reset/retry workaround in this deliverable.

The new pure [error classifier](../../../../deployment/finals/staging-db/future_error_classifier.py) prepares a future caller to classify a bounded in-memory error before discarding it. It accepts at most16KiB, inspects only shallow message locations, and emits fixed local codes/signals for billing/verification, capacity, Free quota, custom Free disk size, storage validation, access and rate limits. It never returns provider message/code strings or connection/credential values; unknown reasons remain unknown. Every result requires a stop and forbids automatic retry. This module has no network, environment, file-write or provisioning path and has not been wired into the preserved helper.

Its8 passing **offline synthetic** checks cover the custom-Free-disk message, billing priority, verification, capacity versus slot limits, unknown400, value/code redaction, unrelated-field exclusion and oversized/malformed bodies. They do not reproduce the original error, prove server behavior or create a database. [Classifier tests](../../../../deployment/finals/staging-db/test_future_error_classifier.py).

## Reproduction and validation

The public-only [collector](../../../../deployment/finals/staging-db/diagnose-readonly-2026-11-10.py) saved [source hashes and derived checks](public-source-review.json):13 bounded unauthenticated GETs, no redirects/retries,20-second per-request timeout,4MB schema/2MB other-public-source limits, no raw bodies saved. Its output is exclusive-create so rerunning refuses to overwrite this evidence. Separate exploratory public-document reads supplied the linked sources; no account API was contacted during discovery.

```text
python -B deployment/finals/staging-db/test_future_error_classifier.py
python -B deployment/finals/staging-db/check-diagnosis-2026-11-10.py
```

[checks.json](checks.json) records the offline tests, Python parsing, local-link checks, original-artifact SHA256 preservation, static secret/DSN/raw-ID pattern scan and both documentation gates. No private environment was read for this follow-up scan, and it does not claim a known-secret-value scan against credential files. No TLS, SQL, migration, seed, app deployment, worker startup, live purchase or TASK-018 release acceptance occurred.

**Handoff:** use the minimal proposal as a supported correction for a separately authorized attempt, with omission of custom disk size as the concrete finding. Keep the original API failure's exact cause unknown. The account's actual Free provisioning acceptance and the empty hosted DB prerequisite remain unresolved.
