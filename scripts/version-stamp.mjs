#!/usr/bin/env node
/**
 * Derive the release version from git and stamp it into package.json.
 *
 * Why this exists: the version in package.json is not decoration. next.config.mjs
 * feeds it to NEXT_PUBLIC_APP_VERSION (the footer build stamp) and, joined with
 * the commit SHA, to NEXT_PUBLIC_ASSET_VERSION — the cache buster on the
 * hand-written /public/composer bundle. Bumping it by hand meant remembering to,
 * and the two deploys where nobody did shipped as "0.2.0" twice.
 *
 * Why it runs here and not in next.config.mjs: .vercelignore excludes .git, so a
 * Vercel build has no repository to count commits in. The version therefore has
 * to be resolved on this machine and baked into package.json *before* the CLI
 * uploads it — which is exactly what `npm run deploy` does.
 *
 * The scheme:
 *
 *   version = <last tag's major>.<minor>.<patch + commits since that tag>
 *
 * so v0.2.0 plus one commit is 0.2.1, and tagging that release makes the next
 * commit 0.2.2. Only the patch moves automatically. A minor or major release is
 * a judgement call, so it stays manual: tag it yourself (`git tag v0.3.0`) and
 * this script counts on from there.
 *
 * Usage:
 *   node scripts/version-stamp.mjs            stamp, commit, and tag
 *   node scripts/version-stamp.mjs --check    print the version, change nothing
 *   node scripts/version-stamp.mjs --no-tag   stamp and commit, don't tag
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const args = new Set(process.argv.slice(2));
const CHECK_ONLY = args.has("--check");
const NO_TAG = args.has("--no-tag");
const ALLOW_DIRTY = args.has("--allow-dirty");

function git(...a) {
  return execFileSync("git", a, { cwd: ROOT, encoding: "utf8" }).trim();
}

function fail(message) {
  console.error(`version-stamp: ${message}`);
  process.exit(1);
}

/** Most recent v-prefixed tag, or null on a repo that has never been tagged. */
function lastTag() {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*");
  } catch {
    return null;
  }
}

function parseTag(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  if (!m) fail(`tag "${tag}" is not vMAJOR.MINOR.PATCH — cannot derive a version from it.`);
  return { major: +m[1], minor: +m[2], patch: +m[3] };
}

/* ---------------------------------------------------------------- */

const tag = lastTag();
const base = tag ? parseTag(tag) : { major: 0, minor: 0, patch: 0 };
// No tag yet: every commit counts toward the first patch number.
const since = tag ? +git("rev-list", `${tag}..HEAD`, "--count") : +git("rev-list", "HEAD", "--count");
const version = `${base.major}.${base.minor}.${base.patch + since}`;

const pkgPath = join(ROOT, "package.json");
const pkgRaw = readFileSync(pkgPath, "utf8");
const pkg = JSON.parse(pkgRaw);

if (CHECK_ONLY) {
  console.log(version);
  process.exit(pkg.version === version ? 0 : 1);
}

// A dirty tree means the commit count doesn't describe what is about to ship:
// the uncommitted work would deploy under a version that claims to be `tag`
// plus N commits it doesn't contain. Stop rather than mint a lying stamp.
if (!ALLOW_DIRTY) {
  const dirty = git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    // package.json and its lock are ours to rewrite below.
    .filter((line) => !/\s(package\.json|package-lock\.json)$/.test(line));
  if (dirty.length) {
    fail(
      `working tree has uncommitted changes — commit them first so the version describes what ships:\n${dirty.join("\n")}`
    );
  }
}

const changed = pkg.version !== version;

if (changed) {
  // Rewrite the version field in place rather than re-serializing the whole
  // file, so formatting and key order survive untouched.
  writeFileSync(
    pkgPath,
    pkgRaw.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`),
    "utf8"
  );

  // npm records the version twice in the lockfile: the top-level field and the
  // root package entry (`packages[""]`). Leaving them behind makes `npm ci`
  // noisy.
  //
  // Both are rewritten through the parsed object, not by string replace: a
  // dependency sitting at the same version string as this app would otherwise
  // be silently rewritten too, and a lockfile that lies about a dependency's
  // version is a far worse bug than a stale one about ours.
  const lockPath = join(ROOT, "package-lock.json");
  try {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    lock.version = version;
    if (lock.packages?.[""]) lock.packages[""].version = version;
    writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf8");
  } catch {
    // No lockfile in this checkout; nothing to keep in sync.
  }

  git("add", "package.json", "package-lock.json");
  git("commit", "-m", `chore(release): v${version}`);
  console.log(`version-stamp: ${pkg.version} → ${version} (committed)`);
} else {
  console.log(`version-stamp: already at ${version}`);
}

if (!NO_TAG) {
  const tags = git("tag", "--list", `v${version}`);
  if (tags) {
    console.log(`version-stamp: tag v${version} already exists`);
  } else {
    git("tag", "-a", `v${version}`, "-m", `v${version}`);
    console.log(`version-stamp: tagged v${version}`);
  }
}
