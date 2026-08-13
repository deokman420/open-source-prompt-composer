import type { CtxState } from "./types";

// base64url, =/+/ stripped — same scheme as orchestra/share.ts so encoding is
// consistent across the app.
export function encodeState(state: CtxState): string {
  const json = JSON.stringify(state);
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const _btoa: (s: string) => string = (globalThis as any).btoa;
  return _btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeState(s: string): CtxState | null {
  try {
    let t = s.replace(/-/g, "+").replace(/_/g, "/");
    while (t.length % 4) t += "=";
    let json: string;
    if (typeof Buffer !== "undefined") {
      json = Buffer.from(t, "base64").toString("utf-8");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const _atob: (s: string) => string = (globalThis as any).atob;
      json = decodeURIComponent(escape(_atob(t)));
    }
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed.model !== "string" || !parsed.sources) return null;
    return parsed as CtxState;
  } catch {
    return null;
  }
}
