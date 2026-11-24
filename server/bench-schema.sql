-- Ice Dasher's performance-test reports (test.html, js/bench.js; 24 Nov 2026),
-- sent by the page itself at the end of a test. No player and no id: the
-- phone's kind, its screen, the graphics chip's name and the timings.
-- data is the whole report as sent (JSON). Its own database, not the board's.
CREATE TABLE IF NOT EXISTS bench (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  t     INTEGER NOT NULL,
  hz    INTEGER NOT NULL DEFAULT 0,
  fps   REAL    NOT NULL DEFAULT 0,
  p95   REAL    NOT NULL DEFAULT 0,
  late  REAL    NOT NULL DEFAULT 0,
  m     INTEGER NOT NULL DEFAULT 0,
  secs  INTEGER NOT NULL DEFAULT 0,
  dev   TEXT    NOT NULL DEFAULT '',
  data  TEXT    NOT NULL,
  -- a report is made at the start and sent again along the way (the key
  -- given back with its number lets only that page update it); state is
  -- running, done, stopped, time limit or closed early; upd its last update
  key   TEXT    NOT NULL DEFAULT '',
  state TEXT    NOT NULL DEFAULT '',
  upd   INTEGER NOT NULL DEFAULT 0
);
-- added on the live database 24 Nov 2026 with ALTER TABLE ... ADD COLUMN
CREATE INDEX IF NOT EXISTS bench_t ON bench (t DESC);
