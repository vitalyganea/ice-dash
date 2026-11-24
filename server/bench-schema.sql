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
  data  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS bench_t ON bench (t DESC);
