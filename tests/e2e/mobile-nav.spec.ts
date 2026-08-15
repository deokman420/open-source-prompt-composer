import { test, expect } from "@playwright/test";

/**
 * Mobile shell.
 *
 * Below 720px the inline nav links are display:none, so the drawer is the only
 * route to seven of the nine surfaces — and the CSS for it sat in globals.css
 * for a while with no markup rendering it, which no test noticed because every
 * other spec runs at desktop width. These assertions are the ones that would
 * have caught that: the trigger exists, it reaches a page, and the passphrase
 * form stays inside the viewport.
 */

const PHONE = { width: 390, height: 844 };

test.describe("mobile shell", () => {
  test.use({ viewport: PHONE });

  test.beforeEach(async ({ page }) => {
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
  });

  test("the drawer is the way to every surface", async ({ page }) => {
    // The inline row is hidden, so without the burger there is no navigation.
    await expect(page.locator(".topnav .topnav-links")).toBeHidden();

    const burger = page.getByRole("button", { name: "Open navigation menu" });
    await expect(burger).toBeVisible();

    // A 44px tap target, not three 2px bars.
    const box = await burger.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await burger.click();
    const drawer = page.locator(".nav-drawer");
    await expect(drawer).toBeVisible();

    // Settings is in the drawer on mobile — it is hidden from the bar there.
    // exact, or "Compose" also matches the drawer's "$ prompt-composer" brand.
    for (const label of ["Compose", "Orchestra", "Eval", "Help", "Settings"]) {
      await expect(
        drawer.getByRole("link", { name: label, exact: true })
      ).toBeVisible();
    }

    await drawer.getByRole("link", { name: "Orchestra", exact: true }).click();
    await expect(page).toHaveURL(/\/orchestra$/);
    // Navigating closes it; this component survives the route change, so
    // nothing else would.
    await expect(drawer).toBeHidden();
  });

  test("the passphrase form stays inside the viewport", async ({ page }) => {
    await page.locator("button.vault-chip-btn").click();

    const pop = page.locator(".vault-pop");
    await expect(pop).toBeVisible();

    const box = (await pop.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width);
    // And it hangs below the header rather than under it.
    const nav = (await page.locator(".topnav").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(nav.height);

    // Nothing on the page may push the document wider than the screen.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Under 16px, iOS Safari zooms the viewport on focus and never zooms back.
    for (const id of ["#chip-pass", "#chip-confirm"]) {
      const size = await page
        .locator(id)
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
      expect(size).toBeGreaterThanOrEqual(16);
    }
  });
});
