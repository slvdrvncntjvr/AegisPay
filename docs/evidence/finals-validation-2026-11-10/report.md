# Coordinator validation after quota interruption — 2026-11-10

The combined source passes 120 PostgreSQL integration tests, 88 unit tests, 50 offline spike tests, 15 production-browser tests, root/web typecheck, lint and the Next production build. See the [source and gate receipt](receipt.json) for 30 exact source/test/configuration hashes. These are local implementation and regression results, not a live paid purchase or hosted release.

All three active Orca workers hit account usage limits without final reports. Current Orca recovery state already fenced their assignments as abandoned with missing terminals. Guarded stop returned already-settled; exact worker-release actions then returned released. An elevated process inspection found no remaining project validation/preview process from those workers. The coordinator preserved all edits and took sole ownership of final checks, including the shared Next build/server. No replacement worker or duplicate assignment was started.

| Gate | Observed result | Evidence |
|---|---|---|
| `corepack.cmd pnpm test:integration` | 120/120, nine files, exit0,185.36s | [integration](integration.txt) |
| `corepack.cmd pnpm test:unit` | 88/88, exit0 | [unit](unit.txt) |
| `corepack.cmd pnpm test:spike` | 50/50, zero skipped, exit0 | [spike](spike.txt) |
| `corepack.cmd pnpm typecheck` | root and web exit0 | [types](typecheck.txt) |
| `corepack.cmd pnpm lint` | exit0 | [lint](lint.txt) |
| `corepack.cmd pnpm build` | Next16.4.5 exit0; `/`, `/app`, `/login`, catchall API and health | [build](build.txt) |
| `corepack.cmd pnpm exec playwright test tests/e2e --workers=1 --reporter=line` | 15/15, exit0,43.9s against production3029 | [browser](browser.txt) |

PowerShell wraps some ordinary native stderr progress lines as `NativeCommandError` in redirected output; recorded process exit codes above establish results. An initial integration attempt failed because Docker Desktop was stopped and loopback PostgreSQL refused connections. Its [failure output](integration-docker-unavailable.txt) is retained. Starting the existing Docker Desktop installation hidden restored the retained healthy AegisPay database container on53371; no container/database/volume was reset or replaced. The subsequent full integration gate passed. Unrelated containers were not individually modified.

PostgreSQL tests use guarded local `aegispay_integration` with invocation-owned schemas and synthetic SDK/chain transport. The process-death harness uses actual terminated child processes and fresh connections, while provider history remains explicitly synthetic. The final code additionally quarantines legacy non-model run jobs with existing unmatched payment attempts without model generation, new quotes, acceptance or changes to the original run/payment/hold. Final-answer financial/claim/URI prose falls back conservatively to a trusted receipt sentence. These final edits were included in the coordinator's 120/88/50 gates.

All ten authenticated-console browser cases and five public-proof/login cases passed. Controlled browser API fixtures prevent protected requests from reaching the actual application API. The coordinator visually inspected desktop/mobile owner captures; final browser captures also cover merchant and gated synthetic receipt states. They are labeled synthetic test transport. No actual Freighter signature, merchant claim, model purchase or hosted browser acceptance occurred.

## Model-only external check and limits

After the final full integration gate, `corepack.cmd pnpm demo:smoke --model-only` passed its separate98-case offline preflight but exited1 with `MODEL_UNAVAILABLE` for configured `gemini-3.5-flash`. [Original result](../finals-model/model-only-1794306221339.json). The first automatic approval review rejected the probe because destination/payload sensitivity was not established. Coordinator inspected the fixed fictional prompt/offers and official Google-only endpoint, then the same bounded probe was approved; no approval bypass occurred. The outbound prompt contains authored fictional demo-parser offers only, no actual owner task, report, application DB state or financial keys.

An authenticated Google model-name discovery subsequently included both configured `gemini-3.5-flash` and `gemini-2.5-flash`; therefore the initial error does not prove model absence. One compatibility probe with the same fixed non-sensitive prompt returned GET200 for discovery and POST404 for generation, zero tool executions and zero financial actions. [Safe compatibility result](../finals-model/compatible-model-only-2026-11-10.json). Configuration was not changed. No raw provider exception/body or credential is exported, and no successful generation or model choice is claimed. The generation failure requires further bounded diagnosis; it does not invalidate offline tests or prove a wallet/payment failure.

The original Nov9 payment remains held/unentitled; no real application DB query, signing, sponsorship, submission, replacement purchase, cloud provisioning, source push or deployment was performed. The public alias and submitted PDF remain unchanged. Local production preview3029 is coordinator-owned; it must not be presented as a hosted live release.
