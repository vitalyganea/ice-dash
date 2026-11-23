#!/usr/bin/env node
/* Ice Dasher's board: dealing with a cheat, from the owner's machine.
   It runs SQL on the live database through wrangler, so it works only where
   `npx wrangler login` has been done; there is no admin route on the web.

     node admin.mjs top [n]          the board as it stands, with each player's id
     node admin.mjs find <name>      players whose name has this in it
     node admin.mjs reset <id>       scores to nothing (best, day, week); the
                                     save's old best is not taken again
     node admin.mjs ban <id>         off every board and the cards; their
                                     scores are taken without a word and kept out
     node admin.mjs unban <id>       back on, with whatever best they had
     node admin.mjs banned           who is banned

   <id> as `top` and `find` show it: a:<Play Games id> or i:<Game Center id>.
   Add --local to work on the wrangler dev database instead. */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2).filter((a) => a !== '--local');
const where = process.argv.includes('--local') ? '--local' : '--remote';
const [cmd, arg] = args;

function sql(q) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'icedasher-board', where, '--json', '--command', q],
                           { cwd: here, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const j = JSON.parse(out);
  return (j[0] && j[0].results) || [];
}
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
function idArg() {
  if (!arg || !/^[ai]:[\w.:-]{1,100}$/.test(arg)) { console.error('give the player id, as top or find shows it (a:... or i:...)'); process.exit(2); }
  const r = sql('SELECT id, name, plat, best, banned FROM players WHERE id = ' + q(arg));
  if (!r.length) { console.error('no such player: ' + arg); process.exit(1); }
  return r[0];
}
function show(rows) {
  if (!rows.length) { console.log('(none)'); return; }
  for (const x of rows)
    console.log(String(x.best).padStart(9) + '  ' + (x.plat || '').padEnd(8) + (x.banned ? 'BANNED  ' : '        ') +
                String(x.name || '').padEnd(26) + x.id);
}

switch (cmd) {
  case 'top':
    show(sql('SELECT id, name, plat, best, banned FROM players WHERE best > 0 ORDER BY best DESC LIMIT ' +
             Math.max(1, Math.min(500, parseInt(arg, 10) || 30))));
    break;
  case 'find':
    if (!arg) { console.error('give part of a name'); process.exit(2); }
    show(sql("SELECT id, name, plat, best, banned FROM players WHERE name LIKE " + q('%' + arg + '%') + " ORDER BY best DESC LIMIT 50"));
    break;
  case 'banned':
    show(sql('SELECT id, name, plat, best, banned FROM players WHERE banned = 1 ORDER BY best DESC'));
    break;
  case 'reset': {
    const p = idArg();
    sql('UPDATE players SET best = 0, best_t = 0, day_best = 0, week_best = 0, imported = 1 WHERE id = ' + q(p.id));
    console.log('reset: ' + p.name + ' (' + p.id + '), was ' + p.best);
    break;
  }
  case 'ban': {
    const p = idArg();
    sql('UPDATE players SET banned = 1 WHERE id = ' + q(p.id));
    console.log('banned: ' + p.name + ' (' + p.id + '), best ' + p.best + ' (kept, hidden; reset it too if it should go)');
    break;
  }
  case 'unban': {
    const p = idArg();
    sql('UPDATE players SET banned = 0 WHERE id = ' + q(p.id));
    console.log('unbanned: ' + p.name + ' (' + p.id + ')');
    break;
  }
  default:
    console.log('node admin.mjs top [n] | find <name> | reset <id> | ban <id> | unban <id> | banned   [--local]');
}
