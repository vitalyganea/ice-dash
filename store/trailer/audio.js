/* ===========================================================
   store/trailer/audio.js — the trailer's sound, from the game itself
   -----------------------------------------------------------
   The music is the game's own (js/audio.js, synthesised as it plays), so
   it is recorded as it plays: every connection to the speakers is also
   sent to a tap that keeps the samples themselves (Chrome's MediaRecorder
   dropped forty seconds from the middle of a take), written out as a WAV,
   and the tune is steered along the trailer's
   timeline — the tune of each world as its pictures come up, the doubled
   gait of a snow rush, a sound of the game's on each cut.
     node store/trailer/audio.js <cues.json> <out.wav>
   cues.json: { "secs": 30, "cues": [[t, "js to run"], ...] }
   =========================================================== */
var fs = require('fs'), path = require('path');
var M = require('../../tools/media-lib.js');
var ROOT = path.join(__dirname, '..', '..');

/* before the page: whatever goes to the speakers goes to the recorder too */
var TAP = "(function(){var P=AudioNode.prototype,c0=P.connect;window.__rec=null;" +
  "P.connect=function(dst){var r=c0.apply(this,arguments);" +
  "if(dst instanceof AudioDestinationNode){var ctx=this.context;if(!ctx.__tap){ctx.__tap=ctx.createMediaStreamDestination();}" +
  "c0.call(this,ctx.__tap);window.__tapCtx=ctx;}return r;};})();";

(async function () {
  var spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), out = process.argv[3];
  var L = await M.start(ROOT, 8796, 9796);
  try {
    var save = Object.assign({}, M.SAVE, { lang: 'en', sfx: true, music: true });
    var tab = await L.open({ width: 540, height: 960, deviceScaleFactor: 1, mobile: true }, save, TAP);
    /* a real tap, so the page may make sound */
    await L.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 10, y: 10, button: 'left', clickCount: 1 }, tab.sid);
    await L.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 10, y: 10, button: 'left', clickCount: 1 }, tab.sid);
    await tab.ev("Sfx.platformAudio&&Sfx.platformAudio(true);Sfx.sound(true);Sfx.music(false);1");
    await M.sleep(500);
    /* the tap: a script processor on the speakers' copy keeps every block
       of samples, both channels, from the moment the take starts */
    var start = "(function(){var ctx=window.__tapCtx;if(!ctx)return 'no context';ctx.resume();" +
      "var src=ctx.createMediaStreamSource(ctx.__tap.stream),sp=ctx.createScriptProcessor(4096,2,2),mute=ctx.createGain();mute.gain.value=0;" +
      "window.__L=[];window.__R=[];window.__n=0;sp.onaudioprocess=function(e){var a=e.inputBuffer;" +
      "__L.push(new Float32Array(a.getChannelData(0)));__R.push(new Float32Array(a.getChannelData(a.numberOfChannels>1?1:0)));__n+=a.length;};" +
      "src.connect(sp);sp.connect(mute);mute.connect(ctx.destination);window.__sr=ctx.sampleRate;window.__t0=performance.now();" +
      "var cues=" + JSON.stringify(spec.cues) + ";" +
      "cues.forEach(function(c){setTimeout(function(){try{(0,eval)(c[1]);}catch(e){console.log('cue '+c[1]+': '+e);}},c[0]*1000);});return ctx.state+' '+ctx.sampleRate;})()";
    console.log('start: ' + (await tab.ev(start)).result.value);
    await M.sleep(spec.secs * 1000 + 300);
    /* the samples as 16-bit PCM, sent over in pieces */
    var info = (await tab.ev("(function(){window.__rec=null;var n=__n,sr=__sr,i16=new Int16Array(n*2),o=0;" +
      "for(var b=0;b<__L.length;b++){var l=__L[b],r=__R[b];for(var k=0;k<l.length;k++){i16[o++]=Math.max(-32768,Math.min(32767,l[k]*32767));i16[o++]=Math.max(-32768,Math.min(32767,r[k]*32767));}}" +
      "window.__pcm=new Uint8Array(i16.buffer);return JSON.stringify({n:n,sr:sr,secs:n/sr,wall:(performance.now()-__t0)/1000});})()")).result.value;
    info = JSON.parse(info);
    console.log('took ' + info.secs.toFixed(2) + ' s of sound in ' + info.wall.toFixed(2) + ' s');
    var parts = [], CH = 1 << 20;
    for (var o = 0; o < info.n * 4; o += CH) {
      var b64 = (await tab.ev("(function(){var u=__pcm.subarray(" + o + "," + (o + CH) + "),s='';for(var i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s);})()")).result.value;
      parts.push(Buffer.from(b64, 'base64'));
    }
    var pcm = Buffer.concat(parts), hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
    hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(info.sr, 24);
    hdr.writeUInt32LE(info.sr * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(out, Buffer.concat([hdr, pcm]));
    console.log('wrote ' + out + ' (' + fs.statSync(out).size + ' bytes)');
    await L.close(tab);
  } finally { await L.stop(); }
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(1); });
