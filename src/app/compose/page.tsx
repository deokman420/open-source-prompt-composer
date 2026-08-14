import type { Metadata } from "next";
import Link from "next/link";
import ComposerHost from "./ComposerHost";
import { versioned, COMPOSER_BUNDLE, COMPOSER_STYLES } from "@/lib/build";

/**
 * Single-prompt R-G-C-B-T-S composer.
 *
 * The markup here is the DOM contract for /composer/app.js — the bundle binds
 * by element ID and by `data-slot`, so element IDs are load-bearing. Renaming
 * one silently disables a feature rather than breaking the build. See
 * ComposerHost for how the bundle's storage is routed into the vault.
 *
 * Unlike the hosted app there is no `data-draft-sync` attribute: this build has
 * no server-side draft store, so the inline "saved on this device" list is
 * always rendered.
 */

export const metadata: Metadata = {
  title: "Compose",
  description:
    "Build prompts in a structured R-G-C-B-T-S frame with live preview and code export. Runs entirely in your browser.",
};

export default function ComposePage() {
  return (
    <>
      {/* Composer-specific stylesheet — loads after globals.css, scoped by
          unique class names (field-card, composer-grid, …) so the app shell
          still owns .topnav / .page / .brand. `precedence` makes React 19 hoist
          it into <head> and hold paint until it loads; without it the sheet
          applies late and shifts the whole page. */}
      <link rel="stylesheet" href={versioned(COMPOSER_STYLES)} precedence="default" />

      {/* Preload the bundle so it is cache-hot by the time ComposerHost appends
          the script element, instead of being discovered only after hydration.
          Must be the exact URL ComposerHost requests, version stamp included,
          or the preload is wasted and the file is fetched twice. */}
      <link rel="preload" href={versioned(COMPOSER_BUNDLE)} as="script" />

      <section className="composer-host">
        <div className="band-label">01 · compose</div>
        <h1 className="page-h1" style={{ marginTop: "8px" }}>
          Single prompt
        </h1>
        <p className="page-sub" style={{ marginTop: "12px" }}>
          Build prompts in a structured R-G-C-B-T-S frame. Drafts stay on this
          device; no AI calls are made from this page.
        </p>

        <div
          className="hero-meta"
          aria-live="polite"
          style={{ marginTop: "20px", marginBottom: "8px" }}
        >
          <div className="slot-meter" title="Structural completeness of the 6 core slots">
            <span id="slotCount" className="slot-count">0 / 6 slots</span>
            <div className="slot-bar"><div id="slotFill" className="slot-fill"></div></div>
          </div>
          <div className="score-chip" title="Composition score — structural only, not a quality grade">
            <span className="score-label">Composition</span>
            <span id="scoreVal" className="score-val">0</span>
            <span id="scoreBest" className="score-best" hidden>best 0</span>
          </div>
        </div>

        <div id="classicView" style={{ marginTop: "24px" }}>
          {/* ===== TEMPLATES + ARCHAEOLOGY ===== */}
          <section className="band" id="library">
            <div className="band-label">jump-start</div>
            <details className="library-card">
              <summary>
                <span>Starter templates</span>
                <span className="library-hint">Load a complete pro-prompt to deconstruct</span>
              </summary>
              <div id="templatesList" className="library-list"></div>
            </details>

            <details className="library-card">
              <summary>
                <span>Prompt archaeology</span>
                <span className="library-hint">Famous prompts decomposed into R-G-C-B-T-S</span>
              </summary>
              <p className="library-blurb">
                Reverse-engineering practice. Each entry is a real, well-known prompt mapped into the frame
                — see how the pros structure intent. <em>Educational only — credit and sources noted on each.</em>
              </p>
              <div id="archaeologyList" className="library-list"></div>
            </details>
          </section>

          {/* ===== FORM + PREVIEW ===== */}
          <section className="composer-grid">
            <form className="composer-form" id="composerForm" autoComplete="off">
              <div className="band-label inline">02 · set the stage</div>

              <div className="field-card" data-slot="role">
                <label className="field-label" htmlFor="fieldRole">
                  <span className="field-name">Role</span>
                  <span className="field-hint">Who the model acts as. 1 line.</span>
                </label>
                <textarea
                  id="fieldRole"
                  name="role"
                  rows={2}
                  spellCheck
                  placeholder='e.g., "Senior security engineer reviewing auth code."'
                />
                <div className="suggestions" data-for="role"></div>
              </div>

              <div className="field-card" data-slot="goal">
                <label className="field-label" htmlFor="fieldGoal">
                  <span className="field-name">Goal</span>
                  <span className="field-hint">Single outcome, verb-first.</span>
                </label>
                <textarea
                  id="fieldGoal"
                  name="goal"
                  rows={2}
                  spellCheck
                  placeholder='e.g., "Identify token-leak risks in the diff below."'
                />
                <div className="suggestions" data-for="goal"></div>
              </div>

              <div className="band-label inline">03 · provide inputs</div>

              <div className="field-card" data-slot="context">
                <label className="field-label" htmlFor="fieldContext">
                  <span className="field-name">Context</span>
                  <span className="field-hint">Load-bearing facts the model can&apos;t infer. Bullets ok.</span>
                </label>
                <textarea
                  id="fieldContext"
                  name="context"
                  rows={4}
                  spellCheck
                  placeholder={"- App uses JWT with 15-min TTL\n- Sessions stored in Redis\n- Diff is in the next message"}
                />
                <div className="suggestions" data-for="context"></div>
              </div>

              <div className="field-card" data-slot="bounds">
                <label className="field-label" htmlFor="fieldBounds">
                  <span className="field-name">Bounds</span>
                  <span className="field-hint">Out of scope / forbidden.</span>
                </label>
                <textarea
                  id="fieldBounds"
                  name="bounds"
                  rows={3}
                  spellCheck
                  placeholder={"- Don't suggest rewrites\n- Don't touch database schema"}
                />
                <div className="suggestions" data-for="bounds"></div>
              </div>

              <div className="band-label inline">04 · define success</div>

              <div className="field-card" data-slot="task">
                <label className="field-label" htmlFor="fieldTask">
                  <span className="field-name">Task</span>
                  <span className="field-hint">The deliverable and how it&apos;s checked. Number steps only where order truly matters — reasoning models plan better than a script.</span>
                </label>
                <textarea
                  id="fieldTask"
                  name="task"
                  rows={4}
                  spellCheck
                  placeholder={"1. Read the diff\n2. List vulnerabilities by severity\n3. Cite file:line for each"}
                />
                <div className="suggestions" data-for="task"></div>
              </div>

              <div className="field-card examples-card" data-slot="examples">
                <label className="field-label">
                  <span className="field-name">
                    Examples <span className="optional-tag">optional · high impact</span>
                  </span>
                  <span className="field-hint">
                    1–3 input/output pairs. Even one example beats a paragraph of instructions.
                  </span>
                </label>
                <div id="examplesList" className="examples-list"></div>
                <button id="addExampleBtn" type="button" className="add-example-btn">+ Add example</button>
                <div id="examplesChips" className="suggestions"></div>
              </div>

              <div className="field-card" data-slot="success">
                <label className="field-label" htmlFor="fieldSuccess">
                  <span className="field-name">Success</span>
                  <span className="field-hint">How you&apos;ll know it worked, in checkable terms.</span>
                </label>
                <textarea
                  id="fieldSuccess"
                  name="success"
                  rows={3}
                  spellCheck
                  placeholder="Output is a markdown table: severity | file:line | issue | fix."
                />
                <div className="suggestions" data-for="success"></div>
              </div>

              <div className="band-label inline">05 · refine (optional)</div>

              <details className="addons-card">
                <summary>Add-on slots (Tools · Format · Clarify)</summary>

                <div className="field-card addon" data-slot="tools">
                  <label className="field-label" htmlFor="fieldTools">
                    <span className="field-name">Tools</span>
                    <span className="field-hint">Allowed / forbidden tools or sources.</span>
                  </label>
                  <textarea
                    id="fieldTools"
                    name="tools"
                    rows={2}
                    spellCheck
                    placeholder="Web search ok. No code execution."
                  />
                  <div className="suggestions" data-for="tools"></div>
                </div>

                <div className="field-card addon" data-slot="format">
                  <label className="field-label" htmlFor="fieldFormat">
                    <span className="field-name">Format</span>
                    <span className="field-hint">Output shape: JSON keys, length cap, headings.</span>
                  </label>
                  <textarea
                    id="fieldFormat"
                    name="format"
                    rows={2}
                    spellCheck
                    placeholder="Markdown, ≤ 300 words, sections: Findings, Fixes."
                  />
                  <div className="suggestions" data-for="format"></div>
                </div>

                <div className="field-card addon" data-slot="clarify">
                  <label className="field-label" htmlFor="fieldClarify">
                    <span className="field-name">Clarify</span>
                    <span className="field-hint">Ask N questions first if X is ambiguous.</span>
                  </label>
                  <textarea
                    id="fieldClarify"
                    name="clarify"
                    rows={2}
                    spellCheck
                    placeholder="Ask up to 2 questions if requirements are unclear before answering."
                  />
                  <div className="suggestions" data-for="clarify"></div>
                </div>
              </details>

              <div className="draft-title-row">
                <input
                  id="draftTitle"
                  type="text"
                  className="draft-title-input"
                  maxLength={80}
                  placeholder="Optional title for this draft"
                  aria-label="Draft title"
                  autoComplete="off"
                />
              </div>
              <div className="form-actions">
                <button id="newBtn" type="button" className="link-btn">New blank prompt</button>
                <button id="saveBtn" type="button" className="link-btn">Save draft</button>
                {/* Was a "Share link" button that packed the whole prompt into
                    a URL fragment. Moving people to the encrypted backup in
                    Settings keeps prompt text out of links, history, and
                    anything that logs URLs. */}
                <Link
                  href="/settings#backup"
                  className="link-btn"
                  title="Export an encrypted backup of your drafts from Settings"
                >
                  Export / backup
                </Link>
              </div>
            </form>

            {/* ===== LIVE PREVIEW ===== */}
            <aside className="preview-card">
              <div className="preview-header">
                <h2>Live preview</h2>
                <span
                  id="tokenEst"
                  className="token-est"
                  title="Rough estimate (chars ÷ 4). Real count varies ±20–30% by model — Anthropic averages ~3.5 chars/token, OpenAI ~4, Llama denser on code. For exact counts, paste into the provider's playground."
                >
                  ~0 tokens <span className="token-est-suffix">· rough</span>
                </span>
              </div>
              <label
                className="grade-toggle"
                title="Adds a 'grade my prompt' rubric after SUCCESS so the model also scores and improves the prompt you just wrote."
              >
                <input type="checkbox" id="gradeToggle" />
                <span>
                  Append <strong>&ldquo;grade my prompt&rdquo;</strong> rubric
                </span>
              </label>
              <div className="preview-meta-row">
                <label className="preview-meta-field">
                  <span className="preview-meta-label">Export as</span>
                  <select id="fmtSelect" className="fmt-select" aria-label="Output format">
                    <optgroup label="Prompt text">
                      <option value="markdown">Markdown</option>
                      <option value="xml">XML</option>
                    </optgroup>
                    <optgroup label="Anthropic (Claude)">
                      <option value="anthropic-curl">cURL</option>
                      <option value="anthropic-python">Python SDK</option>
                      <option value="anthropic-ts">TypeScript SDK</option>
                      <option value="bedrock-python">AWS Bedrock · Python</option>
                      <option value="bedrock-ts">AWS Bedrock · TypeScript</option>
                      <option value="vertex-python">Vertex AI · Python</option>
                      <option value="vertex-ts">Vertex AI · TypeScript</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="openai-curl">cURL</option>
                      <option value="openai-python">Python SDK</option>
                      <option value="openai-ts">TypeScript SDK</option>
                    </optgroup>
                    <optgroup label="Google Gemini">
                      <option value="gemini-curl">cURL</option>
                      <option value="gemini-python">Python SDK</option>
                      <option value="gemini-ts">TypeScript SDK</option>
                    </optgroup>
                  </select>
                </label>
                <label className="preview-meta-field" id="modelSelectField">
                  <span className="preview-meta-label">Model</span>
                  <select id="modelSelect" className="model-select" aria-label="Target model" hidden></select>
                </label>
              </div>
              <p id="fmtCaption" className="fmt-caption">
                Markdown works in any agent; switch to XML when targeting Claude with mixed content.
              </p>
              <pre id="preview" className="preview-text" aria-live="polite"></pre>
              <div className="preview-actions">
                <button id="copyMdBtn" className="copy-btn primary" type="button">Copy as Markdown</button>
                <button id="copyTxtBtn" className="copy-btn" type="button">Copy as plain text</button>
              </div>
              <button id="sendToEvalBtn" className="copy-btn send-eval-btn" type="button">Send to Evaluator &rarr;</button>
              <p className="preview-hint">Paste into Claude, ChatGPT, Gemini — anything that takes text. Or send this prompt straight to AI Eval to score, rewrite, or check it.</p>
            </aside>
          </section>

          {/* ===== DRAFTS =====
              Always rendered here: with no server-side draft store, this inline
              list is the composer's own recall surface. The /drafts page reads
              the same vault slice. */}
          <section className="drafts-card" id="draftsCard" hidden>
            <div className="band-label">recent drafts</div>
            <div className="drafts-inner">
              <div className="drafts-header">
                <h3>Saved on this device</h3>
                <div className="drafts-header-actions">
                  <input
                    id="draftsSearch"
                    type="search"
                    className="drafts-search"
                    placeholder="Search drafts…"
                    aria-label="Search drafts"
                    autoComplete="off"
                  />
                  <button id="clearDraftsBtn" className="link-btn" type="button">Clear all</button>
                </div>
              </div>
              <ul id="draftsList" className="drafts-list"></ul>
            </div>
          </section>
        </div>
      </section>

      {/* Toast container — the bundle shows transient feedback here. */}
      <div id="toast" className="toast" role="status" aria-live="polite"></div>

      <ComposerHost />
    </>
  );
}
