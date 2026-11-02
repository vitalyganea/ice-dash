/* ===========================================================
   store/trailer/director.js — draws one picture of the trailer
   -----------------------------------------------------------
   Loaded by compose.js into a page of the trailer's own size (1920x1080
   or 1080x1920). frame(i) paints picture i onto the one canvas: the sky
   of the store art (night blue, polar lights, snow), the game's own
   frames from capture.js (on a card of ice beside the words when the
   picture is wide, the whole picture when it is tall), the words in the
   game's lettering, the 3D penguin of the store screenshots and the logo,
   and the cuts between scenes (a flash, a sweep of snow). Everything is
   a function of the picture's number, so a picture comes out the same
   every time it is asked for.
   =========================================================== */
(function () {
  var FPS = 30, CV, X, W, H, TALL, SCENES, assets = {};
  var NAVY = '#0b2a6b', GOLD = '#ffd84a';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function easeOut(k) { k = clamp(k, 0, 1); return 1 - Math.pow(1 - k, 3); }
  function easeBack(k) { k = clamp(k, 0, 1); var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
  function easeBounce(k) {
    k = clamp(k, 0, 1); var n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; }
  function load(src) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
  }

  /* ---- the sky: night blue, two curtains of polar light, stars ---- */
  function sky(t, bright) {
    var g = X.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05123a'); g.addColorStop(0.3, '#0f3488'); g.addColorStop(0.62, '#2a7fd8'); g.addColorStop(1, '#bfe6ff');
    X.fillStyle = g; X.fillRect(0, 0, W, H);
    var r = rnd(7);
    X.fillStyle = '#fff';
    for (var s = 0; s < 120; s++) {
      var sx = r() * W, sy = r() * H * 0.55, tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.7 + s));
      X.globalAlpha = tw * 0.8; X.fillRect(sx, sy, 2.2, 2.2);
    }
    X.globalAlpha = 1;
    X.save();
    X.globalCompositeOperation = 'lighter';
    X.filter = 'blur(' + Math.round(Math.min(W, H) * 0.03) + 'px)';
    [[0.16, 0.9, 0, '#3dffb0', '#3ff0e0'], [0.27, 0.6, 2.1, '#3ff0e0', '#c08bff']].forEach(function (b) {
      var gr = X.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, 'rgba(61,255,176,0)'); gr.addColorStop(0.25, b[3]); gr.addColorStop(0.7, b[4]); gr.addColorStop(1, 'rgba(192,139,255,0)');
      X.strokeStyle = gr; X.globalAlpha = b[1] * (bright || 0.75); X.lineWidth = Math.min(W, H) * 0.09; X.lineCap = 'round';
      X.beginPath();
      for (var x = -100; x <= W + 100; x += 20) {
        var y = H * b[0] + Math.sin(x / (W * 0.12) + b[2] + t * 0.35) * H * 0.05;
        if (x === -100) X.moveTo(x, y); else X.lineTo(x, y);
      }
      X.stroke();
    });
    X.restore();
    X.globalAlpha = 1; X.filter = 'none';
    /* a snow field at the foot */
    var sg = X.createLinearGradient(0, H * 0.82, 0, H);
    sg.addColorStop(0, 'rgba(238,249,255,0)'); sg.addColorStop(1, 'rgba(238,249,255,.85)');
    X.fillStyle = sg; X.fillRect(0, H * 0.8, W, H * 0.2);
  }
  /* falling snow over everything, the same flakes whenever t is the same */
  function snow(t, n, a) {
    var r = rnd(31);
    X.fillStyle = '#fff';
    for (var i = 0; i < n; i++) {
      var x0 = r() * W, y0 = r() * H, sp = 40 + r() * 110, sz = 1.5 + r() * 4.5, dr = r() * 6.28;
      var y = (y0 + t * sp) % (H + 20) - 10, x = (x0 + Math.sin(t * 0.9 + dr) * 30 + t * 18) % W;
      X.globalAlpha = (0.35 + r() * 0.5) * (a == null ? 1 : a);
      X.beginPath(); X.arc(x, y, sz, 0, 6.2832); X.fill();
    }
    X.globalAlpha = 1;
  }

  /* ---- words: the game's lettering, navy rim, a hard shadow ---- */
  function word(text, x, y, size, color, k, align) {
    if (k <= 0) return;
    X.save();
    X.translate(x, y);
    var s = easeBack(k);
    X.scale(s, s);
    X.globalAlpha = clamp(k * 3, 0, 1);
    X.font = '800 ' + size + 'px "Baloo 2"';
    X.textAlign = align || 'center'; X.textBaseline = 'middle';
    X.lineJoin = 'round';
    X.lineWidth = size * 0.2; X.strokeStyle = NAVY;
    X.fillStyle = 'rgba(4,20,60,.5)'; X.fillText(text, 0, size * 0.09);
    X.strokeText(text, 0, size * 0.06); X.strokeText(text, 0, 0);
    var g = X.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
    if (color === 'gold') { g.addColorStop(0, '#fff6c2'); g.addColorStop(0.5, GOLD); g.addColorStop(1, '#f0a000'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#eaf8ff'); g.addColorStop(1, '#a9dcff'); }
    X.fillStyle = g; X.fillText(text, 0, 0);
    X.restore();
  }
  /* the small line under a headline: white on a soft navy band */
  function note(text, x, y, size, k) {
    if (k <= 0) return;
    X.save();
    X.globalAlpha = clamp(k * 2, 0, 1);
    X.font = '700 ' + size + 'px "Baloo 2"';
    var w = X.measureText(text).width + size * 1.2, h = size * 1.55;
    X.translate(x, y + (1 - easeOut(k)) * 30);
    X.fillStyle = 'rgba(8,30,90,.72)';
    pill(-w / 2, -h / 2, w, h, h / 2); X.fill();
    X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 3; X.stroke();
    X.fillStyle = '#fff'; X.textAlign = 'center'; X.textBaseline = 'middle';
    X.fillText(text, 0, size * 0.05);
    X.restore();
  }
  function pill(x, y, w, h, r) {
    X.beginPath(); X.moveTo(x + r, y); X.arcTo(x + w, y, x + w, y + h, r); X.arcTo(x + w, y + h, x, y + h, r);
    X.arcTo(x, y + h, x, y, r); X.arcTo(x, y, x + w, y, r); X.closePath();
  }
  /* a scene's words: up to two headline lines and a note, each popping in
     a little after the one before, all lifting away at the end */
  function headline(sc, t, cx, cy, size) {
    var k0 = (t - sc.t0 - 0.15) / 0.35, out = clamp((sc.t1 - t) / 0.25, 0, 1);
    var lines = sc.text || [], gap = size * 1.05;
    var top = cy - (lines.length - 1) * gap / 2 - (sc.note ? size * 0.35 : 0);
    X.save(); X.globalAlpha = out; X.translate(0, (1 - out) * -40);
    lines.forEach(function (l, i) { word(l, cx, top + i * gap, size, i === lines.length - 1 && lines.length > 1 ? 'gold' : 'white', k0 - i * 0.35); });
    if (sc.note) note(sc.note, cx, top + lines.length * gap + size * 0.15, Math.round(size * 0.32), k0 - lines.length * 0.35);
    X.restore();
  }

  /* ---- the game's frames ---- */
  function frameOf(clip, n) { return '/frames/' + clip + '/' + String(n).padStart(5, '0') + '.jpg'; }
  /* the card of ice the game sits on in the wide picture: rim, shadow and
     a slide in from its side as the scene starts */
  function card(im, sc, t, cx, cy, h, zoom, pos) {
    var w = h * 9 / 16, k = easeOut((t - sc.t0) / 0.35), from = sc.side === 'left' ? -1 : 1;
    var x = cx + from * (1 - k) * W * 0.6, rot = from * (1 - k) * 0.08;
    X.save();
    X.translate(x, cy); X.rotate(rot);
    X.fillStyle = 'rgba(4,20,60,.45)'; pill(-w / 2 - 14, -h / 2 - 6, w + 28, h + 40, 46); X.fill();
    X.fillStyle = '#ffffff'; pill(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 44); X.fill();
    X.save(); pill(-w / 2, -h / 2, w, h, 34); X.clip();
    var map = drawFrame(im, -w / 2, -h / 2, w, h, zoom, pos);
    X.restore();
    X.strokeStyle = '#b9e4ff'; X.lineWidth = 4; pill(-w / 2, -h / 2, w, h, 34); X.stroke();
    X.restore();
    return { x: x, y: cy, w: w, h: h, map: function (a, b) { var p = map(a, b); return [x + p[0], cy + p[1]]; } };
  }
  /* a frame, zoomed about the rider when zoom > 1 (close-ups) */
  function drawFrame(im, x, y, w, h, zoom, pos) {
    var iw = im ? im.width : 1080, ih = im ? im.height : 1920;
    var sw = iw / (zoom || 1), sh = ih / (zoom || 1);
    var px = pos ? pos[0] / 540 * iw : iw / 2, py = pos ? pos[1] / 960 * ih : ih * 0.7;
    var sx = clamp(px - sw / 2, 0, iw - sw), sy = clamp(py - sh * 0.62, 0, ih - sh);
    if (im) X.drawImage(im, sx, sy, sw, sh, x, y, w, h);
    /* where a point of the game's own 540x960 page lands on the canvas */
    return function (cx, cy) { return [x + (cx / 540 * iw - sx) / sw * w, y + (cy / 960 * ih - sy) / sh * h]; };
  }
  /* where in its clip a scene is at time t */
  function clipAt(sc, t) {
    if (sc.cuts) {
      var i = clamp(Math.floor((t - sc.t0) / sc.each), 0, sc.cuts.length - 1), c = sc.cuts[i];
      return { clip: c[0], n: c[1] + Math.round((t - sc.t0 - i * sc.each) * FPS), label: c[2], cut: sc.t0 + i * sc.each };
    }
    return { clip: sc.clip, n: (sc.from || 1) + Math.round((t - sc.t0) * FPS), cut: sc.t0 };
  }

  /* ---- the cuts: a white flash and a sweep of snow across ---- */
  function flash(t, at, a) {
    var k = (t - at) / 0.18;
    if (k < 0 || k > 1) return;
    X.fillStyle = 'rgba(255,255,255,' + ((1 - k) * (a || 0.7)).toFixed(3) + ')'; X.fillRect(0, 0, W, H);
  }
  function sweep(t, at) {
    var k = (t - at + 0.12) / 0.3;
    if (k < 0 || k > 1) return;
    X.save();
    X.translate(lerp(-W * 0.6, W * 1.6, easeOut(k)), 0);
    X.rotate(-0.25);
    var r = rnd(99);
    for (var i = 0; i < 26; i++) {
      X.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.5).toFixed(2) + ')';
      var y = -H * 0.3 + r() * H * 1.6, len = W * (0.15 + r() * 0.35), th = 3 + r() * 10;
      X.fillRect(-len, y, len, th);
    }
    X.restore();
  }
  /* rings where he was tapped, and the word for it */
  function taps(sc, t, map, log, k) {
    var c = clipAt(sc, t), n0 = sc.from || 1;
    for (var n = Math.max(n0 + 1, c.n - 14); n <= c.n; n++) {
      var e = log[n - 1], p = log[n - 2];
      if (!e || !p || e[0] === p[0]) continue;
      var age = (c.n - n) / 14, q = map(e[6], e[7]), x = q[0], y = q[1];
      for (var r = 0; r < 2; r++) {
        var a = clamp(age + r * 0.3, 0, 1);
        X.strokeStyle = 'rgba(255,255,255,' + (1 - a).toFixed(2) + ')'; X.lineWidth = 5 * k;
        X.beginPath(); X.arc(x, y, (22 + a * 70) * k, 0, 6.2832); X.stroke();
      }
      if (age < 0.8) word('TAP!', x + (e[0] > 0 ? -1 : 1) * 78 * k, y - 70 * k, Math.round(40 * k), 'gold', 1 - age * 0.3);
    }
  }

  /* ---- the penguin and the logo ---- */
  function mascot(x, y, h, k, flip, t) {
    var im = assets.penguin; if (!im || k <= 0) return;
    var w = h * im.width / im.height, bob = Math.sin(t * 3.2) * h * 0.015, sq = 1 + Math.sin(t * 6.4) * 0.01;
    X.save();
    X.translate(x, y + bob); X.scale(flip ? -sq : sq, 1 / sq);
    X.globalAlpha = clamp(k * 2, 0, 1);
    X.fillStyle = 'rgba(10,50,110,.28)';
    X.beginPath(); X.ellipse(0, h * 0.48, w * 0.36, h * 0.05, 0, 0, 6.2832); X.fill();
    X.shadowColor = 'rgba(4,20,60,.45)'; X.shadowBlur = h * 0.04; X.shadowOffsetY = h * 0.02;
    X.drawImage(im, -w / 2, -h / 2, w, h);
    X.restore();
  }
  function logo(x, y, w, k) {
    var im = assets.logo; if (!im || k <= 0) return;
    var h = w * im.height / im.width;
    X.save(); X.translate(x, y);
    X.shadowColor = 'rgba(4,20,60,.5)'; X.shadowBlur = w * 0.04; X.shadowOffsetY = w * 0.025;
    X.drawImage(im, -w / 2, -h / 2, w, h);
    X.restore();
  }
  function burst(t, at, x, y, size) {
    var k = (t - at) / 0.9;
    if (k < 0 || k > 1) return;
    var r = rnd(5);
    X.fillStyle = '#fff';
    for (var i = 0; i < 46; i++) {
      var a = r() * 6.2832, sp = (0.4 + r() * 0.8) * size, d = easeOut(k) * sp;
      X.globalAlpha = (1 - k) * (0.6 + r() * 0.4);
      X.beginPath(); X.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 + k * k * size * 0.3, 3 + r() * 7, 0, 6.2832); X.fill();
    }
    X.globalAlpha = 1;
  }

  /* ---- the scenes ---- */
  function scIntro(sc, t) {
    sky(t, 1);
    snow(t, 90);
    var lt = t - sc.t0;
    if (TALL) {
      mascot(W * 0.5 + (1 - easeBack((lt - 0.0) / 0.7)) * W, H * 0.72, H * 0.42, 1, true, t);
      var ly = lerp(-H * 0.3, H * 0.27, easeBounce((lt - 0.6) / 0.6));
      if (lt > 0.6) logo(W * 0.5, ly, W * 0.8, 1);
      burst(t, sc.t0 + 1.2, W * 0.5, H * 0.3, W * 0.6);
      if (sc.note) word(sc.note[0], W * 0.5, H * 0.45, 96, 'gold', (lt - 1.6) / 0.35);
    } else {
      mascot(W * 0.75 + (1 - easeBack(lt / 0.7)) * W * 0.6, H * 0.56, H * 0.82, 1, true, t);
      var y2 = lerp(-H * 0.4, H * 0.4, easeBounce((lt - 0.6) / 0.6));
      if (lt > 0.6) logo(W * 0.32, y2, W * 0.4, 1);
      burst(t, sc.t0 + 1.2, W * 0.32, H * 0.42, W * 0.3);
      if (sc.note) word(sc.note[0], W * 0.3, H * 0.78, 76, 'gold', (lt - 1.6) / 0.35);
    }
    flash(t, sc.t0 + 1.2, 0.5);
  }
  function scOutro(sc, t) {
    sky(t, 1);
    snow(t, 90);
    var lt = t - sc.t0;
    if (TALL) {
      logo(W * 0.5, H * 0.2 + (1 - easeBack((lt - 0.2) / 0.5)) * -H * 0.3, W * 0.78, lt > 0.2 ? 1 : 0);
      mascot(W * 0.5, H * 0.66, H * 0.4, easeOut(lt / 0.5), false, t);
      word('FREE ON', W * 0.5, H * 0.38, 104, 'white', (lt - 0.8) / 0.35);
      word('GOOGLE PLAY', W * 0.5, H * 0.45, 104, 'gold', (lt - 1.05) / 0.35);
      note('Plays offline · No account needed', W * 0.5, H * 0.9, 40, (lt - 1.6) / 0.4);
    } else {
      mascot(W * 0.25, H * 0.56 + (1 - easeBack(lt / 0.6)) * H * 0.6, H * 0.8, 1, false, t);
      logo(W * 0.66, H * 0.3, W * 0.36, lt > 0.2 ? easeBack((lt - 0.2) / 0.5) : 0);
      word('FREE ON GOOGLE PLAY', W * 0.66, H * 0.62, 92, 'gold', (lt - 0.8) / 0.35);
      note('Plays offline · No account needed', W * 0.66, H * 0.78, 40, (lt - 1.4) / 0.4);
    }
    burst(t, sc.t0 + 0.6, TALL ? W * 0.5 : W * 0.66, TALL ? H * 0.2 : H * 0.3, W * (TALL ? 0.6 : 0.3));
    flash(t, sc.t0, 0.8);
    /* fade to the sky's own night at the very end */
    var end = clamp((t - (sc.t1 - 0.5)) / 0.5, 0, 1);
    if (end > 0) { X.fillStyle = 'rgba(5,18,58,' + (end * 0.6).toFixed(3) + ')'; X.fillRect(0, 0, W, H); }
  }
  async function scClip(sc, t) {
    var c = clipAt(sc, t), im = await load(frameOf(c.clip, c.n)), log = assets.logs[c.clip] || [];
    var pos = log[c.n - 1] ? [log[c.n - 1][6], log[c.n - 1][7]] : null;
    if (TALL) {
      /* a little closer than the game's own page, so its score bar leaves
         the top of the picture to the words */
      var map = drawFrame(im, 0, 0, W, H, sc.zoom || 1.12, pos);
      var gr = X.createLinearGradient(0, 0, 0, H * 0.42);
      gr.addColorStop(0, 'rgba(5,18,58,.82)'); gr.addColorStop(1, 'rgba(5,18,58,0)');
      X.fillStyle = gr; X.fillRect(0, 0, W, H * 0.42);
      if (sc.tap) taps(sc, t, map, log, W / 540 * (sc.zoom || 1.12));
      headline(sc, t, W * 0.5, H * 0.16, 118);
      if (c.label) note(c.label, W * 0.5, H * 0.9, 46, (t - c.cut - 0.05) / 0.2);
    } else {
      sky(t, 0.8);
      snow(t, 40, 0.6);
      var left = sc.side === 'left', cx = left ? W * 0.29 : W * 0.71;
      var box = card(im, sc, t, cx, H * 0.5, H * 0.86, sc.zoom, pos);
      if (sc.tap) taps(sc, t, box.map, log, box.w / 540 * (sc.zoom || 1));
      headline(sc, t, left ? W * 0.68 : W * 0.32, H * 0.46, 128);
      if (c.label) note(c.label, cx, H * 0.88, 40, (t - c.cut - 0.05) / 0.2);
      if (sc.mascot) mascot(left ? W * 0.86 : W * 0.14, H * 0.8, H * 0.42, easeOut((t - sc.t0 - 0.3) / 0.4), left, t);
    }
    flash(t, c.cut, sc.cuts ? 0.55 : 0.7);
  }

  window.setup = async function (spec) {
    W = spec.w; H = spec.h; TALL = H > W; SCENES = spec.scenes;
    document.body.style.margin = '0';
    CV = document.createElement('canvas'); CV.width = W; CV.height = H;
    document.body.appendChild(CV); X = CV.getContext('2d');
    assets.penguin = await load('/img/penguin3d.png');
    assets.logo = await load('/img/logo.png');
    assets.logs = spec.logs;
    await document.fonts.load('800 100px "Baloo 2"'); await document.fonts.load('700 40px "Baloo 2"');
    return !!(assets.penguin && assets.logo) && document.fonts.check('800 100px "Baloo 2"');
  };
  window.frame = async function (i) {
    var t = i / FPS, sc = SCENES[SCENES.length - 1];
    for (var k = 0; k < SCENES.length; k++) if (t < SCENES[k].t1) { sc = SCENES[k]; break; }
    X.setTransform(1, 0, 0, 1, 0, 0); X.globalAlpha = 1; X.filter = 'none';
    if (sc.id === 'intro') scIntro(sc, t);
    else if (sc.id === 'outro') scOutro(sc, t);
    else await scClip(sc, t);
    sweep(t, sc.t0);
    return true;
  };
})();
