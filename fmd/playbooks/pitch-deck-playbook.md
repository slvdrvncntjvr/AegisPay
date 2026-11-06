# Pitch Deck Playbook — the VC method, re-weighted for a judged rubric

> **What this is.** A reusable *method* for building a pitch when you are being **scored against a
> fixed rubric** (hackathon, demo day, grant panel, internal review) rather than raising money. It
> takes the canonical venture-capital pitch-deck structure and *re-weights* it for the room you are
> actually in.
> **What owns the rubric.** The competition's rubric — its criteria, weights, hard requirements,
> timing, and format — is owned by the **seed-set context block** (`context.md` / the hackathon
> context doc). This playbook **consumes** those weights; it does not restate them. **Do not copy
> the rubric weights into this file or its instance — they are owned by the context block.** If a
> weight changes, it changes in one place.
> **The filled instance.** The concrete narrative, canvas, script, and Q&A map produced by running
> this method live in [`../templates/pitch-kit.md`](../templates/pitch-kit.md). This doc is the
> method; that doc is the instance.
> **Conditional.** Only relevant for judged/pitched builds. A build that ships without a pitch skips
> this entirely.

## 1. Premise — why borrow from VCs at all, and the one thing that changes

A VC pitch and a judged pitch do the same job: make a skeptical, time-poor evaluator believe, in
minutes, that a real problem exists and that *this* team's solution is worth betting on. The VC
structure is good precisely because it sequences information in the order a skeptic needs it. So
borrow the skeleton.

**One thing changes, and it changes everything downstream: the ask, and who is scoring.**

| | VC pitch | Judged build |
|---|---|---|
| **Who evaluates** | An investor asking "will this return my fund?" | Judges scoring a fixed rubric (owned by the context block) |
| **Implicit weighting** | Market size, business model, financials dominate | Whatever the rubric weights most — often technology, theme-fit, and originality |
| **The ask** | "$X for Y% equity" | "The next commitment we need" — a pilot, a partner, a signal of support |
| **Proof of feasibility** | Financial projections, traction charts | A **working demo, live** — feasibility is shown, not asserted |

So: keep the VC skeleton, but **drop the fundraising-only slides, amplify the demo, and re-point
every slide at a rubric criterion.** That translation is the whole playbook (§3).

## 2. The VC canon being adapted (sourced)

The de-facto standard is the **Sequoia Capital** deck sequence — a ~10-part order: company purpose,
problem, solution, why now, market size, competition, product, business model, team, financials.
Two supporting conventions:

- **Y Combinator:** ~10–12 slides, **one idea per slide**, ruthless clarity; add traction and a
  clear ask.
- **Guy Kawasaki's 10/20/30 rule:** 10 slides, 20 minutes, 30-point font — a discipline against
  cramming.
- **Sequoia's "how to present" habit:** open with fast facts and **answer the obvious objections
  before they are asked.** This is the single most useful VC habit to carry into a long Q&A.

> Content rephrased from public sources for licensing compliance; frameworks attributed inline.
> See the References section for links.

## 3. The translation table (this is the playbook)

The core of the method. Each VC slide → its job in *your* pitch → the rubric criterion it feeds →
the verdict (keep / amplify / downsize / drop / merge / transform). **Fill the "Feeds" column with
the criterion names from the context block; do not paste the weights here.**

| VC slide | Its job for you | Feeds (rubric criterion — from context block) | Verdict |
|----------|------------------|-----------------------------------------------|---------|
| **Company purpose** (1 line) | The hook — what this is in one sentence | Presentation / clarity | **Keep**, ruthless: one sentence, no jargon |
| **Problem** | The pain, made vivid *and* validated | Relevance / problem-fit | **Keep, lead with it.** Where honest user-validation wins or loses points |
| **Solution + live DEMO** | Show the core loop working | Technology + Feasibility | **AMPLIFY.** The demo *is* the product slide. Feasibility is proven live, not claimed. Highest-leverage minute you have |
| **Why now** | The timing/wedge that makes this urgent today | Creativity + Relevance | **Keep short** — timing + wedge in two sentences |
| **Market size** | Who benefits + the reachable community | Impact / scalability | **Downsize + reframe.** No TAM-in-billions theater. Name the reachable community + roadmap |
| **Competition** | Why you are different and defensible | Uniqueness / originality | **Keep.** Name the moat plainly — the one thing others cannot easily copy |
| **Product** | (folded into the demo) | Technology | **Merge** into Solution+Demo |
| **Business model** | How this survives past demo day | Sustainability | **Keep, reframe:** not "how we get rich" — who the payer is and why they pay |
| **Team** | Why this team can execute | (light) | **Shrink.** One credibility line, no filler |
| **Financials** | — | — | **DROP.** No projections. Replace with a one-line cost structure that supports Feasibility |
| **The ask** | What you need next | Presentation close | **Transform:** not equity — the next real commitment (pilot, partner, mentorship) + the one metric you are chasing |

**Net adapted arc (what actually gets presented):**
`Hook → Problem (validated) → Solution + live demo → Why now / wedge → Model + payer → Ask.`
Six beats. Everything the VC canon adds beyond this (market math, financials, cap table) is either
folded in or dropped.

## 4. The rubric-budget rule (where prep time goes)

Spend preparation time **in proportion to points, not to what is comfortable to polish.**

- Rank the rubric criteria by weight (read them from the context block). The top two are usually
  where a long Q&A is won — prepare their honest defenses first.
- **Feasibility is bought almost entirely by a working live demo.** A demo that runs beats any
  slide. Demo-reliability work (warm the backend, seed static data, have a video fallback) is a
  *scoring* decision, not just engineering hygiene.
- The lowest-weight criterion (often Presentation) is where over-investment hides. A clear, calm
  delivery clears it; slide transitions do not move it.
- The test for every prep hour: **which rubric criterion did this hour buy?** If the answer is
  "none, but the slides look nicer," stop.

## 5. Delivery rules (VC habits that transfer)

1. **Answer objections before they are asked** (Sequoia). Bake the two most point-costing objections
   straight into the pitch. Pre-empting them defuses the Q&A.
2. **One idea per slide, one idea per breath** (YC). If a smart non-expert judge cannot follow it,
   cut it.
3. **Big text, few words** (Kawasaki, adapted to your time cap). Slides support the speaker; they are
   not the script.
4. **Demo-first bias.** Show the loop working before explaining architecture. Seeing beats hearing.
5. **Route the Q&A by owner** in advance (see the pitch kit's Q&A map). A long Q&A is long enough
   that an unassigned question causes a scramble that reads as "they don't know their own project."
6. **Have the fallback ready.** A live demo that fails on stage costs more than the points it was
   meant to win. A recorded run is cheap insurance.

## 6. How to use this playbook

1. Read the rubric in the context block — that is the scoreboard. Do not restate its weights here.
2. Fill each beat of the §3 arc with real content — done in
   [`../templates/pitch-kit.md`](../templates/pitch-kit.md) (narrative, canvas, script, Q&A map,
   probe sheet).
3. Budget prep time by §4. Rehearse the Q&A more than the script.
4. Before the pitch, confirm nothing on stage contradicts the repo (product name, feature claims,
   validation status).

## 7. Anti-patterns (do not do these)

- **TAM theater** — quoting a billion-dollar market for a single-segment project. Judges score
  reachable impact and honest scalability, not inflated markets. Reframe to reachable community +
  roadmap.
- **Slide-polishing as avoidance** — polishing the deck instead of hardening the demo or running the
  interview probe sheet is dodging the scary, high-value work. Presentation is usually the smallest
  slice; validation and a working demo are where the score lives.
- **Claiming validation you do not have.** "Is the problem real and validated?" is a first-order
  judge question. Desk research is not validation. Say what you have actually done (behavior you
  observed) and what you are doing next — honesty scores better than a hollow claim that collapses
  in Q&A. Weight evidence: **paid > did > said**, and post-reveal "I'd use it" is the weakest signal.
- **Fundraising language** ("we're raising," "pre-money," "10x return"). Wrong ask for this room. The
  ask is the next real commitment, not equity.
- **Faking depth on the tech.** If a component's role is overstated, one pointed Q&A question exposes
  it. Describe what each piece actually does; claim nothing it does not.

## References

- Sequoia Capital — business plan / pitch sequence and "how to present" (objection-first) guidance.
  <https://www.sequoiacap.com/article/writing-a-business-plan/>
- Y Combinator — pitch and demo-day guidance (one idea per slide, clear ask).
  <https://www.ycombinator.com/library>
- Guy Kawasaki — the 10/20/30 rule for pitch decks.
  <https://guykawasaki.com/the-only-10-slides-you-need-in-your-pitch/>
- Filled instance of this method: [`../templates/pitch-kit.md`](../templates/pitch-kit.md).
- Rubric, timeline, and format: owned by the seed-set context block (do not restate here).

> Frameworks above are attributed to their authors; descriptions are rephrased from public sources
> for licensing compliance.
