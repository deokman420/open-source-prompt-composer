// Shared types for the /loop builder (the "Loops" tab). A LoopState is the
// editable form; build.ts turns it into the copy-paste `/loop` command and an
// optional loop.md file. Templates (templates.ts) are annotated, ready-to-load
// LoopStates that double as the tab's teaching material.

// The three ways Claude Code's /loop behaves, decided by what you supply:
//   fixed       → interval + prompt  ⇒ runs on a fixed cron schedule
//   self-paced  → prompt only        ⇒ Claude picks each delay (1–60m)
//   maintenance → neither            ⇒ runs the built-in prompt / your loop.md
export type LoopMode = "fixed" | "self-paced" | "maintenance";

export interface LoopState {
  mode: LoopMode;
  // Raw interval as the user typed it, e.g. "5m", "2h", "every 30 minutes".
  // Used by fixed mode; ignored by self-paced; optional for maintenance.
  interval: string;
  // The recurring instruction (fixed/self-paced) or the loop.md body
  // (maintenance). When isCommand is true this is a slash command to re-run,
  // e.g. "/review-pr 1234".
  prompt: string;
  isCommand: boolean;
  // Optional loop-engineering guardrails. When present they are woven into the
  // generated prompt / loop.md so users ship verifiable, bounded loops.
  stopCondition: string; // measurable exit ("CI is green", "queue empty")
  verifier: string; // how completion is proven (separate check, streak count)
  maxTurns: string; // iteration cap as a string (kept loose; "" = none)
}

export function emptyLoopState(mode: LoopMode = "fixed"): LoopState {
  return {
    mode,
    interval: mode === "fixed" ? "5m" : "",
    prompt: "",
    isCommand: false,
    stopCondition: "",
    verifier: "",
    maxTurns: "",
  };
}

// One entry in the educational gallery. `teaches`/`whenToUse` are the why; the
// LoopState is loaded straight into the builder so users learn by editing.
export interface LoopTemplate {
  id: string;
  title: string;
  category: LoopCategory;
  blurb: string; // one line shown on the card
  teaches: string; // the technique this example demonstrates
  whenToUse: string; // when to reach for it
  state: LoopState;
}

export type LoopCategory =
  | "Fixed polling"
  | "Self-paced"
  | "Maintenance (loop.md)"
  | "Until-done + verifier"
  | "Command loops"
  | "Event-driven";

export const LOOP_CATEGORIES: LoopCategory[] = [
  "Fixed polling",
  "Self-paced",
  "Maintenance (loop.md)",
  "Until-done + verifier",
  "Command loops",
  "Event-driven",
];
