/* ===========================================================
   Ice Dasher's performance-test server (24 Nov 2026)
   -----------------------------------------------------------
   test.html (js/bench.js) sends its report here by itself at the end of a
   test. Apart from the leaderboard on purpose (the owner): its own Worker
   (bench.icedasher.workers.dev) and its own D1 (icedasher-bench).

   Routes:
     POST /v1/bench            a new report (JSON, v: 1, up to 64 KB) -> {ok, id, key}
     POST /v1/bench/<id>?k=<key>  the same report again, as it stands now
                               (every 30 s, on the page being hidden or
                               closed by beacon, and at the end) -> {ok}
     GET  /v1/health
   Bodies come as text/plain, so a beacon needs no preflight.
   Reading them is not a route: server/admin.mjs bench | bench-show <no>,
   from the owner's machine, through wrangler.
   =========================================================== */

const MAX = 65536;
const ORIGINS = ['https://vitalyganea.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

export default {
  async fetch(req, env) {
    const cors = corsFor(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      const url = new URL(req.url);
      if (url.pathname === '/v1/health') return json({ ok: true }, 200, cors);
      if (url.pathname === '/v1/bench' && req.method === 'POST') return json(await take(req, env), 200, cors);
      const mm = /^\/v1\/bench\/(\d+)$/.exec(url.pathname);
      if (mm && req.method === 'POST') return json(await again(req, env, Number(mm[1]), url.searchParams.get('k') || ''), 200, cors);
      return json({ error: 'no such route' }, 404, cors);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e && e.stack || e);
      return json({ error: e instanceof HttpError ? e.message : 'server error' }, status, cors);
    }
  }
};

async function limited(req, env) {
  if (env.BENCH_RL) {
    const { success } = await env.BENCH_RL.limit({ key: req.headers.get('cf-connecting-ip') || 'x' });
    if (!success) throw new HttpError(429, 'too many');
  }
}
async function readReport(req) {
  const t = await req.text();
  if (t.length > MAX) throw new HttpError(413, 'too big');
  let b;
  try { b = JSON.parse(t); } catch (e) { throw new HttpError(400, 'json'); }
  if (!b || typeof b !== 'object' || b.v !== 1) throw new HttpError(400, 'not a report');
  const num = (x, lo, hi) => { const n = Number(x); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0; };
  const d = b.device && typeof b.device === 'object' ? b.device : {};
  return {
    t, hz: Math.round(num(b.hz, 0, 1000)), fps: num(b.fps, 0, 1000), p95: num(b.p95, 0, 10000), late: num(b.late, 0, 100),
    m: Math.round(num(b.m, 0, 1e7)), secs: Math.round(num(b.secs, 0, 1e6)),
    dev: [d.gpu, d.screen, d.dpr, d.ua].map((x) => String(x == null ? '' : x)).join(' | ').slice(0, 600),
    state: String(b.state || '').slice(0, 20)
  };
}
async function take(req, env) {
  await limited(req, env);
  const r = await readReport(req), now = Date.now();
  const key = [...crypto.getRandomValues(new Uint8Array(12))].map((x) => x.toString(16).padStart(2, '0')).join('');
  const res = await env.DB.prepare(
    'INSERT INTO bench (t, hz, fps, p95, late, m, secs, dev, data, key, state, upd) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?1)'
  ).bind(now, r.hz, r.fps, r.p95, r.late, r.m, r.secs, r.dev, r.t, key, r.state).run();
  return { ok: true, id: res.meta && res.meta.last_row_id != null ? res.meta.last_row_id : 0, key };
}
async function again(req, env, id, key) {
  await limited(req, env);
  if (!key || !/^[0-9a-f]{24}$/.test(key)) throw new HttpError(403, 'key');
  const r = await readReport(req);
  const res = await env.DB.prepare(
    'UPDATE bench SET hz = ?3, fps = ?4, p95 = ?5, late = ?6, m = ?7, secs = ?8, dev = ?9, data = ?10, state = ?11, upd = ?12 ' +
    'WHERE id = ?1 AND key = ?2 AND state <> \'done\''
  ).bind(id, key, r.hz, r.fps, r.p95, r.late, r.m, r.secs, r.dev, r.t, r.state, Date.now()).run();
  if (!res.meta || !res.meta.changes) throw new HttpError(404, 'no such report');
  return { ok: true };
}

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
function corsFor(req) {
  const o = req.headers.get('origin') || '';
  if (ORIGINS.indexOf(o) < 0) return {};
  return { 'access-control-allow-origin': o, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type',
           'access-control-max-age': '86400', vary: 'origin' };
}
function json(o, status, extra) {
  return new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json' }, extra || {}) });
}
