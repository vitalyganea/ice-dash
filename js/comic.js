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
      cmDeep({ cap: 'comic.snowcap.1.1',
        back: function (c, tt) {
          cmSnow(c);
          cmChute(c, 200, 54, 40);
        },
        mid: function (c, tt) {
          [[40, 40], [70, 150], [280, 60], [262, 170], [110, 90]].forEach(function (p) {
            cmThing(c, 'tree', p[0], p[1], 44);
          });
          cmCreature(c, 200, 22 + Math.min(1, tt / 30) * 4, 46, { skin: 'snowcap' });
        } }),
      cmDeep({ cap: 'comic.snowcap.1.2',
        back: function (c, tt) {
          cmSnow(c);
        },
        mid: function (c, tt) {
          /* close on his face, eyes wide at what is below */
          cmCreature(c, 160, 250, 420, { skin: 'snowcap', eye: { shut: 1, wide: 1.25, lx: 0, ly: 0.6 } });
        },
        near: function (c, tt) {
          cmSpark(c, 250, 40, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
        } }),
      cmDeep({ cap: 'comic.snowcap.1.3',
        back: function (c, tt) {
          cmSnow(c);
          cmChute(c, 160, 70, 50);
        },
        mid: function (c, tt) {
          for (var i = 0; i < 6; i++) {
            var y = 18 + i * 32, x = cmChuteX(160, 50, y);
            cmThing(c, i === 3 ? 'gold' : 'fish', x, y, 30, tt + i * 10);
            cmSpark(c, x + 14, y - 10, 5, 0.5 + 0.5 * Math.sin(tt * 0.18 + i));
          }
        } })
    ],
    /* page two: the first slide */
    [
      cmDeep({ cap: 'comic.snowcap.2.1',
        back: function (c, tt) {
          cmIce(c);
        },
        mid: function (c, tt) {
          cmPuff(c, 160, 116, 46, 9);
          cmCreature(c, 160, 104, 120, { skin: 'snowcap', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        },
        near: function (c, tt) {
          cmSfx(c, cmWord('comic.sfx.flop'), 250, 46, 34, -0.18);
        } }),
      cmDeep({ cap: 'comic.snowcap.2.2',
        back: function (c, tt) {
          cmIce(c);
          cmSpeed(c, 16, 0.85);
        },
        mid: function (c, tt) {
          var drift = Math.min(1, tt / 40) * 30;
          cmThing(c, 'tree', 232, 42, 62);
          cmCreature(c, 130 + drift, 128, 92, { skin: 'snowcap', ang: 0.35, gait: tt * 0.5,
                                               eye: { shut: 1, wide: 1.3, lx: 0.6, ly: -0.6 } });
        },
        near: function (c, tt) {
          cmSfx(c, cmWord('comic.sfx.whee'), 70, 50, 30, -0.12, '#bff2ff');
        } }),
      cmDeep({ cap: 'comic.snowcap.2.3',
        back: function (c, tt) {
          cmIce(c);
          cmSpeed(c, 14, 0.7);
        },
        mid: function (c, tt) {
          /* the push: a ring where the tap landed, and the curve he swung on */
          var r = 18 + (tt % 40) * 0.8;
          cmThing(c, 'tree', 238, 70, 62);
          cmCreature(c, 132, 112, 92, { skin: 'snowcap', ang: -0.4, gait: tt * 0.5 });
          c.save(); c.strokeStyle = 'rgba(255,255,255,' + Math.max(0, 1 - (tt % 40) / 40).toFixed(2) + ')';
          c.lineWidth = 4; c.beginPath(); c.arc(132, 112, r, 0, 6.2832); c.stroke(); c.restore();
          c.save(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.lineCap = 'round';
          c.beginPath(); c.moveTo(196, 196); c.quadraticCurveTo(200, 140, 140, 118); c.stroke(); c.restore();
        },
        near: function (c, tt) {
          cmSfx(c, cmWord('comic.sfx.whoosh'), 70, 40, 30, -0.1);
        } })
    ],
    /* page three: the rule of the hill */
    [
      cmDeep({ cap: 'comic.snowcap.3.1',
        back: function (c, tt) {
          cmIce(c);
        },
        mid: function (c, tt) {
          /* the snow coming up behind him */
          var top = 128 - Math.min(1, tt / 60) * 10;
          cmCreature(c, 160, 70, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.4, lx: 0, ly: 0.8 } });
          var g = c.createLinearGradient(0, top, 0, COMIC_H);
          g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9dcec');
          c.fillStyle = g; c.fillRect(0, top + 10, COMIC_W, COMIC_H);
          for (var i = 0; i < 9; i++) {
            c.fillStyle = i % 2 ? '#ffffff' : '#eaf3fa';
            c.beginPath(); c.arc(i * 40 + 10, top + 10 + Math.sin(tt * 0.1 + i) * 4, 26, 0, 6.2832); c.fill();
          }
        },
        near: function (c, tt) {
          cmSfx(c, cmWord('comic.sfx.rumble'), 160, 168, 30, 0.04, '#dfe9f2');
        } }),
      cmDeep({ cap: 'comic.snowcap.3.2',
        back: function (c, tt) {
          cmIce(c);
        },
        mid: function (c, tt) {
          cmThing(c, 'tree', 50, 60, 54);
          cmThing(c, 'rock', 274, 140, 50);
          cmCreature(c, 160, 128, 88, { skin: 'snowcap', gait: tt * 0.5 });
          [[150, 66], [176, 40], [140, 18]].forEach(function (p, i) {
            cmThing(c, 'fish', p[0], p[1], 28, tt + i * 7);
          });
        },
        near: function (c, tt) {
          cmSpark(c, 186, 80, 8, 0.6 + 0.4 * Math.sin(tt * 0.25));
          cmSfx(c, cmWord('comic.sfx.gulp'), 250, 52, 28, 0.12);
        } }),
      cmDeep({ cap: 'comic.snowcap.3.3',
        back: function (c, tt) {
          cmSnow(c);
        },
        mid: function (c, tt) {
          cmCreature(c, 160, 214, 300, { skin: 'snowcap', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
        },
        near: function (c, tt) {
          cmSpark(c, 70, 50, 10, 0.5 + 0.5 * Math.sin(tt * 0.2));
          cmSpark(c, 256, 70, 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
        } })
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
/* ---- things half in an opening: a hole in the ice, a burrow ----
   An animal hauling out of a hole is drawn whole above the waterline `wl`,
   and below it only where the opening is, seen through the water (or lost in
   the burrow's dark). Under the ice it is not drawn at all. The seal used to
   be cut by a straight line across the hole, the lemming stood on top of
   its burrow, the narwhal was a spike stood upright (owner, 13 Nov 2026). */
function cmWetPath(c, x, y, rx, ry, wl) {
  c.beginPath();
  for (var i = 0; i <= 48; i++) {
    var a = i / 48 * 6.2832, py = y + Math.sin(a) * ry;
    if (wl !== undefined && py < wl) py = wl;
    if (i) c.lineTo(x + Math.cos(a) * rx, py); else c.moveTo(x + Math.cos(a) * rx, py);
  }
  c.closePath();
}
/* paint() into a picture of its own, tinted on its own pixels only and laid
   in at `a`: something seen through water, or in shadow. clip, if given,
   traces the part that shows. */
function cmUnder(c, tint, a, paint, clip, box) {
  var T = c.getTransform ? c.getTransform() : null;
  var cw = c.canvas && c.canvas.width, ch = c.canvas && c.canvas.height;
  if (!T || T.a === undefined || !cw || !ch || typeof document === 'undefined') {
    c.save(); if (clip) { clip(c); c.clip(); } c.globalAlpha = a * 0.6; paint(c); c.restore(); return;
  }
  /* only the part of the canvas the thing can cover (box, in stage units):
     three swimmers each through a whole panel's picture were the slowest
     panel of the emperor's comic on a phone */
  var bx = 0, by = 0, w = cw, h = ch;
  if (box) {
    var xs = [], ys = [];
    [[box[0], box[1]], [box[0] + box[2], box[1]], [box[0], box[1] + box[3]], [box[0] + box[2], box[1] + box[3]]].forEach(function (q) {
      xs.push(T.a * q[0] + T.c * q[1] + T.e); ys.push(T.b * q[0] + T.d * q[1] + T.f);
    });
    bx = Math.max(0, Math.floor(Math.min.apply(null, xs)) - 2); by = Math.max(0, Math.floor(Math.min.apply(null, ys)) - 2);
    w = Math.min(cw, Math.ceil(Math.max.apply(null, xs)) + 2) - bx; h = Math.min(ch, Math.ceil(Math.max.apply(null, ys)) + 2) - by;
    if (w <= 0 || h <= 0) return;
  }
  var B = cmBuf('under', w, h), b = B.c;
  b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
  b.clearRect(0, 0, w, h);
  b.setTransform(T.a, T.b, T.c, T.d, T.e - bx, T.f - by); b.lineJoin = 'round'; b.lineCap = 'round';
  b.save(); if (clip) { clip(b); b.clip(); } paint(b); b.restore();
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.globalCompositeOperation = 'source-atop'; b.fillStyle = tint; b.globalAlpha = 0.62;
  b.fillRect(0, 0, w, h);
  b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = a; c.drawImage(B.cv, 0, 0, w, h, bx, by, w, h); c.restore();
}
function cmIn(c, x, y, rx, ry, wl, tint, a, paint) {
  c.save(); c.beginPath(); c.rect(-40, -40, COMIC_W + 80, wl + 40); c.clip(); paint(c); c.restore();
  cmUnder(c, tint, a, paint, function (cc) { cmWetPath(cc, x, y, rx, ry, wl); }, [x - rx, Math.max(y - ry, wl), rx * 2, y + ry - Math.max(y - ry, wl)]);
}
/* along a shore: below `sy` on the ice as it is, above it in the sea seen
   through the water */
function cmShore(c, sy, paint, box) {
  c.save(); c.beginPath(); c.rect(-40, sy, COMIC_W + 80, COMIC_H + 40); c.clip(); paint(c); c.restore();
  cmUnder(c, '#0d3b66', 0.85, paint, function (cc) { cc.beginPath(); cc.rect(-40, -40, COMIC_W + 80, sy + 40); }, box);
}
/* rings spreading on still water from (x, y), kept inside the hole */
function cmRipples(c, x, y, r, tt, hole) {
  c.save();
  if (hole) { c.beginPath(); c.ellipse(hole[0], hole[1], hole[2], hole[3], 0, 0, 6.2832); c.clip(); }
  c.strokeStyle = '#e8f8ff'; c.lineWidth = 1.4;
  for (var i = 0; i < 3; i++) {
    var k = (tt * 0.012 + i / 3) % 1;
    c.globalAlpha = 0.6 * (1 - k);
    c.beginPath(); c.ellipse(x, y, r * (0.7 + k), r * (0.7 + k) * 0.6, 0, 0, 6.2832); c.stroke();
  }
  c.restore();
}
/* a floe: a raft of old ice, uneven, its sides going down green-blue into
   the water around it */
function cmFloe(c, pts) {
  /* broken edges, straight between the corners and only a little worn at
     them: smoothed all round it came out an oval, a plate on the water */
  function trace(grow, dx0, dy0) {
    var cx = 0, cy = 0; pts.forEach(function (p) { cx += p[0]; cy += p[1]; }); cx /= pts.length; cy /= pts.length;
    var q = pts.map(function (p) { var dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * grow + (dx0 || 0), p[1] + dy / l * grow + (dy0 || 0)]; });
    c.beginPath();
    for (var i = 0; i < q.length; i++) {
      var a = q[i], b = q[(i + 1) % q.length], z = q[(i + q.length - 1) % q.length];
      var p0 = [a[0] + (z[0] - a[0]) * 0.12, a[1] + (z[1] - a[1]) * 0.12], p1 = [a[0] + (b[0] - a[0]) * 0.12, a[1] + (b[1] - a[1]) * 0.12];
      if (!i) c.moveTo(p0[0], p0[1]); else c.lineTo(p0[0], p0[1]);
      c.quadraticCurveTo(a[0], a[1], p1[0], p1[1]);
    }
    c.closePath();
  }
  c.save();
  c.fillStyle = 'rgba(140,215,235,.5)'; trace(6, 2, 4); c.fill();     // the ice going down under the water
  c.fillStyle = '#bfe6f3'; trace(0, 0, 3.5); c.fill();               // its side, standing out of the sea
  var g = c.createLinearGradient(0, 60, 0, 130);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3f1fa');
  c.fillStyle = g; trace(0); c.fill();
  c.strokeStyle = 'rgba(120,180,215,.7)'; c.lineWidth = 1.5; c.stroke();
  c.fillStyle = 'rgba(200,225,240,.5)';                               // old snow lying in drifts on its top
  c.beginPath(); c.ellipse(pts[2][0] - 18, pts[2][1] + 14, 26, 5, -0.05, 0, 6.2832); c.fill();
  c.beginPath(); c.ellipse(pts[7][0] + 10, pts[7][1] - 12, 30, 4.5, 0.04, 0, 6.2832); c.fill();
  c.restore();
}
/* a knitted scarf along a curve (four points of a bezier): ribbed, striped,
   its fringe loose at both ends, lying in the snow */
function cmScarf(c, P, w) {
  function at(t) {
    var u = 1 - t;
    return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0],
            u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]];
  }
  var N = 48, L = [], R = [], D = [];
  for (var i = 0; i <= N; i++) {
    var t = i / N, p = at(t), q = at(Math.min(1, t + 0.01)), o = at(Math.max(0, t - 0.01));
    var dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1;
    var nx = -dy / l, ny = dx / l, hw = w / 2 * (1 + 0.06 * Math.sin(t * 19));   // a soft wool band, not a ruler
    L.push([p[0] + nx * hw, p[1] + ny * hw]); R.push([p[0] - nx * hw, p[1] - ny * hw]); D.push([dx / l, dy / l, nx, ny, p]);
  }
  function band(i0, i1) {
    c.beginPath(); c.moveTo(L[i0][0], L[i0][1]);
    for (var j = i0 + 1; j <= i1; j++) c.lineTo(L[j][0], L[j][1]);
    for (j = i1; j >= i0; j--) c.lineTo(R[j][0], R[j][1]);
    c.closePath();
  }
  c.save();
  c.translate(2, 3); c.fillStyle = 'rgba(40,70,110,.16)'; band(0, N); c.fill(); c.translate(-2, -3);   // its shadow on the snow
  var g = c.createLinearGradient(0, 80, 0, 160);
  g.addColorStop(0, '#e9524a'); g.addColorStop(1, '#c23a32');
  c.fillStyle = g; band(0, N); c.fill();
  c.fillStyle = '#f6efe6';                                            // the stripes, two by two
  [[6, 8], [10, 12], [36, 38], [40, 42]].forEach(function (s2) { band(s2[0], s2[1]); c.fill(); });
  c.strokeStyle = 'rgba(110,20,16,.28)'; c.lineWidth = 0.8;           // the knit: rows of small vees
  for (i = 1; i < N; i++) {
    var d = D[i], p2 = d[4];
    for (var k = -1; k <= 1; k++) {
      var cx = p2[0] + d[2] * k * w * 0.28, cy = p2[1] + d[3] * k * w * 0.28;
      c.beginPath(); c.moveTo(cx - d[2] * 1.6 - d[0] * 1.4, cy - d[3] * 1.6 - d[1] * 1.4);
      c.lineTo(cx, cy); c.lineTo(cx + d[2] * 1.6 - d[0] * 1.4, cy + d[3] * 1.6 - d[1] * 1.4); c.stroke();
    }
  }
  c.strokeStyle = 'rgba(120,24,18,.45)'; c.lineWidth = 1.2; band(0, N); c.stroke();
  [[0, -1], [N, 1]].forEach(function (e) {                            // the fringe
    var d = D[e[0]], p3 = d[4];
    c.strokeStyle = '#d8453c'; c.lineWidth = 1.8;
    for (var f = -2; f <= 2; f++) {
      var bx = p3[0] + d[2] * f * w * 0.2, by = p3[1] + d[3] * f * w * 0.2;
      c.beginPath(); c.moveTo(bx, by);
      c.quadraticCurveTo(bx + e[1] * d[0] * 6 + f, by + e[1] * d[1] * 6 + 2, bx + e[1] * d[0] * 11 + f * 1.5, by + e[1] * d[1] * 11 + 3);
      c.stroke();
    }
  });
  c.fillStyle = 'rgba(255,255,255,.85)';                              // a little snow fallen on it
  [[0.22, 0.2], [0.5, -0.3], [0.7, 0.25], [0.9, -0.1]].forEach(function (s3) {
    var d = D[Math.round(s3[0] * N)], p4 = d[4];
    c.beginPath(); c.arc(p4[0] + d[2] * s3[1] * w, p4[1] + d[3] * s3[1] * w, 1.3, 0, 6.2832); c.fill();
  });
  c.restore();
}
/* the egg on an emperor's feet, the warm fold of his belly over it: where an
   emperor keeps it all winter. (x, y, size) are the penguin's own. */
function cmBrood(c, x, y, size) {
  var u = size / 112 * 1.07, ey = y + 26 * u, es = 12 * u;
  cmEgg(c, x, ey, es);
  var B = (typeof SKIN_BY_ID !== 'undefined' && SKIN_BY_ID.emperor) ? SKIN_BY_ID.emperor.body : ['#3c4558', '#1e2430', '#0d1017'];
  c.save();
  var g = c.createLinearGradient(x, ey - es * 1.3, x, ey - es * 0.2);
  g.addColorStop(0, B[1]); g.addColorStop(1, B[2]);
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - es * 0.9, ey - es * 1.25);
  c.lineTo(x - es * 0.9, ey - es * 0.5);
  c.quadraticCurveTo(x, ey + es * 0.05, x + es * 0.9, ey - es * 0.5);
  c.lineTo(x + es * 0.9, ey - es * 1.25); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,40,60,.35)'; c.lineWidth = 1.2 * u;          // its shadow on the shell
  c.beginPath(); c.moveTo(x - es * 0.7, ey - es * 0.3); c.quadraticCurveTo(x, ey + es * 0.22, x + es * 0.7, ey - es * 0.3); c.stroke();
  c.restore();
}
/* an orca's tall back fin cutting the water, the dark of her back under it */
function cmOrcaFin(c, x, y, s, tt) {
  /* s is her length. The fin stands about a quarter of it, as an orca's
     does: drawn the height of her whole body, it was a black sail (owner,
     13 Nov 2026). */
  var h = s * 0.27, bw = s * 0.13;
  cmUnder(c, '#12416b', 0.75, function (cc) {
    cmCreature(cc, x - s * 0.06, y + s * 0.05, s, { skin: 'orca', ang: Math.PI / 2, noShadow: true, gait: tt * 0.2 });
  });
  c.save();
  c.strokeStyle = '#ffffff'; c.lineCap = 'round';                    // her wake, two lines of foam opening out behind
  for (var w = 0; w < 4; w++) {                                      // short, parting at the fin and fading
    var k = w / 3;
    c.globalAlpha = 0.55 * (1 - k * 0.85); c.lineWidth = 1.5 - k * 0.8;
    [-1, 1].forEach(function (sd) {
      c.beginPath(); c.moveTo(x - bw - s * k * 0.08, y + 1.5 + sd * (1.5 + k * 2.5));
      c.quadraticCurveTo(x - bw - s * (0.05 + k * 0.1), y + 1.5 + sd * (2.4 + k * 3.5), x - bw - s * (0.1 + k * 0.12), y + 1.5 + sd * (2.8 + k * 4.5)); c.stroke();
    });
  }
  c.globalAlpha = 1;
  var g = c.createLinearGradient(x - bw, 0, x + bw, 0);
  g.addColorStop(0, '#0d1118'); g.addColorStop(0.6, '#1d2430'); g.addColorStop(1, '#2c3644');
  c.fillStyle = g;
  c.beginPath();                                                     // tall for its base, the tip leaning back
  c.moveTo(x - bw, y);
  c.bezierCurveTo(x - bw * 0.7, y - h * 0.45, x - bw * 0.1, y - h * 0.85, x - bw * 0.4, y - h);
  c.bezierCurveTo(x + bw * 0.2, y - h * 0.7, x + bw * 0.4, y - h * 0.35, x + bw * 0.9, y);
  c.closePath(); c.fill();
  c.strokeStyle = 'rgba(160,190,220,.35)'; c.lineWidth = 1;            // light on its leading edge
  c.beginPath(); c.moveTo(x + bw * 0.75, y - 1.5); c.bezierCurveTo(x + bw * 0.3, y - h * 0.35, x + bw * 0.1, y - h * 0.7, x - bw * 0.32, y - h * 0.96); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6;          // foam round its foot
  c.beginPath(); c.ellipse(x, y + 1, bw * 1.3, 2.6, 0, 0.1, Math.PI - 0.1); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.8)';
  for (var i = 0; i < 5; i++) { c.beginPath(); c.arc(x + bw * 1.1 + i * 2.4, y - 1.5 - (i % 3) * 2.2, 1, 0, 6.2832); c.fill(); }
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
    cmDeep({ cap: 'comic.mitten.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        /* a scarf left on the snow at the foot of the hill */
        cmScarf(c, [[86, 122], [130, 78], [190, 162], [232, 108]], 18);
      },
      near: function (c, tt) {
        cmSpark(c, 236, 92, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } }),
    cmDeep({ cap: 'comic.mitten.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 116, 120, { skin: 'mitten', eye: { shut: 1, wide: 1.15, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 232, 60, 8, 0.5 + 0.5 * Math.sin(tt * 0.2));
        cmSpark(c, 92, 74, 6, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
      } }),
    cmDeep({ cap: 'comic.mitten.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 90, { skin: 'mitten', gait: tt * 0.5 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 46, 28, -0.12, '#bff2ff');
      } })
  ],
  [
    cmDeep({ cap: 'comic.mitten.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 130, 86, { skin: 'mitten', gait: tt * 0.5, eye: { shut: 1, wide: 1, lx: 0.8, ly: -0.4 } });
        cmThing(c, 'fish', 284, 46, 30, tt);
        cmThing(c, 'fish', 40, 40, 30, tt + 5);
      } }),
    cmDeep({ cap: 'comic.mitten.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        var k = Math.min(1, tt / 50);
        [[284, 40], [40, 36], [300, 150], [24, 160]].forEach(function (p, i) {
          var x = p[0] + (160 - p[0]) * k * 0.55, y = p[1] + (120 - p[1]) * k * 0.55;
          cmPull(c, x, y, 160, 120, 0.7);
          cmThing(c, 'fish', x, y, 28, tt + i * 6);
        });
        cmCreature(c, 160, 124, 86, { skin: 'mitten', gait: tt * 0.5 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.slurp'), 160, 34, 28, -0.06);
      } }),
    cmDeep({ cap: 'comic.mitten.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 116, 100, { skin: 'mitten', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.gulp'), 248, 48, 28, 0.12);
        [[90, 60], [236, 140], [96, 160]].forEach(function (p, i) { cmSpark(c, p[0], p[1], 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + i)); });
      } })
  ],
  [
    cmDeep({ cap: 'comic.mitten.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 7; i++) cmThing(c, 'fish', 30 + i * 44, 40 + (i % 2) * 24, 26, tt + i * 4);
        cmCreature(c, 160, 146, 80, { skin: 'mitten', gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 0, ly: -0.8 } });
      } }),
    cmDeep({ cap: 'comic.mitten.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 96, { skin: 'mitten' });
      },
      near: function (c, tt) {
        cmCombo(c, 252, 52, 'x3');
        cmSfx(c, cmWord('comic.sfx.gulp'), 80, 52, 26, -0.1);
      } }),
    cmDeep({ cap: 'comic.mitten.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'mitten', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 66, 46, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } })
  ]
];

/* ---- Puffin: lost on a glacier, and never put off by a miss ---- */
COMICS.puffin = [
  [
    cmDeep({ cap: 'comic.puffin.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 112, 92, { skin: 'puffin', ang: Math.sin(tt * 0.05) * 0.3, eye: { shut: 1, wide: 1.2, lx: Math.sin(tt * 0.05), ly: 0 } });
      },
      near: function (c, tt) {
        cmSfx(c, '?', 230, 60, 40, 0.2, '#ffffff');
        cmSfx(c, '?', 92, 70, 30, -0.2, '#ffffff');
      } }),
    cmDeep({ cap: 'comic.puffin.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 360, { skin: 'puffin', eye: { shut: 1, wide: 1, lx: 0.4, ly: -0.4 } });
      } }),
    cmDeep({ cap: 'comic.puffin.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 18, 0.9);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 90, { skin: 'puffin', gait: tt * 0.6 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whoosh'), 250, 44, 28, -0.1);
      } })
  ],
  [
    cmDeep({ cap: 'comic.puffin.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        [[150, 30], [164, 60], [150, 90]].forEach(function (p, i) { cmThing(c, 'fish', p[0], p[1], 26, tt + i * 5); });
        cmCreature(c, 160, 150, 80, { skin: 'puffin', gait: tt * 0.5 });
      },
      near: function (c, tt) {
        cmCombo(c, 260, 46, 'x2');
      } }),
    cmDeep({ cap: 'comic.puffin.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 130, 120, 86, { skin: 'puffin', ang: -0.3, gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 1, ly: 0 } });
        cmThing(c, 'fish', 262, 150, 30, tt);
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.oops'), 250, 54, 28, 0.1, '#ffd2d2');
      } }),
    cmDeep({ cap: 'comic.puffin.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 140, 120, 90, { skin: 'puffin', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmCombo(c, 246, 70, 'x2');
        cmSpark(c, 276, 46, 8, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } })
  ],
  [
    cmDeep({ cap: 'comic.puffin.3.1',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 5; i++) cmThing(c, 'fish', 160 + Math.sin(i) * 30, 20 + i * 22, 24, tt + i * 4);
        cmCreature(c, 160, 156, 74, { skin: 'puffin', gait: tt * 0.6 });
      } }),
    cmDeep({ cap: 'comic.puffin.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 150, 122, 96, { skin: 'puffin' });
      },
      near: function (c, tt) {
        cmCombo(c, 252, 56, 'x3');
        cmSfx(c, cmWord('comic.sfx.gulp'), 78, 50, 26, -0.1);
      } }),
    cmDeep({ cap: 'comic.puffin.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'puffin', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 256, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } })
  ]
];

/* ---- Seal: up through the ice, and a nose for gold ---- */
COMICS.seal = [
  [
    cmDeep({ cap: 'comic.seal.1.1',
      back: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
      },
      mid: function (c, tt) {
        /* hauling out over the hole's far edge: head and shoulders on the
           ice, the rest of her still in the water */
        var up = 1 - Math.pow(1 - Math.min(1, tt / 40), 2), sy = 170 - up * 58;
        cmHole(c, 160, 118, 54, 30);
        cmIn(c, 160, 118, 54, 30, 90, '#0d3b66', 0.9, function (cc) {
          cmCreature(cc, 160, sy, 100, { skin: 'seal', eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.5 } });
        });
        cmRipples(c, 160, 96, 24, tt, [160, 118, 54, 30]);
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.splash'), 252, 50, 28, 0.12, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.seal.1.2',
      back: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
      },
      mid: function (c, tt) {
        cmHole(c, 92, 156, 40, 20);
        cmCreature(c, 190, 104, 100, { skin: 'seal', eye: { shut: 1, wide: 1, lx: -0.6, ly: 0.6 } });
      } }),
    cmDeep({ cap: 'comic.seal.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 90, { skin: 'seal', gait: tt * 0.5 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 66, 44, 28, -0.12, '#bff2ff');
      } })
  ],
  [
    cmDeep({ cap: 'comic.seal.2.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 200, 260, { skin: 'seal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.sniff'), 160, 40, 30, -0.05);
      } }),
    cmDeep({ cap: 'comic.seal.2.2',
      back: function (c, tt) {
        var pulse = 0.55 + 0.35 * Math.sin(tt * 0.12);
        cmSnow(c);
        cmGlow(c, 238, 60, 44, pulse);
        cmGlow(c, 70, 150, 30, pulse * 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 150, 120, 90, { skin: 'seal', eye: { shut: 1, wide: 1.3, lx: 0.8, ly: -0.6 } });
      } }),
    cmDeep({ cap: 'comic.seal.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'gold', 236, 70, 40, tt);
        cmPull(c, 160, 120, 230, 76, 0.7);
        cmCreature(c, 150, 124, 86, { skin: 'seal', gait: tt * 0.5 });
      },
      near: function (c, tt) {
        cmSpark(c, 260, 46, 9, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } })
  ],
  [
    cmDeep({ cap: 'comic.seal.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        [[50, 40], [270, 54], [90, 150], [250, 160], [160, 30]].forEach(function (p, i) {
          cmThing(c, 'gold', p[0], p[1], 34, tt + i * 6);
        });
        cmCreature(c, 160, 110, 80, { skin: 'seal', eye: { shut: 1, wide: 1.4, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.seal.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmGlow(c, 160, 120, 70, 0.35);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 96, { skin: 'seal' });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.gulp'), 250, 50, 28, 0.12);
      } }),
    cmDeep({ cap: 'comic.seal.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'seal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 70, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
        cmSpark(c, 254, 66, 7, 0.5 + 0.5 * Math.sin(tt * 0.2 + 2));
      } })
  ]
];

/* a burrow in the snow, dark at its mouth */
function cmBurrow(c, x, y, k) {
  k = k || 1;
  c.save();
  c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(x, y + 3 * k, 30 * k, 16 * k, 0, 0, 6.2832); c.fill();
  var g = c.createRadialGradient(x, y, 2, x, y, 20 * k);
  g.addColorStop(0, '#1e2833'); g.addColorStop(1, '#6f8597');
  c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 20 * k, 10 * k, 0, 0, 6.2832); c.fill();
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
    cmDeep({ cap: 'comic.lemming.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        /* his head and shoulders up out of the hole, the rest of him down
           in the dark of it */
        var up = 1 - Math.pow(1 - Math.min(1, tt / 30), 2);
        cmBurrow(c, 160, 132, 1.7);
        cmIn(c, 160, 132, 34, 17, 128, '#141b24', 0.92, function (cc) {
          cmCreature(cc, 160, 196 - up * 54, 130, { skin: 'lemming', eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.5 } });
        });
      } }),
    cmDeep({ cap: 'comic.lemming.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 380, { skin: 'lemming', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 260, 46, 8, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } }),
    cmDeep({ cap: 'comic.lemming.1.3',
      back: function (c, tt) {
        cmIce(c);
        for (var i = 0; i < 6; i++) {                  // today's line, lit up
          var y = 190 - i * 34, x = 160 + Math.sin(i * 1.2) * 60;
          var g = c.createRadialGradient(x, y, 1, x, y, 16);
          g.addColorStop(0, 'rgba(255,200,70,.9)'); g.addColorStop(1, 'rgba(255,200,70,0)');
          c.fillStyle = g; c.beginPath(); c.arc(x, y, 16, 0, 6.2832); c.fill();
        }
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 176, 60, { skin: 'lemming', gait: tt * 0.6 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.lemming.2.1',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 150, 124, 86, { skin: 'lemming', gait: tt * 0.6, eye: { shut: 1, wide: 1.2, lx: 0, ly: -0.8 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 46, 26, -0.1, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.lemming.2.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 140, 80, { skin: 'lemming', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmStars(c, 160, 48, Math.min(3, 1 + Math.floor(tt / 14)), 3, 40);
      } }),
    cmDeep({ cap: 'comic.lemming.2.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 4; i++) cmThing(c, 'fish', 214 + (i % 2) * 34, 40 + Math.floor(i / 2) * 40, 30, tt + i * 5);
        cmCreature(c, 160, 160, 56, { skin: 'lemming' });
      },
      near: function (c, tt) {
        cmStars(c, 90, 60, 3, 3, 26);
        c.save(); c.strokeStyle = '#062a78'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(150, 60); c.lineTo(184, 60); c.lineTo(176, 52); c.moveTo(184, 60); c.lineTo(176, 68); c.stroke(); c.restore();
      } })
  ],
  [
    cmDeep({ cap: 'comic.lemming.3.1',
      back: function (c, tt) {
        cmSnow(c);
        for (var d = 0; d < 7; d++) {                  // a week of mornings, one more each day
          var lit = d <= Math.floor(tt / 8);
          c.fillStyle = lit ? '#ffcd3a' : 'rgba(150,175,200,.4)';
          c.beginPath(); c.arc(40 + d * 40, 60, 13, 0, 6.2832); c.fill();
          if (lit) { c.strokeStyle = '#ad6800'; c.lineWidth = 2; c.stroke(); }
        }
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 150, 70, { skin: 'lemming', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.lemming.3.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 9; i++) cmThing(c, 'fish', 110 + (i % 3) * 50, 40 + Math.floor(i / 3) * 34, 30, tt + i * 3);
        cmCreature(c, 260, 150, 60, { skin: 'lemming', eye: { shut: 1, wide: 1.3, lx: -0.8, ly: -0.4 } });
      } }),
    cmDeep({ cap: 'comic.lemming.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'lemming', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 70, 50, 9, 0.5 + 0.5 * Math.sin(tt * 0.2));
      } })
  ]
];

/* ---- Musk Ox: deep snow does not slow him ---- */
COMICS.muskox = [
  [
    cmDeep({ cap: 'comic.muskox.1.1',
      back: function (c, tt) {
        cmSnow(c);
        c.save(); c.fillStyle = 'rgba(255,255,255,.8)';
        for (var i = 0; i < 40; i++) { c.beginPath(); c.arc((i * 47 + tt * 3) % COMIC_W, (i * 29 + tt * 1.5) % COMIC_H, 2 + (i % 3), 0, 6.2832); c.fill(); }
        c.restore();
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 110, { skin: 'muskox', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.muskox.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 250, 380, { skin: 'muskox', eye: { shut: 1, wide: 1.25, lx: 0, ly: 0.5 } });
      } }),
    cmDeep({ cap: 'comic.muskox.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 90, { skin: 'muskox', gait: tt * 0.4 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 40, 24, -0.1, '#bff2ff');
      } })
  ],
  [
    cmDeep({ cap: 'comic.muskox.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'drift', 160, 60, 150);
        cmCreature(c, 160, 160, 70, { skin: 'muskox', gait: tt * 0.4 });
      } }),
    cmDeep({ cap: 'comic.muskox.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmStuck(c, 80, 110);
      } }),
    cmDeep({ cap: 'comic.muskox.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'drift', 160, 110, 160);
        cmPuff(c, 110, 90, 26, 7); cmPuff(c, 212, 90, 26, 7);
        cmCreature(c, 160, 104, 90, { skin: 'muskox', gait: tt * 0.6 });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.plough'), 160, 36, 30, -0.06);
      } })
  ],
  [
    cmDeep({ cap: 'comic.muskox.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'drift', 70, 60, 110); cmThing(c, 'drift', 250, 120, 120); cmThing(c, 'drift', 120, 170, 100);
        cmCreature(c, 170, 100, 70, { skin: 'muskox', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.muskox.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 16, 0.9);
      },
      mid: function (c, tt) {
        cmThing(c, 'drift', 160, 150, 130);
        cmCreature(c, 160, 120, 86, { skin: 'muskox', gait: tt * 0.6 });
      } }),
    cmDeep({ cap: 'comic.muskox.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 240, 330, { skin: 'muskox', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Bubbles: born in a bubble, and kept in one ---- */
COMICS.bubbles = [
  [
    cmDeep({ cap: 'comic.bubbles.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'bubble', 160, 104, 150, tt);
        cmCreature(c, 160, 106, 60, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.bubbles.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 380, { skin: 'bubbles', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
        c.save(); c.globalAlpha = 0.4; cmThing(c, 'bubble', 160, 150, 460, tt); c.restore();
      } }),
    cmDeep({ cap: 'comic.bubbles.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 90, { skin: 'bubbles', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.bubbles.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 160, 50, 70);
        cmCreature(c, 160, 150, 80, { skin: 'bubbles', gait: tt * 0.5, eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.bubbles.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 160, 52, 70);
        cmPuff(c, 160, 90, 40, 10);
        cmCreature(c, 160, 110, 80, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.bonk'), 240, 140, 32, 0.15);
      } }),
    cmDeep({ cap: 'comic.bubbles.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 70, 160, 60);
        cmCreature(c, 190, 90, 84, { skin: 'bubbles', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.bubbles.3.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        var g = Math.min(1, tt / 40);
        cmThing(c, 'bubble', 160, 104, 60 + g * 90, tt);
        cmCreature(c, 160, 106, 60, { skin: 'bubbles' });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.pop'), 254, 46, 26, 0.12, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.bubbles.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 14, 0.8);
      },
      mid: function (c, tt) {
        cmThing(c, 'tree', 60, 70, 56); cmThing(c, 'rock', 268, 140, 54);
        cmCreature(c, 160, 116, 84, { skin: 'bubbles', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.bubbles.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'bubbles', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        c.save(); c.globalAlpha = 0.4; cmThing(c, 'bubble', 160, 150, 400, tt); c.restore();
      } })
  ]
];

/* ---- Otter: time is just another kind of water ---- */
COMICS.otter = [
  [
    cmDeep({ cap: 'comic.otter.1.1',
      back: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
      },
      mid: function (c, tt) {
        /* afloat: no shadow on the water, only rings round her as she rocks */
        var bob = Math.sin(tt * 0.08) * 3;
        cmHole(c, 160, 104, 110, 60);
        cmRipples(c, 160, 104 + bob, 46, tt, [160, 104, 110, 60]);
        cmCreature(c, 160, 104 + bob, 90, { skin: 'otter', ang: Math.PI, noShadow: true, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.otter.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 204, 380, { skin: 'otter', held: 'pebble', eye: { shut: 1, wide: 1, lx: 0.4, ly: 0.4 } });
      } }),
    cmDeep({ cap: 'comic.otter.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 86, { skin: 'otter', gait: tt * 0.4, eye: { shut: 0.4, wide: 1, lx: 0, ly: 0 } });
      } })
  ],
  [
    cmDeep({ cap: 'comic.otter.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'clock', 230, 60, 64, tt);
        cmCreature(c, 140, 140, 80, { skin: 'otter', gait: tt * 0.5, eye: { shut: 1, wide: 1.3, lx: 0.8, ly: -0.6 } });
      } }),
    cmDeep({ cap: 'comic.otter.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 90, { skin: 'otter' });
      },
      near: function (c, tt) {
        cmTag(c, 160, 44 - Math.min(1, tt / 30) * 8, '+4');
        cmSpark(c, 210, 40, 9, 0.6 + 0.4 * Math.sin(tt * 0.25));
      } }),
    cmDeep({ cap: 'comic.otter.2.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 100, 110, 56, { skin: 'snowcap' }); cmCreature(c, 220, 110, 56, { skin: 'otter' });
      },
      near: function (c, tt) {
        cmTag(c, 100, 46, '+3', '#ffffff');
        cmTag(c, 220, 46, '+4');
        cmSfx(c, cmWord('comic.sfx.whoosh'), 160, 160, 26, -0.05);
      } })
  ],
  [
    cmDeep({ cap: 'comic.otter.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        [[70, 50], [250, 70], [110, 150], [230, 160]].forEach(function (p, i) { cmThing(c, 'clock', p[0], p[1], 46, tt + i * 7); });
        cmCreature(c, 160, 104, 70, { skin: 'otter', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.otter.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 16, 0.9);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 86, { skin: 'otter', gait: tt * 0.6 });
      },
      near: function (c, tt) {
        cmTag(c, 250, 50, '+4'); cmTag(c, 70, 70, '+4');
      } }),
    cmDeep({ cap: 'comic.otter.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'otter', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Arctic Hare: white on white, and never hurried ---- */
COMICS.hare = [
  [
    cmDeep({ cap: 'comic.hare.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        c.save(); c.globalAlpha = 0.35 + 0.25 * Math.sin(tt * 0.06);
        cmCreature(c, 160, 120, 100, { skin: 'hare' });
        c.restore();
      } }),
    cmDeep({ cap: 'comic.hare.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 236, 380, { skin: 'hare', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.hare.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.5);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 86, { skin: 'hare', gait: tt * 0.3, eye: { shut: 0.5, wide: 1, lx: 0, ly: 0 } });
      } })
  ],
  [
    cmDeep({ cap: 'comic.hare.2.1',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 24, 1);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 80, { skin: 'snowcap', gait: tt * 0.9, eye: { shut: 1, wide: 1.45, lx: 0, ly: -1 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 240, 44, 26, -0.1, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.hare.2.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.5);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 86, { skin: 'hare', gait: tt * 0.3, eye: { shut: 0.6, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.hare.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'tree', 70, 50, 54); cmThing(c, 'tree', 250, 50, 54);
        cmCreature(c, 160, 140, 86, { skin: 'hare', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      },
      near: function (c, tt) {
        c.save(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2.5;      // listening
        for (var i = 0; i < 3; i++) { c.beginPath(); c.arc(160, 70, 16 + i * 12 + (tt % 30) * 0.4, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
        c.restore();
      } })
  ],
  [
    cmDeep({ cap: 'comic.hare.3.1',
      back: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 60, 50);
      },
      mid: function (c, tt) {
        cmCreature(c, cmChuteX(160, 50, 150), 150, 50, { skin: 'hare', gait: tt * 0.3 });
      } }),
    cmDeep({ cap: 'comic.hare.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 80, 70, 54); cmThing(c, 'tree', 250, 110, 54);
        cmCreature(c, 160, 130, 84, { skin: 'hare', gait: tt * 0.3 });
      } }),
    cmDeep({ cap: 'comic.hare.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 220, 300, { skin: 'hare', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Snow Leopard: close calls, on purpose ---- */
COMICS.leopard = [
  [
    cmDeep({ cap: 'comic.leopard.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        /* a crag of boulders, each the size the hill has them (one drawn
           seven times over showed its rim and its shadow as a second, ghost
           rock), and her stretched along the top of the biggest */
        [[78, 150, 58], [246, 156, 62], [206, 70, 50], [104, 76, 46], [160, 112, 96], [268, 96, 40]].forEach(function (r) {
          cmThing(c, 'rock', r[0], r[1], r[2]);
        });
        cmCreature(c, 156, 104, 66, { skin: 'leopard', ang: -0.25, eye: { shut: 1, wide: 1, lx: 0, ly: 0.6 } });
      } }),
    cmDeep({ cap: 'comic.leopard.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 380, { skin: 'leopard', eye: { shut: 1, wide: 1, lx: 0.5, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.leopard.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 150, 100, 90, { skin: 'leopard', gait: tt * 0.6 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.leopard.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 200, 50, 70);
        cmCreature(c, 150, 150, 80, { skin: 'leopard', gait: tt * 0.6, eye: { shut: 1, wide: 1, lx: 0.6, ly: -0.8 } });
      } }),
    cmDeep({ cap: 'comic.leopard.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 214, 100, 76);
        cmCreature(c, 140, 110, 82, { skin: 'leopard', ang: -0.3, gait: tt * 0.6, eye: { shut: 1, wide: 1.4, lx: 0.8, ly: 0 } });
      },
      near: function (c, tt) {
        cmSpark(c, 180, 104, 12, 1);
        cmSfx(c, cmWord('hud.close'), 120, 40, 28, -0.1);
      } }),
    cmDeep({ cap: 'comic.leopard.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 150, 124, 86, { skin: 'leopard' });
      },
      near: function (c, tt) {
        cmTag(c, 250, 60, '+30', '#ffe066');
        cmCombo(c, 250, 100, 'x2');
      } })
  ],
  [
    cmDeep({ cap: 'comic.leopard.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        [[90, 40], [230, 100], [90, 160]].forEach(function (p) { cmThing(c, 'rock', p[0], p[1], 56); });
        c.save(); c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.lineCap = 'round'; c.setLineDash([2, 10]);
        c.beginPath(); c.moveTo(160, 200); c.bezierCurveTo(140, 170, 190, 130, 180, 100); c.bezierCurveTo(170, 70, 130, 60, 130, 20); c.stroke(); c.restore();
        cmCreature(c, 160, 186, 54, { skin: 'leopard', gait: tt * 0.6 });
      } }),
    cmDeep({ cap: 'comic.leopard.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 214, 110, 70);
        cmCreature(c, 146, 112, 82, { skin: 'leopard', gait: tt * 0.6 });
      },
      near: function (c, tt) {
        cmSpark(c, 182, 112, 12, 1);
        cmSfx(c, cmWord('hud.perfect'), 150, 40, 28, -0.08);
      } }),
    cmDeep({ cap: 'comic.leopard.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'leopard', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } })
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
/* the ramp and the gate are the hill's own (Game.comicDraw): the comic's
   flat trapezoid and its ring of crystals went out of date when the hill's
   changed (12 Nov 2026) */
function cmRamp(c, x, y, w, kind) {               // y is the lip
  if (typeof Game !== 'undefined' && Game.comicDraw) Game.comicDraw(c, 'ramp', x, y + 30, w, { w: w, kind: kind || 'kicker' });
}
/* an arc of leaping fish over the run: the gate */
function cmRing(c, x, y, w, glow, tt) {
  if (glow) cmGlow(c, x, y, w * 0.7, glow);
  if (typeof Game !== 'undefined' && Game.comicDraw) Game.comicDraw(c, 'arc', x, y, w, { w: w, t: tt || 0 });
}
/* night: a dark sky, stars, and the snow below lit blue. `hz` is where the
   snow meets the sky (150 if left out). The animals are drawn from above, as
   on the hill, so one standing on the snow is set wholly below it: with his
   head up past the skyline a penguin hung in the stars, as if he floated
   (owner, 13 Nov 2026). A high horizon is a camera looking down. */
function cmNight(c, tt, hz, skyOnly) {
  hz = hz || 150;
  var g = c.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#0b1633'); g.addColorStop(0.75, '#1c2f5c'); g.addColorStop(1, '#3d5b8c');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  var top = Math.max(26, hz - 30);
  for (var i = 0; i < 40; i++) {
    var a = 0.4 + 0.5 * Math.abs(Math.sin(i * 7.1 + (tt || 0) * 0.05));
    c.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
    c.beginPath(); c.arc((i * 83) % COMIC_W, (i * 37) % 120 / 120 * top, i % 5 ? 0.9 : 1.6, 0, 6.2832); c.fill();
  }
  if (!skyOnly) cmNightSnow(c, hz);       // (a deep panel lays the snow on a plane of its own, nearer)
}
/* the night's snow, farther and greyer toward the skyline, with long low drifts */
function cmNightSnow(c, hz) {
  var sg = c.createLinearGradient(0, hz - 12, 0, COMIC_H);
  sg.addColorStop(0, '#9fb8d8'); sg.addColorStop(0.35, '#bcd1ea'); sg.addColorStop(1, '#d3e3f4');
  c.fillStyle = sg;
  c.beginPath(); c.moveTo(0, hz); c.quadraticCurveTo(160, hz - 22, COMIC_W, hz + 2); c.lineTo(COMIC_W, COMIC_H); c.lineTo(0, COMIC_H); c.closePath(); c.fill();
  c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.2;
  for (var d = 0; d < 5; d++) {
    var dy = hz + 10 + d * d * 6 + d * 8;
    if (dy > COMIC_H - 4) break;
    c.beginPath(); c.moveTo(20 + d * 37 % 90, dy); c.quadraticCurveTo(120 + d * 23, dy - 4, 220 + d * 17 % 80, dy + 1); c.stroke();
  }
  c.restore();
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

/* ---- depth: a panel in planes ----
   Every comic is deep: each panel is laid out in planes rather than one
   picture (cmDeep):
     far   the sky, when there is one: the stars, the moons, the lights;
     back  the ground: snow, ice, sea, the run, a crack;
     mid   what stands on it: the animals, trees, rocks, fish, a hole;
     near  what passes close to the eye: big flakes, a sound, a combo.
   On the comic screen (ui.js) cmPaint draws them apart, moved by their own
   amounts as the camera sways and pushed in at their own rates as the panel
   opens. The ground and what stands on it move almost as one: an animal is
   a body's height above the snow, no more. Pulled far apart, as the first
   trial had them, a penguin slid over his snow and seemed to float, and a
   seal would slide off her hole (owner, 13 Nov 2026). The depth is in the
   sky going by behind, softened, and in what is near going by in front.
   The animals have one close shadow under them; the corners are a shade
   darker, which rounds the picture.
   draw() still paints the planes flat, one over the other, for anything
   that reads a panel whole (the tests, the pages printed for the eye check). */
function cmDeep(p) {
  p.draw = function (c, tt) {
    if (p.far) p.far(c, tt);
    p.back(c, tt); if (p.mid) p.mid(c, tt); if (p.near) p.near(c, tt);
  };
  return p;
}
/* big flakes close to the eye: soft, and moving faster than the snow behind */
var CM_DOT = null;                                   // one soft flake, drawn once: a gradient a flake a frame was dear on a phone
function cmNearFlakes(c, tt, n, slant) {
  if (!CM_DOT && typeof document !== 'undefined') {
    var dc = document.createElement('canvas'), dx = dc && dc.getContext ? dc.getContext('2d') : null;
    if (dx) {
      dc.width = dc.height = 32;
      var g = dx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, 'rgba(255,255,255,.8)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      dx.fillStyle = g; dx.fillRect(0, 0, 32, 32);
      CM_DOT = dc;
    }
  }
  for (var i = 0; i < n; i++) {
    var r = 3 + (i * 7) % 4;
    var x = (i * 89 + tt * (slant || 1) * 5.5) % (COMIC_W + 40) - 20;
    var y = (i * 53 + tt * 3.6) % (COMIC_H + 40) - 20;
    if (CM_DOT) c.drawImage(CM_DOT, x - r, y - r, r * 2, r * 2);
    else { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x, y, r * 0.7, 0, 6.2832); c.fill(); }
  }
}
var CM_BUF = {};
function cmBuf(name, w, h) {
  var b = CM_BUF[name];
  if (!b) {
    var cv = document.createElement('canvas');
    var cx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!cx) return null;
    b = CM_BUF[name] = { cv: cv, c: cx };
  }
  if (b.cv.width !== w || b.cv.height !== h) { b.cv.width = w; b.cv.height = h; }
  return b;
}
/* how far each plane slides with the camera (stage units at full sway) and
   how much it grows as the panel opens: the far snow hardly at all, the
   flakes at the eye most */
var CM_PLANE = { far:  { sx: -6,   sy: -4,   z0: 1.06,  z1: 1.09 },
                 back: { sx: -1.2, sy: -0.8, z0: 1.025, z1: 1.05 },   // a little more than it slides: no edge shows
                 mid:  { sx: 0.6,  sy: 0.4,  z0: 1.025, z1: 1.05 },   // the ground's own scale, or a seal leaves her hole
                 near: { sx: 10,   sy: 7,    z0: 0.84,  z1: 1 } };
/* c is set to the stage (320 by 200 units); view = { px: device pixels a
   unit, cam: { x, y } each -1..1, still: no motion, soft: blur and shadow
   (off at low effects) } */
function cmPaint(c, p, tt, view) {
  if (!p.back || !view) { p.draw(c, tt); return; }
  var cam = view.cam || { x: 0, y: 0 };
  var open = view.still ? 1 : 1 - Math.pow(1 - Math.min(1, tt / 55), 3);
  function place(cc, name) {
    var P = CM_PLANE[name], z = P.z0 + (P.z1 - P.z0) * open;
    cc.translate(COMIC_W / 2 + cam.x * P.sx, COMIC_H / 2 + cam.y * P.sy);
    cc.scale(z, z);
    cc.translate(-COMIC_W / 2, -COMIC_H / 2);
    cc.lineJoin = 'round'; cc.lineCap = 'round';
  }
  /* the sky, at three quarters of the panel's own pixels and stretched
     back up: soft by about a pixel and a half on any screen */
  if (p.far) {
    var pxCss = view.px / (view.k || 1);
    var sb = view.soft ? pxCss * 0.75 : view.px;
    var F = view.soft ? cmBuf('far', Math.ceil(COMIC_W * sb), Math.ceil(COMIC_H * sb)) : null;
    if (F) {
      F.c.setTransform(sb, 0, 0, sb, 0, 0);
      F.c.clearRect(0, 0, COMIC_W, COMIC_H);
      F.c.save(); place(F.c, 'far'); p.far(F.c, tt); F.c.restore();
      c.save(); c.imageSmoothingEnabled = true;
      c.drawImage(F.cv, 0, 0, F.cv.width, F.cv.height, 0, 0, COMIC_W, COMIC_H);
      c.restore();
    } else { c.save(); place(c, 'far'); p.far(c, tt); c.restore(); }
  }
  c.save(); place(c, 'back'); p.back(c, tt); c.restore();

  /* the animals on a plane of their own, and one shadow under the whole of
     it (a shadow per stroke would fall from each feather onto the next) */
  if (p.mid) {
    var M = view.soft ? cmBuf('mid', Math.ceil(COMIC_W * view.px), Math.ceil(COMIC_H * view.px)) : null;
    if (M) {
      M.c.setTransform(view.px, 0, 0, view.px, 0, 0);
      M.c.clearRect(0, 0, COMIC_W, COMIC_H);
      M.c.save(); place(M.c, 'mid'); p.mid(M.c, tt); M.c.restore();
      c.save();
      /* close under them, where they touch the snow: a shadow thrown wide
         lifted them off it, and a penguin on the ice seemed to float
         (owner, 13 Nov 2026) */
      c.shadowColor = 'rgba(4,16,40,.3)';
      c.shadowBlur = 3 * view.px;                      // in the canvas's own pixels: a shadow ignores the transform
      c.shadowOffsetX = (1 - cam.x * 0.8) * view.px;
      c.shadowOffsetY = (1.8 - cam.y * 0.6) * view.px;
      c.drawImage(M.cv, 0, 0, M.cv.width, M.cv.height, 0, 0, COMIC_W, COMIC_H);
      c.restore();
    } else { c.save(); place(c, 'mid'); p.mid(c, tt); c.restore(); }
  }
  if (p.near) { c.save(); place(c, 'near'); p.near(c, tt); c.restore(); }

  var v = c.createRadialGradient(COMIC_W / 2, COMIC_H / 2, COMIC_H * 0.45, COMIC_W / 2, COMIC_H / 2, COMIC_W * 0.62);
  v.addColorStop(0, 'rgba(12,44,96,0)'); v.addColorStop(1, 'rgba(12,44,96,.24)');   // icy blue, not grey: grey on the white snow read as dirt
  c.fillStyle = v; c.fillRect(0, 0, COMIC_W, COMIC_H);
}

/* ---- Compass: never once lost ---- */
COMICS.compass = [
  [
    cmDeep({ cap: 'comic.compass.1.1',
      back: function (c, tt) {
        cmSnow(c);
        c.save(); c.strokeStyle = 'rgba(6,42,120,.25)'; c.lineWidth = 2;            // a compass rose drawn in the snow
        c.beginPath(); c.arc(160, 104, 70, 0, 6.2832); c.stroke();
        for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4; c.beginPath(); c.moveTo(160 + Math.cos(a) * (i % 2 ? 56 : 44), 104 + Math.sin(a) * (i % 2 ? 56 : 44)); c.lineTo(160 + Math.cos(a) * 76, 104 + Math.sin(a) * 76); c.stroke(); }
        c.restore();
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 110, 76, { skin: 'compass', ang: Math.sin(tt * 0.05) * 0.5 });
      } }),
    cmDeep({ cap: 'comic.compass.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 236, 380, { skin: 'compass', eye: { shut: 1, wide: 1, lx: 0.3, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.compass.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 86, { skin: 'compass', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.compass.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'fish', 160, 70, 40, tt);
        cmCreature(c, 160, 150, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.2, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.compass.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 12; i++) cmThing(c, 'fish', 70 + (i % 4) * 60 + (Math.floor(i / 4) % 2) * 28, 40 + Math.floor(i / 4) * 34, 34, tt + i * 4);
        cmCreature(c, 160, 172, 50, { skin: 'compass', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.compass.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 86, { skin: 'compass', gait: tt * 0.5 });
        for (var i = 0; i < 5; i++) { var a = i * 1.26 + tt * 0.04; cmThing(c, 'fish', 160 + Math.cos(a) * 90, 110 + Math.sin(a) * 60, 30, tt + i * 6); }
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.gulp'), 250, 40, 28, 0.1);
      } })
  ],
  [
    cmDeep({ cap: 'comic.compass.3.1',
      back: function (c, tt) {
        cmIce(c);
        c.save(); c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; c.setLineDash([2, 10]);
        c.beginPath(); c.moveTo(80, 190); c.bezierCurveTo(60, 120, 250, 120, 240, 50); c.stroke(); c.restore();
      },
      mid: function (c, tt) {
        for (var i = 0; i < 6; i++) cmThing(c, 'fish', 216 + (i % 3) * 24, 30 + Math.floor(i / 3) * 26, 26, tt + i * 4);
        cmCreature(c, 80, 176, 54, { skin: 'compass', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.compass.3.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 15; i++) cmThing(c, 'fish', 60 + (i % 5) * 50, 40 + Math.floor(i / 5) * 36, 30, tt + i * 3);
      },
      near: function (c, tt) {
        cmTag(c, 160, 168, '+15');
      } }),
    cmDeep({ cap: 'comic.compass.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'compass', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Snowy Owl: she always knows the way ---- */
COMICS.owl = [
  [
    cmDeep({ cap: 'comic.owl.1.1',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1.2, lx: Math.sin(tt * 0.04), ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.owl.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 400, { skin: 'owl', eye: { shut: 1, wide: 1.3, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.owl.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 80, { skin: 'owl', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.owl.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmWall(c, 60, 214, 80, 46);
        cmCreature(c, 140, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.owl.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmWall(c, 60, 214, 80, 46);
        cmSight(c, [[140, 150], [180, 110], [214, 60], [220, 10]], tt);
        cmCreature(c, 140, 160, 70, { skin: 'owl', eye: { shut: 1, wide: 1.2, lx: 0.6, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.owl.2.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 8, 0.5);
      },
      mid: function (c, tt) {
        cmWall(c, 110, 160, 80, 46);
        cmCreature(c, 160, 100, 70, { skin: 'owl', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.owl.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmWall(c, 50, 80, 74, 40); cmWall(c, 120, 230, 74, 40);
        cmSight(c, [[160, 196], [230, 150], [230, 120], [130, 80], [80, 50], [80, 0]], tt);
        cmCreature(c, 160, 186, 50, { skin: 'owl', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.owl.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 6, 0.4);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 120, 86, { skin: 'owl', gait: tt * 0.4, eye: { shut: 0.5, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.owl.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 360, { skin: 'owl', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Walrus: the rings know an old friend ---- */
COMICS.walrus = [
  [
    cmDeep({ cap: 'comic.walrus.1.1',
      back: function (c, tt) {
        cmSea(c, tt);
      },
      mid: function (c, tt) {
        cmFloe(c, [[74, 88], [108, 70], [166, 64], [214, 70], [248, 90], [238, 114], [196, 126], [138, 128], [96, 122], [72, 106]]);
        cmCreature(c, 166, 98, 70, { skin: 'walrus', ang: 1.4, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.walrus.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 240, 360, { skin: 'walrus', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.walrus.1.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmRing(c, 160, 50, 120, 0.25, tt);
        cmCreature(c, 160, 160, 70, { skin: 'walrus', gait: tt * 0.4 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.walrus.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmRing(c, 160, 70, 90, 0, tt);
        cmCreature(c, 160, 150, 70, { skin: 'snowcap', eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.walrus.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmRing(c, 160, 80, 90 + Math.min(1, tt / 30) * 120, 0.4, tt);
        cmCreature(c, 160, 130, 76, { skin: 'walrus', gait: tt * 0.4 });
      },
      near: function (c, tt) {
        cmSpark(c, 60, 70, 10, 1); cmSpark(c, 262, 70, 10, 1);
      } }),
    cmDeep({ cap: 'comic.walrus.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmRing(c, 160, 150, 220, 0.3, tt);
        cmCreature(c, 160, 110, 76, { skin: 'walrus' });
      },
      near: function (c, tt) {
        cmCombo(c, 250, 50, 'x3');
      } })
  ],
  [
    cmDeep({ cap: 'comic.walrus.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmRing(c, 110, 40, 150, 0.2, tt); cmRing(c, 210, 110, 150, 0.2, tt + 20);
        cmCreature(c, 140, 170, 54, { skin: 'walrus', gait: tt * 0.4 });
      } }),
    cmDeep({ cap: 'comic.walrus.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 130, 86, { skin: 'walrus', gait: tt * 0.4 });
      },
      near: function (c, tt) {
        cmTag(c, 70, 50, '+90', '#ffe066'); cmTag(c, 250, 70, '+90', '#ffe066');
      } }),
    cmDeep({ cap: 'comic.walrus.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 214, 300, { skin: 'walrus', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Narwhal: the ramp runs wide for her ---- */
COMICS.narwhal = [
  [
    cmDeep({ cap: 'comic.narwhal.1.1',
      back: function (c, tt) {
        cmIce(c, '#cdeefc', '#9fd6f3');
      },
      mid: function (c, tt) {
        /* she comes up to breathe: the head and the long tusk out of the
           water, her spotted back pale under it */
        var up = 1 - Math.pow(1 - Math.min(1, tt / 36), 2);
        cmHole(c, 160, 134, 96, 46);
        cmIn(c, 160, 134, 96, 46, 118, '#0d3b66', 0.85, function (cc) {
          cmCreature(cc, 160, 196 - up * 50, 120, { skin: 'narwhal', noShadow: true, eye: { shut: 1, wide: 1, lx: 0, ly: -0.4 } });
        });
        cmRipples(c, 160, 120, 22, tt, [160, 134, 96, 46]);
      },
      near: function (c, tt) {
        /* she comes up to breathe: the head and the long tusk out of the
           water, her spotted back pale under it */
        var up = 1 - Math.pow(1 - Math.min(1, tt / 36), 2);
        cmSpark(c, 196, 40, 9, (0.5 + 0.5 * Math.sin(tt * 0.2)) * up);
      } }),
    cmDeep({ cap: 'comic.narwhal.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 250, 340, { skin: 'narwhal', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.narwhal.1.3',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 130, 84, { skin: 'narwhal', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.narwhal.2.1',
      back: function (c, tt) {
        cmIce(c);
        cmCrack(c, 50, 44);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 160, 64, { skin: 'narwhal', gait: tt * 0.5, eye: { shut: 1, wide: 1.4, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.narwhal.2.2',
      back: function (c, tt) {
        cmIce(c);
        cmCrack(c, 40, 40);
      },
      mid: function (c, tt) {
        cmRamp(c, 160, 62, 80 + Math.min(1, tt / 30) * 180, 'swell');
        cmCreature(c, 160, 160, 60, { skin: 'narwhal', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.narwhal.2.3',
      back: function (c, tt) {
        cmIce(c);
        cmCrack(c, 120, 60);
      },
      mid: function (c, tt) {
        cmShadow(c, 160, 170, 22);                                                 // her shadow, far below
        cmCreature(c, 160, 90, 90, { skin: 'narwhal', noShadow: true, eye: { shut: 1, wide: 1.3, lx: 0, ly: -1 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whee'), 250, 36, 26, -0.1, '#bff2ff');
      } })
  ],
  [
    cmDeep({ cap: 'comic.narwhal.3.1',
      back: function (c, tt) {
        cmIce(c);
        cmCrack(c, 150, 50);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 80, 96, { skin: 'narwhal', noShadow: true });          // her shadow falls into the crack
      } }),
    cmDeep({ cap: 'comic.narwhal.3.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmPuff(c, 160, 130, 40, 10);
        cmCreature(c, 160, 110, 84, { skin: 'narwhal' });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.splash'), 250, 50, 26, 0.12, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.narwhal.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 280, { skin: 'narwhal', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Reindeer: he holds his line ---- */
COMICS.reindeer = [
  [
    cmDeep({ cap: 'comic.reindeer.1.1',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 5; i++) cmCreature(c, 40 + i * 60 + ((tt * 0.4) % 60), 60 + (i % 2) * 70, 44, { skin: 'reindeer', ang: -1.57, gait: tt * 0.3 + i });
      } }),
    cmDeep({ cap: 'comic.reindeer.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 270, 330, { skin: 'reindeer', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.reindeer.1.3',
      back: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 70, 0);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 130, 64, { skin: 'reindeer', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.reindeer.2.1',
      back: function (c, tt) {
        cmSnow(c);
        cmChute(c, 140, 70, 70);
      },
      mid: function (c, tt) {
        cmCreature(c, 260, 100, 56, { skin: 'snowcap', ang: 0.6, eye: { shut: 1, wide: 1.4, lx: 0.8, ly: 0 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.oops'), 250, 40, 26, 0.1);
      } }),
    cmDeep({ cap: 'comic.reindeer.2.2',
      back: function (c, tt) {
        cmSnow(c);
        cmChute(c, 140, 70, 70);
      },
      mid: function (c, tt) {
        cmCreature(c, cmChuteX(140, 70, 110), 110, 60, { skin: 'reindeer', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.reindeer.2.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'rock', 104, 90, 70); cmThing(c, 'rock', 216, 90, 70);
        cmCreature(c, 160, 110, 60, { skin: 'reindeer', gait: tt * 0.5 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.reindeer.3.1',
      back: function (c, tt) {
        cmSnow(c);
        cmChute(c, 160, 60, 60);
      },
      mid: function (c, tt) {
        for (var y = 30; y < 200; y += 60) cmCreature(c, cmChuteX(160, 60, y), y, 30, { skin: 'reindeer', still: true });
      } }),
    cmDeep({ cap: 'comic.reindeer.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 10, 0.6);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 124, 80, { skin: 'reindeer', gait: tt * 0.5 });
      } }),
    cmDeep({ cap: 'comic.reindeer.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 260, 300, { skin: 'reindeer', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Emperor: he slides for two. The sad one. ---- */
COMICS.emperor = [
  [
    cmDeep({ cap: 'comic.emperor.1.1',
      far: function (c, tt) { cmNight(c, tt, 118, true); },
      back: function (c, tt) { cmNightSnow(c, 118); cmFlakes(c, tt, 30, 1.5); },
      mid: function (c, tt) {
        [[110, 160], [150, 154], [190, 160], [130, 176], [170, 178], [210, 172], [90, 176]].forEach(function (p, i) {
          cmCreature(c, p[0], p[1], 44, { skin: 'emperor', ang: Math.PI + Math.sin(i) * 0.3, still: true });
        });
      },
      near: function (c, tt) { cmNearFlakes(c, tt, 7, 1.5); } }),
    cmDeep({ cap: 'comic.emperor.1.2',
      back: function (c) { cmSnow(c); },
      mid: function (c) {
        cmCreature(c, 120, 120, 90, { skin: 'emperor', ang: 1.2, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
        cmCreature(c, 200, 120, 84, { skin: 'emperor', ang: -1.2, eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      },
      near: function (c, tt) {
        c.save(); c.fillStyle = '#ff6f8d';                                         // a small heart between them
        c.translate(160, 64 - Math.sin(tt * 0.1) * 3); c.beginPath();
        c.moveTo(0, 6); c.bezierCurveTo(-12, -4, -6, -14, 0, -6); c.bezierCurveTo(6, -14, 12, -4, 0, 6); c.fill(); c.restore();
      } }),
    cmDeep({ cap: 'comic.emperor.1.3',
      back: function (c) { cmSnow(c); },
      mid: function (c, tt) {
        cmCreature(c, 130, 110, 90, { skin: 'emperor', eye: { shut: 1, wide: 1, lx: 0.3, ly: 0.4 } });
        cmBrood(c, 130, 110, 90);
        cmCreature(c, 250, 70 - Math.min(1, tt / 40) * 30, 60, { skin: 'emperor', ang: -0.4, gait: tt * 0.4 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.emperor.2.1',
      far: function (c, tt) { cmNight(c, tt, 72, true); },
      back: function (c, tt) { cmNightSnow(c, 72); cmFlakes(c, tt, 90, 3); },
      mid: function (c) {
        cmCreature(c, 160, 132, 90, { skin: 'emperor', eye: { shut: 0.2, wide: 1, lx: 0, ly: 0 } });
        cmBrood(c, 160, 132, 90);
      },
      near: function (c, tt) { cmNearFlakes(c, tt, 12, 3); } }),
    cmDeep({ cap: 'comic.emperor.2.2',
      far: function (c, tt) {
        cmNight(c, tt, 86, true);
        for (var i = 0; i < 4; i++) {                                              // the moons go round
          c.fillStyle = 'rgba(255,250,220,' + (0.25 + i * 0.2) + ')';
          c.beginPath(); c.arc(60 + i * 66, 40 + Math.abs(i - 1.5) * 10, 11, 0, 6.2832); c.fill();
        }
      },
      back: function (c) { cmNightSnow(c, 86); },
      mid: function (c) { cmCreature(c, 160, 150, 80, { skin: 'emperor', eye: { shut: 1, wide: 1, lx: 0, ly: -0.6 } }); } }),
    cmDeep({ cap: 'comic.emperor.2.3',
      back: function (c, tt) { cmSea(c, tt); },
      mid: function (c, tt) {
        /* swimming in under the surface, then up onto the ice one by one
           (they walked in over the water before) */
        [[70, 150], [140, 160], [230, 152]].forEach(function (p, i) {
          var come = Math.max(0, Math.min(1, (tt - i * 10) / 30)), y = 92 + come * (p[1] - 92);
          if (y - 30 < 139) cmShore(c, 139, function (cc) {
            cmCreature(cc, p[0], y, 44, { skin: 'emperor', ang: Math.PI, gait: tt * 0.4 + i });
          }, [p[0] - 32, y - 32, 64, Math.min(64, 139 - (y - 32))]);
          else cmCreature(c, p[0], y, 44, { skin: 'emperor', ang: Math.PI, gait: tt * 0.4 + i });   // up on the ice
          if (come > 0.2 && come < 1) cmRipples(c, p[0], 136, 10, tt + i * 20, [p[0], 120, 40, 18]);
        });
      } })
  ],
  [
    cmDeep({ cap: 'comic.emperor.3.1',
      back: function (c, tt) { cmSea(c, tt, true); },
      mid: function (c) { cmCreature(c, 160, 168, 60, { skin: 'emperor', still: true, eye: { shut: 1, wide: 1, lx: 0, ly: -1 } }); } }),
    cmDeep({ cap: 'comic.emperor.3.2',
      back: function (c) { cmIce(c); cmSpeed(c, 10, 0.6); },
      mid: function (c, tt) { cmCreature(c, 140, 124, 84, { skin: 'emperor', gait: tt * 0.5 }); },
      near: function (c) { cmCombo(c, 250, 60, 'x2'); } }),
    cmDeep({ cap: 'comic.emperor.3.3',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
        c.save(); c.fillStyle = '#fff6c8';                                         // one star brighter than the rest
        c.shadowColor = '#fff6c8'; c.shadowBlur = 14;
        c.beginPath(); c.arc(250, 36, 3.5, 0, 6.2832); c.fill(); c.restore();
      },
      back: function (c) { cmNightSnow(c, 150); },
      mid: function (c) { cmCreature(c, 160, 206, 300, { skin: 'emperor', eye: { shut: 0.35, wide: 1, lx: 0.5, ly: -0.6 } }); } })
  ]
];

/* ---- Orca: go big ---- */
COMICS.orca = [
  [
    cmDeep({ cap: 'comic.orca.1.1',
      back: function (c, tt) {
        cmSea(c, tt);
      },
      mid: function (c, tt) {
        cmOrcaFin(c, 96 + Math.min(1, tt / 120) * 110, 100, 120, tt);
      } }),
    cmDeep({ cap: 'comic.orca.1.2',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 250, 340, { skin: 'orca', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } }),
    cmDeep({ cap: 'comic.orca.1.3',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'bubble', 160, 120, 150, tt);
        cmCreature(c, 160, 124, 80, { skin: 'orca', gait: tt * 0.4 });
      } })
  ],
  [
    cmDeep({ cap: 'comic.orca.2.1',
      back: function (c, tt) {
        cmIce(c);
        cmCrack(c, 40, 40);
      },
      mid: function (c, tt) {
        cmRamp(c, 160, 62, 120, 'kicker');
        cmCreature(c, 160, 160, 70, { skin: 'orca', gait: tt * 0.6, eye: { shut: 1, wide: 1, lx: 0, ly: -1 } });
      } }),
    cmDeep({ cap: 'comic.orca.2.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 24, 1);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 100, 110, { skin: 'orca', eye: { shut: 1, wide: 1.2, lx: 0, ly: -1 } });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.whoosh'), 160, 30, 34, -0.06);
      } }),
    cmDeep({ cap: 'comic.orca.2.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        [[50, 40], [270, 60], [90, 150], [230, 170], [160, 90], [40, 110], [280, 130]].forEach(function (p) { cmThing(c, 'tree', p[0], p[1], 22); });
        cmShadow(c, 150, 140, 16);                                                 // her shadow, far below
        cmCreature(c, 170, 70, 120, { skin: 'orca', noShadow: true });
      } })
  ],
  [
    cmDeep({ cap: 'comic.orca.3.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmPuff(c, 160, 130, 60, 14);
        cmCreature(c, 160, 110, 100, { skin: 'orca' });
      },
      near: function (c, tt) {
        cmSfx(c, cmWord('comic.sfx.splash'), 250, 40, 30, 0.12, '#bff2ff');
      } }),
    cmDeep({ cap: 'comic.orca.3.2',
      back: function (c, tt) {
        cmIce(c);
        cmSpeed(c, 12, 0.7);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 150, 80, { skin: 'orca', gait: tt * 0.5 });
        cmCreature(c, 160, 16, 20, { skin: 'snowcap', still: true });
      } }),
    cmDeep({ cap: 'comic.orca.3.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 280, { skin: 'orca', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- Aurora: made of everything you have done ---- */
COMICS.aurora = [
  [
    cmDeep({ cap: 'comic.aurora.1.1',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
        cmAurora(c, tt, 1);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      } }),
    cmDeep({ cap: 'comic.aurora.1.2',
      far: function (c, tt) {
        cmNight(c, tt, 104, true);
        cmAurora(c, tt, 0.7);
      },
      back: function (c, tt) {
        var g = Math.min(1, tt / 40);
        cmNightSnow(c, 104);
        c.save(); c.globalCompositeOperation = 'lighter';
        c.strokeStyle = 'rgba(140,255,200,.5)'; c.lineWidth = 6;
        c.beginPath(); c.moveTo(160, 40); c.lineTo(160, 40 + g * 84); c.stroke(); c.restore();
      },
      mid: function (c, tt) {
        var g = Math.min(1, tt / 40);
        c.save(); c.globalAlpha = g; cmCreature(c, 160, 150, 60, { skin: 'aurora' }); c.restore();
      } }),
    cmDeep({ cap: 'comic.aurora.1.3',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
        cmAurora(c, tt, 0.5);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 236, 360, { skin: 'aurora', eye: { shut: 1, wide: 1, lx: 0, ly: 0 } });
      } })
  ],
  [
    cmDeep({ cap: 'comic.aurora.2.1',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        cmThing(c, 'bubble', 160, 120, 150, tt);
        cmCreature(c, 160, 124, 80, { skin: 'aurora', gait: tt * 0.4 });
      } }),
    cmDeep({ cap: 'comic.aurora.2.2',
      back: function (c, tt) {
        cmIce(c);
      },
      mid: function (c, tt) {
        [[40, 40], [280, 50], [50, 170], [280, 160]].forEach(function (p, i) {
          var k = (tt * 0.01 + i * 0.2) % 0.6, x = p[0] + (160 - p[0]) * k, y = p[1] + (110 - p[1]) * k;
          cmPull(c, x, y, 160, 110, 0.6); cmThing(c, 'fish', x, y, 30, tt + i * 5);
        });
        cmCreature(c, 160, 110, 70, { skin: 'aurora' });
      } }),
    cmDeep({ cap: 'comic.aurora.2.3',
      back: function (c, tt) {
        cmSnow(c);
      },
      mid: function (c, tt) {
        for (var i = 0; i < 10; i++) cmThing(c, 'fish', 160 + Math.cos(i * 0.63 + tt * 0.03) * 110, 104 + Math.sin(i * 0.63 + tt * 0.03) * 70, 28, tt + i * 3);
        cmCreature(c, 160, 110, 70, { skin: 'aurora', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ],
  [
    cmDeep({ cap: 'comic.aurora.3.1',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
        cmAurora(c, tt, 1);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 170, 50, { skin: 'aurora', gait: tt * 0.4 });
      } }),
    cmDeep({ cap: 'comic.aurora.3.2',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 160, 56, { skin: 'aurora' });
      },
      near: function (c, tt) {
        cmStars(c, 160, 70, 5, 5, 34);
      } }),
    cmDeep({ cap: 'comic.aurora.3.3',
      far: function (c, tt) {
        cmNight(c, tt, 150, true);
        cmAurora(c, tt, 0.8);
      },
      back: function (c, tt) {
        cmNightSnow(c, 150);
      },
      mid: function (c, tt) {
        cmCreature(c, 160, 230, 300, { skin: 'aurora', eye: { shut: 0.1, wide: 1, lx: 0, ly: 0 } });
      } })
  ]
];

/* ---- the dragon (1.3.4): an egg lost in a storm, and the girl who saved it ---- */
/* the egg: an egg's own shape, narrower at the top, covered in scales
   that overlap like a carp's, each lit on its upper edge, gold at the
   rims; light from the upper left, the snow's blue on its shadowed side.
   Cracked as far as `k` (0 to 1), the cracks glowing from inside. */
function cmEggPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y - s * 0.95);
  c.bezierCurveTo(x + s * 0.6, y - s * 0.95, x + s * 0.76, y + s * 0.15, x + s * 0.62, y + s * 0.52);
  c.bezierCurveTo(x + s * 0.46, y + s * 0.92, x - s * 0.46, y + s * 0.92, x - s * 0.62, y + s * 0.52);
  c.bezierCurveTo(x - s * 0.76, y + s * 0.15, x - s * 0.6, y - s * 0.95, x, y - s * 0.95); c.closePath();
}
function cmDragonEgg(c, x, y, s, k, tt) {
  c.save();
  var g = c.createRadialGradient(x - s * 0.28, y - s * 0.4, s * 0.05, x, y, s * 1.05);
  g.addColorStop(0, '#ff9b78'); g.addColorStop(0.45, '#d8392b'); g.addColorStop(1, '#5e0c06');
  c.fillStyle = g; cmEggPath(c, x, y, s); c.fill();
  c.save(); cmEggPath(c, x, y, s); c.clip();
  /* the scales, row by row from the top, smaller where the egg curves away */
  var rows = 9;
  for (var r = 0; r < rows; r++) {
    var v = -0.85 + r * 0.2, yy = y + v * s, half = s * 0.7 * Math.sqrt(Math.max(0.05, 1 - Math.pow((v + 0.1) / 1.05, 2)));
    var n = 7, sc = s * 0.17;
    for (var q = 0; q < n; q++) {
      var u = -1 + (q + (r & 1 ? 0.5 : 0)) / (n - 1) * 2;
      if (u > 1.05) continue;
      var sx = x + Math.sin(u * Math.PI / 2) * half, w = sc * Math.max(0.35, Math.cos(u * Math.PI / 2)), h = sc * 0.95;
      var lit = 0.5 - u * 0.3 - v * 0.25;
      var sg = c.createLinearGradient(sx, yy - h * 0.2, sx, yy + h);
      sg.addColorStop(0, 'rgba(255,170,130,' + Math.max(0, Math.min(0.55, lit)).toFixed(2) + ')'); sg.addColorStop(0.7, 'rgba(200,40,25,0)'); sg.addColorStop(1, 'rgba(90,10,5,.18)');
      c.fillStyle = sg;
      c.beginPath(); c.moveTo(sx - w, yy); c.quadraticCurveTo(sx - w, yy + h, sx, yy + h * 1.05); c.quadraticCurveTo(sx + w, yy + h, sx + w, yy); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,205,90,' + (0.35 + Math.max(0, lit) * 0.4).toFixed(2) + ')'; c.lineWidth = Math.max(0.6, s * 0.012);
      c.beginPath(); c.moveTo(sx - w, yy); c.quadraticCurveTo(sx - w, yy + h, sx, yy + h * 1.05); c.quadraticCurveTo(sx + w, yy + h, sx + w, yy); c.stroke();
    }
  }
  /* the snow's light on the shadow side, and the dark where it sits */
  var rl = c.createLinearGradient(x + s * 0.3, y, x + s * 0.75, y);
  rl.addColorStop(0, 'rgba(170,220,255,0)'); rl.addColorStop(1, 'rgba(170,220,255,.38)');
  c.fillStyle = rl; c.fillRect(x, y - s, s, s * 2);
  var ao = c.createLinearGradient(0, y + s * 0.3, 0, y + s * 0.95);
  ao.addColorStop(0, 'rgba(40,0,0,0)'); ao.addColorStop(1, 'rgba(40,0,0,.5)');
  c.fillStyle = ao; c.fillRect(x - s, y, s * 2, s);
  /* the gloss: a soft window of light, and a sharp one in it */
  var gl = c.createRadialGradient(x - s * 0.3, y - s * 0.48, 0, x - s * 0.3, y - s * 0.48, s * 0.32);
  gl.addColorStop(0, 'rgba(255,255,255,.65)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gl; c.beginPath(); c.ellipse(x - s * 0.3, y - s * 0.48, s * 0.2, s * 0.32, -0.45, 0, 6.2832); c.fill();
  c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(x - s * 0.34, y - s * 0.56, s * 0.045, s * 0.09, -0.45, 0, 6.2832); c.fill();
  c.restore();
  c.strokeStyle = 'rgba(70,8,4,.8)'; c.lineWidth = Math.max(1, s * 0.022); cmEggPath(c, x, y, s); c.stroke();
  /* the cracks, glowing from inside */
  if (k > 0) {
    var pts = [[-0.5, -0.1], [-0.36, -0.28], [-0.2, -0.05], [-0.02, -0.34], [0.16, -0.1], [0.32, -0.32], [0.5, -0.12], [0.6, -0.22]];
    var m = Math.max(2, Math.round(pts.length * k));
    cmGlow(c, x, y - s * 0.2, s * (0.5 + 0.6 * k), 0.45 * k);
    c.lineJoin = 'round'; c.lineCap = 'round';
    [[Math.max(2, s * 0.07), 'rgba(255,150,40,.45)'], [Math.max(1.2, s * 0.03), '#ffe9a0']].forEach(function (L) {
      c.strokeStyle = L[1]; c.lineWidth = L[0];
      c.beginPath(); for (var i = 0; i < m; i++) { var p = pts[i]; if (i) c.lineTo(x + p[0] * s, y + p[1] * s); else c.moveTo(x + p[0] * s, y + p[1] * s); }
      if (k > 0.6) { c.moveTo(x - s * 0.2, y - s * 0.05); c.lineTo(x - s * 0.26, y + s * 0.18); c.moveTo(x + s * 0.16, y - s * 0.1); c.lineTo(x + s * 0.24, y + s * 0.12); }
      c.stroke();
    });
  }
  c.restore();
}
/* the snow it sits in: a hollow behind and a drift in front, banked up
   round its foot, blue in the shade, with a glitter on top */
function cmEggNest(c, x, y, s, front) {
  c.save();
  var base = y + s * 0.72;
  if (!front) {
    c.fillStyle = 'rgba(40,70,110,.22)'; c.beginPath(); c.ellipse(x + s * 0.1, base + s * 0.08, s * 1.0, s * 0.22, 0, 0, 6.2832); c.fill();
    var bg = c.createLinearGradient(0, base - s * 0.3, 0, base + s * 0.2);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#cfe2f2');
    c.fillStyle = bg; c.beginPath(); c.ellipse(x, base - s * 0.02, s * 0.95, s * 0.2, 0, Math.PI, 0); c.fill();
  } else {
    var fg = c.createLinearGradient(0, base - s * 0.2, 0, base + s * 0.25);
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(0.6, '#eef5fb'); fg.addColorStop(1, '#b9d3e8');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(x - s * 1.0, base + s * 0.12);
    c.bezierCurveTo(x - s * 0.8, base - s * 0.12, x - s * 0.5, base - s * 0.02, x - s * 0.3, base - s * 0.14);
    c.bezierCurveTo(x - s * 0.1, base - s * 0.24, x + s * 0.2, base - s * 0.04, x + s * 0.42, base - s * 0.16);
    c.bezierCurveTo(x + s * 0.65, base - s * 0.26, x + s * 0.85, base - s * 0.02, x + s * 1.0, base + s * 0.1);
    c.bezierCurveTo(x + s * 0.6, base + s * 0.28, x - s * 0.6, base + s * 0.3, x - s * 1.0, base + s * 0.12); c.fill();
    c.strokeStyle = 'rgba(120,160,200,.35)'; c.lineWidth = Math.max(1, s * 0.02); c.stroke();
    c.fillStyle = 'rgba(150,190,225,.35)';                           // its shade under the lip
    c.beginPath(); c.ellipse(x + s * 0.25, base + s * 0.08, s * 0.5, s * 0.06, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#ffffff';                                          // glitter
    [[-0.6, -0.02], [-0.2, -0.12], [0.3, -0.08], [0.7, 0.0], [0.05, 0.05]].forEach(function (p) {
      c.beginPath(); c.arc(x + p[0] * s, base + p[1] * s, Math.max(0.8, s * 0.018), 0, 6.2832); c.fill();
    });
  }
  c.restore();
}
/* footprints in the snow, someone's, coming to the egg: whoever saved it
   is never shown (the owner: a person, not said who) */
function cmSteps(c, x0, y0, x1, y1, n, tt) {
  var shown = Math.min(n, Math.floor((tt || 0) / 6) + 1);
  for (var i = 0; i < shown; i++) {
    var f = i / (n - 1), x = x0 + (x1 - x0) * f + (i & 1 ? 5 : -5), y = y0 + (y1 - y0) * f;
    c.fillStyle = 'rgba(110,150,190,.45)';
    c.beginPath(); c.ellipse(x, y, 3.4, 5.4, Math.atan2(x1 - x0, y0 - y1), 0, 6.2832); c.fill();
  }
}
/* a koi, from above: the game's own fish */
function cmKoi(c, x, y, s, a, tt) {
  if (typeof Game === 'undefined' || !Game.drawKoi) return;
  c.save(); c.translate(x, y); c.rotate(a); Game.drawKoi(c, 0, 0, s, tt * 0.2, 0, true); c.restore();
}
/* inside the house: a wooden wall, paper screens, and the fire's light */
function cmHouse(c, tt) {
  var g = c.createLinearGradient(0, 0, 0, COMIC_H); g.addColorStop(0, '#6a4630'); g.addColorStop(1, '#3a2418');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  c.fillStyle = '#f4e6c8';
  for (var i = 0; i < 4; i++) c.fillRect(14 + i * 76, 18, 64, 92);
  c.strokeStyle = '#5a3a24'; c.lineWidth = 3;
  for (var j = 0; j < 4; j++) { c.strokeRect(14 + j * 76, 18, 64, 92); c.beginPath(); c.moveTo(46 + j * 76, 18); c.lineTo(46 + j * 76, 110); c.moveTo(14 + j * 76, 64); c.lineTo(78 + j * 76, 64); c.stroke(); }
  c.fillStyle = '#8a6a48'; c.fillRect(0, 140, COMIC_W, 60);
  var f = 0.85 + 0.15 * Math.sin(tt * 0.3);
  cmGlow(c, 160, 160, 120 * f, 0.55);
}
/* the sky in a storm, dark and torn */
function cmStorm(c, tt) {
  var g = c.createLinearGradient(0, 0, 0, COMIC_H); g.addColorStop(0, '#2a2f45'); g.addColorStop(1, '#5a6480');
  c.fillStyle = g; c.fillRect(0, 0, COMIC_W, COMIC_H);
  c.fillStyle = 'rgba(20,24,38,.55)';
  for (var i = 0; i < 6; i++) { c.beginPath(); c.ellipse((i * 70 + tt * 0.8) % (COMIC_W + 80) - 40, 30 + (i % 3) * 14, 60, 18, 0, 0, 6.2832); c.fill(); }
}
COMICS.dragon = [
  [
    cmDeep({ cap: 'comic.dragon.1.1',
      back: function (c, tt) { cmStorm(c, tt); cmFlakes(c, tt, 40, 1.4); },
      mid: function (c, tt) {
        var y = Math.min(130, 20 + tt * 1.4);
        cmDragonEgg(c, 160 + Math.sin(tt * 0.1) * 20, y, 26, 0, tt);
      } }),
    cmDeep({ cap: 'comic.dragon.1.2',
      back: function (c, tt) { cmSnow(c); cmFlakes(c, tt, 18, 0.8); },
      mid: function (c, tt) { cmEggNest(c, 160, 128, 30, false); cmDragonEgg(c, 160, 128, 30, 0, tt); cmEggNest(c, 160, 128, 30, true); } }),
    cmDeep({ cap: 'comic.dragon.1.3',
      back: function (c, tt) { cmNight(c, tt, 150); cmNightSnow(c, 150); },
      mid: function (c, tt) { cmDragonEgg(c, 160, 150, 22, 0, tt); c.fillStyle = 'rgba(200,220,255,.35)'; c.beginPath(); c.ellipse(160, 168, 34, 8, 0, 0, 6.2832); c.fill(); } })
  ],
  [
    cmDeep({ cap: 'comic.dragon.2.1', who: true,
      back: function (c, tt) { cmSnow(c); },
      mid: function (c, tt) { cmEggNest(c, 220, 150, 22, false); cmDragonEgg(c, 220, 150, 22, 0, tt); cmEggNest(c, 220, 150, 22, true); cmSteps(c, 40, 40, 196, 160, 12, tt); } }),
    cmDeep({ cap: 'comic.dragon.2.2', who: true,
      back: function (c, tt) { cmHouse(c, tt); },
      mid: function (c, tt) { cmGlow(c, 160, 140, 70, 0.45); cmDragonEgg(c, 160, 140, 30, 0, tt); } }),
    cmDeep({ cap: 'comic.dragon.2.3', who: true,
      back: function (c, tt) { cmHouse(c, tt); },
      mid: function (c, tt) {
        cmDragonEgg(c, 200, 140, 26, 0, tt);
        for (var i = 0; i < 3; i++) cmKoi(c, 90 + i * 30, 170 - ((tt * 0.8 + i * 20) % 30), 10, 0.4 + i * 0.3, tt);
      } })
  ],
  [
    cmDeep({ cap: 'comic.dragon.3.1',
      back: function (c, tt) { cmHouse(c, tt); },
      mid: function (c, tt) { cmDragonEgg(c, 160 + Math.sin(tt * 0.9) * 3, 120, 40, Math.min(1, tt / 60), tt); } }),
    cmDeep({ cap: 'comic.dragon.3.2',
      back: function (c, tt) { cmSnow(c); cmFlakes(c, tt, 14, 0.6); },
      mid: function (c, tt) { cmGlow(c, 160, 110, 90, 0.35); cmCreature(c, 160, 110, 150, { skin: 'dragon', gait: tt * 0.3 }); } }),
    cmDeep({ cap: 'comic.dragon.3.3', who: true,
      back: function (c, tt) { cmSnow(c); },
      mid: function (c, tt) { cmSteps(c, 20, 190, 120, 120, 9, 99); cmCreature(c, 200, 100, 130, { skin: 'dragon', gait: tt * 0.3 }); } })
  ]
];

function comicFor(id) { return COMICS[id] || null; }

/* every comic is deep (cmDeep, cmPaint) */
Object.keys(COMICS).forEach(function (id) { COMICS[id].deep = true; });
