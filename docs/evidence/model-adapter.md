# Gemini AI Studio adapter evidence

Observed 2026-11-08, based on `f75b63f`, work ref `slvdrvncntjvr/gemini-adapter`.
Scope: `src/server/integrations/model.ts`, `tests/unit/model.test.ts`,
`scripts/model-smoke.ts`, and this evidence file. No manifest, lockfile, application
loop, payment artifact, submitted filename or submitted URL was changed.

## Official API verification

The requested [GenerateContent reference](https://ai.google.dev/api/generate-content),
[function calling guide](https://ai.google.dev/gemini-api/docs/function-calling), and
[models reference](https://ai.google.dev/api/models) were fetched. Some current guide
URLs redirect to AI Studio documentation emphasizing the newer Interactions API.
The implementation deliberately uses the requested native Node `fetch` REST
`v1beta/models/{name}:generateContent`, without an SDK dependency.

The current official [Google v1beta REST discovery document](https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta)
independently confirms the actual GenerateContent request, Content/Part,
FunctionCall/FunctionResponse, FunctionCallingConfig, Candidate and ListModels
schemas. Specifically: `parametersJsonSchema` supports closed object schemas;
`functionCall.id` must match `functionResponse.id` when present; `thoughtSignature`
is opaque state attached to the original part; and `allowedFunctionNames` belongs
to ANY/VALIDATED modes. This adapter uses AUTO normally, ANY for the first smoke
step, and NONE with no tools. It requests one candidate, temperature zero,
4096 output tokens and no thought summaries. The current reference says newer
models may ignore temperature; the smoke therefore asserts the exact call and
roundtrip marker rather than promising bitwise deterministic model behavior.

Authenticated model discovery is GET `/v1beta/models?pageSize=100`, followed by
encoded `pageToken` values, at most ten pages/1000 entries. Returned identifiers
must advertise `generateContent`. No model ID is assumed or hardcoded. A listing
does not establish generation quota, free access, function-calling compatibility,
or successful model execution.

## Consumer contract

`createGeminiClient({ apiKey?, model?, fetch?, functionCallingMode? })` reads missing
options from worker-only `GEMINI_API_KEY` and `AGENT_MODEL` inside the factory.
Importing the module does not require configuration. Native Node imports and a
runtime browser guard keep this worker integration outside client use.

`client.generateStep(contents, tools, signal?)` accepts bounded validated history
and an exact subset of `GEMINI_TOOLS`. It first checks the configured model against
authenticated discovery, caching that observation for this client. It returns
`{ text, calls, providerContent }`. Each call is `{ name, args, id?, intent }`, with
`intent` validated by the existing shared strict `toolIntentSchema`. Only
`discover_offers`, `request_quote`, `purchase_quote`, and `read_purchase` exist;
resource keys and quote UUIDs are the only arguments. Extra fields, arbitrary
URLs/amounts/policy edits, unknown or undeclared calls reject the entire candidate.

The application must execute calls **sequentially in their returned order** under
its budget, ownership, policy and durable payment guards. The adapter executes
none. Append `step.providerContent`, execute every accepted call in order, then
append `toolResponsesContent([{ call, response }, ...])` in that same order before
the next generation. Every optional call ID is copied into the matching reply;
missing, reordered or mismatched replies reject before network dispatch.

`providerContent` preserves the original validated provider part boundaries,
text, thought flags, call arguments/IDs and opaque signatures without inventing
reasoning or signatures. It is frozen and non-enumerable: serializing the step
omits it. **Explicitly persist `step.providerContent` in server-only run state**;
serializing the step alone loses continuation state. Never send this field to
the browser, events or logs. The safe `text` excludes every `thought: true` part;
it remains untrusted model prose, not evidence or financial authority.

`userTaskContent(task)` bounds and JSON-encodes task text as user data.
`toolResponsesContent(...)` wraps bounded JSON reports in function-response data.
Neither source changes the fixed system instruction. Prompt wording is not an
authorization boundary: strict schemas and the consuming payment guards are.

Limits: 128 KiB request, 256 KiB streamed response, 32 history entries, 32 parts
per entry, 12 calls per step, and 30 seconds per HTTP request including response
body consumption. The consuming loop still owns its overall run/turn/tool budget.
Caller cancellation, stalled streams, malformed JSON/content, safety blocks,
non-STOP finishes, truncation/continuation, empty visible responses and invalid
calls fail closed. There are no HTTP or tool-action automatic retries.

Only `x-goog-api-key` carries authentication. Redirects are forbidden. Error
responses are cancelled without reading their body; network/HTTP/timeout errors
expose fixed `GeminiModelError.code` values without a cause, request echo, provider
raw message, secret, or private reasoning. No signed material or financial SDK is
used here.

## Offline gate evidence

Pinned Node `v24.22.1`, pnpm `12.18.0`, existing Vitest `5.1.0` and dependencies.
`npx.cmd --yes pnpm@12.18.0 install --frozen-lockfile` passed with no lockfile change.
The first TDD run failed because the adapter did not exist. Implementation then
passed 46 mock HTTP tests; expanded boundary coverage passed **51/51**.

Final scoped commands:

```text
node_modules/.bin/vitest.cmd run tests/unit/model.test.ts
node_modules/.bin/tsc.cmd --noEmit
node_modules/.bin/eslint.cmd src/server/integrations/model.ts tests/unit/model.test.ts scripts/model-smoke.ts
```

Observed final results: scoped unit **51 passed, exit 0**; source typecheck
**exit 0**; scoped lint **exit 0**; `git diff --check` **exit 0**. Initial
source typecheck identified a Node `parseEnv` optional dictionary value type
and an ES2022 test-library incompatibility; both were repaired within scope.

Documentation-only checks are separate: `python tools/check-docs.py` exits 1
because existing `docs/pitch-kit.md` links to the ignored, absent child-worktree
`../fmd/playbooks/pitch-deck-playbook.md`. The prescribed local plan checker
exits 2 because that ignored kit is absent here. Running the existing root kit
checker directly with the child plan,
`python "C:/Users/Vincent/VS Codes/Noir X Velo/fmd/tools/check-implementation-plan.py" docs/implementation-plan.md --strict`,
passes with 13 valid task rows and coherent dependency/state DAG, exit 0. No
canonical document or FMD kit was changed to conceal either local-kit issue.

The tests cover exact native request/header shape, authenticated model selection,
pagination bounds, private thought omission from public JSON, exact signatures
and IDs through subsequent requests, multiple-call ordering, batch rejection,
strict argument/injection boundaries, safe task/report placement, absent optional
provider fields, auth/quota/network/timeout/cancellation failures, malformed and
blocked/truncated/empty content, streamed/advertised body limits and aggregate
request limits. These are mocked HTTP unit tests, not live Gemini or payment
acceptance evidence.

## Actual key smoke: NOT RUN

Executed:

```text
node --import tsx scripts/model-smoke.ts --worker-env-file "C:/Users/Vincent/VS Codes/Noir X Velo/.env.worker.local"
```

The script used a bounded private parse of only the two authorized model key
names from the existing root worker file; it did not parse/export financial key
values or overwrite configuration. The observed redacted output was:

```json
{"status":"not_run","missing":["GEMINI_API_KEY","AGENT_MODEL"]}
```

Missing configuration exits 2. No Gemini request, live model listing, generation,
quota observation, financial action or Testnet read was performed. The adapter's
live integration remains unverified until these exact names are configured.

After configuration, the same command lists only validated generateContent model
names, requires the configured observed model, requests exactly one
`discover_offers` call with no arguments, and sends one synthetic non-financial
tool reply. A second generation must produce exactly `GEMINI_SMOKE_OK`, with
calls disabled and exact signatures/IDs retained privately. It prints only safe
counts/booleans/model identifiers and fixed errors; neither provider text nor
signature values are printed. The synthetic reply is never put in the live
financial evidence namespace. Process environment values take precedence over
the explicitly selected file; no key is accepted as a CLI argument.

For a normal worker checkout the existing Node env-file convention also works:
`node --env-file-if-exists=.env.worker.local --import tsx scripts/model-smoke.ts`.
The native adapter itself reads process configuration only; it never opens an
environment file.
