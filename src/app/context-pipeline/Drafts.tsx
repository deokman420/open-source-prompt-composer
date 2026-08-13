"use client";

import FeatureDrafts from "@/app/_shared/FeatureDrafts";
import type { CtxState } from "@/lib/context-pipeline/types";

/** Context Pipeline's saved-drafts strip. See _shared/FeatureDrafts. */
export default function Drafts({
  onLoad,
  onSaveSignal,
  state,
  title,
  onSaved,
}: {
  onLoad: (s: CtxState) => void;
  onSaveSignal: number;
  state: CtxState;
  title?: string;
  onSaved?: () => void;
}) {
  return (
    <FeatureDrafts<CtxState>
      kind="context-pipeline"
      state={state}
      title={title}
      onSaveSignal={onSaveSignal}
      onLoad={onLoad}
      onSaved={onSaved}
      snippet={(s) =>
        `${s.model} · ${
          Object.values(s.sources ?? {}).filter((src) => src?.enabled).length
        } sources`
      }
    />
  );
}
