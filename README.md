# 🦙 llama.ui - Minimal Interface for Local AI Companion ✨

**Tired of complex AI setups?** 😩 `llama.ui` is an open-source web application that provides a beautiful ✨, user-friendly interface for interacting with large language models (LLMs). Designed for simplicity and privacy 🔒, it runs entirely in your browser — no cloud required! 🚫☁️

## ⚡ TL;DR

This repository is a fork of [llama.cpp](https://github.com/ggml-org/llama.cpp) WebUI with:

- Fresh new styles 🎨
- Extra functionality ⚙️
- Smoother experience ✨

![welcome-screen](public/screenshots/desktop.png)

## 🌟 Key Features

1. **Multi-Provider Support**: Works with llama.cpp, LM Studio, Ollama, vLLM, OpenAI, and many more!

2. **Conversation Management**:
   - IndexedDB storage for conversations
   - Branching conversation support (edit messages while preserving history)
   - Search by title or by anything said inside a conversation
   - Import/export functionality
   - Half-written messages stay with the conversation they were typed in

3. **Attachments** 📎:
   - Attach text files and images — pick them, drop them on the message box, or paste a screenshot
   - Paste a long log and it becomes an attachment instead of burying the box
   - Says up front when the chosen model cannot read images, where the provider tells us

4. **Rich UI Components**:
   - Markdown rendering with KaTeX math support
   - Theme customization: light, dark, or follow the system
   - Responsive design for mobile and desktop
   - Keyboard shortcuts for a new conversation, search and settings — named on the buttons themselves

5. **Your data stays yours**:
   - Export and import the whole history as JSON, or save one conversation as
     Markdown
   - Clear the conversations in one go, or forget everything — presets and the
     API key included — when handing the machine on
   - An export leaves your API key out of it, so a history you send to someone
     carries no credentials

6. **Advanced Features**:
   - PWA support with offline capabilities
   - Streaming responses with Server-Sent Events
   - Customizable generation parameters
   - Performance metrics display
   - Replies read aloud, using the browser's own speech synthesis

7. **Privacy Focused**: All data is stored locally in your browser - no cloud required!

8. **Localized Interface**: Twelve languages ship with the app, and you can switch at any time.

## 🚀 Getting Started in 60 Seconds!

### 💻 Standalone Mode (Zero Installation)

1. ✨ Open our [hosted UI instance](https://llama-ui.js.org/)
2. ⚙️ Click the gear icon → General settings
3. 🌐 Set "Base URL" to your local llama.cpp server (e.g. `http://localhost:8080`)
4. 🎉 Start chatting with your AI!

<details><summary><b>🔧 Need HTTPS magic for your local instance? Try this mitmproxy hack!</b></summary>
<p>

**Uh-oh!** Browsers block HTTP requests from HTTPS sites 😤. Since `llama.cpp` uses HTTP, we need a bridge 🌉. Enter [mitmproxy](https://www.mitmproxy.org/) - our traffic wizard! 🧙‍♂️

**Local setup:**

```bash
mitmdump -p 8443 --mode reverse:http://localhost:8080/
```

**Docker quickstart:**

```bash
docker run -it -p 8443:8443 mitmproxy/mitmproxy mitmdump -p 8443 --mode reverse:http://localhost:8080/
```

**Pro-tip with Docker Compose:**

```yml
services:
  mitmproxy:
    container_name: mitmproxy
    image: mitmproxy/mitmproxy:latest
    ports:
      - '8443:8443' # 🔁 Port magic happening here!
    command: mitmdump -p 8443 --mode reverse:http://localhost:8080/
    # ... (other config)
```

> ⚠️ **Certificate Tango Time!**
>
> 1. Visit http://localhost:8443
> 2. Click "Trust this certificate" 🤝
> 3. Restart 🦙 llama.ui page 🔄
> 4. Profit! 💸

**Voilà!** You've hacked the HTTPS barrier! 🎩✨

</p>
</details>

### 🖥️ Full Local Installation (Power User Edition)

1. 📦 Grab the latest release from our [releases page](https://github.com/olegshulyakov/llama.ui/releases)
2. 🗜️ Unpack the archive (feel that excitement! 🤩)
3. ⚡ Fire up your llama.cpp server:

**Linux/MacOS:**

```bash
./server --host 0.0.0.0 \
         --port 8080 \
         --path "/path/to/llama.ui" \
         -m models/llama-2-7b.Q4_0.gguf \
         --ctx-size 4096
```

**Windows:**

```bat
llama-server ^
             --host 0.0.0.0 ^
             --port 8080 ^
             --path "C:\path\to\llama.ui" ^
             -m models\mistral-7b.Q4_K_M.gguf ^
             --ctx-size 4096
```

4. 🌐 Visit http://localhost:8080 and meet your new AI buddy! 🤖❤️

## 🌟 Join Our Awesome Community!

**We're building something special together!** 🚀

- 🎯 **PRs are welcome!** (Seriously, we high-five every contribution! ✋)
- 🐛 **Bug squashing?** Yes please! 🧯
- 📚 **Documentation heroes** needed! 🦸
- ✨ **Make magic** with your commits! (Follow [Conventional Commits](https://www.conventionalcommits.org))

## 🛠️ Developer Wonderland

**Prerequisites:**

- 💻 macOS/Windows/Linux
- ⬢ [Node.js](https://nodejs.org/) >= 22
- 🦙 Local [llama.cpp server](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) humming along

**Build the future:**

```bash
npm ci         # 📦 Grab dependencies
npm run build  # 🔨 Craft the magic
npm start      # 🎬 Launch dev server (http://localhost:5173) for live-coding bliss! 🔥
```

**Before opening a pull request** — CI runs all three, so save yourself a round trip:

```bash
npm test       # 🧪 Run the suite
npm run lint   # 🧹 ESLint + Prettier
npm run check  # 🔍 svelte-check (types)
```

`npm run format` rewrites `src/` with Prettier if the lint step complains.

**Against a server you are actually running** — mocks answer the shape they
were told to, so a few checks talk to a real one. They are skipped unless you
point them at it:

```bash
LLAMA_UI_LIVE_URL=http://localhost:1234 npm test
```

### 🧰 Preconfiguring Defaults

Planning to redistribute the app with opinionated settings out of the box? Any JSON under
[`src/lib/config`](src/lib/config) is baked into immutable defaults at build time (see
[`src/lib/config/index.ts`](src/lib/config/index.ts)).

If those baked defaults include a non-empty `baseUrl`, the inference server will auto-sync on first load
so model metadata is fetched without requiring manual input.

### 🏗️ Architecture

#### Core Technologies

- **Frontend**: [SvelteKit 5](https://svelte.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **State Management**: Svelte 5 Runes (`$state`, `$derived`, `$effect`) in `.svelte.ts` modules
- **UI Primitives**: hand-rolled components in `src/lib/components`
- **Styling**: [TailwindCSS v4](https://tailwindcss.com/) + CSS custom properties for theming
- **Storage**: IndexedDB via [Dexie.js](https://dexie.org/)
- **Markdown**: [marked](https://marked.js.org/) + [marked-katex-extension](https://github.com/UziTech/marked-katex-extension), sanitised with [DOMPurify](https://github.com/cure53/DOMPurify)
- **Testing**: [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/docs/svelte-testing-library/intro/)
- **i18n**: [svelte-i18n](https://github.com/kaisermann/svelte-i18n)
- **Build Tool**: [Vite](https://vite.dev/) + [`@sveltejs/adapter-static`](https://kit.svelte.dev/docs/adapter-static)

#### Key Modules

| Path                                | Responsibility                                           |
| ----------------------------------- | -------------------------------------------------------- |
| `src/lib/state/app.svelte.ts`       | Config, presets, theme                                   |
| `src/lib/state/chat.svelte.ts`      | Conversation, streaming, branching                       |
| `src/lib/state/inference.svelte.ts` | Provider, model list                                     |
| `src/lib/state/modal.svelte.ts`     | Confirm / prompt / alert dialogs                         |
| `src/lib/state/tts.svelte.ts`       | Reading a reply aloud                                    |
| `src/lib/api/`                      | Provider implementations, and the factory that picks one |
| `src/lib/services/`                 | Turning a chat completion stream into message updates    |
| `src/lib/database/`                 | IndexedDB (Dexie) + localStorage                         |
| `src/lib/components/`               | Shared UI component library                              |
| `src/lib/utils/`                    | The small decisions, kept testable on their own          |
| `src/routes/`                       | SvelteKit pages and layouts                              |

## 📜 License - Freedom First!

llama.ui is proudly **MIT licensed** - go build amazing things! 🚀 See [LICENSE](LICENSE) for details.

---

<p align="center">
Made with ❤️ and ☕ by humans who believe in private AI
</p>
