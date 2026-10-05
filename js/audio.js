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
    /* a frozen find straining: a tone rising under a crackle */
    charge: function(){ tone({ freq:180, to:720, dur:1.3, type:'triangle', vol:0.12 });
                        [0.3, 0.6, 0.85, 1.05].forEach(function (d) {
                          tone({ freq:2200, to:1400, dur:0.05, type:'square', vol:0.05, delay:d }); }); },
    /* and giving: a low thump with the shell scattering */
    boom:   function(){ tone({ freq:140, to:45, dur:0.45, type:'sine', vol:0.32 });
                        noise(0.4, 0.22, 2400); },
    /* a new best: a short rising fanfare */
    fanfare:function(){ [523,659,784,1046,1318].forEach(function(f,i){
                          tone({ freq:f, dur:0.22, type:'triangle', vol:0.2, delay:i*0.08 }); }); },
    /* coming back down: a thump with a spray of snow behind it */
    /* the avalanche, far behind: a low roll of thunder in the snow */
    rumble: function(v){ v = v || 1;
                         tone({ freq:58, to:36, dur:1.5, type:'sine', vol:0.13 * v });
                         noise(1.3, 0.09 * v, 85); },
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

  /* ---------- moods ----------
     The three newest stretches each get a tune of their own, so arriving in
     one is heard as well as seen. Everywhere else keeps the hill's own.
     A mood swaps the harmony, the line over it and how the line sounds;
     the gaits (calm and rushing) work the same over all of them. */
  var LEAD = 'triangle', LEAD_DUR = 0.22, LEAD_VOL = 0.075;
  var PAD = 'sine', BASSW = 'triangle', TEMPO = 1;

  /* Note names to pitch, so a tune can be written the way it is read:
     'A4' is 440, sharps with #, flats with b. */
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function hz(n) {
    var m = /^([A-G])([#b]?)(\d)$/.exec(n);
    var semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3]) * 12;
    return Math.round(440 * Math.pow(2, (semi - 57) / 12) * 100) / 100;
  }
  /* 32 steps in one string; '-' is a rest */
  function line(str) { return str.trim().split(/\s+/).map(function (t) { return t === '-' ? 0 : hz(t); }); }
  /* four chords (or four bass triads), '|' between bars */
  function bars(str) { return str.split('|').map(function (b) { return b.trim().split(/\s+/).map(hz); }); }
  /* The rushing line, when a tune does not write its own: each rest on a
     beat picks up the note before it, so the same melody runs twice as busy. */
  function busy(mel) {
    var out = mel.slice(), last = 0;
    for (var i = 0; i < out.length; i++) {
      if (out[i]) last = out[i];
      else if (i % 2 === 0 && last) out[i] = last;
    }
    return out;
  }

  var MOODS = {
    base: { chords: CHORDS, bass: BASS, mel: MEL, hot: MEL_HOT,
            lead: 'triangle', dur: 0.22, vol: 0.075 },
    /* D dorian, plucked short like a marimba: warm and busy */
    jungle: {
      chords: [[146.83,174.61,220.00], [130.81,164.81,196.00],
               [116.54,146.83,174.61], [130.81,164.81,196.00]],
      bass:   [[ 73.42,110.00,146.83], [ 65.41, 98.00,130.81],
               [ 58.27, 87.31,116.54], [ 65.41, 98.00,130.81]],
      mel: [587.33,0,698.46,0,783.99,0,698.46,587.33,
            0,523.25,0,587.33,0,698.46,0,0,
            880.00,0,783.99,0,698.46,0,587.33,0,
            523.25,0,587.33,0,0,698.46,587.33,0],
      hot: [587.33,698.46,783.99,698.46,880.00,783.99,698.46,587.33,
            523.25,587.33,698.46,587.33,523.25,0,587.33,0,
            880.00,783.99,880.00,1046.50,880.00,783.99,698.46,587.33,
            523.25,587.33,698.46,783.99,698.46,587.33,523.25,0],
      lead: 'triangle', dur: 0.12, vol: 0.085 },
    /* open, high and slow: long sine notes with room between them */
    cosmic: {
      chords: [[261.63,329.63,493.88], [220.00,293.66,440.00],
               [196.00,246.94,392.00], [174.61,261.63,349.23]],
      bass:   [[130.81,196.00,261.63], [110.00,164.81,220.00],
               [ 98.00,146.83,196.00], [ 87.31,130.81,174.61]],
      mel: [987.77,0,0,0,0,0,880.00,0,
            0,0,783.99,0,0,0,0,0,
            1174.66,0,0,0,987.77,0,0,0,
            880.00,0,0,0,0,0,0,0],
      hot: [987.77,0,880.00,0,783.99,0,880.00,0,
            987.77,0,1174.66,0,987.77,0,880.00,0,
            1318.51,0,1174.66,0,987.77,0,880.00,0,
            783.99,0,880.00,0,987.77,0,0,0],
      lead: 'sine', dur: 0.62, vol: 0.06 },
    /* E minor, struck like small bells that ring on in the dark */
    caves: {
      chords: [[164.81,196.00,246.94], [130.81,164.81,196.00],
               [146.83,185.00,220.00], [123.47,155.56,185.00]],
      bass:   [[ 82.41,123.47,164.81], [ 65.41, 98.00,130.81],
               [ 73.42,110.00,146.83], [ 61.74, 92.50,123.47]],
      mel: [659.25,0,0,783.99,0,0,987.77,0,
            0,880.00,0,0,783.99,0,0,0,
            659.25,0,0,587.33,0,0,659.25,0,
            0,0,493.88,0,0,0,0,0],
      hot: [659.25,0,783.99,0,987.77,0,880.00,0,
            783.99,0,659.25,0,587.33,0,659.25,0,
            987.77,0,880.00,0,783.99,0,659.25,0,
            587.33,0,493.88,0,587.33,0,659.25,0],
      lead: 'sine', dur: 0.5, vol: 0.07 },

    /* ---- one for every other stretch, so each is heard as well as seen.
       Pine Forest, where every run starts, keeps the hill's own tune. ---- */

    /* Rocky Pass, warm stone in a low sun: G mixolydian, sturdy and
       plucked, a little quicker than the hill's own */
    rocky: {
      chords: bars('G3 B3 D4 | F3 A3 C4 | C4 E4 G4 | G3 B3 D4'),
      bass:   bars('G2 D3 G3 | F2 C3 F3 | C3 G3 C4 | G2 D3 G3'),
      mel: line('G4 - B4 D5 - C5 B4 -   A4 - F4 - A4 C5 - -   E5 - D5 C5 - G4 - -   B4 - A4 G4 - - - -'),
      lead: 'square', dur: 0.12, vol: 0.032, tempo: 0.94 },
    /* Arctic Shelf, polar noon: A major, high and airy, nothing hurried */
    arctic: {
      chords: bars('A3 C#4 E4 | F#3 A3 C#4 | D4 F#4 A4 | E3 G#3 B3'),
      bass:   bars('A2 E3 A3 | F#2 C#3 F#3 | D3 A3 D4 | E2 B2 E3'),
      mel: line('E5 - - A5 - - G#5 -   F#5 - - - E5 - - -   D5 - F#5 - A5 - - -   G#5 - - B5 - - - -'),
      lead: 'sine', dur: 0.42, vol: 0.065, tempo: 1.08 },
    /* Glacier, where the ice is glass: F# minor, quick high notes that
       ring like a wet finger on a glass rim */
    glacier: {
      chords: bars('F#3 A3 C#4 | D3 F#3 A3 | A3 C#4 E4 | E3 A3 B3'),
      bass:   bars('F#2 C#3 F#3 | D2 A2 D3 | A2 E3 A3 | E2 B2 E3'),
      mel: line('C#6 - A5 - F#5 - A5 -   D6 - A5 - F#5 - D5 -   E5 - A5 - C#6 - E6 -   B5 - A5 - E5 - - -'),
      lead: 'sine', dur: 0.3, vol: 0.05, tempo: 1.02, pad: 'triangle' },
    /* Ashfall, a glacier over a volcano: D phrygian, low and heavy, the
       bass with an edge on it */
    ashfall: {
      chords: bars('D3 F3 A3 | Eb3 G3 Bb3 | D3 F3 A3 | C3 E3 G3'),
      bass:   bars('D2 A2 D3 | Eb2 Bb2 Eb3 | D2 A2 D3 | C2 G2 C3'),
      mel: line('A4 - - Bb4 A4 - G4 -   F4 - - - G4 - - -   A4 - D5 - C5 - A4 -   G4 - F4 - E4 - - -'),
      lead: 'triangle', dur: 0.32, vol: 0.075, tempo: 1.14, bassWave: 'sawtooth' },
    /* Midwinter at dusk, the pines loaded with snow: F major, warm and
       rocking like a lullaby */
    midwinter: {
      chords: bars('F3 A3 C4 | D3 F3 A3 | Bb3 D4 F4 | C4 E4 G4'),
      bass:   bars('F2 C3 F3 | D2 A2 D3 | Bb2 F3 Bb3 | C3 G3 C4'),
      mel: line('C5 - A4 - F4 - A4 -   D5 - - C5 A4 - - -   Bb4 - D5 - F5 - D5 -   C5 - E5 - G5 - - -'),
      lead: 'sine', dur: 0.36, vol: 0.07, tempo: 1.04 },
    /* Night Run: B minor, slow and far apart, the dark between the notes */
    night: {
      chords: bars('B2 D3 F#3 | G2 B2 D3 | E3 G3 B3 | F#3 A#3 C#4'),
      bass:   bars('B1 F#2 B2 | G1 D2 G2 | E2 B2 E3 | F#2 C#3 F#3'),
      mel: line('F#5 - - - - - B4 -   - - D5 - - - C#5 -   B4 - - - - - F#4 -   - - A#4 - - - - -'),
      lead: 'sine', dur: 0.7, vol: 0.06, tempo: 1.2 },
    /* Emberflow, the mountain on fire: C minor, driving, square and
       sawtooth, the quickest tune on the hill */
    ember: {
      chords: bars('C3 Eb3 G3 | Ab2 C3 Eb3 | Bb2 D3 F3 | G2 B2 D3'),
      bass:   bars('C2 G2 C3 | Ab1 Eb2 Ab2 | Bb1 F2 Bb2 | G1 D2 G2'),
      mel: line('C5 - Eb5 - G5 - Eb5 C5   Ab4 - C5 - Eb5 - C5 -   Bb4 - D5 - F5 - D5 Bb4   G4 - B4 - D5 - - -'),
      lead: 'square', dur: 0.11, vol: 0.03, tempo: 0.88, bassWave: 'sawtooth' },
    /* Hollyfrost, noon and rowan berries: G major on high bells */
    holly: {
      chords: bars('G3 B3 D4 | E3 G3 B3 | C4 E4 G4 | D4 F#4 A4'),
      bass:   bars('G2 D3 G3 | E2 B2 E3 | C3 G3 C4 | D3 A3 D4'),
      mel: line('B5 - G5 - D5 - G5 -   E5 - G5 - B5 - - -   C6 - B5 - A5 - G5 -   A5 - F#5 - D5 - - -'),
      lead: 'sine', dur: 0.48, vol: 0.055, tempo: 1.0, pad: 'triangle' },
    /* Everwinter, moonlight and no wind: E dorian, almost nothing moving,
       long notes held in the cold */
    ever: {
      chords: bars('E3 G3 B3 | A3 C#4 E4 | G3 B3 D4 | D3 F#3 A3'),
      bass:   bars('E2 B2 E3 | A2 E3 A3 | G2 D3 G3 | D2 A2 D3'),
      mel: line('B4 - - - - - - -   E5 - - - G5 - F#5 -   - - - - B4 - - -   A4 - - - D5 - - -'),
      lead: 'sine', dur: 0.9, vol: 0.055, tempo: 1.25 }
  };
  var mood = 'base';
  function setMood(name) {
    var m = MOODS[name] || MOODS.base;
    mood = MOODS[name] ? name : 'base';
    CHORDS = m.chords; BASS = m.bass; MEL = m.mel; MEL_HOT = m.hot || busy(m.mel);
    LEAD = m.lead; LEAD_DUR = m.dur; LEAD_VOL = m.vol;
    PAD = m.pad || 'sine'; BASSW = m.bassWave || 'triangle'; TEMPO = m.tempo || 1;
  }

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
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 1.0, PAD, 0.030); });
        if (beat === 0 || beat === 3 || beat === 6)
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 0.14, 'triangle', 0.045); });
        playNote(BASS[bar][BASS_FIG[beat]], nextTime, 0.17, BASSW, BASSW === 'sawtooth' ? 0.05 : 0.095);
        var mh = MEL_HOT[step % 32];
        if (mh) playNote(mh, nextTime, Math.min(0.19, LEAD_DUR), LEAD, LEAD_VOL * 0.96);
        if (TICK[beat]) playNote(2093.00, nextTime, 0.035, 'square', 0.012);
      } else {
        if (beat === 0)                                   // sustained chord
          CHORDS[bar].forEach(function (f) { playNote(f, nextTime, 1.15 * TEMPO, PAD, PAD === 'sine' ? 0.055 : 0.04); });
        if (beat % 2 === 0)                               // bass, half time
          playNote(BASS[bar][0], nextTime, 0.26, BASSW, BASSW === 'sawtooth' ? 0.055 : 0.10);
        var m = MEL[step % 32];
        if (m) playNote(m, nextTime, LEAD_DUR, LEAD, LEAD_VOL);
      }

      nextTime += (hot ? STEP_HOT : STEP_CALM) * TEMPO;
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
  /* The stretch of hill decides the tune. Takes effect on the next note. */
  api.mood = function (name) { if ((MOODS[name] ? name : 'base') !== mood) setMood(name); };

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
