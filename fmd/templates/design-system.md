# Design System / UX Spec

> **Purpose:** consistent UX. Principles, components, tokens, patterns, accessibility.
> Traces back to: PRD user flows.

## Design principles
<!-- 3–5 principles that guide UX decisions for this product. -->

## Component inventory
<!-- The reusable UI components and their purpose. -->

## Tokens
<!-- Color, typography, spacing, radius, elevation. The primitives everything composes from. -->

## Patterns & states
<!-- Common patterns (forms, tables, empty/loading/error states) and how they behave. -->

## UI voice & copy rules (enforced, not optional)
<!--
The words the UI is allowed and forbidden to use. This is where an invariant (INV-### from idea.md
§9 / the PRD must-never rules) becomes concrete at the surface a user sees — it is the cheapest place
to catch a hard-rule breach (a banned button label ships before a banned behavior does). List
BANNED copy explicitly and tie each ban to its invariant, so a reviewer or an agent can grep for it.
Also record any tool/library default this project deliberately overrides, and ground the tokens in
real code with a "last synced" date so this doc can't silently rot. -->

**Banned copy (enforced — tie each to its invariant):**
- Never use: "{banned phrase, e.g. 'SOS', 'Get help', 'we'll send someone'}" — breaches **INV-###** ({the hard rule}).
- Never use: "{banned phrase, e.g. 'crime zone', 'dangerous area'}" — breaches **INV-###**.
- Prefer "{honest phrasing, e.g. 'safest we found'}" over "{overclaim, e.g. 'safe'}".

**Tool/default overrides (this project intentionally deviates):**
- {e.g. component library X is the standard here; do not swap it}. Reason: {…}.

**Provenance:** tokens/components transcribed from {source file, e.g. `src/styles.css`}. Last synced: {YYYY-MM-DD}.

## Accessibility standards
<!-- Target standard (e.g. WCAG AA). Keyboard, contrast, focus, semantics.
     Note: full conformance requires manual testing with assistive tech and expert review. -->

## Key screen specs / wireframes
<!-- The core screens with layout and behavior notes. Linked images welcome. -->
