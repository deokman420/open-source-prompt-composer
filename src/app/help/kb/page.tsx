import type { Metadata } from "next";
import Link from "next/link";
import HelpTocMobile from "../HelpTocMobile";

export const metadata: Metadata = {
  title: "Knowledge base",
  description:
    "A working field guide to prompt and context engineering, compiled from vendor docs and primary papers with every claim linked to its source.",
};

export default function HelpKbPage() {

  return (
    <section style={{ maxWidth: "860px" }}>
      {/* The KB is launched from the Account dashboard's "Knowledge base" button,
          so offer a clear way back up there. */}
      <Link href="/help" className="muted" style={{ fontSize: "0.85rem", display: "inline-block", marginBottom: "16px" }}>
        &larr; Back to AI Help
      </Link>
      <div className="label-mono">00 · reference</div>
      <h1 className="page-h1" style={{ marginTop: "8px" }}>Knowledge base — a working field guide</h1>
      <p className="page-sub" style={{ marginTop: "12px" }}>
        A curated reference compiled from primary sources: vendor docs (Anthropic, OpenAI,
        LangChain), seminal arXiv papers, and Anthropic&apos;s multi-agent research write-up.
        Every claim links to the paper or doc it came from — no second-hand paraphrasing.
      </p>

      {/* Pointer back to the live helpdesk that reasons over this same KB. */}
      <p className="muted" style={{ marginTop: "10px", fontSize: "0.88rem" }}>
        Prefer to ask instead of read?{" "}
        <Link href="/help">Open AI Help &rarr;</Link> — a chat that answers from this
        knowledge base on your own API key.
      </p>

      <details id="help-toc" className="card help-toc-card" open>
        <summary style={{ cursor: "pointer", fontWeight: 500 }}>Contents</summary>
        {/* ul (not ol): each item already carries its own §-number, so list
            auto-numbering would double up ("1. §1 …"). */}
        <ul style={{ marginTop: "12px", paddingLeft: "4px", listStyleType: "none", display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
          <li><a href="#help-foundations">§1 — Foundations: why structure beats prose</a></li>
          <li><a href="#help-single">§2 — Single-prompt techniques (11)</a></li>
          <li><a href="#help-modern">§2b — Prompting reasoning-era models</a></li>
              <li><a href="#help-s3">§3 — Orchestration patterns</a></li>
              <li><a href="#help-s4">§4 — Provider system-prompt conventions</a></li>
              <li><a href="#help-s5">§5 — When to escalate</a></li>
              <li><a href="#help-s6">§6 — Context pipeline</a></li>
              <li><a href="#help-s7">§7 — Writing tools for agents</a></li>
              <li><a href="#help-s8">§8 — Scheduled loops &amp; loop engineering</a></li>
              <li><a href="#help-s9">§9 — Primary sources</a></li>
        </ul>
      </details>
      <HelpTocMobile />

      {/* §1 */}
      <section id="help-foundations" style={{ marginTop: "48px" }}>
        <div className="label-mono">§1 · foundations</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "8px", marginBottom: "12px" }}>
          Why structure beats prose
        </h2>
        <p style={{ marginBottom: "12px" }}>
          A model that gets a wall of prose has to <em>infer</em> three things at once: who it&apos;s playing,
          what it&apos;s optimizing for, and what shape the output should take. A model that gets a frame only
          has to <em>fill</em> them. The <strong>R-G-C-B-T-S</strong> frame — Role · Goal · Context · Bounds · Task · Success —
          is one such frame, but the deeper rule is just: separate the slots so the model can&apos;t confuse them.
        </p>
        <p>
          The rest of this guide is the toolkit you slot <em>into</em> that frame: techniques that change how the
          model reasons (chain-of-thought, self-consistency), how it acts (ReAct, reflexion), and how multiple
          models compose into a system bigger than any single context window.
        </p>
        <p style={{ marginTop: "16px" }}>
          Try the frame:{" "}
          <a href="https://prompt.phbeks.com" rel="noopener">open the free composer &rarr;</a>
        </p>
      </section>

      {/* §2 */}
      <section id="help-single" style={{ marginTop: "48px" }}>
        <div className="label-mono">§2 · single-prompt techniques</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "8px", marginBottom: "12px" }}>
          Eleven techniques worth knowing by name
        </h2>
        <p className="muted" style={{ marginBottom: "20px" }}>
          Ordered roughly by complexity. The first two are baselines every later technique is measured against.
          Each card cites a single primary source — read it before you commit to the pattern in production.
        </p>

        <div className="help-cards">
          <HelpCard
            title="Zero-shot prompting"
            cite="Brown et al. · 2020"
            body="Asking a model to perform a task using only a natural-language instruction, with no worked examples. Works well on tasks the base model has seen heavily in pre-training; degrades on tasks with unusual formats or domain conventions."
            when="The task is common (summarize, translate, classify into obvious labels) and you want the shortest possible prompt."
            example={`Classify the sentiment of this review as positive, negative, or neutral:\n"{review}"`}
            href="https://arxiv.org/abs/2005.14165"
            sourceLabel="Language Models are Few-Shot Learners ↗"
          />
          <HelpCard
            title="Few-shot prompting · in-context learning"
            cite="Brown et al. · 2020"
            body="Include a small number of input/output demonstrations in the prompt so the model infers the task pattern at inference time, with no weight updates. Sensitive to example selection, ordering, and label distribution; benefits saturate quickly past ~8-16 examples for most tasks."
            when="Output format is non-obvious (custom JSON, niche labels, particular tone) and you can show 2-8 representative examples."
            example={`Q: 2+2   A: 4\nQ: 7+5   A: 12\nQ: 13+9  A:`}
            href="https://arxiv.org/abs/2005.14165"
            sourceLabel="Language Models are Few-Shot Learners ↗"
          />
          <HelpCard
            title="Chain-of-Thought (CoT)"
            cite="Wei et al. · 2022"
            body="Prompt the model to produce intermediate reasoning steps before its final answer, typically by showing exemplars that include such steps. Gains report mainly on arithmetic, commonsense, and symbolic reasoning, and only at sufficient model scale — smaller models can be neutral or hurt by it."
            when="Multi-step arithmetic, logic, or planning on a capable model where you can tolerate longer outputs."
            example={`Q: Roger has 5 balls. He buys 2 cans of 3 balls each. How many balls?\nA: Roger starts with 5. 2 cans of 3 is 6. 5 + 6 = 11. Answer: 11.`}
            href="https://arxiv.org/abs/2201.11903"
            sourceLabel="Chain-of-Thought Prompting Elicits Reasoning ↗"
          />
          <HelpCard
            title="Self-Consistency"
            cite="Wang et al. · 2022"
            body="Sample multiple chain-of-thought reasoning paths, then take a majority vote over the final answers instead of using a single greedy decode. Improves reasoning accuracy but multiplies inference cost by the sample count. The paper varies paths with temperature — current-generation Claude models (Opus 5, Sonnet 5, Fable 5, Opus 4.7+) reject temperature, top_p, and top_k with a 400, so vary the prompt instead: ask each run to approach the problem from a stated different angle."
            when="Reasoning tasks where the answer is a short discrete value and you can afford N parallel completions."
            example={`# Paper: N samples at temperature=0.7\n# Current Claude: no sampling params — vary the prompt per run\nangles = ["work backwards from the answer", "enumerate cases", "estimate first"]\nfinal_answer = majority_vote([extract(run(prompt, a)) for a in angles])`}
            href="https://arxiv.org/abs/2203.11171"
            sourceLabel="Self-Consistency Improves CoT Reasoning ↗"
          />
          <HelpCard
            title="Tree-of-Thoughts (ToT)"
            cite="Yao et al. · 2023"
            body="Generalizes chain-of-thought into a search tree where the model proposes multiple candidate “thoughts” at each step, evaluates them, and expands or backtracks. Requires an explicit controller (BFS/DFS plus a value function) wrapped around the model."
            when="Problems where solutions need exploration and the model can reasonably evaluate its own partial progress."
            example={`Step:  "Propose 3 next moves toward the goal. One-line rationale each."\nEval:  "Rate each candidate sure / maybe / impossible toward solving {task}."\nLoop:  expand top-k, prune the rest, repeat until depth D.`}
            href="https://arxiv.org/abs/2305.10601"
            sourceLabel="Tree of Thoughts: Deliberate Problem Solving ↗"
          />
          <HelpCard
            title="ReAct"
            cite="Yao et al. · 2022"
            body="Interleaves reasoning traces (Thought:) with tool-use actions (Action:) and their results (Observation:) in a single loop, so the model can ground reasoning in retrieved facts."
            when="Tasks where the model must look things up or operate on an environment rather than answer from parametric knowledge alone."
            example={`Thought: I need the population of Lyon.\nAction: search("Lyon population")\nObservation: ~522,000 (2023)\nAnswer: ~522,000`}
            href="https://arxiv.org/abs/2210.03629"
            sourceLabel="ReAct: Synergizing Reasoning and Acting ↗"
          />
          <HelpCard
            title="Reflexion"
            cite="Shinn et al. · 2023"
            body="After an agent attempt fails (per an external evaluator or unit test), the model writes a short natural-language critique of what went wrong and stores it in an episodic memory that is prepended to the next attempt."
            when="Agentic loops with a checkable verdict per attempt (passing tests, reaching a goal state) and budget for multiple tries."
            example={`attempt_1 -> fail\nreflect:   "I assumed the index was 1-based; it is 0-based."\nattempt_2: <prior reflections + original task>`}
            href="https://arxiv.org/abs/2303.11366"
            sourceLabel="Reflexion: Verbal Reinforcement Learning ↗"
          />
          <HelpCard
            title="Role / persona prompting"
            cite="Anthropic docs"
            body="Set a role for the model in the system prompt to focus its tone, vocabulary, and default behaviors. Even a single sentence shifts behavior measurably — but role prompting does not unlock new capabilities."
            when="You want a consistent voice or domain framing across many turns without restating it each message."
            example={`system: You are a senior SRE running a calm, blameless post-mortem.\n        Prefer concrete timelines and falsifiable claims.\nuser:   Here is the incident transcript: ...`}
            href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts"
            sourceLabel="Anthropic — Prompting best practices ↗"
          />
          <HelpCard
            title="Chain-of-Density"
            cite="Adams et al. · 2023"
            body="Iteratively rewrites a summary at fixed length, each pass adding 1-3 previously missing salient entities without growing the word count, so the final summary is denser and more abstractive."
            when="Producing a short, information-dense summary of a long article when entity coverage matters more than narrative flow."
            example={`Summarize the article in 5 sentences. Then repeat 4 more times.\nEach iteration: keep length identical, add 1-3 missing salient\nentities, remove filler. Output all 5 versions as a JSON list.`}
            href="https://arxiv.org/abs/2309.04269"
            sourceLabel="From Sparse to Dense: Chain of Density ↗"
          />
          <HelpCard
            title="Structured output · JSON schema mode"
            cite="OpenAI · 2024"
            body="Constrains decoding so the response is guaranteed to be valid JSON matching a supplied JSON Schema. Enforces adherence at the decoding layer — not by prompt instruction."
            when="Any downstream code path that needs to JSON.parse the response or hand it to a typed function. Load-bearing for multi-agent systems."
            example={`response_format = { "type": "json_schema",\n  "json_schema": { "name": "Ticket", "strict": true, ... } }`}
            href="https://openai.com/index/introducing-structured-outputs-in-the-api/"
            sourceLabel="OpenAI — Structured Outputs in the API ↗"
          />
          <HelpCard
            title="Prompt chaining"
            cite="Anthropic docs"
            body="Split a task into a sequence of separate model calls, where each call's output feeds the next. The most common pattern is self-correction — draft → critique → revise."
            when="The pipeline has distinct stages with different instructions, you want to evaluate or gate between them, or a single prompt is hitting context/quality limits."
            example={`call_1: extract claims from {doc} -> claims.json\ncall_2: for each claim, verify against {source} -> verdicts.json\ncall_3: write report using verdicts.json`}
            href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/chain-prompts"
            sourceLabel="Anthropic — Chain complex prompts ↗"
          />
        </div>
      </section>

      {/* §2b — what changed once thinking moved inside the model. Deliberately
          sits next to §2 and stays free: several §2 techniques read as advice
          that now backfires, and a reader shouldn't hit a paywall between the
          technique and its correction. */}
      <section id="help-modern" style={{ marginTop: "48px" }}>
        <div className="label-mono">§2b · reasoning-era models</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "8px", marginBottom: "12px" }}>
          What changed when thinking moved inside the model
        </h2>
        <p className="muted" style={{ marginBottom: "20px" }}>
          Most published prompt advice — including several cards in §2 — was written for models
          that under-reasoned, under-delivered, and needed pushing. Current frontier models
          (Claude Opus 5 / Sonnet 5 / Fable 5, Grok 4.6, and their peers) reason by default and follow
          instructions literally, so the old counterweights now push the wrong way. These five
          cards are the corrections. The short version: <strong>delete more than you add</strong>.
        </p>

        <div className="help-cards">
          <HelpCard
            title="Thinking is on by default — stop asking for it"
            cite="Anthropic · adaptive thinking"
            body="These models decide how much to reason per request, and interleave it between tool calls. 'Think step by step' is redundant, and asking the model to reproduce its reasoning in the visible answer can be refused outright. Control depth with the effort setting instead of prose. One budget trap: thinking tokens come out of the same max_tokens as the answer, so a limit tuned for an older model can be spent entirely on thinking and return truncated text."
            when="Any request to a current reasoning model — which is now the default on every major provider."
            example={`# Before: "Think step by step before answering."\n# Now: nothing in the prompt — configure it\nthinking = {"type": "adaptive"}\noutput_config = {"effort": "low"}   # low | medium | high | xhigh | max\nmax_tokens = 8000                   # thinking + answer share this`}
            href="https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking"
            sourceLabel="Anthropic — Adaptive thinking ↗"
          />
          <HelpCard
            title="Sampling parameters are gone"
            cite="Anthropic · migration guide"
            body="temperature, top_p, and top_k are rejected with a 400 on Claude Opus 5, Sonnet 5, Fable 5, and Opus 4.7+. Determinism and variety are now prompt-level concerns, not decode-level ones. If you were at temperature 0 for repeatability, tighten the prompt and drop effort; if you were at 0.7 for variety, ask for the variety explicitly — have the model propose N distinct approaches and pick one."
            when="Porting any prompt, script, or eval harness that sets sampling parameters."
            example={`# 400 invalid_request_error on current Claude:\nclient.messages.create(model="claude-opus-5", temperature=0.7, ...)\n\n# Variety, prompted instead of sampled:\n"Propose 4 distinct approaches to this brief — one line of rationale\n each — then ask me to pick one before you build."`}
            href="https://platform.claude.com/docs/en/about-claude/models/migration-guide"
            sourceLabel="Anthropic — Model migration guide ↗"
          />
          <HelpCard
            title="Delete your verification instructions"
            cite="Anthropic · migration guide"
            body="This inverts a standard best practice. Current models check their own work unprompted; telling them to 'double-check', 'verify before responding', or adding a separate verification pass to the harness causes over-verification — more tokens, more latency, no accuracy gain. Removing those instructions measurably reduces the behavior with no capability regression. This is a delete, not a rewrite. The carve-out: what you delete is self-re-reading, not evidentiary discipline. Anthropic's own released production prompts (the de novo protein-binder design campaign, August 2026) drop 'double-check your answer' and still keep a standing Verification section — 'Verified' means you ran a check and have its output, and never write an external identifier from memory. Where the model acts on the world rather than just answering, that section earns its tokens."
            when="Auditing any prompt or agent harness carried over from an earlier model generation."
            example={`- "Double-check your answer before responding."      <- delete\n- "Include a final verification step for any task."   <- delete\n- "Use a subagent to verify the result."             <- delete`}
            href="https://platform.claude.com/docs/en/about-claude/models/migration-guide"
            sourceLabel="Anthropic — Model migration guide ↗"
          />
          <HelpCard
            title="Say how long, and say how wide"
            cite="Anthropic · migration guide"
            body="Two default behaviors need explicit counterweights. Responses and written deliverables run longer than on previous models — and lowering effort does not reliably shorten them, so length is a prompt instruction. Separately, these models will apply their own judgment about what the task should be: adding steps you didn't request, or closing with work you didn't ask for. Both are fixed with one or two sentences in Bounds."
            when="Any user-facing product surface, and any task where 'what was asked' has a hard edge."
            example={`Bounds:\n- Keep responses focused and concise; lead with the outcome.\n- Match deliverable length to the task — no filler sections.\n- Deliver what I asked at the scope I asked. If you think the ask is\n  wrong, say so in a sentence and proceed as asked.`}
            href="https://platform.claude.com/docs/en/about-claude/models/migration-guide"
            sourceLabel="Anthropic — Model migration guide ↗"
          />
          <HelpCard
            title="Cap delegation — the direction reversed"
            cite="Anthropic · migration guide"
            body="Model generations disagree about subagents, so guidance doesn't transfer. The previous generation under-delegated and needed encouragement; the current one reaches for subagents freely, and each spawn re-establishes context, re-explores, reports back, and gets re-read — multiplying cost and latency on work the main loop could finish in a few tool calls. If you added 'delegate more' guidance for an older model, remove it and set an explicit ceiling instead. One regime inverts this: long-running compute campaigns, where the orchestrator should do no work itself. Anthropic's released campaign prompts push every model call and GPU job into sub-agents and leave the orchestrator as a thin heartbeat-and-dispatch loop, so a stalled job cannot stall the coordinator — a scheduling constraint that applies when work outlives a single context, not to ordinary turns."
            when="Any orchestrator/worker system (see §3) running on a current model."
            example={`Do NOT spawn a subagent for work you could finish in a handful of\ntool calls, or to verify your own output.\nDelegate only genuinely independent, sizeable tracks — and prefer one\nsubagent over several. Never exceed N in parallel.`}
            href="https://platform.claude.com/docs/en/about-claude/models/migration-guide"
            sourceLabel="Anthropic — Model migration guide ↗"
          />
        </div>
        <p style={{ marginTop: "16px", fontSize: "0.85rem" }}>
          Audit a prompt against these:{" "}
          <Link href="/eval">open AI Eval &rarr;</Link>
        </p>
      </section>

      <section id="help-orchestra" style={{ marginTop: "56px" }}>
        <div className="label-mono">§3-§9</div>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginTop: "8px", marginBottom: "12px" }}>
          Orchestration · prompts-as-code · escalation · context pipeline · agent tools · scheduled loops · sources
        </h2>
        <p className="muted" style={{ marginBottom: "20px" }}>
          Seven orchestration patterns (orchestrator/worker, sequential, parallel, routing, debate,
          evaluator-optimizer, reflection), provider-specific system-prompt conventions
          across Anthropic / OpenAI / Gemini SDKs, the single→multi-agent escalation checklist with
          Anthropic&apos;s ~15× cost data, how to budget the context window like RAM (the model behind
          the Context tool), how to write function-calling tools the model will actually use (the model
          behind the Tool Builder), loop engineering for Claude Code&apos;s /loop scheduled tasks
          (the model behind the Loops tab), and curated primary-source references.
        </p>
        <AdvancedSections />
      </section>

      <p className="muted-strong" style={{ marginTop: "48px", fontSize: "0.78rem" }}>
        Prompt Composer is open source (MIT) at{" "}
        <a href="https://github.com/deokman420/open-source-prompt-composer" rel="noopener">
          github.com/deokman420/open-source-prompt-composer ↗
        </a>.
      </p>
    </section>
  );
}

function HelpCard({
  title, cite, body, when, example, href, sourceLabel,
}: {
  title: string;
  cite: string;
  body: string;
  when: string;
  example: string;
  href: string;
  sourceLabel: string;
}) {
  return (
    <article className="card help-card">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 600 }}>{title}</h3>
        <span className="label-mono">{cite}</span>
      </header>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{body}</p>
      <p style={{ fontSize: "0.9rem", lineHeight: 1.6, marginTop: "10px" }}>
        <strong>When to use:</strong> {when}
      </p>
      {/* whiteSpace:"pre" + overflow:auto makes this a scroll container, and a
          scroll container a keyboard user cannot focus is a region they cannot
          read. tabIndex makes it reachable; the label says which example. */}
      <pre tabIndex={0} role="region" aria-label={`${title} — example`} style={{
        marginTop: "12px",
        padding: "12px 14px",
        background: "var(--bg-card-2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        fontSize: "0.78rem",
        lineHeight: 1.55,
        overflow: "auto",
        whiteSpace: "pre",
      }}>{example}</pre>
      <p style={{ marginTop: "10px", fontSize: "0.82rem" }}>
        <a href={href} rel="noopener">{sourceLabel}</a>
      </p>
    </article>
  );
}

// Sections §3-§8 used to sit behind the Pro plan, gated by a LockedNotice card
// that linked to /pricing and /sign-in. Both routes went away with the free/Pro
// merge and the whole KB is public now, so the gate is deleted rather than left
// dead: it was still shipping a "$9/month" claim and two 404 links to anyone who
// re-rendered it.
function AdvancedSections() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
      {/* §3 — Orchestration patterns */}
      <div id="help-s3" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§3 · orchestration patterns</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          Seven ways to compose more than one model call
        </h3>
        <p className="muted" style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
          The first five are the Anthropic &ldquo;Building effective agents&rdquo; taxonomy; debate and
          reflection are added because they show up constantly in practice. Start with the simplest
          one that works — every added agent multiplies cost and failure modes (see §5).
        </p>
        <div className="help-cards">
          <HelpCard
            title="Sequential (prompt chaining)"
            cite="Anthropic · 2024"
            body="Fixed pipeline: each step's output is the next step's input, with optional programmatic gates between them. The most predictable pattern — no model decides the control flow, you do."
            when="The task decomposes into known stages (extract → verify → write) and you want to inspect or gate between them."
            example={`call_1: outline the argument from {brief}      -> outline\ncall_2: draft each section from outline         -> draft\ncall_3: tighten draft to {word_limit}           -> final`}
            href="https://www.anthropic.com/engineering/building-effective-agents"
            sourceLabel="Anthropic — Building effective agents ↗"
          />
          <HelpCard
            title="Routing"
            cite="Anthropic · 2024"
            body="A classifier call directs each input to one of several specialized downstream prompts or models. Lets you use a cheap model for easy cases and an expensive one only where it pays off."
            when="Inputs fall into distinct categories that each deserve different handling (e.g. refund vs. technical-support vs. sales)."
            example={`route = classify(query)   # -> "billing" | "tech" | "sales"\nanswer = HANDLERS[route](query)`}
            href="https://www.anthropic.com/engineering/building-effective-agents"
            sourceLabel="Anthropic — Building effective agents ↗"
          />
          <HelpCard
            title="Parallel (sectioning / voting)"
            cite="Anthropic · 2024"
            body="Fan a task out into independent calls that run concurrently, then aggregate. Two flavors: sectioning (split distinct subtasks) and voting (run the same task N times for a majority or any-hit verdict)."
            when="Subtasks are independent (per-document, per-section) or you want diversity/confidence from multiple attempts on one task."
            example={`results = await Promise.all(\n  chunks.map(c => summarize(c))\n);\nreport = combine(results);`}
            href="https://www.anthropic.com/engineering/building-effective-agents"
            sourceLabel="Anthropic — Building effective agents ↗"
          />
          <HelpCard
            title="Orchestrator / worker"
            cite="Anthropic · 2024"
            body="A lead model decomposes the task at runtime and delegates subtasks to worker calls, then synthesizes their results. Unlike parallel sectioning, the subtasks are not fixed in advance — the orchestrator decides them."
            when="You can't enumerate the subtasks ahead of time because they depend on the input (e.g. open-ended research, multi-file code changes)."
            example={`plan   = orchestrator("break {goal} into subtasks")\nresults = await Promise.all(plan.map(runWorker))\nfinal  = orchestrator("synthesize", results)`}
            href="https://www.anthropic.com/engineering/building-effective-agents"
            sourceLabel="Anthropic — Building effective agents ↗"
          />
          <HelpCard
            title="Evaluator / optimizer"
            cite="Anthropic · 2024"
            body="One call generates, a second call grades against explicit criteria and returns actionable feedback, and the loop repeats until the evaluator passes it. Works when you have criteria a model can reliably judge."
            when="Quality is measurable in words (does this translation preserve idiom? does this code pass the spec?) and a single pass isn't reliably good enough."
            example={`while not ok and tries < MAX:\n  draft = generate(task, feedback)\n  ok, feedback = evaluate(draft, criteria)`}
            href="https://www.anthropic.com/engineering/building-effective-agents"
            sourceLabel="Anthropic — Building effective agents ↗"
          />
          <HelpCard
            title="Multi-agent debate"
            cite="Du et al. · 2023"
            body="Several model instances answer independently, then read each other's answers and revise across rounds before converging. Reported to improve factuality and arithmetic over single-pass and self-consistency, at multiplied cost."
            when="Factual or reasoning tasks where independent agents can critique each other and the answer benefits from cross-examination."
            example={`r1: each agent answers {q} independently\nr2: each agent re-answers given the others' r1 answers\n...: repeat for K rounds, then take the converged answer`}
            href="https://arxiv.org/abs/2305.14325"
            sourceLabel="Improving Factuality via Multiagent Debate ↗"
          />
          <HelpCard
            title="Reflection"
            cite="Shinn et al. · 2023"
            body="A single agent critiques its own last attempt in natural language and feeds that critique into the next attempt. The single-agent cousin of evaluator/optimizer — same loop, no second model. (See §2 · Reflexion.)"
            when="An agentic loop with a checkable verdict per attempt (tests, a goal state) and budget for a few tries."
            example={`attempt_1 -> fail\nreflect:   "I assumed 1-based indexing; it is 0-based."\nattempt_2: <prior reflections + original task>`}
            href="https://arxiv.org/abs/2303.11366"
            sourceLabel="Reflexion: Verbal Reinforcement Learning ↗"
          />
        </div>
      </div>

      {/* §4 — Provider system-prompt conventions */}
      <div id="help-s4" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§4 · provider conventions</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          The same system prompt, three SDKs
        </h3>
        <p className="muted" style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
          All three put the role/instructions in a dedicated slot — but the slot has a different name
          and shape in each API. Get this wrong and your system prompt silently becomes a user turn.
        </p>
        <div className="help-cards">
          <HelpCard
            title="Anthropic — top-level system"
            cite="Messages API"
            body="The system prompt is a top-level string (or array of blocks) on the request, separate from messages[]. It is not a message with role:system — putting it in messages[] is an error."
            when="Any Claude call. Use the array form when you want cache_control on a stable prefix."
            example={`client.messages.create({\n  model, max_tokens,\n  system: "You are a senior SRE...",\n  messages: [{ role: "user", content }],\n})`}
            href="https://docs.anthropic.com/en/api/messages"
            sourceLabel="Anthropic — Messages API ↗"
          />
          <HelpCard
            title="OpenAI — system / developer message"
            cite="Chat Completions"
            body="The instruction is the first element of messages[] with role:system (Chat Completions) or role:developer (newer models). It lives inside the same array as user and assistant turns."
            when="Any OpenAI chat call. Keep the system message first; later system messages are weaker than the first."
            example={`messages: [\n  { role: "system", content: "You are a senior SRE..." },\n  { role: "user", content },\n]`}
            href="https://platform.openai.com/docs/guides/text-generation"
            sourceLabel="OpenAI — Text generation ↗"
          />
          <HelpCard
            title="Gemini — systemInstruction"
            cite="generateContent"
            body="A dedicated systemInstruction field on the request, separate from contents[]. Roles inside contents[] are user and model (not assistant), and there is no system role inside the array."
            when="Any Gemini call. Note the model role name differs from OpenAI/Anthropic's assistant."
            example={`{\n  systemInstruction: { parts: [{ text: "You are a senior SRE..." }] },\n  contents: [{ role: "user", parts: [{ text: prompt }] }],\n}`}
            href="https://ai.google.dev/gemini-api/docs/text-generation"
            sourceLabel="Gemini — Text generation ↗"
          />
        </div>
      </div>

      {/* §5 — Escalation checklist */}
      <div id="help-s5" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§5 · when to escalate</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          Single prompt → multi-agent: a checklist, not a default
        </h3>
        <p style={{ marginBottom: "16px", fontSize: "0.95rem", lineHeight: 1.6 }}>
          Anthropic&apos;s own multi-agent research system uses about{" "}
          <strong>15× more tokens than a normal chat</strong>. That cost only pays off when the task
          is genuinely parallelizable and high-value — most tasks are neither. Climb this ladder one
          rung at a time and stop at the first rung that works.
        </p>
        <ol style={{ paddingLeft: "22px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "0.92rem", lineHeight: 1.55, marginBottom: "16px" }}>
          <li><strong>Single prompt first.</strong> A tighter R-G-C-B-T-S frame fixes more than people expect. Exhaust this before anything else.</li>
          <li><strong>Add a technique, not an agent.</strong> CoT, few-shot, or structured output (§2) often closes the gap with zero extra calls.</li>
          <li><strong>Chain (§3 sequential)</strong> only when the task has distinct stages you want to gate between — still deterministic, still cheap.</li>
          <li><strong>Add an evaluator (§3)</strong> when quality is measurable in words and one pass isn&apos;t reliably good enough.</li>
          <li><strong>Go multi-agent (orchestrator/parallel/debate)</strong> only when subtasks are truly independent and the value justifies ~15× the tokens and the added failure modes.</li>
        </ol>
        <p className="muted" style={{ fontSize: "0.88rem", lineHeight: 1.55 }}>
          Anthropic&apos;s rule of thumb: multi-agent shines for breadth-first tasks (research that fans
          out into independent threads) and is a poor fit when subtasks share heavy context or depend
          on each other&apos;s output — those serialize anyway and just burn tokens.
        </p>
        <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>
          <a href="https://www.anthropic.com/engineering/built-multi-agent-research-system" rel="noopener">
            Anthropic — How we built our multi-agent research system ↗
          </a>
        </p>
      </div>

      {/* §6 — Context pipeline */}
      <div id="help-s6" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§6 · context pipeline</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          Budget the context window like RAM
        </h3>
        <p className="muted" style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
          The window isn&apos;t free space to fill — it&apos;s a fixed budget where every token competes for
          the model&apos;s attention, and attention degrades as it fills (&ldquo;context rot&rdquo;). The
          Context tool turns these decisions into an explicit plan: what each call sees, how much of the
          window it gets, what happens when it fills, and what survives a handoff. The cards below are the
          model behind that tool.
        </p>
        <div className="help-cards">
          <HelpCard
            title="Per-source token budgets"
            cite="Anthropic · context engineering"
            body="Treat each context source — pinned instructions, retrieved chunks, scratchpad, history, shared store, user prefs — as a line item with its own token allocation against the model window. The goal is the smallest set of high-signal tokens that still covers the task, not the largest set that fits."
            when="Any agent or RAG call where multiple sources compete for the window and you've started seeing the model lose track of earlier instructions."
            example={`window: 200k\n  pinned (system + tools)   30k   always present\n  retrieved (top-k chunks)  50k   capped, re-ranked\n  history (compacted)       60k   evicts oldest first\n  output reserve            20k   never allocated away`}
            href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
            sourceLabel="Anthropic — Effective context engineering ↗"
          />
          <HelpCard
            title="Eviction triggers"
            cite="context-rot research"
            body="Decide in advance what falls out of the window and when, rather than letting the API truncate blindly. Common triggers: a token threshold (e.g. evict at 85% full), a turn count, manual checkpoints, or never (pinned). Without an explicit rule the oldest — often the most load-bearing system instruction — is what silently goes."
            when="Long-running conversations or agent loops that will exceed the window. Set the trigger before you hit the limit, not after the model starts forgetting."
            example={`trigger: token_threshold @ 0.85 of window\n  -> compact history to a summary\n  -> keep pinned slots untouched\n  -> drop scratchpad older than current task`}
            href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
            sourceLabel="Anthropic — Effective context engineering ↗"
          />
          <HelpCard
            title="History compaction"
            cite="Anthropic · context engineering"
            body="When history won't fit, compress it rather than truncate it: summarize older turns, bias toward salient entities/IDs, and strip large tool payloads while keeping the decision that used them. Server-side compaction (beta) does this automatically — but you still choose what's salient enough to survive."
            when="Multi-turn agents where early decisions matter later but the raw transcript is too big to keep verbatim."
            example={`method:  summarize older turns\n  salience bias: keep entity IDs, file paths, verdicts\n  surgical trim: drop raw tool-result bodies, keep the\n                 one-line outcome that the next step needs`}
            href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching"
            sourceLabel="Anthropic — Prompt caching ↗"
          />
          <HelpCard
            title="Handoff format"
            cite="multi-agent systems"
            body="What one agent passes to the next is itself a context decision. A structured summary (or JSON) of decisions + open questions travels well and stays cheap; the full transcript is risky — it re-imports the prior agent's noise and burns the receiver's window before it starts. Pick the format on purpose."
            when="Orchestrator/worker or sequential pipelines (§3) where a subtask result feeds the next agent's window."
            example={`handoff (recommended): summary\n  { decisions: [...], artifacts: [...],\n    open_questions: [...], next_action: "..." }\n# transcript handoff = re-importing noise -> avoid`}
            href="https://www.anthropic.com/engineering/built-multi-agent-research-system"
            sourceLabel="Anthropic — Multi-agent research system ↗"
          />
          <HelpCard
            title="Count before you trust the estimate"
            cite="Messages API"
            body="The Context tool's token figures are a rough estimate (chars ÷ 4). Before you ship a budget that's close to the limit, verify it with the provider's real tokenizer — Anthropic's count_tokens endpoint returns the exact input token count for a given request shape."
            when="Any budget where you're within ~10% of the window and an overflow would truncate silently."
            example={`client.messages.countTokens({\n  model: "claude-opus-5",\n  system, messages,\n})  // -> { input_tokens: 187_402 }`}
            href="https://docs.anthropic.com/en/docs/build-with-claude/token-counting"
            sourceLabel="Anthropic — Token counting ↗"
          />
        </div>
        <p style={{ marginTop: "16px", fontSize: "0.85rem" }}>
          Plan one now:{" "}
          <Link href="/context-pipeline">open the Context pipeline &rarr;</Link>
        </p>
      </div>

      {/* §7 — Writing tools for agents */}
      <div id="help-s7" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§7 · writing tools for agents</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          Give the model tools it can actually use
        </h3>
        <p className="muted" style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
          A function-calling tool is a JSON contract: <code>name</code>, <code>description</code>, and an{" "}
          <code>input_schema</code>. The description is the single highest-leverage factor in whether the
          model calls the tool correctly — treat it like onboarding docs for a new teammate. Build and
          validate one in the <Link href="/tools">Tool Builder &rarr;</Link>
        </p>
        <div className="help-cards">
          <HelpCard
            title="Write the description like onboarding docs"
            cite="Anthropic · define-tools"
            body="The description is the most important factor in tool performance. State what the tool does, when to use it (and when NOT to), what each parameter means, and any caveats. Aim for 3-4 sentences — more for complex tools. A name must match ^[a-zA-Z0-9_-]{1,64}$."
            when="Always. A vague one-line description is the #1 cause of the model mis-calling or skipping a tool."
            example={`{
  "name": "get_stock_price",
  "description": "Retrieves the current stock price for a ticker on a major US exchange (NYSE/NASDAQ). Returns the latest trade price in USD. Use when the user asks for a stock's current/most-recent price. Does NOT return historical data or company info.",
  "input_schema": {
    "type": "object",
    "properties": { "ticker": { "type": "string", "description": "e.g. AAPL for Apple Inc." } },
    "required": ["ticker"]
  }
}`}
            href="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools"
            sourceLabel="Anthropic — Define tools ↗"
          />
          <HelpCard
            title="Namespace names, consolidate operations"
            cite="Anthropic · writing tools for agents"
            body="When tools span services or resources, prefix the name (db_search, github_list_prs) so selection stays unambiguous as your library grows. Prefer fewer, more capable tools (one tool with an action param) over many overlapping ones, and return only high-signal fields — resolve opaque UUIDs to human-readable values."
            when="As soon as you have more than a couple of tools, or a tool whose response is large/low-signal."
            example={`db_search        not  search
github_list_prs  not  list

# one capable tool, not three:
manage_pr(action: "create" | "review" | "merge", ...)`}
            href="https://www.anthropic.com/engineering/writing-tools-for-agents"
            sourceLabel="Anthropic — Writing tools for agents ↗"
          />
          <HelpCard
            title="Strict mode for guaranteed-valid inputs"
            cite="Anthropic · strict tool use"
            body="Set strict: true to constrain sampling so the model's tool inputs always match your schema (no '2' where you need 2, no missing required fields). Optional properties stay optional — strict only adds additionalProperties: false to close the schema. The Tool Builder emits exactly this when you tick the strict box."
            when="Production agents where a malformed tool call would break your function. Toggle it on in the builder."
            example={`"strict": true,
"input_schema": {
  "type": "object",
  "properties": { "location": {"type":"string"}, "unit": {"type":"string","enum":["celsius","fahrenheit"]} },
  "required": ["location"],
  "additionalProperties": false
}`}
            href="https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use"
            sourceLabel="Anthropic — Strict tool use ↗"
          />
        </div>
        <p style={{ marginTop: "16px", fontSize: "0.85rem" }}>
          Build one now:{" "}
          <Link href="/tools">open the Tool Builder &rarr;</Link>
        </p>
      </div>

      {/* §8 — Scheduled loops & loop engineering */}
      <div id="help-s8" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§8 · scheduled loops</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "8px" }}>
          Loop engineering: run a prompt until the work is done
        </h3>
        <p className="muted" style={{ marginBottom: "20px", fontSize: "0.9rem" }}>
          Claude Code&apos;s <code>/loop</code> skill re-runs a prompt on a schedule from inside a
          session — poll a deploy, babysit a PR, keep a branch green. The hard part isn&apos;t the
          schedule; it&apos;s writing a loop that ends cleanly instead of spinning or declaring false
          victory. These cards are the model behind the <Link href="/loops">Loops tab</Link>; the
          builder turns them into a paste-ready command.
        </p>
        <div className="help-cards">
          <HelpCard
            title="Three modes, chosen by what you omit"
            cite="Claude Code · scheduled tasks"
            body="Supplying an interval and a prompt runs on a fixed cron schedule. Dropping the interval makes it self-paced: Claude picks each delay (1–60m) from what it just saw — short while a build runs, long once it's idle — and can end the loop itself when the task is provably done. Bare /loop runs a built-in maintenance prompt, or a committable .claude/loop.md you write."
            when="Fixed for steady polling; self-paced for watching something whose urgency varies; maintenance/loop.md for an end-of-session 'keep the branch healthy' default."
            example={`/loop 5m check the deploy        # fixed cron\n/loop check CI and review comments  # self-paced\n/loop                            # built-in maintenance / loop.md`}
            href="https://code.claude.com/docs/en/scheduled-tasks"
            sourceLabel="Claude Code — Run prompts on a schedule ↗"
          />
          <HelpCard
            title="The verifier is the hard part, not the loop"
            cite="loop engineering"
            body="A loop that grades its own homework will delete the failing test and declare success. Give it a measurable exit (exit code 0, empty queue, clean git status), prove completion with an independent check, and require a streak — one green run is luck, three in a row is reliability. Cap iterations so a stuck loop reports what blocked it instead of spinning."
            when="Any until-done loop (fix-until-tests-pass, drain-a-queue). Write the stop condition and verifier before the prompt; the Loops builder weaves them into the generated command."
            example={`Run the suite; fix failures; re-run.\nStop when: the suite passes 3× in a row.\nVerify by: re-running from clean — not by editing/skipping tests.\nGive up after: 20 iterations, then report.`}
            href="https://code.claude.com/docs/en/scheduled-tasks"
            sourceLabel="Claude Code — Run prompts on a schedule ↗"
          />
          <HelpCard
            title="Prefer events to polling; mind the cadence"
            cite="Claude Code · Monitor + cron"
            body="For a live stream, a dynamic loop can use the Monitor tool — it tails a background script and reacts to each line instead of re-running a prompt, which is more responsive and more token-efficient than polling. When you do poll, pick the interval deliberately: intervals snap to clean cron steps (7m→5m), a flat 5m sits exactly on the prompt-cache TTL (the worst pick), and hourly+ jobs can fire up to 30m late from jitter."
            when="Reach for Monitor/event-driven when watching a log or build stream. For pure polling, stay just under the 5-minute cache window or go to ≥20m — avoid a round 5m and the :00/:30 jitter minutes."
            example={`# event-driven, not a poll:\n/loop tail the dev log; tell me the moment a request 500s\n\n# cron-rounding the builder warns about:\n7m  -> 5m      5m -> on the cache TTL      2h -> fires :00–:30`}
            href="https://code.claude.com/docs/en/tools-reference"
            sourceLabel="Claude Code — Monitor tool & cron ↗"
          />
        </div>
        <p className="muted" style={{ marginTop: "16px", fontSize: "0.88rem", lineHeight: 1.55 }}>
          <code>/loop</code> is session-scoped — it pauses when the session closes and restores on
          <code>--resume</code>, and recurring tasks auto-expire seven days after creation. For
          scheduling that survives a closed laptop, Claude Code offers <strong>Routines</strong>
          (cloud, created with <code>/schedule</code>), Desktop scheduled tasks, and GitHub Actions.
        </p>
        <p style={{ marginTop: "12px", fontSize: "0.85rem" }}>
          Build one now: <Link href="/loops">open the Loops tab &rarr;</Link>
        </p>
      </div>

      {/* §9 — Sources */}
      <div id="help-s9" style={{ scrollMarginTop: "72px" }}>
        <div className="label-mono" style={{ marginBottom: "8px" }}>§9 · primary sources</div>
        <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "12px" }}>
          Read these before you ship the pattern
        </h3>
        <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.88rem", lineHeight: 1.5 }}>
          <li><a href="https://www.anthropic.com/engineering/building-effective-agents" rel="noopener">Anthropic — Building effective agents</a> — the workflow/agent taxonomy used in §3.</li>
          <li><a href="https://www.anthropic.com/engineering/built-multi-agent-research-system" rel="noopener">Anthropic — How we built our multi-agent research system</a> — the ~15× cost figure and breadth-first heuristic in §5.</li>
          <li><a href="https://arxiv.org/abs/2305.14325" rel="noopener">Du et al. 2023 — Improving Factuality and Reasoning through Multiagent Debate</a>.</li>
          <li><a href="https://arxiv.org/abs/2303.11366" rel="noopener">Shinn et al. 2023 — Reflexion: Verbal Reinforcement Learning</a>.</li>
          <li><a href="https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents" rel="noopener">Anthropic — Effective context engineering for AI agents</a> — the per-source budgeting and eviction model in §6.</li>
          <li><a href="https://www.anthropic.com/engineering/writing-tools-for-agents" rel="noopener">Anthropic — Writing tools for agents</a> · <a href="https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools" rel="noopener">Define tools</a> · <a href="https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use" rel="noopener">Strict tool use</a> — the tool-definition conventions, schema constraints, and strict mode in §7.</li>
          <li><a href="https://docs.anthropic.com/en/docs/build-with-claude/token-counting" rel="noopener">Anthropic — Token counting</a> · <a href="https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching" rel="noopener">Prompt caching</a> — exact counts and compaction in §6.</li>
          <li><a href="https://docs.anthropic.com/en/api/messages" rel="noopener">Anthropic Messages API</a> · <a href="https://platform.openai.com/docs/guides/text-generation" rel="noopener">OpenAI Text generation</a> · <a href="https://ai.google.dev/gemini-api/docs/text-generation" rel="noopener">Gemini Text generation</a> — the SDK shapes in §4.</li>
          <li><a href="https://code.claude.com/docs/en/scheduled-tasks" rel="noopener">Claude Code — Run prompts on a schedule (/loop)</a> · <a href="https://code.claude.com/docs/en/routines" rel="noopener">Routines (/schedule)</a> — the loop modes, stop-condition, and cadence guidance in §8.</li>
        </ul>
      </div>
    </div>
  );
}
