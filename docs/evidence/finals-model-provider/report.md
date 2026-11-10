# Bounded Gemini provider diagnostic — 2026-11-10

**Result:** the configured `models/gemini-3.5-flash` now completes minimal text generation through the official Google endpoint. The subsequent fictional `request_quote` generation returns HTTP503 / Google `UNAVAILABLE`; tool choice remains unproved. The earlier POST404 cause remains **unknown**. Neither model absence, a broken API path, an account enablement requirement nor a need to change models is established.

Work reference: Orca task `task_401b4a1b173c`, dispatch `ctx_2694a8e8937d`; reviewed baseline `577b84485b00634c8566060ff8a477dc0e030ba1`. This worker writes only this evidence directory and ignored diagnostic helpers; it changes no application, test, environment, canonical document or deployment.

## Actual authenticated requests

All three calls go directly to `https://generativelanguage.googleapis.com`, using the existing local key privately in the `x-goog-api-key` header. No credential is placed in a URL or persisted report. Exact safe observations are in [actual-requests.json](actual-requests.json).

| UTC observation | Method and path | HTTP | Google error code/status | Safe conclusion |
|---|---|---|---|---|
| 11:14:34.623 | GET `/v1beta/models?pageSize=100` | 200 | none | Configured `models/gemini-3.5-flash` and previously checked `models/gemini-2.5-flash` advertise `generateContent`; no further page |
| 11:14:39.249 | POST `/v1beta/models/gemini-3.5-flash:generateContent` | 200 | none | A single authored `Reply OK` text turn produced the expected text; minimal generation works |
| 11:16:17.163 | POST `/v1beta/models/gemini-3.5-flash:generateContent` | 503 | 503 / `UNAVAILABLE` | Provider endpoint unavailable for this request; no successful tool choice observed |

The second POST was justified by the first POST's success: compare the existing `request_quote` JSON Schema, `ANY` / `allowedFunctionNames`, demo system instruction and generation options on the same configured model. Its only input data were authored fictional QuickSignal300000 / DeepTrace1200000 offers and budget1000000. It included no user task, report, wallet address, DB record or financial executor. The application writer concurrently revised the public-summary wording of the existing system instruction at model.ts:77; the diagnostic read that contemporaneous instruction without importing or executing application modules. The rest of the inspected adapter and smoke script match the baseline. This is therefore a current schema/configuration probe, not an exact replay of the historical request bytes.

Exactly **one authenticated discovery GET and two generation POSTs** were made for this assignment. There are zero redirects, retries, tool executions and financial actions. Each request has a35-second total deadline,8KiB request cap and256KiB streaming response cap. No additional generation is authorized by this report. No auth, quota or billing failure was observed; successful generation does not establish free-tier eligibility, billing status or future quota.

## Official API comparison

Public documentation retrieval is separate from the authenticated deployed API calls above. The legacy `ai.google.dev` documentation URLs currently redirect to Google's `aistudio.google.com` documentation; this does not imply that the application generation endpoint redirects. All checked primary references and retrieval fingerprints are in [primary-sources.json](primary-sources.json).

- Google's [GenerateContent method reference](https://aistudio.google.com/api-reference/generate-content/generate-content) specifies POST `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`, required `contents`, and optional `systemInstruction`, `tools`, `toolConfig`, `generationConfig`. The adapter at `src/server/integrations/model.ts:9`, `:94`, `:247` and `:367` normalizes one `models/` prefix and uses this route and POST method. There is no evidenced endpoint repair to apply.
- Google's [model-list reference](https://aistudio.google.com/api-reference/models/list-models) specifies GET `/v1beta/models` with pagination; the [model resource](https://ai.google.dev/api/models) exposes `supportedGenerationMethods`. The adapter's pageSize100 at model.ts:282 is valid. Discovery is metadata, not proof of generation or quota.
- Google's [API-key guide](https://aistudio.google.com/docs/api-key) documents header authentication with `x-goog-api-key`. The adapter at model.ts:249 already uses that header. The diagnostic supplied only the two selected values from the ignored worker configuration, without loading that file into process.env.
- Google's [GenerateContent schema reference](https://aistudio.google.com/api-reference/generate-content) documents `parametersJsonSchema` and `includeThoughts`; the [method reference](https://aistudio.google.com/api-reference/generate-content/generate-content) documents the function-calling configuration. Nothing observed proves that these supported fields caused the historical404 or current503.
- Google's own [v1beta service definition](https://github.com/googleapis/googleapis/blob/master/google/ai/generativelanguage/v1beta/generative_service.proto) independently declares the same POST binding and required content. Its [model service definition](https://github.com/googleapis/googleapis/blob/master/google/ai/generativelanguage/v1beta/model_service.proto) declares the same GET list binding. These are public source checks, not deployed execution evidence.

## What the evidence does and does not diagnose

The previous [configured-model smoke report](../finals-model/model-only-1794306221339.json) retained only `MODEL_UNAVAILABLE`; the [compatibility report](../finals-model/compatible-model-only-2026-11-10.json) retained GET200 / POST404. Neither retained an allowlisted Google error status or cause. The adapter maps404 and all5xx to `MODEL_UNAVAILABLE` at model.ts:199–204, then cancels error bodies at model.ts:252–254. Its generic error is intentional redaction and cannot recover the missing historical cause. The independent [final-source review](../finals-review/combined-577b844/report.md) also found no concrete URL defect.

Today's direct minimal200 disproves a blanket assertion that this configured model cannot generate at this endpoint. Today's503 establishes only an unavailable response for the tool request; its exact underlying cause is unknown. The diagnostic uses Node's native HTTPS transport, while the application adapter uses fetch, so application transport and parser behavior are not empirically qualified by these direct calls. No request was issued through demo-smoke, because that command first invokes DB-mutating offline gates. No application test or full model purchase passed here.

**Recommendation:** retain the model, API path and current configuration. No source repair or account/project action is concretely supported. Preserve the historical404 as unresolved and record today's minimal200/tool503 separately. A later, separately authorized bounded model-only check through the actual adapter could qualify tool choice and its response parser; it must avoid the current smoke script's DB gate and respect the other writer's scope. Google's [troubleshooting guide](https://aistudio.google.com/docs/troubleshooting) discusses transient unavailable responses, but this assignment's two-POST limit is exhausted and no retry was made. TASK-007 live purchase and TASK-010/012 release gates remain open.

## Hygiene and validation

Provider bodies were handled only in memory to derive fixed statuses/categories and boolean success predicates, then discarded. No raw provider error/message, raw request, provider response text, private configuration, key/fingerprint, account data or signed material is stored. Artifact scans and scoped source fingerprints are recorded in [validation.json](validation.json). Documentation checks are structural checks, not application tests. No package install, DB connection, app/worker startup, signing, submission, Git commit/push or deployment occurred.
