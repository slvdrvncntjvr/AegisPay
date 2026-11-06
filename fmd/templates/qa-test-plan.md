# QA — Test Plan & Test Cases

> **Purpose:** how quality is proven, and the **traceability home**. Every feature in the PRD/FRD
> must appear here with at least one test. This doc owns test intent; the implementation plan links
> to case IDs + exact commands, while CI owns raw run artifacts.
> Traces back to: PRD, FRD, SRS, system design.

## Test strategy
<!-- Levels (unit/integration/e2e), automation vs manual, risk order, and who owns each gate. -->

Use the cheapest layer that proves the behavior:
- **Unit:** pure logic and edge cases.
- **Integration/contract:** boundaries (DB/API/chain/model/provider) with controlled data.
- **E2E:** only critical user-visible journeys whose failure would break the demo/release.

## Test profile (context-scaled)

- **Browser UI present:** <yes | no>
- **Core smoke journey:** <UJ-### / TC-### or N/A>
- **PR gate command:** `<fast deterministic command>`
- **Full gate command:** `<required before merge/demo>`
- **CI budget/constraints:** <runner, secrets, time; no invented target>
- **Required environments:** <one primary environment first; add browsers/devices only from audience/rubric evidence>

## Scope
### In scope
### Out of scope

## Environments
<!-- Where tests run; deterministic data setup/teardown; secrets handling (reference, never inline). -->

## Traceability matrix
<!--
EVERY F-### from idea.md §7 / PRD must have at least one case. The consistency-checker parses this:
an F-### with no row is an orphan (FAIL); a case covering no real F-### is stray (FAIL).
-->

| F-ID | Feature | Test case ID(s) | Lowest proving level | Automation | Status |
|------|---------|-----------------|----------------------|------------|--------|
| F-001 | | TC-001 | e2e | planned | todo |

## Automation contract
<!--
Every automated case names its path + exact command + trigger. This is the handoff the living
implementation plan consumes. Do not write "covered by CI" without a runnable command.
-->

| Test ID | Level/tool | Test path | Command | Trigger | Artifact/evidence |
|---------|------------|-----------|---------|---------|-------------------|
| TC-001 | <unit/integration/e2e + tool> | <path> | `<command>` | <local/PR/main/demo> | <report/log/trace or manual evidence> |

## Test cases
<!-- Per case: ID, Covers, preconditions/data, steps, expected result in EARS, automation mapping. -->

### TC-001 — <name>
- **Covers:** F-001
- **Level:** <unit | integration | contract | e2e | manual>
- **Preconditions / controlled data:**
- **Steps:**
- **Expected (EARS):** WHEN <trigger>, the system SHALL <observable result>.
- **Automation:** <path + command, or `manual — because …`>

## Invariant (negative) tests — the `INV-###` guardrails
<!--
Every INV-### hard rule gets at least one NEGATIVE test. A positive-only suite can pass while an
invariant is breached. The consistency-checker treats an INV-### with no negative test as an orphan.
-->

| INV-ID | Invariant (must never…) | Negative test case ID(s) | Status |
|--------|-------------------------|--------------------------|--------|
| INV-001 | | TC-N01 | todo |

### TC-N01 — asserts INV-001 is never violated
- **Covers:** INV-001
- **Assertion (EARS unwanted behavior):** the system SHALL NEVER <forbidden behavior> [WHEN/WHILE <conditions>].
- **Steps / probe:**
- **Expected result:** forbidden output/behavior/label is absent; the test fails if it appears.
- **Automation:** <path + exact command, or manual reason>

## Browser E2E with Playwright (conditional — omit if no browser UI)

Use Playwright for the core browser journey, not as a substitute for unit/integration tests.
- Test **user-visible behavior**. Prefer role/label/text/test-id locators; do not bind to CSS/XPath
  or implementation details. Use Playwright's web-first assertions and auto-waiting.
- Keep tests isolated with controlled data, storage, and cookies. Do not test third-party services;
  stub/control their boundary. Use project dependencies for reusable setup/auth when needed.
- **Lean PR baseline:** the core demo smoke on the primary required browser (usually Chromium),
  `workers: 1` in constrained CI, `forbidOnly` in CI, and `trace: 'on-first-retry'`. Upload the
  HTML report/trace on failure. Pin the dependency/browser version in the target project.
- Add Firefox/WebKit/device projects only when the audience, rubric, or a real compatibility failure
  requires them. Shard only after measured suite runtime becomes a bottleneck; sharding spends more
  CI jobs and artifact storage.
- The coding layer owns dependency installation, `playwright.config.*`, and CI workflow
  implementation; FMD does not add packages or host-specific workflows blindly. This plan owns
  which `TC-###` cases and commands are required.

## Acceptance criteria
<!-- Pull one EARS criterion per F-### from the PRD; each becomes a TC above. -->

## Regression plan
<!-- What targeted set runs per task/PR; what full set runs on current main and before demo. -->

## Exit criteria
<!-- Name exact required commands/cases and allowed open defect classes. Avoid fake pass-rate targets. -->
