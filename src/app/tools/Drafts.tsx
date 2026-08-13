"use client";

import FeatureDrafts from "@/app/_shared/FeatureDrafts";
import type { ToolDef } from "@/lib/tools/types";

/** Tool Builder's saved-drafts strip. See _shared/FeatureDrafts. */
export default function Drafts({
  onLoad,
  onSaveSignal,
  tool,
  title,
  onSaved,
}: {
  onLoad: (t: ToolDef) => void;
  onSaveSignal: number;
  tool: ToolDef;
  title?: string;
  onSaved?: () => void;
}) {
  return (
    <FeatureDrafts<ToolDef>
      kind="tool"
      state={tool}
      title={title}
      onSaveSignal={onSaveSignal}
      onLoad={onLoad}
      onSaved={onSaved}
      snippet={(t) => t.name || t.description?.slice(0, 60) || "Untitled tool"}
      body={(t) => `${t.name}\n${t.description ?? ""}`}
    />
  );
}
