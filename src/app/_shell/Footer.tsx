import Link from "next/link";

const REPO = "https://github.com/deokman420/open-source-prompt-composer";

// Inlined at build time by next.config.mjs. Identifies the deployed bundle,
// which is what you actually need when someone reports a bug against "the site".
const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";
const SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";
const BUILT = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-row">
          <span className="footer-brand">
            <a href={REPO} target="_blank" rel="noreferrer noopener">
              Prompt Composer
            </a>{" "}
            — MIT licensed, self-hostable.
            <span className="footer-version" title="Deployed build">
              v{VERSION} · <a href={`${REPO}/commit/${SHA}`} target="_blank" rel="noreferrer noopener">{SHA}</a>
              {BUILT && ` · ${BUILT}`}
            </span>
          </span>
          <span className="footer-links">
            <a href={REPO} target="_blank" rel="noreferrer noopener">
              Source
            </a>
            <span>·</span>
            <Link href="/privacy">Privacy</Link>
            <span>·</span>
            <Link href="/settings">Settings</Link>
          </span>
        </div>
        <p className="footer-disclaimer">
          Everything you type stays in this browser. Prompts, drafts, and API
          keys are stored locally and, if you set a passphrase, encrypted at
          rest. Model requests pass through this site only to reach the provider
          you chose — they are not stored or logged.
        </p>
      </div>
    </footer>
  );
}
