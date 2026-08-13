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
    expect(rec?.envelope?.kdf).toBe("PBKDF2-SHA256-210000");
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
