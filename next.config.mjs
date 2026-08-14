/**
 * Prompt Composer — local-first build.
 *
 * There is no database, no auth provider, and no analytics. The only server-side
 * code is the stateless BYOK proxy under /api/proxy/*, which forwards a request
 * to an upstream model provider and returns the response. It stores nothing.
 *
 * The CSP below is deliberately strict: `connect-src 'self'` means the browser
 * can only talk to this origin. Provider calls go through the proxy, so no
 * upstream host needs to be allow-listed, and a compromised script has nowhere
 * to exfiltrate a decrypted vault to.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const isDev = process.env.NODE_ENV === "development";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * Short commit SHA for the footer build stamp.
 *
 * On Vercel this MUST come from the env var: .vercelignore excludes .git, so
 * there is no repository to shell out to during a Vercel build. Locally, git is
 * the only source. Either way a failure degrades to "dev" rather than breaking
 * the build — a missing build stamp is not worth a failed deploy.
 */
function buildSha() {
  const fromCi =
    process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const csp = [
  "default-src 'self'",
  // Next injects inline bootstrap scripts; 'unsafe-eval' is dev-only (HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Build stamp for the footer. Resolved once at build time and inlined, so it
  // identifies the deployed bundle rather than whenever the page was rendered.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_SHA: buildSha(),
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString().slice(0, 10),
    // Cache buster for the hand-written assets under /public/composer.
    //
    // Everything Next emits lives at a content-hashed /_next/static URL, so it
    // can never go stale. The composer bundle and its stylesheet do not: they
    // sit at fixed paths, which means a deploy can leave a browser holding last
    // version's app.js while running this version's HTML — and that HTML is the
    // bundle's DOM contract, so the mismatch shows up as features quietly not
    // binding. Stamping the build onto the URL makes each deploy a new resource.
    //
    // In dev the value changes per server start instead, so editing app.js and
    // reloading is enough.
    NEXT_PUBLIC_ASSET_VERSION: isDev
      ? String(Date.now())
      : `${pkg.version}-${buildSha()}`,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Two years, subdomains included. Safe here because the app is
          // HTTPS-only in every deployment; local dev is exempt below.
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // The vault never leaves the browser, but belt-and-braces: no caching
        // layer should ever hold a proxy response containing model output.
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
      {
        // Only the version-stamped request gets the immutable year. A bare
        // /composer/app.js keeps the default revalidate-every-time policy, so a
        // future caller that forgets `?v=` cannot pin itself to a stale copy.
        source: "/composer/:path*",
        has: [{ type: "query", key: "v" }],
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
