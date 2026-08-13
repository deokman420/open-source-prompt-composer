/**
 * Vault crypto tests.
 *
 * These matter more than the rest of the suite: this module is the only thing
 * standing between a shared browser profile and someone's API keys, and a
 * silent regression here (wrong iteration count, envelope that round-trips
 * under the wrong passphrase, a cached key leaking across passphrases) would
 * not show up in any UI.
 *
 * Node 22 exposes WebCrypto as a global, so the browser module runs unmodified.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  encryptJson,
  decryptJson,
  encryptForExport,
  verifyPassphrase,
  clearKeyCache,
  isEnvelope,
  lastFour,
  WrongPassphraseError,
  PBKDF2_ITERATIONS,
  ENVELOPE_ALG,
  ENVELOPE_KDF,
} from "../src/lib/vault/crypto.ts";

const SECRET = { keys: [{ provider: "anthropic", apiKey: "sk-ant-secret-value" }] };
const PASS = "correct-horse-battery-staple";

test("round-trips an object through encrypt/decrypt", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  const out = await decryptJson<typeof SECRET>(env, PASS);
  assert.deepEqual(out, SECRET);
});

test("envelope declares the algorithm and KDF it actually used", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  assert.equal(env.alg, ENVELOPE_ALG);
  assert.equal(env.kdf, ENVELOPE_KDF);
  assert.equal(ENVELOPE_KDF, `PBKDF2-SHA256-${PBKDF2_ITERATIONS}`);
  assert.ok(isEnvelope(env));
});

test("the ciphertext does not contain the plaintext", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  const blob = JSON.stringify(env);
  assert.ok(!blob.includes("sk-ant-secret-value"), "API key leaked into the envelope");
  assert.ok(!blob.includes("anthropic"), "provider name leaked into the envelope");
});

test("a wrong passphrase is rejected, not silently mis-decrypted", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  clearKeyCache();
  await assert.rejects(
    () => decryptJson(env, "not-the-passphrase"),
    (err: unknown) => err instanceof WrongPassphraseError
  );
});

test("a failed decrypt clears the key cache so a bad passphrase can't linger", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  clearKeyCache();
  await assert.rejects(() => decryptJson(env, "wrong"));
  // The correct passphrase must still work immediately afterwards.
  const out = await decryptJson<typeof SECRET>(env, PASS);
  assert.deepEqual(out, SECRET);
});

test("verifyPassphrase distinguishes right from wrong", async () => {
  clearKeyCache();
  const env = await encryptJson(SECRET, PASS);
  assert.equal(await verifyPassphrase(env, PASS), true);
  assert.equal(await verifyPassphrase(env, "nope"), false);
});

test("every encryption uses a fresh IV", async () => {
  clearKeyCache();
  const a = await encryptJson(SECRET, PASS);
  const b = await encryptJson(SECRET, PASS);
  assert.notEqual(a.iv, b.iv, "IV reuse under a fixed key breaks AES-GCM");
  assert.notEqual(a.ct, b.ct);
});

test("encryptForExport does not adopt its passphrase as the session key", async () => {
  // The footgun this guards: exporting a backup under a one-off passphrase must
  // not re-key the live vault. If encryptForExport populated the shared key
  // cache, the next session-level encrypt would silently use the backup
  // passphrase and the user would be locked out of their own vault.
  clearKeyCache();
  const session = await encryptJson(SECRET, PASS);
  await encryptForExport(SECRET, "one-off-backup-passphrase");

  // The session passphrase must still be the one that opens the session data.
  const out = await decryptJson<typeof SECRET>(session, PASS);
  assert.deepEqual(out, SECRET);

  // And a subsequent session encrypt must still be readable with PASS.
  const next = await encryptJson({ v: 2 }, PASS);
  assert.deepEqual(await decryptJson(next, PASS), { v: 2 });
});

test("an export envelope opens only with its own passphrase", async () => {
  clearKeyCache();
  const env = await encryptForExport(SECRET, "backup-pass");
  clearKeyCache();
  assert.deepEqual(await decryptJson(env, "backup-pass"), SECRET);
  clearKeyCache();
  await assert.rejects(() => decryptJson(env, PASS));
});

test("reusing a salt keeps the memoized key valid and still round-trips", async () => {
  clearKeyCache();
  const first = await encryptJson({ n: 1 }, PASS);
  const second = await encryptJson({ n: 2 }, PASS, first.salt);
  assert.equal(second.salt, first.salt, "salt should be reused for the memo");
  assert.deepEqual(await decryptJson(second, PASS), { n: 2 });
});

test("a salt is NOT reused across different passphrases", async () => {
  clearKeyCache();
  const first = await encryptJson({ n: 1 }, PASS);
  // Passing a reuseSalt with a different passphrase must generate a new salt,
  // otherwise two passphrases would share salt material.
  const second = await encryptJson({ n: 2 }, "a-different-passphrase", first.salt);
  assert.notEqual(second.salt, first.salt);
});

test("isEnvelope rejects malformed or downgraded envelopes", async () => {
  clearKeyCache();
  const good = await encryptJson(SECRET, PASS);
  assert.equal(isEnvelope(good), true);
  assert.equal(isEnvelope(null), false);
  assert.equal(isEnvelope({}), false);
  assert.equal(isEnvelope({ ...good, alg: "AES-CBC" }), false, "weaker cipher accepted");
  assert.equal(
    isEnvelope({ ...good, kdf: "PBKDF2-SHA256-1000" }),
    false,
    "downgraded iteration count accepted"
  );
});

test("decryptJson refuses anything that isn't a recognized envelope", async () => {
  await assert.rejects(
    () => decryptJson({ alg: "AES-CBC" } as never, PASS),
    /not a recognized vault envelope/i
  );
});

test("survives large documents and unicode", async () => {
  clearKeyCache();
  const big = {
    body: "🔐 ".repeat(20_000) + "ünïcødé ✓",
    nested: { list: Array.from({ length: 500 }, (_, i) => `item-${i}`) },
  };
  const env = await encryptJson(big, PASS);
  assert.deepEqual(await decryptJson(env, PASS), big);
});

test("lastFour masks all but the final four characters", () => {
  assert.equal(lastFour("sk-ant-abcd1234"), "1234");
  assert.equal(lastFour("xy"), "••xy");
});
