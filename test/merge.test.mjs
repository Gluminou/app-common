import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
globalThis.window = globalThis; globalThis.APP_SYNC = { app: 't', testOnly: true };
globalThis.localStorage = { getItem(){ return null; } }; globalThis.Storage = function(){}; Storage.prototype = { getItem(){}, setItem(){}, removeItem(){} };
eval(readFileSync(new URL('../sync.js', import.meta.url), 'utf8'));
const { merge3, mergeStore } = window.appSyncMerge;
const J = JSON.stringify;
// job-tracker shaped state
const base = { applications: [{ id: 'a', stage: 'lead', log: [{ id: 'e1', text: 'x' }] }, { id: 'b', stage: 'lead', log: [] }], contacts: [], lastExport: '' };
const loc = structuredClone(base); loc.applications[0].stage = 'applied'; loc.applications.push({ id: 'c', stage: 'lead', log: [] });
const rem = structuredClone(base); rem.applications = rem.applications.filter(a => a.id !== 'b'); rem.applications[0].log.push({ id: 'e2', text: 'y' }); rem.contacts.push({ id: 'k1', name: 'Ann' });
let m = merge3(base, loc, rem, true);
assert.deepEqual(m.applications.map(a => a.id).sort(), ['a', 'c'], 'b deleted remotely, c added locally');
assert.equal(m.applications.find(a => a.id === 'a').stage, 'applied');
assert.deepEqual(m.applications.find(a => a.id === 'a').log.map(e => e.id), ['e1', 'e2']);
assert.equal(m.contacts.length, 1);
// first connect: no base, union
m = merge3(undefined, { applications: [{ id: 'a', v: 1 }] }, { applications: [{ id: 'b', v: 2 }] }, false);
assert.deepEqual(m.applications.map(a => a.id).sort(), ['a', 'b']);
// basket as set
assert.deepEqual(merge3(['x', 'y'], ['x', 'y', 'z'], ['y'], true).sort(), ['y', 'z'], 'x removed there, z added here');
// modification beats deletion
m = merge3([{ id: 1, n: 'a' }], [], [{ id: 1, n: 'b' }], true);
assert.deepEqual(m, [{ id: 1, n: 'b' }]);
// both changed a scalar: latest wins
assert.equal(merge3(1, 2, 3, true), 2); assert.equal(merge3(1, 2, 3, false), 3);
// store level
let s = mergeStore({ lang: 'fr', 'ck-1': '1' }, { lang: 'en', 'ck-1': '1', 'ck-2': '1' }, { lang: 'fr' }, { lang: 5 }, {});
assert.deepEqual(s.data, { lang: 'en', 'ck-2': '1' }, 'ck-1 deleted remotely, ck-2 added here, lang changed here');
s = mergeStore({ q: J({ a: 1 }) }, { q: J({ a: 1, b: 2 }) }, { q: J({ a: 5 }) }, { q: 1 }, { q: 2 });
assert.deepEqual(JSON.parse(s.data.q), { a: 5, b: 2 });
s = mergeStore({}, { k: 'L' }, { k: 'R' }, { k: 0 }, { k: 9 });
assert.equal(s.data.k, 'R', 'first connect, unknown local time: remote wins for plain values');
console.log('merge tests: all passed');
