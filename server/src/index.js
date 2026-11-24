/* ===========================================================
   Ice Dasher's board server (1.3.5) — Cloudflare Workers + D1
   -----------------------------------------------------------
   Asked for by the owner, 22 Nov 2026: one Freeride board for Android and
   iPhone together. Google Play Games and Game Center cannot show each
   other's players, so the board lives here. The game's own panel already
   draws the rows (ui.js); only where they come from changes (native.js).

   Who sends a score is proven once, at /v1/auth:
     - Android: a Play Games server auth code (requestServerSideAccess),
       exchanged with Google for the player's id and name;
     - iPhone: Game Center's identity signature (fetchItems(for
       IdentityVerificationSignature:)), checked against Apple's own key.
   The answer is a token of ours (30 days), sent with every score after.

   Routes (JSON; CORS for the apps' own pages):
     POST   /v1/auth   {plat:'android', code} | {plat:'ios', id, bundle, url, sig, salt, ts, name}
                       -> {token, k, name}
     POST   /v1/score  {score, dist, secs, card?}  a Freeride run
                       {score, kind:'best', card?} the save's old best, once
     POST   /v1/card   {card}                      the profile card as it is now
     GET    /v1/top?span=all|day|week -> {span, rows:[{rank, name, score, card, plat, k}]}
     GET    /v1/me     -> {all:{rank,score}, day:{...}, week:{...}}
     GET    /v1/cards  -> {rows:[{name, card, plat, k}]} the hundred newest cards
     DELETE /v1/me     the player's row is removed
   A cheat is dealt with from the owner's own machine, never over the web:
   admin.mjs runs SQL on the database through wrangler (ban, unban, reset).
   A banned player is off every board and the cards, and a score of theirs
   is answered as if taken, so the app does not keep sending it.
   k is a short keyed hash of the player's id: the app finds its own row
   with it, and nobody learns the id.
   =========================================================== */

const TOP_N = 100;
const TOKEN_MS = 30 * 86400000;
const MIN_GAP_MS = 3000;            // a run takes longer than this
const MAX_SCORE = 5000000;          // nothing near it has been seen
const TOP_CACHE_S = 30;
/* A run's score against its length, from the game's own numbers
   (js/game.js): the slide pays a quarter of the speed each frame, which
   is 2 points a metre, and a metre's pickups never come near 30 more;
   SPEED_MAX 6.4 units a frame, 8 units a metre, is 48 m/s at 60 frames. */
const SCORE_PER_M = 32, SCORE_FREE = 3000, MAX_MPS = 60;

const ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost', 'ionic://localhost'];

export default {
  async fetch(req, env, ctx) {
    const cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const res = await route(req, env, ctx);
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v);
      return res;
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e && e.stack || e);
      return json({ error: e instanceof HttpError ? e.message : 'server error' }, status, cors);
    }
  }
};

async function route(req, env, ctx) {
  const url = new URL(req.url), p = url.pathname, m = req.method;
  if (p === '/v1/health') return json({ ok: true });
  if (p === '/v1/auth' && m === 'POST') return auth(req, env);
  if (p === '/v1/top' && m === 'GET') return top(req, env, ctx, url.searchParams.get('span') || 'all');
  if (p === '/v1/cards' && m === 'GET') return cards(req, env, ctx);
  if (p === '/v1/score' && m === 'POST') return score(req, env, await who(req, env));
  if (p === '/v1/card' && m === 'POST') return card(req, env, await who(req, env));
  if (p === '/v1/me' && m === 'GET') return mine(env, await who(req, env));
  if (p === '/v1/me' && m === 'DELETE') return forget(env, await who(req, env));
  throw new HttpError(404, 'no such route');
}

/* ---------------- auth ---------------- */

async function auth(req, env) {
  if (env.AUTH_RL) {
    const ip = req.headers.get('cf-connecting-ip') || 'x';
    const { success } = await env.AUTH_RL.limit({ key: ip });
    if (!success) throw new HttpError(429, 'too many');
  }
  const b = await body(req);
  let id, name, plat;
  if (b.plat === 'android') {
    const g = await googlePlayer(String(b.code || ''), env);
    id = 'a:' + g.playerId; name = g.displayName; plat = 'android';
  } else if (b.plat === 'ios') {
    await verifyGameCenter(b, env);
    id = 'i:' + b.id; name = b.name; plat = 'ios';
  } else throw new HttpError(400, 'plat');
  name = cleanName(name);
  const now = Date.now();
  await env.DB.prepare(
    'INSERT INTO players (id, plat, name, created) VALUES (?1, ?2, ?3, ?4) ' +
    'ON CONFLICT (id) DO UPDATE SET name = CASE WHEN ?3 <> \'\' THEN ?3 ELSE name END, plat = ?2'
  ).bind(id, plat, name, now).run();
  const token = await signToken({ p: id, e: now + TOKEN_MS }, env.TOKEN_KEY);
  return json({ token, k: await keyOf(id, env), name });
}

async function googlePlayer(code, env) {
  if (!code) throw new HttpError(400, 'code');
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) throw new HttpError(503, 'android not set up');
  const t = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET,
                                redirect_uri: '', grant_type: 'authorization_code' })
  });
  if (!t.ok) throw new HttpError(401, 'google refused the code');
  const tok = await t.json();
  const me = await fetch('https://games.googleapis.com/games/v1/players/me', {
    headers: { authorization: 'Bearer ' + tok.access_token }
  });
  if (!me.ok) throw new HttpError(401, 'google gave no player');
  const pl = await me.json();
  if (!pl.playerId) throw new HttpError(401, 'google gave no player');
  return { playerId: String(pl.playerId), displayName: pl.displayName || '' };
}

/* Game Center: the signature is over the team player id, the bundle id,
   the timestamp (8 bytes, big-endian) and the salt, made with the key in
   the certificate at publicKeyURL, which must be Apple's own. */
async function verifyGameCenter(b, env) {
  const id = String(b.id || ''), bundle = String(b.bundle || '');
  if (!id || id.length > 100) throw new HttpError(400, 'id');
  if (bundle !== (env.IOS_BUNDLE || 'com.veetalea.icedash')) throw new HttpError(401, 'bundle');
  let url;
  try { url = new URL(String(b.url || '')); } catch (e) { throw new HttpError(400, 'url'); }
  if (url.protocol !== 'https:' || !(url.hostname === 'apple.com' || url.hostname.endsWith('.apple.com')))
    throw new HttpError(401, 'not an apple key');
  const ts = Number(b.ts);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > 6 * 3600000) throw new HttpError(401, 'stale');
  const der = await appleCert(url.href);
  const key = await crypto.subtle.importKey('spki', spkiOf(der), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ts8 = new Uint8Array(8);
  new DataView(ts8.buffer).setBigUint64(0, BigInt(Math.round(ts)));
  const data = concat([utf8(id), utf8(bundle), ts8, unb64(String(b.salt || ''))]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64(String(b.sig || '')), data);
  if (!ok) throw new HttpError(401, 'signature');
}

const certs = new Map();
async function appleCert(href) {
  if (certs.has(href)) return certs.get(href);
  const r = await fetch(href, { cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!r.ok) throw new HttpError(502, 'apple key unreachable');
  const der = new Uint8Array(await r.arrayBuffer());
  certs.set(href, der);
  return der;
}

/* The SubjectPublicKeyInfo out of an X.509 certificate (DER): the seventh
   field of tbsCertificate once the optional [0] version is stepped over. */
function derAt(buf, off) {
  const tag = buf[off];
  let len = buf[off + 1], p = off + 2;
  if (len & 0x80) {
    const n = len & 0x7f; len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[p++];
  }
  if (p + len > buf.length) throw new HttpError(502, 'bad certificate');
  return { tag, hdr: off, start: p, end: p + len };
}
export function spkiOf(buf) {
  const cert = derAt(buf, 0), tbs = derAt(buf, cert.start);
  let p = tbs.start, it = derAt(buf, p);
  if (it.tag === 0xa0) p = it.end;                       // [0] version
  for (let i = 0; i < 5; i++) p = derAt(buf, p).end;     // serial, algorithm, issuer, validity, subject
  it = derAt(buf, p);
  if (it.tag !== 0x30) throw new HttpError(502, 'bad certificate');
  return buf.slice(it.hdr, it.end);
}

/* ---------------- tokens ---------------- */

async function hmac(secret) {
  if (!secret) throw new HttpError(503, 'not set up');
  return crypto.subtle.importKey('raw', utf8(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signToken(o, secret) {
  const p = b64u(utf8(JSON.stringify(o)));
  const s = await crypto.subtle.sign('HMAC', await hmac(secret), utf8(p));
  return p + '.' + b64u(new Uint8Array(s));
}
export async function readToken(t, secret) {
  const [p, s] = String(t || '').split('.');
  if (!p || !s) return null;
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmac(secret), unb64(s), utf8(p)); } catch (e) { return null; }
  if (!ok) return null;
  let o;
  try { o = JSON.parse(new TextDecoder().decode(unb64(p))); } catch (e) { return null; }
  return o && o.p && o.e > Date.now() ? o : null;
}
async function who(req, env) {
  const h = req.headers.get('authorization') || '';
  const o = await readToken(h.replace(/^Bearer\s+/i, ''), env.TOKEN_KEY);
  if (!o) throw new HttpError(401, 'token');
  return o.p;
}
async function keyOf(id, env) {
  const s = await crypto.subtle.sign('HMAC', await hmac(env.TOKEN_KEY), utf8('k:' + id));
  return b64u(new Uint8Array(s)).slice(0, 12);
}

/* ---------------- scores ---------------- */

export function dayOf(ms) { return new Date(ms).toISOString().slice(0, 10); }
export function weekOf(ms) {
  const d = new Date(ms), back = (d.getUTCDay() + 6) % 7;      // days since Monday
  return dayOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}

async function score(req, env, id) {
  const b = await body(req);
  const n = Math.floor(Number(b.score));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SCORE) throw new HttpError(400, 'score');
  const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?1').bind(id).first();
  if (!row) throw new HttpError(401, 'no player');
  const now = Date.now(), cd = cleanCard(b.card);
  if (row.banned) return json({ ok: true, taken: false, best: row.best });
  if (b.kind === 'best') {
    /* the best kept in the save from before this board, once a player */
    if (row.imported) return json({ ok: true, taken: false, best: row.best });
    await env.DB.prepare(
      'UPDATE players SET best = MAX(best, ?2), best_t = CASE WHEN ?2 > best THEN ?3 ELSE best_t END, imported = 1, ' +
      'card = CASE WHEN ?4 <> \'\' THEN ?4 ELSE card END, card_t = CASE WHEN ?4 <> \'\' AND ?4 <> card THEN ?3 ELSE card_t END WHERE id = ?1'
    ).bind(id, n, now, cd).run();
    return json({ ok: true, taken: true, best: Math.max(row.best, n) });
  }
  const dist = Math.floor(Number(b.dist)), secs = Number(b.secs);
  if (!Number.isFinite(dist) || dist < 0 || !Number.isFinite(secs) || secs <= 0) throw new HttpError(400, 'run');
  if (n > SCORE_PER_M * dist + SCORE_FREE || dist > MAX_MPS * secs + 50) throw new HttpError(422, 'not a run');
  if (now - row.last_t < MIN_GAP_MS) throw new HttpError(429, 'too soon');
  const day = dayOf(now), week = weekOf(now);
  await env.DB.prepare(
    'UPDATE players SET ' +
    'best = MAX(best, ?2), best_t = CASE WHEN ?2 > best THEN ?3 ELSE best_t END, ' +
    'day_best = CASE WHEN day = ?4 THEN MAX(day_best, ?2) ELSE ?2 END, day = ?4, ' +
    'week_best = CASE WHEN week = ?5 THEN MAX(week_best, ?2) ELSE ?2 END, week = ?5, last_t = ?3, ' +
    'card = CASE WHEN ?6 <> \'\' THEN ?6 ELSE card END, card_t = CASE WHEN ?6 <> \'\' AND ?6 <> card THEN ?3 ELSE card_t END ' +
    'WHERE id = ?1'
  ).bind(id, n, now, day, week, cd).run();
  return json({ ok: true, taken: true, best: Math.max(row.best, n) });
}

async function card(req, env, id) {
  const b = await body(req), cd = cleanCard(b.card);
  if (!cd) throw new HttpError(400, 'card');
  const r = await env.DB.prepare('UPDATE players SET card = ?2, card_t = ?3 WHERE id = ?1').bind(id, cd, Date.now()).run();
  if (!r.meta || !r.meta.changes) throw new HttpError(401, 'no player');
  return json({ ok: true });
}

function spanSql(span, now) {
  if (span === 'day') return { col: 'day_best', where: 'day = ?1 AND day_best > 0 AND banned = 0', arg: dayOf(now) };
  if (span === 'week') return { col: 'week_best', where: 'week = ?1 AND week_best > 0 AND banned = 0', arg: weekOf(now) };
  if (span === 'all') return { col: 'best', where: 'best > 0 AND banned = 0 AND ?1 = ?1', arg: '' };
  throw new HttpError(400, 'span');
}

async function cached(req, ctx, make) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request(new URL(req.url).toString(), { method: 'GET' });
  if (cache) { const hit = await cache.match(key); if (hit) return new Response(hit.body, hit); }
  const res = await make();
  res.headers.set('cache-control', 'public, max-age=' + TOP_CACHE_S);
  if (cache && ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function top(req, env, ctx, span) {
  const s = spanSql(span, Date.now());
  return cached(req, ctx, async () => {
    const r = await env.DB.prepare(
      'SELECT id, plat, name, card, ' + s.col + ' AS score FROM players WHERE ' + s.where +
      ' ORDER BY ' + s.col + ' DESC, best_t ASC LIMIT ' + TOP_N
    ).bind(s.arg).all();
    const rows = [];
    for (const [i, x] of (r.results || []).entries())
      rows.push({ rank: i + 1, name: x.name, score: x.score, card: x.card, plat: x.plat, k: await keyOf(x.id, env) });
    return json({ span, rows });
  });
}

async function cards(req, env, ctx) {
  return cached(req, ctx, async () => {
    const r = await env.DB.prepare(
      'SELECT id, plat, name, card FROM players WHERE card <> \'\' AND banned = 0 ORDER BY card_t DESC LIMIT ' + TOP_N
    ).all();
    const rows = [];
    for (const x of r.results || []) rows.push({ name: x.name, card: x.card, plat: x.plat, k: await keyOf(x.id, env) });
    return json({ rows });
  });
}

async function mine(env, id) {
  const row = await env.DB.prepare('SELECT * FROM players WHERE id = ?1').bind(id).first();
  if (!row) throw new HttpError(401, 'no player');
  const now = Date.now(), out = {};
  for (const span of ['all', 'day', 'week']) {
    const s = spanSql(span, now);
    if (row.banned) { out[span] = null; continue; }
    const mineScore = span === 'all' ? row.best : (row[span] === s.arg ? row[s.col] : 0);
    if (!mineScore) { out[span] = null; continue; }
    const c = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM players WHERE ' + s.where + ' AND (' + s.col + ' > ?2 OR (' + s.col + ' = ?2 AND best_t < ?3))'
    ).bind(s.arg, mineScore, row.best_t).first();
    out[span] = { rank: (c ? c.n : 0) + 1, score: mineScore };
  }
  out.k = await keyOf(id, env);
  return json(out);
}

async function forget(env, id) {
  await env.DB.prepare('DELETE FROM players WHERE id = ?1').bind(id).run();
  return json({ ok: true });
}

/* ---------------- small things ---------------- */

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function corsFor(req) {
  const o = req.headers.get('origin') || '';
  if (ORIGINS.indexOf(o) < 0) return {};
  return { 'access-control-allow-origin': o, 'access-control-allow-methods': 'GET, POST, DELETE',
           'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400', vary: 'origin' };
}
function json(o, status, extra) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, extra || {}) });
}
async function body(req) {
  const t = await req.text();
  if (t.length > 4096) throw new HttpError(413, 'too big');
  try { const o = JSON.parse(t || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { throw new HttpError(400, 'json'); }
}
export function cleanName(s) {
  return String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').trim().slice(0, 24).trim();
}
function cleanCard(c) {
  const s = String(c == null ? '' : c).toLowerCase();
  return /^[0-9a-z]{1,16}$/.test(s) ? s : '';
}
const utf8 = (s) => new TextEncoder().encode(s);
function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function b64u(bytes) {
  let s = '';
  for (const x of bytes) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
