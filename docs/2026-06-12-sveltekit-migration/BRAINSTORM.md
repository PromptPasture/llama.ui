---
topic: Migrate llama.ui from React+Vite+DaisyUI to SvelteKit 5 + Bits UI
method: comparative analysis
date: "2026-06-12"
---

# Brainstorm — SvelteKit + Bits UI Migration

## Goal

Rewrite `llama.ui` from React 18 + Vite + TailwindCSS v4 + DaisyUI v5 to SvelteKit 5 + Bits UI + hand-rolled CSS, deployed as a static site on GitHub Pages. Primary drivers: uncapped render FPS during LLM streaming, meaningfully better accessibility (keyboard nav, screen reader, hotkeys), and full control over the visual design system without DaisyUI constraints.

## Context

`llama.ui` is a browser-only AI chat front-end (no backend). It supports 11 AI providers, stores all data in IndexedDB via Dexie, ships as a PWA, has 13 i18n locales, and is hosted on GitHub Pages via a static build. The React codebase is well-structured: thin API/DB layers, Context+useReducer state, and a clear page/component boundary. The React dependency is shallow enough that the logic layers (providers, DB, i18n JSON) can be ported with minimal change.

Key current bottleneck: the streaming render path is artificially capped at 25 FPS via `useFrameRateLimit` to avoid React's reconciliation cost. Svelte's compile-time reactivity removes this constraint entirely.

## Agenda

1. Migration strategy (branch vs incremental vs new repo)
2. UI styling approach (DaisyUI vs Bits UI vs shadcn-svelte)
3. Hosting (static adapter vs SSR)
4. Data layer (Dexie porting strategy)
5. i18n approach
6. Feature scope (what to keep, what to drop)
7. Render performance target
8. State management
9. Accessibility goals

## Ideas Considered

### Migration Strategy

- **Description:** Full rewrite in a new Git branch; ship at the same URL when done. Users receive the new app automatically via the PWA update prompt.
- **Benefits:** Clean codebase, no React/Svelte interop complexity, seamless for users (same URL, same IndexedDB, PWA handles the transition).
- **Trade-offs:** All-or-nothing; no incremental delivery. Risk is front-loaded.

*Alternatives considered:*

- Incremental migration (React + Svelte coexist): ruled out due to framework interop overhead and double-bundle cost.
- New repo / new URL: ruled out because users would lose their conversation history (or need a manual export/import).

### UI Styling

- **Description:** Drop DaisyUI entirely. Use Bits UI for accessible headless primitives (dialogs, dropdowns, tooltips, etc.) and hand-roll all visual styles with plain CSS / CSS custom properties.
- **Benefits:** Full design control, no DaisyUI class-name coupling, Bits UI gives correct ARIA behaviour out of the box, theme system becomes explicit CSS variables rather than DaisyUI's `data-theme` attribute magic.
- **Trade-offs:** More initial CSS work to re-skin everything. Theme switching (light/dark + syntax highlight) needs to be rebuilt around CSS variables.

*Alternatives considered:*

- Keep DaisyUI + add Bits UI on top: rejected — DaisyUI's opinionated classes would conflict with Bits UI's headless approach.
- shadcn-svelte: rejected — still opinionated and adds friction for custom theming.

### Hosting

- **Description:** `@sveltejs/adapter-static` pre-renders all routes to static HTML+JS. Identical output profile to the current Vite build. GitHub Pages deploy workflow unchanged.
- **Benefits:** Zero hosting cost change. No Node.js server required.
- **Trade-offs:** None — the app is already 100% client-side; SSR would add no value.

### Data Layer

- **Description:** Keep Dexie.js with the same database name (`LlamacppWebui`) and same schema version. Use Dexie's native `liveQuery` for Svelte reactive integration (documented at dexie.org/docs/Tutorial/Svelte).
- **Benefits:** Zero data loss — users' conversations, messages, and presets survive the migration unchanged. Dexie's migration machinery (`migrationLStoIDB`) is preserved as-is.
- **Trade-offs:** Dexie remains a runtime dependency (~22 KB gzip), but it was already there.

### i18n

- **Description:** Migrate from i18next + react-i18next to `svelte-i18n`. Convert the existing 13 JSON locale files to svelte-i18n's flat-key format (minimal structural change — the files are already mostly flat).
- **Benefits:** Idiomatic Svelte integration, no React adapter needed, reactive locale switching works naturally with Svelte stores.
- **Trade-offs:** Conversion of 13 JSON files is mechanical but requires a script or manual pass. All `t('key')` call sites need updating to svelte-i18n's `$_('key')` syntax.

### Render Performance

- **Description:** Remove the artificial 25 FPS cap (`useFrameRateLimit`). Rely on Svelte 5's compile-time fine-grained reactivity to batch DOM updates efficiently. Use `requestAnimationFrame` only where scroll anchoring during streaming requires it.
- **Benefits:** Streaming token output renders at the native display refresh rate (60/120/144 Hz). No manual frame budget management.
- **Trade-offs:** Svelte's reactivity is synchronous by default; very high token rates could still cause layout thrash. Mitigation: keep a lightweight rAF scroll hook, and batch pending-message state updates at the store level if needed.

### State Management

- **Description:** Svelte 5 Runes — `$state`, `$derived`, `$effect` — replace React Context + useReducer. Cross-component shared state lives in `.svelte.ts` module-level rune instances (Svelte's equivalent of a singleton context store).
- **Benefits:** More granular reactivity than React's top-down re-render model. Less boilerplate than Context+useReducer+dispatch.
- **Trade-offs:** Runes are Svelte 5 only — no fallback. Team must be comfortable with the new syntax.

### Accessibility

- **Description:** Bits UI provides correct focus traps, ARIA roles, and keyboard interactions for dialogs, dropdowns, tooltips, and select menus out of the box. Additional work: ARIA live regions (`aria-live="polite"`) on the streaming message container so screen readers announce incoming tokens, keyboard hotkeys (new chat, focus input, sidebar toggle), and visible focus-visible rings on all interactive elements.
- **Benefits:** Genuinely usable without a mouse; compliant with WCAG 2.1 AA for the core chat flow.
- **Trade-offs:** Live region announcements during high-speed streaming need rate-limiting (announce every N tokens or on pause) to avoid overwhelming screen readers.

## Outcomes

### Summary

Migrate `llama.ui` to SvelteKit 5 (static adapter) in a dedicated branch. Replace React with Svelte 5 Runes for state, Bits UI for accessible headless primitives, and hand-rolled CSS for full visual control. Keep Dexie (same DB, same schema) for zero data loss. Migrate i18n to svelte-i18n. Port all 11 AI provider `.ts` files unchanged. Remove the 25 FPS render cap and rely on Svelte's native reactivity. Drop highlight.js themes, PDF upload, STT/TTS, and the Python canvas panel (out of scope for this migration). Deliver via the same GitHub Pages URL; users get the new app through the existing PWA update prompt.

### Decisions

| Area | Decision |
| --- | --- |
| Framework | SvelteKit 5 + `@sveltejs/adapter-static` |
| State | Svelte 5 Runes (`$state`, `$derived`, `$effect`) in `.svelte.ts` modules |
| UI primitives | Bits UI (headless, a11y-correct) |
| Styling | Hand-rolled CSS + CSS custom properties for theming |
| Data | Dexie.js — same DB name, same schema, `liveQuery` for reactivity |
| i18n | svelte-i18n + converted locale JSON files |
| Markdown | Replace react-markdown → `marked` or `svelte-markdown` + KaTeX |
| PWA | `vite-plugin-pwa` (works with SvelteKit Vite build) |
| AI providers | Port all 11 as plain `.ts` files (zero framework dependency) |
| Rendering | No FPS cap; rAF used only for scroll anchoring |
| Hosting | GitHub Pages — no workflow changes beyond updating the build command |
| Seamlessness | Same URL + same IndexedDB = zero user friction; PWA update prompt surfaces the new version |

### Features Kept

- All 11 AI provider integrations
- Conversation branching (`branchConversation`)
- Import / export JSON
- PWA (installable, offline shell)
- Markdown rendering + KaTeX math
- Dark/light theme switching

### Features Dropped (out of scope for this migration)

- highlight.js syntax theme switching (can be re-added post-migration)
- PDF file upload and parsing
- Speech-to-Text / Text-to-Speech
- Python Canvas / interpreter panel

### Open Questions

- **Markdown library:** `svelte-markdown` vs `marked` + a custom Svelte renderer. Decision deferred to implementation — evaluate bundle size and KaTeX integration ease.
- **Hotkey library:** `svelte-hotkeys` or hand-rolled `keydown` listeners. Prefer hand-rolled if scope is small (< 5 hotkeys).
- **Live region throttle rate:** How often to push tokens to the ARIA live region during streaming. Recommend 500 ms debounce to avoid overwhelming screen readers — confirm during implementation.

## Next Steps

1. Create implementation plan with phased breakdown (foundation → data/state → pages → a11y polish → PWA/deploy).
2. Open a `feat/sveltekit` branch.
3. Scaffold SvelteKit project, configure static adapter and PWA.
4. Port data layer, AI providers, i18n.
5. Build components with Bits UI + hand-rolled CSS.
6. Wire up pages and routing.
7. a11y pass: live regions, focus traps, hotkeys.
8. QA against current feature set, then merge and ship.
