# hooks/ — IDE-agnostic decision-ledger enforcement

These hooks keep `docs/DECISION-LEDGER.md` honest at commit time, **regardless of which
IDE or agent you use** (Claude Code, Cursor, Gemini CLI, ChatGPT/Codex, Kiro, or a bare
terminal). They live at the git layer on purpose: git behaves the same everywhere, so the
enforcement can't be lost by switching tools. The *reasoning* an agent should follow lives
in `AGENTS.md`; these hooks are the mechanical backstop for the parts that are checkable.

## What's here

- **`pre-commit`** — blocks a commit that changes `docs/adr/` without a matching line in the
  decision ledger (ADR ⇒ ledger, in the same commit), and reminds (non-blocking) to add an
  invariant-audit line when a hard-rule surface is touched. It never freezes the spec; genuine
  exceptions bypass with `git commit --no-verify`.

## Install (pick one)

**Per-clone (simplest):**
```sh
cp hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
```

**Shared via the repo (survives clones, one-time setup per clone):**
```sh
git config core.hooksPath hooks
chmod +x hooks/pre-commit
```

## Why not an editor/IDE hook (e.g. a `.kiro.hook`)?

An editor hook only fires inside that one editor. The whole point of `AGENTS.md` + git hooks is
**write once, enforce everywhere** — the same discipline holds whether the commit comes from Kiro,
Cursor, a CI runner, or a teammate on the terminal. An IDE-specific hook is at most a convenience
wrapper on top of this; it is never the mechanism.

## What is NOT mechanized here (and why)

- **Living-plan task checkpoints, branch/PR policy, and semantic conflict resolution** are not
  enforced here. The emitted `AGENTS.md` + `docs/implementation-plan.md` define the protocol;
  repository branch protection/CI provides the server gate. A generic local hook is bypassable and
  cannot judge whether a doc, dependency, or conflict intent changed.
- **Pre-milestone reconciliation** (diff the ledger/anchor across branches before a pitch/demo/
  handoff) and **docs-travel-with-code** (validation/analysis docs merge on trunk with the features)
  are process disciplines in `AGENTS.md`, not commit hooks — they need judgment a hook can't make.
  Run the reconcile pass before any external milestone.
