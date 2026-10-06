/* ===========================================================
   comic.js — a few pages of comic for a creature
   -----------------------------------------------------------
   Three pages of three panels. Every panel is painted here, on a canvas,
   with the hill's own painters (Game.comicDraw) for the animal and the
   things on the ice, so the pages look like the game. Captions and the
   sound words are strings in i18n.js, in every language.

   A panel is drawn on a 320 x 200 stage and scaled to its canvas. `t`
   runs from the moment it is revealed, so a panel can move a little as it
   comes in. Snowcap's pages come first: a new player reads them before the
   tutorial, and anyone can read them again from his window in the Market.
   =========================================================== */

var COMIC_W = 320, COMIC_H = 200;

/* ---- the pieces every page is built from ---- */
function cmIce(c, top, bot) {                       // a field of blue ice
  var g = c.createLinearGradient(0, 0, 0, COMIC_H);
  g.addColorStop(0, top || '#bfe6fa'); g.addColorStop(1, bot || '#8ccbec');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2;      // old grooves
  for (var i = 0; i < 9; i++) {
    var x = 20 + i * 36 + (i % 3) * 7;
    c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 6, COMIC_H); c.stroke();
  }
}
function cmSnow(c) {                                // deep snow, nothing on it
  var g = c.createLinearGradient(0, 0, 0, COMIC_H);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dcecf7');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
}
/* the run of ice seen from high above: a ribbon winding down the panel */
function cmChute(c, x0, w, sway) {
  c.save();
  c.fillStyle = '#9fd6f3';
  c.strokeStyle = '#ffffff'; c.lineWidth = 3;
  c.beginPath();
  for (var y = -10; y <= COMIC_H + 10; y += 10) {
    var x = x0 + Math.sin(y * 0.03) * sway - w / 2;
    y === -10 ? c.moveTo(x, y) : c.lineTo(x, y);
  }
  for (y = COMIC_H + 10; y >= -10; y -= 10) c.lineTo(x0 + Math.sin(y * 0.03) * sway + w / 2, y);
  c.closePath(); c.fill(); c.stroke();
  c.restore();
}
function cmChuteX(x0, sway, y) { return x0 + Math.sin(y * 0.03) * sway; }
function cmSpeed(c, n, alpha) {                    // speed lines down the panel
  c.save(); c.strokeStyle = 'rgba(255,255,255,' + (alpha || 0.8) + ')'; c.lineCap = 'round';
  for (var i = 0; i < n; i++) {
    var x = (i * 53) % COMIC_W + 8, y = (i * 37) % COMIC_H, len = 26 + (i * 13) % 30;
    c.lineWidth = 1.5 + (i % 3);
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + len); c.stroke();
  }
  c.restore();
}
function cmPuff(c, x, y, r, n) {                    // a burst of snow
  c.save(); c.fillStyle = 'rgba(255,255,255,.95)';
  for (var i = 0; i < n; i++) {
    var a = i / n * 6.2832, d = r * (0.6 + (i % 3) * 0.25);
    c.beginPath(); c.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r * 0.32, 0, 6.2832); c.fill();
  }
  c.restore();
}
function cmSpark(c, x, y, s, a) {                   // a four-pointed glint
  c.save(); c.globalAlpha = a === undefined ? 1 : a; c.fillStyle = '#ffffff';
  c.beginPath();
  c.moveTo(x, y - s); c.lineTo(x + s * 0.22, y - s * 0.22); c.lineTo(x + s, y);
  c.lineTo(x + s * 0.22, y + s * 0.22); c.lineTo(x, y + s); c.lineTo(x - s * 0.22, y + s * 0.22);
  c.lineTo(x - s, y); c.lineTo(x - s * 0.22, y - s * 0.22); c.closePath(); c.fill();
  c.restore();
}
/* a sound word in the comic way: fat letters, a dark outline, a slant */
function cmSfx(c, word, x, y, size, rot, fill) {
  c.save(); c.translate(x, y); c.rotate(rot || 0);
  c.font = '800 ' + size + 'px "Baloo 2", "Comic Sans MS", system-ui, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = size * 0.22; c.strokeStyle = '#062a78';
  c.strokeText(word, 0, 0);
  c.fillStyle = fill || '#ffe066'; c.fillText(word, 0, 0);
  c.restore();
}
function cmCreature(c, x, y, size, opts) {
  opts = opts || {};
  if (typeof Game !== 'undefined' && Game.comicDraw) Game.comicDraw(c, 'creature', x, y, size, opts);
}
function cmThing(c, kind, x, y, size, t) {
  if (typeof Game !== 'undefined' && Game.comicDraw) Game.comicDraw(c, kind, x, y, size, { t: t || 0 });
}
function cmWord(key) { return (typeof t === 'function') ? t(key) : key; }

/* ---- Snowcap: how he came down the mountain ---- */
var COMICS = {
  snowcap: [
    /* page one: the top of the mountain */
    [
      { cap: 'comic.snowcap.1.1', draw: function (c, tt) {
          cmSnow(c);
          cmChute(c, 200, 54, 40);
          [[40, 40], [70, 150], [280, 60], [262, 170], [110, 90]].forEach(function (p) {
            cmThing(c, 'tree', p[0], p[1], 44);
          });
          cmCreature(c, 200, 22 + Math.min(1, tt / 30) * 4, 46, { skin: 'snowcap' });
        } },
      { cap: 'comic.snowcap.1.2', draw: function (c, tt) {
          cmSnow(c);
          /* close on his face, eyes wide at what is below */
          cmCreature(c, 160, 250, 420, { skin: 'snowcap', eye: { shut: 1, wide: 1.25, lx: 0, ly: 0.6 } });
          cmSpark(c, 250, 40, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
        } },
      { cap: 'comic.snowcap.1.3', draw: function (c, tt) {
          cmSnow(c);
          cmChute(c, 160, 70, 50);
          for (var i = 0; i < 6; i++) {
            var y = 18 + i * 32, x = cmChuteX(160, 50, y);
            cmThing(c, i === 3 ? 'gold' : 'fish', x, y, 30, tt + i * 10);
            cmSpark(c, x + 14, y - 10, 5, 0.5 + 0.5 * Math.sin(tt * 0.18 + i));
          }
        } }
    ],
    /* page two: the first slide */
    [
      { cap: 'comic.snowcap.2.1', draw: function (c, tt) {
          cmIce(c);
          cmPuff(c, 160, 116, 46, 9);
          cmCreature(c, 160, 104, 120, { skin: 'snowcap', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
          cmSfx(c, cmWord('comic.sfx.flop'), 250, 46, 34, -0.18);
        } },
      { cap: 'comic.snowcap.2.2', draw: function (c, tt) {
          cmIce(c);
          cmSpeed(c, 16, 0.85);
          cmThing(c, 'tree', 232, 42, 62);
          var drift = Math.min(1, tt / 40) * 30;
          cmCreature(c, 130 + drift, 128, 92, { skin: 'snowcap', ang: 0.35, gait: tt * 0.5,
                                               eye: { shut: 1, wide: 1.3, lx: 0.6, ly: -0.6 } });
          cmSfx(c, cmWord('comic.sfx.whee'), 70, 50, 30, -0.12, '#bff2ff');
        } },
      { cap: 'comic.snowcap.2.3', draw: function (c, tt) {
          cmIce(c);
          cmSpeed(c, 14, 0.7);
          cmThing(c, 'tree', 238, 70, 62);
          cmCreature(c, 132, 112, 92, { skin: 'snowcap', ang: -0.4, gait: tt * 0.5 });
          /* the push: a ring where the tap landed, and the curve he swung on */
          var r = 18 + (tt % 40) * 0.8;
          c.save(); c.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 1 - (tt % 40) / 40).toFixed(2) + ')';
          c.lineWidth = 4; c.beginPath(); c.arc(132, 112, r, 0, 6.2832); c.stroke(); c.restore();
          c.save(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.lineCap = 'round';
          c.beginPath(); c.moveTo(196, 196); c.quadraticCurveTo(200, 140, 140, 118); c.stroke(); c.restore();
          cmSfx(c, cmWord('comic.sfx.whoosh'), 70, 40, 30, -0.1);
        } }
    ],
    /* page three: the rule of the hill */
    [
      { cap: 'comic.snowcap.3.1', draw: function (c, tt) {
          cmIce(c);
          cmCreature(c, 160, 70, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.4, lx: 0, ly: 0.8 } });
          /* the snow coming up behind him */
          var top = 128 - Math.min(1, tt / 60) * 10;
          var g = c.createLinearGradient(0, top, 0, COMIC_H);
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9dcec');
          c.fillStyle = g; c.fillRect(0, top + 10, COMIC_W, COMIC_H);
          for (var i = 0; i < 9; i++) {
            c.fillStyle = i % 2 ? '#ffffff' : '#eaf3fa';
            c.beginPath(); c.arc(i * 40 + 10, top + 10 + Math.sin(tt * 0.1 + i) * 4, 26, 0, 6.2832); c.fill();
          }
          cmSfx(c, cmWord('comic.sfx.rumble'), 160, 168, 30, 0.04, '#dfe9f2');
        } },
      { cap: 'comic.snowcap.3.2', draw: function (c, tt) {
          cmIce(c);
          cmThing(c, 'tree', 50, 60, 54);
          cmThing(c, 'rock', 274, 140, 50);
          cmCreature(c, 160, 128, 88, { skin: 'snowcap', gait: tt * 0.5 });
          [[150, 66], [176, 40], [140, 18]].forEach(function (p, i) {
            cmThing(c, 'fish', p[0], p[1], 28, tt + i * 7);
          });
          cmSpark(c, 186, 80, 8, 0.6 + 0.4 * Math.sin(tt * 0.25));
          cmSfx(c, cmWord('comic.sfx.gulp'), 250, 52, 28, 0.12);
        } },
      { cap: 'comic.snowcap.3.3', draw: function (c, tt) {
          cmSnow(c);
          cmCreature(c, 160, 214, 300, { skin: 'snowcap', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
          cmSpark(c, 70, 50, 10, 0.5 + 0.5 * Math.sin(tt * 0.2));
          cmSpark(c, 256, 70, 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
        } }
    ]
  ]
};

function comicFor(id) { return COMICS[id] || null; }
