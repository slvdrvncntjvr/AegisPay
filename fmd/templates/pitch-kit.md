# Pitch Kit — {product name}

> **What this is.** The **filled-in instance** of the method in
> [`../playbooks/pitch-deck-playbook.md`](../playbooks/pitch-deck-playbook.md): the VC deck
> structure re-weighted for a judged rubric. Everything one person owns for the final pitch, in one
> file — narrative, business model canvas, timed script, Q&A ownership map, and interview probe
> sheet.
> **Conditional.** Generate this only for **judged/pitched builds**. Skip it for a build that ships
> without a pitch.
> **Source-of-truth discipline.** The rubric — criteria, weights, timing, format — is owned by the
> **seed-set context block**. This kit *consumes* it. **Do not restate the rubric weights here; they
> are owned by the context block.** Pull the criterion *names* into the "Rubric it feeds" columns
> below; leave the numbers where they live.
> **Traces to:** `idea.md` (problem, segment, invariants §9), PRD/BRD/MRD (features, business rules),
> and the context block (rubric). Grounds forward to the live demo and the deck.
> **Evidence weighting used throughout:** `paid > did > said`; behavior beats stated intent; a
> post-reveal "I'd use it" is the weakest signal.

<!--
HOW TO FILL THIS FILE
- Replace every {placeholder} with real content. Delete rows/lines that don't apply — never leave
  a stub like "TBD" in a judge-facing artifact.
- Keep it honest. If a claim isn't backed by observed behavior, say what you've actually done.
- The Q&A map (§4) is usually worth more than the script (§3) in a long Q&A. Spend time there.
-->

## 1. Business narrative (the one paragraph everyone tells the same way)

<!--
One paragraph, spoken from memory, identical from every teammate. It is the spine of every slide
and every Q&A answer. Say: what it is, who it's for, the core loop, who pays, why you start narrow,
and the one thing you are proving right now. No jargon. If a smart non-expert can't repeat it back,
rewrite it.
-->

{One paragraph. What {product} does for {segment}, the core loop in plain words, why it's free/paid
for the user, who funds it, why you start with {narrow wedge} on purpose, and the single riskiest
thing you are currently proving.}

> Everyone on the team should be able to say this from memory.

## 2. Business Model Canvas (one-pager)

<!--
The BMC is the business logic. The rightmost column is the point of this table: it ties each block
to a pitch beat (§3) so the canvas and the pitch never drift apart. If a block feeds no beat, ask
whether it belongs in the pitch at all.
-->

| Block | Content | Feeds pitch beat |
|-------|---------|------------------|
| **Value proposition** | {the core benefit, in the user's words} | Hook + Solution |
| **Customer segments** | **Users:** {who uses it}. **Payers (if distinct):** {who pays}. | Problem + Model |
| **Why us / unfair advantage** | {the moat — the thing others can't easily copy} | Why-now / wedge |
| **Key partners** | {distribution + credibility partners}; Infra: {stack} | Model |
| **Key activities** | {the few things you must do well} | Solution + demo |
| **Key resources** | {the asset that compounds — data, trust, IP} | Competition |
| **Cost structure** | {near-zero? main cost = ?} — replaces "financials" | Feasibility |
| **Revenue streams** | {who pays and how}; {what you deliberately rejected and why} | Model + payer |
| **Channels** | {where you reach users this week} | (support) |
| **Customer relationships** | {onboarding + trust loop; do-things-that-don't-scale} | Ask |

## 3. Five-minute pitch script (timed, mapped to the arc + rubric)

<!--
Arc from the playbook §3: Hook → Problem → Solution+demo → Why-now/wedge → Model+payer → Ask.
Adjust the time column to your actual cap. Weight delivery toward the heaviest-weighted rubric
criteria (read them from the context block). Pre-empt your two most point-costing objections inside
the script itself (Sequoia habit). The "Rubric it feeds" column names criteria — no weights.
-->

| Time | Beat | What to say | Rubric it feeds |
|------|------|-------------|-----------------|
| {0:00–0:30} | **Hook + Problem** | {the pain, made vivid — ideally a behavior quote, not a statistic} | {Relevance / problem-fit} |
| {0:30–2:15} | **Solution + live demo** | {structure the demo: open → see state → one action → result updates}. Say the one honest framing that pre-empts objection #1. | {Technology + Feasibility} |
| {2:15–3:15} | **Why now / wedge** | {the timing that makes this urgent}; why you start narrow; the contrast that pre-empts objection #2. | {Creativity + Uniqueness} |
| {3:15–4:15} | **Model + payer** | {free/paid to users}; {who funds it and why the economics survive past demo day}. | {Sustainability} |
| {4:15–5:00} | **Ask** | {the next real commitment you need — pilot, partner, mentorship} + the one metric you're chasing this month. | {Presentation close} |

> Delivery: concise, 1–2 speakers, big text / few words, demo video ready as fallback. Rehearse the
> Q&A (§4) more than the script.

## 4. Q&A ownership map (the minutes that decide it)

<!--
This is often worth more than the script. In a long Q&A, an unassigned question causes a scramble
that reads as "they don't know their own project." Give every likely question a NAMED owner and a
one-line answer. Cover the heaviest-weighted rubric criteria first — that's where the Q&A is scored.
If a question lands cross-owner, the named owner starts and hands off.
-->

Owners: **{Person A}** ({domain}), **{Person B}** ({domain}), **{Person C}** ({domain}).

| Likely question | Owner | One-line answer |
|-----------------|-------|-----------------|
| "{Is your data / evidence real? Where does it come from?}" | {Person} | {honest answer: what's a hypothesis vs. what's confirmed behavior} |
| "{Isn't this just {obvious substitute}?}" | {Person} | {the real differentiator, tied to an invariant if relevant} |
| "{Legal / ethical objection?}" | {Person} | {the design choice that is your shield — cite INV-### if it's a hard rule} |
| "{How does the {AI/core tech} actually work — isn't it {tech} theater?}" | {Person} | {the specific real jobs it does; what it does NOT do} |
| "{What's your tech stack — and does it meet requirement X?}" | {Person} | {the honest stack + why each choice; how the requirement is met} |
| "{Why not just use {incumbent}?}" | {Person} | {the deliberate reason; cite an ADR if one exists} |
| "{Does the demo/backend scale? What if it's slow live?}" | {Person} | {design-for-demo answer + the fallback} |
| "{Why won't users just keep doing {current workaround}?}" | {Person} | {your riskiest assumption — say you're testing it, not that it's proven} |
| "{Who pays / is it sustainable?}" | {Person} | {payer #1 and why; cost structure} |
| "{Have you validated the problem?}" | {Person} | {the behavior cluster you observed; be honest about what's still `said`-only} |

## 5. Interview probe sheet (confirm-or-kill the riskiest assumption)

<!--
Behavior-anchored questions (Mom Test): ask about the last time it happened, not about your idea.
Do not describe the product until the end, if at all. Questions 1–N generate did/paid evidence; the
final reveal question only ever generates `said` — the weakest signal. Goal: confirm or KILL the
single riskiest assumption ({name it here}), and validate any seed assumptions.
-->

Target: {who — the specific segment you can actually reach}.
Riskiest assumption under test: **{the one thing that must be true}.**

1. {Walk me through the last time you hit <the problem> — every step, start to finish.}
2. {Was there a moment it felt <worst>? Which exact one, and what made it feel that way?}
3. {What did you *do* about it — a workaround, a detour, paying more, not going?}
4. {Before that, how did you decide? Did you check or ask anyone?}
5. {Do you use <current substitute> for this? Show me a recent example.}
6. {Have you ever paid to avoid <the problem>? How often, how much?}
7. {Who do you think *should* own solving this — and why hasn't it been solved?}
8. (Only at the end) {Here's what I'm building — would it be useful? Why?} ← weakest signal; treat
   the answer as color, not proof.

> Log answers verbatim, compliments stripped. Promote an assumption to "validated" only on observed
> behavior (`did`/`paid`), never on a post-reveal "I'd use it." Bring at least one real behavior
> quote to the pitch — a named-behavior anecdote beats a statistic in the room.

## References

- Method this instance fills: [`../playbooks/pitch-deck-playbook.md`](../playbooks/pitch-deck-playbook.md).
- Rubric, timing, and format: owned by the seed-set context block (do not restate weights here).
- The Mom Test (Rob Fitzpatrick) — behavior-anchored interview discipline for §5.
- Product invariants (`INV-###`) referenced in §4: `idea.md` §9.

> Framework references are rephrased from public sources for licensing compliance and attributed to
> their authors.
