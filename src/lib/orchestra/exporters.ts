import { agentSystemPrompt } from "./bundle";
import type {
  Agent,
  CodeTarget,
  ModelEntry,
  OrchState,
  ProviderId,
  Target,
} from "./types";

export const MODELS: Record<ProviderId, ModelEntry[]> = {
  // Current-generation Claude models (Fable/Opus 5/Sonnet 5) carry the bare
  // first-party id on Vertex and an `anthropic.`-prefixed id on Bedrock, so they
  // set `bedrock` only and let `vertex` fall through to `id`. The 4.x entries
  // keep the older `-v1:0` / `@latest` snapshot forms they were published with.
  anthropic: [
    // list[0] is the fallback for an agent with no model set — keep that Opus,
    // not the pricier Fable tier.
    { id: "claude-opus-5", bedrock: "anthropic.claude-opus-5", label: "Claude Opus 5" },
    { id: "claude-sonnet-5", bedrock: "anthropic.claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-fable-5", bedrock: "anthropic.claude-fable-5", label: "Claude Fable 5" },
    { id: "claude-opus-4-8", bedrock: "anthropic.claude-opus-4-8", label: "Claude Opus 4.8" },
    { id: "claude-opus-4-7", bedrock: "anthropic.claude-opus-4-7-v1:0", vertex: "claude-opus-4-7@latest", label: "Claude Opus 4.7" },
    { id: "claude-sonnet-4-6", bedrock: "anthropic.claude-sonnet-4-6-v1:0", vertex: "claude-sonnet-4-6@latest", label: "Claude Sonnet 4.6" },
    { id: "claude-haiku-4-5", bedrock: "anthropic.claude-haiku-4-5-v1:0", vertex: "claude-haiku-4-5@latest", label: "Claude Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-5", label: "GPT-5" },
    { id: "gpt-5-mini", label: "GPT-5 mini" },
    { id: "gpt-4.1", label: "GPT-4.1" },
  ],
  gemini: [
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
};

export function findModel(provider: ProviderId, id: string | undefined): ModelEntry {
  const list = MODELS[provider] || [];
  return list.find((m) => m.id === id) ?? list[0];
}

export function resolveModelId(targetKey: string, modelEntry: ModelEntry | undefined): string {
  if (!modelEntry) return "";
  if (targetKey.startsWith("bedrock-")) return modelEntry.bedrock || modelEntry.id;
  if (targetKey.startsWith("vertex-")) return modelEntry.vertex || modelEntry.id;
  return modelEntry.id;
}

function pyTripleString(s: string): string {
  const safe = String(s).replace(/\\/g, "\\\\").replace(/"""/g, '\\"\\"\\"');
  return `"""${safe}"""`;
}

function tsBacktickString(s: string): string {
  const safe = String(s)
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
  return `\`${safe}\``;
}

function constName(agent: Agent, idx: number): string {
  const base = (agent.name || `${agent.kind}_${idx}`)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base.toUpperCase() || `AGENT_${idx}`) + "_SYSTEM";
}

interface IndexedAgent extends Agent {
  _idx: number;
}

function indexed(state: OrchState): IndexedAgent[] {
  return state.agents.map((a, i) => ({ ...a, _idx: i }));
}

function agentsByKind(state: OrchState) {
  const arr = indexed(state);
  const orch = arr.find((a) => a.kind === "orchestrator") ?? arr[0];
  const workers = arr.filter((a) => a !== orch);
  return { orch, workers, all: arr };
}

function renderAgentConsts(lang: "python" | "ts", state: OrchState): string {
  const parts: string[] = [];
  state.agents.forEach((agent, i) => {
    const name = constName(agent, i);
    const prompt = agentSystemPrompt(agent);
    if (lang === "python") parts.push(`${name} = ${pyTripleString(prompt)}`);
    else parts.push(`const ${name} = ${tsBacktickString(prompt)};`);
  });
  return parts.join("\n\n");
}

// ----- SDK adapters -----
function adapterAnthropicPy(modelId: string): string {
  return `# pip install anthropic
from concurrent.futures import ThreadPoolExecutor
import json
from anthropic import Anthropic

client = Anthropic()  # reads ANTHROPIC_API_KEY from env

def call_agent(system: str, user: str, model: str = "${modelId}") -> str:
    m = client.messages.create(
        model=model, max_tokens=1024, system=system,
        messages=[{"role": "user", "content": user}],
    )
    return m.content[0].text
# Docs: https://docs.anthropic.com/en/api/messages`;
}
function adapterAnthropicTs(modelId: string): string {
  return `// npm i @anthropic-ai/sdk
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

async function callAgent(system, user, model = "${modelId}") {
  const m = await client.messages.create({
    model, max_tokens: 1024, system,
    messages: [{ role: "user", content: user }],
  });
  const b = m.content[0];
  return b.type === "text" ? b.text : "";
}
// Docs: https://docs.anthropic.com/en/api/messages`;
}
function adapterBedrockPy(modelId: string): string {
  return `# pip install boto3
# Auth: standard AWS env vars / IAM role / ~/.aws/credentials
from concurrent.futures import ThreadPoolExecutor
import json, boto3

bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")

def call_agent(system: str, user: str, model: str = "${modelId}") -> str:
    r = bedrock.converse(
        modelId=model,
        system=[{"text": system}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": 1024},
    )
    return r["output"]["message"]["content"][0]["text"]
# Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html`;
}
function adapterBedrockTs(modelId: string): string {
  return `// npm i @aws-sdk/client-bedrock-runtime
// Auth: standard AWS env vars / IAM role / ~/.aws/credentials
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const bedrock = new BedrockRuntimeClient({ region: "us-east-1" });

async function callAgent(system, user, model = "${modelId}") {
  const r = await bedrock.send(new ConverseCommand({
    modelId: model,
    system: [{ text: system }],
    messages: [{ role: "user", content: [{ text: user }] }],
    inferenceConfig: { maxTokens: 1024 },
  }));
  return r.output?.message?.content?.[0]?.text ?? "";
}
// Docs: https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html`;
}
function adapterVertexPy(modelId: string): string {
  return `# pip install "anthropic[vertex]"
# Auth: gcloud auth application-default login (or service account)
from concurrent.futures import ThreadPoolExecutor
import json
from anthropic import AnthropicVertex

client = AnthropicVertex(project_id="YOUR_GCP_PROJECT", region="us-east5")

def call_agent(system: str, user: str, model: str = "${modelId}") -> str:
    m = client.messages.create(
        model=model, max_tokens=1024, system=system,
        messages=[{"role": "user", "content": user}],
    )
    return m.content[0].text
# Docs: https://docs.anthropic.com/en/api/claude-on-vertex-ai`;
}
function adapterVertexTs(modelId: string): string {
  return `// npm i @anthropic-ai/vertex-sdk
// Auth: gcloud auth application-default login (or service account)
import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";

const client = new AnthropicVertex({ projectId: "YOUR_GCP_PROJECT", region: "us-east5" });

async function callAgent(system, user, model = "${modelId}") {
  const m = await client.messages.create({
    model, max_tokens: 1024, system,
    messages: [{ role: "user", content: user }],
  });
  const b = m.content[0];
  return b.type === "text" ? b.text : "";
}
// Docs: https://docs.anthropic.com/en/api/claude-on-vertex-ai`;
}
function adapterOpenAIPy(modelId: string): string {
  return `# pip install openai
from concurrent.futures import ThreadPoolExecutor
import json
from openai import OpenAI

client = OpenAI()  # reads OPENAI_API_KEY from env
# (works with OpenAI-compatible servers: OpenAI(base_url="http://localhost:11434/v1"))

def call_agent(system: str, user: str, model: str = "${modelId}") -> str:
    r = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
    )
    return r.choices[0].message.content
# Docs: https://platform.openai.com/docs/api-reference/chat`;
}
function adapterOpenAITs(modelId: string): string {
  return `// npm i openai
import OpenAI from "openai";

const client = new OpenAI(); // reads OPENAI_API_KEY from env

async function callAgent(system, user, model = "${modelId}") {
  const r = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user",   content: user   },
    ],
  });
  return r.choices[0].message.content ?? "";
}
// Docs: https://platform.openai.com/docs/api-reference/chat`;
}
function adapterGeminiPy(modelId: string): string {
  return `# pip install google-genai
from concurrent.futures import ThreadPoolExecutor
import json
from google import genai
from google.genai import types

client = genai.Client()  # reads GEMINI_API_KEY from env

def call_agent(system: str, user: str, model: str = "${modelId}") -> str:
    r = client.models.generate_content(
        model=model,
        config=types.GenerateContentConfig(system_instruction=system),
        contents=user,
    )
    return r.text or ""
# Docs: https://ai.google.dev/gemini-api/docs/text-generation`;
}
function adapterGeminiTs(modelId: string): string {
  return `// npm i @google/genai
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({}); // reads GEMINI_API_KEY from env

async function callAgent(system, user, model = "${modelId}") {
  const r = await ai.models.generateContent({
    model,
    config: { systemInstruction: system },
    contents: user,
  });
  return r.text ?? "";
}
// Docs: https://ai.google.dev/gemini-api/docs/text-generation`;
}

// ----- pattern coordinators (Python) -----
function pyDictKey(s: string): string {
  return JSON.stringify(String(s));
}
function pyWorkersDict(workers: IndexedAgent[], indent: number): string {
  const pad = " ".repeat(indent);
  const lines = workers.map(
    (w, i) => `${pad}    ${pyDictKey(w.name || `worker_${i}`)}: ${constName(w, w._idx)}`,
  );
  return `{\n${lines.join(",\n")},\n${pad}}`;
}
function tsWorkersObj(workers: IndexedAgent[]): string {
  const lines = workers.map(
    (w, i) => `  ${JSON.stringify(w.name || `worker_${i}`)}: ${constName(w, w._idx)}`,
  );
  return `{\n${lines.join(",\n")},\n}`;
}

function pyOrchestratorWorker(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workersDict = pyWorkersDict(workers, 0);
  return `# ===== pattern: orchestrator-worker =====
WORKERS = ${workersDict}

def main(user_task: str) -> str:
    # 1) Orchestrator decomposes the task into per-worker briefs.
    plan_prompt = (
        "User task:\\n" + user_task +
        "\\n\\nDecompose into independent subtasks. Pick a worker for each from: "
        + ", ".join(WORKERS.keys()) +
        ".\\nRespond ONLY as a JSON list: "
        "[{\\"worker\\": <name>, \\"brief\\": <text>}]."
    )
    plan = json.loads(call_agent(${orchName}, plan_prompt))

    # 2) Workers run in parallel; each gets its assigned brief.
    def run(item):
        sys = WORKERS.get(item["worker"]) or next(iter(WORKERS.values()))
        return {"worker": item["worker"], "result": call_agent(sys, item["brief"])}
    with ThreadPoolExecutor(max_workers=max(1, len(WORKERS))) as ex:
        results = list(ex.map(run, plan))

    # 3) Orchestrator reconciles into the final answer.
    synth_prompt = (
        "Worker results:\\n" + json.dumps(results, indent=2) +
        "\\n\\nReconcile into a final answer, citing each claim to its worker."
    )
    return call_agent(${orchName}, synth_prompt)

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_TASK"))`;
}
function pySequential(state: OrchState): string {
  const ordered = indexed(state);
  const chain = ordered.map((a) => constName(a, a._idx));
  return `# ===== pattern: sequential pipeline =====
PIPELINE = [${chain.join(", ")}]

def main(user_input: str) -> str:
    current = user_input
    for system in PIPELINE:
        current = call_agent(system, current)
    return current

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_INPUT"))`;
}
function pyParallel(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workerList = workers.map((w) => constName(w, w._idx)).join(", ");
  return `# ===== pattern: parallel fan-out (map-reduce) =====
WORKERS = [${workerList}]

def main(items: list[str]) -> str:
    # 1) Map: each worker (or N copies of the same worker) tackles one item in parallel.
    def run(pair):
        idx, item = pair
        return call_agent(WORKERS[idx % len(WORKERS)], item)
    with ThreadPoolExecutor(max_workers=len(WORKERS)) as ex:
        partials = list(ex.map(run, list(enumerate(items))))

    # 2) Reduce: orchestrator aggregates the partials.
    reduce_prompt = "Partial results:\\n" + json.dumps(partials, indent=2) + "\\n\\nAggregate into one answer."
    return call_agent(${orchName}, reduce_prompt)

if __name__ == "__main__":
    print(main(["REPLACE_WITH", "YOUR_ITEMS"]))`;
}
function pyGroupChat(state: OrchState): string {
  const all = indexed(state);
  const agentList = all
    .map((a) => `(${JSON.stringify(a.name)}, ${constName(a, a._idx)})`)
    .join(", ");
  const rounds = Math.max(1, Number(state.coordination?.maxWorkers || 3));
  return `# ===== pattern: group chat / debate =====
AGENTS = [${agentList}]  # (name, system_prompt)
ROUNDS = ${rounds}

def main(task: str) -> str:
    answers = {name: call_agent(sys, task) for name, sys in AGENTS}
    for _ in range(ROUNDS):
        new_answers = {}
        for name, sys in AGENTS:
            peer = "\\n\\n".join(f"# {n}\\n{a}" for n, a in answers.items() if n != name)
            new_answers[name] = call_agent(
                sys,
                f"Task:\\n{task}\\n\\nPeer answers:\\n{peer}\\n\\nUpdate your answer in light of the peers.",
            )
        answers = new_answers
    # Final aggregation: a quick consensus pass by the first agent.
    consensus_prompt = "Final answers:\\n" + json.dumps(answers, indent=2) + "\\n\\nReconcile into a single best answer."
    return call_agent(AGENTS[0][1], consensus_prompt)

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_TASK"))`;
}
function pyHandoff(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workersDict = pyWorkersDict(workers, 0);
  return `# ===== pattern: handoff / supervisor routing =====
ROUTES = ${workersDict}

def main(user_input: str) -> str:
    # 1) Supervisor picks one route by name.
    route_prompt = (
        "User input:\\n" + user_input +
        "\\n\\nRoute to ONE of: " + ", ".join(ROUTES.keys()) +
        ".\\nRespond with just the route name."
    )
    chosen = call_agent(${orchName}, route_prompt).strip()
    system = ROUTES.get(chosen) or next(iter(ROUTES.values()))

    # 2) The chosen worker handles the input end-to-end.
    return call_agent(system, user_input)

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_INPUT"))`;
}

// ----- pattern coordinators (TypeScript) -----
function tsOrchestratorWorker(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workersObj = tsWorkersObj(workers);
  return `// ===== pattern: orchestrator-worker =====
const WORKERS = ${workersObj};

async function main(userTask) {
  // 1) Orchestrator decomposes the task into per-worker briefs.
  const planPrompt =
    "User task:\\n" + userTask +
    "\\n\\nDecompose into independent subtasks. Pick a worker for each from: " +
    Object.keys(WORKERS).join(", ") +
    ".\\nRespond ONLY as a JSON list: [{\\"worker\\": <name>, \\"brief\\": <text>}].";
  const plan = JSON.parse(await callAgent(${orchName}, planPrompt));

  // 2) Workers run in parallel; each gets its assigned brief.
  const results = await Promise.all(plan.map(async (item) => {
    const sys = WORKERS[item.worker] ?? Object.values(WORKERS)[0];
    return { worker: item.worker, result: await callAgent(sys, item.brief) };
  }));

  // 3) Orchestrator reconciles into the final answer.
  const synthPrompt =
    "Worker results:\\n" + JSON.stringify(results, null, 2) +
    "\\n\\nReconcile into a final answer, citing each claim to its worker.";
  return await callAgent(${orchName}, synthPrompt);
}

console.log(await main("REPLACE_WITH_YOUR_TASK"));`;
}
function tsSequential(state: OrchState): string {
  const all = indexed(state);
  const chain = all.map((a) => constName(a, a._idx));
  return `// ===== pattern: sequential pipeline =====
const PIPELINE = [${chain.join(", ")}];

async function main(userInput) {
  let current = userInput;
  for (const system of PIPELINE) current = await callAgent(system, current);
  return current;
}

console.log(await main("REPLACE_WITH_YOUR_INPUT"));`;
}
function tsParallel(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workerList = workers.map((w) => constName(w, w._idx)).join(", ");
  return `// ===== pattern: parallel fan-out (map-reduce) =====
const WORKERS = [${workerList}];

async function main(items) {
  // 1) Map: each worker (or N copies of the same worker) tackles one item in parallel.
  const partials = await Promise.all(items.map((item, i) =>
    callAgent(WORKERS[i % WORKERS.length], item)
  ));
  // 2) Reduce: orchestrator aggregates the partials.
  const reducePrompt =
    "Partial results:\\n" + JSON.stringify(partials, null, 2) +
    "\\n\\nAggregate into one answer.";
  return await callAgent(${orchName}, reducePrompt);
}

console.log(await main(["REPLACE_WITH", "YOUR_ITEMS"]));`;
}
function tsGroupChat(state: OrchState): string {
  const all = indexed(state);
  const agentList = all
    .map((a) => `[${JSON.stringify(a.name)}, ${constName(a, a._idx)}]`)
    .join(", ");
  const rounds = Math.max(1, Number(state.coordination?.maxWorkers || 3));
  return `// ===== pattern: group chat / debate =====
const AGENTS = [${agentList}];  // [name, systemPrompt]
const ROUNDS = ${rounds};

async function main(task) {
  let answers = Object.fromEntries(
    await Promise.all(AGENTS.map(async ([name, sys]) => [name, await callAgent(sys, task)]))
  );
  for (let r = 0; r < ROUNDS; r++) {
    answers = Object.fromEntries(
      await Promise.all(AGENTS.map(async ([name, sys]) => {
        const peer = Object.entries(answers)
          .filter(([n]) => n !== name)
          .map(([n, a]) => "# " + n + "\\n" + a)
          .join("\\n\\n");
        const updated = await callAgent(sys,
          "Task:\\n" + task +
          "\\n\\nPeer answers:\\n" + peer +
          "\\n\\nUpdate your answer in light of the peers."
        );
        return [name, updated];
      }))
    );
  }
  const consensusPrompt =
    "Final answers:\\n" + JSON.stringify(answers, null, 2) +
    "\\n\\nReconcile into a single best answer.";
  return await callAgent(AGENTS[0][1], consensusPrompt);
}

console.log(await main("REPLACE_WITH_YOUR_TASK"));`;
}
function tsHandoff(state: OrchState): string {
  const { orch, workers } = agentsByKind(state);
  const orchName = constName(orch, orch._idx);
  const workersObj = tsWorkersObj(workers);
  return `// ===== pattern: handoff / supervisor routing =====
const ROUTES = ${workersObj};

async function main(userInput) {
  // 1) Supervisor picks one route by name.
  const routePrompt =
    "User input:\\n" + userInput +
    "\\n\\nRoute to ONE of: " + Object.keys(ROUTES).join(", ") +
    ".\\nRespond with just the route name.";
  const chosen = (await callAgent(${orchName}, routePrompt)).trim();
  const system = ROUTES[chosen] ?? Object.values(ROUTES)[0];
  // 2) The chosen worker handles the input end-to-end.
  return await callAgent(system, userInput);
}

console.log(await main("REPLACE_WITH_YOUR_INPUT"));`;
}

// ============================================================================
// Per-agent models — multi-provider router codegen.
//
// Activated (gated) when ANY agent carries a `model`. Each agent then runs on
// its own (provider, model); a single `call_agent(provider, model, ...)` router
// dispatches to the right SDK, and an AGENTS registry binds key → provider +
// model + system. Agents without an explicit model fall back to `fb` (the
// model picked at export time). Note: the router uses the direct provider SDKs
// (Anthropic / OpenAI / Gemini) — it intentionally does not honor Bedrock /
// Vertex *hosting* of the chosen Anthropic target, since the whole point is to
// mix providers. The non-router path below is unchanged for the common case.
// ============================================================================
type ModelFallback = { provider: ProviderId; modelId: string };

export function anyAgentHasModel(state: OrchState): boolean {
  return state.agents.some((a) => !!a.model && !!a.model.provider && !!a.model.id);
}
function effProvider(agent: Agent, fb: ModelFallback): ProviderId {
  return agent.model?.provider ?? fb.provider;
}
function effModelId(agent: Agent, fb: ModelFallback): string {
  return agent.model?.id ?? fb.modelId;
}
function providersUsed(state: OrchState, fb: ModelFallback): ProviderId[] {
  const seen = new Set<ProviderId>();
  state.agents.forEach((a) => seen.add(effProvider(a, fb)));
  return [...seen];
}
function agentKey(agent: Agent, idx: number): string {
  const base = (agent.name || `${agent.kind}_${idx}`)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return base || `agent_${idx}`;
}
function keysByKind(state: OrchState) {
  const all = state.agents.map((a, i) => ({ a, i, key: agentKey(a, i), kind: a.kind }));
  const orch = all.find((x) => x.kind === "orchestrator") ?? all[0];
  const workers = all.filter((x) => x !== orch);
  return { orch, workers, all };
}
function pyList(arr: string[]): string {
  return "[" + arr.map((x) => JSON.stringify(x)).join(", ") + "]";
}

function pyRouter(state: OrchState, fb: ModelFallback): string {
  const used = providersUsed(state, fb);
  const pip: Record<ProviderId, string> = { anthropic: "anthropic", openai: "openai", gemini: "google-genai" };
  const imp: string[] = [];
  const init: string[] = [];
  const br: string[] = [];
  if (used.includes("anthropic")) {
    imp.push("from anthropic import Anthropic");
    init.push("anthropic_client = Anthropic()    # ANTHROPIC_API_KEY");
    br.push(`    if provider == "anthropic":
        m = anthropic_client.messages.create(
            model=model, max_tokens=1024, system=system,
            messages=[{"role": "user", "content": user}])
        return m.content[0].text`);
  }
  if (used.includes("openai")) {
    imp.push("from openai import OpenAI");
    init.push("openai_client = OpenAI()          # OPENAI_API_KEY");
    br.push(`    if provider == "openai":
        r = openai_client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}])
        return r.choices[0].message.content`);
  }
  if (used.includes("gemini")) {
    imp.push("from google import genai");
    imp.push("from google.genai import types");
    init.push("gemini_client = genai.Client()    # GEMINI_API_KEY");
    br.push(`    if provider == "gemini":
        r = gemini_client.models.generate_content(
            model=model,
            config=types.GenerateContentConfig(system_instruction=system),
            contents=user)
        return r.text or ""`);
  }
  return `# pip install ${used.map((p) => pip[p]).join(" ")}
from concurrent.futures import ThreadPoolExecutor
import json
${imp.join("\n")}

${init.join("\n")}

# Multi-provider router — each agent carries its own (provider, model).
def call_agent(provider: str, model: str, system: str, user: str) -> str:
${br.join("\n")}
    raise ValueError(f"unknown provider: {provider}")`;
}
function tsRouter(state: OrchState, fb: ModelFallback): string {
  const used = providersUsed(state, fb);
  const npm: Record<ProviderId, string> = { anthropic: "@anthropic-ai/sdk", openai: "openai", gemini: "@google/genai" };
  const imp: string[] = [];
  const init: string[] = [];
  const br: string[] = [];
  if (used.includes("anthropic")) {
    imp.push('import Anthropic from "@anthropic-ai/sdk";');
    init.push("const anthropic = new Anthropic();   // ANTHROPIC_API_KEY");
    br.push(`  if (provider === "anthropic") {
    const m = await anthropic.messages.create({
      model, max_tokens: 1024, system,
      messages: [{ role: "user", content: user }],
    });
    const b = m.content[0];
    return b.type === "text" ? b.text : "";
  }`);
  }
  if (used.includes("openai")) {
    imp.push('import OpenAI from "openai";');
    init.push("const openai = new OpenAI();          // OPENAI_API_KEY");
    br.push(`  if (provider === "openai") {
    const r = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    return r.choices[0].message.content ?? "";
  }`);
  }
  if (used.includes("gemini")) {
    imp.push('import { GoogleGenAI } from "@google/genai";');
    init.push("const genai = new GoogleGenAI({});    // GEMINI_API_KEY");
    br.push(`  if (provider === "gemini") {
    const r = await genai.models.generateContent({
      model,
      config: { systemInstruction: system },
      contents: user,
    });
    return r.text ?? "";
  }`);
  }
  return `// npm i ${used.map((p) => npm[p]).join(" ")}
${imp.join("\n")}

${init.join("\n")}

// Multi-provider router — each agent carries its own (provider, model).
async function callAgent(provider, model, system, user) {
${br.join("\n")}
  throw new Error("unknown provider: " + provider);
}`;
}
function pyRegistry(state: OrchState, fb: ModelFallback): string {
  const lines = state.agents.map(
    (a, i) =>
      `    ${JSON.stringify(agentKey(a, i))}: {"provider": ${JSON.stringify(effProvider(a, fb))}, "model": ${JSON.stringify(effModelId(a, fb))}, "system": ${constName(a, i)}},`,
  );
  return `AGENTS = {
${lines.join("\n")}
}

def run(key: str, user: str) -> str:
    a = AGENTS[key]
    return call_agent(a["provider"], a["model"], a["system"], user)`;
}
function tsRegistry(state: OrchState, fb: ModelFallback): string {
  const lines = state.agents.map(
    (a, i) =>
      `  ${JSON.stringify(agentKey(a, i))}: { provider: ${JSON.stringify(effProvider(a, fb))}, model: ${JSON.stringify(effModelId(a, fb))}, system: ${constName(a, i)} },`,
  );
  return `const AGENTS = {
${lines.join("\n")}
};

async function run(key, user) {
  const a = AGENTS[key];
  return await callAgent(a.provider, a.model, a.system, user);
}`;
}

function pyrOW(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `# ===== pattern: orchestrator-worker (per-agent models) =====
ORCH = ${JSON.stringify(orch.key)}
WORKER_KEYS = ${pyList(workers.map((w) => w.key))}

def main(user_task: str) -> str:
    plan_prompt = (
        "User task:\\n" + user_task +
        "\\n\\nDecompose into independent subtasks. Pick a worker for each from: "
        + ", ".join(WORKER_KEYS) +
        ".\\nRespond ONLY as a JSON list: [{\\"worker\\": <key>, \\"brief\\": <text>}]."
    )
    plan = json.loads(run(ORCH, plan_prompt))
    def do(item):
        key = item["worker"] if item["worker"] in AGENTS else WORKER_KEYS[0]
        return {"worker": key, "result": run(key, item["brief"])}
    with ThreadPoolExecutor(max_workers=max(1, len(WORKER_KEYS))) as ex:
        results = list(ex.map(do, plan))
    return run(ORCH, "Worker results:\\n" + json.dumps(results, indent=2) +
               "\\n\\nReconcile into a final answer, citing each claim to its worker.")

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_TASK"))`;
}
function pyrSeq(state: OrchState): string {
  const keys = keysByKind(state).all.map((x) => x.key);
  return `# ===== pattern: sequential pipeline (per-agent models) =====
PIPELINE = ${pyList(keys)}

def main(user_input: str) -> str:
    current = user_input
    for key in PIPELINE:
        current = run(key, current)
    return current

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_INPUT"))`;
}
function pyrPar(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `# ===== pattern: parallel fan-out (per-agent models) =====
ORCH = ${JSON.stringify(orch.key)}
WORKER_KEYS = ${pyList(workers.map((w) => w.key))}

def main(items: list[str]) -> str:
    def do(pair):
        idx, item = pair
        return run(WORKER_KEYS[idx % len(WORKER_KEYS)], item)
    with ThreadPoolExecutor(max_workers=len(WORKER_KEYS)) as ex:
        partials = list(ex.map(do, list(enumerate(items))))
    return run(ORCH, "Partial results:\\n" + json.dumps(partials, indent=2) + "\\n\\nAggregate into one answer.")

if __name__ == "__main__":
    print(main(["REPLACE_WITH", "YOUR_ITEMS"]))`;
}
function pyrGC(state: OrchState): string {
  const keys = keysByKind(state).all.map((x) => x.key);
  const rounds = Math.max(1, Number(state.coordination?.maxWorkers || 3));
  return `# ===== pattern: group chat / debate (per-agent models) =====
AGENT_KEYS = ${pyList(keys)}
ROUNDS = ${rounds}

def main(task: str) -> str:
    answers = {k: run(k, task) for k in AGENT_KEYS}
    for _ in range(ROUNDS):
        new_answers = {}
        for k in AGENT_KEYS:
            peer = "\\n\\n".join(f"# {n}\\n{a}" for n, a in answers.items() if n != k)
            new_answers[k] = run(k, f"Task:\\n{task}\\n\\nPeer answers:\\n{peer}\\n\\nUpdate your answer in light of the peers.")
        answers = new_answers
    return run(AGENT_KEYS[0], "Final answers:\\n" + json.dumps(answers, indent=2) + "\\n\\nReconcile into a single best answer.")

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_TASK"))`;
}
function pyrHand(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `# ===== pattern: handoff / routing (per-agent models) =====
ORCH = ${JSON.stringify(orch.key)}
ROUTE_KEYS = ${pyList(workers.map((w) => w.key))}

def main(user_input: str) -> str:
    route_prompt = (
        "User input:\\n" + user_input +
        "\\n\\nRoute to ONE of: " + ", ".join(ROUTE_KEYS) +
        ".\\nRespond with just the route key."
    )
    chosen = run(ORCH, route_prompt).strip()
    key = chosen if chosen in AGENTS else ROUTE_KEYS[0]
    return run(key, user_input)

if __name__ == "__main__":
    print(main("REPLACE_WITH_YOUR_INPUT"))`;
}
function tsrOW(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `// ===== pattern: orchestrator-worker (per-agent models) =====
const ORCH = ${JSON.stringify(orch.key)};
const WORKER_KEYS = ${JSON.stringify(workers.map((w) => w.key))};

async function main(userTask) {
  const planPrompt =
    "User task:\\n" + userTask +
    "\\n\\nDecompose into independent subtasks. Pick a worker for each from: " +
    WORKER_KEYS.join(", ") +
    ".\\nRespond ONLY as a JSON list: [{\\"worker\\": <key>, \\"brief\\": <text>}].";
  const plan = JSON.parse(await run(ORCH, planPrompt));
  const results = await Promise.all(plan.map(async (item) => {
    const key = AGENTS[item.worker] ? item.worker : WORKER_KEYS[0];
    return { worker: key, result: await run(key, item.brief) };
  }));
  return await run(ORCH,
    "Worker results:\\n" + JSON.stringify(results, null, 2) +
    "\\n\\nReconcile into a final answer, citing each claim to its worker.");
}

console.log(await main("REPLACE_WITH_YOUR_TASK"));`;
}
function tsrSeq(state: OrchState): string {
  const keys = keysByKind(state).all.map((x) => x.key);
  return `// ===== pattern: sequential pipeline (per-agent models) =====
const PIPELINE = ${JSON.stringify(keys)};

async function main(userInput) {
  let current = userInput;
  for (const key of PIPELINE) current = await run(key, current);
  return current;
}

console.log(await main("REPLACE_WITH_YOUR_INPUT"));`;
}
function tsrPar(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `// ===== pattern: parallel fan-out (per-agent models) =====
const ORCH = ${JSON.stringify(orch.key)};
const WORKER_KEYS = ${JSON.stringify(workers.map((w) => w.key))};

async function main(items) {
  const partials = await Promise.all(items.map((item, i) => run(WORKER_KEYS[i % WORKER_KEYS.length], item)));
  return await run(ORCH, "Partial results:\\n" + JSON.stringify(partials, null, 2) + "\\n\\nAggregate into one answer.");
}

console.log(await main(["REPLACE_WITH", "YOUR_ITEMS"]));`;
}
function tsrGC(state: OrchState): string {
  const keys = keysByKind(state).all.map((x) => x.key);
  const rounds = Math.max(1, Number(state.coordination?.maxWorkers || 3));
  return `// ===== pattern: group chat / debate (per-agent models) =====
const AGENT_KEYS = ${JSON.stringify(keys)};
const ROUNDS = ${rounds};

async function main(task) {
  let answers = Object.fromEntries(await Promise.all(AGENT_KEYS.map(async (k) => [k, await run(k, task)])));
  for (let r = 0; r < ROUNDS; r++) {
    answers = Object.fromEntries(await Promise.all(AGENT_KEYS.map(async (k) => {
      const peer = Object.entries(answers).filter(([n]) => n !== k).map(([n, a]) => "# " + n + "\\n" + a).join("\\n\\n");
      return [k, await run(k, "Task:\\n" + task + "\\n\\nPeer answers:\\n" + peer + "\\n\\nUpdate your answer in light of the peers.")];
    })));
  }
  return await run(AGENT_KEYS[0], "Final answers:\\n" + JSON.stringify(answers, null, 2) + "\\n\\nReconcile into a single best answer.");
}

console.log(await main("REPLACE_WITH_YOUR_TASK"));`;
}
function tsrHand(state: OrchState): string {
  const { orch, workers } = keysByKind(state);
  return `// ===== pattern: handoff / routing (per-agent models) =====
const ORCH = ${JSON.stringify(orch.key)};
const ROUTE_KEYS = ${JSON.stringify(workers.map((w) => w.key))};

async function main(userInput) {
  const routePrompt =
    "User input:\\n" + userInput +
    "\\n\\nRoute to ONE of: " + ROUTE_KEYS.join(", ") +
    ".\\nRespond with just the route key.";
  const chosen = (await run(ORCH, routePrompt)).trim();
  const key = AGENTS[chosen] ? chosen : ROUTE_KEYS[0];
  return await run(key, userInput);
}

console.log(await main("REPLACE_WITH_YOUR_INPUT"));`;
}
const ORCH_PY_ROUTER: Record<string, (s: OrchState) => string> = {
  "orchestrator-worker": pyrOW,
  sequential: pyrSeq,
  parallel: pyrPar,
  "group-chat": pyrGC,
  handoff: pyrHand,
};
const ORCH_TS_ROUTER: Record<string, (s: OrchState) => string> = {
  "orchestrator-worker": tsrOW,
  sequential: tsrSeq,
  parallel: tsrPar,
  "group-chat": tsrGC,
  handoff: tsrHand,
};
function renderRouterCode(lang: "python" | "ts", state: OrchState, fb: ModelFallback): string {
  const preamble = lang === "python" ? pyRouter(state, fb) : tsRouter(state, fb);
  const consts = renderAgentConsts(lang, state);
  const registry = lang === "python" ? pyRegistry(state, fb) : tsRegistry(state, fb);
  const table = lang === "python" ? ORCH_PY_ROUTER : ORCH_TS_ROUTER;
  const coordinator = (table[state.pattern] || table["orchestrator-worker"])(state);
  return `${preamble}\n\n${consts}\n\n${registry}\n\n${coordinator}`;
}

const ORCH_PY_PATTERNS: Record<string, (s: OrchState) => string> = {
  "orchestrator-worker": pyOrchestratorWorker,
  sequential: pySequential,
  parallel: pyParallel,
  "group-chat": pyGroupChat,
  handoff: pyHandoff,
};
const ORCH_TS_PATTERNS: Record<string, (s: OrchState) => string> = {
  "orchestrator-worker": tsOrchestratorWorker,
  sequential: tsSequential,
  parallel: tsParallel,
  "group-chat": tsGroupChat,
  handoff: tsHandoff,
};

export const ORCH_TARGETS: Record<string, Target> = {
  markdown: {
    kind: "prompt",
    label: "Markdown",
    caption:
      "Bundle contains: orchestrator system prompt · each worker system prompt · coordination protocol. Paste each block into the matching agent role in your framework.",
  },
  xml: {
    kind: "prompt",
    label: "XML",
    caption:
      "XML mirrors the Markdown bundle with explicit tags — recommended when piping into Claude with structured agent definitions.",
  },
  "anthropic-python": { kind: "code", provider: "anthropic", lang: "python", label: "Anthropic · Python SDK", adapter: adapterAnthropicPy },
  "anthropic-ts": { kind: "code", provider: "anthropic", lang: "ts", label: "Anthropic · TypeScript", adapter: adapterAnthropicTs },
  "bedrock-python": { kind: "code", provider: "anthropic", lang: "python", label: "AWS Bedrock · Python", adapter: adapterBedrockPy },
  "bedrock-ts": { kind: "code", provider: "anthropic", lang: "ts", label: "AWS Bedrock · TypeScript", adapter: adapterBedrockTs },
  "vertex-python": { kind: "code", provider: "anthropic", lang: "python", label: "Vertex AI · Python", adapter: adapterVertexPy },
  "vertex-ts": { kind: "code", provider: "anthropic", lang: "ts", label: "Vertex AI · TypeScript", adapter: adapterVertexTs },
  "openai-python": { kind: "code", provider: "openai", lang: "python", label: "OpenAI · Python SDK", adapter: adapterOpenAIPy },
  "openai-ts": { kind: "code", provider: "openai", lang: "ts", label: "OpenAI · TypeScript", adapter: adapterOpenAITs },
  "gemini-python": { kind: "code", provider: "gemini", lang: "python", label: "Gemini · Python SDK", adapter: adapterGeminiPy },
  "gemini-ts": { kind: "code", provider: "gemini", lang: "ts", label: "Gemini · TypeScript", adapter: adapterGeminiTs },
};

export function renderCode(targetKey: string, state: OrchState, modelEntry: ModelEntry): string {
  const target = ORCH_TARGETS[targetKey];
  if (!target || target.kind !== "code") {
    throw new Error(`Not a code target: ${targetKey}`);
  }
  const codeTarget = target as CodeTarget;

  // Gated per-agent path: as soon as any agent pins its own model, switch to
  // the multi-provider router. Agents without a model fall back to the
  // export-time selection (this target's provider + the chosen model id).
  if (anyAgentHasModel(state)) {
    return renderRouterCode(codeTarget.lang, state, {
      provider: codeTarget.provider,
      modelId: modelEntry?.id ?? "",
    });
  }

  const modelId = resolveModelId(targetKey, modelEntry);
  const adapter = codeTarget.adapter(modelId);
  const consts = renderAgentConsts(codeTarget.lang, state);
  const patternTable = codeTarget.lang === "python" ? ORCH_PY_PATTERNS : ORCH_TS_PATTERNS;
  const coordinator = (patternTable[state.pattern] || patternTable["orchestrator-worker"])(state);
  return `${adapter}\n\n${consts}\n\n${coordinator}`;
}
