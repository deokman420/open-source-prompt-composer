import type { Provider } from "./types";

/**
 * A non-2xx response from a BYOK provider call. Carries the upstream HTTP
 * status + (truncated) body so a route can tell a user-key problem (401/402/
 * 429) apart from our own bug, instead of collapsing everything to a generic
 * "eval failed". The raw `body` is for server logs only — never surface it to
 * the client (see {@link describeProviderError}).
 */
export class ProviderHttpError extends Error {
  constructor(
    public provider: Provider,
    public status: number,
    public body: string
  ) {
    super(`${provider} ${status}: ${body.slice(0, 500)}`);
    this.name = "ProviderHttpError";
  }
}

// Record (not a plain object) so adding a Provider without a label is a
// compile error, not a silent "undefined" in a user-facing message.
const LABEL: Record<Provider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  xai: "xAI",
  nvidia: "NVIDIA",
  openrouter: "OpenRouter",
  deepseek: "DeepSeek",
};

/**
 * Map a thrown provider error to a user-safe `{ status, message }`, or `null`
 * if it isn't a `ProviderHttpError` (i.e. it's our bug → caller should 502 +
 * "eval failed"). This is BYOK: the "upstream" is the user's OWN provider
 * account, so a rejected key / out-of-credit / rate-limit is theirs to see and
 * fix. We surface the CATEGORY + HTTP code only — never the raw upstream body.
 */
export function describeProviderError(
  err: unknown
): { status: number; message: string } | null {
  if (!(err instanceof ProviderHttpError)) return null;
  const name = LABEL[err.provider] ?? err.provider;
  const s = err.status;
  if (s === 401 || s === 403) {
    return {
      status: 400,
      message: `Your ${name} API key was rejected (HTTP ${s}). Check or replace it in Settings → API keys.`,
    };
  }
  if (s === 402) {
    return {
      status: 402,
      message: `Your ${name} account is out of credit or over its billing limit (HTTP ${s}).`,
    };
  }
  if (s === 429) {
    return {
      status: 429,
      message: `${name} rate-limited your key (HTTP 429). Wait a moment and try again.`,
    };
  }
  if (s >= 500) {
    return {
      status: 502,
      message: `${name} is having an outage (HTTP ${s}). Try again shortly.`,
    };
  }
  return {
    status: 502,
    message: `${name} rejected the request (HTTP ${s}).`,
  };
}
