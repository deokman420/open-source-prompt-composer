// Knowledge base for the AI Help agent.
//
// This is the single source of truth for what the help agent "knows". It is
// stuffed into the system prompt (see chat.ts) rather than retrieved from a
// vector store — the corpus is small enough to live in a cacheable prefix, and
// BYOK means the user pays input tokens per turn, so we keep it tight.
//
// Two halves:
//   1. APP_KB  — how Prompt Composer itself works. Authored from the
//      codebase; keep in sync when features change.
//   2. PROMPT_ENGINEERING_KB — distilled from the /help field guide, with the
//      same primary-source citations. Keep claims sourced.

export const APP_KB = `# Prompt Composer — how the app works

Prompt Composer is a toolkit for writing, structuring, and evaluating prompts
and agent systems. It is free, open source (MIT), and runs entirely in the
browser: prompts, drafts, and API keys are stored on the user's own device and
never sent to a server. Every AI-backed feature runs on the user's own provider
key, so the only cost is what their provider charges. It can be self-hosted.

Every page in this app has a route, so you can link a user straight to it — e.g.
API keys and vault settings are at
https://prompt.phbeks.com/settings.

## The R-G-C-B-T-S frame
The shared vocabulary across the whole app. A strong prompt fills six slots:
- **Role** — who the model is playing.
- **Goal** — the single outcome it is optimizing for.
- **Context** — the facts, data, and background it needs.
- **Bounds** — constraints, exclusions, and things it must NOT do.
- **Task** — the concrete work, ideally as ordered steps.
- **Success** — checkable criteria for a good answer.
Separating the slots stops the model confusing them. Every tool below feeds this frame.

## Compose (/compose)
The single-prompt builder. Available to any signed-in user.
- How to use it: fill the R-G-C-B-T-S slots; the "Add-on slots" expander adds Tools,
  Format, and Clarify; the Examples block takes 1-3 input/output pairs. A live preview
  assembles the structured prompt as you type, with a rough token estimate.
- "Export as" outputs Markdown or XML, or ready-to-run code (cURL, Python/TypeScript
  SDK) for Anthropic, OpenAI, Gemini, Bedrock, or Vertex. "Copy as Markdown" / "Copy as
  plain text" copy the result; "Send to Evaluator" hands the current prompt to AI Eval.
- Every code export puts the composed frame in the provider's **system** slot (Anthropic
  top-level system, OpenAI role:system, Gemini systemInstruction) and leaves a short
  kickoff placeholder as the user turn. That mirrors how production prompts actually
  ship — a durable system document plus a per-run kickoff message. Replace the
  placeholder with the run-specific input; don't paste it back into the frame.
- Save draft / New blank manage drafts (autosaved to this device). "Export / backup"
  opens Settings > Backup & restore, which writes an encrypted file of everything.
- When to use: any single-call prompt you want to get right.

## Orchestra (/orchestra)
A builder for multi-agent / multi-call systems.
- How to use it: pick an orchestration pattern from the pattern picker (it seeds a
  starting set of agents); edit each agent's role/goal/context/bounds/task/success;
  set the Coordination card (handoff format, max workers, termination rule, shared
  memory). A live preview shows the composed bundle with an "Orchestra health" score
  and token estimate.
- "Export as" outputs the prompt bundle (Markdown/XML) or runnable Python/TypeScript
  for Anthropic, OpenAI, Gemini, Bedrock, or Vertex. Copy bundle / Copy as JSON /
  Send to Evaluator; Save draft; "Export / backup" opens Settings > Backup & restore.
- When to use: a task that needs more than one model call — but escalate deliberately
  (multi-agent can cost ~15x a single chat; see the escalation checklist in the
  prompt-engineering KB). Reach for the simplest pattern first.

## Context Pipeline (/context-pipeline)
A planner for budgeting the context window like RAM.
- How to use it: pick a target model so the window and sliders match it — the
  picker includes Anthropic, OpenAI, Gemini, xAI (Grok), NVIDIA, OpenRouter, and
  DeepSeek. Grok 4.6 / 4.5 are 500k; Grok 4.3 and the 4.20 pair are 1M. Then
  declare each context source (pinned instructions, retrieved chunks, history,
  scratchpad, shared store) as a line item with a token allocation; set eviction
  triggers (what falls out and when); define history compaction and the handoff
  format between agents. A Measure panel verifies exact token counts via the
  provider tokenizer when one exists (Anthropic, Gemini). xAI and the other
  OpenAI-compatible providers fall back to a chars/4 estimate.
- Export the plan as a Markdown/XML spec or as runnable scaffolding (LangGraph, n8n,
  raw Python/TypeScript). Save / Reset to defaults; "Export / backup" opens
  Settings > Backup & restore.
- When to use: long-running agents or RAG calls where sources compete for the window
  and the model is losing track of earlier instructions ("context rot").

## Tool Builder (/tools)
Builds and validates function-calling tool definitions (name, description,
input_schema) for Anthropic/OpenAI/Gemini.
- How to use it: write the name and description, define each input property, and tick
  strict mode to emit additionalProperties:false. The builder validates the schema and
  exports the JSON tool definition.
- The description is the highest-leverage field — write it like onboarding docs (what
  it does, when/when-NOT to use it, each parameter). Names must match ^[a-zA-Z0-9_-]{1,64}$.

## Loops (/loops)
A builder and teaching gallery for Claude Code's \`/loop\` scheduled-task skill — the
in-session command that re-runs a prompt on a schedule (poll a deploy, babysit a PR,
keep a branch healthy). It produces copy-paste-ready commands; it does not run loops
itself (loops run in the user's own Claude Code session).
- The three loop modes, chosen by what you supply: **Fixed interval** (\`/loop 5m <prompt>\`)
  runs on a cron schedule; **Self-paced** (\`/loop <prompt>\`, no interval) lets Claude pick
  each delay (1–60m) from what it just saw; **Maintenance** (bare \`/loop\`) runs the built-in
  maintenance prompt or a committable \`.claude/loop.md\` you write.
- How to use it: pick a mode, fill the interval/prompt, optionally add a **stop condition**,
  an **independent verifier**, and an **iteration cap** (these are woven into the generated
  prompt so loops end cleanly). A live preview shows the exact command and, for maintenance
  mode, the \`loop.md\` file. Interval analysis flags cron rounding (\`7m → 5m\`), the prompt-cache
  cadence window (~5-minute TTL makes a flat 5m the worst pick), and jitter on hourly+ jobs.
- A 12-example **pattern gallery** teaches the technique (fixed polling, self-paced watchers,
  loop.md defaults, until-done+verifier, command loops, event-driven/Monitor). Load any example
  into the builder to learn by editing.
- Loops save to your synced drafts (kind="loop") and appear under a **Loops tab in /drafts**.
- Key caveats to relay: \`/loop\` is session-scoped (pauses when the session closes, restored on
  \`--resume\`); recurring tasks auto-expire 7 days after creation; for unattended scheduling that
  survives a closed laptop, point users to Claude Code **Routines** (cloud, via \`/schedule\`),
  Desktop scheduled tasks, or GitHub Actions instead. Needs Claude Code v2.1.72+.
- When to use: a repeating check you want to run while a Claude Code session is open.

## AI Eval (/eval) — uses your own API key
Runs your prompt through a model and returns structured feedback. Pick a provider and
model, choose a mode, paste or prefill a prompt, and run. Four modes:
- **Spellcheck & grammar** — typos and grammar only, no rewriting.
- **Rewrite for clarity (optimize)** — restructures toward R-G-C-B-T-S without
  changing intent; result can be saved straight back to Composer drafts.
- **Validate code blocks (codecheck)** — checks code inside the prompt.
- **Score R-G-C-B-T-S (structure)** — 0-100 per slot plus an overall score.
Eval uses YOUR API key (BYOK). Add a key first at /settings or it refuses to run.
There is no usage cap; you are billed by your own provider, so pace is yours to set.

## AI Help (this chat) — uses your own API key
The chat you are using now. It answers questions about the app and about context/
prompt engineering on the model behind your own API key; pick a provider and model and
answers stream in. It runs on your own API key, like every other AI-backed feature here.

## API keys / BYOK (/settings)
"Bring Your Own Key": store one or more provider API keys — supported providers are
Anthropic, OpenAI, Google (Gemini), xAI (Grok), NVIDIA (NIM), OpenRouter, and DeepSeek.
Note JSON/Eval support is per-model: Anthropic, OpenAI, Google, xAI (Grok), and DeepSeek
are Eval-enabled (they honor JSON-object output). NVIDIA and OpenRouter stay chat-only
(AI Help) until confirmed per model. Keys are
encrypted at rest (AES-256-GCM, envelope-wrapped per row) and only decrypted in memory
for a single call — never logged, never shown in plaintext (only the last 4 characters,
for recognition).
- To add or rotate a key: go to /settings, pick the provider, paste the key,
  optionally label it, and save. There is one key per provider — pasting a new key for a
  provider replaces the old one (that is how you rotate). Delete a key anytime with its
  Delete button.
- AI Eval and AI Help call the provider with your key, so spend lands on your provider
  bill. Pick the provider in each tool; if no key is on file for it, the tool shows an
  "add a key" prompt instead of running.

### Where to get a provider key (console click-paths)
The most common support question. The user mints the key at the *provider's* console,
then pastes it at /settings. Give the exact path for the provider they ask about; the
key is shown only once on every provider, so tell them to copy it immediately. Spend is on
their provider account (BYOK) — adding a key here never bills them through us.

- **Anthropic (Claude)** — go to console.anthropic.com (sign in; it may show as
  platform.claude.com). Sidebar **Settings → API keys** (direct: console.anthropic.com/settings/keys)
  → **Create Key** → name it → copy. Key starts **sk-ant-**. Pay-as-you-go: add a card and
  credits under **Billing/Plans** first, or calls 401/402.
- **OpenAI (GPT)** — go to platform.openai.com. **Dashboard → API keys** (direct:
  platform.openai.com/api-keys) → **Create new secret key** → name it (optionally scope to a
  project) → copy. Starts **sk-** (project keys **sk-proj-**). Add a payment method + credit
  under **Settings → Billing** first.
- **Google (Gemini)** — go to aistudio.google.com (sign in with a Google account). **Get API
  key** in the left panel (direct: aistudio.google.com/apikey) → **Create API key** → pick or
  create a Google Cloud project → copy. Has a free tier; the newest 3.x / Pro models need
  billing enabled on the project.
- **xAI (Grok)** — go to console.x.ai (sign in with X / xAI). Finish onboarding, then
  **API Keys → Create API Key** → name it → copy. Starts **xai-**. Prepaid: add a card/credits
  under **Billing**; new accounts often get promotional credit that expires. Current
  lineup (docs.x.ai, 2026-08): **grok-4.6** is the flagship and the default in Eval
  and AI Help — most capable and fastest, 500k context, structured JSON output so it
  works as an eval grader. **grok-4.5** is the previous flagship (also 500k).
  **grok-4.3** is cheaper with a 1M window. The **grok-4.20** reasoning / non-reasoning
  pair remains for latency or deep-reasoning A/B. Knowledge cutoff for 4.6 is
  2026-02-01.
- **NVIDIA NIM** — go to build.nvidia.com (sign in / create a free NVIDIA account). Open any
  model card and click **Get API Key** (or **Build with this NIM**) → **Generate** → copy. Starts
  **nvapi-**; one key works across all hosted models. Free credits to start, no card required.
- **OpenRouter** — go to openrouter.ai (sign in with Google/GitHub/email). **Keys** (direct:
  openrouter.ai/settings/keys) → **Create Key** → name it, optionally set a credit limit → copy.
  Starts **sk-or-**. One key reaches hundreds of models; add credit at openrouter.ai/credits →
  **Manage Billing** (free **:free** model variants need no credit).
- **DeepSeek** — go to platform.deepseek.com (sign up with email/phone). Sidebar **API keys →
  Create new API key** → name it → copy. Starts **sk-**. Prepaid: you must **Top up** a balance
  under Billing before the key works; cheapest of the seven.

## Drafts
Compose, Tool Builder, Context Pipeline, Orchestra, Eval, and Loops drafts autosave.
Signed-in users get their drafts synced to their account (kind-scoped) so they persist
across devices; there are per-kind caps on how many drafts are kept. The /drafts library
has a tab per kind (search, rename, open back into the editor).

## Common questions
- "How do I get an API key / where do I get one for <provider>?" → it's minted at the
  provider's own console, then pasted at /settings. Give the exact click-path for that
  provider from "Where to get a provider key" above (URL → Create key → copy once), and remind
  them spend is on their provider bill (BYOK), not ours.
- "How much does this cost / how do I cancel?" → the app is free and MIT-licensed;
  there is no account and no subscription, so there is nothing to cancel. The only
  cost is what the user's own model provider bills them.
- "How do I rotate or replace an API key?" → /settings, paste a new key for the same
  provider; it replaces the old one.
- "Eval/Help won't run" → add a provider API key at /settings, and make sure the
  selected provider matches a key you added. There is no usage cap in this build.
- "Where's my spend?" → entirely on your own provider account (BYOK). This app never
  bills you for anything.
- "Which model should I pick?" → the system default is Claude Sonnet 5; cheapest
  options (Haiku / GPT mini / Flash) are plenty for help and most eval modes. On
  xAI, pick **Grok 4.6** — it is the current flagship for chat, code, and eval.
  Step up to a stronger model only for hard reasoning or code review.`;

export const PROMPT_ENGINEERING_KB = `# Context & prompt engineering — field guide

Distilled from primary sources (Anthropic, OpenAI, Google docs; seminal papers).
Cite the source when you state a technique so the user can read it.

## Why structure beats prose
A wall of prose forces the model to infer role, objective, and output shape at
once. A frame (R-G-C-B-T-S) lets it just fill the slots. The deep rule: separate
the slots so the model can't confuse them.

## Single-prompt techniques
- **Zero-shot** (Brown et al. 2020, arxiv.org/abs/2005.14165): instruction only,
  no examples. Good for common tasks; degrades on unusual formats.
- **Few-shot / in-context learning** (Brown et al. 2020): include 2-8 input/output
  demonstrations. Benefits saturate past ~8-16 examples; sensitive to ordering.
- **Chain-of-Thought** (Wei et al. 2022, arxiv.org/abs/2201.11903): ask for
  intermediate reasoning before the answer. Helps multi-step reasoning at scale;
  can hurt small models.
- **Self-Consistency** (Wang et al. 2022, arxiv.org/abs/2203.11171): sample N CoT
  paths, majority-vote the answer. Multiplies cost by N. The paper varies paths
  with temperature; current Claude models reject temperature/top_p/top_k (400),
  so vary the prompt per run instead (give each run a different stated angle).
- **Tree-of-Thoughts** (Yao et al. 2023, arxiv.org/abs/2305.10601): search tree of
  candidate thoughts with an evaluator; needs a BFS/DFS controller.
- **ReAct** (Yao et al. 2022, arxiv.org/abs/2210.03629): interleave Thought /
  Action (tool call) / Observation. For tasks needing lookups or environment use.
- **Reflexion** (Shinn et al. 2023, arxiv.org/abs/2303.11366): after a failed
  attempt, write a critique into memory and prepend it to the next try. Needs a
  checkable verdict per attempt.
- **Role / persona prompting** (Anthropic docs): set a role to steer tone and
  defaults; does not unlock new capability.
- **Chain-of-Density** (Adams et al. 2023, arxiv.org/abs/2309.04269): iteratively
  pack more salient entities into a fixed-length summary.
- **Structured output / JSON schema mode** (OpenAI 2024): constrain decoding to
  valid JSON matching a schema — enforced at the decode layer, not by instruction.
- **Prompt chaining** (Anthropic docs): split into a sequence of calls; the classic
  pattern is draft -> critique -> revise.

## Reasoning-era models (what changed, and what to delete)
Most published prompt advice — including several techniques above — was written
for models that under-reasoned and needed pushing. Current frontier models
(Claude Opus 5 / Sonnet 5 / Fable 5, Grok 4.6, and peers) reason by default and follow
instructions literally, so the old counterweights push the wrong way. When a user
asks why a prompt behaves differently on a new model, start here. The rule of
thumb: delete more than you add.
- **Thinking is on by default** (platform.claude.com/docs/en/build-with-claude/adaptive-thinking):
  "think step by step" is redundant, and asking the model to reproduce its
  reasoning in the answer can be refused. Control depth with \`output_config.effort\`
  (low → max), not prose. Trap: thinking tokens share the \`max_tokens\` budget with
  the answer, so an old limit can be spent thinking and return truncated text.
- **Sampling parameters are gone**: temperature / top_p / top_k are a 400 on Opus 5,
  Sonnet 5, Fable 5, Opus 4.7+. For repeatability, tighten the prompt and lower
  effort. For variety, ask for it ("propose 4 distinct approaches, then pick one").
- **Delete verification instructions — but not evidentiary discipline**: "double-check",
  "verify before responding", and separate verification passes cause over-verification
  — these models already check their own work. Removing them costs no accuracy. This
  inverts the older self-check best practice. The carve-out: asking the model to
  re-read its own reasoning is what you delete; requiring that factual claims trace to
  something actually executed is what you keep. Anthropic's released production prompts
  (de novo protein-binder design, Aug 2026,
  huggingface.co/datasets/Anthropic/claude-protein-binder-design) drop the former and
  keep a standing Behavior/Verification section for the latter — "'Verified' means you
  ran a check and you have its output", "never write an external identifier from
  memory", "lead with the unfavorable result". In any run where the model acts on the
  world, that section earns its tokens.
- **Say how long and how wide**: responses and written deliverables run long, and
  lowering effort does NOT reliably shorten them — length is a prompt instruction.
  Scope needs a bound too: state "deliver what I asked at the scope I asked".
- **Cap delegation**: the previous generation under-delegated; the current one
  over-delegates. Remove any "delegate more" guidance and set an explicit ceiling
  — never spawn a subagent for work the main loop could finish in a few tool calls,
  or to verify its own output. One regime inverts this: long-running compute
  campaigns, where the orchestrator should do no work itself. Anthropic's released
  campaign prompts push every model call, GPU job, and billing query into sub-agents
  and leave the orchestrator as a thin heartbeat-and-dispatch loop, so a stall in one
  job cannot stall the coordinator. That is a scheduling constraint, not a prompting
  one — it applies when work outlives a single context, not to ordinary chat turns.
- **Assistant prefill is gone**: prefilling the final assistant turn to force a
  format is a 400 on Claude 4.6+. Use structured outputs (a JSON schema) instead.

## Orchestration patterns (composing >1 call)
From Anthropic "Building effective agents"
(anthropic.com/engineering/building-effective-agents), plus debate and reflection:
- **Sequential** — fixed pipeline; each step feeds the next; you control flow.
- **Routing** — a classifier sends each input to a specialized handler.
- **Parallel** — fan out independent subtasks (sectioning) or run one task N times
  (voting), then aggregate.
- **Orchestrator-worker** — a lead model decomposes the task at runtime and
  delegates; subtasks aren't fixed in advance.
- **Evaluator-optimizer** — generator + grader loop until criteria pass.
- **Multi-agent debate** (Du et al. 2023, arxiv.org/abs/2305.14325) — agents answer
  independently then critique across rounds.
- **Reflection** (Shinn et al. 2023) — single agent critiques its own last attempt.

## When to escalate single -> multi-agent
Anthropic's multi-agent research system uses ~15x the tokens of a normal chat
(anthropic.com/engineering/built-multi-agent-research-system). Climb one rung at a
time, stop at the first that works:
1. Tighten the single prompt (R-G-C-B-T-S).
2. Add a technique (CoT, few-shot, structured output) — no extra calls.
3. Chain only when there are distinct stages to gate between.
4. Add an evaluator when quality is measurable in words and one pass isn't enough.
5. Go multi-agent only when subtasks are truly independent and the value justifies
   ~15x tokens and added failure modes. Multi-agent shines for breadth-first tasks
   and is poor when subtasks share heavy context or depend on each other.

## Provider system-prompt conventions
The system prompt slot differs per API; get it wrong and it becomes a user turn.
- **Anthropic** (docs.anthropic.com/en/api/messages): top-level "system" string or
  array of blocks, separate from messages[]. Not a role:system message.
- **OpenAI** (platform.openai.com/docs/guides/text-generation): first element of
  messages[] with role:system (or developer on newer models).
- **Gemini** (ai.google.dev/gemini-api/docs/text-generation): a dedicated
  "systemInstruction" field; roles inside contents[] are user and model (not assistant).

## Context engineering (budget the window like RAM)
From Anthropic "Effective context engineering"
(anthropic.com/engineering/effective-context-engineering-for-ai-agents):
- **Per-source budgets** — give each source (pinned, retrieved, history, scratchpad)
  its own token allocation; aim for the smallest high-signal set, not the largest
  that fits. Attention degrades as the window fills ("context rot").
- **Eviction triggers** — decide in advance what falls out and when (token
  threshold, turn count, manual, or never/pinned), so the API doesn't truncate the
  most load-bearing instruction silently.
- **History compaction** — when history won't fit, summarize rather than truncate;
  keep entity IDs, file paths, verdicts; drop raw tool payloads.
- **Handoff format** — pass a structured summary (decisions, artifacts, open
  questions, next action) between agents, not the full transcript.
- **Count before you trust the estimate** — verify near-limit budgets with the
  provider's real tokenizer (Anthropic count_tokens endpoint).

## Writing tools for agents
From Anthropic "Writing tools for agents"
(anthropic.com/engineering/writing-tools-for-agents) and the tool-use docs:
- The **description** is the single most important factor in whether the model
  calls a tool correctly. State what it does, when to use it and when NOT to, and
  what each parameter means. Aim for 3-4 sentences.
- **Namespace** names (db_search, github_list_prs) and prefer fewer, more capable
  tools over many overlapping ones. Return high-signal fields; resolve opaque IDs.
- **Strict mode** (strict:true + additionalProperties:false) guarantees inputs
  match your schema in production.`;

// The whole corpus, concatenated. This is what goes into the system prompt.
export const KB_MARKDOWN = `${APP_KB}\n\n---\n\n${PROMPT_ENGINEERING_KB}`;
