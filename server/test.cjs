/* node test.js — the board server against a real SQLite (node:sqlite, the
   same SQL dialect as D1), with Google and Apple stood in for: Google's
   token and player answers are faked, Apple's certificate and signature
   are made here with a key of our own. */
'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let fails = 0;
function ok(c, msg) { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; }

/* D1 over node:sqlite: prepare().bind().first()/all()/run() */
function d1(db) {
  return {
    prepare(sql) {
      let args = [];
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return db.prepare(sql).get(...args) || null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: r.changes } }; }
      };
      return st;
    }
  };
}

/* A self-signed certificate made of a fresh RSA key, in DER, built by hand
   so the test needs no openssl: only its SubjectPublicKeyInfo is read. */
function der(tag, body) {
  const n = body.length;
  const len = n < 128 ? Buffer.from([n]) : n < 256 ? Buffer.from([0x81, n]) : Buffer.from([0x82, n >> 8, n & 255]);
  return Buffer.concat([Buffer.from([tag]), len, body]);
}
function fakeCert(spki) {
  const seq = (...p) => der(0x30, Buffer.concat(p));
  const tbs = seq(der(0xa0, der(0x02, Buffer.from([2]))), der(0x02, Buffer.from([1])), seq(der(0x06, Buffer.from([42, 134, 72, 134, 247, 13, 1, 1, 11]))),
                  seq(), seq(der(0x17, Buffer.from('260101000000Z')), der(0x17, Buffer.from('300101000000Z'))), seq(), spki);
  return seq(tbs, seq(der(0x06, Buffer.from([42, 134, 72, 134, 247, 13, 1, 1, 11]))), der(0x03, Buffer.from([0, 1, 2])));
}

(async () => {
  const mod = await import(path.join(__dirname, 'src', 'index.js'));
  const W = mod.default;
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  const env = { DB: d1(db), TOKEN_KEY: 'test-key', GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', IOS_BUNDLE: 'com.veetalea.icedash' };

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const cert = fakeCert(publicKey.export({ type: 'spki', format: 'der' }));
  const realFetch = global.fetch;
  global.fetch = async (u, o) => {
    u = String(u);
    if (u === 'https://oauth2.googleapis.com/token') {
      const code = new URLSearchParams(o.body).get('code');
      if (code.startsWith('good')) return new Response(JSON.stringify({ access_token: 'at-' + code }));
      return new Response('{}', { status: 400 });
    }
    if (u === 'https://games.googleapis.com/games/v1/players/me') {
      const who = o.headers.authorization.slice('Bearer at-good-'.length);
      return new Response(JSON.stringify({ playerId: 'g' + who, displayName: 'Droid ' + who }));
    }
    if (u === 'https://static.gc.apple.com/public-key/gc-prod-10.cer') return new Response(cert);
    throw new Error('unexpected fetch ' + u);
  };

  let clock = Date.UTC(2026, 10, 23, 10, 0, 0);       // Monday 23 Nov 2026
  const realNow = Date.now;
  Date.now = () => clock;

  const H = { origin: 'https://localhost', 'content-type': 'application/json' };
  async function call(method, p, o, tok) {
    const h = Object.assign({}, H, tok ? { authorization: 'Bearer ' + tok } : {});
    const r = await W.fetch(new Request('https://board.test' + p, { method, headers: h, body: o ? JSON.stringify(o) : undefined }), env, {});
    let j = null;
    try { j = await r.json(); } catch (e) {}
    return { s: r.status, j, h: r.headers };
  }
  function gcProof(id, name, ts, bundle, tamper) {
    const salt = crypto.randomBytes(8);
    const t8 = Buffer.alloc(8); t8.writeBigUInt64BE(BigInt(ts));
    const sig = crypto.sign('sha256', Buffer.concat([Buffer.from(id), Buffer.from(bundle || 'com.veetalea.icedash'), t8, salt]), privateKey);
    return { plat: 'ios', id: tamper ? id + 'x' : id, bundle: bundle || 'com.veetalea.icedash', name,
             url: 'https://static.gc.apple.com/public-key/gc-prod-10.cer', sig: sig.toString('base64'), salt: salt.toString('base64'), ts };
  }

  console.log('\n--- auth ---');
  let a = await call('POST', '/v1/auth', { plat: 'android', code: 'good-1' });
  ok(a.s === 200 && a.j.token && a.j.k && a.j.name === 'Droid 1', 'Android: a good Play Games code gives a token and the player\'s name (' + JSON.stringify(a.j) + ')');
  ok(a.h.get('access-control-allow-origin') === 'https://localhost', 'with CORS for the app\'s page');
  const tA = a.j.token, kA = a.j.k;
  ok((await call('POST', '/v1/auth', { plat: 'android', code: 'bad' })).s === 401, 'a code Google refuses: 401');
  let i = await call('POST', '/v1/auth', gcProof('T:ios1', 'Pingu', clock));
  ok(i.s === 200 && i.j.token && i.j.name === 'Pingu', 'iPhone: a good Game Center signature gives a token');
  const tI = i.j.token, kI = i.j.k;
  ok((await call('POST', '/v1/auth', gcProof('T:ios2', 'X', clock, null, true))).s === 401, 'a signature for another player: 401');
  ok((await call('POST', '/v1/auth', gcProof('T:ios2', 'X', clock, 'com.other.app'))).s === 401, 'another app\'s bundle: 401');
  ok((await call('POST', '/v1/auth', gcProof('T:ios2', 'X', clock - 7 * 3600000))).s === 401, 'a signature seven hours old: 401');
  const evil = gcProof('T:ios2', 'X', clock); evil.url = 'https://evil.example.com/k.cer';
  ok((await call('POST', '/v1/auth', evil)).s === 401, 'a key that is not on apple.com: 401');
  ok((await call('POST', '/v1/score', { score: 10, dist: 10, secs: 5 })).s === 401, 'a score with no token: 401');
  ok((await call('POST', '/v1/score', { score: 10, dist: 10, secs: 5 }, tA + 'x')).s === 401, 'a token tampered with: 401');
  const nameRe = await call('POST', '/v1/auth', gcProof('T:ios3', 'Bad‮Name\u0000 that is far too long for a row', clock));
  ok(nameRe.j.name === 'BadName that is far too', 'names lose control and direction characters and stop at 24 (' + nameRe.j.name + ')');

  console.log('\n--- scores ---');
  let s = await call('POST', '/v1/score', { score: 5000, dist: 1200, secs: 60, card: 'abc123' }, tA);
  ok(s.s === 200 && s.j.taken && s.j.best === 5000, 'a Freeride run is taken (' + JSON.stringify(s.j) + ')');
  ok((await call('POST', '/v1/score', { score: 6000, dist: 1300, secs: 60 }, tA)).s === 429, 'another a second later: too soon');
  clock += 5000;
  ok((await call('POST', '/v1/score', { score: 900000, dist: 1000, secs: 60 }, tA)).s === 422, 'more points than the metres can give: refused');
  ok((await call('POST', '/v1/score', { score: 9000, dist: 9000, secs: 10 }, tA)).s === 422, 'more metres than the seconds allow: refused');
  ok((await call('POST', '/v1/score', { score: -5, dist: 10, secs: 5 }, tA)).s === 400, 'a negative score: 400');
  s = await call('POST', '/v1/score', { score: 3000, dist: 900, secs: 50 }, tA);
  ok(s.s === 200 && s.j.best === 5000, 'a lower run is taken, the best stays');
  clock += 5000;
  s = await call('POST', '/v1/score', { score: 7000, kind: 'best' }, tI);
  ok(s.s === 200 && s.j.taken && s.j.best === 7000, 'iPhone: the save\'s old best comes in once');
  s = await call('POST', '/v1/score', { score: 9999, kind: 'best' }, tI);
  ok(s.s === 200 && !s.j.taken && s.j.best === 7000, 'and only once');
  s = await call('POST', '/v1/score', { score: 2000, dist: 800, secs: 40, card: 'zz9' }, tI);
  ok(s.s === 200, 'then an iPhone run');

  console.log('\n--- the board ---');
  let t = await call('GET', '/v1/top?span=all');
  ok(t.s === 200 && t.j.rows.length === 2 && t.j.rows[0].score === 7000 && t.j.rows[0].plat === 'ios' && t.j.rows[1].plat === 'android',
     'all time: both phones on one board, the best first (' + JSON.stringify(t.j.rows.map((r) => r.plat + ':' + r.score)) + ')');
  ok(t.j.rows[0].k === kI && t.j.rows[1].k === kA && !JSON.stringify(t.j).includes('ios1'), 'each row has its key, and no player id');
  ok(t.j.rows[1].card === 'abc123' && t.j.rows[0].card === 'zz9', 'and the card');
  t = await call('GET', '/v1/top?span=day');
  ok(t.j.rows.length === 2 && t.j.rows[0].score === 5000 && t.j.rows[1].score === 2000,
     'today: the old best is not a run of today, only the runs are (' + JSON.stringify(t.j.rows.map((r) => r.score)) + ')');
  ok((await call('GET', '/v1/top?span=year')).s === 400, 'an unknown span: 400');
  let me = await call('GET', '/v1/me', null, tA);
  ok(me.j.all.rank === 2 && me.j.all.score === 5000 && me.j.day.rank === 1 && me.j.week.rank === 1 && me.j.k === kA,
     'my places: 2nd of all time, 1st today and this week (' + JSON.stringify(me.j) + ')');

  clock += 86400000;                                   // Tuesday
  t = await call('GET', '/v1/top?span=day');
  ok(t.j.rows.length === 0, 'the next day starts empty');
  t = await call('GET', '/v1/top?span=week');
  ok(t.j.rows.length === 2, 'the week goes on');
  s = await call('POST', '/v1/score', { score: 1000, dist: 400, secs: 30 }, tA);
  me = await call('GET', '/v1/me', null, tA);
  ok(me.j.day.score === 1000 && me.j.week.score === 5000 && me.j.all.score === 5000, 'a new day\'s run starts the day again, the week keeps its best');
  clock += 6 * 86400000;                               // next Monday
  me = await call('GET', '/v1/me', null, tA);
  ok(me.j.week === null && me.j.day === null && me.j.all.rank === 2, 'a new week: no place this week until a run');

  console.log('\n--- cards ---');
  clock += 5000;
  ok((await call('POST', '/v1/card', { card: 'NEW42' }, tA)).s === 200, 'a new card goes up');
  ok((await call('POST', '/v1/card', { card: 'bad card!' }, tA)).s === 400, 'nonsense is refused');
  let c = await call('GET', '/v1/cards');
  ok(c.j.rows[0].card === 'new42' && c.j.rows[0].k === kA, 'the newest card comes first');

  console.log('\n--- forget ---');
  ok((await call('DELETE', '/v1/me', null, tI)).s === 200, 'a player can be removed');
  t = await call('GET', '/v1/top?span=all');
  ok(t.j.rows.length === 1 && t.j.rows[0].plat === 'android', 'and is gone from the board');
  ok((await call('POST', '/v1/score', { score: 100, dist: 100, secs: 20 }, tI)).s === 401, 'their token no longer scores');

  console.log('\n--- small things ---');
  ok(mod.weekOf(Date.UTC(2026, 10, 29, 23, 0)) === '2026-11-23' && mod.weekOf(Date.UTC(2026, 10, 30, 0, 1)) === '2026-11-30', 'the week starts on Monday, UTC');
  const tok = await mod.signToken({ p: 'a:x', e: clock - 1 }, 'k');
  ok((await mod.readToken(tok, 'k')) === null, 'an expired token is no token');
  ok((await call('OPTIONS', '/v1/score')).s === 204, 'the CORS question is answered');
  const other = await W.fetch(new Request('https://board.test/v1/top', { headers: { origin: 'https://evil.example.com' } }), env, {});
  ok(!other.headers.get('access-control-allow-origin'), 'and only for the app\'s own pages');

  Date.now = realNow; global.fetch = realFetch;
  console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\nboard server checks passed');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
