"use client";
import { ARRAY_ITEM_TYPES, PARAM_TYPES, type ToolParam } from "@/lib/tools/types";

const inputCls =
  "w-full rounded border border-[var(--border)] bg-[var(--bg-card-2)] px-2 py-1.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none";

export default function ParamRow({
  param,
  idx,
  onChange,
  onDelete,
}: {
  param: ToolParam;
  idx: number;
  onChange: (patch: Partial<ToolParam>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center gap-2">
        <input
          name={`param-${idx}-key`}
          className={inputCls + " flex-1 font-mono"}
          value={param.key}
          placeholder="parameter_name"
          spellCheck={false}
          onChange={(e) => onChange({ key: e.target.value })}
          aria-label={`Parameter ${idx + 1} name`}
        />
        <select
          name={`param-${idx}-type`}
          className={inputCls + " w-28"}
          value={param.type}
          onChange={(e) => onChange({ type: e.target.value as ToolParam["type"] })}
          aria-label={`Parameter ${idx + 1} type`}
        >
          {PARAM_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex flex-shrink-0 items-center gap-1 text-xs text-[var(--text-dim)]">
          <input
            name={`param-${idx}-required`}
            type="checkbox"
            checked={param.required}
            onChange={(e) => onChange({ required: e.target.checked })}
          />
          required
        </label>
        <button
          type="button"
          onClick={onDelete}
          className="flex-shrink-0 rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-dim)] transition-colors hover:border-[var(--bad)] hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--bad)]"
          aria-label={`Remove parameter ${idx + 1}`}
        >
          ✕
        </button>
      </div>

      <textarea
        name={`param-${idx}-description`}
        className={inputCls + " mt-2 resize-y"}
        rows={2}
        value={param.description}
        placeholder="What this parameter means and how it affects behavior."
        onChange={(e) => onChange({ description: e.target.value })}
        aria-label={`Parameter ${idx + 1} description`}
      />

      {param.type === "enum" && (
        <input
          name={`param-${idx}-enum`}
          className={inputCls + " mt-2"}
          value={(param.enumValues ?? []).join(", ")}
          placeholder="Allowed values, comma-separated (e.g. celsius, fahrenheit)"
          onChange={(e) =>
            onChange({
              enumValues: e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            })
          }
          aria-label={`Parameter ${idx + 1} enum values`}
        />
      )}

      {param.type === "array" && (
        <label className="mt-2 flex items-center gap-2 text-xs text-[var(--text-dim)]">
          Item type
          <select
            name={`param-${idx}-itemtype`}
            className={inputCls + " w-28"}
            value={param.itemType ?? "string"}
            onChange={(e) => onChange({ itemType: e.target.value as ToolParam["itemType"] })}
            aria-label={`Parameter ${idx + 1} array item type`}
          >
            {ARRAY_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
