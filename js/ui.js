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
    { w: 32, kind: 'fish', n: 80 },
    { w: 25, kind: 'fish', n: 150 },
    { w: 16, kind: 'fish', n: 300 },
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
             ach: [], totFish: 0, totGold: 0, totGates: 0, totJumps: 0,
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
             /* the Daily Line: today's stars, and the run of days finished */
             daily: { key: '', stars: 0 }, dailyLast: '', dailyStreak: 0,
             dailyBest: 0, dailyDays: 0,
             /* today's three tasks and which are done */
             tasks: { key: '', done: [] },
             /* a short buzz on a phone for the big moments */
             vibrate: true };
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
       'totRevives','totFinds','totRushes','totSmashed','totForks','bestRush','totClocks',
       'dailyStreak','dailyBest','dailyDays']
        .forEach(function (k) { save[k] = Math.max(0, parseInt(o[k], 10) || 0); });
      /* Both are capped on load as well as on purchase: a hand-edited save
         should not be able to hand out a hundred lives. */
      save.lives = Math.max(0, Math.min(LIFE_CAP, parseInt(o.lives, 10) || 0));
      save.tutDone = o.tutDone === true;
      save.dailyLast = typeof o.dailyLast === 'string' ? o.dailyLast : '';
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
                  ach: $('screen-ach'), runs: $('screen-runs'),
                  revive: $('screen-revive'), tutdone: $('screen-tutdone') };
  var hud = $('hud');
  var currentScreen = 'title';

  /* The screens that carry the always-visible back arrow. Every one of
     them already has a Back button; on the long ones it is a scroll away. */
  var BACKABLE = { help: 1, shop: 1, runs: 1, ach: 1, settings: 1 };
  var justOpened = false;
  function show(name) {
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
    if (name === 'shop') buildShop();
    if (name === 'settings') buildSettings();
    if (name === 'ach') { buildTasks(); buildAch(); }
    if (name === 'runs') buildRuns();
    if (name === 'title') {
      refreshModes();
      $('market-badge').classList.toggle('hidden', !canBuyCreature());
      /* today's tasks, as a line on the title that opens the list */
      var tchip = $('title-tasks'), nd = todaysDone().length;
      tchip.classList.toggle('hidden', !freeUnlocked());
      tchip.textContent = nd >= 3 ? t('tasks.chip.all') : t('tasks.chip', { a: nd, b: 3 });
      tchip.classList.toggle('all-done', nd >= 3);
      /* The first time the modes open, they say so on the title too. */
      if (justOpened) {
        justOpened = false;
        ['btn-free', 'btn-rush', 'btn-daily'].forEach(function (id) {
          var b = $(id); if (!b) return;
          b.classList.remove('just-opened'); void b.offsetWidth; b.classList.add('just-opened');
          setTimeout(function () { b.classList.remove('just-opened'); }, 4200);
        });
      }
      var el = $('title-best');
      el.textContent = t('title.best', { n: save.best });
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
    Game.start(lastMode === 'rush' ? save.bestRush : save.best,
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
    var streakNow = 0;
    if (cd && cd.daily) {
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
    var rushRun = res.mode === 'rush';
    var beat = !cd && !rushRun && res.score > save.best;
    if (beat) save.best = res.score;
    /* Time Rush is scored in metres, on a board of its own. */
    if (rushRun) {
      beat = res.dist > (save.bestRush || 0);
      if (beat) save.bestRush = res.dist;
      save.totClocks = (save.totClocks || 0) + (res.clocks || 0);
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
    var won = achCheck(save);                        // pays out into save.fish
    store();
    showWon(won, taskWon);
    var earned = $('over-earned');
    var bits = [];
    if (res.coins) bits.push('+' + res.coins + ' ' + t('cur.fish'));
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
      t(rushRun ? 'over.timeup' : res.finished ? 'over.finish' : 'over.title');
    var st = $('over-stars');
    st.classList.toggle('hidden', !cd);
    if (cd) st.textContent = '★★★☆☆☆'.slice(3 - stars, 6 - stars);
    /* Retry re-runs the same course; on freeride it is a fresh hill. */
    var again = document.querySelector('#screen-over [data-action="play"], #screen-over [data-action="retry"]');
    again.setAttribute('data-action', (cd || rushRun) ? 'retry' : 'play');
    again.textContent = t(cd ? 'btn.retry' : 'btn.again');
    $('over-score').textContent = rushRun ? res.dist + ' ' + t('unit.m')
                                          : t('over.points', { n: res.score });
    var bits = [res.dist + ' ' + t('unit.m'), t('unit.fish') + ': ' + res.fish];
    if (res.gold)  bits.push(t('unit.golden') + ': ' + res.gold);
    if (res.gates) bits.push(t('unit.gates') + ': ' + res.gates);
    if (res.saved) bits.push(t('unit.saves') + ': ' + res.saved);
    if (rushRun) bits[0] = t('unit.clocks') + ': ' + (res.clocks || 0);
    if (streakNow) bits.push(t('unit.streak', { n: streakNow }));
    $('over-detail').textContent = bits.join('  ·  ');
    buildFinds(true);
    /* Opening the modes is the biggest thing that happens to a new player
       after the tutorial, and it used to be silent: three buttons quietly
       changed colour behind the results. */
    var opened = !wasOpen && freeUnlocked();
    $('over-unlock').classList.toggle('hidden', !opened);
    if (opened) { $('over-unlock').textContent = t('over.unlocked.modes'); justOpened = true; }
    buildGoals(res, cd, stars, beat, rushRun);
    Game.pause();
    show('over');
  }

  /* ------------------------ what is next ---------------------- */
  /* One or two things to go back for, with how close you are: the best you
     did not beat, the star you did not get, the creature you are saving
     for. A results card that only says what happened gives no reason to
     press Ride again. */
  function buildGoals(res, cd, stars, beat, rushRun) {
    var box = $('over-goals'), goals = [];
    if (cd && stars < 3 && res.fishTotal) {
      var need = Math.round(res.fishTotal * (stars < 2 ? 0.40 : 0.75));
      if (!res.finished) goals.push({ txt: t('goal.finish'), p: 0 });
      else if (need > res.fish) goals.push({ txt: t('goal.star', { n: need - res.fish }), p: res.fish / need });
    } else if (!cd && !beat) {
      var bestV = rushRun ? save.bestRush : save.best, cur = rushRun ? res.dist : res.score;
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
    if (Game.drawFindPreview) Game.drawFindPreview($('find-art'), 140);
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
    Sfx.bubble();
    var kind = pick.kind;
    setTimeout(function () { Sfx.gold(); }, 560);
    if (Game.playFindOpen) {
      Game.playFindOpen($('find-art'), 140, kind, function () { finish(); });
    } else { finish(); }

    function finish() {
      opening = false;
      p.textContent = msg;
      p.classList.remove('hidden');
      /* restart the reveal even when the same prize comes up twice */
      p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
      buildFinds(false);
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
      case 'tut-skip':   Sfx.click(); skipTutorial(); break;
      case 'tut-first':  Sfx.click(); ride(COURSES[0].id); break;
      case 'shop':       Sfx.click(); shopBack = currentScreen; show('shop'); break;
      case 'settings':   Sfx.click(); shopBack = currentScreen; show('settings'); break;
      case 'trophies':   Sfx.click(); shopBack = currentScreen; show('ach'); break;
      case 'runs':       Sfx.click(); shopBack = currentScreen; show('runs'); break;
      case 'retry':      Sfx.click(); ride(lastCourse, lastMode); break;
      case 'back-title':
        Sfx.click();
        /* Leaving the market puts you back where you opened it from, so
           browsing between runs does not throw away the end card. */
        if ((currentScreen === 'shop' || currentScreen === 'settings' ||
             currentScreen === 'ach' || currentScreen === 'runs') &&
            (shopBack === 'over' || shopBack === 'pause')) {
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
  var BUZZ = { crash: [60, 40, 90], gold: 28, find: [20, 30, 20], rush: [30, 20, 30],
               clock: 16, ring: 12, save: [40, 30, 40], land: 24, close: 18,
               finish: [30, 40, 60], timeup: [80] };
  function onFx(e) { if (BUZZ[e] !== undefined) buzz(BUZZ[e]); }

  /* ---------------------------- shop ------------------------- */
  var shopBack = null;

  function wallet() {
    $('wallet-fish').textContent = save.fish + ' ' + t('cur.fish');
    $('wallet-gold').textContent = save.gold + ' ' + t('cur.gold');
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
      var ga = a.currency === 'gold' ? 1 : 0, gb = b.currency === 'gold' ? 1 : 0;
      return ga !== gb ? ga - gb : a.price - b.price;
    });
    for (var i = 0; i < list.length; i++) grid.appendChild(card(list[i]));
  }

  function card(sk) {
    var el = document.createElement('div');
    el.className = 'skin-card' + (save.equipped === sk.id ? ' worn' : '')
                               + (owns(sk.id) ? ' owned' : '');
    var cv = document.createElement('canvas');
    cv.className = 'skin-pic';
    el.appendChild(cv);
    Game.drawSkinPreview(cv, sk.id, 88);

    /* Portrait and words are separate boxes so a narrow screen can stand
       them side by side instead of making every card a screenful. */
    var info = document.createElement('div');
    info.className = 'skin-info';
    el.appendChild(info);

    var h = document.createElement('div');
    h.className = 'skin-name'; h.textContent = t('skin.' + sk.id + '.name', null, sk.name);
    info.appendChild(h);

    var perk = document.createElement('div');
    perk.className = 'skin-perk';
    perk.textContent = t('skin.' + sk.id + '.perk', null, sk.perkText);
    info.appendChild(perk);

    var b = document.createElement('button');
    b.className = 'btn btn-sm';
    b.setAttribute('data-skin', sk.id);
    if (save.equipped === sk.id) {
      b.textContent = t('shop.wearing'); b.disabled = true; b.className += ' btn-ghost';
    } else if (owns(sk.id)) {
      b.textContent = t('shop.wear'); b.className += ' btn-green';
    } else {
      var icon = ' ' + t(sk.currency === 'gold' ? 'cur.gold' : 'cur.fish');
      b.textContent = sk.price + icon;
      var canAfford = balance(sk.currency) >= sk.price;
      b.className += canAfford ? ' btn-blue' : ' btn-ghost';
      b.disabled = !canAfford;
      if (!canAfford) b.title = t('shop.needmore', { n: sk.price - balance(sk.currency) });
    }
    info.appendChild(b);
    return el;
  }

  $('shop-grid').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-skin]') : null;
    if (!b || b.disabled) return;
    var sk = SKIN_BY_ID[b.getAttribute('data-skin')];
    if (!sk) return;
    if (!owns(sk.id)) {
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
    buildShop();
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
  /* Something on the Market shelf can be bought right now. Spare lives do
     not count: once the purse holds 250 they always could, and a badge that
     is always lit says nothing. */
  function canBuyCreature() {
    for (var i = 0; i < SKINS.length; i++) {
      var s = SKINS[i];
      if (!s.price || save.owned.indexOf(s.id) >= 0) continue;
      if ((s.currency === 'gold' ? save.gold : save.fish) >= s.price) return true;
    }
    return false;
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
  function showWon(won, tasks) {
    var box = $('over-won');
    tasks = tasks || [];
    box.textContent = '';
    box.classList.toggle('hidden', !won.length && !tasks.length);
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
      row.textContent = t('ach.' + a.id + '.name') + '   +' + a.reward + ' ' + t('cur.fish');
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
    var done = 0;
    for (var i = 0; i < ACHIEVEMENTS.length; i++)
      if (save.ach.indexOf(ACHIEVEMENTS[i].id) >= 0) done++;
    $('ach-count').textContent = t('ach.count', { a: done, b: ACHIEVEMENTS.length });

    var list = $('ach-list');
    list.textContent = '';
    ACHIEVEMENTS.forEach(function (a) {
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
      right.textContent = got ? ('✓ ' + t('ach.earned'))
                              : (p.cur + ' / ' + p.goal);
      var rew = document.createElement('small');
      rew.textContent = '+' + a.reward + ' ' + t('cur.fish');
      right.appendChild(rew);
      row.appendChild(right);

      list.appendChild(row);
    });
  }

  /* -------------------------- settings ----------------------- */
  function buildSettings() {
    var row = $('lang-row');
    row.textContent = '';
    LANGS.forEach(function (L) {
      var b = document.createElement('button');
      b.className = 'chip' + (getLang() === L.id ? ' on' : '');
      b.textContent = L.label;
      b.setAttribute('data-lang', L.id);
      b.setAttribute('aria-pressed', getLang() === L.id ? 'true' : 'false');
      row.appendChild(b);
    });
    syncToggles();
  }

  $('lang-row').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-lang]') : null;
    if (!b) return;
    var id = b.getAttribute('data-lang');
    if (id === getLang()) return;
    setLang(id);
    save.lang = getLang();
    store();
    Sfx.click();
    /* Everything already on the page is re-read, and the two screens that
       build themselves are rebuilt, so nothing is left in the old language. */
    applyI18n();
    buildSettings();
    buildShop();
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
      if (!save.tutDone && !save.runs && currentScreen === 'title') ride('tutorial');
      else show(currentScreen === 'title' ? 'title' : currentScreen);
      pushScore();
      announce('gameReady');
    });
  });
})();
