# Migration Task List

## Phase 1 — Scaffold & Infrastructure

- [ ] Create `feat/sveltekit` branch from `main`
- [ ] Delete React project files (src/, index.html, vite/tailwind/eslint/tsconfig) (Deferred to end for reference)
- [ ] Scaffold SvelteKit 5 with `npx sv@latest create`
- [ ] Install core dependencies
- [ ] Configure `svelte.config.js` (adapter-static, fallback, base URL)
- [ ] Configure `vite.config.ts` (PWA manifest, workbox, package-version)
- [ ] Update `deploy.yml`, `build.yml`, `build-pr.yml` build output path
- [ ] Verify: `npm run build` produces valid static bundle with PWA SW

## Phase 2 — Logic Layer Port

- [ ] Copy API providers verbatim
- [ ] Copy database layer (fix react-hot-toast in migration.ts)
- [ ] Copy types, utils, config, services
- [ ] Write i18n conversion script + convert all 13 locales
- [ ] Configure svelte-i18n
- [ ] Verify: TypeScript compiles with no errors

## Phase 3 — Design System & Theming

- [ ] Create `src/app.css` with CSS custom properties
- [ ] Light/dark theme token sets
- [ ] `prefers-reduced-motion` global rule
- [ ] Base resets + focus-visible ring
- [ ] Minimal utility classes
- [ ] Verify: theme switching produces coherent palettes

## Phase 4 — Shared State Modules

- [ ] `app.svelte.ts` (config, presets, theme)
- [ ] `chat.svelte.ts` (viewingChat, pendingMessages, actions)
- [ ] `inference.svelte.ts` (provider, models)
- [ ] `modal.svelte.ts` (confirm/alert queue)
- [ ] Verify: reactive updates work in test component

## Phase 5 — Primitive & Shared Components

- [ ] Button, Input, Textarea, Icon
- [ ] Dropdown (Bits UI DropdownMenu)
- [ ] Tooltip (Bits UI Tooltip)
- [ ] Dialog/Modal (Bits UI Dialog + focus trap)
- [ ] Toast (aria-live queue)
- [ ] Sidebar (nav landmark, drawer)
- [ ] Header
- [ ] ConversationItem, ConversationGroup
- [ ] MarkdownDisplay (marked + KaTeX + aria-live)
- [ ] Verify: Bits UI focus traps and keyboard nav work in browser

## Phase 6 — Pages & Routing

- [ ] `+layout.svelte` (AppLayout + global hotkeys)
- [ ] `+page.svelte` (Welcome)
- [ ] `chat/[convId]/+page.svelte` (Chat — streaming, branching, edit, regen)
- [ ] `settings/+page.svelte` (Settings — tabs, provider, import/export)
- [ ] Verify: full end-to-end user flow works

## Phase 7 — QA, PWA & Deploy

- [ ] Cross-browser smoke test (Chrome, Firefox, Safari)
- [ ] PWA install + update prompt test
- [ ] a11y audit (axe + keyboard-only + screen reader)
- [ ] Data integrity check (load existing IndexedDB)
- [ ] Update deploy.yml / build.yml output paths
- [ ] Update MEMORY.md
- [ ] Open PR feat/sveltekit → main, tag release
