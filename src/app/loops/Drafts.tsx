"use client";

import FeatureDrafts from "@/app/_shared/FeatureDrafts";
import type { LoopState } from "@/lib/loops/types";

/** Loops' saved-drafts strip. See _shared/FeatureDrafts. */
export default function Drafts({
  onLoad,
  onSaveSignal,
  loop,
  title,
  onSaved,
}: {
  onLoad: (l: LoopState) => void;
  onSaveSignal: number;
  loop: LoopState;
  title?: string;
  onSaved?: () => void;
}) {
  return (
    <FeatureDrafts<LoopState>
      kind="loop"
      state={loop}
      title={title}
      onSaveSignal={onSaveSignal}
      onLoad={onLoad}
      onSaved={onSaved}
      snippet={(l) =>
        l.prompt.trim().slice(0, 60) ||
        `${l.mode}${l.interval ? ` · ${l.interval}` : ""}`
      }
      body={(l) => l.prompt}
    />
  );
}
