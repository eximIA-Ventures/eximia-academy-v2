// Dev-only screenshot harness for /dev/preview-desempenho.
// Usage: node scripts/shoot-desempenho.mjs <out.png> <light|dark>
import { chromium } from "@playwright/test"

const out = process.argv[2] || "/tmp/desempenho-final-light.png"
const mode = process.argv[3] || "light"

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  colorScheme: mode === "dark" ? "dark" : "light",
})
await page.goto("http://localhost:3001/dev/preview-desempenho", {
  waitUntil: "networkidle",
})
if (mode === "dark") {
  await page.evaluate(() => document.documentElement.classList.add("dark"))
}
// Let bar transitions (500ms) settle so widths are final in the shot.
await page.waitForTimeout(900)
await page.screenshot({ path: out })
await browser.close()
console.log(`shot ${mode} → ${out}`)
