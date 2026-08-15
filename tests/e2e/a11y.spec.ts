import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility sweep (axe-core, WCAG 2.1 A + AA).
 *
 * Every surface is scanned at a desktop and a phone viewport, because several
 * of this app's rules only exist below 720px — the nav collapses into a drawer,
 * the vault passphrase form becomes a sheet, form controls resize. A pass at
 * 1280px says nothing about any of them.
 *
 * Transient UI is scanned too. The drawer, the passphrase popover and the
 * unlock gate are where the interesting failures live (focus, labelling,
 * contrast on the warn/accent colors), and none of them are in the DOM on a
 * plain page load.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const ROUTES = [
  "/",
  "/compose",
  "/orchestra",
  "/context-pipeline",
  "/eval",
  "/loops",
  "/tools",
  "/drafts",
  "/help",
  "/help/kb",
  "/settings",
  "/privacy",
];

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

const PASSPHRASE = "test-passphrase-123";

/** Wipe the vault so each scan starts from the same unprotected state. */
async function freshVault(page: Page) {
  await page.goto("/");
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
}

function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(TAGS);
}

type Violations = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"];

/**
 * One readable line per offending node, asserted as the value itself.
 *
 * Asserting raw axe objects against `[]` prints a hundred-line structural diff
 * per finding and buries the only two things you need — which rule, on which
 * element. Reducing to strings first makes the failure output the report.
 */
function summarize(violations: Violations): string[] {
  return violations.flatMap((v) =>
    v.nodes.map((n) => `[${v.impact}] ${v.id} — ${n.target.join(" ")}`)
  );
}

test.describe("accessibility", () => {
  for (const [label, viewport] of [
    ["desktop", DESKTOP],
    ["mobile", PHONE],
  ] as const) {
    test.describe(label, () => {
      test.use({ viewport });

      for (const route of ROUTES) {
        test(`${route} has no WCAG A/AA violations`, async ({ page }) => {
          await freshVault(page);
          await page.goto(route);
          // Every surface renders behind the vault boundary, which shows
          // "Opening your local vault…" until IndexedDB resolves. Scanning
          // before that means scanning a one-line placeholder.
          await expect(page.locator(".vault-chip")).toBeVisible();

          const { violations } = await scan(page).analyze();
          expect(summarize(violations)).toEqual([]);
        });
      }
    });
  }

  test("the mobile drawer is accessible while open", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await freshVault(page);
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.locator(".nav-drawer")).toBeVisible();

    const { violations } = await scan(page).analyze();
    expect(summarize(violations)).toEqual([]);
  });

  test("the passphrase popover is accessible", async ({ page }) => {
    for (const viewport of [DESKTOP, PHONE]) {
      await page.setViewportSize(viewport);
      await freshVault(page);
      await page.locator("button.vault-chip-btn").click();
      await expect(page.locator(".vault-pop")).toBeVisible();

      const { violations } = await scan(page).analyze();
      expect(summarize(violations), `at ${viewport.width}px`).toEqual([]);
    }
  });

  test("the unlock gate is accessible, including the escape hatch", async ({
    page,
  }) => {
    await page.setViewportSize(PHONE);
    await freshVault(page);

    await page.locator("button.vault-chip-btn").click();
    await page.locator("#chip-pass").fill(PASSPHRASE);
    await page.locator("#chip-confirm").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Protect vault" }).click();
    await expect(page.locator(".vault-chip")).toHaveText(/Protected/);

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Unlock your vault" })
    ).toBeVisible();

    // Open the <details> so the erase controls are in the tree too.
    await page.getByText("Forgotten your passphrase?").click();

    const { violations } = await scan(page).analyze();
    expect(summarize(violations)).toEqual([]);
  });
});
