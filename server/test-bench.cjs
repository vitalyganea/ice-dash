/* node test-bench.cjs — the performance-test server (src/bench.js) against
   a real SQLite (node:sqlite, D1's dialect), and kept apart from the board */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs'), path = require('path');
let fails = 0;
function ok(c, msg) { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; }
function d1(db) {
  return { prepare(sql) { let args = []; const st = {
    bind(...a) { args = a; return st; },
    async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes, last_row_id: Number(r.lastInsertRowid) } }; } }; return st; } };
}
(async () => {
  const W = (await import(path.join(__dirname, 'src', 'bench.js'))).default;
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, 'bench-schema.sql'), 'utf8'));
  const env = { DB: d1(db) };
  const post = (body, origin) => W.fetch(new Request('https://bench.test/v1/bench', { method: 'POST',
    headers: { origin: origin || 'https://vitalyganea.github.io', 'content-type': 'application/json' }, body }), env);
  const rep = { v: 1, hz: 120, fps: 118.6, p95: 9.2, late: 1.4, m: 2000, secs: 70,
    device: { gpu: 'Adreno (TM) 610', screen: '412x915', dpr: 2.6, ua: 'Mozilla/5.0' },
    tags: [{ tag: 'bridge:under', frames: 300, ms: 9, late: 3 }], timeline: [[10, 200, 119, 1, 20, 60, '0/1/1', 'Glacier']] };
  const r1 = await post(JSON.stringify(rep)), j1 = await r1.json();
  ok(r1.status === 200 && j1.id === 1 && r1.headers.get('access-control-allow-origin') === 'https://vitalyganea.github.io', 'a report from test.html is taken, no. ' + j1.id);
  const row = db.prepare('SELECT * FROM bench WHERE id = 1').get();
  ok(row.hz === 120 && Math.abs(row.fps - 118.6) < 1e-9 && /Adreno/.test(row.dev) && JSON.parse(row.data).tags[0].tag === 'bridge:under', 'kept whole, its summary in columns');
  ok((await (await post(JSON.stringify(rep))).json()).id === 2, 'the next one is no. 2');
  ok(/^[0-9a-f]{24}$/.test(j1.key || ''), 'with a key for the page to send it again');
  const upd = (id, k, body) => W.fetch(new Request('https://bench.test/v1/bench/' + id + '?k=' + k, { method: 'POST',
    headers: { origin: 'https://vitalyganea.github.io', 'content-type': 'text/plain' }, body }), env);
  const later = Object.assign({}, rep, { m: 6000, state: 'running', fps: 90 });
  const u1 = await upd(1, j1.key, JSON.stringify(later));
  ok(u1.status === 200 && db.prepare('SELECT m, state, fps FROM bench WHERE id = 1').get().m === 6000, 'sent again, it is the report as it stands now');
  ok((await upd(1, 'f'.repeat(24), JSON.stringify(later))).status === 404 && (await upd(1, 'x', JSON.stringify(later))).status === 403, 'not with another key');
  await upd(1, j1.key, JSON.stringify(Object.assign({}, later, { state: 'done', m: 9000 })));
  ok(db.prepare('SELECT state, m FROM bench WHERE id = 1').get().state === 'done', 'its last word: done');
  ok((await upd(1, j1.key, JSON.stringify(Object.assign({}, later, { state: 'closed early', m: 1 })))).status === 404 && db.prepare('SELECT m FROM bench WHERE id = 1').get().m === 9000, 'and a done report stays as it ended (a late beacon changes nothing)');
  ok((await post(JSON.stringify({ v: 2 }))).status === 400, 'anything but a report is refused');
  ok((await post('{"v":1,"pad":"' + 'x'.repeat(70000) + '"}')).status === 413, 'and a too big one');
  ok((await post('nope')).status === 400, 'and nonsense');
  ok(!(await post(JSON.stringify(rep), 'https://evil.example.com')).headers.get('access-control-allow-origin'), 'other sites get no CORS answer');
  ok((await W.fetch(new Request('https://bench.test/v1/top'), env)).status === 404, 'and it has no board routes at all');
  const src = fs.readFileSync(path.join(__dirname, 'src', 'index.js'), 'utf8'), sch = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  ok(!/bench/i.test(src) && !/bench/i.test(sch), 'the board server and its database know nothing of it');
  console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\nbench server checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
