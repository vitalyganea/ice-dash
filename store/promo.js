/* ===========================================================
   store/promo.js — the Play Store screenshots, dressed for the shop
   -----------------------------------------------------------
   Every picture is the real game, taken from Chrome at a 1080x1920 phone
   mid-run or on a real screen (the steady rider from tools/media-lib.js,
   a save with some progress in it, the game in the listing's language).
   Around it goes a frame in the style of the store art: sky, mountains
   and snow behind, a headline on a ribbon above, the screenshot on a
   rounded card. What the game looks like is never painted over, so the
   pictures show the game as it is, which is what Google Play asks of
   screenshots.
     node store/promo.js            all six languages
     node store/promo.js en ro      only those
   Writes store/promo/<lang>/NN-name.png: 24-bit PNG, 1080x1920.
   Needs Chrome and python3 + PIL, like tools/media-lib.js.
   =========================================================== */
var fs = require('fs'), path = require('path');
var M = require('../tools/media-lib.js');
var ROOT = path.join(__dirname, '..'), OUT = path.join(__dirname, 'promo');
var SHAPE = { width: 540, height: 960, deviceScaleFactor: 2, mobile: true };
/* The pictures are of the Android app as Play installs it: its own page
   (www/, from build-android.sh, with native.js) and its Play Games plugin
   answered here, so the title has the Leaderboard button players see. */
var WWW = path.join(ROOT, 'www');
var APP = "window.Capacitor={isNativePlatform:function(){return true;},Plugins:{" +
  "App:{addListener:function(){return {remove:function(){return Promise.resolve();}};},exitApp:function(){}}," +
  "PlayGames:{status:function(){return Promise.resolve({available:true,signedIn:true});}," +
  "submit:function(){return Promise.resolve({sent:true});},show:function(){return Promise.resolve();}," +
  "top:function(){return Promise.resolve({rows:[]});}}}};";

/* The headlines: two lines (white, then yellow on the ribbon), and for
   some a line under them. Short enough to read on a thumbnail. */
var TEXT = {
  en: { tapw: 'TAP!', tap: ['ONE TAP.', 'ENDLESS ICE.'], fish: ['DODGE TREES,', 'CATCH FISH!'],
        worlds: ['14 MOUNTAIN', 'WORLDS', 'Each with its own weather and music'],
        market: ['18 CREATURES', 'TO UNLOCK'], rush: ['BEAT', 'THE CLOCK!', '20 seconds. Grab time bubbles.'],
        lines: ['10 HAND-MADE', 'LINES', 'Three stars on each'], modes: ['DAILY LINE,', 'TIME RUSH & MORE'],
        title: ['SIMPLE TO LEARN,', 'HARD TO MASTER'], signs: ['PLAYS OFFLINE', 'NO ACCOUNT NEEDED'] },
  ro: { tapw: 'ATINGE!', tap: ['O ATINGERE.', 'GHEAȚĂ FĂRĂ SFÂRȘIT.'], fish: ['OCOLEȘTE BRAZII,', 'PRINDE PEȘTI!'],
        worlds: ['14 LUMI', 'DE MUNTE', 'Fiecare cu vremea și muzica ei'],
        market: ['18 CREATURI', 'DE DEBLOCAT'], rush: ['ÎNVINGE', 'CRONOMETRUL!', '20 de secunde. Prinde bule de timp.'],
        lines: ['10 TRASEE', 'FĂCUTE DE MÂNĂ', 'Trei stele pe fiecare'], modes: ['LINIA ZILEI,', 'CONTRA TIMP ȘI ALTELE'],
        title: ['UȘOR DE ÎNVĂȚAT,', 'GREU DE STĂPÂNIT'], signs: ['MERGE OFFLINE', 'FĂRĂ CONT'] },
  ru: { tapw: 'КОСНИСЬ!', tap: ['ОДНО КАСАНИЕ.', 'БЕСКОНЕЧНЫЙ ЛЁД.'], fish: ['ОБЪЕЗЖАЙ ЕЛИ,', 'ЛОВИ РЫБУ!'],
        worlds: ['14 ГОРНЫХ', 'МИРОВ', 'У каждого своя погода и музыка'],
        market: ['18 СУЩЕСТВ', 'ЖДУТ ТЕБЯ'], rush: ['ОБГОНИ', 'ВРЕМЯ!', '20 секунд. Лови пузыри времени.'],
        lines: ['10 ТРАСС', 'РУЧНОЙ РАБОТЫ', 'Три звезды на каждой'], modes: ['ЛИНИЯ ДНЯ,', 'НА ВРЕМЯ И НЕ ТОЛЬКО'],
        title: ['ЛЕГКО НАЧАТЬ,', 'ТРУДНО СТАТЬ МАСТЕРОМ'], signs: ['БЕЗ ИНТЕРНЕТА', 'БЕЗ РЕГИСТРАЦИИ'] },
  es: { tapw: '¡TOCA!', tap: ['UN TOQUE.', 'HIELO SIN FIN.'], fish: ['ESQUIVA PINOS,', '¡ATRAPA PECES!'],
        worlds: ['14 MUNDOS', 'DE MONTAÑA', 'Cada uno con su clima y su música'],
        market: ['18 CRIATURAS', 'POR DESBLOQUEAR'], rush: ['¡GÁNALE AL', 'RELOJ!', '20 segundos. Atrapa burbujas de tiempo.'],
        lines: ['10 RUTAS', 'HECHAS A MANO', 'Tres estrellas en cada una'], modes: ['LÍNEA DEL DÍA,', 'CONTRARRELOJ Y MÁS'],
        title: ['FÁCIL DE APRENDER,', 'DIFÍCIL DE DOMINAR'], signs: ['SIN INTERNET', 'SIN CUENTA'] },
  pt: { tapw: 'TOQUE!', tap: ['UM TOQUE.', 'GELO SEM FIM.'], fish: ['DESVIE DOS PINHEIROS,', 'PEGUE PEIXES!'],
        worlds: ['14 MUNDOS', 'DE MONTANHA', 'Cada um com seu clima e sua música'],
        market: ['18 CRIATURAS', 'PARA DESBLOQUEAR'], rush: ['VENÇA O', 'RELÓGIO!', '20 segundos. Pegue bolhas de tempo.'],
        lines: ['10 PISTAS', 'FEITAS À MÃO', 'Três estrelas em cada uma'], modes: ['LINHA DO DIA,', 'CONTRA O TEMPO E MAIS'],
        title: ['FÁCIL DE APRENDER,', 'DIFÍCIL DE DOMINAR'], signs: ['JOGUE OFFLINE', 'SEM CONTA'] },
  de: { tapw: 'TIPP!', tap: ['EIN TIPP.', 'ENDLOSES EIS.'], fish: ['WEICH DEN BÄUMEN AUS,', 'FANG FISCHE!'],
        worlds: ['14 BERG-', 'WELTEN', 'Jede mit eigenem Wetter und eigener Musik'],
        market: ['18 TIERE', 'ZUM FREISCHALTEN'], rush: ['SCHLAG', 'DIE UHR!', '20 Sekunden. Schnapp dir Zeitblasen.'],
        lines: ['10 HANDGEMACHTE', 'STRECKEN', 'Drei Sterne pro Strecke'], modes: ['TAGESLINIE,', 'ZEITRENNEN UND MEHR'],
        title: ['LEICHT ZU LERNEN,', 'SCHWER ZU MEISTERN'], signs: ['OFFLINE SPIELBAR', 'KEIN KONTO NÖTIG'] }
};

/* The stretches for the worlds picture: six that look nothing alike
   (js/biomes.js order: Night Run, Emberflow, Frozen Jungle, Cosmic Ice,
   Crystal Caves, Neon). Taken once, without the score band, so they
   serve every language. */
var WORLDS = [6, 7, 10, 11, 12, 13];

function png64(file) { return 'data:image/png;base64,' + fs.readFileSync(file).toString('base64'); }

/* The mascot: a round, glossy cartoon penguin drawn here in SVG, front
   on: black with a blue sheen, a white face and belly, big blue eyes.
   Not the game's own creature (that one is seen from above, on its
   belly); he only stands beside the headline and says it. Volume comes
   from gradients, highlights and soft shadows, not from outlines.
   pose: 'wave', 'point', 'cheer', 'fish' or 'star'. A flipper's angle
   turns it about the shoulder: 0 hangs down, 90 points out, 135 is up. */
function penguin(pose, look) {
  var P = { wave: [20, 118], point: [84, 20], cheer: [122, 122], fish: [20, 135], star: [135, 20],
            present: [40, 140] }[pose] || [20, 20];
  var lx = look ? look[0] : 0, ly = look ? look[1] : 0;
  var fish = '<g transform="translate(12 214) rotate(-70)"><path d="M-22 0 C-12 -14 12 -14 20 0 C12 14 -12 14 -22 0Z" fill="url(#pgFish)"/>' +
    '<path d="M18 0 L34 -11 L31 0 L34 11Z" fill="#3a9fe0"/><circle cx="-11" cy="-2" r="3.2" fill="#0b1a33"/><circle cx="-12" cy="-3" r="1.1" fill="#fff"/>' +
    '<path d="M-14 -7 C-4 -11 8 -10 14 -5" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/></g>';
  var star = '<g transform="translate(14 216)"><path d="M0 -25 L7.5 -8 L25 -7 L11.5 4.5 L15.5 22 L0 12.5 L-15.5 22 L-11.5 4.5 L-25 -7 L-7.5 -8Z" fill="url(#pgStar)" stroke="#e39a00" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M-7 -6 L-1 -17" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"/></g>';
  function flipper(ang, prop) {
    return '<g transform="rotate(' + ang + ' 42 120)">' + (prop || '') +
      '<path d="M46 106 C 20 116 4 156 8 196 C 12 204 22 202 28 192 C 40 170 50 146 56 124 Z" fill="url(#pgFlip)"/>' +
      '<path d="M30 132 C 20 150 14 170 14 188" fill="none" stroke="#6d84b4" stroke-width="3" stroke-linecap="round" opacity=".35"/></g>';
  }
  function eye(x) {
    return '<ellipse cx="' + x + '" cy="98" rx="15" ry="18" fill="#0a1226"/>' +
      '<ellipse cx="' + (x + 1 + lx) + '" cy="' + (100 + ly) + '" rx="12.5" ry="15" fill="url(#pgIris)"/>' +
      '<ellipse cx="' + (x + 2 + lx * 1.4) + '" cy="' + (102 + ly * 1.4) + '" rx="7" ry="9" fill="#050914"/>' +
      '<ellipse cx="' + (x - 4 + lx) + '" cy="' + (91 + ly) + '" rx="6" ry="7" fill="#fff"/>' +
      '<circle cx="' + (x + 6 + lx) + '" cy="' + (108 + ly) + '" r="2.6" fill="#fff" opacity=".9"/>';
  }
  return '<svg viewBox="-30 0 260 245" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<radialGradient id="pgBody" cx=".36" cy=".22" r=".85"><stop offset="0" stop-color="#53648a"/><stop offset=".45" stop-color="#1e2740"/><stop offset="1" stop-color="#090c16"/></radialGradient>' +
    '<linearGradient id="pgFlip" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4a6c"/><stop offset="1" stop-color="#0b0f1c"/></linearGradient>' +
    '<radialGradient id="pgBelly" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#f1f6fb"/><stop offset="1" stop-color="#c3d5e8"/></radialGradient>' +
    '<radialGradient id="pgIris" cx=".45" cy=".6" r=".6"><stop offset="0" stop-color="#7fe0ff"/><stop offset=".55" stop-color="#2a8fe0"/><stop offset="1" stop-color="#0c3f86"/></radialGradient>' +
    '<linearGradient id="pgBeak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd25c"/><stop offset=".55" stop-color="#ff9d1e"/><stop offset="1" stop-color="#e46a00"/></linearGradient>' +
    '<linearGradient id="pgFoot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffbe4d"/><stop offset="1" stop-color="#ee7a00"/></linearGradient>' +
    '<linearGradient id="pgFish" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fdcff"/><stop offset="1" stop-color="#2f8fd8"/></linearGradient>' +
    '<radialGradient id="pgStar" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#f5a800"/></radialGradient>' +
    '<filter id="pgSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>' +
    '</defs>' +
    '<ellipse cx="100" cy="234" rx="62" ry="9" fill="#06203f" opacity=".25" filter="url(#pgSoft)"/>' +
    '<path d="M58 226 C56 214 70 208 82 210 C94 212 98 222 92 230 C84 236 62 236 58 226Z" fill="url(#pgFoot)"/>' +
    '<path d="M142 226 C144 214 130 208 118 210 C106 212 102 222 108 230 C116 236 138 236 142 226Z" fill="url(#pgFoot)"/>' +
    flipper(P[0], pose === 'star' ? star : '') +
    '<g transform="translate(200 0) scale(-1 1)">' + flipper(P[1], pose === 'fish' ? fish : '') + '</g>' +
    '<path d="M100 20 C154 20 178 70 176 130 C174 190 148 226 100 226 C52 226 26 190 24 130 C22 70 46 20 100 20Z" fill="url(#pgBody)"/>' +
    '<path d="M100 74 C112 50 150 50 154 86 C157 108 150 124 146 140 C154 168 146 214 100 218 C54 214 46 168 54 140 C50 124 43 108 46 86 C50 50 88 50 100 74Z" fill="url(#pgBelly)"/>' +
    '<path d="M60 150 C70 196 130 196 140 150" fill="none" stroke="#9db5d0" stroke-width="5" opacity=".25" filter="url(#pgSoft)"/>' +
    '<ellipse cx="70" cy="42" rx="24" ry="10" transform="rotate(-28 70 42)" fill="#fff" opacity=".28" filter="url(#pgSoft)"/>' +
    '<path d="M150 50 C166 70 172 100 170 128" fill="none" stroke="#8fb3ff" stroke-width="5" stroke-linecap="round" opacity=".28"/>' +
    eye(80) + eye(120) +
    '<ellipse cx="64" cy="124" rx="9" ry="5.5" fill="#ff9fb2" opacity=".38"/><ellipse cx="136" cy="124" rx="9" ry="5.5" fill="#ff9fb2" opacity=".38"/>' +
    '<path d="M88 116 Q100 107 112 116 Q107 128 100 130 Q93 128 88 116Z" fill="url(#pgBeak)"/>' +
    '<path d="M92 114 Q100 109 107 113" fill="none" stroke="#fff3c4" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>' +
    '<path d="M93 133 Q100 137 107 133" fill="none" stroke="#7a4a2a" stroke-width="2" stroke-linecap="round" opacity=".45"/>' +
    '</svg>';
}

/* Where the penguin stands and where his bubble is: TR, TL beside the
   headline at the top (the card below), BR, BL beside it at the foot (the
   card above). The bubble's tail points at his head. */
var PW = 200, PH = Math.round(200 * 245 / 260);
/* the 3D penguin picture (store/promo/mascot/penguin3d.png) is shown this
   wide; he looks to his left, so on the right he is turned round */
var IW = 200, IH = 0, PEEK = 176;
function picSize(file) {           // a PNG's width and height, from its header
  var b = fs.readFileSync(file);
  IH = Math.round(IW * b.readUInt32BE(20) / b.readUInt32BE(16));
}
function placing(at, sub, pic) {
  var w = pic ? IW : PW, hh = pic ? IH : PH;
  var top = at[0] === 'T', right = at[1] === 'R';
  /* a peeking picture leaves a narrower bubble: its small line takes two rows */
  var h = sub ? (pic && top ? 230 : 206) : 172;
  var y0 = top ? 24 : 960 - 22 - h;
  var card = top ? y0 + h + 26 : 26;
  var px, py, mode = 'stand';
  var bx0 = right ? 12 : 184, bw = 344;
  if (pic && top) {
    /* the picture: up top he comes up from behind the card, which hides
       him from the chest down, so he is kept wholly over it (beside it,
       his feet would hang in the air); the bubble takes the room left */
    mode = 'peek';
    w = PEEK; hh = Math.round(PEEK * IH / IW);
    px = right ? 484 - w : 74;
    py = card - Math.round(hh * 0.6);
    bx0 = right ? 12 : px + w + 2;
    bw = right ? px - 14 : 528 - bx0;
  } else if (pic) {
    px = right ? 540 - w - 2 : 2;
    py = 960 - hh - 16;
  } else {
    /* the drawn one stands on the card's edge, or comes up past its foot */
    px = right ? 540 - w - 4 : 6;
    py = top ? card - hh + 30 : 960 - hh - 2;
  }
  if (!top) y0 = Math.min(y0, py + 40);
  /* the tail ends just off his beak (the picture faces right; turned round on the right) */
  var hx = pic ? (right ? px + w * 0.17 : px + w * 0.83) : (right ? px + 34 : px + w - 34);
  return { at: at, x0: bx0, y0: y0, w: bw, h: h, side: right ? 'R' : 'L',
           tx: Math.round(hx), ty: py + (pic ? Math.round(hh * 0.42) : 76), px: px, py: py, mode: mode,
           flip: pic ? right : !right, pw: w, ph: hh, card: card };
}

/* A little life round the picture: snow to stand in and a shadow under
   his feet when he stands, and a glint or two about him. */
function lively(pl) {
  var cx = pl.px + pl.pw / 2, out = '<svg class="cue" viewBox="0 0 540 960">';
  if (pl.mode === 'stand') {
    var fy = pl.py + pl.ph - 10;
    out += '<ellipse cx="' + cx + '" cy="' + (fy + 6) + '" rx="' + (pl.pw * 0.44) + '" ry="14" fill="#06203f" opacity=".28" style="filter:blur(5px)"/>' +
      '<path d="M' + (cx - pl.pw * 0.62) + ' 962 Q' + (cx - pl.pw * 0.45) + ' ' + (fy - 6) + ' ' + cx + ' ' + (fy - 2) +
      ' Q' + (cx + pl.pw * 0.45) + ' ' + (fy - 6) + ' ' + (cx + pl.pw * 0.62) + ' 962Z" fill="#ffffff" style="filter:drop-shadow(0 -3px 4px rgba(120,180,230,.6))"/>' +
      '<path d="M' + (cx - pl.pw * 0.36) + ' ' + (fy + 10) + ' Q' + cx + ' ' + (fy + 2) + ' ' + (cx + pl.pw * 0.36) + ' ' + (fy + 10) + '" stroke="#cfe8fa" stroke-width="4" fill="none" stroke-linecap="round"/>';
  }
  [[-0.42, 0.08, 9], [0.46, 0.22, 7], [-0.5, 0.48, 6]].forEach(function (g) {
    var x = cx + g[0] * pl.pw, y = pl.py + g[1] * pl.ph, z = g[2];
    out += '<path d="M' + x + ' ' + (y - z) + ' Q' + (x + 1.5) + ' ' + (y - 1.5) + ' ' + (x + z) + ' ' + y + ' Q' + (x + 1.5) + ' ' + (y + 1.5) + ' ' + x + ' ' + (y + z) +
      ' Q' + (x - 1.5) + ' ' + (y + 1.5) + ' ' + (x - z) + ' ' + y + ' Q' + (x - 1.5) + ' ' + (y - 1.5) + ' ' + x + ' ' + (y - z) + 'Z" fill="#fff" style="filter:drop-shadow(0 0 4px #9fe8ff)"/>';
  });
  return out + '</svg>';
}

/* The livelier ice of the English set: big glowing crystals on the
   sides, swirls of light behind the penguin, frost growing in from two
   corners and a few bright glints. All of it under the card. */
function crystal(x, y, sc, rot) {
  var parts = [[0, 0, 26, 120, 0], [-22, 6, 20, 84, -24], [22, 6, 20, 92, 22], [-40, 10, 14, 54, -46], [40, 12, 15, 60, 44]];
  return '<g transform="translate(' + x + ' ' + y + ') rotate(' + rot + ') scale(' + sc + ')" filter="url(#glow)">' + parts.map(function (q) {
    var w = q[2], h = q[3];
    return '<g transform="translate(' + q[0] + ' ' + q[1] + ') rotate(' + q[4] + ')">' +
      '<path d="M' + (-w / 2) + ' 0 L' + (-w / 2) + ' ' + (-h * 0.7) + ' L0 ' + (-h) + ' L' + (w / 2) + ' ' + (-h * 0.7) + ' L' + (w / 2) + ' 0Z" fill="url(#cr)"/>' +
      '<path d="M0 ' + (-h) + ' L' + (w / 2) + ' ' + (-h * 0.7) + ' L' + (w / 2) + ' 0 L0 0Z" fill="#1d5fd6" opacity=".35"/>' +
      '<path d="M' + (-w / 2 + 3) + ' -4 L' + (-w / 2 + 3) + ' ' + (-h * 0.68) + ' L0 ' + (-h + 6) + '" fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round" opacity=".95"/></g>';
  }).join('') + '</g>';
}
function frost(x, y, dir, rnd) {
  var out = '<g stroke="#fff" stroke-linecap="round" fill="none" opacity=".7">';
  function branch(bx, by, ang, len, w, depth) {
    var ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    out += '<path d="M' + bx.toFixed(1) + ' ' + by.toFixed(1) + ' L' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" stroke-width="' + w.toFixed(1) + '"/>';
    if (depth <= 0) return;
    for (var k = 1; k <= 3; k++) {
      var t = k / 4, sx = bx + (ex - bx) * t, sy = by + (ey - by) * t;
      branch(sx, sy, ang + 0.8, len * 0.38, w * 0.6, depth - 1);
      branch(sx, sy, ang - 0.8, len * 0.38, w * 0.6, depth - 1);
    }
  }
  for (var i = 0; i < 5; i++) branch(x, y, dir + (i - 2) * 0.28 + (rnd() - 0.5) * 0.1, 70 + rnd() * 50, 3.2, 2);
  return out + '</g>';
}
function swirl(cx, cy) {
  var out = '<g fill="none" stroke-linecap="round" filter="url(#glow)">';
  [[150, 0.2, 2.4, '#ffffff', 6, 0.9], [120, 1.9, 4.1, '#9ff0ff', 5, 0.85], [175, 3.6, 5.6, '#ffffff', 3.5, 0.7], [96, 4.4, 6.0, '#c9b8ff', 4, 0.6]].forEach(function (a) {
    var r = a[0], x1 = cx + Math.cos(a[1]) * r, y1 = cy + Math.sin(a[1]) * r * 0.62, x2 = cx + Math.cos(a[2]) * r, y2 = cy + Math.sin(a[2]) * r * 0.62;
    out += '<path d="M' + x1.toFixed(0) + ' ' + y1.toFixed(0) + ' A' + r + ' ' + (r * 0.62).toFixed(0) + ' -12 0 1 ' + x2.toFixed(0) + ' ' + y2.toFixed(0) +
      '" stroke="' + a[3] + '" stroke-width="' + a[4] + '" opacity="' + a[5] + '"/>';
  });
  return out + '</g>';
}
function glints(rnd, n) {
  var out = '';
  for (var i = 0; i < n; i++) {
    var x = rnd() * 540, y = rnd() * 960, s = 10 + rnd() * 16;
    out += '<g transform="translate(' + x.toFixed(0) + ' ' + y.toFixed(0) + ')" filter="url(#glow)">' +
      '<circle r="' + (s * 0.9).toFixed(0) + '" fill="url(#bk)" opacity=".7"/>' +
      '<path d="M0 ' + (-s) + ' Q2 -2 ' + s + ' 0 Q2 2 0 ' + s + ' Q-2 2 ' + (-s) + ' 0 Q-2 -2 0 ' + (-s) + 'Z" fill="#fff"/></g>';
  }
  return out;
}

/* The ice behind every frame, so the margins round the card are not an
   empty sky: light coming down from the top, icicles along the edge,
   snowflakes of six arms, soft out-of-focus flakes, glints, and frost
   creeping in from the sides. All of it lies under the card. */
function flakeSvg(x, y, r, rot, op) {
  var arms = '';
  for (var k = 0; k < 6; k++) {
    arms += '<g transform="rotate(' + (k * 60) + ')"><path d="M0 0 V' + (-r) + ' M0 ' + (-r * 0.55) + ' l' + (r * 0.28) + ' ' + (-r * 0.22) +
      ' M0 ' + (-r * 0.55) + ' l' + (-r * 0.28) + ' ' + (-r * 0.22) + '"/></g>';
  }
  return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + rot.toFixed(0) + ')" stroke="#fff" stroke-width="' +
    Math.max(1.6, r * 0.11).toFixed(1) + '" stroke-linecap="round" fill="none" opacity="' + op.toFixed(2) + '">' + arms + '</g>';
}
function icy(rnd) {
  var out = '<defs><radialGradient id="bk" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/>' +
    '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="ic" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9fd9ff" stop-opacity=".85"/></linearGradient>' +
    '<radialGradient id="fr" cx=".5" cy=".45" r=".75"><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#eaf7ff" stop-opacity=".75"/></radialGradient></defs>';
  /* light from above */
  out += '<g opacity=".13" fill="#fff">';
  for (var k = 0; k < 14; k++) {
    var a0 = (k / 14) * Math.PI * 2, a1 = a0 + 0.12;
    out += '<path d="M270 -60 L' + (270 + Math.cos(a0) * 1400).toFixed(0) + ' ' + (-60 + Math.sin(a0) * 1400).toFixed(0) +
      ' L' + (270 + Math.cos(a1) * 1400).toFixed(0) + ' ' + (-60 + Math.sin(a1) * 1400).toFixed(0) + 'Z"/>';
  }
  out += '</g>';
  /* soft out-of-focus flakes */
  for (var b = 0; b < 16; b++) {
    var br = 10 + rnd() * 26;
    out += '<circle cx="' + (rnd() * 540).toFixed(0) + '" cy="' + (rnd() * 960).toFixed(0) + '" r="' + br.toFixed(0) + '" fill="url(#bk)" opacity="' + (0.25 + rnd() * 0.35).toFixed(2) + '"/>';
  }
  /* snowflakes, bigger near the sides where the card leaves room */
  for (var f = 0; f < 22; f++) {
    var side = f % 2 ? 0 : 1, x = side ? 470 + rnd() * 70 : rnd() * 70;
    if (f > 15) x = rnd() * 540;
    out += flakeSvg(x, 30 + rnd() * 900, 7 + rnd() * 16, rnd() * 60, 0.55 + rnd() * 0.4);
  }
  /* glints */
  for (var g = 0; g < 12; g++) {
    var gx = rnd() * 540, gy = rnd() * 960, gs = 5 + rnd() * 9;
    out += '<path d="M' + gx.toFixed(0) + ' ' + (gy - gs).toFixed(0) + ' Q' + (gx + gs * 0.15).toFixed(1) + ' ' + (gy - gs * 0.15).toFixed(1) + ' ' +
      (gx + gs).toFixed(0) + ' ' + gy.toFixed(0) + ' Q' + (gx + gs * 0.15).toFixed(1) + ' ' + (gy + gs * 0.15).toFixed(1) + ' ' + gx.toFixed(0) + ' ' + (gy + gs).toFixed(0) +
      ' Q' + (gx - gs * 0.15).toFixed(1) + ' ' + (gy + gs * 0.15).toFixed(1) + ' ' + (gx - gs).toFixed(0) + ' ' + gy.toFixed(0) +
      ' Q' + (gx - gs * 0.15).toFixed(1) + ' ' + (gy - gs * 0.15).toFixed(1) + ' ' + gx.toFixed(0) + ' ' + (gy - gs).toFixed(0) + 'Z" fill="#fff" opacity="' + (0.6 + rnd() * 0.4).toFixed(2) + '"/>';
  }
  /* icicles along the top */
  var ix = -6;
  while (ix < 546) {
    var iw = 14 + rnd() * 18, il = 18 + rnd() * (rnd() < 0.3 ? 70 : 34);
    out += '<path d="M' + ix.toFixed(0) + ' -2 L' + (ix + iw).toFixed(0) + ' -2 L' + (ix + iw * 0.55).toFixed(0) + ' ' + il.toFixed(0) + 'Z" fill="url(#ic)"/>' +
      '<path d="M' + (ix + iw * 0.3).toFixed(0) + ' 2 L' + (ix + iw * 0.5).toFixed(0) + ' ' + (il * 0.75).toFixed(0) + '" stroke="#fff" stroke-width="2" opacity=".8"/>';
    ix += iw - 2;
  }
  /* frost round the edges */
  out += '<rect x="0" y="0" width="540" height="960" fill="url(#fr)"/>';
  return out;
}
/* ice crystals growing out of both bottom corners */
function shards() {
  function cluster(x, flip) {
    var pts = [[0, 0, 36, 150, -14], [30, 0, 30, 110, 10], [-26, 0, 26, 92, -30], [58, 0, 24, 70, 26], [-50, 0, 22, 60, -44]];
    return '<g transform="translate(' + x + ' 972)' + (flip ? ' scale(-1 1)' : '') + '">' + pts.map(function (q) {
      var w = q[2], h = q[3];
      return '<g transform="translate(' + q[0] + ' 0) rotate(' + q[4] + ')"><path d="M' + (-w / 2) + ' 0 L' + (-w / 2) + ' ' + (-h * 0.72) + ' L0 ' + (-h) + ' L' + (w / 2) + ' ' + (-h * 0.72) + ' L' + (w / 2) + ' 0Z" fill="url(#ic)" opacity=".92"/>' +
        '<path d="M' + (-w / 2 + 4) + ' -6 L' + (-w / 2 + 4) + ' ' + (-h * 0.7) + ' L0 ' + (-h + 8) + '" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round" opacity=".9"/>' +
        '<path d="M0 ' + (-h) + ' L0 -4" stroke="#bfe6ff" stroke-width="2" opacity=".7"/></g>';
    }).join('') + '</g>';
  }
  return cluster(40, false) + cluster(500, true);
}

/* Where the rider is in a capture: the middle of the biggest dark patch
   on the hill (the HUD at the top and the pause button below are left
   out). In the capture's css pixels. */
function findRider(file) {
  /* near-black and colourless: the penguin's coat, not the dark green trees */
  var py = "import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB')\nW,H=im.size\npx=im.load()\n" +
    "xs=ys=n=0\nfor y in range(int(H*.2),int(H*.9),2):\n for x in range(0,W,2):\n  r,g,b=px[x,y]\n  if max(r,g,b)<70 and max(r,g,b)-min(r,g,b)<30: xs+=x; ys+=y; n+=1\n" +
    "print(xs//max(n,1)//2, ys//max(n,1)//2, n)";
  var out = require('child_process').execFileSync('python3', ['-c', py, file]).toString().trim().split(' ').map(Number);
  return out[2] > 20 ? [out[0], out[1]] : null;
}
/* The tap, drawn so it explains itself: from the rider a dotted line goes
   one way, and where the hand taps it turns and goes the other way. */
function hand() {
  /* A pointing hand drawn as one outline: the finger straight up from the
     tip at (0, 0), three folded knuckles stepping down on the right, a
     short rounded thumb on the left, the wrist in a blue cuff. White with
     a faint shade for volume, a navy edge, short marks between the
     folded fingers, every line the same width, nothing else. */
  var outline = 'M-11 11 A11 11 0 0 1 11 11 L11 44 C11 37 31 35 31 46 C31 40 47 40 47 51 C47 45 58 46 58 57 ' +
    'L58 80 C58 93 50 100 40 100 L4 100 C-6 100 -12 94 -14 86 C-18 80 -28 74 -31 64 ' +
    'C-34 55 -27 50 -21 52 C-16 54 -12 58 -11 63 Z';
  return '<defs><linearGradient id="handG" x1="0" y1="0" x2="1" y2="1"><stop offset=".45" stop-color="#ffffff"/>' +
    '<stop offset="1" stop-color="#dcebf8"/></linearGradient></defs>' +
    '<path d="' + outline + '" fill="url(#handG)" stroke="#0b3a7a" stroke-width="6" stroke-linejoin="round"/>' +
    '<path d="M11 46 L12 60 M31 47 L30 59 M47 52 L46 62" stroke="#0b3a7a" stroke-width="6" stroke-linecap="round" fill="none"/>' +
    '<rect x="-6" y="97" width="56" height="15" rx="6" fill="#59c4ff" stroke="#0b3a7a" stroke-width="6"/>';
}

function tapCue(rx, ry, word) {
  var side = rx < 270 ? 1 : -1;
  var x0 = rx, y0 = ry - 34, bx = rx + side * 92, by = ry - 128, ex = rx - side * 18, ey = ry - 250;
  var ang = Math.atan2(ey - by, ex - bx), ah = 22;
  var head = 'M' + ex + ' ' + ey + ' L' + (ex - ah * Math.cos(ang - 0.5)).toFixed(1) + ' ' + (ey - ah * Math.sin(ang - 0.5)).toFixed(1) +
    ' M' + ex + ' ' + ey + ' L' + (ex - ah * Math.cos(ang + 0.5)).toFixed(1) + ' ' + (ey - ah * Math.sin(ang + 0.5)).toFixed(1);
  /* the dots stop short of the fingertip and start again past it */
  function toward(ax, ay, cx, cy, d) { var l = Math.hypot(cx - ax, cy - ay); return [ax + (cx - ax) / l * d, ay + (cy - ay) / l * d]; }
  var g1 = toward(bx, by, x0, y0, 34), g2 = toward(bx, by, ex, ey, 34);
  /* the word stays on the card however long it is in a language */
  var tw = word.length * 21, lx = Math.max(84 + tw / 2, Math.min(456 - tw / 2, bx + side * 70));
  var path = 'M' + x0 + ' ' + y0 + ' L' + g1[0].toFixed(1) + ' ' + g1[1].toFixed(1) + ' M' + g2[0].toFixed(1) + ' ' + g2[1].toFixed(1) + ' L' + ex + ' ' + ey;
  return '<svg class="cue" viewBox="0 0 540 960">' +
    '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="' + path + '" stroke="#0b3a7a" stroke-width="13" stroke-dasharray="2 20" opacity=".9"/>' +
      '<path d="' + path + '" stroke="#ffffff" stroke-width="7" stroke-dasharray="2 20"/>' +
      '<path d="' + head + '" stroke="#0b3a7a" stroke-width="13"/><path d="' + head + '" stroke="#ffffff" stroke-width="7"/></g>' +
    '<circle cx="' + bx + '" cy="' + by + '" r="20" fill="#fff" fill-opacity=".35" stroke="#fff" stroke-width="5"/>' +
    '<circle cx="' + bx + '" cy="' + by + '" r="36" fill="none" stroke="#fff" stroke-width="4" opacity=".7"/>' +
    '<circle cx="' + bx + '" cy="' + by + '" r="52" fill="none" stroke="#fff" stroke-width="3" opacity=".4"/>' +
    '<g transform="translate(' + (bx + 2) + ' ' + (by + 4) + ') rotate(' + (side > 0 ? -18 : 18) + ') scale(.9)" style="filter:drop-shadow(0 6px 4px rgba(6,36,87,.45))">' + hand() + '</g>' +
    '<text x="' + lx + '" y="' + (by - 36) + '" text-anchor="middle" font-size="34" font-weight="800" fill="#ffd84a" stroke="#0b3a7a" stroke-width="9" ' +
      'stroke-linejoin="round" paint-order="stroke" transform="rotate(' + (side > 0 ? 8 : -8) + ' ' + lx + ' ' + (by - 36) + ')">' + word + '</text></svg>';
}

/* Polar lights: soft wavy bands of green, cyan and violet crossing the
   sky on a slant, so they show above the card and down both its sides. */
function aurora(rnd) {
  var out = '<defs><linearGradient id="au" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3dffb0" stop-opacity="0"/>' +
    '<stop offset=".2" stop-color="#3dffb0"/><stop offset=".55" stop-color="#3ff0e0"/><stop offset=".85" stop-color="#c08bff"/>' +
    '<stop offset="1" stop-color="#c08bff" stop-opacity="0"/></linearGradient>' +
    '<linearGradient id="auR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dffc8" stop-opacity=".85"/>' +
    '<stop offset="1" stop-color="#7dffc8" stop-opacity="0"/></linearGradient>' +
    '<filter id="auB" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>' +
    '<filter id="auS" x="-50%" y="-20%" width="200%" height="140%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>';
  /* two curtains: a band across the top, bending down at each side */
  [[64, 0.9, 0], [150, 0.7, 2.1]].forEach(function (b) {
    var y = b[0], pts = [];
    for (var x = -60; x <= 600; x += 15) {
      var edge = Math.min(1, Math.abs(x - 270) / 270);
      pts.push([x, y + Math.sin(x / 70 + b[2]) * 22 + edge * edge * 260]);
    }
    var d = 'M' + pts.map(function (q) { return q[0] + ' ' + q[1].toFixed(0); }).join(' L');
    /* the rays hanging below the band */
    out += '<g filter="url(#auS)" opacity="' + (b[1] * 0.75).toFixed(2) + '">';
    pts.forEach(function (q, i) {
      var len = 50 + rnd() * 80;
      out += '<rect x="' + (q[0] - 4) + '" y="' + q[1].toFixed(0) + '" width="' + (5 + rnd() * 5).toFixed(1) + '" height="' + len.toFixed(0) + '" fill="url(#auR)"/>';
    });
    out += '</g>';
    out += '<path d="' + d + '" fill="none" stroke="url(#au)" stroke-width="46" stroke-linecap="round" opacity="' + b[1] + '" filter="url(#auB)"/>';
    out += '<path d="' + d + '" fill="none" stroke="#eafff6" stroke-width="5" opacity="' + (b[1] * 0.7).toFixed(2) + '" filter="url(#auS)"/>';
  });
  return out;
}
/* A blizzard: snow streaking past on the wind, all one way, and a few
   long thin gusts. */
function blizzard(rnd) {
  var out = '<g stroke="#fff" stroke-linecap="round" fill="none">', a = 0.32;
  for (var i = 0; i < 70; i++) {
    var x = rnd() * 600 - 30, y = rnd() * 980 - 10, len = 16 + rnd() * 54;
    out += '<path d="M' + x.toFixed(0) + ' ' + y.toFixed(0) + ' l' + (Math.cos(a) * len).toFixed(1) + ' ' + (Math.sin(a) * len).toFixed(1) +
      '" stroke-width="' + (1.4 + rnd() * 2.4).toFixed(1) + '" opacity="' + (0.3 + rnd() * 0.5).toFixed(2) + '"/>';
  }
  for (var g = 0; g < 6; g++) {
    var gx = rnd() * 300 - 120, gy = 80 + rnd() * 800;
    out += '<path d="M' + gx.toFixed(0) + ' ' + gy.toFixed(0) + ' q160 ' + (20 + rnd() * 40).toFixed(0) + ' 320 ' + (60 + rnd() * 50).toFixed(0) +
      ' t260 ' + (40 + rnd() * 40).toFixed(0) + '" stroke-width="2.5" opacity=".28"/>';
  }
  return out + '</g>';
}

/* One frame. kind: 'card' (a screenshot on a card, zoom to bring a
   small panel closer), 'worlds' (six tiles). With a mascot ({at, pose})
   the headline is his speech bubble; without, it sits on a ribbon. The
   page measures each headline line and shrinks it to fit. */
function frame(o) {
  var flakes = '';
  var seed = o.seed || 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  for (var i = 0; i < 70; i++) {
    var r = 1 + rnd() * 3.2;
    flakes += '<circle cx="' + (rnd() * 540).toFixed(1) + '" cy="' + (rnd() * 960).toFixed(1) + '" r="' + r.toFixed(1) +
      '" fill="#fff" opacity="' + (0.45 + rnd() * 0.5).toFixed(2) + '"/>';
  }
  var pl = o.mascot ? placing(o.mascot.at, o.sub, !!o.mascot.img) : null;
  var cardTop = pl ? pl.card : (o.sub ? 246 : 222);
  var body = '';
  if (o.kind === 'card') {
    if (o.fancy) body += '<div class="ring" style="top:' + (cardTop - 13) + 'px"></div>';
    body += '<div class="card" style="top:' + cardTop + 'px"><img src="' + o.img + '"' +
      (o.zoom ? ' style="transform:scale(' + o.zoom + ')"' : '') + '></div>';
    if (o.rider) body += tapCue(Math.round(75 + o.rider[0] * 0.748), Math.round(cardTop + 7 + o.rider[1] * 0.748), o.tapw);
    else if (o.tap) body += '<div class="tap" style="left:' + o.tap[0] + 'px;top:' + o.tap[1] + 'px"><i></i><i></i><b>TAP</b></div>';
    if (o.signs) body += '<div class="sign s1">' + o.signs[0] + '</div><div class="sign s2">' + o.signs[1] + '</div>';
  } else {
    body = '<div class="tiles" style="top:' + (pl ? pl.card + 6 : 262) + 'px">' + o.tiles.map(function (t, k) {
      var glow = o.fancy ? ';box-shadow:0 0 0 3px #0b3a7a,0 0 16px 6px ' + ['#59f0ff', '#ff8a3d', '#5dff9a', '#b07bff', '#ff6fd8', '#7b8bff'][k] + ',0 10px 22px rgba(8,40,90,.35)' : '';
      return '<div class="tile" style="transform:rotate(' + (k % 2 ? 2 : -2) + 'deg)' + glow + '"><img src="' + t + '"></div>';
    }).join('') + '</div>';
  }
  var pg = '';
  if (pl && o.mascot.img) {
    var tilt = o.mascot.tilt || 0;           // as seen: a flipped picture turns the other way
    pg = '<img class="pg3" src="' + o.mascot.img + '" style="left:' + pl.px + 'px;top:' + pl.py + 'px;width:' + pl.pw +
      'px;height:' + pl.ph + 'px;transform:' + (pl.flip ? 'scaleX(-1) rotate(' + (-tilt) + 'deg)' : 'rotate(' + tilt + 'deg)') + '">';
    if (pl.mode === 'peek') { body = pg + body; pg = lively(pl); }
    else if (pl.mode === 'stand') pg = pg.replace('<img', lively(pl) + '<img');
  }
  else if (pl && !o.mascot.img) pg = '<div class="pg" style="left:' + pl.px + 'px;top:' + pl.py + 'px;transform:' +
    (pl.flip ? 'scaleX(-1) ' : '') + 'rotate(' + (o.mascot.tilt || 4) + 'deg)">' + penguin(o.mascot.pose) + '</div>';
  var extra = '';
  if (o.fancy) {
    extra = '<defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.2" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<linearGradient id="cr" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2f8fe8"/><stop offset=".6" stop-color="#86dcff"/><stop offset="1" stop-color="#effcff"/></linearGradient></defs>' +
      aurora(rnd) + blizzard(rnd) +
      frost(0, 0, 0.9, rnd) + frost(540, 960, Math.PI + 0.9, rnd) +
      crystal(-6, 470, 1.05, 72) + crystal(546, 640, 1.15, -74) + crystal(24, 990, 1.25, 16) + crystal(520, 995, 1.05, -14) +
      (pl ? swirl(pl.px + pl.pw / 2, pl.py + pl.ph / 2) : '') + glints(rnd, 9);
  }
  return '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/font.css"><style>' +
    'html,body{margin:0;width:540px;height:960px;overflow:hidden;font-family:"Baloo 2",sans-serif;background:#6cc7ff}' +
    '.sky{position:absolute;inset:0;background:' + (o.fancy ? 'linear-gradient(180deg,#071c52 0%,#123f99 20%,#2a7fd8 40%,#7fcaf7 64%,#eef9ff 100%)'
      : 'linear-gradient(180deg,#1f7fd6 0%,#4fb6f5 30%,#a9e1ff 62%,#eef9ff 100%)') + '}' +
    'svg.bg,svg.ov{position:absolute;left:0;top:0;width:540px;height:960px}' +
    '.head{position:absolute;left:0;right:0;top:20px;height:230px}' +
    '.card{position:absolute;left:68px;width:404px;height:718px;border-radius:30px;overflow:hidden;' +
      'border:7px solid #fff;box-shadow:0 10px 0 rgba(8,51,110,.35),0 24px 40px rgba(8,40,90,.35);background:#fff}' +
    '.card img{display:block;width:100%;height:100%}' +
    '.tiles{position:absolute;left:26px;right:26px;display:grid;grid-template-columns:1fr 1fr;gap:18px}' +
    '.tile{height:212px;border-radius:24px;overflow:hidden;border:6px solid #fff;' +
      'box-shadow:0 8px 0 rgba(8,51,110,.3),0 16px 28px rgba(8,40,90,.3)}' +
    '.tile img{width:100%;height:100%;object-fit:cover;object-position:50% 58%}' +
    '.pg{position:absolute;width:' + PW + 'px;height:' + PH + 'px;filter:drop-shadow(0 8px 8px rgba(8,40,90,.3))}' +
    '.pg svg{width:100%;height:100%;overflow:visible}' +
    '.pg3{position:absolute;filter:drop-shadow(0 10px 10px rgba(8,40,90,.35)) drop-shadow(0 0 16px rgba(190,240,255,.85))}' +
    '.ring{position:absolute;left:55px;width:430px;height:744px;border-radius:40px;padding:8px;box-sizing:border-box;' +
      'background:conic-gradient(from 200deg,#59f0ff,#7b6bff,#ff5fd2,#ffd84a,#5dff9a,#59f0ff);' +
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;' +
      'filter:drop-shadow(0 0 5px #fff) drop-shadow(0 0 16px rgba(120,230,255,1)) drop-shadow(0 0 26px rgba(255,110,220,.6))}' +
    'svg.cue{position:absolute;left:0;top:0;width:540px;height:960px;overflow:visible}' +
    '.tap{position:absolute;width:0;height:0}' +
    '.tap i{position:absolute;left:-46px;top:-46px;width:92px;height:92px;border-radius:50%;border:5px solid #fff;' +
      'box-shadow:0 0 0 4px rgba(11,58,122,.55);opacity:.95}' +
    '.tap i+i{left:-70px;top:-70px;width:140px;height:140px;opacity:.55}' +
    '.tap b{position:absolute;left:-40px;top:-20px;width:80px;text-align:center;font-size:30px;font-weight:800;color:#fff;' +
      'text-shadow:0 3px 0 #0b3a7a,0 0 8px #0b3a7a}' +
    '.sign{position:absolute;padding:8px 22px 6px;border-radius:14px;font-size:30px;font-weight:800;color:#fff;' +
      'background:linear-gradient(180deg,#b9773d 0%,#8a4f22 100%);border:4px solid #5e3212;' +
      'box-shadow:0 6px 0 #4a270d,0 14px 22px rgba(0,0,0,.35);text-shadow:0 2px 0 #4a270d;white-space:nowrap}' +
    '.s1{left:24px;bottom:58px;transform:rotate(-5deg)}.s2{right:24px;bottom:10px;transform:rotate(4deg)}' +
    '</style></head><body><div class="sky"></div>' +
    '<svg class="bg" viewBox="0 0 540 960">' + icy(rnd) +
      '<path d="M0 640 L90 520 L150 580 L250 430 L330 540 L400 470 L540 600 L540 960 L0 960Z" fill="#e8f6ff" opacity=".9"/>' +
      '<path d="M250 430 L330 540 L300 545 L275 500 L240 520Z M90 520 L150 580 L120 585 L100 560Z M400 470 L540 600 L500 598 L430 520Z" fill="#b7dcf2"/>' +
      '<path d="M0 760 L120 660 L210 730 L330 640 L450 720 L540 680 L540 960 L0 960Z" fill="#fff"/>' + (o.fancy ? '' : shards()) + extra + flakes +
    '</svg>' + body +
    (pl ? '<svg class="ov" viewBox="0 0 540 960" id="head"></svg>' : '<svg class="head" viewBox="0 0 540 230" id="head"></svg>') + pg +
    '<script>' +
    'var L=' + JSON.stringify(o.lines) + ',B=' + JSON.stringify(pl) + ';' +
    'document.fonts.ready.then(function(){var s=document.getElementById("head"),ns="http://www.w3.org/2000/svg";' +
    'function el(n,a){var e=document.createElementNS(ns,n);for(var k in a)e.setAttribute(k,a[k]);s.appendChild(e);return e;}' +
    'function line(t,x,y,size,fill,max,sw,st){var g=el("text",{x:x,y:y,"text-anchor":"middle","font-size":size,"font-weight":800,' +
    'fill:fill,stroke:st||"#0b3a7a","stroke-width":sw===undefined?11:sw,"stroke-linejoin":"round","paint-order":"stroke"});g.textContent=t;' +
    'while(g.getComputedTextLength()>max&&size>18){size-=2;g.setAttribute("font-size",size);}return g;}' +
    'if(B){var x0=B.x0,y0=B.y0,x1=B.x0+B.w,y1=B.y0+B.h,R=30,cx=(x0+x1)/2,m=B.ty,yb1=Math.max(y0+R+4,Math.min(m-16,y1-R-34)),yb2=yb1+30,d;' +
    'if(B.side==="R")d="M"+(x0+R)+" "+y0+"H"+(x1-R)+"A"+R+" "+R+" 0 0 1 "+x1+" "+(y0+R)+"V"+yb1+"L"+B.tx+" "+B.ty+"L"+x1+" "+yb2+' +
      '"V"+(y1-R)+"A"+R+" "+R+" 0 0 1 "+(x1-R)+" "+y1+"H"+(x0+R)+"A"+R+" "+R+" 0 0 1 "+x0+" "+(y1-R)+"V"+(y0+R)+"A"+R+" "+R+" 0 0 1 "+(x0+R)+" "+y0+"Z";' +
    'else d="M"+(x0+R)+" "+y0+"H"+(x1-R)+"A"+R+" "+R+" 0 0 1 "+x1+" "+(y0+R)+"V"+(y1-R)+"A"+R+" "+R+" 0 0 1 "+(x1-R)+" "+y1+"H"+(x0+R)+' +
      '"A"+R+" "+R+" 0 0 1 "+x0+" "+(y1-R)+"V"+yb2+"L"+B.tx+" "+B.ty+"L"+x0+" "+yb1+"V"+(y0+R)+"A"+R+" "+R+" 0 0 1 "+(x0+R)+" "+y0+"Z";' +
    'var g=el("g",{transform:"rotate("+(B.side==="R"?-2:2)+" "+cx+" "+(y0+B.h/2)+")"});' +
    'g.appendChild(el("path",{d:d,fill:"#fff",stroke:"#0b3a7a","stroke-width":6,"stroke-linejoin":"round",style:"filter:drop-shadow(0 6px 0 rgba(6,36,87,.4))"}));' +
    'g.appendChild(line(L[0],cx,y0+70,46,"#1667c9",B.w-44,6,"#fff"));' +
    'var b=line(L[1],cx,y0+134,54,"#ffd84a",B.w-40,10);b.style.filter="drop-shadow(0 4px 0 #062457)";g.appendChild(b);' +
    'if(L[2]){var p=line(L[2],cx,y0+182,21,"#3d6b86",B.w-44,0);g.appendChild(p);' +
    /* too long even small: two rows, split at the space nearest the middle */
    'if(p.getComputedTextLength()>B.w-44){g.removeChild(p);var w=L[2].split(" "),best=1,bd=1e9;' +
    'for(var i=1;i<w.length;i++){var dd=Math.abs(w.slice(0,i).join(" ").length-w.slice(i).join(" ").length);if(dd<bd){bd=dd;best=i;}}' +
    'g.appendChild(line(w.slice(0,best).join(" "),cx,y0+180,20,"#3d6b86",B.w-44,0));g.appendChild(line(w.slice(best).join(" "),cx,y0+204,20,"#3d6b86",B.w-44,0));}}}' +
    'else{var g=el("g",{transform:"rotate(-3 270 120)"});' +
    'g.appendChild(el("path",{d:"M38 108 L506 92 L496 178 L46 192Z",fill:"#1667c9",stroke:"#0b3a7a","stroke-width":5,"stroke-linejoin":"round"}));' +
    'var a=line(L[0],270,82,60,"#ffffff",480),b=line(L[1],270,166,64,"#ffd84a",430);' +
    'a.style.filter=b.style.filter="drop-shadow(0 5px 0 #062457)";g.appendChild(a);g.appendChild(b);' +
    'if(L[2]){var p=line(L[2],270,222,23,"#fff",500,6);}}' +
    'document.title="ready";});' +
    '</script></body></html>';
}

async function main() {
  var langs = process.argv.slice(2);
  if (!langs.length) langs = Object.keys(TEXT);
  /* the raw captures stay in store/promo/.raw (git-ignored); with
     PROMO_REUSE=1 they are used again, to try a new frame quickly */
  var tmp = M.mkdir(path.join(OUT, '.raw'));
  if (!fs.existsSync(path.join(WWW, 'js', 'native.js'))) throw new Error('build www/ first: bash build-android.sh');
  var B = await M.start(WWW, +process.env.PROMO_PORT || 8851, +process.env.PROMO_DPORT || 9351);
  async function scene(file, save, act, wait, then) {
    if (process.env.PROMO_REUSE && fs.existsSync(file)) return file;
    var tab = await B.open(SHAPE, save, APP);
    if (act) await tab.ev(act);
    await M.sleep(wait || 900);
    if (then) { await tab.ev(then); await M.sleep(300); }
    await B.shoot(tab, file);
    await B.close(tab);
    return file;
  }
  function ride(biome, click) {
    return "document.querySelector('" + click + "').click();" + M.RIDE + "(" + biome + ")";
  }
  try {
    /* the 3D penguin for the English set, cut out of the user's art */
    var pg3dFile = path.join(OUT, 'mascot', 'penguin3d.png');
    var pg3d = fs.existsSync(pg3dFile) ? png64(pg3dFile) : null;
    if (pg3d) picSize(pg3dFile);
    /* the worlds, once for every language */
    var tiles = [];
    for (var w = 0; w < WORLDS.length; w++) {
      tiles.push(await scene(path.join(tmp, 'world' + w + '.png'), Object.assign({}, M.SAVE, { lang: 'en', equipped: ['seal', 'puffin', 'otter', 'orca', 'leopard', 'muskox'][w] }),
        ride(WORLDS[w], '#btn-free'), 6000));
    }
    tiles = tiles.map(png64);
    for (var li = 0; li < langs.length; li++) {
      var lang = langs[li], T = TEXT[lang];
      if (!T) { console.error('no captions for ' + lang); continue; }
      var save = Object.assign({}, M.SAVE, { lang: lang });
      var dir = M.mkdir(path.join(OUT, lang)), raw = {};
      raw.tap = await scene(path.join(tmp, lang + '-tap.png'), save, ride('null', '#btn-free'), 6500);
      raw.fish = await scene(path.join(tmp, lang + '-fish.png'), Object.assign({}, save, { equipped: 'seal' }),
        ride('null', '#btn-free'), 9000, 'Game.debug().combo=23');
      raw.rush = await scene(path.join(tmp, lang + '-rush.png'), Object.assign({}, save, { equipped: 'puffin' }), ride('null', '#btn-rush'), 5000);
      raw.market = await scene(path.join(tmp, lang + '-market.png'), save, "document.querySelector('[data-action=\"shop\"]').click()");
      raw.lines = await scene(path.join(tmp, lang + '-lines.png'), save, "document.querySelector('[data-action=\"runs\"]').click()");
      raw.modes = await scene(path.join(tmp, lang + '-modes.png'), save, "document.querySelector('[data-action=\"modes\"]').click()");
      raw.title = await scene(path.join(tmp, lang + '-title.png'), save, null, 1500);
      /* the penguin, in a different place and pose on each */
      var MAS = {
        '01-one-tap': { at: 'TR', pose: 'wave', tilt: -9 }, '02-catch-fish': { at: 'BL', pose: 'fish', tilt: 5 },
        '03-worlds': { at: 'TL', pose: 'cheer', tilt: 8 }, '04-creatures': { at: 'BR', pose: 'point', tilt: -5 },
        '05-time-rush': { at: 'TL', pose: 'point', tilt: 11 }, '06-known-lines': { at: 'TR', pose: 'star', tilt: -5 },
        '07-modes': { at: 'BL', pose: 'cheer', tilt: -4 }, '08-offline': { at: 'TL', pose: 'wave', tilt: 6 }
      };
      var FR = [
        ['01-one-tap', { kind: 'card', img: raw.tap, lines: T.tap, rider: findRider(raw.tap), tapw: T.tapw }],
        ['02-catch-fish', { kind: 'card', img: raw.fish, lines: T.fish }],
        ['03-worlds', { kind: 'worlds', tiles: tiles, lines: T.worlds }],
        ['04-creatures', { kind: 'card', img: raw.market, lines: T.market }],
        ['05-time-rush', { kind: 'card', img: raw.rush, lines: T.rush }],
        ['06-known-lines', { kind: 'card', img: raw.lines, lines: T.lines }],
        ['07-modes', { kind: 'card', img: raw.modes, lines: T.modes, zoom: 1.38 }],
        ['08-offline', { kind: 'card', img: raw.title, lines: T.title, signs: T.signs }]
      ];
      var files = [];
      for (var f = 0; f < FR.length; f++) {
        var o = FR[f][1];
        if (o.img) o.img = png64(o.img);
        o.sub = o.lines.length > 2;
        o.seed = 11 + f * 97;
        o.mascot = MAS[FR[f][0]] ? Object.assign(pg3d ? { img: pg3d } : {}, MAS[FR[f][0]]) : null;
        o.fancy = true;
        var tab = await B.open(SHAPE, save);
        await tab.ev("document.open();document.write(" + JSON.stringify(frame(o)) + ");document.close();1");
        for (var k = 0; k < 50 && (await tab.ev('document.title')).result.value !== 'ready'; k++) await M.sleep(100);
        await M.sleep(200);
        var file = path.join(dir, FR[f][0] + '.png');
        await B.shoot(tab, file);
        await B.close(tab);
        files.push(file);
      }
      M.flatten(files);
      console.log('  ' + lang + ': ' + files.length + ' pictures');
    }
  } finally {
    B.stop();
  }
}

/* store/poster.js borrows the penguin and the ice */
module.exports = { penguin: penguin, icy: icy, shards: shards, flakeSvg: flakeSvg };
if (require.main === module) main().catch(function (e) { console.error(e); process.exit(1); });
