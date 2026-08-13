// The teaching material for the Loops tab. Each template is a ready-to-load
// LoopState plus the *why* (teaches / whenToUse), so the gallery doubles as a
// hands-on course in loop engineering. Grounded in the Claude Code scheduled-
// tasks docs and current loop-engineering practice (independent verifiers,
// streak-based exit, event-driven Monitor over polling, loop.md defaults).

import type { LoopTemplate } from "./types";

export const LOOP_TEMPLATES: LoopTemplate[] = [
  // ── Fixed polling ──────────────────────────────────────────────────────
  {
    id: "deploy-watch",
    title: "Watch a deploy",
    category: "Fixed polling",
    blurb: "Poll a deployment every few minutes until it lands.",
    teaches:
      "The simplest loop: interval + prompt → a fixed cron schedule. Claude confirms the cadence and a job ID you can cancel.",
    whenToUse: "You kicked off a deploy and want a heads-up the moment it finishes or fails.",
    state: {
      mode: "fixed",
      interval: "4m",
      prompt: "Check whether the production deploy finished. If it failed, pull the error and summarise the cause in one line.",
      isCommand: false,
      stopCondition: "the deploy is live or has failed",
      verifier: "",
      maxTurns: "",
    },
  },
  {
    id: "build-watch",
    title: "Babysit a long build",
    category: "Fixed polling",
    blurb: "Check a slow CI build on a steady cadence.",
    teaches:
      "Why 4m beats 5m: 5m sits exactly on the prompt-cache TTL. Staying just under it keeps context cached and cheap.",
    whenToUse: "A build takes 10–20 minutes and you'd rather not babysit the terminal.",
    state: {
      mode: "fixed",
      interval: "4m",
      prompt: "Has the CI build for this branch finished? Report pass/fail and, on failure, the first failing step.",
      isCommand: false,
      stopCondition: "the build completes",
      verifier: "",
      maxTurns: "",
    },
  },

  // ── Self-paced ─────────────────────────────────────────────────────────
  {
    id: "pr-babysit",
    title: "Babysit a PR (self-paced)",
    category: "Self-paced",
    blurb: "No interval — Claude waits longer as the PR goes quiet.",
    teaches:
      "Drop the interval and Claude picks each delay (1–60m) from what it just saw: short waits while CI runs, long waits once it's idle. It prints the delay and the reason every iteration.",
    whenToUse: "A PR is open and you want CI watched and review comments handled without a fixed poll.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "Check whether CI passed on this PR and address any new review comments. Resolve threads you've handled.",
      isCommand: false,
      stopCondition: "CI is green and every review thread is resolved",
      verifier: "",
      maxTurns: "",
    },
  },
  {
    id: "incident-watch",
    title: "Watch an error rate",
    category: "Self-paced",
    blurb: "Tighten cadence when things look bad, relax when healthy.",
    teaches:
      "Self-pacing shines for monitoring: Claude leans in (short delays) while a metric is elevated and backs off when it recovers — no fixed interval to tune.",
    whenToUse: "You shipped something risky and want eyes on the error rate for the next while.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "Pull the last 15 minutes of Sentry errors for this project. If the rate is climbing, summarise the top new issue; if it's flat and low, say so in one line.",
      isCommand: false,
      stopCondition: "the error rate has been flat and low for three checks",
      verifier: "",
      maxTurns: "",
    },
  },

  // ── Maintenance (loop.md) ──────────────────────────────────────────────
  {
    id: "bare-loop",
    title: "Bare /loop (built-in maintenance)",
    category: "Maintenance (loop.md)",
    blurb: "Just `/loop` — finish unfinished work, tend the PR, then clean up.",
    teaches:
      "With no prompt and no interval, /loop runs the built-in maintenance prompt at a self-paced cadence: continue unfinished work → tend the branch's PR → run cleanup passes. It never starts new initiatives or pushes without prior authorisation.",
    whenToUse: "End of a session — let Claude keep the branch healthy while you step away.",
    state: {
      mode: "maintenance",
      interval: "",
      prompt: "",
      isCommand: false,
      stopCondition: "",
      verifier: "",
      maxTurns: "",
    },
  },
  {
    id: "release-keeper",
    title: "Release-branch keeper (loop.md)",
    category: "Maintenance (loop.md)",
    blurb: "A committable .claude/loop.md that keeps release/next green.",
    teaches:
      "A loop.md file replaces the built-in default for bare /loop and is version-controlled with the repo. Edits take effect on the next iteration, so you can refine a running loop. Keep it under 25,000 bytes.",
    whenToUse: "A team wants a shared, reviewable definition of 'keep the release branch healthy'.",
    state: {
      mode: "maintenance",
      interval: "",
      prompt: "Check the `release/next` PR. If CI is red, pull the failing job log, diagnose, and push a minimal fix. If new review comments have arrived, address each one and resolve the thread. If everything is green and quiet, say so in one line.",
      isCommand: false,
      stopCondition: "",
      verifier: "",
      maxTurns: "",
    },
  },

  // ── Until-done + verifier ──────────────────────────────────────────────
  {
    id: "green-streak",
    title: "Fix until tests pass — a streak",
    category: "Until-done + verifier",
    blurb: "Don't stop at one green run; require a streak.",
    teaches:
      "The hard part of a loop is the verifier, not the loop. 'One green run is luck; a streak is reliability.' Require N consecutive passes and a measurable exit so the loop can't declare false victory.",
    whenToUse: "Flaky or load-bearing test suite where a single pass isn't trustworthy.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "Run the test suite. If anything fails, diagnose and apply a minimal fix, then re-run.",
      isCommand: false,
      stopCondition: "the full suite passes three times in a row",
      verifier: "re-running the suite from a clean state, not by editing or skipping tests",
      maxTurns: "20",
    },
  },
  {
    id: "queue-drain",
    title: "Drain a work queue",
    category: "Until-done + verifier",
    blurb: "Loop until the queue is provably empty, with a cap.",
    teaches:
      "Concrete exit conditions (empty queue, clean git status, exit code 0) beat vibes. Pair the exit with a turn cap so a stuck loop reports instead of spinning forever.",
    whenToUse: "A backlog of mechanical items (failing lints, TODOs, migration sites) to clear one by one.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "Take the next unresolved lint error, fix it minimally, and confirm the file is clean.",
      isCommand: false,
      stopCondition: "`npm run lint` exits 0 with zero errors",
      verifier: "running the linter to completion, not by disabling rules",
      maxTurns: "30",
    },
  },

  // ── Command loops ──────────────────────────────────────────────────────
  {
    id: "rerun-review",
    title: "Re-run a saved command",
    category: "Command loops",
    blurb: "`/loop 20m /review-pr 1234` — re-run a skill each iteration.",
    teaches:
      "The loop body can be another slash command. Each iteration re-invokes your saved skill or command, so loops compose with everything else you've built.",
    whenToUse: "You already have a command that does the work and just want it on a cadence.",
    state: {
      mode: "fixed",
      interval: "20m",
      prompt: "/review-pr 1234",
      isCommand: true,
      stopCondition: "",
      verifier: "",
      maxTurns: "",
    },
  },
  {
    id: "rerun-babysit",
    title: "Self-paced command loop",
    category: "Command loops",
    blurb: "Re-run a command on a cadence Claude chooses.",
    teaches:
      "Drop the interval in front of a command and Claude paces the re-runs itself — handy when the command's urgency varies over time.",
    whenToUse: "A status-checking command you want run more often when there's activity.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "/babysit-prs",
      isCommand: true,
      stopCondition: "",
      verifier: "",
      maxTurns: "",
    },
  },

  // ── Event-driven ───────────────────────────────────────────────────────
  {
    id: "monitor-tail",
    title: "Tail a log instead of polling",
    category: "Event-driven",
    blurb: "Stream output and react to events — no polling.",
    teaches:
      "When you ask for a dynamic loop over a stream, Claude may use the Monitor tool: it runs a background script and streams each line back, reacting to events instead of re-running a prompt. Often more responsive and more token-efficient than polling.",
    whenToUse: "You're watching a live log/build stream and want to act the instant a marker appears.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "Tail the dev server log and tell me the moment a request 500s, with the stack trace. Stay quiet while it's healthy.",
      isCommand: false,
      stopCondition: "I stop the loop",
      verifier: "",
      maxTurns: "",
    },
  },
  {
    id: "one-shot-reminder",
    title: "One-time reminder (not a loop)",
    category: "Event-driven",
    blurb: "Single-fire task in natural language — no /loop needed.",
    teaches:
      "For a one-shot, just describe it: 'remind me at 3pm to push the release branch.' Claude schedules a single-fire task that deletes itself after running — no recurring loop involved.",
    whenToUse: "A single future nudge, not a repeating check.",
    state: {
      mode: "self-paced",
      interval: "",
      prompt: "In 45 minutes, check whether the integration tests passed and ping me with the result.",
      isCommand: false,
      stopCondition: "the reminder has fired once",
      verifier: "",
      maxTurns: "",
    },
  },
];

export function templatesByCategory(): Map<string, LoopTemplate[]> {
  const m = new Map<string, LoopTemplate[]>();
  for (const t of LOOP_TEMPLATES) {
    const arr = m.get(t.category) ?? [];
    arr.push(t);
    m.set(t.category, arr);
  }
  return m;
}
