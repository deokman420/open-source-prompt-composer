// Pure logic for the Loops tab: turn a LoopState into the exact `/loop` command
// string, an optional loop.md file, and a set of inline "notes" that teach the
// scheduling nuances straight from the Claude Code docs (cron rounding, jitter,
// the prompt-cache cadence window). No React, no I/O — trivially testable.

import type { LoopState } from "./types";

export interface IntervalAnalysis {
  // Cleaned interval echoed back ("5m"), or "" when none/!parseable.
  normalized: string;
  // Seconds the interval maps to (after unit rounding), or null.
  seconds: number | null;
  // 5-field cron the fixed scheduler would use, or null.
  cron: string | null;
  // Human notes — rounding, jitter, cache-window guidance. Severity drives color.
  notes: LoopNote[];
}

export interface LoopNote {
  severity: "info" | "warn";
  text: string;
}

const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

// Cron has 1-minute granularity, so a fixed loop snaps to a minute step that
// divides evenly. These are the clean steps the docs round toward.
const CLEAN_MINUTE_STEPS = [1, 2, 3, 5, 10, 15, 20, 30, 60];

/** Pull "<n><unit>" out of free text — accepts "30m", "every 2 hours", "1h". */
export function parseInterval(raw: string): { value: number; unit: string } | null {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  // bare token like "30m" / "2h" / "90s" / "1d"
  let m = t.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|day|days)$/);
  if (!m) {
    // trailing clause: "every 2 hours", "check ... every 30 minutes"
    m = t.match(/every\s+(\d+(?:\.\d+)?)\s*(s|m|h|d|sec|secs|second|seconds|min|mins|minute|minutes|hour|hours|day|days)/);
  }
  if (!m) return null;
  const value = parseFloat(m[1]);
  const u = m[2][0]; // first char disambiguates s/m/h/d
  if (!(u in UNIT_SECONDS) || !(value > 0)) return null;
  return { value, unit: u };
}

function snapMinutes(mins: number): number {
  let best = CLEAN_MINUTE_STEPS[0];
  let bestDiff = Infinity;
  for (const step of CLEAN_MINUTE_STEPS) {
    const d = Math.abs(step - mins);
    if (d < bestDiff) {
      bestDiff = d;
      best = step;
    }
  }
  return best;
}

function cronForMinutes(mins: number): string {
  if (mins >= 1440) {
    const days = Math.max(1, Math.round(mins / 1440));
    return days === 1 ? "0 0 * * *" : `0 0 */${days} * *`;
  }
  if (mins >= 60) {
    const hrs = Math.max(1, Math.round(mins / 60));
    return hrs === 1 ? "0 * * * *" : `0 */${hrs} * * *`;
  }
  return `*/${mins} * * * *`;
}

// Round to a cron-clean step in the interval's own register: sub-hour intervals
// snap to a clean minute step; hour intervals stay whole hours; day intervals
// stay whole days. Returns the resolved minutes (snapped where needed).
function resolveMinutes(rawMinutes: number, unit: string): number {
  if (unit === "d") return Math.max(1, Math.round(rawMinutes / 1440)) * 1440;
  if (unit === "h") return Math.max(1, Math.round(rawMinutes / 60)) * 60;
  // s / m
  if (rawMinutes >= 60) return Math.max(1, Math.round(rawMinutes / 60)) * 60;
  if (Number.isInteger(rawMinutes) && CLEAN_MINUTE_STEPS.includes(rawMinutes)) return rawMinutes;
  return snapMinutes(rawMinutes);
}

function formatStep(mins: number): string {
  if (mins >= 1440 && mins % 1440 === 0) return `${mins / 1440}d`;
  if (mins >= 60 && mins % 60 === 0) return `${mins / 60}h`;
  return `${mins}m`;
}

/** Analyse an interval string and surface the scheduling caveats inline. */
export function analyzeInterval(raw: string): IntervalAnalysis {
  const parsed = parseInterval(raw);
  if (!parsed) {
    return { normalized: "", seconds: null, cron: null, notes: [] };
  }
  const notes: LoopNote[] = [];
  const rawSeconds = parsed.value * UNIT_SECONDS[parsed.unit];

  // Seconds round UP to the nearest minute (cron granularity).
  let minutes = rawSeconds / 60;
  if (parsed.unit === "s") {
    minutes = Math.ceil(rawSeconds / 60);
    notes.push({
      severity: "info",
      text: `Seconds round up to the nearest minute — this fires every ${minutes}m.`,
    });
  }

  // Snap to a cron-clean step in the interval's own register (min/hour/day).
  const rounded = resolveMinutes(minutes, parsed.unit);
  if (rounded !== minutes) {
    notes.push({
      severity: "warn",
      text: `${raw.trim()} isn't a clean cron step — Claude rounds it to ${formatStep(rounded)}.`,
    });
  }

  const seconds = rounded * 60;
  const cron = cronForMinutes(rounded);

  // Prompt-cache cadence guidance: the 5-minute cache TTL makes ~5m the worst
  // pick. Nudge users either under it (cache stays warm) or well past it.
  if (seconds === 300) {
    notes.push({
      severity: "warn",
      text: "5m sits exactly on the prompt-cache TTL — worst of both worlds. Drop to 4m to stay cached, or go ≥20m to amortise the cache miss.",
    });
  } else if (seconds > 300 && seconds < 1200) {
    notes.push({
      severity: "info",
      text: "Past the 5-minute cache window each wake re-reads context uncached. Fine for slow-changing checks; for idle polling ≥20m is cheaper.",
    });
  }

  // Jitter: recurring tasks fire up to 30m late (½ the interval if sub-hourly),
  // and the offset is derived from the task id. Top/bottom of hour is worst.
  if (rounded >= 60) {
    notes.push({
      severity: "info",
      text: "Hourly+ jobs can fire up to 30m after the scheduled minute (jitter). Avoid :00 / :30 if exact timing matters.",
    });
  }

  return { normalized: formatStep(rounded), seconds, cron, notes };
}

/** Indent a block by two spaces for embedding under a heading in loop.md. */
function block(text: string): string {
  return text.trim();
}

/** Compose the guardrail clause appended to a prompt / loop.md body. */
function guardrails(state: LoopState): string {
  const parts: string[] = [];
  if (state.stopCondition.trim()) {
    parts.push(`Stop when: ${state.stopCondition.trim()}.`);
  }
  if (state.verifier.trim()) {
    parts.push(`Verify completion by ${state.verifier.trim()} — do not declare done without it.`);
  }
  if (state.maxTurns.trim()) {
    parts.push(`Give up after ${state.maxTurns.trim()} iterations and report what blocked you.`);
  }
  return parts.join(" ");
}

/** The full prompt body (user prompt + guardrails), used by command + loop.md. */
export function composedPrompt(state: LoopState): string {
  const base = state.prompt.trim();
  const guard = guardrails(state);
  if (!base) return guard;
  if (!guard) return base;
  return `${base} ${guard}`;
}

/**
 * The exact slash command to paste into Claude Code.
 *  - maintenance:  /loop            (or /loop 15m for a fixed cadence)
 *  - self-paced:   /loop <prompt>
 *  - fixed:        /loop <interval> <prompt>
 * Slash-command bodies (isCommand) are passed through verbatim.
 */
export function buildCommand(state: LoopState): string {
  if (state.mode === "maintenance") {
    const iv = analyzeInterval(state.interval).normalized;
    return iv ? `/loop ${iv}` : "/loop";
  }

  const body = state.isCommand ? state.prompt.trim() : composedPrompt(state);
  if (state.mode === "self-paced") {
    return `/loop ${body}`.trim();
  }
  // fixed
  const iv = analyzeInterval(state.interval).normalized || state.interval.trim();
  return `/loop ${iv} ${body}`.trim();
}

/**
 * A loop.md body for the maintenance default (bare `/loop`). Returned for any
 * mode so users can also "promote" a self-paced prompt into a committed default;
 * the UI only foregrounds it for maintenance mode.
 */
export function buildLoopMd(state: LoopState): string {
  const body = state.isCommand
    ? `Run ${state.prompt.trim()} and act on its output.`
    : composedPrompt(state);
  return block(body || "Continue any unfinished work, tend the current branch's PR (review comments, failing CI, conflicts), then run a cleanup pass if nothing else is pending.");
}

/** Validation for save/preview. Returns an error string or null. */
export function loopError(state: LoopState): string | null {
  if (state.mode === "fixed") {
    if (!state.interval.trim()) return "Fixed loops need an interval (e.g. 5m).";
    if (!parseInterval(state.interval)) return "Interval must look like 30m, 2h, or 1d.";
    if (!state.prompt.trim()) return "Add the prompt to run each iteration.";
  }
  if (state.mode === "self-paced" && !state.prompt.trim()) {
    return "Self-paced loops need a prompt — that's how Claude decides the cadence.";
  }
  return null;
}
