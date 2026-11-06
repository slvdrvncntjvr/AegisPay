---
status: draft
schema_version: 2.1.0
origin: <optional; idea-forge-internal — where this problem came from. FMD does NOT gate on it>
payer_status: identified | assumed | none-found   # optional; idea-forge-internal. FMD does NOT gate on it
---

# Idea: <working name>

<!--
FMD's INPUT CONTRACT. This is the shape the factory expects to consume. It is NOT authored
here — authoring is out of FMD's scope (the idea-kit is one optional way to do it). The factory
keeps this copy so its structural preflight can check an incoming brief has the sections it reads.
Golden rules: keep the section names/order; the segment is specific; the feature set has F-### IDs.
Evidence tags and the four-tests table are OPTIONAL (fill them only if you actually validated —
FMD neither requires nor gates on them). Allowed everywhere: "N/A — because…". Not allowed:
silently dropping a section that a downstream doc reads (problem, segment, feature set).
Authoring guide (optional): <your-knowledge-base>/idea-kit/how-to-write-idea.md
-->

## 1. Problem statement
<!-- One paragraph. The pain, who has it, no solution language. -->

## 2. Target segment
<!-- Who specifically. Role, context, frequency of the problem. "Everyone" is not a segment. -->

## 3. Evidence
<!-- OPTIONAL. If you validated the problem, tag each material claim with a callout; if you're
     moving fast (e.g. a hackathon), this section can be "N/A — because <reason>". FMD does not
     require or gate on evidence. When used, the callout format is:
       > [!evidence] Type: said|did|paid | Source: <id/link> | Date: YYYY-MM-DD -->
- <observed behavior / workaround>
  > [!evidence] Type: did | Source: <interview-id> | Date: YYYY-MM-DD
- <committed money / signed LOI>
  > [!evidence] Type: paid | Source: <LOI-id> | Date: YYYY-MM-DD

The four tests (optional — a validation aid, not an FMD gate):

| Test            | Pass / Fail | Why |
|-----------------|-------------|-----|
| Real            |             |     |
| Large           |             |     |
| Significant     |             |     |
| Urgent          |             |     |

## 4. Root cause (the WHY)
<!-- Why this exists and why it's unsolved today. Five-whys to something structural. -->

## 5. Market & alternatives
<!-- From research. -->
- **Size band:** <hundreds / thousands / millions> — _source_
- **Reachability:** <where they gather — 2+ places you can reach them this week>
- **Top 3 alternatives + their key failure:**
  1. <alternative> — fails at <gap>
  2. <alternative> — fails at <gap>
  3. <alternative / "do nothing"> — fails at <gap>

## 6. Value proposition
<!-- One sentence, fill the blanks. -->
For **<segment>** who **<pain>**, this is a **<category>** that **<key benefit>**, unlike
**<alternative>**, because **<differentiator>**.

## 7. Feature set
<!--
Each feature gets a STABLE ID: F-001, F-002, … These IDs are the spine of traceability.
The PRD references them; the QA test plan tests each one by ID. Never renumber an existing
feature — retire it and add a new ID instead.
-->

### MVP — smallest path to core value + a learning signal
<!-- Each feature names the problem it solves. -->
- **F-001** — <feature> → solves <problem from §1/§3>
- **F-002** — <feature> → solves <problem>

### Final product — full vision
- **F-101** — <feature>
- **F-102** — <feature>

## 8. Success metrics
<!-- Activation, retention, revenue targets. Not vanity metrics (signups/views/impressions). -->
- **Activation:**
- **Retention:**
- **Revenue / value:**

## 9. Constraints, risks & kill criteria
<!-- The single riskiest assumption, explicit fail-states, and the hard invariants.
     Kill criteria are forward-looking, not evidence-tagged. -->
**Single riskiest assumption:** <the one thing that must be true>

**Kill criteria (explicit fail-states):**
- Regulatory:
- Unit economics:
- Technical:

**Invariants (`INV-###`) — hard product rules that must hold across every pivot:**
<!-- FMD reads these as the guardrail spine: each INV-### is carried into a PRD
     "must-never" business rule, a security threat mitigation, a design-system
     banned-copy line, and a QA negative test. The consistency-checker traces an
     INV-### with no downstream enforcement as an orphan, exactly like an F-###
     with no test. Optional — omit if there are no hard rules. Not a lock: an
     invariant changes only via a logged pivot, never silently. -->
- **INV-001** — <the rule the product must never violate>
- **INV-002** — <another hard rule, if any>

## 10. Out of scope (for now)
<!-- Explicitly. Prevents scope creep downstream. -->
