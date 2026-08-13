import Link from "next/link";

const REPO = "https://github.com/deokman420/open-source-prompt-composer";

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
