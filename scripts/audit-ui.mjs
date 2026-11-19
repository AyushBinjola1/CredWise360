// Browser audit of every public, customer and administrator route. Read-only: it signs in with the demo accounts and only navigates.
// Usage: WEB_URL=http://127.0.0.1:3000 node scripts/audit-ui.mjs [--quick] [--out report.json]
import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readdirSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';

const base = process.env.WEB_URL || 'http://127.0.0.1:3000';
const quick = process.argv.includes('--quick');
const fast = process.argv.includes('--fast');   // domcontentloaded plus a short settle instead of waiting for the network to go idle
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > 0 ? process.argv[outIndex + 1] : '.local/audit-report.json';
const PASSWORD = 'CredWiseDemo!360';

const publicRoutes = ['/', '/products', '/products/personal', '/calculator', '/compare', '/login', '/register', '/recover', '/about', '/how-it-works', '/features', '/resources', '/faq', '/privacy', '/terms', '/simulation'];
const customerRoutes = ['', 'profile', 'credit', 'market', 'market/personal', 'applications', 'applications/1', 'loans', 'loans/1', 'repayments', 'recovery', 'calculator', 'compare', 'safety', 'twin', 'debt', 'stress', 'education', 'distress', 'academy', 'academy/responsible-borrowing', 'rewards', 'disputes', 'notifications', 'reports', 'kyc', 'settings'].map(r => '/app' + (r ? '/' + r : ''));
const adminRoutes = ['', 'applications', 'applications/2', 'loans', 'loans/1', 'repayments', 'disputes', 'distress', 'fairness', 'fraud', 'reports', 'policy', 'products', 'users', 'kyc', 'settings'].map(r => '/admin' + (r ? '/' + r : ''));
const allWidths = process.env.AUDIT_WIDTHS ? process.env.AUDIT_WIDTHS.split(',').map(Number) : [320, 360, 375, 390, 414, 480, 640, 768, 1024, 1280, 1440, 1920, 2560];
const axeWidths = quick ? [390, 1440] : [390, 768, 1440];

function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const folder = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(folder)) return undefined;
  return readdirSync(folder).filter(n => n.startsWith('chromium_headless_shell-')).sort().reverse()
    .map(n => join(folder, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')).find(existsSync);
}

const findings = [];
const add = (kind, url, width, theme, detail) => findings.push({kind, url, width, theme, detail});
const browser = await chromium.launch({executablePath: chromiumPath()});

async function context(role, width, theme) {
  const ctx = await browser.newContext({baseURL: base, viewport: {width, height: width >= 1024 ? 900 : 844}, reducedMotion: 'reduce'});
  await ctx.addInitScript(t => { try { localStorage.setItem('cw-theme', t); } catch { /* ignore */ } }, theme);
  if (role) {
    const email = role === 'admin' ? 'admin@credwise.test' : 'borrower@credwise.test';
    const reply = await ctx.request.fetch('/api/auth/login', {method: 'POST', headers: {'X-CredWise-Action': '1', Origin: new URL(base).origin}, data: {email, password: PASSWORD}});
    if (!reply.ok()) throw new Error('Demo sign-in failed for ' + role);
  }
  return ctx;
}

async function visit(page, url, width, theme, withAxe) {
  const issues = [];
  const onConsole = m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|422)/.test(m.text())) issues.push('console: ' + m.text().slice(0, 160)); };
  const onPageError = e => issues.push('pageerror: ' + e.message.slice(0, 160));
  const onResponse = r => { if (r.status() >= 500) issues.push('http ' + r.status() + ' ' + new URL(r.url()).pathname); };
  page.on('console', onConsole); page.on('pageerror', onPageError); page.on('response', onResponse);
  const response = await page.goto(url, {waitUntil: fast ? 'domcontentloaded' : 'networkidle'}).catch(e => { issues.push('navigation: ' + e.message.slice(0, 120)); return null; });
  page.off('console', onConsole); page.off('pageerror', onPageError); page.off('response', onResponse);
  if (fast && response) { await page.locator('main').first().waitFor({timeout: 8000}).catch(() => {}); await page.waitForTimeout(700); }
  for (const issue of issues) add('runtime', url, width, theme, issue);
  if (!response) return;
  if (response.status() >= 400) add('status', url, width, theme, String(response.status()));
  const layout = await page.evaluate(() => {
    const vw = window.innerWidth;
    const over = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.position === 'fixed' || style.visibility === 'hidden' || style.display === 'none') continue;
      if (r.right > vw + 1 || r.left < -1) {
        let p = el.parentElement, scrollable = false;
        while (p && p !== document.body) { const s = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { scrollable = true; break; } p = p.parentElement; }
        if (!scrollable) over.push(el.tagName.toLowerCase() + '.' + (el.className?.toString().split(' ')[0] || '') + ' right=' + Math.round(r.right));
      }
    }
    const small = vw <= 768 ? [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button]')].filter(el => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && (r.height < 24 || r.width < 24) && !el.closest('.sr-only,.skip') && getComputedStyle(el).position !== 'absolute';
    }).map(el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 30)) : [];
    return {docOverflow: document.documentElement.scrollWidth > vw + 1, over: over.slice(0, 5), small: small.slice(0, 5), h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length};
  });
  if (layout.docOverflow) add('overflow', url, width, theme, layout.over.join('; ') || 'document wider than viewport');
  else if (layout.over.length) add('clipped', url, width, theme, layout.over.join('; '));
  if (layout.small.length) add('target-size', url, width, theme, layout.small.join(' | '));
  if (layout.h1 !== 1) add('heading', url, width, theme, layout.h1 + ' h1 elements');
  if (!layout.main) add('landmark', url, width, theme, 'no main landmark');
  if (withAxe) {
    const result = await new AxeBuilder({page}).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    for (const v of result.violations) add('a11y:' + v.impact, url, width, theme, v.id + ' (' + v.nodes.length + ') ' + (v.nodes[0]?.target?.join(' ') || '').slice(0, 100) + ' :: ' + (v.nodes[0]?.failureSummary || '').split('\n')[1]?.trim().slice(0, 140));
  }
}

const only = process.env.AUDIT_ONLY ? process.env.AUDIT_ONLY.split(',') : null;   // keep only routes containing one of these fragments
const pick = routes => only ? routes.filter(r => only.some(o => r === o || r.startsWith(o + '/') || r === '/app' + o || r === '/admin' + o)) : routes;
const jobs = [['', pick(publicRoutes)], ['customer', pick(customerRoutes)], ['admin', pick(adminRoutes)]].filter(([, routes]) => routes.length);
for (const theme of ['light', 'dark']) {
  const widths = theme === 'light' ? (quick ? [320, 390, 768, 1440] : allWidths) : (quick ? [390, 1440] : [320, 390, 768, 1280, 1440, 2560]);
  for (const width of widths) {
    for (const [role, routes] of jobs) {
      const ctx = await context(role, width, theme);
      const page = await ctx.newPage();
      for (const route of routes) await visit(page, route, width, theme, axeWidths.includes(width));
      await ctx.close();
    }
    console.log('audited', theme, width);
  }
}
await browser.close();

// Collapse duplicates: group by kind + detail across routes.
const grouped = new Map();
for (const f of findings) {
  const key = f.kind + '|' + f.detail.replace(/\d+/g, '#').slice(0, 120);
  const g = grouped.get(key) || {kind: f.kind, detail: f.detail, count: 0, examples: new Set(), widths: new Set(), themes: new Set()};
  g.count++; if (g.examples.size < 4) g.examples.add(f.url); g.widths.add(f.width); g.themes.add(f.theme); grouped.set(key, g);
}
const summary = [...grouped.values()].map(g => ({...g, examples: [...g.examples], widths: [...g.widths].sort((a, b) => a - b), themes: [...g.themes]})).sort((a, b) => b.count - a.count);
mkdirSync(dirname(outFile), {recursive: true});
writeFileSync(outFile, JSON.stringify({base, total: findings.length, groups: summary.length, summary}, null, 1));
console.log('findings', findings.length, 'groups', summary.length, '->', outFile);
for (const g of summary.slice(0, 40)) console.log(String(g.count).padStart(4), g.kind.padEnd(16), g.detail.slice(0, 150), '|', g.examples.slice(0, 2).join(','), '| w', g.widths.join('/'), g.themes.join('/'));
