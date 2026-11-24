-- Ice Dasher's one Freeride board, Android and iPhone together (1.3.5).
-- One row a player. A player is "a:<Play Games player id>" or
-- "i:<Game Center team player id>", proven at /v1/auth.
-- The day is UTC (2026-11-23), the week starts on Monday, UTC.
CREATE TABLE IF NOT EXISTS players (
  id        TEXT PRIMARY KEY,
  plat      TEXT    NOT NULL,             -- 'android' | 'ios'
  name      TEXT    NOT NULL DEFAULT '',
  card      TEXT    NOT NULL DEFAULT '',  -- the profile card, base 36 (skins.js profileTag)
  card_t    INTEGER NOT NULL DEFAULT 0,   -- when the card last changed, ms
  best      INTEGER NOT NULL DEFAULT 0,   -- best of all time
  best_t    INTEGER NOT NULL DEFAULT 0,
  day       TEXT    NOT NULL DEFAULT '',  -- the day day_best belongs to
  day_best  INTEGER NOT NULL DEFAULT 0,
  week      TEXT    NOT NULL DEFAULT '',  -- the Monday week_best belongs to
  week_best INTEGER NOT NULL DEFAULT 0,
  last_t    INTEGER NOT NULL DEFAULT 0,   -- the last score taken, ms (a few seconds between)
  imported  INTEGER NOT NULL DEFAULT 0,   -- 1 once the save's old best came in
  -- 1: off every board and the cards, scores taken without a word and kept
  -- out (admin.mjs ban; the owner, 23 Nov 2026). On the live database it
  -- came with ALTER TABLE players ADD COLUMN banned INTEGER NOT NULL DEFAULT 0
  banned    INTEGER NOT NULL DEFAULT 0,
  created   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_best ON players (best DESC, best_t);
-- The performance test's results (test.html, js/bench.js; 24 Nov 2026), sent
-- on a tap by whoever ran it. No player and no id: the phone's kind, its
-- screen and the timings. data is the whole result as sent (JSON).
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
CREATE INDEX IF NOT EXISTS players_day  ON players (day, day_best DESC, best_t);
CREATE INDEX IF NOT EXISTS players_week ON players (week, week_best DESC, best_t);
CREATE INDEX IF NOT EXISTS players_card ON players (card_t DESC);
