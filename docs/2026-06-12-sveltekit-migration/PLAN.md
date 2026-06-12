# llama.ui — SvelteKit 5 + Bits UI Migration

Migrate the app in a dedicated `feat/sveltekit` branch. Work proceeds phase-by-phase; each phase must pass its success condition before the next begins. The final phase merges to `main` and ships through the existing GitHub Pages deploy pipeline.

## Assumptions

- The new app keeps the exact same IndexedDB database name (`LlamacppWebui`) and schema — zero data loss.
- `@sveltejs/adapter-static` replaces the current Vite+React build; the GitHub Pages `deploy.yml` needs only the build command updated (`npm run build:prod`).
- `vite-plugin-pwa` is used in SvelteKit mode — the same PWA manifest and service worker configuration are preserved.
- Svelte 5 Runes are the primary state mechanism. Module-level `$state` in `.svelte.ts` files acts as singleton shared state (equivalent to React Context).
- The migration drops: highlight.js syntax theme switching, PDF upload, STT/TTS, Python canvas panel. These can be re-added in follow-up PRs.
- All 13 i18n locale JSON files are structurally flat enough that a conversion script can handle them; manual review is needed for edge cases.
- `marked` is the markdown renderer; KaTeX is integrated via the marked-katex-extension.

---

## Phase 1 — Scaffold & Infrastructure

**Goal:** A running SvelteKit 5 app on the `feat/sveltekit` branch with static adapter, PWA, TypeScript, and the correct base URL for GitHub Pages.

### Steps

1. Create `feat/sveltekit` branch from `main`.
2. **Delete** all `src/`, `index.html`, `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`, `eslint.config.js`, `tsconfig*.json` files in the branch — clean slate for SvelteKit scaffold.
3. Scaffold SvelteKit 5 project: `npx sv@latest create . --template minimal --types ts --no-add-ons`.
4. Install core dependencies:

   ```text
   @sveltejs/adapter-static
   vite-plugin-pwa
   bits-ui
   svelte-i18n
   dexie
   marked
   marked-katex-extension
   katex
   lucide-svelte
   ```

5. Configure `svelte.config.js`: set `adapter-static`, `fallback: '404.html'` (for GitHub Pages SPA routing), and `base` from env.
6. Configure `vite.config.ts`: port the PWA manifest and workbox config verbatim from the current `vite.config.ts`; add `vite-plugin-package-version`.
7. Restore CNAME step in `deploy.yml`; update build output path from `dist/` to `build/` (SvelteKit default).
8. Verify: `npm run build` produces a `build/` directory with `index.html` and the PWA service worker.

**Success condition:** `npm run dev` starts with no errors; `npm run build` produces a valid static bundle; PWA manifest is visible in DevTools.

**Parallel:** Steps 3–6 can proceed in parallel with Phase 2 setup (branch + file deletions must happen first).

---

## Phase 2 — Logic Layer Port (no UI)

**Goal:** All framework-independent logic compiles cleanly in the new project. This is the zero-risk phase — pure `.ts` files, no Svelte syntax.

### Steps

1. **Copy verbatim** (no changes):
   - `src/api/` (all providers + `message-normalization.ts`, `sse-parser.ts`, `response-utils.ts`, `config-mapper.ts`)
   - `src/database/indexedDB.ts`
   - `src/database/localStorage.ts`
   - `src/database/migration.ts` — remove the `react-hot-toast` import; replace `toast.error(...)` with `console.error(...)` (toast will be rewired in Phase 5)
   - `src/types/` (all 6 type files)
   - `src/utils/` (all utility files)
   - `src/config/` (all config files + JSON)
   - `src/services/inference-service.ts`
2. **i18n conversion:** Write a Node script (`scripts/convert-i18n.mjs`) that reads each `src/i18n/*.json` and writes it to `src/lib/i18n/` in svelte-i18n's flat format. Run and verify all 13 locales. Manually review keys with nested interpolation.
3. Configure `svelte-i18n` in `src/lib/i18n/index.ts`: register all 13 locales, set fallback to `en`, configure browser language detection.

**Dependencies:** Phase 1 complete (project structure exists).

**Success condition:** `npm run build` passes TypeScript compilation with no errors across all ported `.ts` files.

---

## Phase 3 — Design System & Theming

**Goal:** CSS custom properties design system that replaces DaisyUI's `data-theme` tokens and covers light/dark theming, typography, spacing, and colour palette.

### Steps

1. Create `src/app.css` with:
   - CSS custom properties for all design tokens: `--color-bg`, `--color-surface`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-fg`, `--radius-md`, `--radius-lg`, `--shadow-sm`, etc.
   - `[data-theme="light"]` and `[data-theme="dark"]` overrides that mirror the current DaisyUI light/dark palettes as closely as possible.
   - `@media (prefers-color-scheme: dark)` fallback for users without an explicit theme preference.
   - `@media (prefers-reduced-motion: reduce)` global rule that disables transitions.
   - Base resets: `box-sizing`, `font-family` (system-ui / Inter), `focus-visible` ring style.
2. Create utility classes for layout patterns used throughout the app (flex row/col, overflow scroll, etc.) — keep this minimal, scoped to patterns used at least 3 times.
3. Document the token map in `docs/2026-06-12-sveltekit-migration/DESIGN-TOKENS.md` for future reference.

**Dependencies:** Phase 1 complete.

**Success condition:** Applying `data-theme="dark"` to `<html>` produces a visually coherent dark palette; `data-theme="light"` produces a light one; no DaisyUI classes anywhere.

---

## Phase 4 — Shared State Modules

**Goal:** Svelte 5 Rune-based state modules replace React Context + useReducer. Each module is a `.svelte.ts` file exporting reactive state and actions.

### Steps

1. **`src/lib/state/app.svelte.ts`** — replaces `store/app.tsx`:
   - `$state`: `config`, `presets`, `currentTheme`, `currentSyntaxTheme`
   - Actions: `saveConfig`, `savePreset`, `removePreset`, `switchTheme`
   - `$effect` for init (load from LocalStorage + IndexedDB on mount)
2. **`src/lib/state/chat.svelte.ts`** — replaces `store/chat.tsx`:
   - `$state`: `viewingChat`, `pendingMessages`, `aborts`, `canvasData`
   - Actions: `sendMessage`, `stopGenerating`, `replaceMessage`, `branchMessage`
   - Uses Dexie `liveQuery` to keep `viewingChat` reactive without manual event-dispatch
3. **`src/lib/state/inference.svelte.ts`** — replaces `store/inference.tsx`:
   - `$state`: `provider`, `selectedModel`, `models`
   - Actions: `fetchModels`, `setProvider`
4. **`src/lib/state/modal.svelte.ts`** — replaces `store/modal.tsx`:
   - `$state`: queue of pending modal requests
   - Actions: `showConfirm`, `showAlert`

**Dependencies:** Phase 2 (types and DB layer) + Phase 1 (project exists).

**Success condition:** Each state module can be imported in a test `.svelte` file; reactive values update when actions are called; no React imports anywhere.

---

## Phase 5 — Primitive & Shared Components

**Goal:** Build the component library that pages will assemble. All a11y primitives use Bits UI; styling uses the Phase 3 design system.

### Components to build

| Component | Replaces | Notes |
|---|---|---|
| `Button.svelte` | `Button.tsx` | Variants: primary, ghost, neutral |
| `Input.svelte` | `Input.tsx` | Forwarded attributes |
| `Textarea.svelte` | `Textarea.tsx` | Auto-resize on input |
| `Dropdown.svelte` | `Dropdown.tsx` | Bits UI `DropdownMenu` |
| `Tooltip.svelte` | `BtnWithTooltips.tsx` | Bits UI `Tooltip` |
| `Dialog.svelte` | `store/modal.tsx` popup | Bits UI `Dialog`; focus trap built-in |
| `Toast.svelte` | `react-hot-toast` | Simple Svelte store queue; `aria-live="assertive"` |
| `Icon.svelte` | `Icon.tsx` | Thin wrapper around `lucide-svelte` |
| `Sidebar.svelte` | `Sidebar.tsx` | CSS-driven drawer; `<nav>` landmark |
| `Header.svelte` | `Header.tsx` | `<header>` landmark; hotkey wiring |
| `ConversationItem.svelte` | `ConversationItem.tsx` | |
| `ConversationGroup.svelte` | `ConversationGroup.tsx` | |
| `MarkdownDisplay.svelte` | `MarkdownDisplay.tsx` | `marked` + `marked-katex-extension`; `aria-live="polite"` on streaming container, debounced 400 ms |

### a11y requirements for this phase

- Every interactive element has a visible `:focus-visible` ring from the design system.
- `Sidebar.svelte` uses a `<nav>` with `aria-label="Conversations"`.
- `Dialog.svelte` traps focus (Bits UI built-in); `aria-labelledby` points to the dialog title.
- `Toast.svelte` uses `role="status"` and `aria-live="polite"`.
- `MarkdownDisplay.svelte`: the streaming message wrapper has `aria-live="polite"` and `aria-atomic="false"`; updates are announced by screen readers without re-reading the whole message.

**Dependencies:** Phase 3 (tokens), Phase 4 (state modules for Sidebar/Header), Phase 2 (i18n).

**Success condition:** Each component renders in isolation; Bits UI focus trap and keyboard navigation verified manually in the browser for Dialog and Dropdown.

---

## Phase 6 — Pages & Routing

**Goal:** All three pages work end-to-end with real data, matching current feature behaviour.

### Routes

| SvelteKit route | Replaces |
|---|---|
| `src/routes/+layout.svelte` | `App.tsx` AppLayout |
| `src/routes/+page.svelte` | `WelcomePage` |
| `src/routes/chat/[convId]/+page.svelte` | `ChatPage` |
| `src/routes/settings/+page.svelte` | `SettingsPage` |

### Chat page specifics

- Message list uses `{#each messages}` — no virtual list needed at current scale.
- Pending message slot renders directly from `chat.pendingMessages[convId]`.
- No FPS cap — `$state` updates from streaming propagate synchronously through Svelte's scheduler; scroll anchoring uses a single `requestAnimationFrame` callback.
- Conversation branching, message editing, and regeneration all wire to `chat.svelte.ts` actions.

### Settings page specifics

- Tab navigation: `<nav role="tablist">` with Bits UI `Tabs` primitive.
- Provider dropdown: `Dropdown.svelte`.
- Model fetch: debounced on provider/baseUrl/apiKey change (same pattern as current `useDebouncedCallback`).
- Import/export wired to `app.svelte.ts` actions.

### Keyboard hotkeys (global, registered in `+layout.svelte`)

- `Ctrl/Cmd + K` — focus search in sidebar
- `Ctrl/Cmd + N` — new conversation (navigate to `/`)
- `Ctrl/Cmd + ,` — open settings
- `Escape` — close sidebar (on mobile)

**Dependencies:** Phases 2–5 all complete.

**Success condition:** Full end-to-end user flow works: open app → see conversations → open chat → send message → see streaming response → open settings → change provider → save → return to chat.

---

## Phase 7 — QA, PWA & Deploy

**Goal:** Branch is production-ready and ships at the same URL with the same PWA behaviour.

### Steps

1. **Cross-browser smoke test:** Chrome, Firefox, Safari — chat send, streaming, settings save, theme switch.
2. **PWA install test:** install as PWA from Chrome; verify offline shell loads; verify update prompt appears after a code change.
3. **a11y audit:**
   - Run axe DevTools on Chat, Settings, and Welcome pages.
   - Verify keyboard-only navigation covers all interactive elements (tab through entire chat page without touching mouse).
   - Verify VoiceOver/NVDA announces streaming tokens via the live region.
4. **Data integrity check:** Open the app with an existing IndexedDB database from the React version; verify all conversations and messages load correctly.
5. Update `deploy.yml`: change build output path from `dist/` to `build/`; keep CNAME step.
6. Update `build.yml` and `build-pr.yml` similarly.
7. Update `MEMORY.md` with new stack facts.
8. Open PR: `feat/sveltekit` → `main`. Tag release after merge to trigger deploy.

**Dependencies:** Phase 6 complete.

**Success condition:** App is live at `llama-ui.js.org`, existing user data loads, PWA update prompt appears for users who had the React version installed.

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Dexie `liveQuery` Svelte integration is more complex than documented | Low | Dexie has first-class Svelte tutorial; fallback is manual `$effect` polling |
| svelte-i18n locale conversion breaks interpolated keys | Medium | Run conversion script + diff against source; manually review any key with `{{...}}` |
| `marked` + `marked-katex-extension` produces different HTML than `react-markdown` + `rehype-katex` | Medium | Visual regression pass against current rendered output; adjust CSS accordingly |
| Bits UI version incompatibility with Svelte 5 | Low | Bits UI v2+ is Svelte 5 native; pin version in `package.json` |
| PWA update prompt doesn't fire for users upgrading from React version | Medium | Service worker cache is keyed by build hash; hash changes on rebuild → prompt fires automatically |

---

## Completion Criteria

- `npm run build` passes with zero TypeScript errors.
- All three pages load and function correctly with real IndexedDB data.
- Streaming renders without an artificial FPS cap; tokens appear at display refresh rate.
- Keyboard-only navigation covers the full chat flow.
- Screen reader announces streaming tokens via `aria-live`.
- PWA installs and updates correctly.
- The GitHub Pages deploy completes successfully and the app is accessible at `llama-ui.js.org`.
- All conversations from the previous React version are visible and intact.

---

## Out of Scope (post-migration follow-ups)

- highlight.js syntax theme switching
- PDF file upload and parsing
- Speech-to-Text / Text-to-Speech
- Python Canvas / interpreter panel
- Virtual scrolling for very long conversation lists
