/* ===========================================================
   ui.js — menus, best score, Playables lifecycle
   =========================================================== */
(function () {
  'use strict';

  var LOAD_TIMEOUT = 3000;
  var SAVE_KEY = 'icedash-save-v1';
  /* The game used to be called Pine Rush. Anyone who played it then still
     has their fish under the old key, so read it once if the new one is
     empty. Only matters outside Playables, where the cloud save is keyed
     by the game rather than by this string. */
  var OLD_KEYS = ['pinerush-save-v1'];
  var IN_YT = !!(window.ytgame && window.ytgame.IN_PLAYABLES_ENV);

  /* -------------------------- saving ------------------------- */
  /* Declared above adopt(), which clamps a loaded save against the cap. */
  var LIFE_PRICE = 250, LIFE_CAP = 5;
  /* What comes out of a frozen find, by weight. Fish most of the time; the
     spare life is the thing worth chasing, and it is rare enough that it
     never becomes the way you stock up — the market is. */
  var FIND_PRIZES = [
    { w: 32, kind: 'fish', n: 50 },
    { w: 25, kind: 'fish', n: 100 },
    { w: 16, kind: 'fish', n: 200 },
    { w: 13, kind: 'gold', n: 1 },
    { w: 9,  kind: 'life', n: 1 },
    { w: 5,  kind: 'gold', n: 3 }
  ];

  function defaults() {
    return { best: 0, runs: 0, sfx: true, music: true,
             fish: 0, gold: 0, owned: ['snowcap'], equipped: 'snowcap',
             lang: detectLang(),
             /* Trophy progress is kept as running totals rather than being
                worked out from history, so a goal can show how far along you
                are at any moment and not only when it ticks over. */
             ach: [], claimed: [], totFish: 0, totGold: 0, totGates: 0, totJumps: 0,
             totSaves: 0, bestDist: 0, bestRunFish: 0,
             /* spare lives bought at the market, and unopened finds */
             lives: 0, finds: 0, totRevives: 0,
             totFinds: 0, totRushes: 0, totSmashed: 0, totForks: 0,
             /* stars earned per marked run, by id */
             courses: {},
             /* the first-run tutorial has been finished or skipped */
             tutDone: false,
             /* Time Rush keeps its own best, in metres, and the clocks taken */
             bestRush: 0, totClocks: 0,
             /* Avalanche: its own best in metres, and the rings that held it back */
             bestAv: 0, totAvRings: 0,
             /* the Daily Line: today's stars, and the run of days finished */
             daily: { key: '', stars: 0 }, dailyLast: '', dailyStreak: 0,
             dailyBest: 0, dailyDays: 0,
             /* today's three tasks and which are done */
             tasks: { key: '', done: [] },
             /* a short buzz on a phone for the big moments */
             vibrate: true,
             /* What the badges have already shown: the creatures seen on the
                shelf while affordable, and the day More modes was last opened.
                A badge says something new, and looking at it puts it out. */
             marketSeen: [], modesSeen: '',
             /* per creature: running totals and how many of its three
                stories are open (album.js) */
             album: {},
             /* the creatures whose comic has been read through (or skipped) */
             comicSeen: {} };
  }
  var save = defaults();
  var canSave = false, saving = false, saveAgain = false;

  function adopt(raw) {
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return;
      save.best  = Math.max(0, parseInt(o.best, 10) || 0);
      save.runs  = Math.max(0, parseInt(o.runs, 10) || 0);
      save.sfx   = o.sfx !== false;
      save.music = o.music !== false;
      save.vibrate = o.vibrate !== false;
      save.fish  = Math.max(0, parseInt(o.fish, 10) || 0);
      save.gold  = Math.max(0, parseInt(o.gold, 10) || 0);
      /* Only ids this build actually knows about survive the load, so a save
         written by a later version cannot equip a skin that is not here. */
      save.owned = ['snowcap'];
      if (Object.prototype.toString.call(o.owned) === '[object Array]')
        for (var i = 0; i < o.owned.length; i++)
          if (SKIN_BY_ID[o.owned[i]] && save.owned.indexOf(o.owned[i]) < 0)
            save.owned.push(o.owned[i]);
      save.equipped = (SKIN_BY_ID[o.equipped] && save.owned.indexOf(o.equipped) >= 0)
                    ? o.equipped : 'snowcap';
      if (o.lang) save.lang = o.lang;                // unknown ids fall back inside setLang
      ['totFish','totGold','totGates','totJumps','totSaves','bestDist','bestRunFish',
       'totRevives','totFinds','totRushes','totSmashed','totForks','bestRush','totClocks','bestAv','totAvRings',
       'dailyStreak','dailyBest','dailyDays']
        .forEach(function (k) { save[k] = Math.max(0, parseInt(o[k], 10) || 0); });
      /* Both are capped on load as well as on purchase: a hand-edited save
         should not be able to hand out a hundred lives. */
      save.lives = Math.max(0, Math.min(LIFE_CAP, parseInt(o.lives, 10) || 0));
      save.tutDone = o.tutDone === true;
      save.dailyLast = typeof o.dailyLast === 'string' ? o.dailyLast : '';
      save.marketSeen = Object.prototype.toString.call(o.marketSeen) === '[object Array]'
                      ? o.marketSeen.filter(function (id) { return !!SKIN_BY_ID[id]; }) : [];
      save.modesSeen = typeof o.modesSeen === 'string' ? o.modesSeen : '';
      save.comicSeen = {};
      if (o.comicSeen && typeof o.comicSeen === 'object')
        for (var cid2 in o.comicSeen) if (SKIN_BY_ID[cid2] && o.comicSeen[cid2]) save.comicSeen[cid2] = true;
      save.album = {};
      if (o.album && typeof o.album === 'object')
        for (var aid in o.album) {
          if (!SKIN_BY_ID[aid] || !o.album[aid] || typeof o.album[aid] !== 'object') continue;
          var src = o.album[aid], dst = albumOf(save, aid);
          for (var ak in dst) dst[ak] = Math.max(0, parseInt(src[ak], 10) || 0);
          dst.got = Math.min(3, dst.got);
        }
      save.tasks = (o.tasks && typeof o.tasks.key === 'string' && o.tasks.done && o.tasks.done.length !== undefined)
                 ? { key: o.tasks.key, done: o.tasks.done.filter(function (x) { return typeof x === 'string'; }).slice(0, 3) }
                 : { key: '', done: [] };
      save.daily = (o.daily && typeof o.daily.key === 'string')
                 ? { key: o.daily.key, stars: Math.max(0, Math.min(3, parseInt(o.daily.stars, 10) || 0)) }
                 : { key: '', stars: 0 };
      save.finds = Math.max(0, Math.min(99, parseInt(o.finds, 10) || 0));
      save.courses = {};
      if (o.courses && typeof o.courses === 'object')
        for (var cid in o.courses)
          if (courseById(cid))
            save.courses[cid] = Math.max(0, Math.min(3, parseInt(o.courses[cid], 10) || 0));
      save.ach = [];
      if (Object.prototype.toString.call(o.ach) === '[object Array]')
        for (var j = 0; j < o.ach.length; j++)
          for (var q = 0; q < ACHIEVEMENTS.length; q++)
            if (ACHIEVEMENTS[q].id === o.ach[j] && save.ach.indexOf(o.ach[j]) < 0)
              save.ach.push(o.ach[j]);
      /* Trophies were paid the moment they were earned until claiming came
         in, so a save from before it has been paid for every one it holds. */
      save.claimed = Object.prototype.toString.call(o.claimed) === '[object Array]'
                   ? o.claimed.filter(function (id) { return save.ach.indexOf(id) >= 0; })
                   : save.ach.slice();
    } catch (e) { /* a corrupt save just falls back to the defaults */ }
  }
  function loadSave() {
    if (IN_YT) {
      return Promise.race([
        window.ytgame.game.loadData().then(adopt, function () {}),
        new Promise(function (r) { setTimeout(r, LOAD_TIMEOUT); })
      ]);
    }
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      for (var i = 0; !raw && i < OLD_KEYS.length; i++) raw = localStorage.getItem(OLD_KEYS[i]);
      adopt(raw);
    } catch (e) {}
    return Promise.resolve();
  }
  function store() {
    if (!canSave) return;
    if (saving) { saveAgain = true; return; }
    var data = JSON.stringify(save);
    if (!IN_YT) { try { localStorage.setItem(SAVE_KEY, data); } catch (e) {} return; }
    saving = true;
    window.ytgame.game.saveData(data).then(done, function () {
      window.ytgame.game.saveData(data).then(done, done);
    });
    function done() { saving = false; pushScore(); if (saveAgain) { saveAgain = false; store(); } }
  }
  var lastSent = -1;
  function pushScore() {
    if (!IN_YT || !window.ytgame.engagement) return;
    if (save.best === lastSent) return;
    lastSent = save.best;
    window.ytgame.engagement.sendScore({ value: save.best })
      .then(null, function () { lastSent = -1; });
  }

  /* ------------------------- elements ------------------------ */
  var $ = function (id) { return document.getElementById(id); };
  var screens = { title: $('screen-title'), help: $('screen-help'),
                  pause: $('screen-pause'), over: $('screen-over'),
                  shop: $('screen-shop'), settings: $('screen-settings'),
                  ach: $('screen-ach'), runs: $('screen-runs'), modes: $('screen-modes'), comic: $('screen-comic'),
                  revive: $('screen-revive'), tutdone: $('screen-tutdone') };
  var hud = $('hud');
  var currentScreen = 'title';

  /* The screens that carry the always-visible back arrow. Every one of
     them already has a Back button; on the long ones it is a scroll away. */
  var BACKABLE = { help: 1, shop: 1, runs: 1, ach: 1, settings: 1, modes: 1 };
  var justOpened = false;
  function show(name) {
    closeSheet();
    currentScreen = name;
    for (var k in screens) screens[k].classList.toggle('hidden', k !== name);
    /* The pause button belongs to play and nothing else. This used to be
       written the other way round, so show('game') hid it — which happened
       whenever a run started before loadData() came back, taking away the
       only way to pause for the rest of that run. */
    hud.classList.toggle('hidden', name !== 'game');
    $('btn-back').classList.toggle('hidden', !BACKABLE[name]);
    tutChrome();
    if (name === 'tutdone')
      $('tutdone-go').textContent = t('tut.done.go', { n: t('course.' + COURSES[0].id + '.name') });
    if (name === 'help') buildHints();
    if (name === 'shop') { buildShop(); seeMarket(); }
    if (name === 'settings') buildSettings();
    if (name === 'ach') { buildTasks(); buildAch(); }
    if (name === 'runs') buildRuns();
    if (name === 'modes') {
      if (save.modesSeen !== dailyKey()) { save.modesSeen = dailyKey(); store(); }
      refreshModes();
    }
    if (name === 'title') {
      refreshModes();
      $('market-badge').classList.toggle('hidden', !marketNews().length);
      $('ach-badge').classList.toggle('hidden', !achUnclaimed(save).length);
      /* today's tasks, as a line on the title that opens the list */
      var tchip = $('title-tasks'), nd = todaysDone().length;
      tchip.classList.toggle('hidden', !freeUnlocked());
      tchip.textContent = nd >= 3 ? t('tasks.chip.all') : t('tasks.chip', { a: nd, b: 3 });
      tchip.classList.toggle('all-done', nd >= 3);
      /* The first time the modes open, they say so on the title too. */
      if (justOpened) {
        justOpened = false;
        ['btn-free', 'btn-more'].forEach(function (id) {
          var b = $(id); if (!b) return;
          b.classList.remove('just-opened'); void b.offsetWidth; b.classList.add('just-opened');
          setTimeout(function () { b.classList.remove('just-opened'); }, 4200);
        });
      }
      var el = $('title-best');
      $('bp-lab').textContent = t('title.best.lab');
      $('bp-num').textContent = num(save.best);
      $('bp-unit').textContent = t('title.best.unit');
      el.setAttribute('aria-label', t('title.best', { n: save.best }));
      el.classList.toggle('hidden', save.best <= 0);
    }
  }
  /* The pictures in How to play: the actual objects off the hill, painted
     by the game's own painters into a canvas on each line. Built when the
     panel opens rather than at boot, for two reasons — a hidden panel has
     no layout, so there is nothing to measure the canvas against, and
     applyI18n writes innerHTML over these same elements on every language
     change, which would throw the canvases away. */
  function buildHints() {
    if (!window.Game || !Game.drawHint) return;
    var els = document.querySelectorAll('#screen-help li[data-hint]');
    for (var i = 0; i < els.length; i++) {
      var li = els[i], kind = li.getAttribute('data-hint');
      if (li.firstChild && li.firstChild.className === 'hint-ico') continue;
      var txt = document.createElement('span');
      txt.className = 'hint-txt';
      txt.innerHTML = li.innerHTML;
      var cv = document.createElement('canvas');
      cv.className = 'hint-ico';
      cv.setAttribute('aria-hidden', 'true');
      li.textContent = '';
      li.appendChild(cv);
      li.appendChild(txt);
      /* Sized by the stylesheet, which knows about small screens; read
         back rather than guessed at. */
      var box = Math.round(cv.getBoundingClientRect().width) || 50;
      if (kind === 'skin') Game.drawSkinPreview(cv, save.equipped, box);
      else Game.drawHint(cv, kind, box);
    }
  }

  function showGame() { show('game'); }

  /* --------------------------- game -------------------------- */
  var lastCourse = null, lastMode = null;
  function ride(courseId, mode) {
    pendingRes = null;
    if (tickT) { clearInterval(tickT); tickT = null; }
    lastCourse = courseId || null;
    lastMode = (!courseId && mode) || null;
    showGame();
    Sfx.unlock();
    hideLesson(); waitingFor = null;
    /* Each mode is measured against its own best: Time Rush in metres. */
    Game.start(lastMode === 'rush' ? save.bestRush : lastMode === 'avalanche' ? save.bestAv : save.best,
               { hud: function () {}, over: onOver, lesson: onLesson, fx: onFx },
               save.equipped, lastCourse, save.lives || 0, { mode: lastMode });
    tutChrome();
  }

  /* ------------------------ the tutorial ---------------------- */
  /* A brand-new player is dropped straight into it; anyone can ride it
     again from How to play. The engine says what to teach and when; this
     only puts the words on screen. */
  function inTutorial() { return lastCourse === 'tutorial' && Game.hasRun(); }
  function tutChrome() {
    var on = currentScreen === 'game' && inTutorial();
    $('tut-skip').classList.toggle('hidden', !on);
    if (!on) $('tut').classList.add('hidden');
    /* Back from the pause screen with the hill still waiting for a tap:
       the line that asked for it has to come back too, or the player is
       left looking at a frozen hill with no idea why. */
    else if (waitingFor) onLesson(waitingFor);
  }
  var tutHideT = null, waitingFor = null;
  function hideLesson() {
    if (tutHideT) { clearTimeout(tutHideT); tutHideT = null; }
    $('tut').classList.add('hidden');
  }
  function onLesson(m) {
    waitingFor = (m && m.wait) ? m : null;
    if (!m || !m.key) { hideLesson(); return; }
    if (tutHideT) { clearTimeout(tutHideT); tutHideT = null; }
    var box = $('tut'), card = $('tut-card'), ico = $('tut-ico'), tap = $('tut-tap');
    $('tut-text').innerHTML = t(m.key);           // our own strings, some with <b>
    var hint = m.hint && Game.drawHint;
    ico.classList.toggle('hidden', !hint);
    if (hint) Game.drawHint(ico, m.hint, 52);
    card.classList.toggle('tut-ok', !!m.ok);
    /* The hand only while the hill is waiting for a tap, with an arrow the
       way the tap will send him. */
    tap.classList.toggle('hidden', !m.wait);
    tap.classList.toggle('to-left', m.want < 0);
    tap.classList.toggle('to-right', m.want > 0);
    box.classList.remove('hidden');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    if (!m.wait) tutHideT = setTimeout(hideLesson, m.ok ? 1200 : m.key === 'tut.oops' ? 1800 : 4200);
  }
  /* Done is done, finished or skipped: it is never forced on anyone twice. */
  function endTutorial() {
    save.tutDone = true;
    waitingFor = null;
    hideLesson();
    store();
  }
  function finishTutorial(res) {
    /* The fish he picked up on the way are his. Nothing else is counted:
       a lesson is not a run, so no best, no trophies, no stars. */
    save.fish += res.coins || 0;
    save.gold += res.gold || 0;
    endTutorial();
    var bits = [];
    if (res.coins) bits.push('+' + res.coins + ' ' + t('cur.fish'));
    if (res.gold)  bits.push('+' + res.gold + ' ' + t('cur.gold'));
    $('tutdone-earned').textContent = bits.join('   ');
    $('tutdone-earned').classList.toggle('hidden', !bits.length);
    Game.stop();
    lastCourse = null;
    show('tutdone');
  }
  function skipTutorial() {
    Game.stop();
    lastCourse = null;
    endTutorial();
    show('title');
  }

  /* A crash with a life in hand is not the end of the run, so nothing may be
     banked yet: the result is held until the player picks. Committing here
     and rolling back afterwards would double-count fish and trophies. */
  var pendingRes = null;
  function onOver(res) {
    if (res.course === 'tutorial') { finishTutorial(res); return; }
    if (res.canRevive) { pendingRes = res; showRevive(); return; }
    commitRun(res);
  }

  function showRevive() {
    var n = save.lives || 0;
    $('revive-count').textContent = t('revive.left', { n: n });
    var hs = $('revive-hearts');
    hs.textContent = '';
    for (var i = 0; i < Math.min(5, n); i++) {
      var h = document.createElement('span');
      h.className = 'heart';
      hs.appendChild(h);
    }
    $('revive-tick').classList.add('hidden');
    $('revive-buttons').classList.remove('hidden');
    Game.pause();
    show('revive');
  }

  /* Back into a paused run, carrying whatever was bought while it waited.
     The menu is where lives and animals come from, so a run you can pause
     and shop from has to pick up what you did there. */
  function carryOn() {
    if (Game.syncFromSave) Game.syncFromSave(save.lives || 0, save.equipped);
    showGame();
    Game.resume();
  }

  var tickT = null;
  function useLife() {
    if ((save.lives || 0) <= 0) { noLife(); return; }
    $('revive-buttons').classList.add('hidden');
    var el = $('revive-tick');
    el.classList.remove('hidden');
    var n = 3;
    el.textContent = String(n);
    Sfx.click();
    if (tickT) clearInterval(tickT);
    tickT = setInterval(function () {
      n--;
      if (n > 0) { el.textContent = String(n); Sfx.click(); return; }
      clearInterval(tickT); tickT = null;
      el.textContent = t('revive.go');
      save.lives = Math.max(0, (save.lives || 0) - 1);
      store();
      pendingRes = null;
      if (Game.revive()) { showGame(); Game.resume(); }
      else { commitRun(pendingRes || { score: 0, dist: 0, fish: 0, gold: 0 }); }
    }, 800);
  }
  function noLife() {
    if (tickT) { clearInterval(tickT); tickT = null; }
    var r = pendingRes; pendingRes = null;
    commitRun(r || { score: 0, dist: 0, fish: 0, gold: 0, coins: 0 });
  }

  function commitRun(res) {
    var wasOpen = freeUnlocked();
    save.runs++;
    /* A marked run has its own scoreboard: stars, not distance. The freeride
       best must not be moved by a course, or a short course would look like
       a bad run forever. */
    var cd = res.course ? courseById(res.course) : null;
    var stars = cd ? courseStars(cd, res) : 0;
    /* The Daily Line keeps its own stars, for today only, and a streak of
       days finished; it never touches the marked lines' board. */
    var streakNow = 0, starPay = 0;
    if (cd && cd.daily) {
      starPay = dailyStarPay(save.equipped, stars, res.finished);
      save.fish += starPay;
      var today = dailyKey();
      if (!save.daily || save.daily.key !== today) save.daily = { key: today, stars: 0 };
      if (stars > save.daily.stars) save.daily.stars = stars;
      if (res.finished && save.dailyLast !== today) {
        save.dailyStreak = save.dailyLast === dailyPrevKey(today) ? (save.dailyStreak || 0) + 1 : 1;
        save.dailyLast = today;
        save.dailyDays = (save.dailyDays || 0) + 1;
        save.dailyBest = Math.max(save.dailyBest || 0, save.dailyStreak);
      }
      streakNow = save.dailyLast === today ? save.dailyStreak : 0;
    } else if (cd) {
      if (stars > (save.courses[cd.id] || 0)) save.courses[cd.id] = stars;
    }
    var rushRun = res.mode === 'rush', avRun = res.mode === 'avalanche';
    var mRun = rushRun || avRun;                     // scored in metres
    var beat = !cd && !mRun && res.score > save.best;
    if (beat) save.best = res.score;
    /* Time Rush is scored in metres, on a board of its own. */
    if (rushRun) {
      beat = res.dist > (save.bestRush || 0);
      if (beat) save.bestRush = res.dist;
      save.totClocks = (save.totClocks || 0) + (res.clocks || 0);
    }
    /* So is Avalanche, on another. */
    if (avRun) {
      beat = res.dist > (save.bestAv || 0);
      if (beat) save.bestAv = res.dist;
      save.totAvRings = (save.totAvRings || 0) + (res.gates || 0);
    }
    save.fish += res.coins || 0;
    save.gold += res.gold || 0;
    save.totFish  += res.fish  || 0;
    save.totGold  += res.gold  || 0;
    save.totGates += res.gates || 0;
    save.totJumps += res.jumps || 0;
    save.totSaves += res.saved || 0;
    save.bestDist    = Math.max(save.bestDist, res.dist || 0);
    save.bestRunFish = Math.max(save.bestRunFish, res.fish || 0);
    save.finds = Math.min(99, (save.finds || 0) + (res.finds || 0));
    save.totRevives += res.revives || 0;
    save.totRushes  += res.rushes  || 0;
    save.totSmashed += res.smashed || 0;
    save.totForks   += res.forks   || 0;
    var taskWon = (res.course === 'tutorial') ? [] : tasksCheck(save, res, dailyKey());
    albumAdd(save, save.equipped, res);              // the creature that rode it
    var storyWon = albumCheck(save, save.equipped);  // pays its chapters' fish
    var won = achCheck(save);
    store();
    showWon(won, taskWon, storyWon);
    var earned = $('over-earned');
    var bits = [];
    if (res.coins) bits.push('+' + res.coins + ' ' + t('cur.fish'));
    if (starPay) bits.push(t('over.starpay', { n: starPay }));
    if (res.gold)  bits.push('+' + res.gold + ' ' + t('cur.gold'));
    earned.textContent = bits.join('   ');
    earned.classList.toggle('hidden', !bits.length);
    $('new-best').classList.toggle('hidden', !beat);
    /* What you are carrying into the next one. Spare lives were invisible
       everywhere except the market and the moment you spent one. */
    var lv = $('over-lives'), nLives = save.lives || 0;
    lv.classList.toggle('hidden', nLives <= 0);
    if (nLives > 0) {
      lv.textContent = '';
      for (var li = 0; li < Math.min(5, nLives); li++) {
        var hh = document.createElement('span');
        hh.className = 'heart';
        lv.appendChild(hh);
      }
      var lab = document.createElement('span');
      lab.className = 'over-lives-txt';
      lab.textContent = t('over.lives', { n: nLives });
      lv.appendChild(lab);
    }
    document.querySelector('#screen-over .panel-title-text').textContent =
      t(rushRun ? 'over.timeup' : res.caught ? 'over.caught' : res.finished ? 'over.finish' : 'over.title');
    var st = $('over-stars');
    st.classList.toggle('hidden', !cd);
    if (cd) st.textContent = '★★★☆☆☆'.slice(3 - stars, 6 - stars);
    /* Retry re-runs the same course; on freeride it is a fresh hill. */
    var again = document.querySelector('#screen-over [data-action="play"], #screen-over [data-action="retry"]');
    again.setAttribute('data-action', (cd || mRun) ? 'retry' : 'play');
    again.textContent = t(cd ? 'btn.retry' : 'btn.again');
    $('over-score').textContent = mRun ? res.dist + ' ' + t('unit.m')
                                          : t('over.points', { n: res.score });
    var bits = [res.dist + ' ' + t('unit.m'), t('unit.fish') + ': ' + res.fish];
    if (res.gold)  bits.push(t('unit.golden') + ': ' + res.gold);
    if (res.gates) bits.push(t('unit.gates') + ': ' + res.gates);
    if (res.saved) bits.push(t('unit.saves') + ': ' + res.saved);
    if (rushRun) bits[0] = t('unit.clocks') + ': ' + (res.clocks || 0);
    if (avRun) bits[0] = t('unit.avrings') + ': ' + (res.gates || 0);
    if (streakNow) bits.push(t('unit.streak', { n: streakNow }));
    $('over-detail').textContent = bits.join('  ·  ');
    buildFinds(true);
    /* Opening the modes is the biggest thing that happens to a new player
       after the tutorial, and it used to be silent: three buttons quietly
       changed colour behind the results. */
    var opened = !wasOpen && freeUnlocked();
    $('over-unlock').classList.toggle('hidden', !opened);
    if (opened) { $('over-unlock').textContent = t('over.unlocked.modes'); justOpened = true; }
    buildGoals(res, cd, stars, beat, mRun, avRun ? save.bestAv : rushRun ? save.bestRush : save.best);
    if (beat) setTimeout(function () {
      celebrateBest($('over-score'), mRun ? res.dist : res.score, mRun ? t('unit.m') : null);
    }, 350);
    Game.pause();
    show('over');
  }

  /* ------------------------ bursts ---------------------------- */
  /* One canvas over the whole window for the big moments. Each burst runs
     on its own short animation and clears itself when done. */
  var BURST_TONE = { fish: ['#bfe8ff', '#4fb0ea', '150,215,255'],
                     gold: ['#fff1a8', '#f0b020', '255,210,90'],
                     life: ['#ffd0dc', '#ff5a8a', '255,120,170'],
                     best: ['#fff1a8', '#ff6b8a', '255,220,120'] };
  var burstRaf = null;
  function screenBurst(kind, x, y) {
    var cv = $('fx-burst'); if (!cv || !cv.getContext) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var tone = BURST_TONE[kind] || BURST_TONE.fish;
    var confetti = kind !== 'fish';                     // gold, a life and a best throw colour too
    var cols = kind === 'best' ? ['#ffd84a', '#ff6b8a', '#55bdf0', '#45d3a2', '#9a86f4']
                               : [tone[0], tone[1], '#ffffff'];
    var parts = [], i, n = kind === 'best' ? 110 : kind === 'life' ? 90 : 60;
    for (i = 0; i < n; i++) {
      var a = Math.random() * 6.2832, sp = 4 + Math.random() * 9;
      var fromTop = kind === 'best';
      parts.push({ x: fromTop ? Math.random() * w : x, y: fromTop ? -20 - Math.random() * 120 : y,
                   vx: fromTop ? (Math.random() - 0.5) * 3 : Math.cos(a) * sp,
                   vy: fromTop ? 2 + Math.random() * 4 : Math.sin(a) * sp - 3,
                   r: 3 + Math.random() * 5, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
                   col: cols[i % cols.length], shard: !confetti || i % 3 === 0 });
    }
    var T = 0, DUR = kind === 'best' ? 150 : 80;
    if (burstRaf) cancelAnimationFrame(burstRaf);
    (function frame() {
      T++;
      c.clearRect(0, 0, w, h);
      if (kind !== 'best' && T < 40) {                  // rays out of the find
        c.save(); c.translate(x, y); c.rotate(T * 0.03);
        var ra = 0.4 * (1 - T / 40), L = Math.max(w, h);
        for (var k = 0; k < 14; k++) {
          c.rotate(6.2832 / 14);
          c.fillStyle = 'rgba(' + tone[2] + ',' + (ra * (k % 2 ? 0.5 : 1)).toFixed(3) + ')';
          c.beginPath(); c.moveTo(0, 0); c.lineTo(-24, -L); c.lineTo(24, -L); c.closePath(); c.fill();
        }
        c.restore();
      }
      for (var j = 0; j < parts.length; j++) {
        var p = parts[j];
        p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.vx *= 0.985; p.rot += p.vr;
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.globalAlpha = Math.max(0, 1 - T / DUR);
        c.fillStyle = p.col;
        if (p.shard) { c.beginPath(); c.moveTo(-p.r, p.r * 0.5); c.lineTo(0, -p.r * 1.2); c.lineTo(p.r, p.r * 0.4); c.closePath(); c.fill(); }
        else c.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        c.restore();
      }
      if (T < DUR) burstRaf = requestAnimationFrame(frame);
      else { c.clearRect(0, 0, w, h); burstRaf = null; }
    })();
  }
  /* What came out of the find flies into the purse line on the card. */
  function flyPrize(kind) {
    var from = $('find-art'), to = $('over-earned');
    if (!from || !to || to.classList.contains('hidden')) to = $('find-prize');
    if (!from || !to) return;
    var a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    var tone = BURST_TONE[kind] || BURST_TONE.fish, n = kind === 'fish' ? 8 : 5;
    for (var i = 0; i < n; i++) (function (i) {
      var d = document.createElement('div');
      d.className = 'fly-dot';
      d.style.left = (a.left + a.width / 2 + (Math.random() - 0.5) * 40) + 'px';
      d.style.top = (a.top + a.height / 2 + (Math.random() - 0.5) * 40) + 'px';
      d.style.background = 'radial-gradient(circle at 35% 30%, #fff, ' + tone[1] + ')';
      document.body.appendChild(d);
      setTimeout(function () {
        d.style.transform = 'translate(' + (b.left + b.width / 2 - parseFloat(d.style.left)) + 'px,' +
                            (b.top + b.height / 2 - parseFloat(d.style.top)) + 'px) scale(.5)';
        d.style.opacity = '0.2';
      }, 30 + i * 60);
      setTimeout(function () { d.remove(); }, 900 + i * 60);
    })(i);
    setTimeout(function () { to.classList.remove('bump'); void to.offsetWidth; to.classList.add('bump'); }, 760);
  }
  /* A new best: confetti down the whole screen and the number counting up. */
  function celebrateBest(el, value, unit) {
    screenBurst('best', 0, 0);
    if (Sfx.fanfare) Sfx.fanfare();
    buzz([40, 40, 40, 40, 90]);
    var T = 0, DUR = 48;
    (function tick() {
      T++;
      var v = Math.round(value * (1 - Math.pow(1 - T / DUR, 3)));
      el.textContent = unit ? v + ' ' + unit : t('over.points', { n: v });
      if (T < DUR) requestAnimationFrame(tick);
    })();
  }

  /* ------------------------ what is next ---------------------- */
  /* One or two things to go back for, with how close you are: the best you
     did not beat, the star you did not get, the creature you are saving
     for. A results card that only says what happened gives no reason to
     press Ride again. */
  function buildGoals(res, cd, stars, beat, rushRun, bestOf) {
    var box = $('over-goals'), goals = [];
    if (cd && stars < 3 && res.fishTotal) {
      var need = Math.round(res.fishTotal * (stars < 2 ? 0.40 : 0.75));
      if (!res.finished) goals.push({ txt: t('goal.finish'), p: 0 });
      else if (need > res.fish) goals.push({ txt: t('goal.star', { n: need - res.fish }), p: res.fish / need });
    } else if (!cd && !beat) {
      var bestV = bestOf || 0, cur = rushRun ? res.dist : res.score;
      if (bestV > 0 && cur < bestV)
        goals.push({ txt: t(rushRun ? 'goal.bestm' : 'goal.best', { n: bestV - cur }), p: cur / bestV });
    }
    var sk = nextSkin();
    if (sk) {
      var have = sk.currency === 'gold' ? save.gold : save.fish;
      var nm = t('skin.' + sk.id + '.name', null, sk.name);
      if (have >= sk.price) goals.push({ txt: t('goal.canbuy', { s: nm }), p: 1, buy: true });
      else goals.push({ txt: t(sk.currency === 'gold' ? 'goal.skingold' : 'goal.skin',
                               { n: sk.price - have, s: nm }), p: have / sk.price });
    }
    box.textContent = '';
    box.classList.toggle('hidden', !goals.length);
    goals.slice(0, 2).forEach(function (g) {
      var row = document.createElement('div');
      row.className = 'goal' + (g.buy ? ' goal-buy' : '');
      var tx = document.createElement('div'); tx.className = 'goal-txt'; tx.textContent = g.txt;
      var bar = document.createElement('div'); bar.className = 'goal-bar';
      var fill = document.createElement('i');
      fill.style.width = Math.round(Math.max(0.04, Math.min(1, g.p)) * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(tx); row.appendChild(bar);
      box.appendChild(row);
    });
  }

  /* ------------------------ frozen finds --------------------- */
  function buildFinds(reset) {
    var box = $('over-finds'), n = save.finds || 0;
    box.classList.toggle('hidden', n <= 0);
    if (n <= 0) return;
    $('find-count').textContent = t('find.have', { n: n });
    if (reset) $('find-prize').classList.add('hidden');
    var btn = box.querySelector('[data-action="open-find"]');
    btn.textContent = t(reset ? 'find.open' : 'find.again');
    /* openFind() disables the button for the length of the animation and
       nothing ever turned it back on, so with two or more finds the second
       could never be opened. */
    btn.disabled = opening;
    if (Game.drawFindPreview) Game.drawFindPreview($('find-art'), 200);
  }

  var opening = false;
  function openFind() {
    if ((save.finds || 0) <= 0 || opening) return;
    save.finds--;
    /* Counted when it is cracked open, not when it is picked up: the
       trophy is for opening them. */
    save.totFinds = (save.totFinds || 0) + 1;
    var total = 0, i;
    for (i = 0; i < FIND_PRIZES.length; i++) total += FIND_PRIZES[i].w;
    var roll = Math.random() * total, pick = FIND_PRIZES[0];
    for (i = 0; i < FIND_PRIZES.length; i++) {
      roll -= FIND_PRIZES[i].w;
      if (roll <= 0) { pick = FIND_PRIZES[i]; break; }
    }
    var msg;
    if (pick.kind === 'fish') { save.fish += pick.n; msg = t('find.fish', { n: pick.n }); }
    else if (pick.kind === 'gold') { save.gold += pick.n; msg = t('find.gold', { n: pick.n }); }
    else {
      /* A life you cannot carry would just vanish, so it is paid out. */
      if ((save.lives || 0) < LIFE_CAP) { save.lives = (save.lives || 0) + 1; msg = t('find.life'); }
      else { save.fish += LIFE_PRICE; msg = t('find.lifefull', { n: LIFE_PRICE }); }
    }
    /* The prize is decided here and banked here; the engine only plays the
       opening. Hold the words back until the shell actually breaks — the
       whole point is the moment, and text that appears on the click gives
       the answer away before anything happens. */
    var p = $('find-prize'), btn = $('over-finds').querySelector('[data-action="open-find"]');
    p.classList.add('hidden');
    opening = true;
    if (btn) btn.disabled = true;
    achCheck(save);
    store();
    var kind = pick.kind;
    if (Sfx.charge) Sfx.charge(); else Sfx.bubble();
    buzz(20);
    function onBreak() {
      if (Sfx.boom) Sfx.boom();
      Sfx.gold();
      buzz(kind === 'life' ? [60, 40, 60, 40, 120] : kind === 'gold' ? [50, 30, 90] : [40, 30, 50]);
      var r = $('find-art').getBoundingClientRect();
      screenBurst(kind, r.left + r.width / 2, r.top + r.height / 2);
    }
    if (Game.playFindOpen) {
      Game.playFindOpen($('find-art'), 200, kind, function () { finish(); }, onBreak);
    } else { onBreak(); finish(); }

    function finish() {
      opening = false;
      p.textContent = msg;
      p.classList.remove('hidden');
      /* restart the reveal even when the same prize comes up twice */
      p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
      buildFinds(false);
      flyPrize(kind);
    }
  }

  /* -------------------------- actions ------------------------ */
  function act(name) {
    switch (name) {
      case 'play':
        /* "Give up and start over" from the pause screen starts over the
           thing you were riding. It always started Freeride, so giving up
           on First Light dropped you onto a different hill — and in the
           tutorial, with Freeride still shut, into the Known Lines list
           with the lesson left hanging behind it. */
        if (currentScreen === 'pause' && (lastCourse || lastMode)) {
          Sfx.click(); ride(lastCourse, lastMode); break;
        }
        if (!freeUnlocked()) { Sfx.click(); show('runs'); break; }
        Sfx.click(); ride(null); break;
      case 'use-life':   useLife(); break;
      case 'open-find':  openFind(); break;
      case 'no-life':    Sfx.click(); noLife(); break;
      case 'help':       Sfx.click(); show('help'); break;
      case 'tutorial':   Sfx.click(); ride('tutorial'); break;
      case 'daily':
        if (!freeUnlocked()) { Sfx.click(); show('runs'); break; }
        Sfx.click(); ride('daily'); break;
      case 'rush':
        if (!freeUnlocked()) { Sfx.click(); show('runs'); break; }
        Sfx.click(); ride(null, 'rush'); break;
      case 'avalanche':
        if (!freeUnlocked()) { Sfx.click(); show('runs'); break; }
        Sfx.click(); ride(null, 'avalanche'); break;
      case 'tut-skip':   Sfx.click(); skipTutorial(); break;
      case 'tut-first':  Sfx.click(); ride(COURSES[0].id); break;
      case 'shop':       Sfx.click(); shopBack = currentScreen; show('shop'); break;
      case 'settings':   Sfx.click(); shopBack = currentScreen; show('settings'); break;
      case 'trophies':   Sfx.click(); shopBack = currentScreen; show('ach'); break;
      case 'runs':       Sfx.click(); shopBack = currentScreen; show('runs'); break;
      case 'modes':      Sfx.click(); show('modes'); break;
      case 'retry':      Sfx.click(); ride(lastCourse, lastMode); break;
      case 'close-sheet': Sfx.click(); closeSheet(); break;
      case 'lang':       Sfx.click(); buildLangs(); $('sheet-lang').classList.remove('hidden'); break;
      case 'back-title':
        Sfx.click();
        if (currentScreen === 'comic') { finishComic(); break; }   // the arrow and Esc leave a comic
        /* The back arrow and Esc close an open window before they leave
           the screen under it. */
        if (closeSheet()) break;
        /* Leaving the market puts you back where you opened it from, so
           browsing between runs does not throw away the end card. */
        if ((currentScreen === 'shop' || currentScreen === 'settings' ||
             currentScreen === 'ach' || currentScreen === 'runs') &&
            (shopBack === 'over' || shopBack === 'pause' ||
             (shopBack === 'shop' && currentScreen === 'ach'))) {   // Trophies opened from Aurora's window
          var back = shopBack; shopBack = null; show(back); break;
        }
        /* A paused run is never thrown away by walking around the menus.
           The market is where lives and animals come from, so pausing in
           order to go shopping has to be a normal thing to do — and the
           first version of this guard only checked the pause screen, so
           pause -> Menu -> Market -> Back still destroyed the run.
           Nothing ends a run but finishing it, crashing out of it, or
           starting another. */
        if (Game.isRunning() && Game.isPaused()) {
          shopBack = null; show('title'); break;
        }
        shopBack = null; Game.stop(); show('title'); break;
      case 'resume':     Sfx.click(); carryOn(); break;
      case 'continue':
        if (!Game.isRunning()) { show('title'); break; }
        Sfx.click(); carryOn(); break;
    }
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-action]') : null;
    if (t) act(t.getAttribute('data-action'));
  });
  $('btn-menu').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!Game.isRunning() || Game.isPaused()) return;
    Sfx.click(); Game.pause(); show('pause');
  });

  /* ----------------------- audio toggles --------------------- */
  function syncToggles() {
    [['t-sfx', 't-sfx2', save.sfx], ['t-music', 't-music2', save.music],
     ['t-vib', 't-vib2', save.vibrate]].forEach(function (g) {
      [$(g[0]), $(g[1])].forEach(function (el) {
        if (!el) return;
        el.classList.toggle('on', g[2]);
        el.setAttribute('aria-pressed', g[2] ? 'true' : 'false');
      });
    });
  }
  function toggleSfx()  { save.sfx = !save.sfx; store(); Sfx.sound(save.sfx); syncToggles(); if (save.sfx) Sfx.click(); }
  function toggleMusic(){ save.music = !save.music; store(); Sfx.unlock(); Sfx.music(save.music); syncToggles(); }
  ['t-sfx','t-sfx2'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('click', toggleSfx); });
  ['t-music','t-music2'].forEach(function (id) { var e = $(id); if (e) e.addEventListener('click', toggleMusic); });
  function toggleVib() { save.vibrate = !save.vibrate; store(); syncToggles(); if (save.vibrate) buzz(30); }
  var tv = $('t-vib');
  if (tv) {
    tv.addEventListener('click', toggleVib);
    /* No vibration motor to drive (an iPhone, a desktop without one): no
       switch for it either, rather than a switch that does nothing. */
    if (!canBuzz()) tv.classList.add('hidden');
  }

  /* ------------------------- vibration ----------------------- */
  function canBuzz() { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
  var lastBuzz = 0;
  function buzz(pattern) {
    if (!save.vibrate || !canBuzz()) return;
    var now = Date.now();
    if (now - lastBuzz < 70) return;              // never a continuous rattle
    lastBuzz = now;
    try { navigator.vibrate(pattern); } catch (e) {}
  }
  /* What each moment feels like: a crash is the heaviest, a ring the
     lightest. Short on purpose — a tap game is held for minutes. */
  var BUZZ = { crash: [60, 40, 90], caught: [90, 50, 140], perfect: [12, 30, 18], gold: 28, find: [20, 30, 20], rush: [30, 20, 30],
               clock: 16, ring: 12, save: [40, 30, 40], land: 24, close: 18,
               finish: [30, 40, 60], timeup: [80] };
  function onFx(e) { if (BUZZ[e] !== undefined) buzz(BUZZ[e]); }

  /* ---------------------------- shop ------------------------- */
  var shopBack = null;

  /* The purse: two pills, each the currency's own fish and the amount.
     As one line of text the two sums ran together into one number. */
  function wallet() {
    [['wallet-fish', 'fish', save.fish], ['wallet-gold', 'gold', save.gold]].forEach(function (w) {
      var el = $(w[0]);
      el.textContent = '';
      el.appendChild(coin(w[1], 30));
      var b = document.createElement('b');
      b.textContent = num(w[2]);
      el.appendChild(b);
      el.setAttribute('aria-label', w[2] + ' ' + t('cur.' + w[1]));
    });
  }

  function owns(id) { return save.owned.indexOf(id) >= 0; }
  function balance(cur) { return cur === 'gold' ? save.gold : save.fish; }

  /* Supplies sit above the animals: they are consumable, everything below
     is permanent, and mixing them in one grid made the shop read as if you
     could "wear" a life. */
  function buildSupply() {
    var box = $('shop-supply');
    if (!box) return;
    box.textContent = '';
    var n = save.lives || 0, full = n >= LIFE_CAP, broke = save.fish < LIFE_PRICE;

    var card = document.createElement('div');
    card.className = 'supply-card';

    var art = document.createElement('div');
    art.className = 'supply-art';
    for (var i = 0; i < LIFE_CAP; i++) {
      var h = document.createElement('span');
      h.className = 'heart' + (i < n ? '' : ' spent');
      art.appendChild(h);
    }
    card.appendChild(art);

    var mid = document.createElement('div');
    mid.className = 'supply-mid';
    var nm = document.createElement('div');
    nm.className = 'nm'; nm.textContent = t('shop.life');
    mid.appendChild(nm);
    var ds = document.createElement('div');
    ds.className = 'pk'; ds.textContent = t('shop.life.desc');
    mid.appendChild(ds);
    var hv = document.createElement('div');
    hv.className = 'pk'; hv.textContent = t('shop.life.have', { n: n, m: LIFE_CAP });
    mid.appendChild(hv);
    card.appendChild(mid);

    var buy = document.createElement('button');
    buy.className = 'btn ' + (full || broke ? 'btn-ghost' : 'btn-green');
    buy.setAttribute('data-buy-life', '1');
    buy.disabled = full || broke;
    buy.textContent = full ? t('shop.life.full')
                           : t('shop.buy') + '  ' + LIFE_PRICE + ' ' + t('cur.fish');
    card.appendChild(buy);

    box.appendChild(card);
  }

  function buildShop() {
    buildSupply();
    wallet();
    var grid = $('shop-grid');
    grid.textContent = '';
    /* Cheapest first, so the next thing you can afford is the next thing
       you see. Prices in different currencies cannot be compared, so the
       gold ones go last however small the number on them looks. */
    var list = SKINS.slice().sort(function (a, b) {
      var ga = a.currency === 'gold' ? 1 : a.currency === 'trophy' ? 2 : 0,
          gb = b.currency === 'gold' ? 1 : b.currency === 'trophy' ? 2 : 0;
      return ga !== gb ? ga - gb : a.price - b.price;
    });
    for (var i = 0; i < list.length; i++) grid.appendChild(card(list[i]));
  }

  /* The shelf is pictures. Each creature is a tile with its portrait and,
     until it is bought, its price; the name, the perk and the button are in
     the window a tap on the tile opens. Eleven-plus cards of text were a
     wall to scroll past before you saw what was on offer. */
  function card(sk) {
    var el = document.createElement('button');
    el.className = 'skin-card' + (save.equipped === sk.id ? ' worn' : '')
                               + (owns(sk.id) ? ' owned' : '');
    el.setAttribute('data-pick', sk.id);
    el.setAttribute('aria-label', t('skin.' + sk.id + '.name', null, sk.name));
    var cv = document.createElement('canvas');
    cv.className = 'skin-pic';
    el.appendChild(cv);
    Game.drawSkinPreview(cv, sk.id, 80);
    if (save.equipped === sk.id) {
      var w = document.createElement('span');
      w.className = 'skin-tag tag-worn'; w.textContent = '✓';
      el.appendChild(w);
    } else if (!owns(sk.id) && sk.currency === 'trophy') {
      /* the trophy creature: how many trophies there are to go */
      var tp = document.createElement('span'), open = trophySkinOpen(save);
      tp.className = 'skin-tag tag-trophy' + (open ? ' can' : '');
      tp.textContent = '★ ' + (open ? t('shop.trophyfree') : achDone() + '/' + ACHIEVEMENTS.length);
      el.appendChild(tp);
      el.classList.add('trophy-card');
    } else if (!owns(sk.id)) {
      var p = document.createElement('span');
      var afford = balance(sk.currency) >= sk.price;
      p.className = 'skin-tag tag-price' + (sk.currency === 'gold' ? ' gold' : '') + (afford ? ' can' : '');
      p.appendChild(coin(sk.currency, 16));
      p.appendChild(document.createTextNode(num(sk.price)));
      el.appendChild(p);
    }
    return el;
  }
  /* The game's own fish, small, as the mark of a currency. */
  function coin(cur, size) {
    var cv = document.createElement('canvas');
    cv.className = 'coin';
    cv.setAttribute('aria-hidden', 'true');
    if (Game.drawHint) Game.drawHint(cv, cur === 'gold' ? 'gold' : 'fish', size);
    return cv;
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  var sheetSkin = null;
  function openSheet(id) {
    var sk = SKIN_BY_ID[id];
    if (!sk) return;
    sheetSkin = id;
    var sh = $('sheet-skin');
    sh.classList.remove('hidden');
    Game.drawSkinPreview($('sheet-skin-pic'), sk.id, 140);
    $('sheet-skin-name').textContent = t('skin.' + sk.id + '.name', null, sk.name);
    $('sheet-skin-perk').textContent = t('skin.' + sk.id + '.perk', null, sk.perkText);
    $('sheet-skin-comic-row').classList.toggle('hidden', !(comicFor(sk.id) && owns(sk.id)));
    buildAlbum(sk.id);
    var b = $('sheet-skin-btn'), need = $('sheet-skin-need'), tag = $('sheet-skin-tag');
    b.textContent = ''; b.disabled = false; b.className = 'btn'; b.removeAttribute('data-go');
    need.classList.add('hidden');
    /* The one being ridden gets a plain tag, not a button: a "Chosen" that
       looked pressable and did nothing was a dead end. */
    tag.classList.toggle('hidden', save.equipped !== sk.id);
    b.classList.toggle('hidden', save.equipped === sk.id);
    if (save.equipped === sk.id) {
      tag.textContent = t('shop.wearing');
    } else if (owns(sk.id)) {
      b.textContent = t('shop.wear'); b.className += ' btn-green';
    } else if (sk.currency === 'trophy') {
      if (trophySkinOpen(save)) { b.textContent = t('shop.trophytake'); b.className += ' btn-gold'; }
      else {
        /* not yet hers: the button leads to the trophies still to win */
        b.textContent = t('shop.trophyneed', { a: achDone(), b: ACHIEVEMENTS.length }) + '  ›';
        b.className += ' btn-blue'; b.setAttribute('data-go', 'trophies');
      }
    } else {
      var canAfford = balance(sk.currency) >= sk.price;
      b.appendChild(document.createTextNode(t('shop.buy') + '  '));
      b.appendChild(coin(sk.currency, 22));
      b.appendChild(document.createTextNode(num(sk.price)));
      b.className += canAfford ? ' btn-blue' : ' btn-ghost';
      b.disabled = !canAfford;
      if (!canAfford) {
        need.textContent = t('shop.needmore', { n: num(sk.price - balance(sk.currency)) });
        need.classList.remove('hidden');
      }
    }
    if (!b.classList.contains('hidden')) b.focus({ preventScroll: true });
  }
  /* Closes whichever window is open; says whether one was. */
  /* ------------------------ the comic ------------------------- */
  /* A comic is read a panel at a time: each tap shows the next panel of the
     page, and once all three are up the next page. The panels move a little
     as they come in, so they are drawn on an animation frame of their own
     while the comic is open. */
  var comic = null;
  function openComic(id, done) {
    var pages = comicFor(id);
    if (!pages) { if (done) done(); return; }
    comic = { id: id, pages: pages, page: 0, shown: 0, done: done, raf: null, starts: [] };
    show('comic');
    buildComicPage();
    (function tick() {
      if (!comic) return;
      drawComic();
      comic.raf = requestAnimationFrame(tick);
    })();
  }
  function buildComicPage() {
    var box = $('comic-panels');
    box.textContent = '';
    comic.shown = 0; comic.starts = [];
    comic.pages[comic.page].forEach(function (p) {
      var cell = document.createElement('div');
      cell.className = 'comic-panel';
      var cv = document.createElement('canvas');
      cv.className = 'comic-art';
      cell.appendChild(cv);
      var cap = document.createElement('div');
      cap.className = 'comic-cap'; cap.textContent = t(p.cap);
      cell.appendChild(cap);
      box.appendChild(cell);
    });
    revealPanel();
    $('comic-pageno').textContent = (comic.page + 1) + ' / ' + comic.pages.length;
    fitComic();
  }
  /* Size the page to this screen. The panels take whatever height is left
     after the captions, the buttons and the margins, and their width
     follows from the picture's shape — so a tall phone, a short phone and
     a desktop each get a page that fits exactly, without scrolling. The
     captions wrap to the new width and change height, so it settles over
     a couple of passes. */
  function fitComic() {
    if (!comic) return;
    var scr = $('screen-comic'), page = scr.querySelector('.comic-page'), box = $('comic-panels');
    var cells = box.children, n = cells.length;
    if (!n || !scr.clientHeight) return;
    var px = function (el, k) { return parseFloat(getComputedStyle(el)[k]) || 0; };
    var row = getComputedStyle(box).display === 'grid';
    var gap = px(box, 'rowGap') || 10;
    var availH = scr.clientHeight - px(scr, 'paddingTop') - px(scr, 'paddingBottom');
    var availW = scr.clientWidth - px(scr, 'paddingLeft') - px(scr, 'paddingRight');
    var padX = px(page, 'paddingLeft') + px(page, 'paddingRight') + px(page, 'borderLeftWidth') + px(page, 'borderRightWidth');
    var padY = px(page, 'paddingTop') + px(page, 'paddingBottom') + px(page, 'borderTopWidth') + px(page, 'borderBottomWidth');
    var foot = page.querySelector('.comic-foot');
    var footH = foot.offsetHeight + px(foot, 'marginTop') + 12;      // and the panel's own drop shadow
    var pageMax = Math.min(row ? 1400 : 560, availW);
    var cellMax = (pageMax - padX - (row ? gap * 2 : 0)) / (row ? 3 : 1);
    var w = cellMax;
    for (var pass = 0; pass < 4; pass++) {
      /* the caption's type follows the panel down on a small screen, or a
         narrow panel wraps it onto line after line and squeezes itself */
      var fs = Math.max(11, Math.min(15.5, w * 0.05));
      for (var i = 0; i < n; i++) { cells[i].style.width = w + 'px'; cells[i].querySelector('.comic-cap').style.fontSize = fs + 'px'; }
      var caps = 0, edge = 0;
      for (i = 0; i < n; i++) {
        var ch = cells[i].querySelector('.comic-cap').offsetHeight;
        edge = cells[i].offsetHeight - cells[i].clientHeight + 4;   // border and shadow
        caps = row ? Math.max(caps, ch) : caps + ch;
      }
      var room = availH - padY - footH - caps - (row ? edge : edge * n + gap * (n - 1));
      var artH = row ? room : room / n;
      var fit = Math.max(120, Math.min(cellMax, artH * COMIC_W / COMIC_H + 6));
      if (Math.abs(fit - w) < 1) break;
      w = fit;
    }
    /* never narrower than its buttons need: on a short phone the panels
       shrink, and the page stays wide enough for Skip, 1 / 3 and Next */
    page.style.width = Math.min(availW, Math.max(300, (row ? w * 3 + gap * 2 : w) + padX)) + 'px';
  }
  window.addEventListener('resize', function () { if (comic) fitComic(); });
  function revealPanel() {
    var cells = $('comic-panels').children;
    if (comic.shown < cells.length) {
      cells[comic.shown].classList.add('shown');
      comic.starts[comic.shown] = 0;
      comic.shown++;
    }
    var last = comic.page === comic.pages.length - 1 && comic.shown === cells.length;
    $('comic-next').textContent = last ? t('comic.go') : t('comic.next') + '  \u203a';
  }
  function nextComic() {
    if (!comic) return;
    Sfx.click();
    if (comic.shown < comic.pages[comic.page].length) { revealPanel(); return; }
    if (comic.page < comic.pages.length - 1) { comic.page++; buildComicPage(); return; }
    finishComic();
  }
  function finishComic() {
    if (!comic) return;
    if (comic.raf != null) cancelAnimationFrame(comic.raf);
    save.comicSeen[comic.id] = true;
    store();
    var done = comic.done;
    comic = null;
    if (done) done(); else show('title');
  }
  function drawComic() {
    var cells = $('comic-panels').children;
    var k = Math.min(window.devicePixelRatio || 1, 2.5);
    for (var i = 0; i < comic.shown; i++) {
      var cv = cells[i].querySelector('canvas');
      var w = cv.clientWidth || 300, h = Math.round(w * COMIC_H / COMIC_W);
      if (cv.width !== Math.round(w * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
      var c = cv.getContext('2d');
      c.setTransform(k * w / COMIC_W, 0, 0, k * w / COMIC_W, 0, 0);
      c.clearRect(0, 0, COMIC_W, COMIC_H);
      c.lineJoin = 'round'; c.lineCap = 'round';
      c.save();
      c.beginPath(); c.rect(0, 0, COMIC_W, COMIC_H); c.clip();
      comic.pages[comic.page][i].draw(c, comic.starts[i]++);
      c.restore();
    }
  }
  $('comic-next').addEventListener('click', nextComic);
  $('comic-panels').addEventListener('click', nextComic);
  $('comic-skip').addEventListener('click', function () { Sfx.click(); finishComic(); });
  $('sheet-skin-comic').addEventListener('click', function () {
    var id = sheetSkin;
    closeSheet();
    openComic(id, function () { show('shop'); });
  });

  /* The creature's three stories, under its perk in its window: an open
     chapter reads as its story; a closed one says what opens it and how
     far along it is. */
  function buildAlbum(id) {
    var box = $('sheet-skin-album');
    box.textContent = '';
    var h = document.createElement('div');
    h.className = 'album-head'; h.textContent = t('album.title');
    box.appendChild(h);
    for (var i = 0; i < 3; i++) {
      var p = albumProgress(save, id, i);
      var row = document.createElement('div');
      row.className = 'album-row' + (p.open ? ' open' : '');
      var lab = document.createElement('div');
      lab.className = 'album-ch';
      lab.textContent = t('album.chapter', { n: i + 1 }) + (p.open ? '' : '  ·  +' + ALBUM_PAY[i]);
      row.appendChild(lab);
      var txt = document.createElement('div');
      txt.className = 'album-txt';
      txt.textContent = p.open ? t('story.' + id + '.' + (i + 1)) : t('album.g.' + p.stat, { n: num(p.n) });
      row.appendChild(txt);
      if (!p.open) {
        var bar = document.createElement('div');
        bar.className = 'ach-bar';
        var fill = document.createElement('i');
        fill.style.width = Math.round(p.cur / p.n * 100) + '%';
        bar.appendChild(fill);
        row.appendChild(bar);
      }
      box.appendChild(row);
    }
  }
  function closeSheet() {
    var open = false;
    Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (sh) {
      if (!sh.classList.contains('hidden')) { open = true; sh.classList.add('hidden'); }
    });
    sheetSkin = null;
    return open;
  }

  $('shop-grid').addEventListener('click', function (e) {
    var c = e.target.closest ? e.target.closest('[data-pick]') : null;
    if (!c) return;
    Sfx.click();
    openSheet(c.getAttribute('data-pick'));
  });

  $('sheet-skin-btn').addEventListener('click', function () {
    var sk = SKIN_BY_ID[sheetSkin];
    if (!sk || this.disabled) return;
    if (this.getAttribute('data-go') === 'trophies') {   // Aurora, still out of reach
      closeSheet(); act('trophies'); return;
    }
    var bought = !owns(sk.id);
    if (!owns(sk.id) && sk.currency === 'trophy') {
      if (!trophySkinOpen(save)) return;
      save.owned.push(sk.id);
      Sfx.gold();
      var r0 = this.getBoundingClientRect();
      screenBurst('best', r0.left + r0.width / 2, r0.top + r0.height / 2);
    } else if (!owns(sk.id)) {
      if (balance(sk.currency) < sk.price) return;
      if (sk.currency === 'gold') save.gold -= sk.price; else save.fish -= sk.price;
      save.owned.push(sk.id);
      Sfx.gold();
    } else {
      Sfx.click();
    }
    save.equipped = sk.id;          // buying it puts it on straight away
    achCheck(save);                 // owning things is a goal in its own right
    store();
    /* Chosen, the window has done its job: it closes, and the creature's
       tile takes the tick with a little pop so the change is seen. */
    closeSheet();
    buildShop();
    var tile = document.querySelector('#shop-grid [data-pick="' + sk.id + '"]');
    if (tile) tile.classList.add('just-chosen');
    /* bought, and it has a comic: its story opens straight away */
    if (bought && comicFor(sk.id) && !save.comicSeen[sk.id])
      openComic(sk.id, function () { show('shop'); });
  });
  /* A tap on the dimmed ground around a window closes it. */
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (sh) {
    sh.addEventListener('click', function (e) {
      if (e.target === this) { Sfx.click(); closeSheet(); }
    });
  });

  $('shop-supply').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-buy-life]') : null;
    if (!b || b.disabled) return;
    if (save.fish < LIFE_PRICE || (save.lives || 0) >= LIFE_CAP) { Sfx.click(); return; }
    save.fish -= LIFE_PRICE;
    save.lives = (save.lives || 0) + 1;
    Sfx.gold();
    store();
    buildShop();
  });

  /* ------------------------ marked runs ---------------------- */
  function runUnlocked(i) {
    if (i === 0) return true;                        // the first is always open
    return (save.courses[COURSES[i - 1].id] || 0) > 0;
  }

  /* Freeride is where the fish are, so it cannot be held back far: locking
     it behind all six lines would also lock a beginner out of the shop, and
     they clear the sixth roughly never. One line is enough — it is the run
     that teaches you what a tap does, and it is passed in a few attempts. */
  function freeUnlocked() { return (save.courses[COURSES[0].id] || 0) > 0; }

  function refreshModes() {
    /* The .hidden class, not the hidden attribute: .btn-row sets
       display:flex, which beats the browser's own [hidden] rule, so the
       attribute did nothing and Continue sat there permanently. Everything
       else in this file hides things the same way. */
    var row = $('resume-row');
    if (row) row.classList.toggle('hidden', !(Game.isRunning() && Game.isPaused()));
    /* Every mode but the marked lines opens with the first of them: one
       line is what teaches you what a tap does. */
    var open = freeUnlocked();
    [['btn-free', 'free-sub', 'mode.free.sub'],
     ['btn-rush', 'rush-sub', 'mode.rush.sub'],
     ['btn-av', 'av-sub', 'mode.av.sub'],
     ['btn-daily', 'daily-sub', 'mode.daily.sub']].forEach(function (m) {
      var b = $(m[0]), sub = $(m[1]);
      if (!b || !sub) return;
      b.disabled = !open;
      b.classList.toggle('locked', !open);
      if (open) { sub.setAttribute('data-i18n', m[2]); sub.textContent = t(m[2]); }
      else {
        sub.removeAttribute('data-i18n');
        sub.textContent = t('mode.free.locked', { n: t('course.' + COURSES[0].id + '.name') });
      }
    });
    refreshDaily();
    /* More modes names what is behind it. Its badge is the day's new
       Daily Line: lit once a day until the list is opened (or the line is
       finished first). Inside, the Daily Line keeps a quiet mark until it
       is finished, so the reason to come back is not lost once seen. */
    var more = $('more-sub');
    if (more) more.textContent = [t('mode.daily'), t('mode.rush'), t('mode.av')].join(' · ');
    var today = dailyKey(), dailyOpen = open && save.dailyLast !== today;
    /* A mode not yet ridden wears the same gold dot as an unfinished Daily
       Line: just opened, it is the newest thing on the screen. Ridden once,
       it has a best of its own, and that is how it is known. */
    var untried = { 'btn-free': open && !(save.best > 0),
                    'btn-rush': open && !(save.bestRush > 0),
                    'btn-av':   open && !(save.bestAv > 0),
                    'btn-daily': dailyOpen };
    for (var id in untried) { var mbtn = $(id); if (mbtn) mbtn.classList.toggle('todo', untried[id]); }
    var inside = untried['btn-daily'] || untried['btn-rush'] || untried['btn-av'];
    var mb = $('more-badge');
    if (mb) mb.classList.toggle('hidden', !(inside && save.modesSeen !== today));
  }

  /* The creature the purse is saving towards: the cheapest one not owned
     yet, in the money it is priced in. */
  function nextSkin() {
    var best = null;
    for (var i = 0; i < SKINS.length; i++) {
      var s = SKINS[i];
      if (!s.price || save.owned.indexOf(s.id) >= 0) continue;
      if (!best || (s.currency === 'fish' && (best.currency !== 'fish' || s.price < best.price))) best = s;
    }
    return best;
  }
  /* The creatures the Market badge is for: affordable now (or, for Aurora,
     ready to take) and not yet seen on the shelf that way. Opening the
     Market sees them all. The badge used to be lit whenever anything at all
     could be bought, which with a full purse meant always, and a badge that
     never goes out stops being read. */
  function affordableNow() {
    var out = [];
    var tsk = trophySkin();
    if (tsk && trophyWaiting()) out.push(tsk.id);
    for (var i = 0; i < SKINS.length; i++) {
      var s = SKINS[i];
      if (!s.price || save.owned.indexOf(s.id) >= 0) continue;
      if ((s.currency === 'gold' ? save.gold : save.fish) >= s.price) out.push(s.id);
    }
    return out;
  }
  function marketNews() {
    return affordableNow().filter(function (id) { return save.marketSeen.indexOf(id) < 0; });
  }
  function seeMarket() {
    var news = marketNews();
    if (!news.length) return;
    save.marketSeen = save.marketSeen.concat(news);
    store();
  }
  /* The Daily Line's button says how today is going and how long the
     streak is, so the reason to come back is on the title screen. */
  function refreshDaily() {
    var sub = $('daily-sub');
    if (!sub || !freeUnlocked()) return;
    var today = dailyKey(), st = save.daily && save.daily.key === today ? save.daily.stars : 0;
    /* A streak only counts if it reaches yesterday or today. */
    var streak = (save.dailyLast === today || save.dailyLast === dailyPrevKey(today))
               ? (save.dailyStreak || 0) : 0;
    sub.removeAttribute('data-i18n');
    sub.textContent = st
      ? t('mode.daily.today', { s: '★★★☆☆☆'.slice(3 - st, 6 - st), n: streak })
      : (streak ? t('mode.daily.wait', { n: streak }) : t('mode.daily.sub'));
  }

  function buildRuns() {
    var total = 0;
    for (var k = 0; k < COURSES.length; k++) total += (save.courses[COURSES[k].id] || 0);
    $('runs-count').textContent = t('runs.count', { a: total, b: COURSES.length * 3 });

    var list = $('runs-list');
    list.textContent = '';
    COURSES.forEach(function (cd, i) {
      var stars = save.courses[cd.id] || 0;
      var open = runUnlocked(i);

      var row = document.createElement('button');
      row.className = 'run-row' + (stars ? ' done' : '') + (open ? '' : ' locked');
      row.setAttribute('data-run', cd.id);
      if (!open) row.disabled = true;

      var no = document.createElement('div');
      no.className = 'run-no'; no.textContent = i + 1;
      row.appendChild(no);

      var mid = document.createElement('div');
      mid.className = 'run-mid';
      var nm = document.createElement('div');
      nm.className = 'run-name'; nm.textContent = t('course.' + cd.id + '.name');
      mid.appendChild(nm);
      var sub = document.createElement('div');
      sub.className = 'run-sub';
      /* Only the next one says HOW to open it. Five rows all repeating
         "Finish the one before" was five lines of the same sentence, and
         the one that mattered did not stand out among them. */
      /* The next one up is the locked line whose predecessor is OPEN. This
         used to test that the predecessor was finished — which is the very
         thing that unlocks this one — so it could never be true, and every
         locked row said "Locked". It now names the line to finish. */
      var nextUp = !open && i > 0 && runUnlocked(i - 1);
      sub.textContent = open
        ? t('biome.' + cd.biome) + '  ·  ' +
          t('runs.len', { n: Math.round(parseCourse(cd, 300).length * cd.step / 8) })
        : (nextUp ? t('runs.locked', { n: t('course.' + COURSES[i - 1].id + '.name') })
                  : t('runs.shut'));
      if (!open && !nextUp) sub.classList.add('run-shut');
      mid.appendChild(sub);
      row.appendChild(mid);

      var st = document.createElement('div');
      st.className = 'run-stars';
      st.textContent = open ? '★★★☆☆☆'.slice(3 - stars, 6 - stars) : '';
      row.appendChild(st);

      list.appendChild(row);
    });
  }

  $('runs-list').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-run]') : null;
    if (!b || b.disabled) return;
    Sfx.click();
    ride(b.getAttribute('data-run'));
  });

  /* -------------------------- trophies ----------------------- */
  function showWon(won, tasks, stories) {
    var box = $('over-won');
    tasks = tasks || []; stories = stories || [];
    box.textContent = '';
    box.classList.toggle('hidden', !won.length && !tasks.length && !stories.length);
    stories.forEach(function (st) {
      var row = document.createElement('div');
      row.className = 'won-row won-story';
      var sk = SKIN_BY_ID[st.id];
      row.textContent = t('album.won', { s: t('skin.' + st.id + '.name', null, sk ? sk.name : st.id), n: st.pay });
      box.appendChild(row);
    });
    tasks.forEach(function (tk) {
      var row = document.createElement('div');
      row.className = 'won-row won-task';
      row.textContent = t('tasks.done', { s: taskText(tk) }) + '   +' + TASK_PAY + ' ' + t('cur.fish');
      box.appendChild(row);
    });
    if (tasks.length && save.tasks.done.length === 3) {
      var all = document.createElement('div');
      all.className = 'won-row won-task';
      all.textContent = t('tasks.all') + '   +' + TASK_BONUS + ' ' + t('cur.fish');
      box.appendChild(all);
    }
    won.forEach(function (a) {
      var row = document.createElement('div');
      row.className = 'won-row';
      row.textContent = t('ach.' + a.id + '.name') + ' — ' + t('ach.toclaim', { n: a.reward });
      box.appendChild(row);
    });
  }
  function taskText(tk) { return t('task.' + tk.id, { n: tk.n }); }
  function todaysDone() {
    return (save.tasks && save.tasks.key === dailyKey()) ? save.tasks.done : [];
  }
  function buildTasks() {
    var list = $('tasks-list'), done = todaysDone();
    list.textContent = '';
    tasksFor(dailyKey()).forEach(function (tk) {
      var row = document.createElement('div');
      var got = done.indexOf(tk.id) >= 0;
      row.className = 'task-row' + (got ? ' got' : '');
      var tick = document.createElement('span'); tick.className = 'task-tick'; tick.textContent = got ? '✓' : '';
      var tx = document.createElement('span'); tx.className = 'task-txt'; tx.textContent = taskText(tk);
      var pay = document.createElement('span'); pay.className = 'task-pay'; pay.textContent = '+' + TASK_PAY;
      row.appendChild(tick); row.appendChild(tx); row.appendChild(pay);
      list.appendChild(row);
    });
    $('tasks-note').textContent = t('tasks.note', { n: TASK_BONUS });
  }

  function buildAch() {
    /* Sweep before drawing. A goal can be satisfied by a route that never
       passes through the end-of-run check — an older save, a rule that
       changed, a target that moved — and without this it would sit there
       reading 30 / 30 and locked. */
    if (achCheck(save).length) store();
    var done = achDone();
    $('ach-count').textContent = t('ach.count', { a: done, b: ACHIEVEMENTS.length });
    buildPrize(done);

    /* More than one waiting: one tap takes the lot. */
    var owedAll = achUnclaimed(save), ca = $('ach-claim-all');
    ca.classList.toggle('hidden', owedAll.length < 2);
    if (owedAll.length >= 2) {
      var sum = 0; owedAll.forEach(function (a) { sum += a.reward; });
      ca.textContent = t('ach.claimall', { n: sum });
    }

    var list = $('ach-list');
    list.textContent = '';
    /* the ones waiting to be paid come first, where they are seen */
    var order = owedAll.concat(ACHIEVEMENTS.filter(function (a) { return owedAll.indexOf(a) < 0; }));
    order.forEach(function (a) {
      var p = achProgress(a, save);
      var got = save.ach.indexOf(a.id) >= 0;

      var row = document.createElement('div');
      row.className = 'ach-row' + (got ? ' got' : '');

      var ico = document.createElement('div');
      ico.className = 'ach-ico' + (got ? ' got' : '');
      row.appendChild(ico);

      var mid = document.createElement('div');
      mid.className = 'ach-mid';
      var nm = document.createElement('div');
      nm.className = 'ach-name'; nm.textContent = t('ach.' + a.id + '.name');
      mid.appendChild(nm);
      var ds = document.createElement('div');
      ds.className = 'ach-desc'; ds.textContent = t('ach.' + a.id + '.desc');
      mid.appendChild(ds);

      var bar = document.createElement('div');
      bar.className = 'ach-bar';
      var fill = document.createElement('i');
      fill.style.width = Math.round(p.cur / Math.max(1, p.goal) * 100) + '%';
      bar.appendChild(fill);
      mid.appendChild(bar);
      row.appendChild(mid);

      var right = document.createElement('div');
      right.className = 'ach-right';
      var owed = got && save.claimed.indexOf(a.id) < 0;
      if (owed) {
        /* earned, and the fish are waiting for a tap */
        row.classList.add('owed');
        var cb = document.createElement('button');
        cb.className = 'btn btn-sm btn-gold ach-claim';
        cb.setAttribute('data-claim', a.id);
        cb.appendChild(document.createTextNode(t('ach.claim') + ' +' + a.reward));
        right.appendChild(cb);
      } else {
        right.textContent = got ? ('✓ ' + t('ach.earned'))
                                : (p.cur + ' / ' + p.goal);
        var rew = document.createElement('small');
        rew.textContent = '+' + a.reward + ' ' + t('cur.fish');
        right.appendChild(rew);
      }
      row.appendChild(right);

      list.appendChild(row);
    });
  }

  function achDone() {
    var n = 0;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) if (save.ach.indexOf(ACHIEVEMENTS[i].id) >= 0) n++;
    return n;
  }
  function trophySkin() {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].currency === 'trophy') return SKINS[i];
    return null;
  }
  /* every trophy earned, and she has not been taken yet */
  function trophyWaiting() { var sk = trophySkin(); return !!sk && !owns(sk.id) && trophySkinOpen(save); }
  /* The prize at the top of Trophies: the creature every trophy opens,
     with how far there is to go — the reason to finish the board. */
  function buildPrize(done) {
    var sk = trophySkin(), box = $('ach-prize');
    if (!sk || !box) return;
    box.textContent = '';
    var cv = document.createElement('canvas');
    cv.className = 'skin-pic prize-pic';
    box.appendChild(cv);
    Game.drawSkinPreview(cv, sk.id, 72);
    var mid = document.createElement('div');
    mid.className = 'prize-mid';
    var h = document.createElement('div');
    h.className = 'prize-name'; h.textContent = t('skin.' + sk.id + '.name', null, sk.name);
    mid.appendChild(h);
    var d = document.createElement('div');
    d.className = 'prize-desc';
    d.textContent = owns(sk.id) ? t('ach.prize.yours') : t('ach.prize.desc');
    mid.appendChild(d);
    if (!owns(sk.id)) {
      var bar = document.createElement('div');
      bar.className = 'ach-bar';
      var fill = document.createElement('i');
      fill.style.width = Math.round(done / ACHIEVEMENTS.length * 100) + '%';
      bar.appendChild(fill);
      mid.appendChild(bar);
    }
    box.appendChild(mid);
    if (trophyWaiting()) {
      var b = document.createElement('button');
      b.className = 'btn btn-sm btn-gold prize-take';
      b.id = 'prize-take';
      b.textContent = t('shop.trophytake');
      box.appendChild(b);
    } else if (!owns(sk.id)) {
      var c = document.createElement('div');
      c.className = 'prize-count'; c.textContent = done + ' / ' + ACHIEVEMENTS.length;
      box.appendChild(c);
    }
    box.classList.toggle('won', owns(sk.id));
  }

  /* Claiming: the fish go into the purse with a burst from the button. */
  function claimFx(el, paid) {
    if (!paid) return;
    Sfx.gold(); buzz(28);
    var r = el.getBoundingClientRect();
    screenBurst('gold', r.left + r.width / 2, r.top + r.height / 2);
    store();
    buildAch();
  }
  $('ach-list').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-claim]') : null;
    if (!b) return;
    claimFx(b, achClaim(save, b.getAttribute('data-claim')));
  });
  $('ach-prize').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.prize-take') : null;
    var sk = trophySkin();
    if (!b || !sk || !trophyWaiting()) return;
    save.owned.push(sk.id);
    save.equipped = sk.id;          // taken, and put on straight away
    achCheck(save);
    Sfx.gold(); buzz([30, 40, 60]);
    var r = b.getBoundingClientRect();
    screenBurst('best', r.left + r.width / 2, r.top + r.height / 2);
    store();
    buildAch();
  });
  $('ach-claim-all').addEventListener('click', function () {
    var paid = 0;
    achUnclaimed(save).forEach(function (a) { paid += achClaim(save, a.id); });
    claimFx(this, paid);
  });

  /* -------------------------- settings ----------------------- */
  /* Flags drawn as inline SVG: no image files, and emoji flags do not
     exist on Windows. The Union Jack's diagonals need a clip path, and a
     page may hold two of it at once, so every copy gets its own id. */
  var flagN = 0;
  function flag(id) {
    var f;
    if (id === 'ru') f = '<rect width="60" height="10" fill="#ffffff"/><rect y="10" width="60" height="10" fill="#0039a6"/>' +
                         '<rect y="20" width="60" height="10" fill="#d52b1e"/>';
    else if (id === 'ro') f = '<rect width="20" height="30" fill="#002b7f"/><rect x="20" width="20" height="30" fill="#fcd116"/>' +
                              '<rect x="40" width="20" height="30" fill="#ce1126"/>';
    else if (id === 'es') f = '<rect width="60" height="30" fill="#aa151b"/><rect y="7.5" width="60" height="15" fill="#f1bf00"/>';
    else if (id === 'de') f = '<rect width="60" height="10" fill="#000000"/><rect y="10" width="60" height="10" fill="#dd0000"/>' +
                              '<rect y="20" width="60" height="10" fill="#ffce00"/>';
    else if (id === 'pt') f = '<rect width="60" height="30" fill="#009c3b"/>' +           // Brazilian Portuguese: Brazil's flag
                              '<path d="M30,3 L56,15 L30,27 L4,15 Z" fill="#ffdf00"/>' +
                              '<circle cx="30" cy="15" r="7" fill="#002776"/>' +
                              '<path d="M23.4,13.6 Q30,12 36.6,16.6" stroke="#ffffff" stroke-width="1.2" fill="none"/>';
    else {
      var c = 'uj' + (++flagN);
      f = '<clipPath id="' + c + '"><path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath>' +
          '<rect width="60" height="30" fill="#012169"/>' +
          '<path d="M0,0 60,30M60,0 0,30" stroke="#ffffff" stroke-width="6"/>' +
          '<path d="M0,0 60,30M60,0 0,30" clip-path="url(#' + c + ')" stroke="#c8102e" stroke-width="4"/>' +
          '<path d="M30,0v30M0,15h60" stroke="#ffffff" stroke-width="10"/>' +
          '<path d="M30,0v30M0,15h60" stroke="#c8102e" stroke-width="6"/>';
    }
    var w = document.createElement('span');
    w.className = 'flag';
    w.setAttribute('aria-hidden', 'true');
    w.innerHTML = '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice">' + f + '</svg>';
    return w;
  }
  function langLabel(id) {
    for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return LANGS[i].label;
    return id;
  }

  function buildSettings() {
    var open = $('lang-open');
    open.textContent = '';
    open.appendChild(flag(getLang()));
    var nm = document.createElement('span');
    nm.className = 'lang-name'; nm.textContent = langLabel(getLang());
    open.appendChild(nm);
    open.setAttribute('aria-label', t('set.language') + ': ' + langLabel(getLang()));
    syncToggles();
  }
  function buildLangs() {
    var row = $('lang-row');
    row.textContent = '';
    LANGS.forEach(function (L) {
      var on = getLang() === L.id;
      var b = document.createElement('button');
      b.className = 'lang-row' + (on ? ' on' : '');
      b.setAttribute('data-lang', L.id);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.appendChild(flag(L.id));
      var nm = document.createElement('span');
      nm.className = 'lang-name'; nm.textContent = L.label;
      b.appendChild(nm);
      row.appendChild(b);
    });
  }

  $('lang-row').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-lang]') : null;
    if (!b) return;
    var id = b.getAttribute('data-lang');
    /* the language already in use: nothing to switch, the list just closes */
    if (id === getLang()) { Sfx.click(); closeSheet(); return; }
    setLang(id);
    save.lang = getLang();
    store();
    Sfx.click();
    /* Everything already on the page is re-read, and the two screens that
       build themselves are rebuilt, so nothing is left in the old language. */
    applyI18n();
    buildSettings();
    buildShop();
    closeSheet();                   // picked: the list has done its job
    if (currentScreen === 'title') show('title');
  });

  /* --------------------------- tapping ----------------------- */
  /* The control has to answer anywhere on the screen. Binding it to the
     canvas meant that on a tall phone the parts of the display outside the
     drawing surface — including where a thumb naturally rests — swallowed
     every tap. Two fingers landing together count as one tap, or the
     direction would flip twice and nothing would appear to happen. */
  var lastTap = -1e9, down = 0;
  window.addEventListener('pointerdown', function (e) {
    if (currentScreen !== 'game' || Game.isPaused()) return;
    if (e.target && e.target.closest && e.target.closest('button, [data-action]')) return;
    down++;
    /* Steering is a single tap, so a second finger is never a steering
       input — which makes it free to mean pause. The first finger has
       already flipped the direction by the time the second lands, so undo
       that flip: the player resumes going the way they were. */
    if (down > 1) {
      Game.undoTap();
      Game.pause(); show('pause');
      return;
    }
    var now = e.timeStamp || Date.now();
    if (now - lastTap < 45) return;
    lastTap = now;
    Game.tap();
  });
  function liftPointer() { if (down > 0) down--; }
  window.addEventListener('pointerup', liftPointer);
  window.addEventListener('pointercancel', liftPointer);
  /* A pointer that leaves the window never reports up, and the count would
     stick above zero and pause on the next ordinary tap. */
  window.addEventListener('blur', function () { down = 0; });
  document.addEventListener('contextmenu', function (e) {
    if (currentScreen === 'game') e.preventDefault();
  });

  /* ------------------------- keyboard ------------------------ */
  /* Esc is never swallowed: Design req. 2 forbids preventDefault() on it. */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (closeSheet()) { Sfx.click(); return; }
      /* the comic has its own Skip where the back arrow would sit */
      if (currentScreen === 'comic') { Sfx.click(); finishComic(); return; }
      if (BACKABLE[currentScreen]) { act('back-title'); }
      else if (currentScreen === 'pause') act('resume');
      else if (Game.isRunning() && !Game.isPaused()) { Game.pause(); show('pause'); }
      return;
    }
    if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      if (currentScreen === 'game' && !Game.isPaused()) Game.tap();
      return;
    }
    if (!Game.hasRun()) return;
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (Game.isPaused()) { if (currentScreen === 'pause') act('resume'); }
      else if (Game.isRunning()) { Game.pause(); show('pause'); }
    }
  });

  /* ------------------ Playables lifecycle -------------------- */
  function bootSdk() {
    if (!IN_YT) return;
    var sys = window.ytgame.system;
    sys.onPause(function () {
      if (Game.isRunning() && !Game.isPaused()) { Game.pause(); show('pause'); store(); }
      Game.suspend();
    });
    sys.onResume(function () { Game.unsuspend(); });
    try { Sfx.platformAudio(sys.isAudioEnabled()); } catch (e) {}
    sys.onAudioEnabledChange(function (on) { Sfx.platformAudio(on); });
  }
  function announce(fn) { if (IN_YT) { try { window.ytgame.game[fn](); } catch (e) {} } }

  function firstGesture() {
    Sfx.unlock(); Sfx.sound(save.sfx); Sfx.music(save.music);
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
  }
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  /* --------------------------- boot -------------------------- */
  bootSdk();
  setLang(save.lang);
  applyI18n();
  Sfx.sound(save.sfx);
  syncToggles();
  show('title');

  requestAnimationFrame(function () {
    announce('firstFrameReady');
    loadSave().then(function () {
      canSave = true;
      setLang(save.lang);           // the cloud save may disagree with the device
      applyI18n();
      achCheck(save);               // anything the loaded save already earned
      syncToggles();
      Sfx.sound(save.sfx);
      /* Someone who has never ridden at all goes straight into the
         tutorial instead of a menu of things they have no words for yet.
         An existing save with runs in it never sees it unasked. */
      if (!save.tutDone && !save.runs && currentScreen === 'title') {
        /* and before that, Snowcap's three pages: who he is and what the
           hill asks of him, so the first tap has a story behind it */
        if (!save.comicSeen.snowcap) openComic('snowcap', function () { ride('tutorial'); });
        else ride('tutorial');
      }
      else show(currentScreen === 'title' ? 'title' : currentScreen);
      pushScore();
      announce('gameReady');
    });
  });
})();
