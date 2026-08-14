import { test, expect, type Page } from "@playwright/test";

/**
 * Vault lifecycle, driven through the real UI and verified against the raw
 * IndexedDB record.
 *
 * Reading the record back is the whole point. The vault's worst failure mode is
 * writing plaintext while the UI still claims to be locked — which looks
 * completely normal on screen. Only the bytes on disk tell you.
 */

const PASSPHRASE = "test-passphrase-123";
const FAKE_KEY = "sk-ant-e2e-canary-value";

type StoredRecord = {
  protected?: boolean;
  envelope?: { alg?: string; kdf?: string; ct?: string };
  doc?: unknown;
};

/** Read the vault record straight out of IndexedDB, bypassing the app. */
async function readRecord(page: Page): Promise<StoredRecord | undefined> {
  return page.evaluate(
    () =>
      new Promise<StoredRecord | undefined>((resolve) => {
        const req = indexedDB.open("prompt-composer", 1);
        req.onsuccess = () => {
          const get = req.result
            .transaction("vault")
            .objectStore("vault")
            .get("doc");
          get.onsuccess = () => resolve(get.result as StoredRecord | undefined);
          get.onerror = () => resolve(undefined);
        };
        req.onerror = () => resolve(undefined);
      })
  );
}

async function freshVault(page: Page) {
  await page.goto("/settings");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("prompt-composer");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      })
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
}

async function encryptVault(page: Page) {
  await page.locator("#new-pass").fill(PASSPHRASE);
  await page.locator("#confirm-pass").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Encrypt vault" }).click();
  await expect(page.getByText("Vault encrypted.")).toBeVisible();
}

test.describe("vault", () => {
  test.beforeEach(async ({ page }) => {
    await freshVault(page);
  });

  test("encrypting produces a real envelope with no plaintext at rest", async ({
    page,
  }) => {
    // Save a key first so there is something identifiable to look for.
    await page.getByRole("button", { name: "Add key" }).first().click();
    await page.locator('input[placeholder^="Paste your"]').first().fill(FAKE_KEY);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText(/ends .*canary|Saved ·/).first()).toBeVisible({
      timeout: 5_000,
    });

    await encryptVault(page);
    await page.waitForTimeout(1_500);

    const rec = await readRecord(page);
    expect(rec?.protected).toBe(true);
    expect(rec?.envelope?.alg).toBe("AES-GCM-256");
    // Must meet the OWASP floor; see scripts/test-vault-crypto.mts for the
    // legacy-envelope compatibility that lets older vaults still open.
    expect(rec?.envelope?.kdf).toBe("PBKDF2-SHA256-600000");
    expect(rec?.doc).toBeUndefined();
    expect(JSON.stringify(rec)).not.toContain(FAKE_KEY);
  });

  /**
   * Regression: locking while a debounced save was still pending used to
   * rewrite the vault as `{ protected: false, doc }` — plaintext API keys on
   * disk — because the queued write read the passphrase ref *after* lock() had
   * nulled it. The UI still showed the lock screen, and unlocking then failed
   * with "No protected vault found in this browser", because by then there
   * genuinely wasn't one.
   */
  test("locking mid-save keeps the vault encrypted and unlockable", async ({
    page,
  }) => {
    await encryptVault(page);
    await page.waitForTimeout(1_000);

    // Queue a write, then lock before its debounce elapses.
    await page.getByRole("button", { name: "Add key" }).first().click();
    await page.locator('input[placeholder^="Paste your"]').first().fill(FAKE_KEY);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await page.waitForTimeout(50);
    await page.locator(".vault-chip button").click();

    await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
    await page.waitForTimeout(2_000);

    const rec = await readRecord(page);
    expect(rec?.protected, "vault was silently downgraded to unprotected").toBe(true);
    expect(rec?.doc, "plaintext document written to disk").toBeUndefined();
    expect(
      JSON.stringify(rec),
      "API key written to disk in cleartext"
    ).not.toContain(FAKE_KEY);

    // And the passphrase must still open it.
    await page.locator("#passphrase").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("a wrong passphrase is rejected and the right one still works", async ({
    page,
  }) => {
    await encryptVault(page);
    await page.waitForTimeout(1_000);
    await page.locator(".vault-chip button").click();

    await page.locator("#passphrase").fill("definitely-wrong");
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("Wrong passphrase.")).toBeVisible();

    await page.locator("#passphrase").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("removing encryption requires the current passphrase", async ({ page }) => {
    await encryptVault(page);
    await page.waitForTimeout(1_000);

    // Wrong passphrase must not strip encryption.
    page.once("dialog", (d) => d.accept());
    await page.locator("#remove-pass").fill("not-the-passphrase");
    await page.getByRole("button", { name: "Remove encryption" }).click();
    await expect(
      page.getByText("Wrong passphrase — encryption was not removed.")
    ).toBeVisible();

    let rec = await readRecord(page);
    expect(rec?.protected, "encryption stripped without the passphrase").toBe(true);

    // The real passphrase does remove it.
    page.once("dialog", (d) => d.accept());
    await page.locator("#remove-pass").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Remove encryption" }).click();
    await expect(page.getByText(/Encryption removed/)).toBeVisible();

    await page.waitForTimeout(1_500);
    rec = await readRecord(page);
    expect(rec?.protected).toBe(false);
  });

  test("backups are always encrypted", async ({ page }) => {
    // Something identifiable must exist in the vault to look for in the file.
    await page.getByRole("button", { name: "Add key" }).first().click();
    await page.locator('input[placeholder^="Paste your"]').first().fill(FAKE_KEY);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await page.waitForTimeout(1_000);

    const downloadBtn = page.getByRole("button", { name: "Download encrypted backup" });

    // No passphrase, or too short, or mismatched → export stays disabled.
    await expect(downloadBtn).toBeDisabled();
    await page.locator("#export-pass").fill("short");
    await expect(downloadBtn).toBeDisabled();
    await page.locator("#export-pass").fill("backup-passphrase");
    await page.locator('input[placeholder="Confirm passphrase"]').fill("different");
    await expect(downloadBtn).toBeDisabled();

    await page.locator('input[placeholder="Confirm passphrase"]').fill("backup-passphrase");
    await expect(downloadBtn).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadBtn.click(),
    ]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    const contents = Buffer.concat(chunks).toString("utf8");

    const parsed = JSON.parse(contents);
    expect(parsed.encrypted).toBe(true);
    expect(parsed.envelope?.alg).toBe("AES-GCM-256");
    expect(parsed.doc, "backup contained a plaintext document").toBeUndefined();
    expect(contents, "API key written into the backup in cleartext").not.toContain(FAKE_KEY);
  });

  /**
   * Regression: the feature editors used to autosave their working state to
   * localStorage, and AI Help kept its transcript in sessionStorage. Both
   * ignored the vault entirely, so with encryption on you could still read
   * every prompt out of devtools in the clear. This walks the tools, types
   * identifiable content into each, and asserts none of it lands anywhere
   * outside the encrypted record.
   */
  test("no user content is written outside the encrypted vault", async ({ page }) => {
    await encryptVault(page);
    await page.waitForTimeout(1_000);

    const CANARY = "CANARY-SECRET-PROMPT-TEXT";

    // In-app navigation only: page.goto() is a hard load, which drops the
    // in-memory passphrase and locks the vault, leaving nothing to type into.
    const go = async (label: string) => {
      await page.getByRole("link", { name: label, exact: true }).first().click();
      await page.waitForTimeout(400);
    };

    // Orchestra: type into the first agent slot.
    await go("Orchestra");
    const orchField = page.locator("textarea").first();
    await orchField.fill(CANARY);
    await page.waitForTimeout(900);

    // Tool Builder: name the tool.
    await go("Tools");
    const toolField = page.locator('input[type="text"]').first();
    await toolField.fill(CANARY);
    await page.waitForTimeout(900);

    // Loops: the recurring instruction.
    await go("Loops");
    const loopField = page.locator("textarea").first();
    if (await loopField.count()) {
      await loopField.fill(CANARY);
      await page.waitForTimeout(900);
    }

    // Compose: the vanilla bundle, through PC_STORE.
    await go("Compose");
    await page.locator("#fieldRole").fill(CANARY);
    await page.waitForTimeout(1_200);

    const dump = await page.evaluate(() => {
      const local: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        local[k] = localStorage.getItem(k) ?? "";
      }
      const session: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i)!;
        session[k] = sessionStorage.getItem(k) ?? "";
      }
      return { local, session };
    });

    expect(
      JSON.stringify(dump.local),
      `user content found in localStorage: ${JSON.stringify(dump.local).slice(0, 400)}`
    ).not.toContain(CANARY);
    expect(
      JSON.stringify(dump.session),
      `user content found in sessionStorage: ${JSON.stringify(dump.session).slice(0, 400)}`
    ).not.toContain(CANARY);

    // And the vault record itself must still be an opaque envelope.
    const rec = await readRecord(page);
    expect(rec?.protected).toBe(true);
    expect(JSON.stringify(rec)).not.toContain(CANARY);

    // Guard against this test passing trivially: if the fields never actually
    // persisted, "not in localStorage" would be true for the boring reason.
    // Navigating away and back must restore the text — proving it really was
    // written, and written into the vault.
    await go("Orchestra");
    await expect(page.locator("textarea").first()).toHaveValue(CANARY);
    // Compose must survive the round trip too. Regression: the bundle used to
    // read from a snapshot taken at mount, so a remount could read an empty
    // store, restore nothing, and then persist the blank form over real work.
    await go("Compose");
    await expect(page.locator("#fieldRole")).toHaveValue(CANARY);
  });

  /**
   * Regression: handoffs between tools moved from sessionStorage to an
   * in-memory map, to keep prompts off disk. The composer's "Send to Evaluator"
   * used window.location.assign(), a full page load — which tears that map down
   * and delivers an empty prompt. It now asks the host to route client-side.
   */
  test("send-to-evaluator carries the prompt without touching disk", async ({ page }) => {
    // Eval only renders its form once a key exists.
    await page.getByRole("button", { name: "Add key" }).first().click();
    await page.locator('input[placeholder^="Paste your"]').first().fill(FAKE_KEY);
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await page.waitForTimeout(800);

    await page.getByRole("link", { name: "Compose", exact: true }).first().click();
    await page.locator("#fieldRole").fill("SEND-CANARY-ROLE");
    await page.waitForTimeout(700);
    await page.locator("#sendToEvalBtn").click();

    await expect(page).toHaveURL(/\/eval$/);
    await expect(page.locator("#eval-prompt")).toHaveValue(/SEND-CANARY-ROLE/);

    // The prompt must not have travelled via disk or the URL.
    const leaked = await page.evaluate(() => {
      const dump = (st: Storage) => {
        let out = "";
        for (let i = 0; i < st.length; i++) out += st.getItem(st.key(i)!) ?? "";
        return out;
      };
      return { session: dump(sessionStorage), local: dump(localStorage), url: location.href };
    });
    expect(leaked.session).not.toContain("SEND-CANARY-ROLE");
    expect(leaked.local).not.toContain("SEND-CANARY-ROLE");
    expect(leaked.url).not.toContain("SEND-CANARY-ROLE");
  });

  test("the footer carries a build stamp", async ({ page }) => {
    const version = page.locator(".footer-version");
    await expect(version).toBeVisible();
    // v<semver> · <sha> · <yyyy-mm-dd>
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+ · \S+ · \d{4}-\d{2}-\d{2}$/);
  });

  test("a protected vault survives a reload and gates the app", async ({ page }) => {
    await encryptVault(page);
    await page.waitForTimeout(1_500);

    await page.goto("/compose");
    await expect(page.getByRole("heading", { name: "Unlock your vault" })).toBeVisible();
    // The composer must not be reachable while locked.
    await expect(page.locator("#composerForm")).toHaveCount(0);

    await page.locator("#passphrase").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.locator("#composerForm")).toBeVisible();
  });
});
