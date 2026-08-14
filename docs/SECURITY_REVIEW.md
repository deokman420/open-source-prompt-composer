# Security review — 2026-08-14

Scope: the whole surface of this app at commit `cf3a1c4`, reviewed against the
one claim it makes — *your prompts and API keys stay on your device, and are
encrypted at rest if you set a passphrase*.

Everything below was checked by reading the code **and** by driving the running
app and inspecting what actually landed. Four of the six issues found in this
codebase to date were invisible to `tsc`, the build, and the UI; static review
alone is not sufficient here.

---

## Fixed in this pass

### 1. PBKDF2 work factor below the OWASP floor — *medium*

The vault derived its key with **210,000** PBKDF2-SHA256 iterations, inherited
from `cbapp.html`. OWASP's floor for PBKDF2-SHA256 is **600,000**. At 210k an
offline attacker with the encrypted blob gets roughly 3× more guesses per unit
of hardware.

This matters more than usual because the threat model is precisely an offline
one: the ciphertext sits in IndexedDB on a machine someone else may get at, and
the passphrase is the only secret.

**Fixed.** Raised to 600k. The count is written into the envelope's `kdf` field
and read back from there, so existing 210k vaults still open and are silently
re-sealed at 600k on the next save. Removing an entry from `LEGACY_ITERATIONS`
would permanently orphan those vaults — the constant says so.

Cost: unlock now takes ~0.5s instead of ~0.2s. Autosave is unaffected (the
derived key is memoized per passphrase+salt+work-factor).

### 2. Missing HSTS — *low*

No `Strict-Transport-Security` header. Vercel serves HTTPS, but the policy
should be pinned by the app so self-hosters inherit it.

**Fixed.** `max-age=63072000; includeSubDomains; preload`, production only.

### 3. Password fields outside forms; no username field — *low (a11y/UX)*

Browsers warned, and password managers could neither save nor fill the vault
passphrase. Not an exploit, but it pushes users toward weaker passphrases they
can remember.

**Fixed.** Every password field is now inside a real `<form>` with a hidden,
constant `autocomplete="username"` identity. There are no accounts here, so the
identity is a fixed handle (`prompt-composer-vault`) rather than an invented
user record.

### 4. Dead link to a removed route — *informational*

AI Help linked to `/account/keys`, which does not exist in this build.
**Fixed** — points at `/settings`.

---

## Reviewed and found sound

**XSS via the composer's `innerHTML`.** Twelve `innerHTML` sites in
`public/composer/app.js`. All write *static* markup and then set user content
via `.textContent` — including `row.snippet`, the one genuinely
attacker-influenced value. This is the correct pattern; no change needed.

**XSS via AI Help's link rendering.** Help renders `[label](url)` from *model
output*, which is the closest thing here to untrusted input. Both the Markdown
and bare-URL regexes require a literal `https?://` prefix, so `javascript:`,
`data:`, and `vbscript:` URLs cannot match. An allowlist, not a denylist —
correct.

**No `dangerouslySetInnerHTML`** anywhere in the React tree.

**Secret handling.** API keys travel in the POST body only — never a URL, query
string, or header that a referrer or proxy log would capture. `Referrer-Policy:
no-referrer`. Both API routes send `Cache-Control: no-store`. The key input
carries `autocomplete="off"` so browsers don't store it as a credential.

**Server-side logging.** `/api/proxy` and `/api/count-tokens` log an error
*name* and provider only — never the key, prompt, or completion. This is the
single most important invariant in the codebase and is called out in-file.

**SSRF via the proxy.** Provider base URLs are hard-coded constants; the model
is validated against a catalog. No user-supplied URL reaches `fetch`.

**Upstream error disclosure.** `describeProviderError()` maps upstream failures
to a category plus HTTP status. Raw upstream bodies are never returned to the
client.

**Persistence sweep.** Drove the app with canary content, then enumerated every
surface: `localStorage` 0 keys, `sessionStorage` 0 keys, no cookies set, no
Cache Storage entries, no service workers, one IndexedDB database, nothing in
the URL or history.

**Vault import.** Malicious backups are a real vector (users paste files from
elsewhere). `migrate()` validates shape and refuses newer schema versions rather
than coercing. Parsed values are spread into fresh objects, so a `__proto__` key
in the JSON lands as an own property and does not reach `Object.prototype`.
Imported content is rendered as text, never as markup.

---

## Accepted risks (deliberate, documented)

### The proxy will relay for anyone who brings their own key

`/api/proxy` refuses cross-origin browser requests, but a request with **no**
`Origin` header (curl, a script) is allowed — there is no cookie or ambient
authority for CSRF to ride on, and the caller supplies their own key, so there
is nothing to steal.

The residual risk is that a public deployment is a free anonymizing relay in
front of seven model APIs. Mitigations if that becomes a problem: rate-limit by
IP, or require `Origin`. Not done now because it would break legitimate
scripted use and self-hosting for no security gain to the *user*.

### `script-src 'unsafe-inline'`

Next.js injects inline bootstrap scripts, so the CSP allows inline script. This
weakens CSP as a second line of defence against XSS.

Judged acceptable because the first line holds: no `dangerouslySetInnerHTML`, no
user content through `innerHTML`, and a scheme-allowlist on the only
model-generated links. `connect-src 'self'` also means an injected script has
nowhere to exfiltrate to.

A nonce-based CSP via middleware would close it properly. Worth doing before
this is widely deployed; tracked, not done.

### The hosted proxy sees your key in memory

Unavoidable for a browser app talking to APIs that reject cross-origin requests.
Stated plainly in the README and `/privacy`, with self-hosting as the remedy.

### `npm audit`: 3 high, build-time only

`postcss` (XSS/path-traversal via `sourceMappingURL`) and `sharp` (libvips CVEs)
are transitive `next` dependencies. Neither is reachable at runtime here: the app
processes no user-supplied CSS and no user-supplied images, and uses no
`next/image`. `npm audit fix --force` wants Next 16 — a major upgrade not worth
taking for unreachable findings. Re-check when upgrading Next on its own merits.

---

## One warning I could not clear

Chrome still emits a single **verbose** hint — *"Password forms should have
(optionally hidden) username fields"* — on the unlock screen, despite that form
containing an `autocomplete="username"` field positioned before the password
input. Tried with and without `readOnly`, and with visually-hidden rather than
`display: none`; the hint persists.

Not fixed further, because satisfying Chrome's visibility heuristic appears to
need a *visible* username field, and adding one to a product with no accounts is
a worse outcome than a verbose console hint. Down from four warnings to one, all
functional ones resolved.

---

## Recommended next

1. **Nonce-based CSP** to drop `'unsafe-inline'`.
2. **Rate-limit the proxy** if the deployment is ever publicised.
3. **Re-run this review after the Next upgrade** that clears the audit findings.
4. Consider **Argon2id** over PBKDF2 if a WASM dependency ever becomes
   acceptable — materially better against GPU attack than any PBKDF2 count.
