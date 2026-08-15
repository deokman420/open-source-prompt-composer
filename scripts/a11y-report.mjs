/**
 * Ad-hoc axe triage: aggregate every violation across every route into two
 * tables — rule counts, and the distinct colour pairs behind color-contrast.
 *
 * Not part of the test suite; tests/e2e/a11y.spec.ts is the gate. This is the
 * thing you run to decide what to fix.
 *
 *   npx next start -p 3100 &
 *   node scripts/a11y-report.mjs
 */
import { chromium } from "playwright";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");
const axeSource = await import("node:fs").then((fs) =>
  fs.readFileSync(axePath, "utf8")
);

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const ROUTES = [
  "/", "/compose", "/orchestra", "/context-pipeline", "/eval", "/loops",
  "/tools", "/drafts", "/help", "/help/kb", "/settings", "/privacy",
];

const browser = await chromium.launch();
const rules = new Map();       // ruleId -> {impact, count, routes:Set}
const contrast = new Map();    // "fg on bg" -> {ratio, need, count, sample}

for (const width of [1280, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.waitForSelector(".vault-chip", { timeout: 15000 }).catch(() => {});
    await page.addScriptTag({ content: axeSource });
    const res = await page.evaluate(
      (tags) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
      TAGS
    );
    for (const v of res.violations) {
      const key = v.id;
      if (!rules.has(key)) rules.set(key, { impact: v.impact, count: 0, routes: new Set() });
      const r = rules.get(key);
      r.count += v.nodes.length;
      r.routes.add(`${route}@${width}`);

      if (v.id !== "color-contrast") continue;
      for (const n of v.nodes) {
        const d = n.any?.[0]?.data;
        if (!d) continue;
        const k = `${d.fgColor} on ${d.bgColor}`;
        if (!contrast.has(k))
          contrast.set(k, {
            ratio: d.contrastRatio,
            need: d.expectedContrastRatio,
            count: 0,
            sample: n.target.join(" ").slice(0, 70),
          });
        contrast.get(k).count += 1;
      }
    }
  }
  await page.close();
}
await browser.close();

console.log("\n=== rules ===");
for (const [id, r] of [...rules].sort((a, b) => b[1].count - a[1].count))
  console.log(`${String(r.count).padStart(4)}  [${r.impact}] ${id}  (${r.routes.size} page/viewport combos)`);

console.log("\n=== contrast pairs ===");
for (const [k, c] of [...contrast].sort((a, b) => b[1].count - a[1].count))
  console.log(`${String(c.count).padStart(4)}  ${k}  ratio ${c.ratio} (needs ${c.need})\n        e.g. ${c.sample}`);
