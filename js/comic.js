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

/* a hole through the ice to the dark water under it */
function cmHole(c, x, y, rx, ry) {
  c.save();
  c.fillStyle = '#ffffff';
  c.beginPath(); c.ellipse(x, y + 2, rx + 8, ry + 6, 0, 0, 6.2832); c.fill();
  var g = c.createRadialGradient(x, y, 2, x, y, rx);
  g.addColorStop(0, '#0b2d55'); g.addColorStop(1, '#1d5f8f');
  c.fillStyle = g;
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill();
  c.strokeStyle = 'rgba(160,220,250,.8)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y, rx * 0.7, ry * 0.6, 0, 0.3, 2.6); c.stroke();
  c.restore();
}
/* a warm glow under the snow: something golden buried there */
function cmGlow(c, x, y, r, a) {
  var g = c.createRadialGradient(x, y, 1, x, y, r);
  g.addColorStop(0, 'rgba(255,214,90,' + (a === undefined ? 0.8 : a) + ')');
  g.addColorStop(1, 'rgba(255,214,90,0)');
  c.fillStyle = g;
  c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
}
/* lines from a thing towards a point: it is being pulled in */
function cmPull(c, x0, y0, x1, y1, a) {
  c.save(); c.strokeStyle = 'rgba(255,255,255,' + (a === undefined ? 0.8 : a) + ')'; c.lineWidth = 2; c.lineCap = 'round';
  c.setLineDash([6, 7]);
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  c.restore();
}
/* the run of catches as the game shows it: a gold tag, x2 */
function cmCombo(c, x, y, txt) {
  c.save();
  c.fillStyle = '#ffcd3a'; c.strokeStyle = '#ad6800'; c.lineWidth = 2.5;
  c.beginPath(); c.ellipse(x, y, 26, 15, 0, 0, 6.2832); c.fill(); c.stroke();
  c.font = '800 18px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#7a4a00'; c.fillText(txt, x, y + 1);
  c.restore();
}

/* ---- Mitten: the scarf, and how far it reaches ---- */
COMICS.mitten = [
  [
    { cap: 'comic.mitten.1.1', draw: function (c, tt) {
        cmSnow(c);
        /* a scarf left on the snow at the foot of the hill */
        c.save(); c.strokeStyle = '#e0483c'; c.lineWidth = 14; c.lineCap = 'round';
        c.beginPath(); c.moveTo(90, 120); c.bezierCurveTo(130, 80, 190, 160, 230, 110); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3;
        for (var i = 0; i < 6; i++) { c.beginPath(); c.moveTo(100 + i * 24, 104 + (i % 2) * 10); c.lineTo(108 + i * 24, 124 + (i % 2) * 6); c.stroke(); }
        c.restore();
        cmSpark(c, 236, 92, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } },
    { cap: 'comic.mitten.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 116, 120, { skin: 'mitten', eye: { shut: 1, wide: 1.15, lx: 0, ly: 0 } });
        cmSpark(c, 232, 60, 8, 0.5 + 0.5 * Math.sin(tt * 0.2));
        cmSpark(c, 92, 74, 6, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
      } },
    { cap: 'comic.mitten.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        cmCreature(c, 160, 120, 90, { skin: 'mitten', gait: tt * 0.5 });
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 46, 28, -0.12, '#bff2ff');
      } }
  ],
  [
    { cap: 'comic.mitten.2.1', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 130, 86, { skin: 'mitten', gait: tt * 0.5, eye: { shut: 1, wide: 1, lx: 0.8, ly: -0.4 } });
        cmThing(c, 'fish', 284, 46, 30, tt);
        cmThing(c, 'fish', 40, 40, 30, tt + 5);
      } },
    { cap: 'comic.mitten.2.2', draw: function (c, tt) {
        cmIce(c);
        var k = Math.min(1, tt / 50);
        [[284, 40], [40, 36], [300, 150], [24, 160]].forEach(function (p, i) {
          var x = p[0] + (160 - p[0]) * k * 0.55, y = p[1] + (120 - p[1]) * k * 0.55;
          cmPull(c, x, y, 160, 120, 0.7);
          cmThing(c, 'fish', x, y, 28, tt + i * 6);
        });
        cmCreature(c, 160, 124, 86, { skin: 'mitten', gait: tt * 0.5 });
        cmSfx(c, cmWord('comic.sfx.slurp'), 160, 34, 28, -0.06);
      } },
    { cap: 'comic.mitten.2.3', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 116, 100, { skin: 'mitten', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSfx(c, cmWord('comic.sfx.gulp'), 248, 48, 28, 0.12);
        [[90, 60], [236, 140], [96, 160]].forEach(function (p, i) { cmSpark(c, p[0], p[1], 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + i)); });
      } }
  ],
  [
    { cap: 'comic.mitten.3.1', draw: function (c, tt) {
        cmIce(c);
        for (var i = 0; i < 7; i++) cmThing(c, 'fish', 30 + i * 44, 40 + (i % 2) * 24, 26, tt + i * 4);
        cmCreature(c, 160, 146, 80, { skin: 'mitten', gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 0, ly: -0.8 } });
      } },
    { cap: 'comic.mitten.3.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 120, 96, { skin: 'mitten' });
        cmCombo(c, 252, 52, 'x3');
        cmSfx(c, cmWord('comic.sfx.gulp'), 80, 52, 26, -0.1);
      } },
    { cap: 'comic.mitten.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'mitten', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSpark(c, 66, 46, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } }
  ]
];

/* ---- Puffin: lost on a glacier, and never put off by a miss ---- */
COMICS.puffin = [
  [
    { cap: 'comic.puffin.1.1', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 112, 92, { skin: 'puffin', ang: Math.sin(tt * 0.05) * 0.3, eye: { shut: 1, wide: 1.2, lx: Math.sin(tt * 0.05), ly: 0 } });
        cmSfx(c, '?', 230, 60, 40, 0.2, '#ffffff');
        cmSfx(c, '?', 92, 70, 30, -0.2, '#ffffff');
      } },
    { cap: 'comic.puffin.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 360, { skin: 'puffin', eye: { shut: 1, wide: 1, lx: 0.4, ly: -0.4 } });
      } },
    { cap: 'comic.puffin.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 18, 0.9);
        cmCreature(c, 160, 120, 90, { skin: 'puffin', gait: tt * 0.6 });
        cmSfx(c, cmWord('comic.sfx.whoosh'), 250, 44, 28, -0.1);
      } }
  ],
  [
    { cap: 'comic.puffin.2.1', draw: function (c, tt) {
        cmIce(c);
        [[150, 30], [164, 60], [150, 90]].forEach(function (p, i) { cmThing(c, 'fish', p[0], p[1], 26, tt + i * 5); });
        cmCreature(c, 160, 150, 80, { skin: 'puffin', gait: tt * 0.5 });
        cmCombo(c, 260, 46, 'x2');
      } },
    { cap: 'comic.puffin.2.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 130, 120, 86, { skin: 'puffin', ang: -0.3, gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 1, ly: 0 } });
        cmThing(c, 'fish', 262, 150, 30, tt);
        cmSfx(c, cmWord('comic.sfx.oops'), 250, 54, 28, 0.1, '#ffd2d2');
      } },
    { cap: 'comic.puffin.2.3', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 140, 120, 90, { skin: 'puffin', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmCombo(c, 246, 70, 'x2');
        cmSpark(c, 276, 46, 8, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } }
  ],
  [
    { cap: 'comic.puffin.3.1', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        for (var i = 0; i < 5; i++) cmThing(c, 'fish', 160 + Math.sin(i) * 30, 20 + i * 22, 24, tt + i * 4);
        cmCreature(c, 160, 156, 74, { skin: 'puffin', gait: tt * 0.6 });
      } },
    { cap: 'comic.puffin.3.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 150, 122, 96, { skin: 'puffin' });
        cmCombo(c, 252, 56, 'x3');
        cmSfx(c, cmWord('comic.sfx.gulp'), 78, 50, 26, -0.1);
      } },
    { cap: 'comic.puffin.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'puffin', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
        cmSpark(c, 256, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } }
  ]
];

/* ---- Seal: up through the ice, and a nose for gold ---- */
COMICS.seal = [
  [
    { cap: 'comic.seal.1.1', draw: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
        cmHole(c, 160, 118, 54, 30);
        var up = Math.min(1, tt / 40);
        c.save(); c.beginPath(); c.rect(0, 0, COMIC_W, 118 + 4); c.clip();
        cmCreature(c, 160, 150 - up * 46, 100, { skin: 'seal', eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.5 } });
        c.restore();
        cmSfx(c, cmWord('comic.sfx.splash'), 252, 50, 28, 0.12, '#bff2ff');
      } },
    { cap: 'comic.seal.1.2', draw: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
        cmHole(c, 92, 156, 40, 20);
        cmCreature(c, 190, 104, 100, { skin: 'seal', eye: { shut: 1, wide: 1, lx: -0.6, ly: 0.6 } });
      } },
    { cap: 'comic.seal.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        cmCreature(c, 160, 120, 90, { skin: 'seal', gait: tt * 0.5 });
        cmSfx(c, cmWord('comic.sfx.whee'), 66, 44, 28, -0.12, '#bff2ff');
      } }
  ],
  [
    { cap: 'comic.seal.2.1', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 200, 260, { skin: 'seal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSfx(c, cmWord('comic.sfx.sniff'), 160, 40, 30, -0.05);
      } },
    { cap: 'comic.seal.2.2', draw: function (c, tt) {
        cmSnow(c);
        var pulse = 0.55 + 0.35 * Math.sin(tt * 0.12);
        cmGlow(c, 238, 60, 44, pulse);
        cmGlow(c, 70, 150, 30, pulse * 0.7);
        cmCreature(c, 150, 120, 90, { skin: 'seal', eye: { shut: 1, wide: 1.3, lx: 0.8, ly: -0.6 } });
      } },
    { cap: 'comic.seal.2.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'gold', 236, 70, 40, tt);
        cmPull(c, 160, 120, 230, 76, 0.7);
        cmCreature(c, 150, 124, 86, { skin: 'seal', gait: tt * 0.5 });
        cmSpark(c, 260, 46, 9, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } }
  ],
  [
    { cap: 'comic.seal.3.1', draw: function (c, tt) {
        cmIce(c);
        [[50, 40], [270, 54], [90, 150], [250, 160], [160, 30]].forEach(function (p, i) {
          cmThing(c, 'gold', p[0], p[1], 34, tt + i * 6);
        });
        cmCreature(c, 160, 110, 80, { skin: 'seal', eye: { shut: 1, wide: 1.4, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.seal.3.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 120, 96, { skin: 'seal' });
        cmSfx(c, cmWord('comic.sfx.gulp'), 250, 50, 28, 0.12);
        cmGlow(c, 160, 120, 70, 0.35);
      } },
    { cap: 'comic.seal.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'seal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSpark(c, 70, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
        cmSpark(c, 254, 66, 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
      } }
  ]
];

/* a burrow in the snow, dark at its mouth */
function cmBurrow(c, x, y) {
  c.save();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x, y + 3, 30, 16, 0, 0, 6.2832); c.fill();
  var g = c.createRadialGradient(x, y, 2, x, y, 20);
  g.addColorStop(0, '#2c3b4a'); g.addColorStop(1, '#6f8597');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 20, 10, 0, 0, 6.2832); c.fill();
  c.restore();
}
/* stars as the results card shows them */
function cmStars(c, x, y, n, of, s) {
  for (var i = 0; i < of; i++) {
    var sx = x + (i - (of - 1) / 2) * s * 1.2;
    c.save(); c.translate(sx, y);
    c.beginPath();
    for (var k = 0; k < 10; k++) {
      var r = k % 2 ? s * 0.22 : s * 0.5, a = -Math.PI / 2 + k * Math.PI / 5;
      k ? c.lineTo(Math.cos(a) * r, Math.sin(a) * r) : c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = i < n ? '#ffcd3a' : 'rgba(255,255,255,.6)'; c.fill();
    c.strokeStyle = i < n ? '#ad6800' : 'rgba(90,120,150,.5)'; c.lineWidth = 2; c.stroke();
    c.restore();
  }
}
/* a little someone else stuck in the drift, for comparison */
function cmStuck(c, x, y) {
  cmThing(c, 'drift', x, y, 70);
  cmCreature(c, x, y - 4, 44, { skin: 'snowcap', eye: { shut: 1, wide: 1.4, lx: 0, ly: 0 } });
  cmPuff(c, x, y + 10, 22, 7);
}
/* a word in a small tag, "+4" over a time bubble and the like */
function cmTag(c, x, y, txt, fill) {
  c.save();
  c.font = '800 20px "Baloo 2", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 5; c.strokeStyle = '#062a78'; c.strokeText(txt, x, y);
  c.fillStyle = fill || '#d8ffb0'; c.fillText(txt, x, y);
  c.restore();
}

/* ---- Lemming: back every single day ---- */
COMICS.lemming = [
  [
    { cap: 'comic.lemming.1.1', draw: function (c, tt) {
        cmSnow(c);
        cmBurrow(c, 160, 128);
        var up = Math.min(1, tt / 30);
        c.save(); c.beginPath(); c.rect(0, 0, COMIC_W, 128); c.clip();
        cmCreature(c, 160, 150 - up * 40, 80, { skin: 'lemming', eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.5 } });
        c.restore();
      } },
    { cap: 'comic.lemming.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 380, { skin: 'lemming', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
        cmSpark(c, 260, 46, 8, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } },
    { cap: 'comic.lemming.1.3', draw: function (c, tt) {
        cmIce(c);
        for (var i = 0; i < 6; i++) {                  // today's line, lit up
          var y = 190 - i * 34, x = 160 + Math.sin(i * 1.2) * 60;
          var g = c.createRadialGradient(x, y, 1, x, y, 16);
          g.addColorStop(0, 'rgba(255,200,70,.9)'); g.addColorStop(1, 'rgba(255,200,70,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, 16, 0, 6.2832); c.fill();
        }
        cmCreature(c, 160, 176, 60, { skin: 'lemming', gait: tt * 0.6 });
      } }
  ],
  [
    { cap: 'comic.lemming.2.1', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        cmCreature(c, 150, 124, 86, { skin: 'lemming', gait: tt * 0.6, eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.8 } });
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 46, 26, -0.1, '#bff2ff');
      } },
    { cap: 'comic.lemming.2.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 140, 80, { skin: 'lemming', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmStars(c, 160, 48, Math.min(3, 1 + Math.floor(tt / 14)), 3, 40);
      } },
    { cap: 'comic.lemming.2.3', draw: function (c, tt) {
        cmSnow(c);
        cmStars(c, 90, 60, 3, 3, 26);
        c.save(); c.strokeStyle = '#062a78'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(150, 60); c.lineTo(184, 60); c.lineTo(176, 52); c.moveTo(184, 60); c.lineTo(176, 68); c.stroke(); c.restore();
        for (var i = 0; i < 4; i++) cmThing(c, 'fish', 214 + (i % 2) * 34, 40 + Math.floor(i / 2) * 40, 30, tt + i * 5);
        cmCreature(c, 160, 160, 56, { skin: 'lemming' });
      } }
  ],
  [
    { cap: 'comic.lemming.3.1', draw: function (c, tt) {
        cmSnow(c);
        for (var d = 0; d < 7; d++) {                  // a week of mornings, one more each day
          var lit = d <= Math.floor(tt / 8);
          c.fillStyle = lit ? '#ffcd3a' : 'rgba(150,175,200,.4)';
          c.beginPath(); c.arc(40 + d * 40, 60, 13, 0, 6.2832); c.fill();
          if (lit) { c.strokeStyle = '#ad6800'; c.lineWidth = 2; c.stroke(); }
        }
        cmCreature(c, 160, 150, 70, { skin: 'lemming', gait: tt * 0.5 });
      } },
    { cap: 'comic.lemming.3.2', draw: function (c, tt) {
        cmSnow(c);
        for (var i = 0; i < 9; i++) cmThing(c, 'fish', 110 + (i % 3) * 50, 40 + Math.floor(i / 3) * 34, 30, tt + i * 3);
        cmCreature(c, 260, 150, 60, { skin: 'lemming', eye: { shut: 1, wide: 1.3, lx: -0.8, ly: -0.4 } });
      } },
    { cap: 'comic.lemming.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'lemming', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSpark(c, 70, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } }
  ]
];

/* ---- Musk Ox: deep snow does not slow him ---- */
COMICS.muskox = [
  [
    { cap: 'comic.muskox.1.1', draw: function (c, tt) {
        cmSnow(c);
        c.save(); c.fillStyle = 'rgba(255,255,255,.8)';
        for (var i = 0; i < 40; i++) { c.beginPath(); c.arc((i * 47 + tt * 3) % COMIC_W, (i * 29 + tt * 1.5) % COMIC_H, 2 + (i % 3), 0, 6.2832); c.fill(); }
        c.restore();
        cmCreature(c, 160, 120, 110, { skin: 'muskox', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.muskox.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 250, 380, { skin: 'muskox', eye: { shut: 1, wide: 1.25, lx: 0, ly: 0.5 } });
      } },
    { cap: 'comic.muskox.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.7);
        cmCreature(c, 160, 124, 90, { skin: 'muskox', gait: tt * 0.4 });
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 40, 24, -0.1, '#bff2ff');
      } }
  ],
  [
    { cap: 'comic.muskox.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'drift', 160, 60, 150);
        cmCreature(c, 160, 160, 70, { skin: 'muskox', gait: tt * 0.4 });
      } },
    { cap: 'comic.muskox.2.2', draw: function (c, tt) {
        cmIce(c);
        cmStuck(c, 80, 110);
      } },
    { cap: 'comic.muskox.2.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'drift', 160, 110, 160);
        cmPuff(c, 110, 90, 26, 7); cmPuff(c, 212, 90, 26, 7);
        cmCreature(c, 160, 104, 90, { skin: 'muskox', gait: tt * 0.6 });
        cmSfx(c, cmWord('comic.sfx.plough'), 160, 36, 30, -0.06);
      } }
  ],
  [
    { cap: 'comic.muskox.3.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'drift', 70, 60, 110); cmThing(c, 'drift', 250, 120, 120); cmThing(c, 'drift', 120, 170, 100);
        cmCreature(c, 170, 100, 70, { skin: 'muskox', gait: tt * 0.5 });
      } },
    { cap: 'comic.muskox.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 16, 0.9);
        cmThing(c, 'drift', 160, 150, 130);
        cmCreature(c, 160, 120, 86, { skin: 'muskox', gait: tt * 0.6 });
      } },
    { cap: 'comic.muskox.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 240, 330, { skin: 'muskox', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Bubbles: born in a bubble, and kept in one ---- */
COMICS.bubbles = [
  [
    { cap: 'comic.bubbles.1.1', draw: function (c, tt) {
        cmSnow(c);
        cmThing(c, 'bubble', 160, 104, 150, tt);
        cmCreature(c, 160, 106, 60, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.bubbles.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 380, { skin: 'bubbles', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
        c.save(); c.globalAlpha = 0.4; cmThing(c, 'bubble', 160, 150, 460, tt); c.restore();
      } },
    { cap: 'comic.bubbles.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        cmCreature(c, 160, 120, 90, { skin: 'bubbles', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.bubbles.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 160, 50, 70);
        cmCreature(c, 160, 150, 80, { skin: 'bubbles', gait: tt * 0.5, eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.bubbles.2.2', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 160, 52, 70);
        cmPuff(c, 160, 90, 40, 10);
        cmCreature(c, 160, 110, 80, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmSfx(c, cmWord('comic.sfx.bonk'), 240, 140, 32, 0.15);
      } },
    { cap: 'comic.bubbles.2.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 70, 160, 60);
        cmCreature(c, 190, 90, 84, { skin: 'bubbles', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.bubbles.3.1', draw: function (c, tt) {
        cmSnow(c);
        var g = Math.min(1, tt / 40);
        cmThing(c, 'bubble', 160, 104, 60 + g * 90, tt);
        cmCreature(c, 160, 106, 60, { skin: 'bubbles' });
        cmSfx(c, cmWord('comic.sfx.pop'), 254, 46, 26, 0.12, '#bff2ff');
      } },
    { cap: 'comic.bubbles.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 14, 0.8);
        cmThing(c, 'tree', 60, 70, 56); cmThing(c, 'rock', 268, 140, 54);
        cmCreature(c, 160, 116, 84, { skin: 'bubbles', gait: tt * 0.5 });
      } },
    { cap: 'comic.bubbles.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        c.save(); c.globalAlpha = 0.4; cmThing(c, 'bubble', 160, 150, 400, tt); c.restore();
      } }
  ]
];

/* ---- Otter: time is just another kind of water ---- */
COMICS.otter = [
  [
    { cap: 'comic.otter.1.1', draw: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
        cmHole(c, 160, 104, 110, 60);
        cmCreature(c, 160, 104 + Math.sin(tt * 0.08) * 3, 90, { skin: 'otter', ang: Math.PI, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.otter.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 380, { skin: 'otter', eye: { shut: 1, wide: 1, lx: 0.4, ly: 0.4 } });
        c.save(); c.fillStyle = '#9aa7b3'; c.strokeStyle = '#5d6b78'; c.lineWidth = 2;   // the pebble
        c.beginPath(); c.ellipse(258, 70, 18, 13, 0.3, 0, 6.2832); c.fill(); c.stroke(); c.restore();
      } },
    { cap: 'comic.otter.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 124, 86, { skin: 'otter', gait: tt * 0.4, eye: { shut: 0.4, wide: 1, lx: 0, ly: 0 } });
      } }
  ],
  [
    { cap: 'comic.otter.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'clock', 230, 60, 64, tt);
        cmCreature(c, 140, 140, 80, { skin: 'otter', gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 0.8, ly: -0.6 } });
      } },
    { cap: 'comic.otter.2.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 124, 90, { skin: 'otter' });
        cmTag(c, 160, 44 - Math.min(1, tt / 30) * 8, '+4');
        cmSpark(c, 210, 40, 9, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } },
    { cap: 'comic.otter.2.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 100, 110, 56, { skin: 'snowcap' }); cmCreature(c, 220, 110, 56, { skin: 'otter' });
        cmTag(c, 100, 46, '+3', '#ffffff');
        cmTag(c, 220, 46, '+4');
        cmSfx(c, cmWord('comic.sfx.whoosh'), 160, 160, 26, -0.05);
      } }
  ],
  [
    { cap: 'comic.otter.3.1', draw: function (c, tt) {
        cmIce(c);
        [[70, 50], [250, 70], [110, 150], [230, 160]].forEach(function (p, i) { cmThing(c, 'clock', p[0], p[1], 46, tt + i * 7); });
        cmCreature(c, 160, 104, 70, { skin: 'otter', gait: tt * 0.5 });
      } },
    { cap: 'comic.otter.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 16, 0.9);
        cmCreature(c, 160, 120, 86, { skin: 'otter', gait: tt * 0.6 });
        cmTag(c, 250, 50, '+4'); cmTag(c, 70, 70, '+4');
      } },
    { cap: 'comic.otter.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'otter', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Arctic Hare: white on white, and never hurried ---- */
COMICS.hare = [
  [
    { cap: 'comic.hare.1.1', draw: function (c, tt) {
        cmSnow(c);
        c.save(); c.globalAlpha = 0.35 + 0.25 * Math.sin(tt * 0.06);
        cmCreature(c, 160, 120, 100, { skin: 'hare' });
        c.restore();
      } },
    { cap: 'comic.hare.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 236, 380, { skin: 'hare', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.hare.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.5);
        cmCreature(c, 160, 124, 86, { skin: 'hare', gait: tt * 0.3, eye: { shut: 0.5, wide: 1, lx: 0, ly: 0 } });
      } }
  ],
  [
    { cap: 'comic.hare.2.1', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 24, 1);
        cmCreature(c, 160, 120, 80, { skin: 'snowcap', gait: tt * 0.9, eye: { shut: 1, wide: 1.45, lx: 0, ly: -1 } });
        cmSfx(c, cmWord('comic.sfx.whee'), 240, 44, 26, -0.1, '#bff2ff');
      } },
    { cap: 'comic.hare.2.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.5);
        cmCreature(c, 160, 120, 86, { skin: 'hare', gait: tt * 0.3, eye: { shut: 0.6, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.hare.2.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'tree', 70, 50, 54); cmThing(c, 'tree', 250, 50, 54);
        cmCreature(c, 160, 140, 86, { skin: 'hare', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
        c.save(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5;      // listening
        for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(160, 70, 16 + i * 12 + (tt % 30) * 0.4, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        c.restore();
      } }
  ],
  [
    { cap: 'comic.hare.3.1', draw: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 60, 50);
        cmCreature(c, cmChuteX(160, 50, 150), 150, 50, { skin: 'hare', gait: tt * 0.3 });
      } },
    { cap: 'comic.hare.3.2', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 80, 70, 54); cmThing(c, 'tree', 250, 110, 54);
        cmCreature(c, 160, 130, 84, { skin: 'hare', gait: tt * 0.3 });
      } },
    { cap: 'comic.hare.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 220, 300, { skin: 'hare', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Snow Leopard: close calls, on purpose ---- */
COMICS.leopard = [
  [
    { cap: 'comic.leopard.1.1', draw: function (c, tt) {
        cmSnow(c);
        cmThing(c, 'rock', 160, 120, 150);
        cmCreature(c, 160, 96, 70, { skin: 'leopard', eye: { shut: 1, wide: 1, lx: 0, ly: 0.6 } });
      } },
    { cap: 'comic.leopard.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 380, { skin: 'leopard', eye: { shut: 1, wide: 1, lx: 0.5, ly: 0 } });
      } },
    { cap: 'comic.leopard.1.3', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 150, 100, 90, { skin: 'leopard', gait: tt * 0.6 });
        cmSpeed(c, 10, 0.6);
      } }
  ],
  [
    { cap: 'comic.leopard.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 200, 50, 70);
        cmCreature(c, 150, 150, 80, { skin: 'leopard', gait: tt * 0.6, eye: { shut: 1, wide: 1, lx: 0.6, ly: -0.8 } });
      } },
    { cap: 'comic.leopard.2.2', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 214, 100, 76);
        cmCreature(c, 140, 110, 82, { skin: 'leopard', ang: -0.3, gait: tt * 0.6, eye: { shut: 1, wide: 1.4, lx: 0.8, ly: 0 } });
        cmSpark(c, 180, 104, 12, 1);
        cmSfx(c, cmWord('hud.close'), 120, 40, 28, -0.1);
      } },
    { cap: 'comic.leopard.2.3', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 150, 124, 86, { skin: 'leopard' });
        cmTag(c, 250, 60, '+30', '#ffe066');
        cmCombo(c, 250, 100, 'x2');
      } }
  ],
  [
    { cap: 'comic.leopard.3.1', draw: function (c, tt) {
        cmIce(c);
        [[90, 40], [230, 100], [90, 160]].forEach(function (p) { cmThing(c, 'rock', p[0], p[1], 56); });
        c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.lineCap = 'round'; c.setLineDash([2, 10]);
        c.beginPath(); c.moveTo(160, 200); c.bezierCurveTo(140, 170, 190, 130, 180, 100); c.bezierCurveTo(170, 70, 130, 60, 130, 20); c.stroke(); c.restore();
        cmCreature(c, 160, 186, 54, { skin: 'leopard', gait: tt * 0.6 });
      } },
    { cap: 'comic.leopard.3.2', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 214, 110, 70);
        cmCreature(c, 146, 112, 82, { skin: 'leopard', gait: tt * 0.6 });
        cmSpark(c, 182, 112, 12, 1);
        cmSfx(c, cmWord('hud.perfect'), 150, 40, 28, -0.08);
      } },
    { cap: 'comic.leopard.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'leopard', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- stage pieces for the last eight ---- */
/* a crevasse right across the run, blue going down to black */
function cmCrack(c, y, h) {
  c.save();
  var g = c.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  g.addColorStop(0, '#1d5f8f'); g.addColorStop(0.5, '#06213f'); g.addColorStop(1, '#2a7ab0');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, y - h / 2);
  for (var x = 0; x <= COMIC_W; x += 20) c.lineTo(x, y - h / 2 + Math.sin(x * 0.07) * 4);
  for (x = COMIC_W; x >= 0; x -= 20) c.lineTo(x, y + h / 2 + Math.sin(x * 0.05 + 1) * 4);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(220,245,255,.9)'; c.lineWidth = 2.5; c.stroke();
  c.restore();
}
/* the ramp before it: a packed-snow wedge, `w` wide */
function cmRamp(c, x, y, w) {
  c.save();
  var g = c.createLinearGradient(0, y + 30, 0, y);
  g.addColorStop(0, '#e9f6fd'); g.addColorStop(1, '#ffffff');
  c.fillStyle = g; c.strokeStyle = '#7fb2d4'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(x - w / 2, y + 30); c.lineTo(x - w / 2 + 8, y); c.lineTo(x + w / 2 - 8, y); c.lineTo(x + w / 2, y + 30); c.closePath();
  c.fill(); c.stroke();
  c.strokeStyle = 'rgba(127,178,212,.5)'; c.lineWidth = 1.2;
  for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - w / 2 + 4, y + i * 7.5); c.lineTo(x + w / 2 - 4, y + i * 7.5); c.stroke(); }
  c.restore();
}
/* a crystal ring hanging over the run, seen from above: an arch of ice */
function cmRing(c, x, y, w, glow) {
  c.save();
  if (glow) cmGlow(c, x, y, w * 0.7, glow);
  c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 7;
  c.beginPath(); c.ellipse(x, y, w / 2, w * 0.2, 0, Math.PI, 0); c.stroke();
  c.strokeStyle = '#7cc8ee'; c.lineWidth = 3; c.stroke();
  for (var i = 0; i <= 6; i++) {
    var a = Math.PI + i / 6 * Math.PI, px = x + Math.cos(a) * w / 2, py = y + Math.sin(a) * w * 0.2;
    c.fillStyle = '#bff0ff'; c.strokeStyle = '#3b8fc4'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(px, py - 7); c.lineTo(px + 4, py); c.lineTo(px, py + 7); c.lineTo(px - 4, py); c.closePath(); c.fill(); c.stroke();
  }
  [-1, 1].forEach(function (k) {                     // the posts
    c.fillStyle = '#9fd6f3'; c.strokeStyle = '#3b8fc4'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(x + k * w / 2, y, 6, 4, 0, 0, 6.2832); c.fill(); c.stroke();
  });
  c.restore();
}
/* night: a dark sky, stars, and the snow below lit blue */
function cmNight(c, tt) {
  var g = c.createLinearGradient(0, 0, 0, COMIC_H);
  g.addColorStop(0, '#0b1633'); g.addColorStop(0.65, '#1c2f5c'); g.addColorStop(1, '#3d5b8c');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  for (var i = 0; i < 40; i++) {
    var a = 0.4 + 0.5 * Math.abs(Math.sin(i * 7.1 + (tt || 0) * 0.05));
    c.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
    c.beginPath(); c.arc((i * 83) % COMIC_W, (i * 37) % 120, i % 5 ? 0.9 : 1.6, 0, 6.2832); c.fill();
  }
  c.fillStyle = '#c9dcf0';
  c.beginPath(); c.moveTo(0, 150); c.quadraticCurveTo(160, 128, COMIC_W, 152); c.lineTo(COMIC_W, COMIC_H); c.lineTo(0, COMIC_H); c.closePath(); c.fill();
}
/* the northern lights: soft green curtains that sway */
function cmAurora(c, tt, a) {
  c.save(); c.globalCompositeOperation = 'lighter';
  for (var b = 0; b < 3; b++) {
    var g = c.createLinearGradient(0, 10 + b * 14, 0, 100 + b * 10);
    g.addColorStop(0, 'rgba(120,255,190,0)'); g.addColorStop(0.5, 'rgba(90,255,170,' + (0.32 * (a || 1)).toFixed(2) + ')');
    g.addColorStop(1, 'rgba(160,110,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 30 + b * 16);
    for (var x = 0; x <= COMIC_W; x += 16) c.lineTo(x, 30 + b * 16 + Math.sin(x * 0.02 + tt * 0.04 + b * 2) * 16);
    for (x = COMIC_W; x >= 0; x -= 16) c.lineTo(x, 96 + b * 12 + Math.sin(x * 0.03 + tt * 0.03 + b) * 10);
    c.closePath(); c.fill();
  }
  c.restore();
}
/* open sea under a grey sky, with the ice edge along the bottom */
function cmSea(c, tt, dusk) {
  var g = c.createLinearGradient(0, 0, 0, 130);
  g.addColorStop(0, dusk ? '#4a5a78' : '#9fc6e4'); g.addColorStop(1, dusk ? '#22385a' : '#2f6f9f');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5;
  for (var i = 0; i < 9; i++) {
    var y = 30 + i * 11, o = (tt * 0.6 + i * 37) % 60;
    c.beginPath(); for (var x = -60 + o; x < COMIC_W; x += 60) { c.moveTo(x, y); c.quadraticCurveTo(x + 10, y - 3, x + 20, y); } c.stroke();
  }
  c.fillStyle = '#f2f9fe';
  c.beginPath(); c.moveTo(0, 140); for (var x2 = 0; x2 <= COMIC_W; x2 += 32) c.lineTo(x2, 136 + (x2 % 64 ? 6 : 0)); c.lineTo(COMIC_W, COMIC_H); c.lineTo(0, COMIC_H); c.closePath(); c.fill();
  c.strokeStyle = '#9cc7e2'; c.lineWidth = 2; c.stroke();
}
/* falling snow across the panel; heavy for a storm */
function cmFlakes(c, tt, n, slant) {
  c.save(); c.fillStyle = 'rgba(255,255,255,.85)';
  for (var i = 0; i < n; i++) {
    var x = (i * 47 + tt * (slant || 1) * 3) % COMIC_W, y = (i * 29 + tt * 2) % COMIC_H;
    c.beginPath(); c.arc(x, y, 1.2 + (i % 3) * 0.8, 0, 6.2832); c.fill();
  }
  c.restore();
}
/* an egg, held */
function cmEgg(c, x, y, s) {
  c.save();
  var g = c.createRadialGradient(x - s * 0.2, y - s * 0.3, 1, x, y, s);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#d6dde6');
  c.fillStyle = g; c.strokeStyle = '#8a9aae'; c.lineWidth = 1.5;
  c.beginPath(); c.ellipse(x, y, s * 0.7, s * 0.9, 0, 0, 6.2832); c.fill(); c.stroke();
  c.restore();
}
/* a big orca fin cutting the water */
function cmFin(c, x, y, s) {
  c.save();
  c.fillStyle = '#14181f';
  c.beginPath(); c.moveTo(x - s * 0.4, y); c.quadraticCurveTo(x - s * 0.1, y - s * 0.5, x + s * 0.12, y - s); c.quadraticCurveTo(x + s * 0.05, y - s * 0.45, x + s * 0.4, y); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2;
  c.beginPath(); c.ellipse(x, y + 2, s * 0.6, s * 0.08, 0, 0, Math.PI); c.stroke();
  c.restore();
}
/* a shadow on the snow, of something up in the air */
function cmShadow(c, x, y, r) {
  c.save(); c.fillStyle = 'rgba(20,50,90,.25)';
  c.beginPath(); c.ellipse(x, y, r, r * 0.45, 0, 0, 6.2832); c.fill(); c.restore();
}
/* a row of rocks right across, with one gap at `gx` */
function cmWall(c, y, gx, gw, size) {
  for (var x = 26; x < COMIC_W; x += size * 0.9) if (Math.abs(x - gx) > gw / 2) cmThing(c, 'rock', x, y, size);
}
/* the owl's line: gold dots curving through the gaps */
function cmSight(c, pts, tt) {
  c.save(); c.fillStyle = '#ffcd3a';
  for (var i = 0; i < pts.length - 1; i++) {
    for (var k = 0; k < 6; k++) {
      var u = k / 6, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
      var a = 0.5 + 0.5 * Math.sin(tt * 0.2 - (i * 6 + k) * 0.6);
      c.globalAlpha = 0.45 + 0.55 * a;
      c.beginPath(); c.arc(x, y, 3.2, 0, 6.2832); c.fill();
    }
  }
  c.restore();
}

/* ---- Compass: never once lost ---- */
COMICS.compass = [
  [
    { cap: 'comic.compass.1.1', draw: function (c, tt) {
        cmSnow(c);
        c.save(); c.strokeStyle = 'rgba(6,42,120,.25)'; c.lineWidth = 2;            // a compass rose drawn in the snow
        c.beginPath(); c.arc(160, 104, 70, 0, 6.2832); c.stroke();
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; c.beginPath(); c.moveTo(160 + Math.cos(a) * (i % 2 ? 56 : 44), 104 + Math.sin(a) * (i % 2 ? 56 : 44)); c.lineTo(160 + Math.cos(a) * 76, 104 + Math.sin(a) * 76); c.stroke(); }
        c.restore();
        cmCreature(c, 160, 110, 76, { skin: 'compass', ang: Math.sin(tt * 0.05) * 0.5 });
      } },
    { cap: 'comic.compass.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 236, 380, { skin: 'compass', eye: { shut: 1, wide: 1, lx: 0.3, ly: 0 } });
      } },
    { cap: 'comic.compass.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 124, 86, { skin: 'compass', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.compass.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'fish', 160, 70, 40, tt);
        cmCreature(c, 160, 150, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.2, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.compass.2.2', draw: function (c, tt) {
        cmIce(c);
        for (var i = 0; i < 12; i++) cmThing(c, 'fish', 70 + (i % 4) * 60 + (Math.floor(i / 4) % 2) * 28, 40 + Math.floor(i / 4) * 34, 34, tt + i * 4);
        cmCreature(c, 160, 172, 50, { skin: 'compass', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.compass.2.3', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 120, 86, { skin: 'compass', gait: tt * 0.5 });
        for (var i = 0; i < 5; i++) { var a = i * 1.26 + tt * 0.04; cmThing(c, 'fish', 160 + Math.cos(a) * 90, 110 + Math.sin(a) * 60, 30, tt + i * 6); }
        cmSfx(c, cmWord('comic.sfx.gulp'), 250, 40, 28, 0.1);
      } }
  ],
  [
    { cap: 'comic.compass.3.1', draw: function (c, tt) {
        cmIce(c);
        c.save(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; c.setLineDash([2, 10]);
        c.beginPath(); c.moveTo(80, 190); c.bezierCurveTo(60, 120, 250, 120, 240, 50); c.stroke(); c.restore();
        for (var i = 0; i < 6; i++) cmThing(c, 'fish', 216 + (i % 3) * 24, 30 + Math.floor(i / 3) * 26, 26, tt + i * 4);
        cmCreature(c, 80, 176, 54, { skin: 'compass', gait: tt * 0.5 });
      } },
    { cap: 'comic.compass.3.2', draw: function (c, tt) {
        cmSnow(c);
        for (var i = 0; i < 15; i++) cmThing(c, 'fish', 60 + (i % 5) * 50, 40 + Math.floor(i / 5) * 36, 30, tt + i * 3);
        cmTag(c, 160, 168, '+15');
      } },
    { cap: 'comic.compass.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'compass', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Snowy Owl: she always knows the way ---- */
COMICS.owl = [
  [
    { cap: 'comic.owl.1.1', draw: function (c, tt) {
        cmNight(c, tt);
        cmCreature(c, 160, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1.2, lx: Math.sin(tt * 0.04), ly: 0 } });
      } },
    { cap: 'comic.owl.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 400, { skin: 'owl', eye: { shut: 1, wide: 1.3, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.owl.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 124, 80, { skin: 'owl', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.owl.2.1', draw: function (c, tt) {
        cmIce(c);
        cmWall(c, 60, 214, 80, 46);
        cmCreature(c, 140, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.owl.2.2', draw: function (c, tt) {
        cmIce(c);
        cmWall(c, 60, 214, 80, 46);
        cmSight(c, [[140, 150], [180, 110], [214, 60], [220, 10]], tt);
        cmCreature(c, 140, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1.2, lx: 0.6, ly: -1 } });
      } },
    { cap: 'comic.owl.2.3', draw: function (c, tt) {
        cmIce(c);
        cmWall(c, 110, 160, 80, 46);
        cmCreature(c, 160, 100, 70, { skin: 'owl', gait: tt * 0.5 });
        cmSpeed(c, 8, 0.5);
      } }
  ],
  [
    { cap: 'comic.owl.3.1', draw: function (c, tt) {
        cmIce(c);
        cmWall(c, 50, 80, 74, 40); cmWall(c, 120, 230, 74, 40);
        cmSight(c, [[160, 196], [230, 150], [230, 120], [130, 80], [80, 50], [80, 0]], tt);
        cmCreature(c, 160, 186, 50, { skin: 'owl', gait: tt * 0.5 });
      } },
    { cap: 'comic.owl.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.4);
        cmCreature(c, 160, 120, 86, { skin: 'owl', gait: tt * 0.4, eye: { shut: 0.5, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.owl.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 360, { skin: 'owl', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Walrus: the rings know an old friend ---- */
COMICS.walrus = [
  [
    { cap: 'comic.walrus.1.1', draw: function (c, tt) {
        cmSea(c, tt);
        c.fillStyle = '#ffffff'; c.strokeStyle = '#9cc7e2'; c.lineWidth = 2;        // his floe
        c.beginPath(); c.moveTo(80, 80); c.lineTo(230, 70); c.lineTo(250, 110); c.lineTo(100, 124); c.closePath(); c.fill(); c.stroke();
        cmCreature(c, 166, 98, 70, { skin: 'walrus', ang: 1.4, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.walrus.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 240, 360, { skin: 'walrus', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.walrus.1.3', draw: function (c, tt) {
        cmIce(c);
        cmRing(c, 160, 50, 120, 0.25);
        cmCreature(c, 160, 160, 70, { skin: 'walrus', gait: tt * 0.4 });
      } }
  ],
  [
    { cap: 'comic.walrus.2.1', draw: function (c, tt) {
        cmIce(c);
        cmRing(c, 160, 70, 90);
        cmCreature(c, 160, 150, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.walrus.2.2', draw: function (c, tt) {
        cmIce(c);
        cmRing(c, 160, 80, 90 + Math.min(1, tt / 30) * 120, 0.4);
        cmCreature(c, 160, 130, 76, { skin: 'walrus', gait: tt * 0.4 });
        cmSpark(c, 60, 70, 10, 1); cmSpark(c, 262, 70, 10, 1);
      } },
    { cap: 'comic.walrus.2.3', draw: function (c, tt) {
        cmIce(c);
        cmRing(c, 160, 150, 220, 0.3);
        cmCreature(c, 160, 110, 76, { skin: 'walrus' });
        cmCombo(c, 250, 50, 'x3');
      } }
  ],
  [
    { cap: 'comic.walrus.3.1', draw: function (c, tt) {
        cmIce(c);
        cmRing(c, 110, 40, 150, 0.2); cmRing(c, 210, 110, 150, 0.2);
        cmCreature(c, 140, 170, 54, { skin: 'walrus', gait: tt * 0.4 });
      } },
    { cap: 'comic.walrus.3.2', draw: function (c, tt) {
        cmIce(c);
        cmCreature(c, 160, 130, 86, { skin: 'walrus', gait: tt * 0.4 });
        cmTag(c, 70, 50, '+90', '#ffe066'); cmTag(c, 250, 70, '+90', '#ffe066');
      } },
    { cap: 'comic.walrus.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 214, 300, { skin: 'walrus', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Narwhal: the ramp runs wide for her ---- */
COMICS.narwhal = [
  [
    { cap: 'comic.narwhal.1.1', draw: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
        cmHole(c, 160, 120, 70, 36);
        c.save(); c.beginPath(); c.rect(0, 0, COMIC_W, 124); c.clip();             // only the horn, up through the hole
        var up = Math.min(1, tt / 30) * 40;
        c.fillStyle = '#f2ead6'; c.strokeStyle = '#a89a78'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(154, 124); c.lineTo(166, 124); c.lineTo(161, 64 - up); c.lineTo(159, 64 - up); c.closePath(); c.fill(); c.stroke();
        c.restore();
        cmSpark(c, 186, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } },
    { cap: 'comic.narwhal.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 250, 340, { skin: 'narwhal', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.narwhal.1.3', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 130, 84, { skin: 'narwhal', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.narwhal.2.1', draw: function (c, tt) {
        cmIce(c);
        cmCrack(c, 50, 44);
        cmCreature(c, 160, 160, 64, { skin: 'narwhal', gait: tt * 0.5, eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.narwhal.2.2', draw: function (c, tt) {
        cmIce(c);
        cmCrack(c, 40, 40);
        cmRamp(c, 160, 62, 80 + Math.min(1, tt / 30) * 180);
        cmCreature(c, 160, 160, 60, { skin: 'narwhal', gait: tt * 0.5 });
      } },
    { cap: 'comic.narwhal.2.3', draw: function (c, tt) {
        cmIce(c);
        cmCrack(c, 120, 60);
        cmShadow(c, 160, 170, 22);                                                 // her shadow, far below
        cmCreature(c, 160, 90, 90, { skin: 'narwhal', eye: { shut: 1, wide: 1.3, lx: 0, ly: -1 } });
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 36, 26, -0.1, '#bff2ff');
      } }
  ],
  [
    { cap: 'comic.narwhal.3.1', draw: function (c, tt) {
        cmIce(c);
        cmCrack(c, 150, 50);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 80, 96, { skin: 'narwhal' });
      } },
    { cap: 'comic.narwhal.3.2', draw: function (c, tt) {
        cmIce(c);
        cmPuff(c, 160, 130, 40, 10);
        cmCreature(c, 160, 110, 84, { skin: 'narwhal' });
        cmSfx(c, cmWord('comic.sfx.splash'), 250, 50, 26, 0.12, '#bff2ff');
      } },
    { cap: 'comic.narwhal.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 280, { skin: 'narwhal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Reindeer: he holds his line ---- */
COMICS.reindeer = [
  [
    { cap: 'comic.reindeer.1.1', draw: function (c, tt) {
        cmSnow(c);
        for (var i = 0; i < 5; i++) cmCreature(c, 40 + i * 60 + ((tt * 0.4) % 60), 60 + (i % 2) * 70, 44, { skin: 'reindeer', ang: -1.57, gait: tt * 0.3 + i });
      } },
    { cap: 'comic.reindeer.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 270, 330, { skin: 'reindeer', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.reindeer.1.3', draw: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 70, 0);
        cmCreature(c, 160, 130, 64, { skin: 'reindeer', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.reindeer.2.1', draw: function (c, tt) {
        cmSnow(c);
        cmChute(c, 140, 70, 70);
        cmCreature(c, 260, 100, 56, { skin: 'snowcap', ang: 0.6, eye: { shut: 1, wide: 1.4, lx: 0.8, ly: 0 } });
        cmSfx(c, cmWord('comic.sfx.oops'), 250, 40, 26, 0.1);
      } },
    { cap: 'comic.reindeer.2.2', draw: function (c, tt) {
        cmSnow(c);
        cmChute(c, 140, 70, 70);
        cmCreature(c, cmChuteX(140, 70, 110), 110, 60, { skin: 'reindeer', gait: tt * 0.5 });
      } },
    { cap: 'comic.reindeer.2.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'rock', 104, 90, 70); cmThing(c, 'rock', 216, 90, 70);
        cmCreature(c, 160, 110, 60, { skin: 'reindeer', gait: tt * 0.5 });
      } }
  ],
  [
    { cap: 'comic.reindeer.3.1', draw: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 60, 60);
        for (var y = 30; y < 200; y += 60) cmCreature(c, cmChuteX(160, 60, y), y, 30, { skin: 'reindeer', still: true });
      } },
    { cap: 'comic.reindeer.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 160, 124, 80, { skin: 'reindeer', gait: tt * 0.5 });
      } },
    { cap: 'comic.reindeer.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 260, 300, { skin: 'reindeer', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Emperor: he slides for two. The sad one. ---- */
COMICS.emperor = [
  [
    { cap: 'comic.emperor.1.1', draw: function (c, tt) {
        cmNight(c, tt);
        cmFlakes(c, tt, 30, 1.5);
        [[110, 160], [150, 154], [190, 160], [130, 176], [170, 178], [210, 172], [90, 176]].forEach(function (p, i) {
          cmCreature(c, p[0], p[1], 44, { skin: 'emperor', ang: Math.PI + Math.sin(i) * 0.3, still: true });
        });
      } },
    { cap: 'comic.emperor.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 120, 120, 90, { skin: 'emperor', ang: 1.2, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmCreature(c, 200, 120, 84, { skin: 'emperor', ang: -1.2, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        c.save(); c.fillStyle = '#ff6f8d';                                         // a small heart between them
        c.translate(160, 64 - Math.sin(tt * 0.1) * 3); c.beginPath();
        c.moveTo(0, 6); c.bezierCurveTo(-12, -4, -6, -14, 0, -6); c.bezierCurveTo(6, -14, 12, -4, 0, 6); c.fill(); c.restore();
      } },
    { cap: 'comic.emperor.1.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 130, 110, 90, { skin: 'emperor', eye: { shut: 1, wide: 1, lx: 0.3, ly: 0.4 } });
        cmEgg(c, 130, 158, 18);
        cmCreature(c, 250, 70 - Math.min(1, tt / 40) * 30, 60, { skin: 'emperor', ang: -0.4, gait: tt * 0.4 });
      } }
  ],
  [
    { cap: 'comic.emperor.2.1', draw: function (c, tt) {
        cmNight(c, tt);
        cmFlakes(c, tt, 90, 3);
        cmCreature(c, 160, 140, 90, { skin: 'emperor', eye: { shut: 0.2, wide: 1, lx: 0, ly: 0 } });
        cmEgg(c, 160, 186, 16);
      } },
    { cap: 'comic.emperor.2.2', draw: function (c, tt) {
        cmNight(c, tt);
        for (var i = 0; i < 4; i++) {                                              // the moons go round
          c.fillStyle = 'rgba(255,250,220,' + (0.25 + i * 0.2) + ')';
          c.beginPath(); c.arc(60 + i * 66, 40 + Math.abs(i - 1.5) * 10, 11, 0, 6.2832); c.fill();
        }
        cmCreature(c, 160, 150, 80, { skin: 'emperor', eye: { shut: 1, wide: 1, lx: 0, ly: -0.6 } });
      } },
    { cap: 'comic.emperor.2.3', draw: function (c, tt) {
        cmSea(c, tt);
        [[70, 150], [140, 160], [230, 152]].forEach(function (p, i) {
          var come = Math.max(0, Math.min(1, (tt - i * 10) / 30));
          cmCreature(c, p[0], 100 + come * (p[1] - 100), 44, { skin: 'emperor', ang: Math.PI, gait: tt * 0.4 + i });
        });
      } }
  ],
  [
    { cap: 'comic.emperor.3.1', draw: function (c, tt) {
        cmSea(c, tt, true);
        cmCreature(c, 160, 168, 60, { skin: 'emperor', still: true, eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.emperor.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
        cmCreature(c, 140, 124, 84, { skin: 'emperor', gait: tt * 0.5 });
        cmCombo(c, 250, 60, 'x2');
      } },
    { cap: 'comic.emperor.3.3', draw: function (c, tt) {
        cmNight(c, tt);
        c.save(); c.fillStyle = '#fff6c8';                                         // one star brighter than the rest
        c.shadowColor = '#fff6c8'; c.shadowBlur = 14;
        c.beginPath(); c.arc(250, 36, 3.5, 0, 6.2832); c.fill(); c.restore();
        cmCreature(c, 160, 206, 300, { skin: 'emperor', eye: { shut: 0.35, wide: 1, lx: 0.5, ly: -0.6 } });
      } }
  ]
];

/* ---- Orca: go big ---- */
COMICS.orca = [
  [
    { cap: 'comic.orca.1.1', draw: function (c, tt) {
        cmSea(c, tt);
        cmFin(c, 100 + (tt * 1.2) % 160, 100, 70);
      } },
    { cap: 'comic.orca.1.2', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 250, 340, { skin: 'orca', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } },
    { cap: 'comic.orca.1.3', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'bubble', 160, 120, 150, tt);
        cmCreature(c, 160, 124, 80, { skin: 'orca', gait: tt * 0.4 });
      } }
  ],
  [
    { cap: 'comic.orca.2.1', draw: function (c, tt) {
        cmIce(c);
        cmCrack(c, 40, 40);
        cmRamp(c, 160, 62, 120);
        cmCreature(c, 160, 160, 70, { skin: 'orca', gait: tt * 0.6, eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } },
    { cap: 'comic.orca.2.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 24, 1);
        cmCreature(c, 160, 100, 110, { skin: 'orca', eye: { shut: 1, wide: 1.2, lx: 0, ly: -1 } });
        cmSfx(c, cmWord('comic.sfx.whoosh'), 160, 30, 34, -0.06);
      } },
    { cap: 'comic.orca.2.3', draw: function (c, tt) {
        cmSnow(c);
        [[50, 40], [270, 60], [90, 150], [230, 170], [160, 90], [40, 110], [280, 130]].forEach(function (p) { cmThing(c, 'tree', p[0], p[1], 22); });
        cmShadow(c, 150, 140, 16);                                                 // her shadow, far below
        cmCreature(c, 170, 70, 120, { skin: 'orca' });
      } }
  ],
  [
    { cap: 'comic.orca.3.1', draw: function (c, tt) {
        cmIce(c);
        cmPuff(c, 160, 130, 60, 14);
        cmCreature(c, 160, 110, 100, { skin: 'orca' });
        cmSfx(c, cmWord('comic.sfx.splash'), 250, 40, 30, 0.12, '#bff2ff');
      } },
    { cap: 'comic.orca.3.2', draw: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
        cmCreature(c, 160, 150, 80, { skin: 'orca', gait: tt * 0.5 });
        cmCreature(c, 160, 16, 20, { skin: 'snowcap', still: true });
      } },
    { cap: 'comic.orca.3.3', draw: function (c, tt) {
        cmSnow(c);
        cmCreature(c, 160, 230, 280, { skin: 'orca', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

/* ---- Aurora: made of everything you have done ---- */
COMICS.aurora = [
  [
    { cap: 'comic.aurora.1.1', draw: function (c, tt) {
        cmNight(c, tt);
        cmAurora(c, tt, 1);
      } },
    { cap: 'comic.aurora.1.2', draw: function (c, tt) {
        cmNight(c, tt);
        cmAurora(c, tt, 0.7);
        var g = Math.min(1, tt / 40);
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(140,255,200,.5)'; c.lineWidth = 6;
        c.beginPath(); c.moveTo(160, 60); c.lineTo(160, 60 + g * 80); c.stroke(); c.restore();
        c.save(); c.globalAlpha = g; cmCreature(c, 160, 150, 60, { skin: 'aurora' }); c.restore();
      } },
    { cap: 'comic.aurora.1.3', draw: function (c, tt) {
        cmNight(c, tt);
        cmAurora(c, tt, 0.5);
        cmCreature(c, 160, 236, 360, { skin: 'aurora', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }
  ],
  [
    { cap: 'comic.aurora.2.1', draw: function (c, tt) {
        cmIce(c);
        cmThing(c, 'bubble', 160, 120, 150, tt);
        cmCreature(c, 160, 124, 80, { skin: 'aurora', gait: tt * 0.4 });
      } },
    { cap: 'comic.aurora.2.2', draw: function (c, tt) {
        cmIce(c);
        [[40, 40], [280, 50], [50, 170], [280, 160]].forEach(function (p, i) {
          var k = (tt * 0.01 + i * 0.2) % 0.6, x = p[0] + (160 - p[0]) * k, y = p[1] + (110 - p[1]) * k;
          cmPull(c, x, y, 160, 110, 0.6); cmThing(c, 'fish', x, y, 30, tt + i * 5);
        });
        cmCreature(c, 160, 110, 70, { skin: 'aurora' });
      } },
    { cap: 'comic.aurora.2.3', draw: function (c, tt) {
        cmSnow(c);
        for (var i = 0; i < 10; i++) cmThing(c, 'fish', 160 + Math.cos(i * 0.63 + tt * 0.03) * 110, 104 + Math.sin(i * 0.63 + tt * 0.03) * 70, 28, tt + i * 3);
        cmCreature(c, 160, 110, 70, { skin: 'aurora', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ],
  [
    { cap: 'comic.aurora.3.1', draw: function (c, tt) {
        cmNight(c, tt);
        cmAurora(c, tt, 1);
        cmCreature(c, 160, 170, 50, { skin: 'aurora', gait: tt * 0.4 });
      } },
    { cap: 'comic.aurora.3.2', draw: function (c, tt) {
        cmNight(c, tt);
        cmStars(c, 160, 70, 5, 5, 34);
        cmCreature(c, 160, 160, 56, { skin: 'aurora' });
      } },
    { cap: 'comic.aurora.3.3', draw: function (c, tt) {
        cmNight(c, tt);
        cmAurora(c, tt, 0.8);
        cmCreature(c, 160, 230, 300, { skin: 'aurora', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }
  ]
];

function comicFor(id) { return COMICS[id] || null; }
