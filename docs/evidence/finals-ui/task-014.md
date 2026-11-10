# TASK-014 — finals public UI redesign

Completed implementation and current-source local verification on 9 November 2026. Work ref: `orca:run_3bfef6dba661/ui`, starting local main `180a88d`. The coordinator accepted the final visual direction in message `msg_9b6bea2e513c`, subject to this evidence handoff. The coordinator owns task status, canonical documentation, integration and deployment; this report does not mark TASK-008 or a full live application complete.

## Delivered experience

Replaced the plain proof console with an authored ivory/petrol/mint identity, self-hosted Bricolage Grotesque display lettering, a drawn AegisPay mark and favicon, and a large interactive payment-evidence instrument. Operational text stays in the system sans stack. The first screen explains a release assistant buying a specialist report within human spending limits, then directs visitors into actual recorded evidence. The illustrative QuickSignal/DeepTrace scenario remains explicitly unexecuted and contains no protected report body.

The instrument shows Intent → Noir → Velo → independent Evidence. Its authority bracket, stopped refusal path, boundary-specific states and one finite user-triggered line highlight explain the integration. Nothing auto-plays a historical payment as new execution. At 1280×720 the complete instrument fits in the first viewport; a focus action brings the evidence and separate claim strip together for presentation. Phones promote the amount, cap and decision above the longer explanation. The section heading reads naturally at 390px and 320px.

Implemented safe interactions:

- Authorization, unsigned over-cap refusal and recovery-design paths have semantic tabs, associated panel, roving keyboard focus, Left/Right/Home/End support and visible focus rings.
- Selecting a boundary updates its explanation without replacing the focused button. Refusal Intent correctly describes the 0.12 XLM request, while the separate historical authorization remains 0.03 XLM.
- `proof` and `boundary` URL parameters retain the selected evidence on reload. Unrecognized values fall back to the recorded authorization. Selection changes only local view state/history.
- Receipt action opens native disclosure, focuses its summary and exposes the exact independent inner/outer/claim transaction links. Full public identifiers wrap, remain selectable and have copy controls with success/error announcements.
- Recovery is labeled “Design preview · not executed,” retains unknown/unentitled semantics and offers explanatory disclosure only. No retry-payment or new financial call is available.
- Login retains its actual `/api/session` role/token POST contract, busy/error states and password handling. A successful sign-in shows the truthful integration handoff instead of navigating to the absent `/app` console.
- Repository, exact submitted PDF, fixed website identity, redacted evidence and recovered video **folder** links are preserved. The video link does not claim MP4 playback.

Historical facts are imported from the existing public constants: one authorization, inner versus outer/event mapping, separate merchant claim, 0.10 XLM per-payment cap, policy expired 7 Nov 15:32 UTC and the historical 82496-stroop fee. The cap, application task budget, finite escrow and merchant pending balance remain distinct. Neither the historical constants nor the actual wallet helper was changed (`git diff --exit-code` for both exited 0).

## Source and provenance

Changed public application files: `apps/web/src/app/{page.tsx,console.tsx,globals.css,layout.tsx,login/page.tsx}`, new `apps/web/src/components/visual.tsx`, and `apps/web/public/`. Browser acceptance lives in `tests/e2e/public-proof.spec.ts`; assigned helpers, reports and captures live here. No API/server/runtime, root dependency/lock input, deployment configuration, submission deck or canonical document was edited by this executor. Concurrent backend/canonical changes were preserved without staging, commit, reset, checkout or push.

[Reference provenance](references.md) records actual Magic UI/Watermelon pages, source and MIT licenses, and the Impeccable references. These are pattern references, not installed libraries. Original React/CSS/SVG implements the interaction with existing dependencies. No Impeccable launcher/binary, global hook, helper agent or library install ran. The unavailable-launcher fallback used existing project context; user authorization superseded additional aesthetic intake.

Bricolage Grotesque is openly licensed under SIL OFL 1.1. The upstream TTF and converted WOFF2, attribution and full license are in `apps/web/public/fonts/`; installed fontTools **4.56.0** performed/validated the conversion. CSS uses the local WOFF2. There is no remote font or tracking runtime dependency. The [source manifest](source-manifest.json) hashes the tested UI, fonts, preserved public constants/wallet helper and dependency inputs and records the production build ID.

## Exact verification

Runtime: Node **24.22.1**, cached pnpm **12.18.0**, installed Next **16.4.5**, Playwright **1.65.0**, existing Chromium **156.0.8078.4** from `chromium-1248`. No browser or dependency install was needed. PowerShell preparation for package commands was:

```powershell
$env:COREPACK_ENABLE_NETWORK='0'
$env:PATH='C:\nvm4w\nodejs\node_modules\corepack\shims;'+$env:PATH
```

| Observed command | Result |
| --- | --- |
| `corepack pnpm typecheck` | Exit 0; root TypeScript and web TypeScript passed; [output](typecheck.txt) |
| `corepack pnpm lint` | Exit 0; root ESLint passed; [output](lint.txt) |
| `corepack pnpm build` | Exit 0; optimized production build, TypeScript, static generation and route collection passed; [output](build.txt) |
| `corepack pnpm test:e2e tests/e2e/public-proof.spec.ts --workers=1` | Exit 0; **5 passed**, **7.9s**, against the final production build; [output](e2e.txt) |
| `UI_BASE_URL=http://127.0.0.1:3017 node docs/evidence/finals-ui/capture.mjs` | Exit 0; actual desktop/projector/tablet/390px/320px production captures; [browser results](browser-results.json) |
| `UI_BASE_URL=http://127.0.0.1:3017 node docs/evidence/finals-ui/audit.mjs` | Exit 0; **25 state/viewport combinations**, no computed text-contrast failures or controls below 44×44px; [accessibility results](accessibility-results.json) |
| `python -X utf8 tools/check-docs.py` | Exit 0; 21 canonical Markdown files passed |
| `python -X utf8 fmd/tools/check-implementation-plan.py docs/implementation-plan.md --strict` | Exit 0; 14 task rows and dependency/state DAG coherent |

Browser commands set `UI_BASE_URL=http://127.0.0.1:3017`; Playwright also set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=C:\Users\Vincent\AppData\Local\ms-playwright\chromium-1248\chrome-win64\chrome.exe`. This is local public-UI acceptance; mocked login responses are not a successful real authentication or backend release gate.

The five E2E tests exercised zero financial mutation calls while inspecting proof; refusal boundaries and focus retention; URL/reload persistence; keyboard tabs; recovery disclosure/no new payment action; real clipboard write/read plus denied clipboard fallback; exact hash-role links; full receipt and policy identity wrapping at 320px; all three paths at five widths; reduced-motion animation suppression; and mocked rejected/accepted login request contracts without a missing-console redirect.

Computed sRGB contrast across the sampled text was at least **5.3:1** on public proof and **5.62:1** on login. All sampled visible interactive targets met 44×44px. Keyboard focus reached the skip link with a visible 3px outline; tab/trace keyboard behavior passed E2E. Reduced-motion emulation produced `animation-name: none` on the selected path. No external runtime requests or browser page errors were observed. Each requested width had one h1, loaded display font, HTTP 200 and document scroll width equal to viewport width; expanded 320px identifiers also stayed within 320px. This is targeted automated/manual visual checking, not screen-reader, real-device, cross-browser or formal accessibility certification.

## Final visuals inspected

Authoritative final images are in [captures/](captures/), generated against the matching production build after sole UI ownership was confirmed. I opened and visually inspected all five viewport images plus desktop full-page/refusal/recovery/receipt/login, the focused projector view and 320px expanded receipt/identifier/login views. Early root-level `checkpoint-*`/`revision-*` images are interim history and are **not** final acceptance evidence.

- [1440 desktop](captures/desktop-viewport.png), [complete page](captures/desktop-full.png)
- [1280×720 projector](captures/projector-viewport.png), [focused evidence](captures/projector-focused.png)
- [768 tablet](captures/tablet-viewport.png)
- [390 phone](captures/mobile390-viewport.png), [320 phone](captures/mobile320-viewport.png)
- [Refusal](captures/desktop-refusal.png), [recovery design](captures/desktop-recovery.png)
- [Historical receipt](captures/desktop-receipt.png), [320px identifiers](captures/mobile320-identity.png)
- [Desktop login](captures/desktop-login.png), [320px login](captures/mobile320-login.png)

## Recovered failures and handoff

Initial `orca orchestration check --from` and `send --type message` were rejected; the documented `--terminal` and `--type status` forms recovered them. Direct `pnpm` was absent, and a first Corepack root typecheck could not invoke nested pnpm; adding the existing Corepack shim directory to this process's PATH recovered the exact complete gate without installation. Initial raw Magic UI guesses returned 404; the actual repository tree resolved the source/license paths.

A predecessor worker unexpectedly resumed while this replacement worked. Same-scope edits and competing 3015 preview/build output caused stale mixed captures and patch conflicts. I reported the conflict, paused with no in-flight mutations, preserved combined source and resumed only after coordinator fencing/sole-ownership confirmation (`msg_9767e7a54c75`). Initial custom/isolated Next preview attempts met a project lock, stale shared output and an unsuccessful Webpack compilation; those are not app-test passes. Final gates and captures use the actual application, normal Turbopack production build and dedicated production port 3017. Earlier preview artifacts are excluded from acceptance.

**Deployment handoff:** no deployment was performed. Coordinator visual acceptance is recorded in `msg_9b6bea2e513c`. Keep the matching local production preview at `http://127.0.0.1:3017` running as explicitly requested by the coordinator; it was started by this executor with `node docs/evidence/finals-ui/preview.mjs --production`. The coordinator now owns preview teardown, integration/source review, task checkpoint and a public **recorded-proof refresh** at the exact alias `https://aegispay-live.vercel.app/`. Preserve the exact submitted PDF/video-folder destinations and verify deployed HTML/assets/links/mobile behavior after promotion. If any UI source changes, rerun affected checks/build and recapture matching output.

The full model purchase, paid report access, authenticated live console, real wallet lifecycle, complete durable recovery and hosted application release remain separate TASK-005 onward gates. TASK-008 remains dependent on TASK-006. This redesign does not provide new chain evidence, a fresh policy, a second authorization, report entitlement, completed MP4 delivery, production security certification or full live-MVP acceptance.
