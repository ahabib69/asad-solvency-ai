# ASAD SOLVENCY — *Every Problem Has A Way Forward.*

A premium AI assistant platform built around four things:

| Feature | What it does |
|---|---|
| **Problem Solver** (the core) | Streaming AI that understands your situation, asks the right follow-up questions, finds the root problem and answers in clear sections: *Understanding the problem → What is actually happening → Recommended solution → Alternative solutions → Potential risks → Your next move.* Copy, regenerate, read aloud, 👍/👎 feedback, voice dictation and saved history. |
| **Live AI** (signature feature) | Full-screen holographic robot companion. It fades in, greets you out loud, listens through your microphone, thinks, and answers by voice. Its mouth moves with the real audio, and its face changes with the mood of the reply (happy, curious, concerned, empathetic…). Hands-free mode, voice picker, speed and pitch, mute, transcript, end session. |
| **4K Creative Studio** | Text-to-image, reference-photo transformation with **face identity preservation**, style presets (photoreal, cinematic portrait, fantasy, product, 3D character), aspect ratios, prompt enhancer, gallery, download, optional **true 4K upscaling**. |
| **Make Yourself Useful** | Personalised, practical things to do based on your interests, skills, time, energy and goals: earn money, learn something, creative challenge, start a project, routine, 10-minute task. |

| **Web Browser** | A browser that looks like Chrome, built into the site. It has tabs (open, switch, close; middle-click also closes), Back, Forward, Refresh and Home buttons, an address bar that takes a URL or a search, a Go button, quick links (Google, YouTube, Wikipedia), a new-tab page and a recently-visited list. When a site refuses to be embedded, it shows a friendly *"This site blocked embedding - Open in new tab"* screen with an **Open** button. |

Also included: Home dashboard (galaxy hero, quick problem pills, quick access, recent conversations, daily suggestions), Conversation History (search, filter, rename, pin, delete, export), Settings (profile/avatar, AI tone, language, voice, theme, integrations status, data), global search (Ctrl/⌘ K), notifications, dark/light theme, collapsible sidebar, and responsive desktop/tablet/mobile layouts.

---

## 1. Quick start

**Requirements:** Node.js **18.17+** (20 LTS recommended) and npm.

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env          # Windows: copy .env.example .env
#    open .env and paste your OPENAI_API_KEY (see section 2)

# 3. check which integrations are live
npm run check

# 4. run in development (API on :8787 + web app on :5173 with hot reload)
npm run dev
```

Open **http://localhost:5173**.

### Production

```bash
npm run build     # builds the frontend into /dist
npm start         # one Node server on :8787 serves the API and the built app
```

Open **http://localhost:8787**. To deploy, put this behind any Node host (Render, Railway, Fly.io, a VPS with PM2, Docker…). Set the same environment variables on the host.

> 🎙️ **Microphone note:** browsers only allow microphone access on **https://** or **http://localhost**. Use HTTPS when you deploy.

---

## 2. Where to put your API keys

All keys go in **one file: `.env` in the project root.** It is read **only by the backend**. Keys never reach the browser, and every AI request goes through `/api/*` on your own server.

| Variable | Needed for | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | **Recommended.** One key powers chat, Live AI replies, image generation (gpt-image-1), neural voices (TTS) and Whisper speech-to-text | https://platform.openai.com/api-keys |
| `LLM_API_KEY` + `LLM_BASE_URL` + `LLM_MODEL` | *Optional.* Use a different chat provider (OpenRouter, Groq, Together, DeepSeek, local Ollama…). Any OpenAI-compatible API works | your provider |
| `STABILITY_API_KEY` | *Optional.* Turns on **Upscale to 4K**, or use Stability as the image engine with `IMAGE_PROVIDER=stability` | https://platform.stability.ai/account/keys |

Minimal `.env`:

```env
OPENAI_API_KEY=sk-...your-key...
```

Restart `npm run dev` after editing `.env`. Then open **Settings → Integrations** in the app and press **Re-check**. A green tick means it is connected.

### What works without any key?

The interface still runs fully. Navigation, history, settings, the Live AI avatar, browser speech recognition and the browser voice all work. AI answers and image generation show a clear **"not configured"** message that tells you exactly which variable to add. Nothing is faked.

---

## 3. How each integration works

### Conversational AI (`server/lib/llm.js`)
- Any **OpenAI-compatible Chat Completions** endpoint, streamed to the browser with Server-Sent Events.
- The system prompts in `server/lib/prompts.js` are the "brain". Edit them to change how Asad Solvency thinks. They cover the six-section format, when to ask follow-up questions, honesty rules, safety and tone (balanced / direct / gentle / coach).
- `LLM_LIVE_MODEL` lets you pick a faster model for the real-time voice conversation.

### Live AI (`client/src/pages/LiveAI.jsx`, `components/live/RobotPersona.jsx`)
- **Avatar:** an original SVG + requestAnimationFrame robot. It needs no third-party avatar service. Features: 3D parallax head movement that follows your cursor, blinking, gaze, a holographic visor, ear rings, chest core, floating particles and a materialise animation.
- **Lip-sync:** with the neural voice, the mouth equaliser is driven by the **real audio amplitude** (Web Audio AnalyserNode). With the browser voice, it is driven by word-boundary events.
- **Expressions:** the model tags each reply with an emotion (`[[emotion:concerned]]`), and the face changes its brows, lids and smile to match.
- **Speech input:** uses the Web Speech API in Chrome, Edge and Safari, with live captions. Elsewhere (for example Firefox) it records audio, detects when you stop speaking and sends the audio to **Whisper** through `/api/transcribe`.
- **Speech output:** uses **OpenAI TTS** (`/api/tts`, 10 voices, adjustable speed) when it is configured. Otherwise it uses the browser `speechSynthesis` voices. If the neural voice fails, it switches to the browser voice automatically.
- **Want a photoreal talking avatar instead?** Swap `<RobotPersona>` for a provider such as D-ID, HeyGen or Simli. The component receives `state`, `emotion` and a live `getLevel()` audio level, so any renderer can plug in.

### Creative Studio (`server/routes/images.js`)
- **OpenAI `gpt-image-1`** (default) handles text-to-image and `/images/edits` with up to 4 reference photos. When **Preserve facial identity** is on, it sends `input_fidelity=high` plus a strict identity instruction.
- **Stability AI** (`IMAGE_PROVIDER=stability`) uses Stable Image Core/Ultra with native aspect ratios, and SD3.5 for image-to-image.
- **4K:** OpenAI images are up to 1536 px. **Upscale to 4K** uses Stability's conservative upscaler (needs `STABILITY_API_KEY`).
- Images are saved in `server/data/images/` and listed in your gallery.

### Web Browser (`client/src/pages/WebBrowser.jsx`, `server/routes/browser.js`)
- Pages load in a sandboxed `<iframe>` that fills the full height. Every tab keeps its own iframe loaded, so switching tabs keeps your place, like Chrome. Open tabs are restored when you reload the page (saved in localStorage).
- **How blocked sites are detected:** a browser won't tell a page when a cross-origin frame was refused. So the backend (`GET /api/browser/inspect?url=`) reads the site's `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` headers. It also picks up the page title for the tab. The checker refuses to look up private or internal addresses, to prevent SSRF, and caches results for 10 minutes.
- **Smart rewrites:** `google.com` and Google searches load Google's embeddable mode (`igu=1`). YouTube video links (`watch?v=`, `youtu.be`, `shorts`) open in the official embeddable player. The YouTube homepage, GitHub, Facebook, Bing and similar sites block embedding, so you get the Open-in-new-tab screen for them.
- **Limits of browser security:** Back/Forward step through the addresses you open from the address bar, bookmarks or new-tab page. Links you click *inside* a page still work, but the browser hides those cross-origin navigations from the app, so they don't appear in history. Shortcuts: **Alt+T** new tab, **Alt+W** close tab, **Alt+D** focus the address bar, **Alt+1…9** switch tabs. Ctrl+T and Ctrl+W are reserved by the browser.
- Quick links live in `client/src/lib/browser.js` (`QUICK_LINKS`).

### Storage (`server/lib/store.js`)
- Conversations, feedback and the image list are kept in `server/data/db.json`, written atomically. For multi-user production, replace the functions in this one module with Postgres, SQLite or MongoDB calls. No other file needs to change.
- UI settings (name, avatar, voice, theme) are saved in the browser's localStorage.

---

## 4. Project structure

```
ASAD_SOLVENCY_AI/
├── .env.example             ← copy to .env and add keys
├── package.json             ← scripts: dev, build, start, check
├── scripts/check-env.js     ← `npm run check`
├── server/                  ← Express backend (keys live here only)
│   ├── index.js             ← app, security headers, rate limit, static hosting
│   ├── config.js            ← reads .env, reports integration status
│   ├── lib/
│   │   ├── llm.js           ← OpenAI-compatible client (stream + complete)
│   │   ├── prompts.js       ← Problem Solver / Live / Useful system prompts
│   │   └── store.js         ← JSON persistence (swap for a DB)
│   ├── routes/
│   │   ├── chat.js          ← POST /api/chat (SSE), POST /api/live
│   │   ├── conversations.js ← history CRUD, feedback, export
│   │   ├── images.js        ← generate, edit, enhance, upscale, gallery
│   │   ├── voice.js         ← /api/tts, /api/transcribe, /api/voices
│   │   └── browser.js       ← /api/browser/inspect (iframe-embedding check)
│   └── data/                ← db.json + generated images (git-ignored)
└── client/                  ← React 18 + Vite frontend
    ├── index.html
    ├── vite.config.js       ← dev proxy /api → :8787
    ├── public/assets/       ← galaxy hero, onion avatar, moon banner
    └── src/
        ├── App.jsx, main.jsx
        ├── api/client.js            ← fetch + SSE stream reader
        ├── context/AppContext.jsx   ← settings, status, toasts, history
        ├── hooks/useChatStream.js   ← streaming chat state machine
        ├── hooks/useSpeechInput.js  ← mic: Web Speech / Whisper + VAD
        ├── lib/voice.js             ← TTS engine with lip-sync level
        ├── components/
        │   ├── layout/   Sidebar, Topbar, LivePanel, AppLayout
        │   ├── chat/     Composer, MessageBubble, StructuredMarkdown
        │   ├── live/     RobotPersona, ParticleField
        │   └── ui/       Logo, Modal, Toasts, PremiumModal, ConfigNotice
        ├── pages/        Home, ProblemSolver, LiveAI, CreativeStudio,
        │                 MakeUseful, WebBrowser, History, Settings
        └── styles/       base, layout, home, chat, live, pages (.css)
```

## 5. API reference

| Method & path | Purpose |
|---|---|
| `GET /api/status` | Which integrations are configured (no secrets) |
| `POST /api/chat` | `{ message, conversationId?, mode: solver\|useful, regenerate?, settings }` → SSE events `meta`, `delta`, `done`, `error` |
| `POST /api/live` | `{ message, conversationId?, settings }` → `{ reply, emotion, conversationId }` |
| `GET/PATCH/DELETE /api/conversations[/:id]` | History list / rename & pin / delete |
| `POST /api/conversations/:id/messages/:mid/feedback` | `{ value: up\|down\|null }` |
| `GET /api/conversations/export` | Download all history as JSON |
| `POST /api/images/generate` | multipart: `prompt, style, aspect, quality, preserveIdentity, references[]` |
| `POST /api/images/:id/upscale` | 4K upscale (Stability) |
| `POST /api/images/enhance` | Rewrite an idea into a pro image prompt |
| `GET /api/browser/inspect?url=` | `{ embeddable: true\|false\|null, reason, title, finalUrl }` |
| `POST /api/tts` | `{ text, voice, speed }` → audio/mpeg |
| `POST /api/transcribe` | multipart `audio` → `{ text }` |

## 6. Customising

- **Brand / colours:** design tokens are at the top of `client/src/styles/base.css` (`--bg #0B0B1A`, `--violet #8B5CF6`, `--blue #3B82F6`…).
- **Quick problem pills, categories, Useful actions, Live greeting:** `client/src/lib/data.js`.
- **AI personality:** `server/lib/prompts.js`.
- **Images:** replace the files in `client/public/assets/` (keep the same names).

## 7. Premium & billing

The **Go Premium** card and modal are fully built, but **no payment provider is connected and no payment is taken**. To sell subscriptions:
1. Create a product and price in Stripe and generate a Checkout or Payment Link.
2. In `client/src/components/ui/PremiumModal.jsx`, replace the toast in the *Upgrade Now* handler with `window.location.href = 'https://buy.stripe.com/...'`. For full accounts, add a `/api/billing/checkout` route that uses the Stripe SDK with `STRIPE_SECRET_KEY` on the server.
3. Add user accounts (for example Clerk, Auth.js or Supabase Auth) and gate premium features on the server.

## 8. Security notes

- Provider keys exist only in server memory (`server/config.js`). The frontend calls only same-origin `/api/*` routes.
- AI endpoints have per-IP rate limiting (`RATE_LIMIT_PER_MIN`). Uploads accept only PNG, JPG or WEBP files up to 20 MB, at most 4 files.
- `.env`, `server/data/db.json` and generated images are git-ignored.
- This build is single-user (your own device or server). Add authentication before you expose it publicly to many users.

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| "AI is not configured yet" | Add `OPENAI_API_KEY` to `.env` and restart. Then run `npm run check`. |
| "rejected the API key (401)" | The key is wrong or revoked, or the account has no billing set up. |
| "model or endpoint not found" | Check `LLM_MODEL`, `LLM_BASE_URL` and `OPENAI_IMAGE_MODEL`. |
| Mic button disabled | Use Chrome or Edge, or add `OPENAI_API_KEY` for Whisper. Allow microphone permission. Use HTTPS when deployed. |
| No voice heard | Unmute in Live AI. Pick another voice under Voice settings. On Linux, install system TTS voices or use the neural voice. |
| Image generation fails for gpt-image-1 | The OpenAI organisation may need verification for image models. Otherwise use `IMAGE_PROVIDER=stability`. |
| Cannot reach server | Make sure `npm run dev` is running and port 8787 is free (or change `PORT`). |

---

Made with 💜 for Asad. *Dream Bigger. Solve Smarter.*
