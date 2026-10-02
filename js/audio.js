/* ===========================================================
   audio.js — sounds and music synthesised with WebAudio (no files)
   =========================================================== */
var Sfx = (function () {
  var ctx = null, master = null, sfxBus = null, musBus = null;
  var sfxOn = true, musOn = true;
  var platformOn = true;          // YouTube's own audio setting — overrides everything
  var musicTimer = null, step = 0, nextTime = 0;

  /* The hill's own tempo, and the one it runs at while a snow rush is on.
     The whole arrangement doubles up for those six seconds and drops back
     when they are over — making the fast version the default turned the
     background of a quiet game into a chase. */
  var STEP_CALM = 0.16, STEP_HOT = 0.126;
  var hot = false;
  var LOOKAHEAD = 0.25;          // how far ahead notes get scheduled

  function init() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();  master.gain.value = platformOn ? 0.85 : 0; master.connect(ctx.destination);
    sfxBus = ctx.createGain();  sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musBus = ctx.createGain();  musBus.gain.value = 0.0;  musBus.connect(master);
  }

  function resume() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  /* ---------- a simple enveloped tone ---------- */
  function tone(o) {
    if (!sfxOn || !platformOn || !ctx) return;
    var t0   = ctx.currentTime + (o.delay || 0);
    var dur  = o.dur || 0.12;
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    var v = (o.vol == null ? 0.3 : o.vol);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(sfxBus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  function noise(dur, vol, freq) {
    if (!sfxOn || !platformOn || !ctx) return;
    var t0 = ctx.currentTime;
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = freq || 900;
    var g = ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(flt); flt.connect(g); g.connect(sfxBus);
    src.start(t0);
  }

  /* ---------- sound effects ---------- */
  var api = {
    unlock: resume,
    turn:   function(){ tone({ freq:420, to:620, dur:0.08, type:'sine', vol:0.16 });
                        noise(0.07, 0.07, 1400); },
    gold:   function(){ [784,1046,1318,1760].forEach(function(f,i){
                          tone({ freq:f, dur:0.2, type:'triangle', vol:0.24, delay:i*0.055 }); }); },
    bubble: function(){ tone({ freq:300, to:900, dur:0.3, type:'sine', vol:0.22 });
                        tone({ freq:1200, dur:0.18, type:'sine', vol:0.14, delay:0.12 }); },
    pop:    function(){ tone({ freq:900, to:200, dur:0.22, type:'sine', vol:0.24 });
                        noise(0.18, 0.16, 1100); },
    berry:  function(){ tone({ freq:880, dur:0.07, type:'triangle', vol:0.22 });
                        tone({ freq:1318, dur:0.12, type:'triangle', vol:0.18, delay:0.05 }); },
    gate:   function(){ [659,880,1174].forEach(function(f,i){
                          tone({ freq:f, dur:0.13, type:'triangle', vol:0.2, delay:i*0.05 }); }); },
    zone:   function(){ [523,659,784,1046].forEach(function(f,i){
                          tone({ freq:f, dur:0.22, type:'sine', vol:0.2, delay:i*0.09 }); }); },
    bank:   function(){ noise(0.12, 0.12, 500); },
    crash:  function(){ tone({ freq:240, to:60, dur:0.4, type:'sawtooth', vol:0.26 });
                        noise(0.36, 0.24, 320); },
    click:  function(){ tone({ freq:700, to:1000, dur:0.06, type:'square', vol:0.16 }); },
    locked: function(){ tone({ freq:180, dur:0.1, type:'square', vol:0.2 }); },
    /* hitting a ramp: a scrape that slides upward into the launch */
    jump:   function(){ noise(0.1, 0.1, 900);
                        tone({ freq:330, to:880, dur:0.22, type:'triangle', vol:0.2 }); },
    /* coming back down: a thump with a spray of snow behind it */
    land:   function(){ tone({ freq:200, to:110, dur:0.16, type:'sine', vol:0.24 });
                        noise(0.16, 0.14, 420); }
  };

  /* ---------- background music ----------
     C - G - Am - F throughout. Two gaits over it: at rest, one sustained
     chord a bar with a sparse melody over a half-time bass; while rushing,
     the bass walks in eighths, the chords become short stabs off the beat,
     the melody fills in and a dry tick marks the offbeats. */
  var CHORDS = [[220.00,261.63,329.63], [174.61,220.00,261.63],
                [261.63,329.63,392.00], [196.00,246.94,293.66]];
  /* root, fifth and the octave above, so the bass can bounce between them */
  var BASS   = [[110.00,164.81,220.00], [ 87.31,130.81,174.61],
                [130.81,196.00,261.63], [ 98.00,146.83,196.00]];
  var BASS_FIG = [0, 2, 1, 2, 0, 1, 2, 1];            // which of the three, per step
  /* 32 steps, C major pentatonic. The calm line breathes; the rushing one
     fills the gaps in and adds a couple of runs. */
  var MEL = [659.25,0,0,587.33,0,523.25,0,0,
             493.88,0,0,440.00,0,0,523.25,0,
             587.33,0,0,659.25,0,783.99,0,0,
             659.25,0,587.33,0,523.25,0,0,0];
  var MEL_HOT = [659.25,0,587.33,523.25,0,587.33,659.25,0,
                 523.25,493.88,0,440.00,493.88,0,523.25,0,
                 587.33,659.25,0,783.99,0,659.25,587.33,0,
                 523.25,587.33,659.25,0,587.33,523.25,0,440.00];
  /* a dry tick on the off-eighths, just enough to feel a pulse */
  var TICK = [0,1,0,1,0,1,0,1];

  function playNote(freq, time, dur, type, vol) {
    var osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(vol, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g); g.connect(musBus);
    osc.start(time); osc.stop(time + dur + 0.05);
  }

  function schedule() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      var bar = Math.floor(step / 8) % 4;
      var beat = step % 8;

      if (hot) {
        /* a quieter pad, with stabs on and off the beat over it */
        if (beat === 0)
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 1.0, 'sine', 0.030); });
        if (beat === 0 || beat === 3 || beat === 6)
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 0.14, 'triangle', 0.045); });
        playNote(BASS[bar][BASS_FIG[beat]], nextTime, 0.17, 'triangle', 0.095);
        var mh = MEL_HOT[step % 32];
        if (mh) playNote(mh, nextTime, 0.19, 'triangle', 0.072);
        if (TICK[beat]) playNote(2093.00, nextTime, 0.035, 'square', 0.012);
      } else {
        if (beat === 0)                                   // sustained chord
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 1.15, 'sine', 0.055); });
        if (beat % 2 === 0)                               // bass, half time
          playNote(BASS[bar][0], nextTime, 0.26, 'triangle', 0.10);
        var m = MEL[step % 32];
        if (m) playNote(m, nextTime, 0.22, 'triangle', 0.075);
      }

      nextTime += (hot ? STEP_HOT : STEP_CALM);
      step = (step + 1) % 32;
    }
  }

  function startMusic() {
    resume();
    if (!ctx || musicTimer) return;
    step = 0; nextTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(schedule, 60);
    musBus.gain.cancelScheduledValues(ctx.currentTime);
    musBus.gain.setValueAtTime(musBus.gain.value, ctx.currentTime);
    musBus.gain.linearRampToValueAtTime(musOn ? 0.5 : 0, ctx.currentTime + 1.2);
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    if (ctx) {
      musBus.gain.cancelScheduledValues(ctx.currentTime);
      musBus.gain.setValueAtTime(musBus.gain.value, ctx.currentTime);
      musBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
    }
  }

  api.music = function (on) {
    musOn = on;
    if (on) startMusic(); else stopMusic();
  };
  api.sound  = function (on) { sfxOn = on; };

  /* Doubles the gait while a snow rush is on. It takes effect within
     LOOKAHEAD, a quarter of a second, because notes are scheduled ahead —
     which is about as sharp as it should be anyway. */
  api.excite = function (on) { hot = !!on; };

  /* Driven by ytgame.system.isAudioEnabled / onAudioEnabledChange.
     When YouTube has audio off nothing may be output, whatever the in-game
     toggles say (Integration req. 5). */
  api.platformAudio = function (on) {
    platformOn = !!on;
    if (!ctx) return;
    var t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(platformOn ? 0.85 : 0, t + 0.15);
  };
  api.isPlatformAudio = function () { return platformOn; };
  api.isMusic = function () { return musOn; };
  api.isSound = function () { return sfxOn; };

  return api;
})();
