# OPS — Operations & Observability Runbook

> **Purpose:** how to run, monitor, and recover the system in production. Conditional — the intake
> only selects this when `outlives_demo: true`. A hackathon demo does not need it.
> Traces back to: `system-design`, `security-compliance`.

## Deploy
<!-- How it ships. Environments, the deploy command/pipeline, rollback. Pinned versions. -->

## Configuration & secrets
<!-- Required env/config. Where secrets live (never in the repo). How to rotate. Reference by
     name, never value. -->

## Observability
<!-- What we log/measure, where it goes, the handful of signals that matter (SLIs). -->

## Alerts & thresholds
<!-- What pages a human and when. Forward-looking thresholds (not evidence-tagged). -->

## Runbook — common incidents
<!-- Per likely failure: symptom → diagnosis → fix. Keep it actionable. -->

## Backup & recovery
<!-- What's backed up, how often, and the tested restore procedure. -->
