// Renders public/favicon.svg into the PNG icons the PWA manifest and iOS need.
// Usage: npm run icons   (uses the Playwright/Chromium available in the environment)
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

// Playwright is resolved via require so a globally installed copy works too.
const { chromium } = createRequire(import.meta.url)('playwright');

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'pwa-192.png', size: 192, pad: 0 },
  { file: 'pwa-512.png', size: 512, pad: 0 },
  { file: 'pwa-maskable-512.png', size: 512, pad: 0.12 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#07070d;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">
      <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div>
    </body></html>`,
  );
  await writeFile(new URL(`../public/${t.file}`, import.meta.url), await page.screenshot({ omitBackground: false }));
  console.log('wrote', t.file);
}
await browser.close();
