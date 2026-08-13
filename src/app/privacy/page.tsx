import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Prompt Composer stores, where it stores it, and what passes through the server.",
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="page-h1">Privacy</h1>
      <p className="page-sub">
        Short version: this site has no database, no accounts, and no analytics.
        Your work stays in your browser.
      </p>

      <div style={{ display: "grid", gap: 20, marginTop: 28, maxWidth: 760 }}>
        <section className="card card-lg">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10 }}>
            What is stored, and where
          </h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Prompts, drafts, eval results, preferences, and API keys are written
            to this browser&rsquo;s IndexedDB under the origin you&rsquo;re
            viewing. They are not uploaded anywhere. If you set a passphrase, the
            whole store is encrypted at rest with AES-GCM-256 using a key derived
            from your passphrase via PBKDF2-SHA256 (210,000 iterations). The
            passphrase itself is never written to disk and never leaves memory.
          </p>
        </section>

        <section className="card card-lg">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10 }}>
            What passes through the server
          </h2>
          <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 12 }}>
            When you run an AI-backed feature, the browser POSTs your prompt and
            the API key for the provider you chose to <code>/api/proxy</code>.
            That endpoint forwards the request to the provider and streams the
            response back.
          </p>
          <p className="muted" style={{ fontSize: "0.88rem", marginBottom: 12 }}>
            It exists only because browsers cannot call most provider APIs
            directly — they reject cross-origin requests. It holds your key in
            memory for the duration of that one request and writes nothing: no
            database, no session, no cookie, no log of the key, prompt, or
            completion. Responses are sent with <code>Cache-Control: no-store</code>.
          </p>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            This is worth being clear-eyed about: on the hosted deployment, your
            key does transit a server you don&rsquo;t control, in memory. If that
            is unacceptable for your threat model, the source is MIT-licensed —
            run it yourself and the proxy becomes your own machine.
          </p>
        </section>

        <section className="card card-lg">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10 }}>
            Your provider still sees your prompts
          </h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Anthropic, OpenAI, Google, xAI, NVIDIA, OpenRouter, or DeepSeek
            receive whatever you send them and handle it under their own privacy
            terms and retention policies. Local-first protects your data from
            this site; it does not change your relationship with the model
            provider you chose.
          </p>
        </section>

        <section className="card card-lg">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10 }}>
            No tracking
          </h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            No analytics, no cookies, no third-party scripts, no fonts fetched
            from another origin. The Content-Security-Policy restricts network
            access to this origin only, so a compromised script would have
            nowhere to send anything.
          </p>
        </section>

        <section className="card card-lg">
          <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 10 }}>
            Deleting your data
          </h2>
          <p className="muted" style={{ fontSize: "0.88rem" }}>
            Settings → Erase everything removes it all immediately. Clearing site
            data in your browser does the same. There is no copy anywhere else,
            which also means there is nothing to recover afterwards — export a
            backup first if you want one.
          </p>
        </section>
      </div>
    </>
  );
}
