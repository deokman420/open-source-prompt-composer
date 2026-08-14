# Prompt Composer

A prompt-engineering workbench that runs entirely in your browser.

Your prompts, drafts, and API keys are stored on your own device — optionally
encrypted with a passphrase only you know. There is no account to create, no
database holding your work, and nothing to cancel.

**Live at [prompt.phbeks.com](https://prompt.phbeks.com)** · MIT licensed ·
self-hostable with one command.

---

## What's in it

| Tool | What it does |
|------|--------------|
| **Compose** | Build a prompt in a structured R-G-C-B-T-S frame (Role, Goal, Context, Bounds, Task, Success) with live preview, a completeness meter, starter templates, and export to 14 formats — Markdown, XML, cURL, and Python/TypeScript SDK snippets for Anthropic, OpenAI, Gemini, Bedrock, and Vertex. |
| **Orchestra** | Compose multi-agent systems from canonical orchestration patterns (orchestrator/worker, sequential, parallel, routing, debate, evaluator-optimizer, reflection) and export the whole bundle as runnable code. |
| **Context Pipeline** | Budget the context window like RAM: decide what each call sees, how much of the window it gets, what happens when it fills, and what survives a handoff. Measures real token counts against your provider. |
| **Eval** | Score a prompt against the R-G-C-B-T-S rubric, rewrite it for clarity, spellcheck it, or validate its code blocks — structured output, not a vibe check. |
| **Loops** | Build and save Claude Code `/loop` commands, with verifier-backed stop conditions. |
| **Tool Builder** | Design a tool-use JSON schema and validate it against each provider's accepted subset before wiring it into an agent. |
| **Drafts** | One searchable library across everything you've saved. |
| **AI Help** | A chat helpdesk that answers from a cited knowledge base about this app and about prompt/context engineering. |

Everything that calls a model uses **your own API key**. Supported providers:
Anthropic, OpenAI, Google, xAI, NVIDIA NIM, OpenRouter, and DeepSeek.

---

## How local-first works here

This is the part worth being precise about, because "local-first" gets used
loosely.

**Stored on your device, and nowhere else.** Prompts, drafts, eval history,
preferences, and API keys are written to your browser's IndexedDB. No copy is
uploaded. Clearing your browser data deletes all of it — there is nothing to
restore it from, so export a backup from Settings if you want one.

**Encrypted at rest, if you ask for it.** Setting a passphrase in Settings
encrypts the entire store with AES-GCM-256, keyed via PBKDF2-SHA256 at 210,000
iterations. The passphrase is held in memory for the life of the tab and is
never written anywhere.

There is **no passphrase recovery**. Nobody holds a copy — not this site, not
anyone. A forgotten passphrase means the vault cannot be opened, by anyone,
ever. That is the point, and it is also a real risk: export a backup.

What the unlock screen does offer is a way out: "Forgotten your passphrase?"
erases the vault and starts over, behind a typed confirmation. It has to live
there rather than in Settings, because the gate covers Settings too.

**Backups are always encrypted.** Export requires a passphrase; there is no
plaintext option. A backup file is the one copy of this data that leaves the
browser and lands somewhere durable — a Downloads folder, a synced directory, a
USB stick — which is exactly where cleartext API keys would do the most damage.

**Removing encryption requires the current passphrase**, so someone who finds an
unlocked tab can't strip protection and read the keys without knowing it.

Encryption is opt-in rather than forced. Unprotected still never leaves your
device, but it *is* readable by anyone with access to your browser profile. The
app says so plainly rather than deciding for you.

**What the server does.** Exactly one thing: `/api/proxy` accepts a request
containing your prompt and your API key, forwards it to the provider you chose,
and streams the response back. It exists because browsers cannot call most
provider APIs directly — they reject cross-origin requests outright.

It stores nothing. No database, no session, no cookie, no log of the key,
prompt, or completion. Your key lives in server memory for the duration of one
request and is then gone. Restarting the server loses nothing, because it was
holding nothing.

**Be clear-eyed about this:** on the hosted deployment your key does transit a
machine you don't control, in memory. If that's unacceptable for your threat
model, self-host — then the proxy is your own machine. That's a large part of
why this is open source.

**Your provider still sees your prompts.** Local-first protects your data from
*this app*. It doesn't change your relationship with Anthropic, OpenAI, or
whoever else you send text to, who handle it under their own retention terms.

**No tracking.** No analytics, no cookies, no third-party scripts, no external
fonts. The Content-Security-Policy sets `connect-src 'self'`, so a compromised
script would have nowhere to send anything.

---

## Run it yourself

Requires Node 22+.

```bash
git clone https://github.com/deokman420/open-source-prompt-composer.git
cd open-source-prompt-composer
npm install
npm run dev          # http://localhost:3000
```

For production:

```bash
npm run build
npm start
```

There are **no required environment variables**. No database to provision, no
auth provider to configure, no API keys to set server-side — users bring their
own at runtime.

### Optional configuration

| Variable | Purpose |
|----------|---------|
| `PROMPT_COMPOSER_ALLOWED_ORIGINS` | Comma-separated extra origins allowed to call `/api/proxy`. The proxy is same-origin-only by default so a public deployment isn't a free anonymizing relay in front of every major model API. Set this only if you serve the frontend from a different origin than the API. |

### Deploying

Any host that runs Next.js works. On Vercel it's zero-config — import the repo
and deploy; there is nothing to configure because there is nothing to connect
to.

Static export is *not* supported: the proxy needs a server runtime. If you want
a fully static build you'd have to call providers directly from the browser and
accept that several of them will fail CORS.

### Versioning

`npm run deploy` is the deploy path for the hosted instance. It stamps the
version, deploys, and pushes the tag:

```bash
npm run deploy        # version-stamp → vercel deploy --prod → git push --follow-tags
npm run version:check # print the version this commit would ship as
```

The version is derived from git rather than edited by hand:

```
version = <last tag's major>.<minor>.<patch + commits since that tag>
```

so `v0.2.0` plus one commit ships as `0.2.1`. Only the patch moves
automatically — a minor or major release is a judgement call, so tag it
yourself (`git tag v0.3.0`) and the count continues from there.

This matters beyond bookkeeping. The version feeds the footer build stamp *and*
`NEXT_PUBLIC_ASSET_VERSION`, the cache buster on `/public/composer/app.js` —
which sits at a fixed path Next never fingerprints, so a stale copy of it against
new HTML shows up as features quietly not binding. It's resolved on the deploying
machine because `.vercelignore` excludes `.git`, leaving a Vercel build with no
repository to count commits in.

---

## Development

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm test            # unit tests (crypto, eval parsing, providers)
npm run test:e2e    # Playwright
```

### Layout

```
src/
  app/
    api/proxy/          the only server surface — stateless BYOK forwarder
    api/count-tokens/   same contract, for exact token counts
    _shell/             app chrome, vault gate, nav
    _shared/            FeatureDrafts — one drafts strip for every feature
    compose/            hosts the vanilla composer bundle
    <feature>/          orchestra, context-pipeline, eval, loops, tools, …
  lib/
    vault/              crypto, IndexedDB, schema + migrations, React store
    providers/          seven provider adapters, streaming + non-streaming
    client/model.ts     browser-side model client (talks to the proxy)
    <feature>/          pure logic: types, templates, exporters, validators
public/composer/        the original vanilla composer (app.js + style.css)
```

**A note on `public/composer/app.js`.** Compose is not React. It's the original
DOM-driven bundle, and it's kept deliberately: ~1,900 lines of proven logic for
the frame, preview, exporters, templates, and share links. It has exactly one
modification from the standalone version — storage goes through `PC_STORE`
instead of `localStorage`, so `ComposerHost` can route it into the encrypted
vault. If you edit that file, keep that indirection.

### The vault

`src/lib/vault/` is the core. The whole user document is a single JSON blob,
encrypted as one envelope and written as one IndexedDB record — which makes
saves atomic and export/import trivial, at the cost of re-encrypting everything
per write (negligible at text sizes; the expensive key derivation is memoized).

Changing the document shape means bumping `SCHEMA_VERSION` and extending
`migrate()`. Never repurpose an existing version's fields: an old vault in
someone's browser is the only copy of their data.

---

## Contributing

Issues and PRs welcome. Two rules that matter more than style:

1. **Nothing user-authored may leave the browser** except as a request to the
   provider the user explicitly chose. No telemetry, no error reporting that
   carries prompt text, no "anonymous" usage pings.
2. **The proxy stays stateless.** No logging of keys, prompts, or completions;
   no caching; no persistence. A `console.log(body)` in that file quietly turns
   a zero-knowledge proxy into a key-harvesting one.

## License

MIT — see [LICENSE](LICENSE).
