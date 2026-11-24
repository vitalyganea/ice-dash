/* ===========================================================
   Ice Dasher's performance-test server (24 Nov 2026)
   -----------------------------------------------------------
   test.html (js/bench.js) sends its report here by itself at the end of a
   test. Apart from the leaderboard on purpose (the owner): its own Worker
   (bench.icedasher.workers.dev) and its own D1 (icedasher-bench).

   Routes:
     POST /v1/bench   a report (JSON, v: 1, up to 64 KB) -> {ok, id}
     GET  /v1/health
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
      return json({ error: 'no such route' }, 404, cors);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      if (status === 500) console.error(e && e.stack || e);
      return json({ error: e instanceof HttpError ? e.message : 'server error' }, status, cors);
    }
  }
};

async function take(req, env) {
  if (env.BENCH_RL) {
    const { success } = await env.BENCH_RL.limit({ key: req.headers.get('cf-connecting-ip') || 'x' });
    if (!success) throw new HttpError(429, 'too many');
  }
  const t = await req.text();
  if (t.length > MAX) throw new HttpError(413, 'too big');
  let b;
  try { b = JSON.parse(t); } catch (e) { throw new HttpError(400, 'json'); }
  if (!b || typeof b !== 'object' || b.v !== 1) throw new HttpError(400, 'not a report');
  const num = (x, lo, hi) => { const n = Number(x); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0; };
  const d = b.device && typeof b.device === 'object' ? b.device : {};
  const dev = [d.gpu, d.screen, d.dpr, d.ua].map((x) => String(x == null ? '' : x)).join(' | ').slice(0, 600);
  const r = await env.DB.prepare(
    'INSERT INTO bench (t, hz, fps, p95, late, m, secs, dev, data) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)'
  ).bind(Date.now(), Math.round(num(b.hz, 0, 1000)), num(b.fps, 0, 1000), num(b.p95, 0, 10000), num(b.late, 0, 100),
         Math.round(num(b.m, 0, 1e7)), Math.round(num(b.secs, 0, 1e6)), dev, t).run();
  return { ok: true, id: r.meta && r.meta.last_row_id != null ? r.meta.last_row_id : 0 };
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
