// A locked app: key card first, content only from the private repo, reload when content changes.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const site = new URL('./site', import.meta.url).pathname;
const srv = createServer((q, s) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; try { const b = p.endsWith('/sync.js') ? readFileSync(new URL('../sync.js', import.meta.url)) : readFileSync(join(site, p)); s.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8' }); s.end(b); } catch { s.writeHead(404).end(); } });
await new Promise(r => srv.listen(0, r)); const base = `http://127.0.0.1:${srv.address().port}`;
const file = c => JSON.stringify({ v: 1, data: { 'app3-content': JSON.stringify(c) }, t: { 'app3-content': Date.now() } });
const R = { file: file({ secret: 'the schedule' }), sha: 's1', n: 1 };
const keys = { GOOD: 'rw', VIEW: 'r' };
async function gh(route) {
  const req = route.request(), url = new URL(req.url()), tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
  const json = (st, b, h = {}) => route.fulfill({ status: st, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ...h }, body: b == null ? '' : JSON.stringify(b) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type, If-None-Match', 'access-control-allow-methods': 'GET, PUT' } });
  if (!keys[tok]) return json(401, {});
  if (!/app3-data/.test(url.pathname)) return json(404, {});
  if (!url.pathname.endsWith('data.json')) return json(200, {});
  if (req.method() === 'GET') { const et = `"${R.sha}"`; if (req.headers()['if-none-match'] === et) return route.fulfill({ status: 304, headers: { 'access-control-allow-origin': '*', etag: et } }); return json(200, { sha: R.sha, content: Buffer.from(R.file).toString('base64') }, { etag: et }); }
  if (keys[tok] !== 'rw') return json(403, {});
  const b = JSON.parse(req.postData()); if (b.sha !== R.sha) return json(409, {});
  R.n++; R.sha = 's' + R.n; R.file = Buffer.from(b.content, 'base64').toString(); return json(200, { content: { sha: R.sha } });
}
const browser = await chromium.launch(); const errs = [];
const ctx = await browser.newContext(); await ctx.route('https://api.github.com/**', gh);
const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e)));
await p.goto(base + '/app3/'); await p.waitForTimeout(300);
const card = p.locator('.as-lock');
assert.equal(await card.isVisible(), true, 'key card shown without a key');
assert.match(await card.innerText(), /This app needs a key/); assert.match(await card.innerText(), /LOCKED APP/i);
assert.equal(await p.locator('#out').innerText(), '', 'no content without a key');
// wrong key: stays locked, says why
await p.fill('.as-lock input[name=k]', 'WRONG'); await p.click('.as-lock button[type=submit]'); await p.waitForTimeout(400);
assert.equal(await card.isVisible(), true); assert.match(await card.innerText(), /refused or expired/);
// right key: content arrives, page reloads with it, card gone
await p.fill('.as-lock input[name=k]', 'GOOD'); await p.click('.as-lock button[type=submit]'); await p.waitForTimeout(1200);
assert.equal(await card.isVisible(), false, 'unlocked'); assert.equal(await p.locator('#out').innerText(), 'the schedule');
// Claude updates the content: the open page reloads with the new one
R.n++; R.sha = 's' + R.n; R.file = file({ secret: 'new schedule' });
await p.evaluate(() => window.appSync.sync()); await p.waitForTimeout(1000);
assert.equal(await p.locator('#out').innerText(), 'new schedule', 'content update reached the open page');
// works offline once opened
await ctx.route('https://api.github.com/**', r => r.abort()); await p.reload(); await p.waitForTimeout(500);
assert.equal(await card.isVisible(), false, 'opens offline once it has its content');
await ctx.unroute('https://api.github.com/**'); await ctx.route('https://api.github.com/**', gh);
// key deleted on GitHub: locks again
delete keys.GOOD; await p.evaluate(() => window.appSync.sync()); await p.waitForTimeout(500);
assert.equal(await card.isVisible(), true, 'revoked key locks the app'); keys.GOOD = 'rw';
// disconnect removes the content from the device
await p.evaluate(() => localStorage.setItem('gsync.key.app3', 'GOOD')); await p.evaluate(() => window.appSync.sync()); await p.waitForTimeout(600);
await p.click('#app-sync [data-as=disc]'); await p.waitForTimeout(600);
assert.equal(await p.evaluate(() => localStorage.getItem('app3-content')), null, 'content removed on disconnect');
assert.equal(await card.isVisible(), true);
// French
await p.evaluate(() => { document.documentElement.lang = 'fr'; window.appSync.sync(); }); await p.waitForTimeout(200);
assert.match(await card.innerText(), /Cette app demande une clé/);
await p.screenshot({ path: '/tmp/lock.png' });
assert.deepEqual(errs, []); console.log('lock: all passed');
await browser.close(); srv.close();
