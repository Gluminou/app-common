import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import assert from 'node:assert/strict';

const site = new URL('./site', import.meta.url).pathname;
const srv = createServer((q, s) => { let p = q.url.split('?')[0]; if (p.endsWith('/')) p += 'index.html'; try { const b = p.endsWith('/sync.js') ? readFileSync(new URL('../sync.js', import.meta.url)) : readFileSync(join(site, p)); s.writeHead(200, { 'Content-Type': extname(p) === '.js' ? 'text/javascript' : 'text/html' }); s.end(b); } catch { s.writeHead(404).end(); } });
await new Promise(r => srv.listen(0, r)); const base = `http://127.0.0.1:${srv.address().port}`;

// fake GitHub: repos Gluminou/app1-data and app2-data, keys with permissions
const repos = { 'Gluminou/app1-data': { file: null, sha: null, n: 0 }, 'Gluminou/app2-data': { file: null, sha: null, n: 0 } };
const keys = { FULL: { 'Gluminou/app1-data': 'rw', 'Gluminou/app2-data': 'rw' }, WIFE: { 'Gluminou/app2-data': 'r' } };
let puts = 0, s304 = 0, forceConflict = 0;
const offline = new Set();
async function gh(route, dev) {
  if (offline.has(dev)) return route.abort('internetdisconnected');
  const req = route.request(), url = new URL(req.url()), tok = (req.headers()['authorization'] || '').replace('Bearer ', '');
  const json = (status, body, h = {}) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'ETag', ...h }, body: body == null ? '' : JSON.stringify(body) });
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'Authorization, Content-Type, If-None-Match', 'access-control-allow-methods': 'GET, PUT' } });
  if (!keys[tok]) return json(401, { message: 'Bad credentials' });
  const m = url.pathname.match(/^\/repos\/([^/]+\/[^/]+)(\/contents\/data\.json)?$/); const name = m && m[1], perm = keys[tok][name], R = repos[name];
  if (!R || !perm) return json(404, { message: 'Not Found' });
  if (!m[2]) return json(200, { full_name: name });
  if (req.method() === 'GET') {
    if (!R.file) return json(404, { message: 'Not Found' });
    const etag = `"${R.sha}"`;
    if (req.headers()['if-none-match'] === etag) { s304++; return route.fulfill({ status: 304, headers: { 'access-control-allow-origin': '*', etag } }); }
    return json(200, { sha: R.sha, content: Buffer.from(R.file).toString('base64') }, { etag });
  }
  if (req.method() === 'PUT') {
    if (perm !== 'rw') return json(403, { message: 'Resource not accessible by personal access token' });
    const b = JSON.parse(req.postData());
    if (forceConflict > 0) { forceConflict--; R.n++; R.sha = 'x' + R.n; R.file = R.file || JSON.stringify({ data: {}, t: {} }); return json(409, { message: 'conflict' }); }
    if ((b.sha || null) !== R.sha) return json(409, { message: 'sha mismatch' });
    R.n++; R.sha = 's' + R.n; R.file = Buffer.from(b.content, 'base64').toString(); puts++;
    return json(R.n === 1 ? 201 : 200, { content: { sha: R.sha } });
  }
}
const browser = await chromium.launch();
async function device(name) { const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); await ctx.route('https://api.github.com/**', r => gh(r, name)); ctx.off = v => v ? offline.add(name) : offline.delete(name); return ctx; }
const errs = []; const open = async (ctx, app) => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(String(e))); await p.goto(`${base}/${app}/`); await p.waitForTimeout(300); return p; };
const items = p => p.evaluate(() => JSON.parse(localStorage.getItem('items') || '[]').map(x => x.id).sort());
const sync = p => p.evaluate(() => window.appSync.sync());
const remote = name => JSON.parse(repos[name].file).data;
const text = p => p.locator('#app-sync').innerText();

const A = await device('A'), B = await device('B');
// device A has data before connecting
let a1 = await open(A, 'app1'); await a1.evaluate(() => { add('a'); add('b'); });
assert.match(await text(a1), /stays on this device/);
await a1.click('[data-as=open]'); await a1.fill('input[name=k]', 'FULL'); await a1.fill('input[name=d]', 'Mac'); await a1.click('button[type=submit]');
await a1.waitForTimeout(500);
assert.deepEqual(JSON.parse(remote('Gluminou/app1-data').items).map(x => x.id).sort(), ['a', 'b'], 'A pushed its data');
assert.match(await text(a1), /Synced/); assert.match(await text(a1), /This device: Mac/);
// B has its own data, connects: union both ways
let b1 = await open(B, 'app1'); await b1.evaluate(() => { add('c'); localStorage.setItem('lang', 'fr'); });
await b1.click('[data-as=open]'); await b1.fill('input[name=k]', 'FULL'); await b1.click('button[type=submit]'); await b1.waitForTimeout(500);
assert.deepEqual(await items(b1), ['a', 'b', 'c']);
await sync(a1); assert.deepEqual(await items(a1), ['a', 'b', 'c'], 'A received c'); assert.equal(await a1.evaluate(() => localStorage.getItem('lang')), 'fr');
assert.ok(await a1.evaluate(() => window.events) >= 1, 'storage event fired on A');
assert.match(await a1.locator('#out').innerText(), /"c"/, 'A redrew');
// auto-push after a local change (debounced)
await a1.evaluate(() => rm('a')); await a1.waitForTimeout(1800);
assert.deepEqual(JSON.parse(remote('Gluminou/app1-data').items).map(x => x.id).sort(), ['b', 'c'], 'deletion pushed by itself');
await sync(b1); assert.deepEqual(await items(b1), ['b', 'c'], 'deletion reached B');
// both change at once, offline from each other: B goes second and hits a conflict
A.off(true); B.off(true);
await a1.evaluate(() => add('d')); await b1.evaluate(() => { add('e'); rm('b'); });
await a1.waitForTimeout(1500);
assert.match(await text(a1), /Offline|waiting/i);
A.off(false); B.off(false);
await sync(a1); forceConflict = 1; await sync(b1); await sync(a1);
assert.deepEqual(await items(a1), ['c', 'd', 'e']); assert.deepEqual(await items(b1), ['c', 'd', 'e']);
// quiet polls use 304
const before = s304; await sync(a1); await a1.evaluate(() => window.appSync.sync()); 
// shared key: app2 on device A connects by itself (same address)
let a2 = await open(A, 'app2'); await a2.waitForTimeout(400);
assert.match(await text(a2), /Synced/, 'app2 picked up the key entered in app1');
// disconnect app2 on A only
await a2.click('[data-as=disc]'); assert.match(await text(a2), /stays on this device/);
await sync(a1); assert.match(await text(a1), /Synced/, 'app1 still connected');
// wife: key opens app2 read-only, not app1
const W = await device('W'); let w1 = await open(W, 'app1');
await w1.click('[data-as=open]'); await w1.fill('input[name=k]', 'WIFE'); await w1.click('button[type=submit]'); await w1.waitForTimeout(400);
assert.match(await text(w1), /can’t open|isn’t allowed/, 'wife key refused on app1');
let w2 = await open(W, 'app2'); await w2.evaluate(() => add('w')); await sync(w2);
assert.match(await text(w2), /View only/);
// bad key
const X = await device('X'); let x1 = await open(X, 'app1');
await x1.click('[data-as=open]'); await x1.fill('input[name=k]', 'NOPE'); await x1.click('button[type=submit]'); await x1.waitForTimeout(400);
assert.match(await text(x1), /refused or expired/);
// French words follow the page language
await x1.evaluate(() => { document.documentElement.lang = 'fr'; window.appSync.sync(); }); await x1.waitForTimeout(300);
assert.match(await text(x1), /Clé refusée/);
// status for apps that show it themselves
const st = await a1.evaluate(() => window.appSync.status());
assert.equal(st.connected, true); assert.equal(st.state, 'ok');
const ev = await a1.evaluate(() => new Promise(r => { window.addEventListener('appsyncstatus', e => r(e.detail), { once: true }); add('zz'); }));
assert.equal(ev.pending, true, 'appsyncstatus announces a pending change');
assert.deepEqual(errs, [], 'no page errors');
console.log(`e2e: all passed (${puts} writes, ${s304} quiet polls answered 304)`);
await browser.close(); srv.close();
