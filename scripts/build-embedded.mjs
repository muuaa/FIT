// Builds the app as ONE self-contained HTML fragment (CSS + JS inlined), for hosts such as a
// claude.ai artifact that wrap the page in their own <html>/<head>/<body> skeleton.
// Usage: npm run build:embedded  →  dist-embedded/fit.html
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, VITE_EMBEDDED: '1' } });

const dir = 'dist-embedded';
const assets = readdirSync(join(dir, 'assets'));
const js = assets.filter((f) => f.endsWith('.js'));
const css = assets.filter((f) => f.endsWith('.css'));
if (js.length !== 1) throw new Error(`Expected one JS bundle, found: ${js.join(', ')}`);

const script = readFileSync(join(dir, 'assets', js[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const style = css.map((f) => readFileSync(join(dir, 'assets', f), 'utf8')).join('\n').replace(/<\/style/gi, '<\\/style');
const favicon = readFileSync('public/favicon.svg', 'utf8');

const html = `<title>Replete</title>
<meta name="theme-color" content="#0b0f14">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(favicon)}">
<style>
:root { color-scheme: dark; }
html, body { background: #0b0f14; color: #e8eef5; }
${style}
</style>
<div id="root"></div>
<script type="module">
${script}
</script>
`;
writeFileSync(join(dir, 'fit.html'), html);
console.log(`wrote ${dir}/fit.html (${(html.length / 1024).toFixed(0)} KB)`);
