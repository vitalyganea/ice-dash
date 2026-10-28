/* ===========================================================
   store/poster.js — one promotional poster, 2400x3000 (4:5)
   -----------------------------------------------------------
   Two real screenshots, untouched: A, Freeride with the seal, and B,
   Time Rush with the seal, both 1080x1920 from Chrome at a phone's size.
   Around them: the game's own logo, the penguin from store/promo.js
   pointing up at A and saying "ONE TAP. ENDLESS ICE!", a Time Rush
   callout by B, and ice all round.

   The screenshots are never drawn by the page. Chrome renders the poster
   with only their frames in it; python then pastes each screenshot into
   its frame at 1:1, and the script checks every pixel of both against
   the files they came from. So nothing in the art can cover them, and
   no scaling or colour step can touch them.
     node store/poster.js
   Writes store/promo/poster-en.png (24-bit, no alpha).
   =========================================================== */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var M = require('../tools/media-lib.js');
var A = require('./promo.js');
var ROOT = path.join(__dirname, '..'), RAW = path.join(__dirname, 'promo', '.raw');
var OUT = path.join(__dirname, 'promo', 'poster-en.png');
var SHAPE = { width: 540, height: 960, deviceScaleFactor: 2, mobile: true };

/* Where the screenshots go, in poster pixels (css pixels x2). */
var SA = { x: 100, y: 80 }, SB = { x: 1240, y: 1000 }, SW = 1080, SH = 1920;

function poster(logo) {
  var seed = 29;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var flakes = '';
  for (var i = 0; i < 60; i++) {
    flakes += '<circle cx="' + (rnd() * 540).toFixed(1) + '" cy="' + (rnd() * 675).toFixed(1) + '" r="' + (0.8 + rnd() * 2.6).toFixed(1) +
      '" fill="#fff" opacity="' + (0.45 + rnd() * 0.5).toFixed(2) + '"/>';
  }
  /* snowy rocks at the edges, under everything else */
  function rock(x, y, w, h, flip) {
    return '<g transform="translate(' + x + ' ' + y + ')' + (flip ? ' scale(-1 1)' : '') + '">' +
      '<path d="M0 ' + h + ' L' + (w * 0.08) + ' ' + (h * 0.35) + ' L' + (w * 0.4) + ' 0 L' + (w * 0.78) + ' ' + (h * 0.2) + ' L' + w + ' ' + h + 'Z" fill="#7d93ad"/>' +
      '<path d="M' + (w * 0.4) + ' 0 L' + (w * 0.78) + ' ' + (h * 0.2) + ' L' + w + ' ' + h + ' L' + (w * 0.55) + ' ' + h + 'Z" fill="#5b7190"/>' +
      '<path d="M' + (w * 0.06) + ' ' + (h * 0.42) + ' Q' + (w * 0.25) + ' ' + (h * 0.05) + ' ' + (w * 0.4) + ' 0 Q' + (w * 0.6) + ' ' + (h * 0.04) + ' ' + (w * 0.78) + ' ' + (h * 0.2) +
      ' Q' + (w * 0.62) + ' ' + (h * 0.34) + ' ' + (w * 0.45) + ' ' + (h * 0.24) + ' Q' + (w * 0.28) + ' ' + (h * 0.46) + ' ' + (w * 0.06) + ' ' + (h * 0.42) + 'Z" fill="#fff"/></g>';
  }
  /* the frames: a white edge outside each screenshot, its own soft shadow
     and a blue glow; the screenshot itself is pasted in later */
  function frameBox(s) {
    return '<div class="fr" style="left:' + (s.x / 2 - 9) + 'px;top:' + (s.y / 2 - 9) + 'px"></div>';
  }
  var stopwatch = '<svg viewBox="0 0 100 110" class="sw"><defs><radialGradient id="swF" cx=".4" cy=".35" r=".75">' +
    '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d7f7e6"/></radialGradient></defs>' +
    '<rect x="40" y="2" width="20" height="14" rx="4" fill="#18b562" stroke="#0b3a7a" stroke-width="5"/>' +
    '<path d="M78 22 l10 -10" stroke="#0b3a7a" stroke-width="9" stroke-linecap="round"/>' +
    '<circle cx="50" cy="62" r="42" fill="#2fd17e" stroke="#0b3a7a" stroke-width="6"/>' +
    '<circle cx="50" cy="62" r="31" fill="url(#swF)"/>' +
    '<path d="M50 62 V40" stroke="#0b3a7a" stroke-width="6" stroke-linecap="round"/><path d="M50 62 L66 70" stroke="#0b3a7a" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="50" cy="62" r="4.5" fill="#0b3a7a"/><path d="M30 44 A28 28 0 0 1 46 35" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/></svg>';
  /* speed lines behind the penguin */
  var streaks = '<svg class="streaks" viewBox="0 0 300 240">' +
    [[20, 60, 120], [0, 110, 150], [30, 160, 110], [60, 205, 80]].map(function (q) {
      return '<path d="M' + q[0] + ' ' + q[1] + ' q' + (q[2] / 2) + ' -10 ' + q[2] + ' 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"/>';
    }).join('') + '</svg>';
  return '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/font.css"><style>' +
    'html,body{margin:0;width:1200px;height:1500px;overflow:hidden;font-family:"Baloo 2",sans-serif;background:#4fb6f5}' +
    '.sky{position:absolute;inset:0;background:linear-gradient(170deg,#1b6fd0 0%,#3aa7f0 28%,#8fd8ff 60%,#e9f8ff 100%)}' +
    'svg.bg,svg.ov{position:absolute;left:0;top:0;width:1200px;height:1500px}' +
    '.fr{position:absolute;width:' + (SW / 2 + 18) + 'px;height:' + (SH / 2 + 18) + 'px;border-radius:26px;' +
      'background:linear-gradient(160deg,#ffffff,#d9f1ff);' +
      'box-shadow:0 0 0 4px #0b3a7a,0 14px 0 rgba(8,51,110,.35),0 30px 50px rgba(8,40,90,.35),0 0 90px 20px rgba(150,230,255,.75)}' +
    '.logo{position:absolute;left:688px;top:10px;width:420px;filter:drop-shadow(0 10px 12px rgba(6,36,87,.35))}' +
    '.pg{position:absolute;left:26px;top:1214px;width:290px;height:273px;filter:drop-shadow(0 10px 10px rgba(8,40,90,.35)) drop-shadow(0 0 14px rgba(170,235,255,.9))}' +
    '.pg svg{width:100%;height:100%;overflow:visible}' +
    '.streaks{position:absolute;left:-30px;top:1270px;width:130px;height:104px}' +
    '.sw{position:absolute;left:628px;top:332px;width:120px;height:132px;filter:drop-shadow(0 0 18px rgba(80,255,160,.9)) drop-shadow(0 6px 0 rgba(6,36,87,.4))}' +
    '</style></head><body><div class="sky"></div>' +
    '<svg class="bg" viewBox="0 0 540 675" preserveAspectRatio="none">' + A.icy(rnd) +
      '<path d="M0 470 L80 380 L140 430 L240 300 L320 400 L400 330 L540 440 L540 675 L0 675Z" fill="#e8f6ff" opacity=".9"/>' +
      '<path d="M240 300 L320 400 L292 404 L268 362 L232 384Z M80 380 L140 430 L112 434 L94 412Z M400 330 L540 440 L500 438 L430 380Z" fill="#b7dcf2"/>' +
      '<path d="M0 560 L120 480 L210 540 L330 470 L450 530 L540 500 L540 675 L0 675Z" fill="#fff"/>' +
      '<g transform="translate(0 -297)">' + A.shards() + '</g>' + rock(-10, 600, 90, 70, false) + rock(470, 590, 80, 80, true) + flakes +
    '</svg>' + frameBox(SA) + frameBox(SB) +
    '<img class="logo" src="' + logo + '">' + streaks +
    '<svg class="ov" viewBox="0 0 1200 1500" id="ov"></svg>' + stopwatch +
    '<div class="pg">' + A.penguin('present', [3, -7]) + '</div>' +
    '<script>' +
    'document.fonts.ready.then(function(){var s=document.getElementById("ov"),ns="http://www.w3.org/2000/svg";' +
    'function el(n,a,p){var e=document.createElementNS(ns,n);for(var k in a)e.setAttribute(k,a[k]);(p||s).appendChild(e);return e;}' +
    'function text(t,x,y,size,fill,max,p,sw,anchor){var g=el("text",{x:x,y:y,"text-anchor":anchor||"middle","font-size":size,"font-weight":800,' +
    'fill:fill,stroke:"#0b3a7a","stroke-width":sw||12,"stroke-linejoin":"round","paint-order":"stroke"},p);g.textContent=t;' +
    'while(g.getComputedTextLength()>max&&size>18){size-=2;g.setAttribute("font-size",size);}return g;}' +
    /* DODGE. SLIDE. SURVIVE. — three words stepping down to the right */
    'var d=el("g",{transform:"rotate(-3 320 1080)",style:"filter:drop-shadow(0 5px 0 #062457)"});' +
    'text("DODGE.",40,1094,58,"#ffffff",180,d,11,"start");text("SLIDE.",232,1094,58,"#8fe9ff",160,d,11,"start");text("SURVIVE.",404,1094,58,"#ffd84a",200,d,11,"start");' +
    /* RACE AGAINST TIME! on a green pill by the stopwatch */
    'var r=el("g",{transform:"rotate(-3 900 400)"});' +
    'el("rect",{x:700,y:356,width:460,height:92,rx:46,fill:"#2fd17e",stroke:"#0b3a7a","stroke-width":6,style:"filter:drop-shadow(0 6px 0 rgba(6,36,87,.45)) drop-shadow(0 0 22px rgba(80,255,160,.8))"},r);' +
    'el("rect",{x:716,y:364,width:428,height:24,rx:12,fill:"#fff",opacity:".28"},r);' +
    'text("RACE AGAINST TIME!",938,420,46,"#ffffff",400,r,9);' +
    /* the speech bubble: icy blue, white text, ENDLESS ICE! in yellow */
    'var x0=300,y0=1196,w=300,h=190,R=34,tx=262,ty=1300,b=el("g",{transform:"rotate(-2 450 1291)"});' +
    'el("defs",{},b).innerHTML=\'<linearGradient id="bb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4cc3ff"/><stop offset="1" stop-color="#1268cf"/></linearGradient>\';' +
    'var x1=x0+w,y1=y0+h,yb1=y0+70,yb2=y0+112;' +
    'el("path",{d:"M"+(x0+R)+" "+y0+"H"+(x1-R)+"A"+R+" "+R+" 0 0 1 "+x1+" "+(y0+R)+"V"+(y1-R)+"A"+R+" "+R+" 0 0 1 "+(x1-R)+" "+y1+"H"+(x0+R)+' +
      '"A"+R+" "+R+" 0 0 1 "+x0+" "+(y1-R)+"V"+yb2+"L"+tx+" "+ty+"L"+x0+" "+yb1+"V"+(y0+R)+"A"+R+" "+R+" 0 0 1 "+(x0+R)+" "+y0+"Z",' +
      'fill:"url(#bb)",stroke:"#fff","stroke-width":7,"stroke-linejoin":"round",' +
      'style:"filter:drop-shadow(0 0 0 #0b3a7a) drop-shadow(3px 0 0 #0b3a7a) drop-shadow(-3px 0 0 #0b3a7a) drop-shadow(0 3px 0 #0b3a7a) drop-shadow(0 -3px 0 #0b3a7a) drop-shadow(0 8px 0 rgba(6,36,87,.45))"},b);' +
    'el("path",{d:"M"+(x0+30)+" "+(y0+16)+"H"+(x1-30),stroke:"#fff","stroke-width":8,"stroke-linecap":"round",opacity:".4"},b);' +
    'var l1=text("ONE TAP.",x0+w/2,y0+80,58,"#ffffff",250,b,12),l2=text("ENDLESS ICE!",x0+w/2,y0+152,58,"#ffd84a",262,b,12);' +
    'l1.style.filter=l2.style.filter="drop-shadow(0 5px 0 #062457)";' +
    'document.title="ready";});' +
    '</script></body></html>';
}

(async function main() {
  M.mkdir(RAW);
  var B = await M.start(ROOT, 8881, 9381);
  var rawA = path.join(RAW, 'en-fish.png'), rawB = path.join(RAW, 'en-rush-seal.png'), bare = path.join(RAW, 'poster-bare.png');
  try {
    var save = Object.assign({}, M.SAVE, { lang: 'en', equipped: 'seal' });
    async function scene(file, click, wait, then) {
      if (fs.existsSync(file)) return;
      var tab = await B.open(SHAPE, save);
      await tab.ev("document.querySelector('" + click + "').click();" + M.RIDE + "(null)");
      await M.sleep(wait);
      if (then) { await tab.ev(then); await M.sleep(300); }
      await B.shoot(tab, file);
      await B.close(tab);
    }
    await scene(rawA, '#btn-free', 9000, 'Game.debug().combo=23');
    await scene(rawB, '#btn-rush', 5000);
    var logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'img', 'logo.png')).toString('base64');
    var tab = await B.open({ width: 1200, height: 1500, deviceScaleFactor: 2, mobile: false }, save);
    await tab.ev("document.open();document.write(" + JSON.stringify(poster(logo)) + ");document.close();1");
    for (var k = 0; k < 60 && (await tab.ev('document.title')).result.value !== 'ready'; k++) await M.sleep(100);
    await M.sleep(300);
    await B.shoot(tab, bare);
    await B.close(tab);
  } finally {
    B.stop();
  }
  /* the screenshots go in at 1:1, then every pixel is checked */
  var py = "import sys\nfrom PIL import Image, ImageChops\n" +
    "bare, a, b, out = sys.argv[1:5]; ax, ay, bx, by = map(int, sys.argv[5:9])\n" +
    "im = Image.open(bare).convert('RGB'); A = Image.open(a).convert('RGB'); B = Image.open(b).convert('RGB')\n" +
    "assert im.size == (2400, 3000), im.size\nassert A.size == B.size == (1080, 1920), (A.size, B.size)\n" +
    "im.paste(A, (ax, ay)); im.paste(B, (bx, by)); im.save(out, optimize=True)\n" +
    "chk = Image.open(out).convert('RGB')\n" +
    "for src, x, y, n in ((A, ax, ay, 'A'), (B, bx, by, 'B')):\n" +
    "  diff = ImageChops.difference(chk.crop((x, y, x + 1080, y + 1920)), src).getbbox()\n" +
    "  print('screenshot ' + n + ': ' + ('pixel-identical' if diff is None else 'DIFFERS at ' + str(diff)))\n";
  var res = cp.execFileSync('python3', ['-c', py, bare, rawA, rawB, OUT, SA.x, SA.y, SB.x, SB.y].map(String)).toString();
  process.stdout.write(res);
  console.log('  ' + OUT);
})().catch(function (e) { console.error(e); process.exit(1); });
