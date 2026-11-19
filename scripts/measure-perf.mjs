// Measures real load behaviour in a browser against a running stack. Read-only. Results are local measurements, not Lighthouse scores.
// Usage: WEB_URL=http://127.0.0.1:3000 node scripts/measure-perf.mjs [--out perf.json]
import {chromium} from '@playwright/test';
import {readdirSync,existsSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const base = process.env.WEB_URL || 'http://127.0.0.1:3000';
const outIndex = process.argv.indexOf('--out');
const outFile = outIndex > 0 ? process.argv[outIndex + 1] : '.local/perf.json';
const PASSWORD = 'CredWiseDemo!360';
function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const folder = join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (!existsSync(folder)) return undefined;
  return readdirSync(folder).filter(n => n.startsWith('chromium_headless_shell-')).sort().reverse()
    .map(n => join(folder, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')).find(existsSync);
}
const pages = [
  ['Landing', null, '/'], ['Sign in', null, '/login'], ['Loan calculator', null, '/calculator'],
  ['Borrower dashboard', 'borrower@credwise.test', '/app'], ['Digital twin', 'borrower@credwise.test', '/app/twin'],
  ['Loan account', 'borrower@credwise.test', '/app/loans/1'], ['Admin overview', 'admin@credwise.test', '/admin'],
];
const browser = await chromium.launch({executablePath: chromiumPath()});
const rows = [];
for (const [name, email, path] of pages) {
  for (const profile of [{label: 'desktop', width: 1440, height: 900, cpu: 1}, {label: 'phone, 4x CPU slowdown', width: 390, height: 844, cpu: 4}]) {
    const runs = [];
    for (let i = 0; i < 3; i++) {
      const ctx = await browser.newContext({baseURL: base, viewport: {width: profile.width, height: profile.height}});
      if (email) await ctx.request.fetch('/api/auth/login', {method: 'POST', headers: {'X-CredWise-Action': '1', Origin: new URL(base).origin}, data: {email, password: PASSWORD}});
      const page = await ctx.newPage();
      const client = await ctx.newCDPSession(page);
      if (profile.cpu > 1) await client.send('Emulation.setCPUThrottlingRate', {rate: profile.cpu});
      await page.addInitScript(() => {
        window.__perf = {lcp: 0, cls: 0, longTasks: 0, longTaskTime: 0};
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__perf.lcp = e.startTime; }).observe({type: 'largest-contentful-paint', buffered: true});
        new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value; }).observe({type: 'layout-shift', buffered: true});
        new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__perf.longTasks++; window.__perf.longTaskTime += Math.max(0, e.duration - 50); } }).observe({type: 'longtask', buffered: true});
      });
      await page.goto(path, {waitUntil: 'networkidle'});
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const res = performance.getEntriesByType('resource');
        const bytes = e => e.encodedBodySize || 0;
        return {ttfb: nav.responseStart, fcp: fcp ? fcp.startTime : 0, lcp: window.__perf.lcp, cls: window.__perf.cls, tbt: window.__perf.longTaskTime, load: nav.loadEventEnd,
          js: res.filter(e => e.name.endsWith('.js')).reduce((t, e) => t + bytes(e), 0), total: res.reduce((t, e) => t + bytes(e), 0) + (nav.encodedBodySize || 0),
          requests: res.length + 1, api: res.filter(e => e.name.includes('/api/')).length};
      });
      runs.push({...m, jsKB: m.js / 1024, totalKB: m.total / 1024});
      await ctx.close();
    }
    const median = key => { const v = runs.map(r => r[key]).sort((a, b) => a - b); return v[1]; };
    rows.push({page: name, profile: profile.label, ttfb: median('ttfb'), fcp: median('fcp'), lcp: median('lcp'), cls: median('cls'), tbt: median('tbt'), jsKB: median('jsKB'), totalKB: median('totalKB'), requests: median('requests'), api: median('api')});
  }
}
await browser.close();
writeFileSync(outFile, JSON.stringify(rows, null, 1));
const f = (n, d = 0) => Number(n).toFixed(d);
console.log('Page'.padEnd(20), 'Profile'.padEnd(24), 'TTFB', 'FCP', 'LCP', 'CLS', 'TBT', 'JS KB', 'Total KB', 'Reqs', 'API');
for (const r of rows) console.log(r.page.padEnd(20), r.profile.padEnd(24), f(r.ttfb), f(r.fcp), f(r.lcp), f(r.cls, 3), f(r.tbt), f(r.jsKB), f(r.totalKB), r.requests, r.api);
