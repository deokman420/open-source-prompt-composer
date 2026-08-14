"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Provider } from "@/lib/providers/types";
import { streamModel, ModelError } from "@/lib/client/model";
import { buildSystemPrompt, HELP_MAX_TOKENS, HELP_SYSTEM_TOKENS_EST } from "@/lib/help/chat";
import { useKeys, usePreferences } from "@/lib/vault/hooks";
import { scratchGet, scratchSet, scratchRemove } from "@/lib/vault/scratch";
import {
  PROVIDER_MODELS,
  DEFAULT_MODEL,
  modelLabel,
  PROVIDER_LABELS,
  PROVIDER_ORDER,
} from "@/lib/models";

type ChatMessage = { role: "user" | "assistant"; content: string };

// The transcript is user content — questions about their own code, and model
// answers quoting it back. It goes in the encrypted vault, not sessionStorage,
// which would leave a plaintext copy on disk that outlives the conversation and
// ignores the passphrase entirely.
const SESSION_KEY = "help-chat";

// Failures surface as a message plus an optional hint. There is no quota and
// no entitlement to report — the user is billed by their own provider.
type ChatResponse = {
  error?: string;
  hint?: string;
};

const SUGGESTIONS = [
  "What's the difference between Compose and Orchestra?",
  "When should I escalate from a single prompt to multi-agent?",
  "How do I add my API key, and who pays for runs?",
  "How do I write a good tool description?",
];

export default function HelpChat() {
  const { configured, getKey, markUsed } = useKeys();
  const { defaultSelection } = usePreferences();
  const configuredProviders = PROVIDER_ORDER.filter((p) => configured.has(p));
  const systemTokensEst = HELP_SYSTEM_TOKENS_EST;

  const [provider, setProvider] = useState<Provider>(defaultSelection.provider);
  const [model, setModel] = useState<string>(defaultSelection.model);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ChatResponse | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasKey = configuredProviders.includes(provider);
  const canSend = !busy && input.trim().length > 0 && hasKey;

  function changeProvider(p: Provider) {
    setProvider(p);
    setModel(DEFAULT_MODEL[p]);
  }

  // Restore the transcript (and the provider/model picker) once on mount.
  useEffect(() => {
    try {
      const saved = scratchGet<{ messages?: unknown; provider?: unknown; model?: unknown }>(
        SESSION_KEY
      );
      if (!saved) return;
      if (Array.isArray(saved.messages)) {
        const restored = (saved.messages as unknown[]).filter((m): m is ChatMessage => {
          const x = m as { role?: unknown; content?: unknown };
          return (x?.role === "user" || x?.role === "assistant") && typeof x?.content === "string";
        });
        if (restored.length) setMessages(restored);
      }
      if (typeof saved.provider === "string" && PROVIDER_ORDER.includes(saved.provider as Provider)) {
        setProvider(saved.provider as Provider);
        if (typeof saved.model === "string") setModel(saved.model);
      }
    } catch {
      /* corrupt entry — start fresh */
    }
  }, []);

  // Persist on change. reset() owns clearing, so an empty transcript is a no-op
  // here (don't clobber a restore-in-progress on mount).
  useEffect(() => {
    if (messages.length === 0) return;
    scratchSet(SESSION_KEY, { messages, provider, model });
  }, [messages, provider, model]);

  function newConversation() {
    if (busy) return;
    if (messages.length > 0 && !window.confirm("Start a new conversation? This clears the current one.")) {
      return;
    }
    setMessages([]);
    setInput("");
    setError(null);
    scratchRemove(SESSION_KEY);
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setError(null);

    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);

    // Let the new user message paint before we scroll.
    requestAnimationFrame(() =>
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    );

    const apiKey = getKey(provider);
    if (!apiKey) {
      setError({
        error: `No ${PROVIDER_LABELS[provider]} key saved.`,
        hint: "Add one in Settings to use AI Help.",
      });
      setBusy(false);
      return;
    }

    try {
      // Append an empty assistant bubble, then grow it as tokens arrive.
      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      await streamModel(
        {
          provider,
          apiKey,
          model,
          // The KB is a large, stable prefix — cacheSystem lets Anthropic bill
          // it once rather than on every turn. This is the user's own money.
          system: buildSystemPrompt(),
          messages: next,
          maxTokens: HELP_MAX_TOKENS,
          cacheSystem: true,
        },
        (delta) => {
          setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = {
              role: "assistant",
              content: last.content + delta,
            };
            return copy;
          });
          scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
        }
      );
      markUsed(provider);
    } catch (e) {
      // Drop the empty assistant bubble so a failed turn doesn't leave a blank
      // message sitting in the transcript.
      setMessages((m) =>
        m.length && m[m.length - 1].role === "assistant" && !m[m.length - 1].content
          ? m.slice(0, -1)
          : m
      );
      setError({
        error:
          e instanceof ModelError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Network error.",
      });
    } finally {
      setBusy(false);
      requestAnimationFrame(() =>
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
      );
    }
  }

  return (
    <div className="card help-chat-card" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div className="label-mono">ai help · ask the docs</div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={newConversation}
              disabled={busy}
              className="btn btn-ghost"
              style={{ fontSize: "0.72rem", padding: "4px 10px" }}
            >
              New conversation
            </button>
          )}
          <span className="label-mono">~{systemTokensEst} token prefix · your key</span>
        </div>
      </div>

      <div style={{ display: "grid", gap: "12px", gridTemplateColumns: "1fr 1fr" }} className="eval-grid">
        <div>
          <label className="field-label" htmlFor="help-provider">Provider</label>
          <select
            id="help-provider"
            value={provider}
            onChange={(e) => changeProvider(e.target.value as Provider)}
            className="select"
          >
            {PROVIDER_ORDER.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}{configuredProviders.includes(p) ? "" : " — no key"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="help-model">Model</label>
          <select id="help-model" value={model} onChange={(e) => setModel(e.target.value)} className="select">
            {PROVIDER_MODELS[provider].map((m) => (
              <option key={m.id} value={m.id}>{m.label}{m.note ? ` · ${m.note}` : ""}</option>
            ))}
          </select>
        </div>
      </div>

      {!hasKey && (
        <div className="banner banner-warn">
          <strong>No {PROVIDER_LABELS[provider]} key on file.</strong>
          <span>
            AI Help uses your own API key.{" "}
            <Link href="/settings" style={{ textDecoration: "underline" }}>Add a {provider} key &rarr;</Link>
          </span>
        </div>
      )}

      {/* Transcript */}
      <div
        ref={scrollRef}
        className="help-chat-transcript"
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: messages.length ? "4px 2px" : "0",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <p className="muted" style={{ fontSize: "0.9rem", margin: 0 }}>
              Ask about the app or about prompt &amp; context engineering. Answers cite their sources.
            </p>
            <div className="help-chat-suggestions" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: "0.78rem", padding: "6px 10px" }}
                  disabled={!hasKey}
                  onClick={() => send(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)
        )}
        {busy && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="label-mono" style={{ opacity: 0.7 }}>
            thinking on {modelLabel(provider, model)}…
          </div>
        )}
      </div>

      {error?.error && (
        <div className="banner banner-error">
          <strong>{error.error}</strong>
          {error.hint && <span>{error.hint}</span>}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="help-chat-composer"
        style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
      >
        <textarea
          name="help-chat-input"
          aria-label="Ask a question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          rows={2}
          placeholder={hasKey ? "Ask a question…" : "Add an API key to start chatting"}
          className="textarea"
          style={{ flex: 1 }}
          disabled={!hasKey}
        />
        <button type="submit" className="btn btn-primary" disabled={!canSend}>
          {busy ? "…" : "Send"}
        </button>
      </form>

      <p className="muted-strong" style={{ fontSize: "0.72rem", margin: 0 }}>
        Answers come from your selected model on your own API key (BYOK) and can be wrong — verify
        anything load-bearing against the linked sources below.
      </p>
      {/* Upfront token disclosure: every turn prepends the persona + knowledge
          base on the user's key, so there are no surprise input costs. */}
      <p className="muted-strong" style={{ fontSize: "0.72rem", margin: 0 }}>
        Token note: each message also sends <strong>~{systemTokensEst.toLocaleString()} tokens</strong> of
        built-in context (this app&apos;s knowledge base + the prompt-engineering guide) before your
        text, plus the conversation so far. On Claude models that fixed prefix is cached, so repeat
        turns within a few minutes are billed at a fraction of that.
      </p>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "10px 13px",
          borderRadius: "12px",
          fontSize: "0.88rem",
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          background: isUser ? "var(--accent-soft, var(--bg-card-2))" : "var(--bg-card-2)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="label-mono" style={{ marginBottom: "4px", opacity: 0.7 }}>
          {isUser ? "you" : "ai help"}
        </div>
        {linkify(content)}
      </div>
    </div>
  );
}

// The agent is instructed (see chat.ts) to write links as Markdown
// [label](url) so the user reads a human label and sees where it goes via the
// title tooltip — rather than a raw URL. We render ONLY that one construct;
// any other Markdown would leak as literal characters in the pre-wrap bubble,
// which is why the prompt forbids it. Models don't always comply, so we also
// linkify any leftover bare URLs as a fallback.
//
// TODO(rich-render): if we ever want full Markdown (headers, bold, fenced
// code) swap this for a real renderer and loosen the prompt's formatting rule.
const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL_RE = /(https?:\/\/[^\s)]+)/g;

function renderAnchor(label: string, href: string, key: number): React.ReactNode {
  return (
    // title= gives a hover preview of the destination URL behind the label.
    <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={href}>
      {label}
    </a>
  );
}

function linkify(text: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  // Pass 1: Markdown links. A fresh regex object keeps lastIndex local.
  const md = new RegExp(MD_LINK_RE);
  let m: RegExpExecArray | null;
  while ((m = md.exec(text)) !== null) {
    if (m.index > last) out.push(...linkifyBare(text.slice(last, m.index), () => key++));
    out.push(renderAnchor(m[1], m[2], key++));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...linkifyBare(text.slice(last), () => key++));
  return out;
}

// Fallback for any bare URLs the model emitted without Markdown syntax.
function linkifyBare(text: string, nextKey: () => number): React.ReactNode[] {
  const parts = text.split(BARE_URL_RE);
  return parts.map((part) =>
    /^https?:\/\//.test(part) ? renderAnchor(part, part, nextKey()) : part
  );
}
