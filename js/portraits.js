/* portraits.js — the face each creature shows on a player's profile and on
   the board: head and shoulders seen from the front, on a disc of ice, lit
   from the top left as everything on the hill is (asked for by the owner,
   18 Nov 2026; the first one, Snowcap's, was approved as the model for the
   rest). One for every creature, and one for each in its own skin. They are
   painted like everything else in the game, in a 100-unit box.

   drawPortrait(canvas, size, creatureId, skinId) fills a canvas;
   paintPortrait(ctx, size, creatureId, skinId) paints into a context. */

/* ---- helpers ---- */
function ptMix(a, b, t) {
  var pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  var r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  var g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  var bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}
function ptLit(col, t) { return t >= 0 ? ptMix(col, '#ffffff', t) : ptMix(col, '#000000', -t); }
/* a body part lit from the top left: light, mid and dark of its colour */
function ptRound(c, x, y, rx, ry, cols, lx, ly) {
  var g = c.createRadialGradient(x - rx * (lx || 0.4), y - ry * (ly || 0.55), Math.min(rx, ry) * 0.1, x, y, Math.max(rx, ry) * 1.1);
  g.addColorStop(0, cols[0]); g.addColorStop(0.55, cols[1]); g.addColorStop(1, cols[2]);
  return g;
}
function ptEll(c, x, y, rx, ry, rot) { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); }
/* the eyes, big and bright as they are on the hill: a white ring if the
   creature has one, the white, the iris, the pupil and two glints */
function ptEyes(c, cx, cy, gap, r, o) {
  o = o || {};
  [-1, 1].forEach(function (s) {
    var ex = cx + s * gap, ey = cy;
    c.fillStyle = 'rgba(0,0,0,.22)'; ptEll(c, ex + 0.5, ey + 1.4, r * 1.22, r * 1.25); c.fill();
    if (o.ring) { c.fillStyle = o.ring; ptEll(c, ex, ey, r * 1.27, r * 1.3); c.fill(); }
    if (o.dead && s < 0) {                          // a dead eye, milky, and the scratch across it
      var dg = c.createRadialGradient(ex - r * 0.3, ey - r * 0.3, 0.5, ex, ey, r);
      dg.addColorStop(0, '#f2f4ea'); dg.addColorStop(1, '#b8bfae');
      c.fillStyle = dg; ptEll(c, ex, ey, r, r * 1.03); c.fill();
      c.fillStyle = 'rgba(150,160,140,.6)'; ptEll(c, ex - s * 0.6, ey + 0.6, r * 0.55, r * 0.55); c.fill();
      return;
    }
    c.fillStyle = o.white || '#ffffff'; ptEll(c, ex, ey, r, r * 1.03); c.fill();
    c.strokeStyle = 'rgba(20,24,32,.45)'; c.lineWidth = 0.6; c.stroke();
    var px = ex - s * r * 0.12 + (o.lx || 0), py = ey + r * 0.09;
    c.fillStyle = o.iris || '#1c2230'; ptEll(c, px, py, r * 0.66, r * 0.66); c.fill();
    c.fillStyle = '#0b0d12'; ptEll(c, px, py, r * 0.4, r * 0.4); c.fill();
    if (o.veins && s > 0) {
      c.strokeStyle = 'rgba(200,40,40,.55)'; c.lineWidth = 0.35; c.beginPath();
      [0.3, 1.4, 2.6, 3.7, 5].forEach(function (a) { c.moveTo(ex + Math.cos(a) * r * 0.95, ey + Math.sin(a) * r * 0.95); c.lineTo(ex + Math.cos(a + 0.2) * r * 0.62, ey + Math.sin(a + 0.2) * r * 0.62); });
      c.stroke();
    }
    c.fillStyle = '#ffffff'; ptEll(c, px - r * 0.26, py - r * 0.27, r * 0.24, r * 0.24); c.fill();
    ptEll(c, px + r * 0.21, py + r * 0.21, r * 0.11, r * 0.11); c.fill();
  });
}
function ptCheeks(c, cx, cy, gap, col) {
  c.fillStyle = col || 'rgba(255,130,150,.38)';
  [-1, 1].forEach(function (s) { ptEll(c, cx + s * gap, cy, 5, 3); c.fill(); });
}
function ptShade(c, x, y, rx, ry, a) {
  c.fillStyle = 'rgba(15,22,40,' + (a || 0.28) + ')'; ptEll(c, x, y, rx, ry); c.fill();
}
function ptSparkle(c, x, y, r, col) {
  c.fillStyle = col || '#ffffff';
  c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x + r * 0.18, y - r * 0.18, x + r, y); c.quadraticCurveTo(x + r * 0.18, y + r * 0.18, x, y + r);
  c.quadraticCurveTo(x - r * 0.18, y + r * 0.18, x - r, y); c.quadraticCurveTo(x - r * 0.18, y - r * 0.18, x, y - r); c.closePath(); c.fill();
}
function ptStar(c, x, y, r, col) {
  c.fillStyle = col; c.beginPath();
  for (var q = 0; q < 10; q++) { var a = q / 10 * 6.2832 - Math.PI / 2, rr = q % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
/* the disc of ice the portrait sits on, and a clip to it */
function ptDisc(c, a, b) {
  var g = c.createRadialGradient(34, 28, 6, 50, 50, 70);
  g.addColorStop(0, a || '#e9f6fd'); g.addColorStop(1, b || '#a9d6ef');
  c.fillStyle = g; c.beginPath(); c.arc(50, 50, 50, 0, 6.2832); c.fill();
}
function ptClip(c) { c.beginPath(); c.arc(50, 50, 50, 0, 6.2832); c.clip(); }

/* ---- penguins ----
   Shoulders and a white front up to the throat, two flippers, a big round
   head; what tells one kind from another is on the head (the white of the
   face, a cap, a patch, a ring round the eyes) and the beak. */
var PT_PENGUIN = {
  snowcap: { face: 'adelie', beak: '#2c2e34', bill: 'short' },
  mitten:  { face: 'chinstrap', beak: '#26282e', bill: 'short', scarf: '#e0483c' },
  puffin:  { face: 'puffin', beak: '#e4521c', bill: 'puffin', collar: true },
  bubbles: { face: 'little', beak: '#3a3f48', bill: 'short', bubble: '#9fe8ff', iris: '#8f9aa6' },
  compass: { face: 'gentoo', beak: '#f0541c', bill: 'long', compass: '#f0b429' },
  emperor: { face: 'emperor', beak: '#1f2126', bill: 'long', patch: ['#ffe9a6', '#f5a524'], stripe: '#ff8a3d', blaze: '#f5b82e' },
  aurora:  { face: 'king', beak: '#1f2126', bill: 'long', patch: ['#e9fdff', '#5fd8ee'], stripe: '#8ff3ff', crown: '#c9f6ff' }
};
function ptPenguin(c, S, P, o) {
  o = o || {};
  var body = o.body || S.body, fl = o.flipper || S.flipper || S.body;
  c.save(); ptClip(c);
  ptShade(c, 56, 104, 44, 30, 0.18);
  [-1, 1].forEach(function (s) {
    c.save(); c.translate(50 + s * 31, 86); c.rotate(s * 0.32);
    var fg = c.createLinearGradient(-6, -10, 8, 18); fg.addColorStop(0, fl[0]); fg.addColorStop(1, fl[2]);
    c.fillStyle = fg; ptEll(c, 0, 6, 7, 17); c.fill();
    c.restore();
  });
  c.fillStyle = ptRound(c, 52, 92, 36, 32, body, 0.38, 0.6); ptEll(c, 50, 100, 36, 32); c.fill();
  /* the white front: on an emperor and a king it warms toward the throat */
  var wg = c.createRadialGradient(44, 82, 2, 52, 96, 28);
  if (P.patch && !o.noWarm) { wg.addColorStop(0, ptMix(P.patch[0], '#ffffff', 0.4)); wg.addColorStop(0.5, '#f2f0e8'); wg.addColorStop(1, '#b9c4d2'); }
  else { wg.addColorStop(0, o.front || '#ffffff'); wg.addColorStop(0.6, o.front2 || '#eaf0f6'); wg.addColorStop(1, '#b9c4d2'); }
  c.fillStyle = wg; c.beginPath(); c.moveTo(50, 70); c.bezierCurveTo(64, 70, 74, 84, 72, 100); c.lineTo(28, 100); c.bezierCurveTo(26, 84, 36, 70, 50, 70); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 0.6; c.beginPath();
  for (var ry = 78, r = 0; ry < 100; ry += 4, r++) for (var rx = 18 + (r % 2) * 3; rx < 84; rx += 6) {
    if (Math.abs(rx - 50) < 22 - (ry - 70) * 0.1) continue;
    c.moveTo(rx + 2.6, ry); c.arc(rx, ry, 2.6, 0.2, 2.9);
  }
  c.stroke();
  if (P.collar) {                                  // a puffin's black collar under its face, the white below it
    c.fillStyle = body[1]; c.beginPath(); c.moveTo(26, 70); c.quadraticCurveTo(50, 66, 74, 70); c.lineTo(73, 80); c.quadraticCurveTo(50, 86, 27, 80); c.closePath(); c.fill();
  }
  if (o.chest) o.chest(c);
  ptShade(c, 53, 70, 24, 8, 0.28);
  c.restore();
  /* the head */
  c.fillStyle = ptRound(c, 50, 44, 29, 27, [ptLit(body[0], 0.12), body[1], body[2]]); ptEll(c, 50, 45, 29, 27); c.fill();
  var f = P.face;
  if (f === 'chinstrap' || f === 'puffin') {
    /* a white face under a dark cap; the chinstrap's thin dark band under it */
    var fg2 = c.createRadialGradient(44, 48, 2, 50, 54, 26);
    fg2.addColorStop(0, '#ffffff'); fg2.addColorStop(0.7, f === 'puffin' ? '#e4e6ea' : '#eef2f6'); fg2.addColorStop(1, f === 'puffin' ? '#a9afba' : '#bcc6d3');
    c.fillStyle = fg2; c.beginPath();
    c.moveTo(23, 46); c.bezierCurveTo(26, 30, 74, 30, 77, 46); c.bezierCurveTo(78, 64, 66, 72, 50, 72); c.bezierCurveTo(34, 72, 22, 64, 23, 46);
    c.closePath(); c.fill();
    /* the chinstrap's thin band, low, along the bottom of his face from
       ear to ear (higher up it read as a grin) */
    if (f === 'chinstrap') { c.strokeStyle = ptLit(body[1], 0.05); c.lineWidth = 1.1; c.beginPath(); c.moveTo(24.6, 57); c.quadraticCurveTo(50, 81, 75.4, 57); c.stroke(); }
  }
  if (f === 'little') {
    /* a little blue penguin's white comes up its throat to its lower cheeks,
       fading into the blue (a sharp white crescent there read as a grin) */
    c.save(); ptEll(c, 50, 45, 29, 27); c.clip();
    var lg = c.createLinearGradient(0, 50, 0, 72); lg.addColorStop(0, 'rgba(240,246,250,0)'); lg.addColorStop(0.55, 'rgba(240,246,250,.7)'); lg.addColorStop(1, 'rgba(250,252,255,1)');
    c.fillStyle = lg; ptEll(c, 50, 70, 25, 18); c.fill();
    c.restore();
  }
  if (f === 'gentoo') {
    c.fillStyle = '#f4f7fb'; c.beginPath(); c.moveTo(30, 34); c.quadraticCurveTo(50, 24, 70, 34); c.quadraticCurveTo(50, 30, 30, 34); c.closePath(); c.fill();
    [-1, 1].forEach(function (s) { c.fillStyle = '#f4f7fb'; ptEll(c, 50 + s * 15, 34, 5.5, 2.6, s * 0.35); c.fill(); });
  }
  if (P.patch) {
    /* the bright ear patches either side, a spot of the colour down the neck */
    [-1, 1].forEach(function (s) {
      /* behind the eye and inside the head, a teardrop running down toward
         the neck, deep at the top and paling below (out past the head they
         were a pair of earmuffs) */
      var pg = c.createLinearGradient(0, 42, 0, 68);
      pg.addColorStop(0, P.patch[1]); pg.addColorStop(1, P.patch[0]);
      c.fillStyle = pg; c.beginPath(); c.moveTo(50 + s * 17, 41); c.quadraticCurveTo(50 + s * 27, 44, 50 + s * 25.6, 56); c.quadraticCurveTo(50 + s * 24, 66, 50 + s * 18.6, 70); c.quadraticCurveTo(50 + s * 19.6, 58, 50 + s * 17, 41); c.closePath(); c.fill();
    });
  }
  c.fillStyle = 'rgba(255,255,255,.14)'; ptEll(c, 39, 30, 10, 5, -0.5); c.fill();
  c.strokeStyle = 'rgba(120,150,200,.35)'; c.lineWidth = 0.8; c.beginPath(); c.ellipse(50, 45, 28.4, 26.4, 0, 3.3, 4.7); c.stroke();
  if (!o.noCheeks) ptCheeks(c, 50, 55, 18, o.cheek);
  ptEyes(c, 50, 43, 11, 6.6, { ring: o.ring !== undefined ? o.ring : (f === 'adelie' ? '#f6f9fc' : f === 'puffin' ? '#e8553a' : null), dead: o.dead, veins: o.veins, iris: o.iris || P.iris });
  if (f === 'puffin') {                            // the little dark marks fore and aft of a puffin's eye
    c.fillStyle = '#3a3f4c'; [-1, 1].forEach(function (s) { ptEll(c, 50 + s * 11, 34.6, 1.6, 0.8); c.fill(); });
  }
  ptBeak(c, P, o);
}
/* the beak, toward us: short and dark, long and orange, or a puffin's,
   tall and banded in grey, yellow and orange */
function ptBeak(c, P, o) {
  var bk = o.beak || P.beak;
  if (P.bill === 'puffin') {
    c.fillStyle = 'rgba(0,0,0,.3)'; ptEll(c, 51.4, 63, 8, 4); c.fill();
    var pb = function () { c.beginPath(); c.moveTo(42.6, 51.6); c.quadraticCurveTo(50, 47.6, 57.4, 51.6); c.quadraticCurveTo(57, 59, 50, 65); c.quadraticCurveTo(43, 59, 42.6, 51.6); c.closePath(); };
    c.fillStyle = '#e4521c'; pb(); c.fill();
    c.save(); pb(); c.clip();
    c.fillStyle = '#6b7383'; c.fillRect(40, 46, 20, 6.2);
    c.fillStyle = '#f4c43a'; c.fillRect(40, 52.2, 20, 1.6);
    c.strokeStyle = 'rgba(120,30,0,.45)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(44, 57); c.quadraticCurveTo(50, 59, 56, 57); c.moveTo(45.6, 60.6); c.quadraticCurveTo(50, 62, 54.4, 60.6); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.3)'; ptEll(c, 46.6, 55, 1.6, 3, 0.2); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(80,20,0,.5)'; c.lineWidth = 0.5; pb(); c.stroke();
    return;
  }
  var long = P.bill === 'long', tip = long ? 63 : 60.4, w = long ? 4.8 : 5.6;
  c.fillStyle = 'rgba(0,0,0,.3)'; ptEll(c, 51.2, tip - 1.8, w, 3); c.fill();
  var bkg = c.createLinearGradient(45, 50, 55, tip); bkg.addColorStop(0, ptLit(bk, 0.32)); bkg.addColorStop(1, ptLit(bk, -0.45));
  c.fillStyle = bkg; c.beginPath(); c.moveTo(50 - w, 53.2); c.quadraticCurveTo(50, 50.4, 50 + w, 53.2); c.quadraticCurveTo(50 + w * 0.6, tip - 1.6, 50, tip); c.quadraticCurveTo(50 - w * 0.6, tip - 1.6, 50 - w, 53.2); c.closePath(); c.fill();
  /* an emperor's and a king's colour on the lower half of the beak, along
     its sides (a curve across it read as a smile) */
  if (P.stripe) {
    c.save(); c.beginPath(); c.moveTo(50 - w, 53.2); c.quadraticCurveTo(50, 50.4, 50 + w, 53.2); c.quadraticCurveTo(50 + w * 0.6, tip - 1.6, 50, tip); c.quadraticCurveTo(50 - w * 0.6, tip - 1.6, 50 - w, 53.2); c.clip();
    c.fillStyle = P.stripe; [-1, 1].forEach(function (s) { ptEll(c, 50 + s * w * 0.62, 55.4, w * 0.36, 2.6, s * -0.5); c.fill(); });
    c.restore();
  }
  c.fillStyle = 'rgba(255,255,255,.35)'; ptEll(c, 48, 53, 2, 0.8, -0.2); c.fill();
}
/* Mitten's red scarf, knotted, a tail hanging over his chest */
function ptScarf(c, col) {
  var dk = ptLit(col, -0.35);
  c.fillStyle = 'rgba(15,22,40,.3)'; c.beginPath(); c.moveTo(24, 71); c.quadraticCurveTo(52, 82, 78, 70); c.lineTo(77, 76); c.quadraticCurveTo(52, 88, 25, 77); c.closePath(); c.fill();
  var sg = c.createLinearGradient(0, 64, 0, 80); sg.addColorStop(0, ptLit(col, 0.18)); sg.addColorStop(1, dk);
  c.fillStyle = sg; c.beginPath(); c.moveTo(23, 67); c.quadraticCurveTo(50, 78, 77, 66); c.lineTo(77, 73); c.quadraticCurveTo(50, 85, 23, 74); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(24, 70.4); c.quadraticCurveTo(50, 81.4, 76.4, 69.6); c.stroke();
  c.fillStyle = sg; c.beginPath(); c.moveTo(58, 76); c.quadraticCurveTo(64, 86, 61, 99); c.lineTo(69, 99); c.quadraticCurveTo(70, 86, 65, 74); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1; c.beginPath(); c.moveTo(61, 88); c.lineTo(69.4, 87.4); c.moveTo(61.6, 94); c.lineTo(69.6, 93.4); c.stroke();
  c.fillStyle = ptLit(col, 0.1); ptEll(c, 61, 76, 4.6, 3.6, 0.3); c.fill();
}
/* Bubbles' bubble round all of him, its rainbow sheen and a window of light */
function ptBubble(c, col) {
  c.save(); ptClip(c);
  var g = c.createRadialGradient(40, 36, 30, 50, 50, 48);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.82, 'rgba(160,232,255,.12)'); g.addColorStop(1, 'rgba(160,232,255,.5)');
  c.fillStyle = g; c.beginPath(); c.arc(50, 50, 47, 0, 6.2832); c.fill();
  ['rgba(255,150,200,.55)', 'rgba(255,240,150,.5)', 'rgba(150,240,200,.5)', 'rgba(150,200,255,.55)'].forEach(function (cl, i) {
    c.strokeStyle = cl; c.lineWidth = 1.4; c.beginPath(); c.arc(50, 50, 46, 3.4 + i * 0.5, 3.9 + i * 0.5); c.stroke();
  });
  c.fillStyle = 'rgba(255,255,255,.55)'; ptEll(c, 27, 24, 6, 3, -0.7); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; ptEll(c, 74, 78, 3, 1.4, -0.7); c.fill();
  c.restore();
}
/* Compass's brass compass on its cord, on his chest */
function ptCompass(c, x, y, r, col) {
  c.strokeStyle = 'rgba(60,40,20,.75)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(36, 72); c.quadraticCurveTo(x - 2, y - r * 0.6, x, y - r); c.moveTo(64, 72); c.quadraticCurveTo(x + 2, y - r * 0.6, x, y - r); c.stroke();
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, x + 1, y + 1.4, r + 0.4, r * 0.95); c.fill();
  var g = c.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.5, col); g.addColorStop(1, '#8a5a12');
  c.fillStyle = g; ptEll(c, x, y, r, r * 0.95); c.fill();
  c.fillStyle = '#eef3f2'; ptEll(c, x, y, r * 0.72, r * 0.68); c.fill();
  c.fillStyle = '#d8302c'; c.beginPath(); c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.18, y); c.lineTo(x - r * 0.18, y); c.closePath(); c.fill();
  c.fillStyle = '#9aa3ab'; c.beginPath(); c.moveTo(x, y + r * 0.6); c.lineTo(x + r * 0.18, y); c.lineTo(x - r * 0.18, y); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.55)'; ptEll(c, x - r * 0.3, y - r * 0.32, r * 0.28, r * 0.15, -0.5); c.fill();
}
/* the emperor's gold blazes at his neck */
function ptBlazes(c, col) {
  [-1, 1].forEach(function (s) {
    var g = c.createLinearGradient(50 + s * 14, 66, 50 + s * 24, 80); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, col); g.addColorStop(1, '#a8741a');
    c.fillStyle = g; c.beginPath(); c.moveTo(50 + s * 13, 68); c.quadraticCurveTo(50 + s * 24, 70, 50 + s * 26, 82); c.quadraticCurveTo(50 + s * 19, 78, 50 + s * 13, 68); c.closePath(); c.fill();
  });
}
/* Aurora's crown of ice crystals round the top of her head, and the
   northern lights behind */
function ptAuroraSky(c) {
  c.save(); ptClip(c);
  ['rgba(120,255,200,.32)', 'rgba(140,200,255,.28)', 'rgba(200,150,255,.24)'].forEach(function (cl, i) {
    var g = c.createLinearGradient(0, 4 + i * 8, 0, 34 + i * 8); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, cl); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(0, 18 + i * 8); c.bezierCurveTo(25, 4 + i * 6, 70, 30 + i * 4, 100, 12 + i * 8); c.lineTo(100, 34 + i * 8); c.bezierCurveTo(70, 50 + i * 4, 25, 24 + i * 6, 0, 40 + i * 8); c.closePath(); c.fill();
  });
  c.restore();
}
function ptIceCrown(c, col) {
  for (var i = 0; i < 7; i++) {
    var a = Math.PI * (1.15 + i * 0.7 / 6), x = 50 + Math.cos(a) * 26, y = 45 + Math.sin(a) * 24, h = i % 2 ? 8 : 11;
    c.save(); c.translate(x, y); c.rotate(a + Math.PI / 2);
    var g = c.createLinearGradient(-2, 0, 2, -h); g.addColorStop(0, '#ffffff'); g.addColorStop(1, col);
    c.fillStyle = 'rgba(15,22,40,.25)'; c.beginPath(); c.moveTo(-2.4 + 0.8, 1); c.lineTo(0.8, -h + 1); c.lineTo(2.4 + 0.8, 1); c.closePath(); c.fill();
    c.fillStyle = g; c.beginPath(); c.moveTo(-2.4, 0); c.lineTo(0, -h); c.lineTo(2.4, 0); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(90,170,210,.6)'; c.lineWidth = 0.4; c.stroke();
    c.restore();
  }
}

/* ---- the painters, one per creature ---- */
var PORTRAIT = {};
['snowcap', 'mitten', 'puffin', 'bubbles', 'compass', 'emperor', 'aurora'].forEach(function (id) {
  PORTRAIT[id] = function (c, S, o) {
    var P = PT_PENGUIN[id];
    o = o || {};
    if (P.crown && !o.noSky) ptAuroraSky(c);
    var chest = o.chest;
    o.chest = function (cc) {
      if (P.scarf && !o.noScarf) ptScarf(cc, P.scarf);
      if (P.compass && !o.noCompass) ptCompass(cc, 50, 86, 6.4, P.compass);
      if (P.blaze && !o.noBlaze) ptBlazes(cc, P.blaze);
      if (chest) chest(cc);
    };
    ptPenguin(c, S, P, o);
    if (P.crown && !o.noCrown) ptIceCrown(c, P.crown);
    if (P.bubble && !o.noBubble) ptBubble(c, P.bubble);
  };
});

/* ---- the furred and the finned ----
   The same head and shoulders, the shoulders in the body's colours with a
   paler front where the animal has one; then whatever its face is made of. */
function ptBust(c, body, o) {
  o = o || {};
  c.save(); ptClip(c);
  ptShade(c, 56, 104, 44, 30, 0.18);
  c.fillStyle = ptRound(c, 52, 92, o.w || 38, 32, body, 0.38, 0.6); ptEll(c, 50, 101, o.w || 38, 32); c.fill();
  if (o.front) {
    var wg = c.createRadialGradient(46, 84, 2, 52, 98, 26);
    wg.addColorStop(0, ptLit(o.front, 0.25)); wg.addColorStop(1, ptLit(o.front, -0.2));
    c.fillStyle = wg; ptEll(c, 50, 100, o.fw || 20, 26); c.fill();
  }
  if (o.fur) {                                    // shaggy: strands down the shoulders
    c.strokeStyle = 'rgba(255,240,220,.12)'; c.lineWidth = 0.8; c.beginPath();
    for (var x = 14; x < 88; x += 3.4) { var y0 = 76 + Math.abs(x - 50) * 0.18; c.moveTo(x, y0); c.quadraticCurveTo(x + 1, y0 + 8, x - 0.5, y0 + 18); }
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.beginPath();
    for (x = 15.7; x < 88; x += 3.4) { var y1 = 78 + Math.abs(x - 50) * 0.18; c.moveTo(x, y1); c.quadraticCurveTo(x + 1, y1 + 8, x - 0.5, y1 + 18); }
    c.stroke();
  }
  if (o.chest) o.chest(c);
  ptShade(c, 53, 71, o.sw || 24, 8, 0.28);
  c.restore();
}
function ptWhiskers(c, cx, cy, col, len) {
  c.strokeStyle = col || 'rgba(255,255,255,.75)'; c.lineWidth = 0.6; c.beginPath();
  [-1, 1].forEach(function (s) { [-2.2, 0, 2.2].forEach(function (d) { c.moveTo(cx + s * 7, cy + d * 0.6); c.lineTo(cx + s * (7 + (len || 14)), cy + d * 1.6 - 1); }); });
  c.stroke();
}
function ptNose(c, x, y, w, col) {
  c.fillStyle = 'rgba(0,0,0,.25)'; ptEll(c, x + 0.6, y + 1, w, w * 0.62); c.fill();
  var g = c.createRadialGradient(x - w * 0.3, y - w * 0.3, 0.2, x, y, w); g.addColorStop(0, ptLit(col, 0.35)); g.addColorStop(1, col);
  c.fillStyle = g; c.beginPath(); c.moveTo(x - w, y - w * 0.4); c.quadraticCurveTo(x, y - w * 0.9, x + w, y - w * 0.4); c.quadraticCurveTo(x + w * 0.5, y + w * 0.7, x, y + w * 0.7); c.quadraticCurveTo(x - w * 0.5, y + w * 0.7, x - w, y - w * 0.4); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)'; ptEll(c, x - w * 0.35, y - w * 0.35, w * 0.3, w * 0.16, -0.3); c.fill();
}
function ptHead(c, x, y, rx, ry, body) {
  c.fillStyle = ptRound(c, x, y, rx, ry, [ptLit(body[0], 0.12), body[1], body[2]]); ptEll(c, x, y, rx, ry); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; ptEll(c, x - rx * 0.38, y - ry * 0.55, rx * 0.34, ry * 0.18, -0.5); c.fill();
}
function ptMuzzle(c, x, y, rx, ry, col) {
  var g = c.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 0.5, x, y, Math.max(rx, ry));
  g.addColorStop(0, ptLit(col, 0.3)); g.addColorStop(1, ptLit(col, -0.12));
  c.fillStyle = g; ptEll(c, x, y, rx, ry); c.fill();
}
/* round ears, dark backs with a pale spot or a pink inside */
function ptRoundEars(c, x, y, gap, r, back, inner) {
  [-1, 1].forEach(function (s) {
    c.fillStyle = back; ptEll(c, x + s * gap, y, r, r * 0.92); c.fill();
    c.fillStyle = inner; ptEll(c, x + s * gap + s * 0.4, y + 0.6, r * 0.55, r * 0.5); c.fill();
  });
}

PORTRAIT.seal = function (c, S) {
  var b = S.body;
  ptBust(c, b, {});
  /* her front flippers, held up at the sides */
  [-1, 1].forEach(function (s) { c.save(); c.translate(50 + s * 29, 88); c.rotate(s * 0.5); c.fillStyle = ptRound(c, 0, 4, 7, 15, S.flipper); ptEll(c, 0, 6, 6.5, 15); c.fill(); c.restore(); });
  ptHead(c, 50, 46, 27, 25, b);
  c.fillStyle = 'rgba(40,50,60,.22)';
  [[33, 32, 3.4], [64, 30, 2.8], [70, 48, 2.4], [28, 50, 2.6], [56, 24, 2]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2] * 0.75, 0.4); c.fill(); });
  ptMuzzle(c, 50, 58, 13, 8.6, S.mark);
  ptEyes(c, 50, 42, 12, 7.2, { iris: '#141820' });
  /* a seal's nostrils: two slits closing in a V over the muzzle (a round
     nose made her a dog) */
  [-1, 1].forEach(function (s) {
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(50 + s * 1.2 + 0.4, 51.6 + 0.6); c.quadraticCurveTo(50 + s * 3.4 + 0.4, 52.4 + 0.6, 50 + s * 3.6 + 0.4, 55.2 + 0.6); c.stroke();
    c.strokeStyle = S.nose; c.lineWidth = 1.3; c.beginPath(); c.moveTo(50 + s * 1.2, 51.6); c.quadraticCurveTo(50 + s * 3.4, 52.4, 50 + s * 3.6, 55.2); c.stroke();
  });
  c.fillStyle = 'rgba(60,70,80,.55)'; [-1, 1].forEach(function (s) { [[5, 58], [8, 60], [6, 62.4]].forEach(function (d) { ptEll(c, 50 + s * d[0], d[1], 0.6, 0.6); c.fill(); }); });
  c.strokeStyle = 'rgba(60,70,80,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 56.6); c.lineTo(50, 60); c.moveTo(46, 61.4); c.quadraticCurveTo(50, 63.6, 54, 61.4); c.stroke();
  ptWhiskers(c, 50, 59, 'rgba(255,255,255,.8)', 15);
};
PORTRAIT.otter = function (c, S) {
  var b = S.body;
  ptBust(c, b, { front: '#c99a6c', fw: 18 });
  /* her paws on her chest, holding a clam */
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 51, 89, 9, 6); c.fill();
  var cg = c.createRadialGradient(47, 84, 0.5, 50, 87, 8); cg.addColorStop(0, '#ffffff'); cg.addColorStop(1, '#cfc2a8');
  c.fillStyle = cg; c.beginPath(); c.moveTo(42, 88); c.quadraticCurveTo(50, 78, 58, 88); c.quadraticCurveTo(50, 92, 42, 88); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(120,100,80,.55)'; c.lineWidth = 0.5; c.beginPath(); [-4, -2, 0, 2, 4].forEach(function (d) { c.moveTo(50 + d * 1.6, 89.6); c.lineTo(50 + d * 0.5, 82); }); c.stroke();
  [-1, 1].forEach(function (s) { c.fillStyle = S.paws; ptEll(c, 50 + s * 9, 88, 4.6, 3.8, s * 0.4); c.fill(); c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 0.4; c.beginPath(); [-1, 0, 1].forEach(function (d) { c.moveTo(50 + s * 7.4, 86.4 + d * 1.2); c.lineTo(50 + s * 5.4, 86.6 + d * 1.3); }); c.stroke(); });
  /* a sea otter's head is pale, grizzled cream all over, broad and flat,
     her ears small and low at its sides, her nose broad, flat and dark
     (a brown hood round a pale face, round ears on top, made her a bear) */
  [-1, 1].forEach(function (s) { c.fillStyle = ptLit(S.mark, -0.35); ptEll(c, 50 + s * 26.4, 42, 2.6, 2.2); c.fill(); c.fillStyle = 'rgba(120,90,60,.6)'; ptEll(c, 50 + s * 26.6, 42.2, 1.2, 1); c.fill(); });
  ptHead(c, 50, 47, 27, 23, [ptLit(S.mark, 0.35), S.mark, ptLit(S.mark, -0.3)]);
  c.strokeStyle = 'rgba(150,120,90,.25)'; c.lineWidth = 0.6; c.beginPath();
  for (var gq = 0; gq < 16; gq++) { var ga = 3.4 + gq * 0.19; c.moveTo(50 + Math.cos(ga) * 20, 47 + Math.sin(ga) * 17); c.lineTo(50 + Math.cos(ga) * 25.4, 47 + Math.sin(ga) * 21.6); }
  c.stroke();
  ptCheeks(c, 50, 56, 16);
  ptEyes(c, 50, 42, 11, 5.6, { iris: '#1a120c' });
  /* the whisker pads, puffed either side of her nose */
  [-1, 1].forEach(function (s) { ptMuzzle(c, 50 + s * 5.2, 58.4, 6.6, 5.4, '#f6ecdc'); });
  c.fillStyle = 'rgba(0,0,0,.25)'; ptEll(c, 50.6, 54.6, 5.4, 3); c.fill();
  var ng = c.createRadialGradient(48.6, 52.6, 0.4, 50, 54, 5.4); ng.addColorStop(0, ptLit(S.nose, 0.35)); ng.addColorStop(1, S.nose);
  c.fillStyle = ng; c.beginPath(); c.moveTo(45, 52.4); c.quadraticCurveTo(50, 50.6, 55, 52.4); c.quadraticCurveTo(54.4, 56.4, 50, 57); c.quadraticCurveTo(45.6, 56.4, 45, 52.4); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; ptEll(c, 48, 52.4, 1.8, 0.7, -0.2); c.fill();
  c.strokeStyle = 'rgba(60,40,20,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 57); c.lineTo(50, 60); c.moveTo(46.4, 61); c.quadraticCurveTo(50, 63, 53.6, 61); c.stroke();
  ptWhiskers(c, 50, 59, 'rgba(255,255,255,.85)', 13);
};
PORTRAIT.lemming = function (c, S) {
  var b = S.body;
  ptBust(c, b, { front: S.mark, fw: 17 });
  ptRoundEars(c, 50, 31, 22, 2.8, ptLit(b[2], -0.1), 'rgba(250,200,180,.6)');   // small, nearly lost in the fur, as a lemming's are
  ptHead(c, 50, 47, 27, 25, b);
  /* the dark cap from his brow back over his head */
  var sg = c.createLinearGradient(50, 22, 50, 40); sg.addColorStop(0, S.stripe); sg.addColorStop(1, 'rgba(74,42,20,0)');
  c.fillStyle = sg; c.beginPath(); c.moveTo(30, 34); c.quadraticCurveTo(50, 14, 70, 34); c.quadraticCurveTo(50, 40, 30, 34); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,230,190,.25)'; c.lineWidth = 0.7; c.beginPath();
  for (var a = 3.5; a < 6; a += 0.22) { c.moveTo(50 + Math.cos(a) * 24, 47 + Math.sin(a) * 22); c.lineTo(50 + Math.cos(a) * 27.4, 47 + Math.sin(a) * 25.2); }
  c.stroke();
  ptCheeks(c, 50, 57, 17);
  ptMuzzle(c, 50, 58, 11.4, 8, S.mark);
  ptEyes(c, 50, 45, 11, 6.4, { iris: '#1a120c' });
  ptNose(c, 50, 54.6, 2.8, '#c26a5a');
  /* two front teeth */
  c.fillStyle = '#ffffff'; c.fillRect(48.1, 60.6, 1.7, 2.6); c.fillRect(50.2, 60.6, 1.7, 2.6);
  c.strokeStyle = 'rgba(90,50,30,.5)'; c.lineWidth = 0.4; c.strokeRect(48.1, 60.6, 1.7, 2.6); c.strokeRect(50.2, 60.6, 1.7, 2.6);
  c.strokeStyle = 'rgba(90,50,30,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 56.6); c.lineTo(50, 59.4); c.moveTo(46.6, 60.2); c.quadraticCurveTo(50, 61.4, 53.4, 60.2); c.stroke();
  ptWhiskers(c, 50, 58, 'rgba(255,250,240,.8)', 12);
};
/* horns of horn: pale over the boss, darkening to the tip; a musk ox's
   sweep down past his cheeks and hook up and out */
function ptOxHorns(c, col) {
  [-1, 1].forEach(function (s) {
    var hp = function (dx, dy) {
      c.beginPath(); c.moveTo(50 + s * 2 + dx, 27 + dy);
      c.bezierCurveTo(50 + s * 22 + dx, 20 + dy, 50 + s * 36 + dx, 30 + dy, 50 + s * 33 + dx, 50 + dy);
      c.quadraticCurveTo(50 + s * 32 + dx, 60 + dy, 50 + s * 39 + dx, 58 + dy);
      c.quadraticCurveTo(50 + s * 30 + dx, 66 + dy, 50 + s * 27 + dx, 52 + dy);
      c.bezierCurveTo(50 + s * 28 + dx, 38 + dy, 50 + s * 18 + dx, 33 + dy, 50 + s * 2 + dx, 36 + dy); c.closePath();
    };
    c.fillStyle = 'rgba(15,22,40,.3)'; hp(1.4, 1.8); c.fill();
    var g = c.createLinearGradient(50 + s * 4, 26, 50 + s * 38, 60); g.addColorStop(0, '#f6efdc'); g.addColorStop(0.45, col); g.addColorStop(0.8, '#8a7152'); g.addColorStop(1, '#2e241b');
    c.fillStyle = g; hp(0, 0); c.fill();
    c.strokeStyle = 'rgba(60,44,28,.55)'; c.lineWidth = 0.6; hp(0, 0); c.stroke();
    c.strokeStyle = 'rgba(120,96,64,.45)'; c.lineWidth = 0.6; c.beginPath();
    for (var q = 0; q < 4; q++) { c.moveTo(50 + s * (4 + q * 3.4), 26 + q * 0.2); c.quadraticCurveTo(50 + s * (5 + q * 3.4), 31, 50 + s * (4.4 + q * 3.4), 35.6); }
    c.stroke();
    c.strokeStyle = 'rgba(255,250,235,.6)'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(50 + s * 4, 26.6); c.bezierCurveTo(50 + s * 20, 21.4, 50 + s * 33, 30, 50 + s * 32, 44); c.stroke();
  });
}
/* a musk ox's face: a long head, a long pale muzzle down to a broad dark
   nose, a beard at his chin; with `hair`, the long coat hanging round it */
function ptOxFace(c, S, b, long) {
  var hair = function (x0, y0, len, lean) { c.moveTo(x0, y0); c.quadraticCurveTo(x0 + lean, y0 + len * 0.5, x0 + lean * 0.4, y0 + len); }, x;
  /* the long hair hanging round his face, behind it */
  if (long) {
  c.fillStyle = b[2]; c.beginPath(); c.moveTo(26, 44); c.quadraticCurveTo(22, 66, 27, 82);
  for (var hx = 27; hx < 73; hx += 4.6) { c.quadraticCurveTo(hx + 1.6, 78, hx + 2.3, 86 - Math.abs(hx - 50) * 0.08); c.quadraticCurveTo(hx + 3, 79, hx + 4.6, 82); }
  c.quadraticCurveTo(78, 66, 74, 44); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath();
  for (x = 27; x <= 73; x += 3) hair(x, 50 + Math.abs(x - 50) * 0.1, 30 - Math.abs(x - 50) * 0.2, (x - 50) * 0.08);
  c.stroke();
  c.strokeStyle = 'rgba(200,170,130,.18)'; c.lineWidth = 0.8; c.beginPath();
  for (x = 28.5; x <= 73; x += 3) hair(x, 51 + Math.abs(x - 50) * 0.1, 28 - Math.abs(x - 50) * 0.2, (x - 50) * 0.08);
  c.stroke();
  }
  ptHead(c, 50, 50, 20, 25, b);
  /* the muzzle, long and pale, down to a broad dark nose */
  var mg = c.createLinearGradient(0, 50, 0, 74); mg.addColorStop(0, ptLit(S.mark, -0.25)); mg.addColorStop(1, ptLit(S.mark, 0.15));
  c.fillStyle = mg; c.beginPath(); c.moveTo(42, 52); c.quadraticCurveTo(50, 48, 58, 52); c.quadraticCurveTo(60, 66, 57, 73); c.quadraticCurveTo(50, 77, 43, 73); c.quadraticCurveTo(40, 66, 42, 52); c.closePath(); c.fill();
  ptNose(c, 50, 68.6, 5, S.nose);
  c.strokeStyle = 'rgba(40,28,18,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(46, 73.6); c.quadraticCurveTo(50, 75, 54, 73.6); c.stroke();
  /* the beard of his chin, over the bust */
  c.fillStyle = b[1]; c.beginPath(); c.moveTo(42, 72); c.quadraticCurveTo(50, 76, 58, 72); c.quadraticCurveTo(57, 80, 53, 86); c.lineTo(50.6, 83); c.lineTo(48.4, 87); c.lineTo(46.6, 83); c.quadraticCurveTo(43, 80, 42, 72); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 0.6; c.beginPath();
  for (x = 44; x <= 56; x += 2.4) hair(x, 75, 9 - Math.abs(x - 50) * 0.3, (x - 50) * 0.12);
  c.stroke();
  ptEyes(c, 50, 47, 13, 4.6, { iris: '#20160f' });
}
PORTRAIT.muskox = function (c, S) {
  /* A musk ox: a long face, not a round one; a long pale muzzle; his coat
     hangs long and shaggy off his cheeks and chin and down over his
     shoulders like a beard; the horns meet in a boss across his brow, run
     down flat by his eyes and hook out and up at the tips. A round face
     and a small snout made him a bear with horns. */
  var b = S.body;
  ptBust(c, b, { fur: true, w: 44 });
  ptOxFace(c, S, b, true);
  ptOxHorns(c, S.antler);
};
/* a reindeer's antlers: a beam back and up from each side of the crown,
   tines off it, velvet-brown at the base, pale at the points */
function ptAntlers(c, col) {
  [-1, 1].forEach(function (s) {
    var sh = function (dx, dy, lw, cl) {
      c.strokeStyle = cl; c.lineWidth = lw; c.beginPath();
      c.moveTo(50 + s * 10 + dx, 26 + dy); c.bezierCurveTo(50 + s * 16 + dx, 14 + dy, 50 + s * 28 + dx, 10 + dy, 50 + s * 36 + dx, 2 + dy);
      c.moveTo(50 + s * 15 + dx, 17 + dy); c.quadraticCurveTo(50 + s * 12 + dx, 8 + dy, 50 + s * 15 + dx, 1 + dy);
      c.moveTo(50 + s * 24 + dx, 11 + dy); c.quadraticCurveTo(50 + s * 24 + dx, 2 + dy, 50 + s * 28 + dx, -4 + dy);
      c.moveTo(50 + s * 31 + dx, 6 + dy); c.quadraticCurveTo(50 + s * 38 + dx, 8 + dy, 50 + s * 42 + dx, 6 + dy);
      c.moveTo(50 + s * 12 + dx, 22 + dy); c.quadraticCurveTo(50 + s * 6 + dx, 17 + dy, 50 + s * 6 + dx, 12 + dy);
      c.stroke();
    };
    sh(1.3, 1.7, 3.4, 'rgba(15,22,40,.28)');
    sh(0, 0, 3.2, ptLit(col, -0.25));
    sh(-0.4, -0.5, 1.2, ptLit(col, 0.35));
  });
}
PORTRAIT.reindeer = function (c, S, o) {
  o = o || {};
  var b = S.body;
  ptBust(c, b, { front: '#e8dcc8', fw: 19, chest: function (cc) {
    /* the pale mane at his throat: long shaggy locks, a ragged lower edge */
    var L = [[36, 84, -1.6], [40, 89, -1], [44, 92, -0.6], [48, 95, -0.2], [52, 94, 0.2], [56, 92, 0.6], [60, 88, 1], [64, 83, 1.6]];
    cc.fillStyle = '#ece4d6'; cc.beginPath(); cc.moveTo(33, 70); cc.quadraticCurveTo(50, 65, 67, 70);
    for (var li = L.length - 1; li >= 0; li--) { var q = L[li]; cc.quadraticCurveTo(q[0] + 2.4, q[1] - 6, q[0] + q[2], q[1]); cc.quadraticCurveTo(q[0] - 1, q[1] - 5, q[0] - 2, q[1] - 7); }
    cc.closePath(); cc.fill();
    cc.strokeStyle = 'rgba(140,120,95,.35)'; cc.lineWidth = 0.6; cc.beginPath();
    L.forEach(function (q) { cc.moveTo(q[0] - 0.6, 71); cc.quadraticCurveTo(q[0] - q[2], q[1] - 12, q[0] + q[2] * 0.6, q[1] - 2); });
    cc.stroke();
    cc.strokeStyle = 'rgba(255,255,255,.5)'; cc.lineWidth = 0.5; cc.beginPath();
    L.forEach(function (q) { cc.moveTo(q[0] + 1.2, 72); cc.quadraticCurveTo(q[0] + 0.6, q[1] - 14, q[0] + 1.4, q[1] - 6); });
    cc.stroke();
    if (o.chest) o.chest(cc);
  } });
  if (!o.noAntlers) ptAntlers(c, S.antler);
  /* his ears, out to the sides */
  [-1, 1].forEach(function (s) {
    c.save(); c.translate(50 + s * 24, 32); c.rotate(s * 0.9);
    c.fillStyle = b[1]; ptEll(c, 0, 0, 4, 8.4); c.fill();
    c.fillStyle = 'rgba(240,210,190,.7)'; ptEll(c, 0, 0.6, 2, 5.4); c.fill();
    c.restore();
  });
  /* a long face, narrowing to a broad, pale, furred muzzle (a round face
     made him a cartoon fawn) */
  c.fillStyle = ptRound(c, 50, 46, 21, 27, [ptLit(b[0], 0.12), b[1], b[2]]);
  c.beginPath(); c.moveTo(50, 22); c.bezierCurveTo(66, 22, 72, 36, 69, 48); c.bezierCurveTo(66, 60, 62, 70, 50, 74); c.bezierCurveTo(38, 70, 34, 60, 31, 48); c.bezierCurveTo(28, 36, 34, 22, 50, 22); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.14)'; ptEll(c, 42, 30, 6, 3.2, -0.5); c.fill();
  var rm = c.createLinearGradient(0, 54, 0, 74); rm.addColorStop(0, ptLit(S.mark, -0.15)); rm.addColorStop(1, ptLit(S.mark, 0.2));
  c.fillStyle = rm; c.beginPath(); c.moveTo(39, 58); c.quadraticCurveTo(50, 53, 61, 58); c.quadraticCurveTo(63, 68, 58, 73); c.quadraticCurveTo(50, 77, 42, 73); c.quadraticCurveTo(37, 68, 39, 58); c.closePath(); c.fill();
  ptCheeks(c, 50, 54, 15, 'rgba(255,140,150,.26)');
  ptEyes(c, 50, 43, 12, 5.6, { iris: '#20160f' });
  if (o.nose) o.nose(c);
  else ptNose(c, 50, 64, 5, S.nose);
  c.strokeStyle = 'rgba(70,50,30,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 67.4); c.lineTo(50, 70); c.moveTo(45.6, 71.2); c.quadraticCurveTo(50, 73, 54.4, 71.2); c.stroke();
};
PORTRAIT.hare = function (c, S, o) {
  o = o || {};
  var b = S.body;
  ptBust(c, b, { front: '#ffffff', fw: 16 });
  /* the long ears standing up, pink inside, their tips dark */
  [-1, 1].forEach(function (s) {
    c.save(); c.translate(50 + s * 10, 28); c.rotate(s * 0.22);
    var ear = function () { c.beginPath(); c.moveTo(-5, 2); c.bezierCurveTo(-7, -14, -5, -26, 0, -30); c.bezierCurveTo(5, -26, 7, -14, 5, 2); c.closePath(); };
    c.fillStyle = 'rgba(15,22,40,.25)'; c.save(); c.translate(1.2, 1.6); ear(); c.restore(); c.fill();
    c.fillStyle = ptRound(c, -1, -12, 6, 16, b, 0.5, 0.3); ear(); c.fill();
    c.fillStyle = 'rgba(250,190,190,.7)'; c.beginPath(); c.moveTo(-2.4, 0); c.bezierCurveTo(-3.6, -12, -2.6, -21, 0, -24); c.bezierCurveTo(2.6, -21, 3.6, -12, 2.4, 0); c.closePath(); c.fill();
    c.save(); ear(); c.clip(); c.fillStyle = o.earTip || S.nose; ptEll(c, 0, -30, 8, 7); c.fill(); c.restore();
    c.restore();
  });
  ptHead(c, 50, 48, 24, 23, b);
  ptCheeks(c, 50, 57, 15);
  ptMuzzle(c, 50, 59, 11, 8, S.mark);
  ptEyes(c, 50, 45, 10.4, 6.2, { iris: '#2a2018' });
  c.fillStyle = ptLit(S.nose, 0.1); c.beginPath(); c.moveTo(47.6, 55); c.quadraticCurveTo(50, 53.8, 52.4, 55); c.quadraticCurveTo(50, 58, 47.6, 55); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(60,50,40,.55)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 57); c.lineTo(50, 59.6); c.moveTo(50, 59.6); c.quadraticCurveTo(47.4, 61.6, 45.6, 60); c.moveTo(50, 59.6); c.quadraticCurveTo(52.6, 61.6, 54.4, 60); c.stroke();
  ptWhiskers(c, 50, 58, 'rgba(120,110,100,.6)', 13);
};
PORTRAIT.leopard = function (c, S, o) {
  o = o || {};
  var b = o.body || S.body, spot = o.spot || S.spot;
  ptBust(c, b, { front: '#eef0f3', fw: 15, chest: function (cc) {
    cc.fillStyle = spot; [[22, 86, 3], [34, 80, 2.6], [70, 82, 2.8], [80, 92, 3], [28, 96, 2.6]].forEach(function (d) {
      for (var q = 0; q < 4; q++) { var a = q * 1.6 + d[0]; cc.beginPath(); cc.ellipse(d[0] + Math.cos(a) * d[2], d[1] + Math.sin(a) * d[2], d[2] * 0.45, d[2] * 0.3, a, 0, 6.2832); cc.fill(); }
    });
    if (o.chest) o.chest(cc);
  } });
  ptRoundEars(c, 50, 27, 19, 5.4, ptLit(b[2], -0.2), '#e6e8ec');
  ptHead(c, 50, 47, 26, 24, b);
  c.fillStyle = spot;
  [[37, 30, 1.4], [44, 27, 1.2], [56, 27, 1.2], [63, 30, 1.4], [50, 25, 1.1], [31, 40, 1.3], [69, 40, 1.3], [40, 34, 1], [60, 34, 1]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2]); c.fill(); });
  ptMuzzle(c, 50, 58, 12, 9, S.mark);
  ptEyes(c, 50, 44, 10.6, 6.2, { iris: '#9fb3a0' });
  ptNose(c, 50, 54.4, 3.4, '#8a6666');
  c.strokeStyle = 'rgba(50,40,40,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 56.6); c.lineTo(50, 59.6); c.moveTo(50, 59.6); c.quadraticCurveTo(47, 62, 45, 60); c.moveTo(50, 59.6); c.quadraticCurveTo(53, 62, 55, 60); c.stroke();
  ptWhiskers(c, 50, 58, 'rgba(255,255,255,.85)', 15);
};
PORTRAIT.owl = function (c, S, o) {
  o = o || {};
  var b = S.body;
  /* her wings folded at her sides, flecked */
  c.save(); ptClip(c);
  [-1, 1].forEach(function (s) { c.save(); c.translate(50 + s * 30, 90); c.rotate(s * 0.28); c.fillStyle = ptRound(c, 0, 0, 11, 22, S.flipper); ptEll(c, 0, 4, 11, 22); c.fill(); c.restore(); });
  c.restore();
  ptBust(c, b, { chest: function (cc) {
    cc.fillStyle = S.mark;
    [[34, 84], [44, 90], [56, 86], [66, 92], [40, 97], [60, 98], [28, 94], [72, 84]].forEach(function (d) { cc.beginPath(); cc.moveTo(d[0] - 2, d[1]); cc.quadraticCurveTo(d[0], d[1] - 1.4, d[0] + 2, d[1]); cc.quadraticCurveTo(d[0], d[1] + 0.6, d[0] - 2, d[1]); cc.fill(); });
    if (o.chest) o.chest(cc);
  } });
  ptHead(c, 50, 47, 28, 25, b);
  /* the flat round face, two discs about the eyes */
  [-1, 1].forEach(function (s) { var g = c.createRadialGradient(50 + s * 11, 45, 1, 50 + s * 11, 46, 13); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#dbe5ef'); c.fillStyle = g; ptEll(c, 50 + s * 11, 46, 12.4, 12); c.fill(); });
  c.fillStyle = S.mark; [[36, 30], [44, 27], [56, 27], [64, 30], [30, 38], [70, 38], [50, 26]].forEach(function (d) { c.beginPath(); c.moveTo(d[0] - 1.6, d[1]); c.quadraticCurveTo(d[0], d[1] - 1.1, d[0] + 1.6, d[1]); c.quadraticCurveTo(d[0], d[1] + 0.5, d[0] - 1.6, d[1]); c.fill(); });
  ptEyes(c, 50, 45, 11, 7.4, { iris: S.accent, white: '#fff6dc' });
  /* the little hooked beak, dark, half in her feathers */
  c.fillStyle = 'rgba(0,0,0,.25)'; ptEll(c, 50.8, 58, 2.6, 1.6); c.fill();
  c.fillStyle = S.nose; c.beginPath(); c.moveTo(47.2, 52.6); c.quadraticCurveTo(50, 51, 52.8, 52.6); c.quadraticCurveTo(52, 57, 50, 59.4); c.quadraticCurveTo(48, 57, 47.2, 52.6); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.35)'; ptEll(c, 48.8, 53.6, 0.9, 1.6); c.fill();
};
PORTRAIT.walrus = function (c, S, o) {
  o = o || {};
  var b = S.body;
  ptBust(c, b, { w: 42, chest: o.chest });
  /* wrinkles across his shoulders */
  c.save(); ptClip(c); c.strokeStyle = 'rgba(60,30,20,.3)'; c.lineWidth = 0.8; c.beginPath();
  [80, 86, 92].forEach(function (y) { c.moveTo(18, y + 4); c.quadraticCurveTo(50, y - 4, 82, y + 4); }); c.stroke(); c.restore();
  ptHead(c, 50, 45, 30, 25, b);
  c.strokeStyle = 'rgba(60,30,20,.3)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(36, 30); c.quadraticCurveTo(50, 26, 64, 30); c.moveTo(38, 34); c.quadraticCurveTo(50, 31, 62, 34); c.stroke();
  ptEyes(c, 50, 38, 13, 5, { iris: '#2a1810' });
  /* the tusks, long and ivory, down from under his lip */
  [-1, 1].forEach(function (s) {
    var tk = function (dx, dy) { c.beginPath(); c.moveTo(50 + s * 5 + dx, 58 + dy); c.quadraticCurveTo(50 + s * 8 + dx, 74 + dy, 50 + s * 6 + dx, 90 + dy); c.quadraticCurveTo(50 + s * 4 + dx, 76 + dy, 50 + s * 1.4 + dx, 58 + dy); c.closePath(); };
    c.fillStyle = 'rgba(15,22,40,.3)'; tk(1.2, 1.6); c.fill();
    var g = c.createLinearGradient(50 + s * 1.4, 0, 50 + s * 8, 0); g.addColorStop(0, '#fffdf4'); g.addColorStop(1, '#d4c6a4');
    c.fillStyle = g; tk(0, 0); c.fill();
    c.strokeStyle = 'rgba(120,100,70,.5)'; c.lineWidth = 0.5; tk(0, 0); c.stroke();
  });
  /* the whiskered pad, two lobes, bristles in rows */
  [-1, 1].forEach(function (s) { c.fillStyle = 'rgba(15,22,40,.25)'; ptEll(c, 50 + s * 8 + 0.8, 53.4, 10.6, 8); c.fill(); });
  [-1, 1].forEach(function (s) { c.fillStyle = ptRound(c, 50 + s * 8, 52, 10.6, 8, [ptLit(S.mark, 0.25), S.mark, ptLit(S.mark, -0.25)]); ptEll(c, 50 + s * 8, 52, 10.6, 8); c.fill(); });
  c.fillStyle = 'rgba(90,50,35,.55)';
  [-1, 1].forEach(function (s) { for (var r = 0; r < 3; r++) for (var q = 0; q < 4; q++) { ptEll(c, 50 + s * (4 + q * 3.2), 49 + r * 3 + q * 0.3, 0.5, 0.5); c.fill(); } });
  c.strokeStyle = 'rgba(250,240,220,.85)'; c.lineWidth = 0.6; c.beginPath();
  [-1, 1].forEach(function (s) { for (var q = 0; q < 6; q++) { c.moveTo(50 + s * (5 + q * 2.4), 57 + q * 0.4); c.lineTo(50 + s * (6 + q * 2.6), 61 + q * 0.4); } });
  c.stroke();
  ptNose(c, 50, 44.6, 3.4, S.nose);
};
PORTRAIT.orca = function (c, S, o) {
  o = o || {};
  var b = o.body || S.body, mark = o.mark || S.mark;
  ptBust(c, b, { front: mark, fw: 22, chest: o.chest });
  [-1, 1].forEach(function (s) { c.save(); c.translate(50 + s * 30, 88); c.rotate(s * 0.55); c.fillStyle = ptRound(c, 0, 4, 8, 15, S.flipper); ptEll(c, 0, 6, 7.6, 15.6); c.fill(); c.restore(); });
  ptHead(c, 50, 46, 28, 26, b);
  if (!o.noPatches) {
    /* the white patches behind her eyes and the white of her chin */
    [-1, 1].forEach(function (s) { var g = c.createRadialGradient(50 + s * 18, 33, 1, 50 + s * 18, 34, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, ptLit(mark, -0.12)); c.fillStyle = g; ptEll(c, 50 + s * 17.6, 33.4, 7.6, 4.6, s * 0.5); c.fill(); });
    /* the white of her throat, running on down into her front (a closed
       white crescent under the mouth read as a grin) */
    var cg = c.createLinearGradient(0, 58, 0, 76); cg.addColorStop(0, ptLit(mark, -0.25)); cg.addColorStop(0.5, ptLit(mark, -0.05)); cg.addColorStop(1, o.mark ? ptLit(mark, 0.3) : '#ffffff');
    c.save(); ptClip(c);
    c.fillStyle = cg; c.beginPath(); c.moveTo(27, 101); c.bezierCurveTo(27, 70, 38, 60, 50, 59.6); c.bezierCurveTo(62, 60, 73, 70, 73, 101); c.closePath(); c.fill();
    c.restore();
  }
  c.fillStyle = 'rgba(255,255,255,.22)'; ptEll(c, 38, 30, 9, 3.6, -0.5); c.fill();
  if (!o.noEyes) ptEyes(c, 50, 45, 11, 6, { iris: '#0a0c10' });
  c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(38, 56.4); c.quadraticCurveTo(50, 60, 62, 56.4); c.stroke();
};
PORTRAIT.narwhal = function (c, S, o) {
  o = o || {};
  var b = o.body || S.body;
  PORTRAIT.orca(c, S, { body: b, mark: o.mark || S.mark, noPatches: true, noEyes: true, chest: o.chest });
  c.fillStyle = o.mottle || 'rgba(70,86,104,.32)';
  [[34, 34, 3], [46, 28, 2.4], [60, 31, 2.8], [68, 44, 2.4], [30, 48, 2.6], [56, 22, 2], [40, 54, 2], [62, 56, 2.2]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2] * 0.7, 0.5); c.fill(); });
  ptEyes(c, 50, 46, 11, 5.6, { iris: '#1a2028' });
  if (!o.noTusk) ptTusk(c, o.tusk);
};
/* the narwhal's tooth: out of the middle of her face where a nose would
   be, up between her eyes and past her head, with its left-handed spiral */
function ptTusk(c, rainbow) {
  c.save(); c.translate(50, 53); c.rotate(-0.3);   // where a nose would be, up between her eyes (out of her mouth it read wrong, the owner said)
  var tk = function (dx, dy) { c.beginPath(); c.moveTo(-2.2 + dx, dy); c.lineTo(-0.3 + dx, -54 + dy); c.lineTo(0.3 + dx, -54 + dy); c.lineTo(2.2 + dx, dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.28)'; tk(1.6, 1.2); c.fill();
  var g = c.createLinearGradient(-2.2, 0, 2.2, 0); g.addColorStop(0, '#fffaf0'); g.addColorStop(0.5, '#f0e6d2'); g.addColorStop(1, '#bdae90');
  c.fillStyle = g; tk(0, 0); c.fill();
  c.save(); tk(0, 0); c.clip();
  if (rainbow) {
    var RC = ['#ff5a6a', '#ffb43a', '#ffe24a', '#5ad87a', '#4aa8ff', '#a86af0'];
    for (var q = 0; q < 14; q++) { c.strokeStyle = RC[q % 6]; c.lineWidth = 2; c.beginPath(); c.moveTo(-3, -q * 3.6 + 1); c.lineTo(3, -q * 3.6 - 2.6); c.stroke(); }
  } else {
    c.strokeStyle = 'rgba(140,120,90,.55)'; c.lineWidth = 0.6; c.beginPath();
    for (q = 0; q < 14; q++) { c.moveTo(-3, -q * 3.6 + 1); c.lineTo(3, -q * 3.6 - 2.6); }
    c.stroke();
  }
  c.restore();
  c.restore();
}

/* ---- the skins ----
   Each is its creature's portrait in the skin's colours, with what the
   skin wears on the hill seen now from the front. */
function ptWith(S, pal) { var o = {}, k; for (k in S) o[k] = S[k]; for (k in pal) o[k] = pal[k]; return o; }
var PORTRAIT_ALT = {};

/* Snowcap the zombie: green and blotched, a scar stitched over his head, a
   dirty bandage round his neck, one eye dead and milky, the other yellow and
   bloodshot, and flies */
PORTRAIT_ALT.zombie = function (c, S) {
  var Z = ptWith(S, { body: ['#8ea67e', '#5b7550', '#2c3d27'], flipper: ['#86a076', '#52704a', '#2a3a25'] });
  PORTRAIT.snowcap(c, Z, { ring: '#e4ead8', dead: true, veins: true, iris: '#9aa018', cheek: 'rgba(70,40,90,.3)', beak: '#55513e', chest: function (cc) {
    /* the bandage round his neck, two turns, knotted, its ends hanging */
    var bd = function (y, dy) { cc.beginPath(); cc.moveTo(22, y); cc.quadraticCurveTo(50, y + 12 + dy, 78, y); cc.lineTo(78, y + 6); cc.quadraticCurveTo(50, y + 18 + dy, 22, y + 6); cc.closePath(); };
    cc.fillStyle = 'rgba(15,22,40,.3)'; bd(69.4, 0); cc.fill();
    var bg = cc.createLinearGradient(0, 66, 0, 84); bg.addColorStop(0, '#f2ecd8'); bg.addColorStop(1, '#bdb294');
    cc.fillStyle = bg; bd(67, 0); cc.fill(); bd(72.6, 1); cc.fill();
    cc.strokeStyle = 'rgba(110,90,60,.45)'; cc.lineWidth = 0.5; bd(67, 0); cc.stroke(); bd(72.6, 1); cc.stroke();
    cc.fillStyle = 'rgba(140,110,60,.35)'; [[36, 74, 2.4], [58, 79, 3], [66, 74, 1.8]].forEach(function (d) { ptEll(cc, d[0], d[1], d[2], d[2] * 0.6); cc.fill(); });
    cc.fillStyle = '#d8cfb4'; ptEll(cc, 64, 79, 3.4, 2.6, 0.3); cc.fill();
    cc.beginPath(); cc.moveTo(63, 80); cc.quadraticCurveTo(66, 88, 63, 96); cc.lineTo(66, 96); cc.quadraticCurveTo(69, 88, 66, 80); cc.closePath(); cc.fill();
    cc.beginPath(); cc.moveTo(66, 80); cc.quadraticCurveTo(73, 86, 74, 93); cc.lineTo(76.4, 92); cc.quadraticCurveTo(74, 84, 67, 79); cc.closePath(); cc.fill();
  } });
  /* rot on his head, and the stitched scar */
  c.fillStyle = 'rgba(40,60,30,.4)'; [[36, 30, 4], [63, 28, 3], [70, 46, 2.4]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2] * 0.7, 0.5); c.fill(); });
  c.fillStyle = 'rgba(30,20,20,.7)'; ptEll(c, 66, 30, 1.4, 1); c.fill();
  c.strokeStyle = '#3a2a22'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(40, 24); c.quadraticCurveTo(50, 20, 60, 25); c.stroke();
  c.lineWidth = 0.6; c.beginPath(); for (var q = 0; q < 6; q++) { var x = 42 + q * 3.4, y = 22.6 - Math.sin(q / 5 * Math.PI) * 1.4 + q * 0.2; c.moveTo(x - 0.6, y - 1.6); c.lineTo(x + 0.6, y + 1.6); } c.stroke();
  c.strokeStyle = 'rgba(60,30,30,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(34, 38); c.lineTo(44, 48); c.moveTo(35, 41.6); c.lineTo(37.6, 39.4); c.moveTo(38.4, 44.6); c.lineTo(41, 42.4); c.stroke();
  /* flies */
  [[20, 22], [80, 30], [76, 14]].forEach(function (f) {
    c.fillStyle = 'rgba(200,220,240,.55)'; ptEll(c, f[0] - 1.6, f[1] - 1.4, 1.8, 1, 0.5); c.fill(); ptEll(c, f[0] + 1.6, f[1] - 1.4, 1.8, 1, -0.5); c.fill();
    c.fillStyle = '#20242a'; ptEll(c, f[0], f[1], 1.3, 1.6); c.fill();
  });
};

/* Mitten the elf: a green hat, its soft point flopping over and a bell on
   it, his pointed ears out from under the brim, his red scarf */
PORTRAIT_ALT.elf = function (c, S) {
  PORTRAIT.mitten(c, S);
  [-1, 1].forEach(function (s) {
    /* small and pointed, in his own colour, a pink inside (big and dark
       they made him a cat) */
    var ear = function (dx, dy) { c.beginPath(); c.moveTo(50 + s * 26 + dx, 37 + dy); c.quadraticCurveTo(50 + s * 33 + dx, 32 + dy, 50 + s * 37 + dx, 25 + dy); c.quadraticCurveTo(50 + s * 34 + dx, 37 + dy, 50 + s * 28 + dx, 43 + dy); c.closePath(); };
    c.fillStyle = 'rgba(15,22,40,.25)'; ear(1, 1.4); c.fill();
    c.fillStyle = ptRound(c, 50 + s * 31, 34, 6, 6, [ptLit(S.body[0], 0.2), S.body[0], S.body[1]]); ear(0, 0); c.fill();
    c.fillStyle = 'rgba(250,180,180,.65)'; c.beginPath(); c.moveTo(50 + s * 27.4, 38); c.quadraticCurveTo(50 + s * 32.4, 34, 50 + s * 35, 28.6); c.quadraticCurveTo(50 + s * 32.6, 37, 50 + s * 28.6, 41); c.closePath(); c.fill();
  });
  var dark = '#17682e', light = '#25913f';
  /* the point, flopping over to his left, and its bell */
  var pt = function (dx, dy) { c.beginPath(); c.moveTo(34 + dx, 26 + dy); c.bezierCurveTo(36 + dx, 6 + dy, 60 + dx, -2 + dy, 78 + dx, 10 + dy); c.quadraticCurveTo(82 + dx, 18 + dy, 80 + dx, 24 + dy); c.quadraticCurveTo(70 + dx, 12 + dy, 58 + dx, 14 + dy); c.quadraticCurveTo(62 + dx, 20 + dy, 66 + dx, 26 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.3)'; pt(1.4, 1.8); c.fill();
  var hg = c.createLinearGradient(34, 4, 74, 28); hg.addColorStop(0, ptLit(light, 0.15)); hg.addColorStop(1, dark);
  c.fillStyle = hg; pt(0, 0); c.fill();
  c.strokeStyle = 'rgba(8,48,20,.5)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(46, 12); c.quadraticCurveTo(52, 18, 54, 26); c.moveTo(58, 8); c.quadraticCurveTo(62, 14, 62, 20); c.stroke();
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 81.6, 27.4, 3.6, 3.6); c.fill();
  var bl = c.createRadialGradient(79, 24.6, 0.4, 80, 26, 3.6); bl.addColorStop(0, '#fff2b0'); bl.addColorStop(1, '#b8860c');
  c.fillStyle = bl; ptEll(c, 80, 26, 3.4, 3.4); c.fill();
  c.fillStyle = '#6a4a08'; ptEll(c, 80, 27.4, 1.2, 0.6); c.fill();
  /* the brim, a rolled band round his head */
  c.fillStyle = 'rgba(15,22,40,.3)'; c.beginPath(); c.moveTo(22, 30); c.quadraticCurveTo(50, 20, 78, 30); c.lineTo(78, 35); c.quadraticCurveTo(50, 26, 22, 35); c.closePath(); c.fill();
  var rg = c.createLinearGradient(0, 22, 0, 33); rg.addColorStop(0, '#e8483f'); rg.addColorStop(1, '#8e1620');
  c.fillStyle = rg; c.beginPath(); c.moveTo(21, 28); c.quadraticCurveTo(50, 17, 79, 28); c.lineTo(79, 33); c.quadraticCurveTo(50, 23, 21, 33); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,220,200,.45)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(22, 28.4); c.quadraticCurveTo(50, 18, 78, 28.4); c.stroke();
};

/* Puffin the pirate: the pirate's hat as it is known, wings swept up and a
   skull on the front, a patch over his right eye, a gold hoop in his ear
   and the gold-braided collar of a navy coat */
PORTRAIT_ALT.pirate = function (c, S) {
  PORTRAIT.puffin(c, S, { chest: function (cc) {
    [-1, 1].forEach(function (s) {
      cc.fillStyle = '#1c2f52'; cc.beginPath(); cc.moveTo(50 + s * 12, 70); cc.quadraticCurveTo(50 + s * 30, 70, 50 + s * 40, 100); cc.lineTo(50 + s * 14, 100); cc.quadraticCurveTo(50 + s * 18, 84, 50 + s * 12, 70); cc.closePath(); cc.fill();
      cc.strokeStyle = '#d9a83a'; cc.lineWidth = 1.2; cc.beginPath(); cc.moveTo(50 + s * 12.6, 71); cc.quadraticCurveTo(50 + s * 17.6, 84, 50 + s * 14.4, 100); cc.stroke();
      cc.fillStyle = '#f0c858'; [80, 89].forEach(function (y) { ptEll(cc, 50 + s * 18, y, 1.3, 1.3); cc.fill(); });
    });
  } });
  /* the patch, and its strap round his head */
  c.strokeStyle = '#15171d'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(22, 30); c.lineTo(78, 52); c.stroke();
  c.fillStyle = 'rgba(0,0,0,.3)'; ptEll(c, 61.6, 44.6, 8, 7.4, 0.3); c.fill();
  var pg = c.createRadialGradient(58.6, 40, 0.5, 61, 43, 8); pg.addColorStop(0, '#3a3d48'); pg.addColorStop(1, '#0e0f14');
  c.fillStyle = pg; ptEll(c, 61, 43, 7.6, 7, 0.3); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 0.45; c.setLineDash([0.8, 0.8]); ptEll(c, 61, 43, 6, 5.4, 0.3); c.stroke(); c.setLineDash([]);
  /* the gold hoop in his left ear */
  c.strokeStyle = 'rgba(15,22,40,.3)'; c.lineWidth = 1.5; c.beginPath(); c.arc(22.6, 57.4, 3.4, 0, 6.2832); c.stroke();
  c.strokeStyle = '#f0c43c'; c.lineWidth = 1.3; c.beginPath(); c.arc(22, 56, 3.4, 0, 6.2832); c.stroke();
  /* the hat */
  var hat = function (dx, dy) { c.beginPath(); c.moveTo(16 + dx, 32 + dy); c.quadraticCurveTo(13 + dx, 16 + dy, 18 + dx, 6 + dy); c.quadraticCurveTo(30 + dx, 14 + dy, 40 + dx, 12 + dy); c.bezierCurveTo(42 + dx, 2 + dy, 58 + dx, 2 + dy, 60 + dx, 12 + dy); c.quadraticCurveTo(70 + dx, 14 + dy, 82 + dx, 6 + dy); c.quadraticCurveTo(87 + dx, 16 + dy, 84 + dx, 32 + dy); c.quadraticCurveTo(50 + dx, 22 + dy, 16 + dx, 32 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.35)'; hat(1.6, 2); c.fill();
  var hg = c.createLinearGradient(20, 4, 70, 32); hg.addColorStop(0, '#3c3f4a'); hg.addColorStop(0.5, '#1d1e25'); hg.addColorStop(1, '#09090c');
  c.fillStyle = hg; hat(0, 0); c.fill();
  c.strokeStyle = '#e0b440'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(18, 6); c.quadraticCurveTo(30, 14, 40, 12); c.bezierCurveTo(42, 2, 58, 2, 60, 12); c.quadraticCurveTo(70, 14, 82, 6); c.stroke();
  c.strokeStyle = 'rgba(70,46,6,.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(16, 31.6); c.quadraticCurveTo(50, 21.6, 84, 31.6); c.stroke();
  var sx = 50, sy = 17;
  c.strokeStyle = '#f2f0e6'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(sx - 5, sy - 3); c.lineTo(sx + 5, sy + 4); c.moveTo(sx + 5, sy - 3); c.lineTo(sx - 5, sy + 4); c.stroke();
  c.fillStyle = '#f2f0e6'; ptEll(c, sx, sy - 0.6, 3.2, 3); c.fill(); c.fillRect(sx - 1.8, sy + 1.6, 3.6, 1.8);
  c.fillStyle = '#15171d'; ptEll(c, sx - 1.2, sy - 0.8, 0.9, 0.9); c.fill(); ptEll(c, sx + 1.2, sy - 0.8, 0.9, 0.9); c.fill();
};

/* the seal of the circus: a pleated ruff round her neck with red pompoms,
   a red clown's nose, and her striped ball balanced over her head */
PORTRAIT_ALT.circus = function (c, S) {
  PORTRAIT.seal(c, S);
  /* the ruff, its pleats fanning round the bottom of her head */
  c.save(); ptClip(c);
  for (var tier = 0; tier < 2; tier++) {
    var R0 = tier ? 26 : 30, N = 15;
    for (var q = 0; q < N; q++) {
      var a0 = Math.PI * (0.08 + q / N * 0.84), a1 = Math.PI * (0.08 + (q + 1) / N * 0.84), am = (a0 + a1) / 2;
      c.fillStyle = tier ? (q % 2 ? '#ffffff' : '#f0ecf6') : (q % 2 ? '#f2eff8' : '#d8d2e6');
      c.beginPath(); c.moveTo(50 + Math.cos(a0) * 16, 62 + Math.sin(a0) * 10); c.lineTo(50 + Math.cos(a0) * R0, 64 + Math.sin(a0) * (R0 * 0.55));
      c.quadraticCurveTo(50 + Math.cos(am) * (R0 + 3), 64 + Math.sin(am) * (R0 * 0.55 + 2), 50 + Math.cos(a1) * R0, 64 + Math.sin(a1) * (R0 * 0.55));
      c.lineTo(50 + Math.cos(a1) * 16, 62 + Math.sin(a1) * 10); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(90,86,130,.4)'; c.lineWidth = 0.4; c.stroke();
    }
  }
  c.fillStyle = '#e23a3a';
  for (q = 0; q < 8; q++) { var ap = Math.PI * (0.12 + q / 7 * 0.76); ptEll(c, 50 + Math.cos(ap) * 31.6, 64 + Math.sin(ap) * 18.6, 1.6, 1.6); c.fill(); }
  c.restore();
  /* the clown's nose over her own */
  c.fillStyle = 'rgba(0,0,0,.3)'; ptEll(c, 51, 55.6, 4.4, 3.6); c.fill();
  var ng = c.createRadialGradient(48.6, 52, 0.4, 50, 54, 4.4); ng.addColorStop(0, '#ff8a80'); ng.addColorStop(0.6, '#e2262a'); ng.addColorStop(1, '#8a0e14');
  c.fillStyle = ng; ptEll(c, 50, 54, 4.2, 4); c.fill();
  c.fillStyle = 'rgba(255,255,255,.7)'; ptEll(c, 48.6, 52.4, 1.2, 0.7, -0.5); c.fill();
  /* the ball, up over her head */
  var bx = 50, by = 12, br = 11;
  c.fillStyle = 'rgba(15,22,40,.25)'; ptEll(c, bx + 2, by + 3, br, br * 0.9); c.fill();
  var cols = ['#e23a3a', '#f4c62c', '#2f7fe0', '#ffffff', '#2fbf6e', '#f4c62c'];
  for (var k = 0; k < 6; k++) { c.fillStyle = cols[k]; c.beginPath(); c.moveTo(bx, by); c.arc(bx, by, br, k / 6 * 6.2832 + 0.4, (k + 1) / 6 * 6.2832 + 0.4); c.closePath(); c.fill(); }
  var bs = c.createRadialGradient(bx - 3.6, by - 4, 0.5, bx, by, br); bs.addColorStop(0, 'rgba(255,255,255,.55)'); bs.addColorStop(0.45, 'rgba(255,255,255,0)'); bs.addColorStop(1, 'rgba(20,30,60,.38)');
  c.fillStyle = bs; ptEll(c, bx, by, br, br); c.fill();
  c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 0.7; ptEll(c, bx, by, br, br); c.stroke();
};

/* the lemming miner: a yellow hard hat with a lamp on the front, its beam
   up and out, coal dust on his face, and a pickaxe over his shoulder */
PORTRAIT_ALT.miner = function (c, S) {
  PORTRAIT.lemming(c, S);
  /* the pickaxe over his right shoulder */
  c.save(); ptClip(c);
  c.strokeStyle = 'rgba(15,22,40,.3)'; c.lineWidth = 3; c.beginPath(); c.moveTo(70, 100); c.lineTo(86, 56); c.stroke();
  c.strokeStyle = '#8a5a2c'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(68.6, 99); c.lineTo(84.6, 55); c.stroke();
  c.strokeStyle = '#555a64'; c.lineWidth = 3; c.beginPath(); c.moveTo(74, 52); c.quadraticCurveTo(86, 52, 96, 62); c.stroke();
  c.strokeStyle = '#b8bec8'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(75, 51); c.quadraticCurveTo(86, 51, 95, 60.6); c.stroke();
  c.restore();
  /* coal dust */
  [[36, 52, 4], [63, 50, 3.4], [56, 33, 2.6]].forEach(function (b) { var g = c.createRadialGradient(b[0], b[1], 0.2, b[0], b[1], b[2]); g.addColorStop(0, 'rgba(30,24,20,.42)'); g.addColorStop(1, 'rgba(30,24,20,0)'); c.fillStyle = g; ptEll(c, b[0], b[1], b[2], b[2]); c.fill(); });
  /* the beam */
  var lg = c.createLinearGradient(50, 16, 50, -10); lg.addColorStop(0, 'rgba(255,240,170,.55)'); lg.addColorStop(1, 'rgba(255,240,170,0)');
  c.fillStyle = lg; c.beginPath(); c.moveTo(47, 16); c.lineTo(32, -6); c.lineTo(68, -6); c.lineTo(53, 16); c.closePath(); c.fill();
  /* the hat: a dome with a ridge and a brim */
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 51.4, 33.4, 29, 6); c.fill();
  var br = c.createLinearGradient(0, 28, 0, 36); br.addColorStop(0, '#f6cc2c'); br.addColorStop(1, '#a87a08');
  c.fillStyle = br; ptEll(c, 50, 32, 29, 5.4); c.fill();
  var dg = c.createRadialGradient(42, 16, 1, 50, 26, 22); dg.addColorStop(0, '#fff4b0'); dg.addColorStop(0.5, '#f2c21c'); dg.addColorStop(1, '#b8860c');
  c.fillStyle = dg; c.beginPath(); c.moveTo(29, 31); c.bezierCurveTo(29, 8, 71, 8, 71, 31); c.quadraticCurveTo(50, 35, 29, 31); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(150,110,10,.6)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(50.6, 13.6); c.lineTo(50.6, 32); c.stroke();
  c.strokeStyle = 'rgba(255,250,210,.8)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(49.4, 13.8); c.lineTo(49.4, 31.6); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; ptEll(c, 39, 20, 5, 2.4, -0.6); c.fill();
  /* the lamp */
  c.fillStyle = '#3e4048'; ptEll(c, 50, 22, 5, 4.4); c.fill();
  var lp = c.createRadialGradient(50, 21.6, 0.3, 50, 22, 5); lp.addColorStop(0, 'rgba(255,252,220,1)'); lp.addColorStop(0.6, 'rgba(255,240,170,.9)'); lp.addColorStop(1, 'rgba(255,240,170,0)');
  c.fillStyle = lp; ptEll(c, 50, 22, 4.4, 3.8); c.fill();
};

/* the musk ox viking: a steel helmet on his head with a bronze crest, his
   own horns coming out through it, a fur collar and a red cloak */
PORTRAIT_ALT.viking = function (c, S) {
  var b = S.body;
  ptBust(c, b, { fur: false, w: 42, chest: function (cc) {
    var cg = cc.createLinearGradient(0, 70, 0, 100); cg.addColorStop(0, '#c23038'); cg.addColorStop(1, '#5a0e14');
    cc.fillStyle = cg; cc.beginPath(); cc.moveTo(8, 100); cc.quadraticCurveTo(14, 74, 50, 72); cc.quadraticCurveTo(86, 74, 92, 100); cc.closePath(); cc.fill();
    cc.strokeStyle = 'rgba(60,0,8,.45)'; cc.lineWidth = 0.9; cc.beginPath(); [26, 38, 62, 74].forEach(function (x) { cc.moveTo(x, 80); cc.quadraticCurveTo(x + (x < 50 ? -2 : 2), 90, x + (x < 50 ? -4 : 4), 100); }); cc.stroke();
    for (var k = 0; k <= 12; k++) {
      var t = k / 12, fx = 18 + t * 64, fy = 76 - Math.sin(t * Math.PI) * 5;
      cc.fillStyle = 'rgba(15,22,40,.3)'; ptEll(cc, fx + 1, fy + 1.4, 4.2, 4.2); cc.fill();
    }
    for (k = 0; k <= 12; k++) {
      var t2 = k / 12, fx2 = 18 + t2 * 64, fy2 = 76 - Math.sin(t2 * Math.PI) * 5;
      var fg = cc.createRadialGradient(fx2 - 1.2, fy2 - 1.3, 0.3, fx2, fy2, 4.2); fg.addColorStop(0, '#d8c8b0'); fg.addColorStop(1, '#6a5a46');
      cc.fillStyle = fg; ptEll(cc, fx2, fy2, 4, 4); cc.fill();
    }
  } });
  ptOxFace(c, S, b, false);   // the musk ox's long face, as without the skin
  /* the helmet over his brow */
  c.fillStyle = 'rgba(15,22,40,.35)'; c.beginPath(); c.moveTo(25, 40); c.bezierCurveTo(25, 12, 75, 12, 75, 40); c.quadraticCurveTo(50, 46, 25, 40); c.closePath(); c.fill();
  var hg = c.createRadialGradient(40, 18, 1, 50, 30, 28); hg.addColorStop(0, '#f6f8fb'); hg.addColorStop(0.45, '#a2a8b2'); hg.addColorStop(1, '#454a53');
  c.fillStyle = hg; c.beginPath(); c.moveTo(24, 38); c.bezierCurveTo(24, 10, 76, 10, 76, 38); c.quadraticCurveTo(50, 43, 24, 38); c.closePath(); c.fill();
  c.strokeStyle = '#b07c30'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(24.4, 37.6); c.quadraticCurveTo(50, 42.6, 75.6, 37.6); c.stroke();
  c.strokeStyle = 'rgba(255,226,160,.6)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(25, 36.6); c.quadraticCurveTo(50, 41.4, 75, 36.6); c.stroke();
  c.strokeStyle = '#c0903e'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(50, 14); c.lineTo(50, 46); c.stroke();
  c.strokeStyle = 'rgba(255,232,175,.75)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(49, 15); c.lineTo(49, 45); c.stroke();
  c.fillStyle = '#ead8aa'; [20, 26, 32].forEach(function (y) { ptEll(c, 51.6, y, 0.7, 0.7); c.fill(); }); [32, 68].forEach(function (x) { ptEll(c, x, 38.6, 0.7, 0.7); c.fill(); });
  c.fillStyle = 'rgba(255,255,255,.45)'; ptEll(c, 38, 21, 5, 2.4, -0.6); c.fill();
  /* his horns, out through the sides of it, in bronze sleeves */
  c.save(); c.beginPath(); c.rect(0, 0, 100, 100); c.ellipse(50, 30, 16, 20, 0, 0, 6.2832); c.clip('evenodd');
  ptOxHorns(c, S.antler);
  c.restore();
  [-1, 1].forEach(function (s) {
    var bz = c.createLinearGradient(50 + s * 15, 0, 50 + s * 19, 0); bz.addColorStop(0, '#f0c878'); bz.addColorStop(1, '#6a4a18');
    c.fillStyle = bz; ptEll(c, 50 + s * 17, 27, 2.6, 5.4, s * 0.3); c.fill();
  });
};

/* Bubbles the astronaut: a white helmet round his head with a clear visor,
   his face behind it, a neck ring, and an aerial with a red light */
PORTRAIT_ALT.astro = function (c, S) {
  var A = ptWith(S, { body: ['#9aa6b8', '#6f7b8e', '#3e4757'], flipper: ['#a6b0c0', '#788396', '#424b5a'] });
  PORTRAIT.bubbles(c, A, { noBubble: true, chest: function (cc) {
    cc.fillStyle = 'rgba(15,22,40,.3)'; ptEll(cc, 29.6, 89.4, 4.4, 4.4); cc.fill();
    cc.fillStyle = '#1e3a7a'; ptEll(cc, 28.6, 88, 4.2, 4.2); cc.fill(); cc.strokeStyle = '#e8eef6'; cc.lineWidth = 0.7; cc.stroke();
    ptStar(cc, 28.6, 88, 2.4, '#ffd23a');
    [-1, 1].forEach(function (s) { cc.strokeStyle = '#c4ccd8'; cc.lineWidth = 3; cc.beginPath(); cc.moveTo(50 + s * 18, 94); cc.quadraticCurveTo(50 + s * 26, 82, 50 + s * 22, 74); cc.stroke(); cc.strokeStyle = 'rgba(70,80,96,.6)'; cc.setLineDash([0.6, 1.2]); cc.stroke(); cc.setLineDash([]); });
  } });
  /* the shell, with a window cut for the visor */
  c.save(); c.beginPath(); c.rect(0, 0, 100, 100); c.ellipse(50, 47, 23, 19, 0, 0, 6.2832); c.clip('evenodd');
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 52, 47, 34, 33); c.fill();
  var sh = c.createRadialGradient(38, 28, 2, 50, 45, 34); sh.addColorStop(0, '#ffffff'); sh.addColorStop(0.55, '#e2e7ef'); sh.addColorStop(0.86, '#a7b1c1'); sh.addColorStop(1, '#6c768a');
  c.fillStyle = sh; ptEll(c, 50, 45, 33, 32); c.fill();
  c.strokeStyle = '#4a5468'; c.lineWidth = 0.8; c.stroke();
  c.restore();
  /* the visor glass over his face */
  var gl = c.createRadialGradient(46, 44, 2, 50, 47, 24); gl.addColorStop(0, 'rgba(190,225,255,.06)'); gl.addColorStop(0.7, 'rgba(150,200,255,.14)'); gl.addColorStop(1, 'rgba(40,64,110,.4)');
  c.fillStyle = gl; ptEll(c, 50, 47, 23, 19); c.fill();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(31, 42); c.quadraticCurveTo(33, 31, 45, 29); c.quadraticCurveTo(36, 33, 34, 44); c.closePath(); c.fill();
  c.strokeStyle = '#3e4757'; c.lineWidth = 2.2; ptEll(c, 50, 47, 23.6, 19.6); c.stroke();
  c.strokeStyle = 'rgba(220,180,90,.75)'; c.lineWidth = 0.5; ptEll(c, 50, 47, 22.8, 18.8); c.stroke();
  /* the neck ring */
  c.strokeStyle = '#98a2b4'; c.lineWidth = 3; c.beginPath(); c.moveTo(22, 72); c.quadraticCurveTo(50, 84, 78, 72); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(23, 71); c.quadraticCurveTo(50, 82.6, 77, 71); c.stroke();
  /* the aerial and its light */
  c.strokeStyle = '#3a4252'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(72, 20); c.quadraticCurveTo(74, 10, 80, 3); c.stroke();
  var bgl = c.createRadialGradient(80, 3, 0.2, 80, 3, 6); bgl.addColorStop(0, 'rgba(255,90,70,.8)'); bgl.addColorStop(1, 'rgba(255,90,70,0)');
  c.fillStyle = bgl; ptEll(c, 80, 3, 6, 6); c.fill();
  c.fillStyle = '#ff4a3a'; ptEll(c, 80, 3, 2.2, 2.2); c.fill();
  c.fillStyle = '#5e6878'; ptEll(c, 72, 20.6, 2.6, 1.6); c.fill();
};

/* the otter lifeguard: wet, in a red suit with a white cross, black
   sunglasses, a whistle on a red cord and cream on her nose */
PORTRAIT_ALT.lifeguard = function (c, S) {
  PORTRAIT.otter(c, S);
  /* her red suit over her front, up to straps at her neck */
  c.save(); ptClip(c);
  var sg = c.createLinearGradient(30, 70, 70, 100); sg.addColorStop(0, '#d42a32'); sg.addColorStop(1, '#6e0a12');
  c.fillStyle = sg; c.beginPath(); c.moveTo(22, 100); c.quadraticCurveTo(26, 80, 34, 74); c.lineTo(40, 76); c.quadraticCurveTo(50, 82, 60, 76); c.lineTo(66, 74); c.quadraticCurveTo(74, 80, 78, 100); c.closePath(); c.fill();
  c.fillStyle = '#fbfaf6'; c.fillRect(46.4, 84, 7.2, 14); c.fillRect(43, 87.4, 14, 7.2);
  c.restore();
  /* the whistle on its cord */
  c.strokeStyle = '#d62a2a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(36, 72); c.quadraticCurveTo(38, 80, 42, 82); c.stroke();
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 43, 84.4, 2.4, 1.8); c.fill();
  var wg = c.createLinearGradient(40, 81, 45, 85); wg.addColorStop(0, '#ffffff'); wg.addColorStop(1, '#8a92a0');
  c.fillStyle = wg; ptEll(c, 42.4, 83, 2.6, 1.8, 0.3); c.fill();
  /* sun cream on her nose */
  c.fillStyle = 'rgba(255,255,255,.95)'; ptEll(c, 50, 53, 3.6, 1.6); c.fill();
  /* the sunglasses: thick black frames, the tops swept up at the corners */
  var lens = function (s, grow) { var ox = 50 + s * 11, oy = 43, g2 = grow || 0;
    c.beginPath(); c.moveTo(ox - s * (7 + g2), oy - 4.6 - g2); c.lineTo(ox + s * (8.4 + g2), oy - 6 - g2);
    c.quadraticCurveTo(ox + s * (8.8 + g2), oy + 2, ox + s * (5 + g2), oy + 5 + g2); c.quadraticCurveTo(ox, oy + 6.4 + g2, ox - s * (6 + g2), oy + 3.6 + g2);
    c.quadraticCurveTo(ox - s * (7.4 + g2), oy - 1, ox - s * (7 + g2), oy - 4.6 - g2); c.closePath(); };
  [-1, 1].forEach(function (s) { c.fillStyle = 'rgba(15,22,40,.3)'; c.save(); c.translate(1, 1.4); lens(s, 1.3); c.restore(); c.fill(); });
  [-1, 1].forEach(function (s) {
    c.fillStyle = '#17181d'; lens(s, 1.3); c.fill();
    var lg = c.createLinearGradient(50 + s * 11 - 6, 38, 50 + s * 11 + 6, 48); lg.addColorStop(0, '#4e6458'); lg.addColorStop(0.5, '#1c2620'); lg.addColorStop(1, '#070a08');
    c.fillStyle = lg; lens(s, 0); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(50 + s * 11 - 4.6, 40); c.lineTo(50 + s * 11 - 1, 38.6); c.lineTo(50 + s * 11 - 4.2, 46); c.lineTo(50 + s * 11 - 5.8, 44.6); c.closePath(); c.fill();
  });
  c.strokeStyle = '#17181d'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(44, 40.4); c.quadraticCurveTo(50, 38.4, 56, 40.4); c.stroke();
  /* water beads on her fur */
  [[30, 36, 1.4], [68, 32, 1.1], [62, 64, 1], [34, 66, 1.2], [56, 26, 1]].forEach(function (d) {
    c.fillStyle = 'rgba(25,32,48,.22)'; ptEll(c, d[0] + 0.5, d[1] + 0.7, d[2], d[2]); c.fill();
    var dg = c.createRadialGradient(d[0] - d[2] * 0.35, d[1] - d[2] * 0.35, 0.1, d[0], d[1], d[2]); dg.addColorStop(0, 'rgba(255,255,255,.7)'); dg.addColorStop(1, 'rgba(50,90,140,.5)');
    c.fillStyle = dg; ptEll(c, d[0], d[1], d[2], d[2]); c.fill();
  });
};

/* the magician's rabbit: white, her ear tips grey, a black cape with a
   high collar lined in red, and playing cards and sparkles about her */
PORTRAIT_ALT.magic = function (c, S) {
  var M = ptWith(S, { body: ['#ffffff', '#e6e8ee', '#b2b7c4'], flipper: ['#fbfbfd', '#e2e5ec', '#aeb3c0'], mark: '#ffffff' });
  PORTRAIT.hare(c, M, { earTip: '#b4bbc8' });
  c.save(); ptClip(c);
  [-1, 1].forEach(function (s) {
    var col = function () { c.beginPath(); c.moveTo(50 + s * 10, 74); c.quadraticCurveTo(50 + s * 26, 56, 50 + s * 34, 58); c.quadraticCurveTo(50 + s * 42, 80, 50 + s * 46, 100); c.lineTo(50 + s * 14, 100); c.closePath(); };
    c.fillStyle = '#a3172b'; col(); c.fill();
    var cg = c.createLinearGradient(50 + s * 14, 70, 50 + s * 40, 100); cg.addColorStop(0, '#3c3e4a'); cg.addColorStop(1, '#0a0a0e');
    c.fillStyle = cg; c.beginPath(); c.moveTo(50 + s * 13, 76); c.quadraticCurveTo(50 + s * 30, 66, 50 + s * 36, 70); c.quadraticCurveTo(50 + s * 42, 84, 50 + s * 46, 100); c.lineTo(50 + s * 16, 100); c.closePath(); c.fill();
    c.strokeStyle = '#d8b04a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(50 + s * 10.4, 74.4); c.quadraticCurveTo(50 + s * 26, 56.4, 50 + s * 33.6, 58.4); c.stroke();
  });
  c.restore();
  /* the cards */
  [[16, 40, -0.4, 1], [84, 36, 0.35, 0], [80, 70, 0.6, 1]].forEach(function (cd) {
    c.save(); c.translate(cd[0], cd[1]); c.rotate(cd[2]);
    c.fillStyle = 'rgba(15,22,40,.3)'; c.fillRect(-3.6 + 1, -5 + 1.4, 7.2, 10);
    c.fillStyle = '#fbfbf6'; c.fillRect(-3.6, -5, 7.2, 10);
    c.strokeStyle = 'rgba(200,40,50,.5)'; c.lineWidth = 0.4; c.strokeRect(-3, -4.4, 6, 8.8);
    c.fillStyle = cd[3] ? '#d6202a' : '#16181e';
    c.beginPath(); c.moveTo(0, 2.2); c.quadraticCurveTo(-2.8, -0.2, -1.4, -1.8); c.quadraticCurveTo(-0.4, -2.4, 0, -1.1); c.quadraticCurveTo(0.4, -2.4, 1.4, -1.8); c.quadraticCurveTo(2.8, -0.2, 0, 2.2); c.fill();
    c.restore();
  });
  ptSparkle(c, 24, 18, 3, '#fff2b0'); ptSparkle(c, 76, 14, 2.2, '#ffffff'); ptSparkle(c, 88, 54, 1.8, '#fff2b0');
};

/* the ninja: a darker coat, a black mask across her eyes knotted at the
   side, its tails hanging, two sword hilts over her shoulders */
PORTRAIT_ALT.ninja = function (c, S) {
  var N = ptWith(S, { body: ['#7a7f8c', '#4c505c', '#262932'], flipper: ['#6f7480', '#454954', '#23262e'] });
  /* the hilts behind her, over each shoulder */
  [-1, 1].forEach(function (s) {
    c.save(); c.translate(50 + s * 30, 70); c.rotate(s * 0.45);
    c.fillStyle = 'rgba(15,22,40,.3)'; c.fillRect(-1.6 + 1, -26 + 1.4, 3.2, 22);
    c.fillStyle = '#e8e2d0'; c.fillRect(-1.7, -26, 3.4, 20);
    c.strokeStyle = '#1a1c22'; c.lineWidth = 0.6; c.beginPath(); for (var q = 0; q < 6; q++) { c.moveTo(-1.7, -24 + q * 3); c.lineTo(1.7, -22.4 + q * 3); c.moveTo(1.7, -24 + q * 3); c.lineTo(-1.7, -22.4 + q * 3); } c.stroke();
    c.fillStyle = '#d8b04a'; ptEll(c, 0, -5, 4.6, 1.6); c.fill();
    c.fillStyle = '#c9a040'; ptEll(c, 0, -27, 2, 1.6); c.fill();
    c.restore();
  });
  PORTRAIT.leopard(c, N);
  /* the mask across her eyes, curving with her head */
  var m = function (dx, dy) { c.beginPath(); c.moveTo(23 + dx, 40 + dy); c.quadraticCurveTo(50 + dx, 30 + dy, 77 + dx, 40 + dy); c.quadraticCurveTo(78.6 + dx, 46 + dy, 76.6 + dx, 51 + dy); c.quadraticCurveTo(50 + dx, 44 + dy, 23.4 + dx, 51 + dy); c.quadraticCurveTo(21.4 + dx, 46 + dy, 23 + dx, 40 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.35)'; m(1.2, 1.6); c.fill();
  var mg = c.createLinearGradient(20, 34, 80, 50); mg.addColorStop(0, '#41454f'); mg.addColorStop(0.5, '#1f2128'); mg.addColorStop(1, '#0a0b0e');
  c.fillStyle = mg; m(0, 0); c.fill();
  c.strokeStyle = 'rgba(150,160,185,.22)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(24, 41); c.quadraticCurveTo(50, 31.6, 76, 41); c.stroke();
  /* her eyes through the slits */
  [-1, 1].forEach(function (s) {
    var ex = 50 + s * 10.6, ey = 44;
    c.fillStyle = '#050608'; ptEll(c, ex, ey, 5.6, 3.4); c.fill();
    c.fillStyle = '#d8e6f0'; ptEll(c, ex, ey + 0.3, 4.6, 2.6); c.fill();
    c.fillStyle = '#7e9a86'; ptEll(c, ex - s * 0.4, ey + 0.3, 2.2, 2.2); c.fill();
    c.fillStyle = '#0b0d12'; ptEll(c, ex - s * 0.4, ey + 0.3, 1.2, 1.2); c.fill();
    c.fillStyle = '#ffffff'; ptEll(c, ex - s * 0.4 - 0.8, ey - 0.5, 0.6, 0.6); c.fill();
  });
  /* the knot at the side of her head, and its tails */
  c.fillStyle = '#1a1c22'; ptEll(c, 77, 47, 3.4, 3); c.fill();
  [0, 1].forEach(function (i) { c.fillStyle = i ? '#24272f' : '#1a1c22'; c.beginPath(); c.moveTo(77, 48); c.quadraticCurveTo(84 + i * 3, 56, 82 + i * 6, 66 + i * 2); c.lineTo(85 + i * 6, 65 + i * 2); c.quadraticCurveTo(87 + i * 3, 55, 79, 46); c.closePath(); c.fill(); });
};

/* Compass the sea captain: a captain's cap, white over navy with the gold
   anchor, a navy coat with gold epaulettes, and his pipe alight */
PORTRAIT_ALT.captain = function (c, S) {
  PORTRAIT.compass(c, S, { noCompass: true, chest: function (cc) {
    var jg = cc.createLinearGradient(20, 70, 80, 100); jg.addColorStop(0, '#3e5c92'); jg.addColorStop(1, '#0b1630');
    cc.fillStyle = jg; cc.beginPath(); cc.moveTo(12, 100); cc.quadraticCurveTo(16, 74, 36, 70); cc.lineTo(50, 92); cc.lineTo(64, 70); cc.quadraticCurveTo(84, 74, 88, 100); cc.closePath(); cc.fill();
    cc.strokeStyle = '#e0b440'; cc.lineWidth = 0.9; cc.beginPath(); cc.moveTo(36, 70); cc.lineTo(50, 92); cc.lineTo(64, 70); cc.stroke();
    cc.fillStyle = '#f0c858'; [[44, 90], [56, 90], [42, 98], [58, 98]].forEach(function (d) { ptEll(cc, d[0], d[1], 1.3, 1.3); cc.fill(); });
    [-1, 1].forEach(function (s) {
      for (var q = 0; q < 8; q++) { var a = -0.9 + q * 0.26; cc.strokeStyle = q % 2 ? '#f0c43c' : '#c9962a'; cc.lineWidth = 0.8; cc.beginPath(); cc.moveTo(50 + s * (25 + Math.cos(a) * 6), 78 + Math.sin(a) * 2.6); cc.lineTo(50 + s * (25 + Math.cos(a) * 10.4), 80 + Math.sin(a) * 4); cc.stroke(); }
      var eg = cc.createRadialGradient(50 + s * 25 - 1.2, 76, 0.3, 50 + s * 25, 77, 6.4); eg.addColorStop(0, '#fff2b0'); eg.addColorStop(0.6, '#e0b440'); eg.addColorStop(1, '#9a6a10');
      cc.fillStyle = eg; ptEll(cc, 50 + s * 25, 77, 6.4, 3.6, s * 0.15); cc.fill();
    });
  } });
  /* the pipe, out of the side of his beak, a red fire in it and smoke */
  for (var k = 4; k >= 0; k--) { var p = k / 5, px = 74 + p * 8 + Math.sin(k * 1.7) * 2, py = 50 - p * 30, r = 2 + p * 4.6; c.fillStyle = 'rgba(206,212,222,' + (0.7 * (1 - p)).toFixed(3) + ')'; ptEll(c, px, py, r, r); c.fill(); }
  c.strokeStyle = '#5a3418'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(54, 58); c.quadraticCurveTo(64, 62, 70, 58); c.stroke();
  var pg = c.createLinearGradient(68, 50, 76, 60); pg.addColorStop(0, '#b07a40'); pg.addColorStop(1, '#4a2810');
  c.fillStyle = pg; c.beginPath(); c.moveTo(68, 52); c.lineTo(76, 52); c.lineTo(75, 60); c.quadraticCurveTo(72, 62, 69, 60); c.closePath(); c.fill();
  var gl = c.createRadialGradient(72, 51, 0.3, 72, 51, 6); gl.addColorStop(0, 'rgba(255,90,30,.6)'); gl.addColorStop(1, 'rgba(255,60,20,0)');
  c.fillStyle = gl; ptEll(c, 72, 51, 6, 6); c.fill();
  c.fillStyle = '#ff6a1c'; ptEll(c, 72, 52, 3.6, 1.2); c.fill();
  c.fillStyle = '#e8261c'; c.beginPath(); c.moveTo(70, 52); c.quadraticCurveTo(71, 47, 72.6, 45); c.quadraticCurveTo(73, 48, 74.4, 52); c.closePath(); c.fill();
  c.fillStyle = '#ffe27a'; c.beginPath(); c.moveTo(71.4, 52); c.quadraticCurveTo(72, 49, 72.8, 48); c.quadraticCurveTo(73, 50, 73.4, 52); c.closePath(); c.fill();
  /* the cap: the white crown puffed over the band, the gold cord and the
   anchor, the black peak over his brow */
  c.fillStyle = 'rgba(15,22,40,.35)'; c.beginPath(); c.moveTo(18, 30); c.bezierCurveTo(14, 18, 30, 8, 50, 8); c.bezierCurveTo(70, 8, 86, 18, 82, 30); c.closePath(); c.fill();
  var wtg = c.createRadialGradient(36, 12, 1, 50, 20, 34); wtg.addColorStop(0, '#ffffff'); wtg.addColorStop(0.65, '#e6eaf1'); wtg.addColorStop(1, '#a9b2c2');
  c.fillStyle = wtg; c.beginPath(); c.moveTo(17, 28); c.bezierCurveTo(12, 16, 30, 6, 50, 6); c.bezierCurveTo(70, 6, 88, 16, 83, 28); c.quadraticCurveTo(50, 22, 17, 28); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(100,110,130,.55)'; c.lineWidth = 0.6; c.stroke();
  var bdg = c.createLinearGradient(20, 0, 80, 0); bdg.addColorStop(0, '#3a5686'); bdg.addColorStop(0.5, '#1c3054'); bdg.addColorStop(1, '#0c1830');
  c.fillStyle = bdg; c.beginPath(); c.moveTo(22, 27); c.quadraticCurveTo(50, 21, 78, 27); c.lineTo(78, 34); c.quadraticCurveTo(50, 28, 22, 34); c.closePath(); c.fill();
  c.fillStyle = 'rgba(15,22,40,.35)'; c.beginPath(); c.moveTo(24, 34); c.quadraticCurveTo(50, 28, 76, 34); c.quadraticCurveTo(64, 44, 50, 44); c.quadraticCurveTo(36, 44, 24, 34); c.closePath(); c.fill();
  var pkg = c.createLinearGradient(0, 30, 0, 42); pkg.addColorStop(0, '#4a4f5c'); pkg.addColorStop(1, '#07080b');
  c.fillStyle = pkg; c.beginPath(); c.moveTo(24, 33); c.quadraticCurveTo(50, 27, 76, 33); c.quadraticCurveTo(64, 41, 50, 41); c.quadraticCurveTo(36, 41, 24, 33); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.4)'; ptEll(c, 42, 34.6, 6, 1, -0.05); c.fill();
  c.strokeStyle = '#e0b440'; c.lineWidth = 1; c.beginPath(); c.moveTo(24, 32.4); c.quadraticCurveTo(50, 26.4, 76, 32.4); c.stroke();
  c.fillStyle = '#e0b440'; ptEll(c, 50, 25, 4, 3.4); c.fill();
  c.fillStyle = '#1c3054'; ptEll(c, 50, 25, 3, 2.5); c.fill();
  c.strokeStyle = '#f6d260'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(50, 23.2); c.lineTo(50, 26.8); c.moveTo(48.8, 24); c.lineTo(51.2, 24); c.stroke();
  c.beginPath(); c.arc(50, 25.2, 1.5, 0.3, Math.PI - 0.3); c.stroke();
};

/* the owl wizard: a tall purple hat, its point bent over, a gold band, a
   star and a moon on it, and sparkles */
PORTRAIT_ALT.wizard = function (c, S) {
  PORTRAIT.owl(c, S);
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 51.6, 30, 34, 7); c.fill();
  var brg = c.createLinearGradient(0, 22, 0, 34); brg.addColorStop(0, '#6a3aa8'); brg.addColorStop(1, '#2a1250');
  c.fillStyle = brg; ptEll(c, 50, 28, 34, 6.4); c.fill();
  c.strokeStyle = 'rgba(200,160,255,.4)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(50, 28, 33.4, 5.8, 0, 3.3, 6.1); c.stroke();
  var cone = function (dx, dy) { c.beginPath(); c.moveTo(30 + dx, 27 + dy); c.bezierCurveTo(36 + dx, 12 + dy, 44 + dx, 0 + dy, 56 + dx, -6 + dy); c.quadraticCurveTo(72 + dx, -8 + dy, 80 + dx, 4 + dy); c.quadraticCurveTo(70 + dx, -2 + dy, 62 + dx, 4 + dy); c.quadraticCurveTo(64 + dx, 16 + dy, 70 + dx, 27 + dy); c.quadraticCurveTo(50 + dx, 31 + dy, 30 + dx, 27 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.3)'; cone(1.4, 1.8); c.fill();
  var cg = c.createLinearGradient(30, 0, 70, 28); cg.addColorStop(0, '#8a52c8'); cg.addColorStop(0.6, '#5a2a98'); cg.addColorStop(1, '#2e1258');
  c.fillStyle = cg; cone(0, 0); c.fill();
  c.strokeStyle = 'rgba(30,10,60,.4)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(42, 18); c.quadraticCurveTo(50, 20, 58, 17); c.moveTo(46, 10); c.quadraticCurveTo(52, 12, 58, 9); c.stroke();
  c.fillStyle = '#e0b440'; c.beginPath(); c.moveTo(31, 24); c.quadraticCurveTo(50, 28, 69, 24); c.lineTo(70, 27.4); c.quadraticCurveTo(50, 31.4, 30, 27.4); c.closePath(); c.fill();
  ptStar(c, 47, 14, 3.4, '#ffe066');
  c.fillStyle = '#fff2b0'; c.beginPath(); c.arc(58, 20, 3, 0.7, 5.6); c.arc(59.6, 19.2, 2.4, 5.2, 1.1, true); c.closePath(); c.fill();
  ptStar(c, 80, 4, 2, '#ffe066');
  ptSparkle(c, 16, 24, 2.6, '#e8d8ff'); ptSparkle(c, 86, 40, 2, '#fff2b0'); ptSparkle(c, 20, 62, 1.6, '#e8d8ff'); ptSparkle(c, 84, 66, 1.8, '#fff2b0');
};

/* the walrus gentleman: a black top hat with a grey band, a monocle on a
   gold chain, and his moustache waxed into curls */
PORTRAIT_ALT.gent = function (c, S) {
  PORTRAIT.walrus(c, S);
  /* the curls at the ends of his moustache */
  [-1, 1].forEach(function (s) { c.strokeStyle = ptLit(S.mark, -0.35); c.lineWidth = 1.6; c.beginPath(); c.moveTo(50 + s * 16, 56); c.quadraticCurveTo(50 + s * 23, 56, 50 + s * 22, 50); c.quadraticCurveTo(50 + s * 20, 48, 50 + s * 19, 51); c.stroke(); });
  /* the monocle over his right eye, its chain looping down */
  c.strokeStyle = '#d8b04a'; c.lineWidth = 0.6; c.setLineDash([0.8, 0.6]); c.beginPath(); c.moveTo(69, 40); c.quadraticCurveTo(80, 60, 72, 78); c.stroke(); c.setLineDash([]);
  c.fillStyle = 'rgba(200,225,255,.25)'; ptEll(c, 63, 38, 6.4, 6.4); c.fill();
  c.strokeStyle = '#d8b04a'; c.lineWidth = 1.3; ptEll(c, 63, 38, 6.4, 6.4); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.5)'; ptEll(c, 60.6, 35.6, 2, 1, -0.6); c.fill();
  /* the hat */
  c.fillStyle = 'rgba(15,22,40,.35)'; ptEll(c, 51.6, 24, 26, 5.6); c.fill();
  var brg = c.createLinearGradient(0, 18, 0, 28); brg.addColorStop(0, '#3a3d48'); brg.addColorStop(1, '#0c0d12');
  c.fillStyle = brg; ptEll(c, 50, 22, 26, 5); c.fill();
  var cyl = c.createLinearGradient(32, 0, 68, 0); cyl.addColorStop(0, '#4a4e5c'); cyl.addColorStop(0.3, '#25272f'); cyl.addColorStop(1, '#08080b');
  c.fillStyle = cyl; c.beginPath(); c.moveTo(33, 21); c.lineTo(35, -4); c.quadraticCurveTo(50, -8, 65, -4); c.lineTo(67, 21); c.quadraticCurveTo(50, 25, 33, 21); c.closePath(); c.fill();
  c.fillStyle = '#8a8f9c'; c.beginPath(); c.moveTo(33.4, 15); c.quadraticCurveTo(50, 19, 66.6, 15); c.lineTo(67, 21); c.quadraticCurveTo(50, 25, 33, 21); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(39, -2); c.lineTo(38, 18); c.stroke();
};

/* the narwhal unicorn: lilac, her tooth a rainbow spiral, sparkles */
PORTRAIT_ALT.unicorn = function (c, S) {
  var U = ptWith(S, { body: ['#d6a8e6', '#a874c4', '#6a3f8a'], flipper: ['#a8c8f0', '#6c92cc', '#3e5a8c'] });
  PORTRAIT.narwhal(c, U, { mottle: 'rgba(120,70,150,.25)', mark: '#f4e6fa', tusk: true });
  ptSparkle(c, 22, 30, 2.8, '#ffffff'); ptSparkle(c, 80, 24, 2.2, '#fff2b0'); ptSparkle(c, 76, 62, 1.8, '#ffffff'); ptStar(c, 86, 46, 2, '#ffe066');
};

/* the reindeer of Father Christmas: a red hat with white fur between his
   antlers, his red nose glowing, and coloured lights round his neck */
PORTRAIT_ALT.santa = function (c, S) {
  PORTRAIT.reindeer(c, S, { chest: function (cc) {
    cc.strokeStyle = '#2a4a2a'; cc.lineWidth = 0.8; cc.beginPath(); cc.moveTo(22, 76); cc.quadraticCurveTo(50, 90, 78, 76); cc.stroke();
    var LC = ['#ff4a4a', '#ffd23a', '#3ad66a', '#4aa8ff', '#ff7ad8'];
    for (var q = 0; q < 9; q++) {
      var t = (q + 0.5) / 9, x = 22 + t * 56, y = 76 + Math.sin(t * Math.PI) * 7;
      var lg = cc.createRadialGradient(x, y + 1.6, 0.2, x, y + 1.6, 4); lg.addColorStop(0, LC[q % 5]); lg.addColorStop(1, 'rgba(255,255,255,0)');
      cc.fillStyle = lg; ptEll(cc, x, y + 1.6, 4, 4); cc.fill();
      cc.fillStyle = LC[q % 5]; ptEll(cc, x, y + 1.8, 1.4, 2); cc.fill();
    }
  }, nose: function (cc) {
    var gl = cc.createRadialGradient(50, 64, 0.5, 50, 64, 10); gl.addColorStop(0, 'rgba(255,80,60,.7)'); gl.addColorStop(1, 'rgba(255,60,40,0)');
    cc.fillStyle = gl; ptEll(cc, 50, 64, 10, 10); cc.fill();
    var ng = cc.createRadialGradient(48.4, 62.4, 0.4, 50, 64, 5); ng.addColorStop(0, '#ff9a8a'); ng.addColorStop(0.6, '#e2262a'); ng.addColorStop(1, '#8a0e14');
    cc.fillStyle = ng; ptEll(cc, 50, 64, 5, 4.4); cc.fill();
    cc.fillStyle = 'rgba(255,255,255,.7)'; ptEll(cc, 48.4, 62.2, 1.4, 0.8, -0.5); cc.fill();
  } });
  /* the hat, its tip with the pompom falling to his left */
  var hat = function (dx, dy) { c.beginPath(); c.moveTo(32 + dx, 32 + dy); c.bezierCurveTo(32 + dx, 14 + dy, 50 + dx, 6 + dy, 66 + dx, 12 + dy); c.quadraticCurveTo(76 + dx, 18 + dy, 78 + dx, 32 + dy); c.quadraticCurveTo(72 + dx, 22 + dy, 68 + dx, 22 + dy); c.quadraticCurveTo(68 + dx, 28 + dy, 68 + dx, 32 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.3)'; hat(1.4, 1.8); c.fill();
  var hg = c.createLinearGradient(32, 8, 70, 32); hg.addColorStop(0, '#ff4a4a'); hg.addColorStop(1, '#8a0e14');
  c.fillStyle = hg; hat(0, 0); c.fill();
  c.fillStyle = 'rgba(15,22,40,.3)'; c.beginPath(); c.moveTo(29, 33); c.quadraticCurveTo(50, 26, 71, 33); c.lineTo(71, 38.6); c.quadraticCurveTo(50, 31.6, 29, 38.6); c.closePath(); c.fill();
  var fg = c.createLinearGradient(0, 28, 0, 38); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#cfd6e0');
  c.fillStyle = fg; c.beginPath(); c.moveTo(28, 31.6); c.quadraticCurveTo(50, 24.6, 72, 31.6); c.lineTo(72, 37); c.quadraticCurveTo(50, 30, 28, 37); c.closePath(); c.fill();
  c.fillStyle = 'rgba(15,22,40,.3)'; ptEll(c, 79.4, 34.4, 4.6, 4.6); c.fill();
  var pp = c.createRadialGradient(77, 31.6, 0.4, 78, 33, 4.6); pp.addColorStop(0, '#ffffff'); pp.addColorStop(1, '#cfd6e0');
  c.fillStyle = pp; ptEll(c, 78, 33, 4.4, 4.4); c.fill();
};

/* the emperor king: a gold crown set with jewels, and a red velvet robe
   with an ermine collar */
PORTRAIT_ALT.king = function (c, S) {
  PORTRAIT.emperor(c, S, { noBlaze: true, chest: function (cc) {
    var rg = cc.createLinearGradient(20, 72, 80, 100); rg.addColorStop(0, '#d8303a'); rg.addColorStop(1, '#5a0e14');
    cc.fillStyle = rg; cc.beginPath(); cc.moveTo(6, 100); cc.quadraticCurveTo(14, 76, 34, 72); cc.lineTo(44, 100); cc.closePath(); cc.fill();
    cc.beginPath(); cc.moveTo(94, 100); cc.quadraticCurveTo(86, 76, 66, 72); cc.lineTo(56, 100); cc.closePath(); cc.fill();
    var eg = cc.createLinearGradient(0, 66, 0, 80); eg.addColorStop(0, '#ffffff'); eg.addColorStop(1, '#d6dbe4');
    cc.fillStyle = eg; cc.beginPath(); cc.moveTo(16, 80); cc.quadraticCurveTo(50, 62, 84, 80); cc.quadraticCurveTo(80, 86, 74, 84); cc.quadraticCurveTo(50, 72, 26, 84); cc.quadraticCurveTo(20, 86, 16, 80); cc.closePath(); cc.fill();
    cc.fillStyle = '#16181e'; [[24, 80], [34, 75], [46, 72.6], [58, 73], [70, 76], [79, 80]].forEach(function (d) { cc.beginPath(); cc.moveTo(d[0], d[1] - 1.4); cc.quadraticCurveTo(d[0] + 0.9, d[1] + 0.6, d[0], d[1] + 2); cc.quadraticCurveTo(d[0] - 0.9, d[1] + 0.6, d[0], d[1] - 1.4); cc.fill(); });
  } });
  /* the crown */
  var cr = function (dx, dy) { c.beginPath(); c.moveTo(28 + dx, 26 + dy); c.lineTo(26 + dx, 6 + dy); c.lineTo(36 + dx, 15 + dy); c.lineTo(43 + dx, 2 + dy); c.lineTo(50 + dx, 13 + dy); c.lineTo(57 + dx, 2 + dy); c.lineTo(64 + dx, 15 + dy); c.lineTo(74 + dx, 6 + dy); c.lineTo(72 + dx, 26 + dy); c.quadraticCurveTo(50 + dx, 31 + dy, 28 + dx, 26 + dy); c.closePath(); };
  c.fillStyle = 'rgba(15,22,40,.35)'; cr(1.6, 2); c.fill();
  var cg = c.createLinearGradient(26, 2, 74, 30); cg.addColorStop(0, '#fff2b0'); cg.addColorStop(0.45, '#e8b838'); cg.addColorStop(1, '#8a5a10');
  c.fillStyle = cg; cr(0, 0); c.fill();
  c.strokeStyle = 'rgba(90,60,10,.6)'; c.lineWidth = 0.6; cr(0, 0); c.stroke();
  c.fillStyle = '#8a5a10'; c.beginPath(); c.moveTo(28, 21); c.quadraticCurveTo(50, 25, 72, 21); c.lineTo(72, 26); c.quadraticCurveTo(50, 31, 28, 26); c.closePath(); c.fill();
  [[36, 24.2, '#d8263a'], [50, 26, '#2f7fe0'], [64, 24.2, '#2fbf6e']].forEach(function (j) { c.fillStyle = j[2]; ptEll(c, j[0], j[1], 2.4, 1.9); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; ptEll(c, j[0] - 0.7, j[1] - 0.6, 0.7, 0.5); c.fill(); });
  c.fillStyle = '#ffffff'; [[26, 6], [43, 2], [57, 2], [74, 6]].forEach(function (d) { ptEll(c, d[0], d[1], 1.6, 1.6); c.fill(); });
  c.fillStyle = 'rgba(255,255,255,.5)'; ptEll(c, 34, 12, 2, 4, 0.4); c.fill();
};

/* the robot orca: steel plates with rivets on the seams, a dark visor
   across her eyes with a red light in it, and an aerial */
PORTRAIT_ALT.robot = function (c, S) {
  var R = ptWith(S, { body: ['#b4c0ce', '#6c7a8c', '#2c3440'], flipper: ['#8a98aa', '#526072', '#262e3a'], mark: '#8a98aa' });
  PORTRAIT.orca(c, R, { noEyes: true, mark: R.mark });
  /* a vent grille on her chest plate, and its rivets */
  c.fillStyle = 'rgba(20,28,40,.6)'; [82, 86, 90, 94].forEach(function (y) { c.beginPath(); c.moveTo(40, y); c.lineTo(60, y); c.lineTo(60, y + 1.8); c.lineTo(40, y + 1.8); c.closePath(); c.fill(); });
  c.fillStyle = 'rgba(255,255,255,.3)'; [82, 86, 90, 94].forEach(function (y) { c.fillRect(40, y + 1.8, 20, 0.5); });
  c.fillStyle = '#d8dde4'; [[36, 80], [64, 80], [36, 97], [64, 97]].forEach(function (d) { ptEll(c, d[0], d[1], 0.9, 0.9); c.fill(); });
  /* the seams of her plates, bowed round her head, riveted */
  c.strokeStyle = 'rgba(20,28,40,.55)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(26, 34); c.quadraticCurveTo(50, 22, 74, 34); c.moveTo(24, 54); c.quadraticCurveTo(50, 62, 76, 54); c.moveTo(50, 20); c.lineTo(50, 34); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(26, 33.2); c.quadraticCurveTo(50, 21.2, 74, 33.2); c.stroke();
  c.fillStyle = '#d8dde4'; [[30, 31.6], [40, 27.6], [60, 27.6], [70, 31.6], [30, 56.4], [40, 59], [60, 59], [70, 56.4]].forEach(function (d) { ptEll(c, d[0], d[1], 0.9, 0.9); c.fill(); });
  /* the visor */
  c.fillStyle = 'rgba(15,22,40,.4)'; c.beginPath(); c.moveTo(25, 40); c.quadraticCurveTo(50, 34, 75, 40); c.lineTo(75, 50); c.quadraticCurveTo(50, 44, 25, 50); c.closePath(); c.fill();
  var vg = c.createLinearGradient(0, 37, 0, 49); vg.addColorStop(0, '#2c3440'); vg.addColorStop(1, '#0a0d12');
  c.fillStyle = vg; c.beginPath(); c.moveTo(24, 38.6); c.quadraticCurveTo(50, 32.6, 76, 38.6); c.lineTo(76, 48.4); c.quadraticCurveTo(50, 42.4, 24, 48.4); c.closePath(); c.fill();
  var rl = c.createRadialGradient(56, 41, 0.3, 56, 41, 9); rl.addColorStop(0, 'rgba(255,80,60,.95)'); rl.addColorStop(0.4, 'rgba(255,40,30,.5)'); rl.addColorStop(1, 'rgba(255,40,30,0)');
  c.fillStyle = rl; ptEll(c, 56, 41.4, 9, 3.6); c.fill();
  c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.moveTo(28, 39); c.quadraticCurveTo(50, 33.6, 72, 39); c.lineTo(72, 40); c.quadraticCurveTo(50, 34.6, 28, 40); c.closePath(); c.fill();
  /* the aerial */
  c.strokeStyle = '#3a4252'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(50, 20); c.lineTo(50, 6); c.stroke();
  var ag = c.createRadialGradient(50, 5, 0.3, 50, 5, 5); ag.addColorStop(0, 'rgba(255,90,70,.8)'); ag.addColorStop(1, 'rgba(255,90,70,0)');
  c.fillStyle = ag; ptEll(c, 50, 5, 5, 5); c.fill();
  c.fillStyle = '#ff4a3a'; ptEll(c, 50, 5, 2, 2); c.fill();
  c.fillStyle = '#5e6878'; ptEll(c, 50, 20.6, 3, 1.4); c.fill();
};

/* Aurora's galaxy: night-blue, a spiral galaxy turning on her front, stars
   on her, a crown of gold and white stars, and the night behind her */
PORTRAIT_ALT.galaxy = function (c, S) {
  var G = ptWith(S, { body: ['#4a3a9a', '#24186a', '#0c0830'], flipper: ['#5a40b0', '#2c1c78', '#100a38'] });
  c.save(); ptClip(c);
  var sky = c.createRadialGradient(40, 30, 4, 50, 50, 64); sky.addColorStop(0, '#3a2a7a'); sky.addColorStop(1, '#0a0620');
  c.fillStyle = sky; c.fillRect(0, 0, 100, 100);
  c.fillStyle = '#ffffff'; [[14, 30, 0.8], [24, 14, 0.6], [84, 20, 0.9], [90, 50, 0.6], [10, 60, 0.7], [76, 8, 0.5], [30, 6, 0.5]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2]); c.fill(); });
  c.restore();
  PORTRAIT.aurora(c, G, { noSky: true, noCrown: true, noWarm: true, front: '#7a5ad0', front2: '#3a2a8a', chest: function (cc) {
    var gx = 50, gy = 90;
    var core = cc.createRadialGradient(gx, gy, 0.5, gx, gy, 14); core.addColorStop(0, 'rgba(255,240,250,.95)'); core.addColorStop(0.3, 'rgba(255,150,220,.6)'); core.addColorStop(1, 'rgba(120,150,255,0)');
    cc.fillStyle = core; ptEll(cc, gx, gy, 14, 10); cc.fill();
    for (var arm = 0; arm < 2; arm++) for (var q = 0; q < 12; q++) {
      var t = q / 12, a = arm * Math.PI + t * 4, r = 2 + t * 14, x = gx + Math.cos(a) * r, y = gy + Math.sin(a) * r * 0.6;
      cc.fillStyle = 'rgba(' + Math.round(255 - t * 120) + ',' + Math.round(170 + t * 40) + ',255,' + (0.7 - t * 0.4).toFixed(2) + ')'; ptEll(cc, x, y, 2.4 - t, 2.4 - t); cc.fill();
    }
    cc.fillStyle = '#ffffff'; [[30, 84, 0.8], [70, 82, 0.7], [36, 96, 0.6], [64, 96, 0.8]].forEach(function (d) { ptEll(cc, d[0], d[1], d[2], d[2]); cc.fill(); });
  } });
  c.fillStyle = '#ffffff'; [[34, 30, 0.7], [64, 28, 0.6], [70, 50, 0.6], [30, 52, 0.5]].forEach(function (d) { ptEll(c, d[0], d[1], d[2], d[2]); c.fill(); });
  /* the crown of stars round the top of her head */
  [[28, 26, 3.4, '#ffe066'], [38, 18, 4, '#ffffff'], [50, 15, 4.8, '#ffe066'], [62, 18, 4, '#ffffff'], [72, 26, 3.4, '#ffe066']].forEach(function (st) {
    c.fillStyle = 'rgba(15,22,40,.3)'; ptStar(c, st[0] + 0.8, st[1] + 1, st[2], 'rgba(15,22,40,.3)');
    ptStar(c, st[0], st[1], st[2], st[3]);
  });
  /* a ringed planet by her */
  c.fillStyle = '#f0a860'; ptEll(c, 84, 74, 4.4, 4.4); c.fill();
  c.strokeStyle = 'rgba(255,230,190,.85)'; c.lineWidth = 1; ptEll(c, 84, 74, 8, 2.2, -0.35); c.stroke();
};


function paintPortrait(c, size, id, alt) {
  var S = null;
  for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) S = SKINS[i];
  if (!S) S = SKINS[0];
  c.save(); c.scale(size / 100, size / 100);
  c.lineJoin = 'round'; c.lineCap = 'round';
  ptDisc(c);
  var A = alt && PORTRAIT_ALT[alt];
  if (A) A(c, S);
  else if (PORTRAIT[S.id]) PORTRAIT[S.id](c, S);
  c.restore();
}
function drawPortrait(cv, size, id, alt) {
  if (!cv || !cv.getContext) return;
  var k = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.round(size * k); cv.height = Math.round(size * k);
  cv.style.width = size + 'px'; cv.style.height = size + 'px';
  var c = cv.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  c.clearRect(0, 0, size, size);
  paintPortrait(c, size, id, alt);
}
