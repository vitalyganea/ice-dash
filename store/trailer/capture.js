/* ===========================================================
   store/trailer/capture.js — the trailer's gameplay, frame by frame
   -----------------------------------------------------------
   Every clip is the real game in Chrome at a 1080x1920 phone, but not
   recorded as it plays: the run is paused and moved on by hand, two of
   the game's own 60 Hz steps for each picture, so the clip is a smooth
   30 frames a second whatever the machine is doing. A steady rider (the
   one from tools/media-lib.js, here asked once a step) keeps him alive
   and on the line; he cannot be knocked off.
     node store/trailer/capture.js [clip ...]     all clips, or some
   Writes <OUT>/<clip>/00001.jpg ... (OUT: env TRAILER_FRAMES, default
   /tmp/icedash-trailer). Needs Chrome, like tools/media-lib.js.
   =========================================================== */
var fs = require('fs'), path = require('path');
var M = require('../../tools/media-lib.js');
var ROOT = path.join(__dirname, '..', '..');
var OUT = process.env.TRAILER_FRAMES || '/tmp/icedash-trailer';
var SHAPE = { width: 540, height: 960, deviceScaleFactor: 2, mobile: true };

/* name: { biome, skin, secs, mode ('rush' | 'avalanche' | null), warm: steps run before the first picture } */
var CLIPS = {
  pine:      { biome: 0,  skin: 'snowcap', secs: 4.5, warm: 200 },
  ember:     { biome: 7,  skin: 'seal',    secs: 3.2, warm: 260 },
  neon:      { biome: 13, skin: 'orca',    secs: 3.2, warm: 260 },
  caves:     { biome: 12, skin: 'puffin',  secs: 3.2, warm: 260 },
  cosmic:    { biome: 11, skin: 'leopard', secs: 3.2, warm: 260 },
  jungle:    { biome: 10, skin: 'otter',   secs: 3.2, warm: 260 },
  night:     { biome: 6,  skin: 'mitten',  secs: 3.2, warm: 260 },
  glacier:   { biome: 3,  skin: 'muskox',  secs: 3.2, warm: 260 },
  rush:      { biome: 0,  skin: 'snowcap', secs: 4.0, warm: 150, mode: 'rush' },
  avalanche: { biome: null, skin: 'lemming', secs: 4.0, warm: 240, mode: 'avalanche' }
};

/* A rider who plays like a person, asked once a step: he turns only when
   staying would miss the next opening, a moment after seeing it, and not
   again for a third of a second or so, so the line is a run of smooth
   arcs instead of the steady rider's twitch (60 turns in 4.5 s). Counted
   in steps and seeded by them, so a clip comes out the same every time.
   Nothing can knock him off (invuln), and in the avalanche run the snow
   is held at the bottom of the picture, coming up as the clip goes on. */
var RIDER = "window.__rider={s:0,next:0,due:0};window.__rideStep=function(biome,av){var W=Game.debug();if(!W||W.state!=='run')return;" +
  "var R=__rider;R.s++;if(biome!==null){W.biome=biome;W.biomeT=600;}W.invuln=30;" +
  "var C=Game._consts();if(av){W.avGap=Math.max(70,(C.VIEW_H-C.PLAYER_Y)*(0.95-0.4*Math.min(1,R.s/av)));}" +
  "if(R.due){if(R.s>=R.due){R.due=0;R.next=R.s+16+(R.s*7919)%14;Game.tap();}return;}if(R.s<R.next)return;" +
  "var r=null;for(var i=0;i<W.rows.length;i++)if(W.rows[i].d>W.dist+20){r=W.rows[i];break;}if(!r)return;" +
  "var DR=C.DRIFT,PR=C.PR||14,c=Game._chuteAt(r.d)+r.gap,fr=Math.max(1,Math.round((r.d-W.dist)/W.speed)),tr=Game._turnRate();" +
  "function at(d){var x=W.px,v=W.vx;for(var k=0;k<fr;k++){v+=(d*DR*W.speed-v)*tr;x+=v;}return x;}" +
  "var tol=Math.max(6,r.gapW/2-PR-10),stay=Math.abs(at(W.dir)-c),turn=Math.abs(at(-W.dir)-c);" +
  "if(stay>tol&&turn<stay)R.due=R.s+4+(R.s*104729)%7;};";
/* no pause button in the pictures */
var PRE = "document.addEventListener('DOMContentLoaded',function(){var s=document.createElement('style');" +
  "s.textContent='#btn-menu,.pause-btn{display:none!important}';document.head.appendChild(s);});";

(async function () {
  var want = process.argv.slice(2), names = want.length ? want : Object.keys(CLIPS);
  var L = await M.start(ROOT, 8795, 9795);
  try {
    for (var name of names) {
      var c = CLIPS[name];
      if (!c) { console.log('no clip ' + name); continue; }
      var dir = path.join(OUT, name);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      var save = Object.assign({}, M.SAVE, { lang: 'en', equipped: c.skin, gfx: { fx: 0, res: 0 }, sfx: false, music: false });
      var tab = await L.open(SHAPE, save, PRE);
      await tab.ev(RIDER + "1");
      if (c.mode) await tab.ev("document.querySelector('[data-action=\"" + c.mode + "\"]').click();1");
      else await tab.ev("document.getElementById('btn-free').click();1");
      await M.sleep(1200);
      /* from here the hill moves only when told to */
      await tab.ev("Game.pause();1");
      var B = (c.biome === null || c.biome === undefined ? 'null' : c.biome) + (c.mode === 'avalanche' ? ',' + (c.warm + Math.round(c.secs * 60)) : '');
      await tab.ev("(function(){for(var i=0;i<" + c.warm + ";i++){__rideStep(" + B + ");Game._step(1);}Game._render();return 1;})()");
      var n = Math.round(c.secs * 30), log = [];
      for (var f = 1; f <= n; f++) {
        /* what happened in this picture, for the sounds and the close-ups:
           the way he faces, the fish, gold, gates, jumps and perfect lines
           so far, and where he is on the screen (css px of 540x960) */
        var st = (await tab.ev("(function(){for(var i=0;i<2;i++){__rideStep(" + B + ");Game._step(1);}Game._render();" +
          "var W=Game.debug(),p=Game._screen(W.px,W.dist),C=Game._consts();" +
          "return [W.dir,W.fish,W.gold,W.gates,W.jumps,W.perfects,Math.round(p.x*innerWidth/C.VIEW_W),Math.round(p.y*innerHeight/C.VIEW_H)];})()")).result.value;
        log.push(st);
        var shot = await L.cdp('Page.captureScreenshot', { format: 'jpeg', quality: 92 }, tab.sid);
        fs.writeFileSync(path.join(dir, String(f).padStart(5, '0') + '.jpg'), Buffer.from(shot.result.data, 'base64'));
      }
      fs.writeFileSync(path.join(dir, 'log.json'), JSON.stringify(log));
      var st = (await tab.ev("JSON.stringify({b:Game.debug()&&Game.debug().biome,s:Game.debug()&&Game.debug().state,mode:Game.debug()&&Game.debug().mode})")).result.value;
      console.log(name + ': ' + n + ' frames ' + st);
      await L.close(tab);
    }
  } finally { await L.stop(); }
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
