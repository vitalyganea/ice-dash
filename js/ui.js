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
  /* the timed pickups the Market upgrades (1.3.4), their seconds at level 0,
     and what each next level costs in golden fish */
  var UPGRADES = [{ id: 'rush', base: 6 }, { id: 'chill', base: 3 }, { id: 'twin', base: 8 },
                  { id: 'call', base: 5 }, { id: 'clock', base: 3 }];
  var UP_MAX = 10, UP_COST = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
    return { best: 0, boardBest: 0, cardSent: 0, runs: 0, sfx: true, music: true,
             fish: 0, gold: 0, owned: ['snowcap'], equipped: 'snowcap', up: {},
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
             /* Graphics, as chosen in Settings: effects and sharpness, each
                'auto' (left to the device) or 0 high, 1 medium, 2 low;
                until then the platform's default (gfxDefault) */
             gfx: gfxDefault(),
             /* What the badges have already shown: the creatures seen on the
                shelf while affordable, and the day More modes was last opened.
                A badge says something new, and looking at it puts it out. */
             marketSeen: [], modesSeen: '',
             /* per creature: running totals and how many of its three
                stories are open (album.js) */
             album: {},
             /* the creatures whose comic has been read through (or skipped) */
             comicSeen: {},
             /* each creature's own skin: the ones bought, and which
                creatures are in theirs: { own: [ids], on: { creature: id } } */
             alts: { own: [], on: {} },
             /* the profile card: frames bought, and the frame and title on it */
             prof: { own: ['ice'], frame: 'ice', title: 'rookie', medals: [] },
             /* events (events.js): { id: { g: gifts gathered, got: [steps claimed] } } */
             ev: {},
             /* when the free gift beside the Market was last opened (ms; 0
                never): it comes back GIFT_EVERY later (1.3.3) */
             gift: 0 };
  }
  /* Switches a platform's adapter may set before the game loads (only
     crazygames.js does). Unset, everything behaves as it always has. */
  var PLAT = window.ICEDASH_PLATFORM || {};
  var save = defaults();
  var canSave = false, saving = false, saveAgain = false;

  function adopt(raw) {
    if (!raw) return;
    try {
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return;
      save.best  = Math.max(0, parseInt(o.best, 10) || 0);
      /* the highest score the board has taken; a save from before it was
         kept had sent its best with every save, so that is taken */
      save.boardBest = o.boardBest === undefined ? save.best : Math.max(0, parseInt(o.boardBest, 10) || 0);
      save.cardSent = Math.max(0, parseInt(o.cardSent, 10) || 0);   // the card the cards board last took (1.3.1)
      save.runs  = Math.max(0, parseInt(o.runs, 10) || 0);
      save.sfx   = o.sfx !== false;
      save.music = o.music !== false;
      save.vibrate = o.vibrate !== false;
      save.gfx = o.gfx && typeof o.gfx === 'object' ? { fx: gfxLvl(o.gfx.fx, true), res: gfxLvl(o.gfx.res) } : gfxDefault();
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
      /* the Market's upgrades (1.3.4): a level 0-10 for each timed pickup */
      save.up = {};
      UPGRADES.forEach(function (U) {
        var lv = o.up && typeof o.up === 'object' ? parseInt(o.up[U.id], 10) || 0 : 0;
        if (lv > 0) save.up[U.id] = Math.min(UP_MAX, lv);
      });
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
      /* a time ahead of the clock (the clock put back) counts from now */
      save.gift = Math.min(Date.now(), Math.max(0, parseInt(o.gift, 10) || 0));
      save.courses = {};
      if (o.courses && typeof o.courses === 'object')
        for (var cid in o.courses)
          if (courseById(cid))
            save.courses[cid] = Math.max(0, Math.min(3, parseInt(o.courses[cid], 10) || 0));
      /* skins and the profile (1.3.0): only ids this build knows */
      save.alts = { own: [], on: {} };
      if (o.alts && typeof o.alts === 'object') {
        if (Object.prototype.toString.call(o.alts.own) === '[object Array]')
          o.alts.own.forEach(function (id) { if (ALT_BY_ID[id] && save.alts.own.indexOf(id) < 0) save.alts.own.push(id); });
        if (o.alts.on && typeof o.alts.on === 'object')
          for (var ak2 in o.alts.on) {
            var aid2 = o.alts.on[ak2];
            if (SKIN_BY_ID[ak2] && ALT_BY_ID[aid2] && ALT_BY_ID[aid2].of === ak2 && save.alts.own.indexOf(aid2) >= 0) save.alts.on[ak2] = aid2;
          }
      }
      /* the events: a count and the steps claimed, for events this build knows */
      /* the dragon's egg (1.3.4) */
      var eg = o.egg && typeof o.egg === 'object' ? o.egg : {};
      save.egg = { day: typeof eg.day === 'string' ? eg.day : '', today: Math.max(0, Math.min(DRAGON.perDay, parseInt(eg.today, 10) || 0)),
                   fed: Math.max(0, Math.min(10, parseInt(eg.fed, 10) || 0)), hatched: eg.hatched === true };
      save.boardName = typeof o.boardName === 'string' ? o.boardName.slice(0, 24) : '';
      save.ev = {};
      if (o.ev && typeof o.ev === 'object' && typeof eventById === 'function')
        for (var evid in o.ev) {
          var EVk = eventById(evid), eo = o.ev[evid], egot = [];
          if (!EVk || !eo || typeof eo !== 'object') continue;
          if (Object.prototype.toString.call(eo.got) === '[object Array]')
            eo.got.forEach(function (i) { i = parseInt(i, 10); if (i >= 0 && i < EVk.stages.length && egot.indexOf(i) < 0) egot.push(i); });
          save.ev[evid] = { g: Math.max(0, parseInt(eo.g, 10) || 0), got: egot, seen: !!eo.seen };
        }
      save.prof = { own: ['ice'], frame: 'ice', title: 'rookie', medals: [] };
      if (o.prof && typeof o.prof === 'object') {
        if (Object.prototype.toString.call(o.prof.own) === '[object Array]')
          o.prof.own.forEach(function (id) { if (idxOf(FRAMES, id) >= 0 && save.prof.own.indexOf(id) < 0) save.prof.own.push(id); });
        if (save.prof.own.indexOf(o.prof.frame) >= 0) save.prof.frame = o.prof.frame;
        if (idxOf(TITLES, o.prof.title) >= 0) save.prof.title = o.prof.title;   // checked against the trophies once they are read
        /* the avatar: a known creature, and its own skin or none; whether
           they are still owned is asked each time it is shown (avatarOf) */
        if (o.prof.av && typeof o.prof.av === 'object' && SKIN_BY_ID[o.prof.av.skin])
          save.prof.av = { skin: o.prof.av.skin,
                           alt: ALT_BY_ID[o.prof.av.alt] && ALT_BY_ID[o.prof.av.alt].of === o.prof.av.skin ? o.prof.av.alt : '' };
      }
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
      if (!titleWon(save, TITLES[idxOf(TITLES, save.prof.title)])) save.prof.title = 'rookie';
      /* the medals shown: none to three trophies, each one earned */
      if (o.prof && Object.prototype.toString.call(o.prof.medals) === '[object Array]')
        o.prof.medals.forEach(function (id) {
          if (save.prof.medals.length < MEDAL_MAX && save.ach.indexOf(id) >= 0 && save.prof.medals.indexOf(id) < 0) save.prof.medals.push(id);
        });
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
    if (!PLAT.cloudLoad) return Promise.resolve();
    /* A save with runs in it starts at once and hears from the cloud later.
       A new one waits a moment for it, so a player who has installed the
       game again is not shown the tutorial over a save that is coming. */
    var asked = PLAT.cloudLoad(), answered = false;
    if (save.runs) { asked.then(cloudLate); return Promise.resolve(); }
    return Promise.race([
      asked.then(function (r) { answered = true; cloudTake(r); }),
      new Promise(function (r) { setTimeout(r, CLOUD_WAIT); })
    ]).then(function () { if (!answered) asked.then(cloudLate); });
  }

  /* ---- the save in the cloud (the Android app: Play Games saved games) ----
     The whole save also lives in the player's Play Games account, so
     installing the game again, or a new phone, brings everything back.
     Of two saves the one with more in it wins: more runs, then more fish
     caught. Nothing is written to the cloud before it has answered, so a
     phone that could not reach it, or a new one still waiting, never puts
     an empty save over a full one. The graphics stay this phone's own. */
  var CLOUD_WAIT = 5000;
  var cloudKnown = false;
  function cloudProgress(o) {
    if (!o) return -1;
    return Math.max(0, parseInt(o.runs, 10) || 0) * 100000 + Math.max(0, parseInt(o.totFish, 10) || 0);
  }
  /* the cloud's answer; true when its save had more in it and was taken */
  function cloudTake(r) {
    if (!r || !r.ok) return false;
    cloudKnown = true;
    var o = null;
    try { o = r.data ? JSON.parse(r.data) : null; } catch (e) {}
    if (!o || typeof o !== 'object' || cloudProgress(o) <= cloudProgress(save)) return false;
    var gfx = save.gfx;
    adopt(r.data);
    save.gfx = gfx;
    return true;
  }
  function pushCloud(data) {
    if (cloudKnown && PLAT.cloudSave) PLAT.cloudSave(data || JSON.stringify(save), cloudProgress(save));
  }
  /* an answer that came after the game had started */
  function cloudLate(r) {
    if (cloudTake(r)) { settle(); store(); }
    else pushCloud();
  }
  /* What a loaded save sets going: its language, its trophies, its
     switches, its graphics, its sound and its best on the board. At the
     start (first) the caller then picks the screen; when the cloud's save
     comes in later the screen in view is drawn again, unless a run is on. */
  function settle(first) {
    applyLook();
    setLang(save.lang);           // the cloud save may disagree with the device
    applyI18n();
    achCheck(save);               // anything the loaded save already earned
    syncToggles();
    applyGfx();                   // the save's own choice; the device's tier stays
    Sfx.sound(save.sfx);
    if (!first && currentScreen !== 'game') show(currentScreen);
    pushScore();
  }
  /* The player's card, to the cards board whenever it is not the one the
     board last took (native.js PLAT.cardSend): a new avatar, frame, title or
     trophy is seen by everyone at once (the owner, 19 Nov 2026). A moment
     after the change, so a few taps make one send. */
  var cardT = null;
  function cardSoon() {
    if (!PLAT.cardSend) return;
    if (cardT) clearTimeout(cardT);
    cardT = setTimeout(function () {
      cardT = null;
      var c = profileCode(myCard());
      if (c > 0 && c !== save.cardSent) PLAT.cardSend(c);
    }, 1200);
  }
  PLAT.cardSent = function (c) { if (c !== save.cardSent) { save.cardSent = c; store(); } };
  function store() {
    if (!canSave) return;
    cardSoon();
    if (saving) { saveAgain = true; return; }
    var data = JSON.stringify(save);
    if (!IN_YT) { try { localStorage.setItem(SAVE_KEY, data); } catch (e) {} pushScore(); pushCloud(data); return; }
    saving = true;
    window.ytgame.game.saveData(data).then(done, function () {
      window.ytgame.game.saveData(data).then(done, done);
    });
    function done() { saving = false; pushScore(); if (saveAgain) { saveAgain = false; store(); } }
  }
  var lastSent = -1;
  function pushScore() {
    /* A best the board has never taken (made with no network, or before
       signing in) goes up with a save until it has; one it has taken is not
       sent again, or it lands on the day's and the week's boards as well */
    if (PLAT.boardScore && save.best > (save.boardBest || 0)) PLAT.boardScore(save.best);
    /* the shared board (1.3.5) takes the save's best once, as its start */
    if (PLAT.boardBestIs && save.best > 0) PLAT.boardBestIs(save.best);
    if (!IN_YT || !window.ytgame.engagement) return;
    if (save.best === lastSent) return;
    lastSent = save.best;
    window.ytgame.engagement.sendScore({ value: save.best })
      .then(null, function () { lastSent = -1; });
  }

  /* ------------------------- elements ------------------------ */
  var $ = function (id) { return document.getElementById(id); };
  var screens = { title: $('screen-title'), profile: $('screen-profile'), help: $('screen-help'),
                  pause: $('screen-pause'), over: $('screen-over'),
                  shop: $('screen-shop'), settings: $('screen-settings'),
                  ach: $('screen-ach'), runs: $('screen-runs'), modes: $('screen-modes'), comic: $('screen-comic'),
                  revive: $('screen-revive'), tutdone: $('screen-tutdone'), board: $('screen-board'),
                  event: $('screen-event'), dragon: $('screen-dragon') };
  var hud = $('hud');
  var currentScreen = 'title';

  /* The screens that carry the always-visible back arrow. Every one of
     them already has a Back button; on the long ones it is a scroll away. */
  var BACKABLE = { help: 1, shop: 1, runs: 1, ach: 1, settings: 1, modes: 1, board: 1, profile: 1, event: 1, dragon: 1 };
  var justOpened = false;
  /* A spare life with all five already carried (1.3.4): offered for
     LIFE_PRICE fish, and sold anyway if the window goes without an answer,
     so it is never simply lost. */
  var lifeSale = '';
  function sellButton(id) {
    var b = $(id);
    if (!b) return;
    var on = lifeSale && id.indexOf(lifeSale) === 0;
    b.classList.toggle('hidden', !on);
    if (on) { b.disabled = false; b.textContent = t('life.sell', { n: LIFE_PRICE }); }
  }
  function settleLifeSale() {
    if (!lifeSale) return false;
    lifeSale = '';
    save.fish += LIFE_PRICE; store();
    ['find-sell', 'gift-sell'].forEach(function (id) { var b = $(id); if (b) b.classList.add('hidden'); });
    return true;
  }
  function sellLife(btn) {
    var where = lifeSale;
    if (!settleLifeSale()) return;
    Sfx.gold(); buzz(20);
    var msgEl = $(where === 'find' ? 'find-prize' : 'gift-prize');
    if (msgEl) msgEl.textContent = t('life.sold', { n: LIFE_PRICE });
    var r = btn.getBoundingClientRect();
    screenBurst('fish', r.left + r.width / 2, r.top + r.height / 2);
    if (typeof wallet === 'function') wallet();
  }
  function show(name) {
    settleLifeSale();
    closeSheet();
    currentScreen = name;
    for (var k in screens) screens[k].classList.toggle('hidden', k !== name);
    /* The pause button belongs to play and nothing else. This used to be
       written the other way round, so show('game') hid it — which happened
       whenever a run started before loadData() came back, taking away the
       only way to pause for the rest of that run. */
    hud.classList.toggle('hidden', name !== 'game');
    /* The hill behind the title is alive; behind any other menu it holds
       still. Those menus lie over the whole screen through a blur, and a
       hill moving under a blur is the blur worked out again on every frame:
       a phone grew warm while somebody read the Market. */
    if (name !== 'title' && name !== 'game' && Game.isDemo() && !Game.isPaused()) Game.pause();
    $('btn-back').classList.toggle('hidden', !BACKABLE[name]);
    tutChrome();
    if (name === 'tutdone')
      $('tutdone-go').textContent = t('tut.done.go', { n: t('course.' + COURSES[0].id + '.name') });
    if (name === 'help') buildHints();
    if (name === 'profile') buildProfile();
    if (name === 'event') buildEvent();
    if (name === 'dragon') buildEgg();
    if (evTimer && name !== 'event') { clearInterval(evTimer); evTimer = null; }
    if (name === 'shop') { shopTabTo('cr'); buildShop(); seeMarket(); }
    if (name === 'settings') buildSettings();
    if (name === 'ach') { buildTasks(); buildAch(); }
    if (name === 'runs') buildRuns();
    if (name === 'board') buildBoard();
    if (name === 'modes') {
      if (save.modesSeen !== dailyKey()) { save.modesSeen = dailyKey(); store(); }
      refreshModes();
    }
    if (name === 'title') {
      profileBtn();
      giftBtn();
      /* the hill comes alive behind the menu (unless a run is only paused) */
      if (!Game.isRunning()) Game.attract(save.equipped);
      if (Game.isDemo() && Game.isPaused()) Game.resume();
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
      bestPlaque();
      boardRank();
    }
    fitScreen();
  }
  /* The screens that are one panel and nothing to scroll for: on a short
     phone (an Oppo A9 in the app is about 360x730) the title was a few
     pixels taller than the window and slid up and down under a thumb. The
     lists — Market, trophies, settings — still scroll; they are meant to.
     A panel that does not fit first changes shape, and is scaled only for
     what is left: scaled alone, on a phone held sideways it went to half
     size, with 23px buttons and 5px words. In order: on a screen wider than
     tall, the panel's two groups side by side; then without what it can
     spare (both in css/style.css, .fit-wide and .fit-tight); then scaled,
     but not below MIN_ZOOM — past that the screen scrolls. */
  var FIT = { title: 1, pause: 1, over: 1, tutdone: 1, revive: 1, modes: 1 };
  var TWO = { title: 1, over: 1 };                 // panels built as two groups
  var MIN_ZOOM = 0.8;
  function fitScreen() {
    var scr = screens[currentScreen], panel = scr && scr.querySelector('.panel');
    if (!panel) return;
    panel.style.zoom = '';
    scr.classList.remove('fit-wide', 'fit-tight');
    if (!FIT[currentScreen] || !scr.clientHeight) return;
    function room() {
      var cs = getComputedStyle(scr);
      return scr.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
             - 8;                                  // the panel's own thick edge below it
    }
    if (panel.offsetHeight <= room()) return;
    var steps = TWO[currentScreen] && scr.clientWidth >= scr.clientHeight * 1.25
      ? [['fit-wide'], ['fit-wide', 'fit-tight']] : [['fit-tight']];
    for (var i = 0; i < steps.length; i++) {
      scr.classList.remove('fit-wide', 'fit-tight');
      for (var j = 0; j < steps[i].length; j++) scr.classList.add(steps[i][j]);
      if (panel.offsetHeight <= room()) return;
    }
    var k = room() / panel.offsetHeight;
    panel.style.zoom = Math.max(MIN_ZOOM, k).toFixed(3);
  }
  window.addEventListener('resize', fitScreen);
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
  var lastCourse = null, lastMode = null, rideEv = null;
  function ride(courseId, mode) {
    /* a run left paused behind the menu is banked, quietly, before another
       one replaces it */
    var left = (Game.isPaused && Game.isPaused() && Game.giveUp) ? Game.giveUp() : null;
    if (left && left.course !== 'tutorial') commitRun(left, true);
    pendingRes = null;
    adLifeUsed = false;
    if (tickT) { clearInterval(tickT); tickT = null; }
    lastCourse = courseId || null;
    lastMode = (!courseId && mode) || null;
    showGame();
    Sfx.unlock();
    hideLesson(); waitingFor = null;
    /* Each mode is measured against its own best: Time Rush in metres. */
    /* an event's gifts are on the Freeride hill only (events.js) */
    rideEv = (!lastCourse && !lastMode && typeof liveEvent === 'function') ? liveEvent() : null;
    rideKoi = !lastMode && !!lastCourse && !!(courseById(lastCourse) || {}).koi && typeof dragonOn === 'function' && dragonOn();
    if (Game.setBoosts) Game.setBoosts(save.up);
    Game.start(lastMode === 'rush' ? save.bestRush : lastMode === 'avalanche' ? save.bestAv : save.best,
               { hud: function () {}, over: onOver, lesson: onLesson, fx: onFx },
               save.equipped, lastCourse, save.lives || 0, { mode: lastMode, gifts: !!rideEv, koi: rideKoi });
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
  /* With a mouse and no touch screen, a platform that asks for it
     (deskWords) gets the lines that say click or Space instead of tap. */
  function lessonKey(key) {
    if (!PLAT.deskWords || !STRINGS[key + '.desk']) return key;
    var coarse = window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches;
    return coarse ? key : key + '.desk';
  }
  function onLesson(m) {
    waitingFor = (m && m.wait) ? m : null;
    if (!m || !m.key) { hideLesson(); return; }
    if (tutHideT) { clearTimeout(tutHideT); tutHideT = null; }
    var box = $('tut'), card = $('tut-card'), ico = $('tut-ico'), tap = $('tut-tap');
    $('tut-text').innerHTML = t(lessonKey(m.key)); // our own strings, some with <b>
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
    if (res.coins) bits.push('+' + res.coins + '\u00a0' + t('cur.fish', { n: res.coins }));
    if (res.gold)  bits.push('+' + res.gold + '\u00a0' + t('cur.gold', { n: res.gold }));
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
    if (res.canRevive) { pendingRes = res; showRevive(false); return; }
    /* With no life in hand, the Android app can offer a short ad instead —
       once a run, and only when one is loaded and ready to play. */
    if ((res.rescuable || res.crashed) && !adLifeUsed && adReady()) { pendingRes = res; showRevive(true); return; }
    commitRun(res);
  }

  /* ---- rewarded ads (the Android app only) ----
     PLAT.adReady / PLAT.showAd come from js/native.js. Everywhere else they
     are missing and none of this is ever shown. */
  var adLifeUsed = false, adWaiting = false;
  function adReady() { return !adWaiting && !!(PLAT.adReady && PLAT.adReady()); }
  function playAd(done) {
    adWaiting = true;
    PLAT.showAd(function (earned) { adWaiting = false; done(!!earned); });
  }

  function showRevive(ad) {
    var n = ad ? 0 : (save.lives || 0);
    /* What the life buys: carrying on from the fall, ten more seconds when
       Time Rush's clock has run out, or the snow pushed back in Avalanche. */
    var r = pendingRes || {}, why = r.crashed ? '' : r.mode === 'rush' ? '.time' : r.caught ? '.snow' : '';
    var sub = $('revive-sub'), key = (ad ? 'revive.adsub' : 'revive.sub') + why;
    sub.setAttribute('data-i18n', key);
    sub.textContent = t(key);
    var head = document.querySelector('#screen-revive .panel-title-text');
    var hk = why === '.time' ? 'over.timeup' : why === '.snow' ? 'over.caught' : 'revive.title';
    head.setAttribute('data-i18n', hk);
    head.textContent = t(hk);
    $('revive-count').classList.toggle('hidden', ad);
    document.querySelector('#revive-buttons [data-action="use-life"]').classList.toggle('hidden', ad);
    document.querySelector('#revive-buttons [data-action="ad-life"]').classList.toggle('hidden', !ad);
    $('revive-count').textContent = t('revive.left', { n: n });
    var hs = $('revive-hearts');
    hs.textContent = '';
    for (var i = 0; i < Math.min(5, n); i++) {
      var h = document.createElement('span');
      h.className = 'heart';
      hs.appendChild(h);
    }
    reviveScore(r);
    $('revive-tick').classList.add('hidden');
    $('revive-buttons').classList.remove('hidden');
    Game.pause();
    show('revive');
  }

  /* What the run has so far and how far it is from the best, measured as the
     run will be when it ends (points in Freeride and the Daily Line, metres
     in Time Rush and Avalanche; a Known Line has stars, so only its points),
     so the player can tell whether a life is worth spending (the owner,
     18 Nov 2026). */
  function reviveScore(r) {
    var cd = r.course ? courseById(r.course) : null;
    var rush = r.mode === 'rush', av = r.mode === 'avalanche', metres = rush || av;
    var val = metres ? (r.dist || 0) : (r.score || 0);
    var best = cd ? 0 : rush ? (save.bestRush || 0) : av ? (save.bestAv || 0) : (save.best || 0);
    $('revive-num').textContent = num(val);
    $('revive-unit').textContent = metres ? t('unit.m') : t('title.best.unit', { n: val });
    var gap = $('revive-gap'), beat = best > 0 && val > best;
    gap.classList.toggle('beat', beat);
    var d = best - val;                  // the plural picked on the number, then the number spaced
    gap.textContent = !best ? '' : beat ? t('over.newbest')
      : t(metres ? 'goal.bestm' : 'goal.best', { n: d }).replace(String(d), num(d));
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
    countIn(function () {
      save.lives = Math.max(0, (save.lives || 0) - 1);
      store();
      return Game.revive();
    });
  }
  /* The ad is played first; only an ad watched to the end pays. Closed
     early, or none to play after all, the choice is put back as it was —
     minus the ad button if there is no other ad ready behind it. */
  function adLife() {
    var r = pendingRes;
    if (!r || !adReady()) return;
    $('revive-buttons').classList.add('hidden');
    playAd(function (earned) {
      if (pendingRes !== r) return;            // the run was ended meanwhile
      if (earned) { adLifeUsed = true; countIn(function () { return Game.reviveFree(); }); return; }
      $('revive-buttons').classList.remove('hidden');
      if (!adReady()) {
        document.querySelector('#revive-buttons [data-action="ad-life"]').classList.add('hidden');
        $('revive-sub').textContent = t('ad.none');
      }
    });
  }
  /* Three, two, one, and back on the hill; `spend` pays for it and says
     whether the revive happened. */
  function countIn(spend) {
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
      var r = pendingRes;
      pendingRes = null;
      if (spend()) { showGame(); Game.resume(); }
      else { commitRun(r || { score: 0, dist: 0, fish: 0, gold: 0 }); }
    }, 800);
  }
  function noLife() {
    if (tickT) { clearInterval(tickT); tickT = null; }
    var r = pendingRes; pendingRes = null;
    commitRun(r || { score: 0, dist: 0, fish: 0, gold: 0, coins: 0 });
  }

  /* What the run paid, as the results show it. Kept, because a rewarded ad
     can double the fish after the screen is up. */
  var paid = { coins: 0, starPay: 0, gold: 0, doubled: false };
  function showEarned() {
    var earned = $('over-earned');
    var bits = [];
    if (paid.coins) bits.push('+' + paid.coins + '\u00a0' + t('cur.fish', { n: paid.coins }));
    if (paid.starPay) bits.push(t('over.starpay', { n: paid.starPay }));
    if (paid.gold)  bits.push('+' + paid.gold + '\u00a0' + t('cur.gold', { n: paid.gold }));
    earned.textContent = bits.join('   ');
    earned.classList.toggle('hidden', !bits.length);
  }
  /* The run's fish once more, for an ad watched to the end. Once a run:
     the button goes for good the moment it pays. */
  function adDouble() {
    var n = paid.coins, row = $('over-double');
    if (!n || paid.doubled || !adReady()) return;
    row.classList.add('hidden');
    playAd(function (earned) {
      if (!earned) { row.classList.toggle('hidden', !adReady()); return; }
      save.fish += n;
      paid.coins += n;
      paid.doubled = true;
      store();
      showEarned();
      var el = $('over-earned'), r = el.getBoundingClientRect();
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
      screenBurst('fish', r.left + r.width / 2, r.top + r.height / 2);
      Sfx.gold();
    });
  }

  /* ---- the Freeride board (the Android app only) ---- */
  function boardReady() { return !!(PLAT.boardReady && PLAT.boardReady()); }
  /* The best on the title, a plaque of gold. Where there is a board it is
     the way to it as well (there is no other button for it on the title),
     and once Google has said, it carries the player's own place, "#101".
     The place is kept on the device (outside the save, like the graphics
     tier), so the title shows it at once and asks Google again only now
     and then. */
  var RANK_KEY = 'icedash-rank', RANK_EVERY = 5 * 60000;
  var myRank = 0, rankAt = 0, rankFor = -1, rankBusy = false;
  if (PLAT.boardMine) {
    try {
      var rc = JSON.parse(localStorage.getItem(RANK_KEY) || 'null');
      if (rc && rc.rank > 0) { myRank = rc.rank | 0; rankAt = +rc.at || 0; rankFor = +rc.best || -1; }
    } catch (e) {}
  }
  function bestPlaque() {
    var el = $('title-best'), go = boardReady();
    $('bp-lab').textContent = t('title.best.lab');
    $('bp-num').textContent = num(save.best);
    $('bp-unit').textContent = t('title.best.unit', { n: save.best });
    $('bp-rank-num').textContent = myRank ? t('title.rank.num', { n: num(myRank) }) : '';
    $('bp-rank-num').classList.toggle('hidden', !myRank);
    $('bp-rank-lab').textContent = t('btn.board');      // until Google has said
    $('bp-rank-lab').classList.toggle('hidden', !!myRank);
    $('bp-rank').classList.toggle('hidden', !go);
    el.classList.toggle('to-board', go);
    if (go) {
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('data-action', 'board');
    } else {
      el.setAttribute('role', 'status');
      el.removeAttribute('tabindex');
      el.removeAttribute('data-action');
    }
    el.setAttribute('aria-label', t('title.best', { n: save.best }) +
      (go && myRank ? '. ' + t('title.rank.lab') + ' ' + num(myRank) : '') + (go ? '. ' + t('btn.board') : ''));
    el.classList.toggle('hidden', save.best <= 0);
    /* Two numbers on a narrow phone: when the place would go down under
       the best (#10 000 on a phone 320 px across), the word "points" goes
       instead, and only then. */
    el.classList.remove('tight');
    var me = el.parentNode && el.parentNode.classList.contains('title-me') ? el.parentNode : null;
    if (me) me.classList.remove('stack');
    var words = el.querySelector('.bp-text'), place = $('bp-rank');
    function under() { return go && words.offsetHeight && place.offsetTop - words.offsetTop > 10; }
    if (under()) el.classList.add('tight');
    /* still two lines beside My profile's avatar: the avatar goes above
       the plaque, and the plaque has the whole row (1.3.3) */
    if (me && under()) { me.classList.add('stack'); el.classList.remove('tight'); if (under()) el.classList.add('tight'); }
  }
  /* Asked of Google when the title comes up: once every five minutes, or
     at once when the best has changed since. The answer comes in behind
     the place already shown. */
  function boardRank() {
    if (!PLAT.boardMine || !boardReady() || rankBusy || save.best <= 0) return;
    if (rankFor === save.best && Date.now() - rankAt < RANK_EVERY) return;
    rankBusy = true;
    var want = save.best;
    PLAT.boardMine().then(function (r) {
      rankBusy = false;
      if (!r || !(r.rank > 0)) return;
      myRank = r.rank; rankAt = Date.now(); rankFor = want;
      try { localStorage.setItem(RANK_KEY, JSON.stringify({ rank: myRank, best: want, at: rankAt })); } catch (e) {}
      if (currentScreen === 'title') bestPlaque();
    }, function () { rankBusy = false; });
  }
  $('title-best').addEventListener('keydown', function (e) {
    if (!boardReady() || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    act('board');
  });
  /* native.js finds out whether there is a board after the page is up,
     and says so with this event. */
  function boardButtons() {
    bestPlaque();
    boardRank();
    if (!boardReady()) $('over-board').classList.add('hidden');
  }
  window.addEventListener('icedash-board', boardButtons);
  boardButtons();

  /* The board's own panel. Google keeps the scores and native.js fetches
     them; laid out here like the rest of the game: places 1 to 100 in a
     list that scrolls inside the panel, a cup for each of the first three,
     the place on a disc after that, the Play Games name and the score. The
     player's own row is edged in green; further down than 100, it comes
     after the hundredth, with the player's real place on it. */
  var boardSpan = 'all', boardAsk = 0;
  var CUP = [['#ffd84a', '#b97f00'], ['#e8eef4', '#7f8f9e'], ['#eba56b', '#9a531e']];
  function cupSvg(place) {
    var c = CUP[place - 1];
    return '<svg viewBox="0 0 40 40" role="img" aria-label="' + place + '">' +
      '<path d="M10.5 10H5.5c0 5.5 2.5 8.5 7 9.2M29.5 10h5c0 5.5-2.5 8.5-7 9.2" fill="none" stroke="' + c[1] +
        '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M10 5.5h20v8c0 6.8-4.4 11.3-10 11.3S10 20.3 10 13.5z" fill="' + c[0] + '" stroke="' + c[1] +
        '" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="M13.6 8.5v5c0 2.6 1 4.8 2.6 6.3" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>' +
      '<rect x="17.6" y="24.6" width="4.8" height="5" fill="' + c[1] + '"/>' +
      '<rect x="11.5" y="29.4" width="17" height="5.6" rx="2" fill="' + c[0] + '" stroke="' + c[1] + '" stroke-width="2.2"/>' +
      '<text x="20" y="18.2" text-anchor="middle" font-size="10.5" font-weight="900" fill="' + c[1] + '">' + place + '</text>' +
      '</svg>';
  }
  /* A row's card: the player's own as it is now; anyone else's as it went
     up with a score (a Play Games tag, a Game Center context), or none.
     Play Games and Game Center keep only the card of a board's best score,
     so on the all-time board a card stays as it was when the best was set:
     a player who chose an avatar afterwards was shown the old one, or none
     if the best came from before 1.3.0 (reported by the owner, 19 Nov 2026).
     The day's and the week's boards get every run since 1.3.0 (row 177), so
     their cards are newer: a row takes the freshest card seen for that
     player (by name, all a row has), today's, then this week's, then its
     own. The fresher boards are fetched alongside (fetchFresh). */
  var freshCards = { cards: {}, day: {}, week: {} };
  function cardCode(x) { var c = x && (x.tag || x.ctx); return c && c !== '0' ? c : 0; }
  function noteCards(span, rows) {
    if (!freshCards[span]) return;
    (rows || []).forEach(function (x) { var c = cardCode(x); if (x && x.name && c) freshCards[span][x.name] = c; });
  }
  function rowCard(x) {
    if (x.me) return myCard();
    var c = freshCards.cards[x.name] || (boardSpan !== 'day' && freshCards.day[x.name]) || (boardSpan === 'all' && freshCards.week[x.name]) || cardCode(x);
    return profileFrom(c || 0);
  }
  /* the fresher boards' cards, quietly, then the avatars painted again: the
     cards board (1.3.1: each player's card as it is now, the hundred newest),
     and today's and this week's */
  function fetchFresh(list, ask) {
    var spans = (PLAT.cardTop ? ['cards'] : []).concat(boardSpan === 'all' ? ['day', 'week'] : boardSpan === 'week' ? ['day'] : []);
    spans.forEach(function (sp) {
      (sp === 'cards' ? PLAT.cardTop() : PLAT.boardTop(sp)).then(function (r) {
        noteCards(sp, r && r.rows);
        if (ask !== boardAsk || currentScreen !== 'board') return;
        Array.prototype.forEach.call(list.querySelectorAll('.board-row'), function (row) {
          var card = rowCard(row.boardRow), av = row.querySelector('.board-av');
          if (!av) return;
          av.className = 'board-av pf-' + ((card && card.frame) || 'ice') + (card ? '' : ' none');
          av.textContent = '';
        });
        paintAvatars(list);
      }, function () {});
    });
  }
  function boardRow(x) {
    var row = document.createElement('button');
    row.className = 'board-row' + (x.me ? ' me' : '');
    row.boardRow = x;
    var place = document.createElement('span');
    place.className = 'board-place';
    if (x.rank >= 1 && x.rank <= 3) place.innerHTML = cupSvg(x.rank);
    else { place.classList.add('num'); place.textContent = x.rank > 0 ? x.rank : '–'; }
    var name = document.createElement('span');
    name.className = 'board-name';
    var who = document.createElement('span');
    who.className = 'board-who';
    who.textContent = x.name || '—';
    name.appendChild(who);
    if (x.me) {
      var you = document.createElement('small');
      you.textContent = t('board.you');
      name.appendChild(you);
    }
    var score = document.createElement('span');
    score.className = 'board-score';
    score.textContent = num(x.score || 0);
    /* the card's picture, small, in its frame; painted a few rows a frame
       after the list is up (paintAvatars), a hundred at once held it up */
    var av = document.createElement('span');
    var card = rowCard(x);
    av.className = 'board-av pf-' + ((card && card.frame) || 'ice') + (card ? '' : ' none');
    row.appendChild(place); row.appendChild(av); row.appendChild(name); row.appendChild(score);
    return row;
  }
  /* The face on a row is the player's avatar as My profile shows it (the
     portrait), not the creature as it rides the hill (the owner, 20 Nov
     2026). Each creature and skin is painted once and copied to every row
     that wears it. */
  var avatarJob = 0, rowFaces = {};
  function rowFace(skin, alt) {
    var key = skin + ':' + alt, f = rowFaces[key];
    if (!f) {
      f = document.createElement('canvas');
      if (typeof drawPortrait === 'function') drawPortrait(f, 34, skin, alt);
      else Game.drawSkinPreview(f, skin, 34, alt);
      rowFaces[key] = f;
    }
    var cv = document.createElement('canvas');
    cv.width = f.width; cv.height = f.height;
    cv.getContext('2d').drawImage(f, 0, 0);
    return cv;
  }
  function paintAvatars(list) {
    var job = ++avatarJob, rows = Array.prototype.slice.call(list.querySelectorAll('.board-row')), i = 0;
    (function some() {
      if (job !== avatarJob) return;
      for (var n = 0; n < 8 && i < rows.length; n++, i++) {
        var card = rowCard(rows[i].boardRow), av = rows[i].querySelector('.board-av');
        if (!card || !av) continue;
        av.appendChild(rowFace(card.skin, card.alt || ''));
      }
      if (i < rows.length) requestAnimationFrame(some);
    })();
  }
  /* A tap on a row: that player's card */
  $('board-list').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.board-row') : null;
    if (!b || !b.boardRow) return;
    var x = b.boardRow, card = rowCard(x);
    Sfx.click();
    var box = $('sheet-prof-card');
    box.textContent = '';
    box.appendChild(profileCard(card || { skin: 'snowcap', frame: 'ice', title: 'rookie', trophies: 0 },
                                { name: x.me ? t('prof.you') : (x.name || '—'), best: x.score, rank: x.rank, size: 118, hero: true }));
    $('sheet-prof-note').textContent = card ? '' : t('prof.nocard');
    $('sheet-prof').classList.remove('hidden');
  });
  function syncBoardSpan() {
    Array.prototype.forEach.call(document.querySelectorAll('.q-opt[data-span]'), function (b) {
      var on = b.getAttribute('data-span') === boardSpan;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }
  var BOARD_WAIT = 12000;
  function buildBoard() {
    syncBoardSpan();
    var list = $('board-list'), note = $('board-note'), ask = ++boardAsk;
    function say(key) { note.textContent = key ? t(key) : ''; note.classList.toggle('hidden', !key); }
    list.innerHTML = '';
    say('');
    if (!PLAT.boardTop) { say('board.off'); return; }
    /* Google takes a moment: a wheel turns where the rows will be, the list
       as tall as it will be, so the panel does not jump when they come. */
    var wait = document.createElement('div');
    wait.className = 'board-loading';
    wait.setAttribute('role', 'status');
    var wheel = document.createElement('span');
    wheel.className = 'board-wheel';
    wheel.setAttribute('aria-hidden', 'true');
    wait.appendChild(wheel);
    wait.appendChild(document.createTextNode(t('board.loading')));
    list.appendChild(wait);
    /* With no network Play Games may not answer at all: the wheel does not
       turn for ever. A list that still comes later is shown all the same. */
    setTimeout(function () {
      if (ask === boardAsk && currentScreen === 'board' && wait.parentNode === list) { list.innerHTML = ''; say('board.off'); }
    }, BOARD_WAIT);
    PLAT.boardTop(boardSpan).then(function (r) {
      /* a slow answer for a span since left, or a panel since closed */
      if (ask !== boardAsk || currentScreen !== 'board') return;
      list.innerHTML = '';
      var rows = (r && r.rows) || [], me = r && r.me;
      /* the player's own name on the board, kept for the dragon's comic */
      if (me && me.name && String(me.name).slice(0, 24) !== save.boardName) { save.boardName = String(me.name).slice(0, 24); store(); }
      noteCards(boardSpan, rows);
      var mine = null;
      rows.forEach(function (x) { var el = boardRow(x); if (x.me) mine = el; list.appendChild(el); });
      if (me && me.rank > 0 && !mine) {
        me.me = true;
        list.appendChild(mine = boardRow(me));
      }
      /* A best in the save (sent to the board at every start, so on today's
         and this week's too) and no row of the player's own: Play Games
         lists only public profiles, and a new one is private. Without a word
         the player takes the best for lost. */
      say(!mine && save.best > 0 ? 'board.private' : rows.length ? '' : 'board.empty');
      paintAvatars(list);
      fetchFresh(list, ask);
      /* the list opens at the top, or with the player's own row in view */
      list.scrollTop = 0;
      if (mine && mine.offsetTop + mine.offsetHeight > list.clientHeight)
        list.scrollTop = mine.offsetTop - list.clientHeight / 2 + mine.offsetHeight / 2;
    }, function () {
      if (ask === boardAsk && currentScreen === 'board') { list.innerHTML = ''; say('board.off'); }
    });
  }
  Array.prototype.forEach.call(document.querySelectorAll('.q-opt[data-span]'), function (b) {
    b.addEventListener('click', function () {
      Sfx.click();
      boardSpan = b.getAttribute('data-span');
      buildBoard();
    });
  });

  function commitRun(res, quiet) {
    var wasOpen = freeUnlocked();
    save.runs++;
    /* A marked run has its own scoreboard: stars, not distance. The freeride
       best must not be moved by a course, or a short course would look like
       a bad run forever. */
    var cd = res.course ? courseById(res.course) : null;
    var stars = cd ? courseStars(cd, res) : 0;
    /* The Daily Line keeps its own stars, for today only, and a streak of
       days finished; it never touches the marked lines' board. */
    var streakNow = 0, starPay = 0, threeNow = false;
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
      threeNow = stars === 3 && (save.courses[cd.id] || 0) < 3;
      if (stars > (save.courses[cd.id] || 0)) save.courses[cd.id] = stars;
    }
    var rushRun = res.mode === 'rush', avRun = res.mode === 'avalanche';
    var mRun = rushRun || avRun;                     // scored in metres
    var beat = !cd && !mRun && res.score > save.best;
    if (beat) save.best = res.score;
    /* every Freeride run goes to the board: its day, its week and its best
       are the board's to keep (it was handed the best of all time) */
    if (!cd && !mRun && res.score > 0 && PLAT.boardScore) PLAT.boardScore(res.score, res);   // the run itself: the shared board checks its metres and seconds
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
    /* the event's gifts, counted in even if it ended while he rode */
    if (res.gifts > 0 && rideEv) eventState(save, rideEv).g += res.gifts;
    var koiFed = (res.kois > 0 && rideKoi) ? dragonFeed(save, res.kois) : null;
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
    paid = { coins: res.coins || 0, starPay: starPay, gold: res.gold || 0, doubled: false };
    showEarned();
    $('over-double').classList.toggle('hidden', !(paid.coins > 0 && adReady()));
    $('over-board').classList.toggle('hidden', !(boardReady() && !cd && !mRun));
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
    /* A line finished: the next one is a tap away, not a trip through the
       menu (asked for by the owner, 17 Nov 2026). It leads, and running
       this one again steps back to a plain button beside it. */
    var ci = -1;
    if (cd && res.finished) for (var cj = 0; cj < COURSES.length; cj++) if (COURSES[cj].id === cd.id) ci = cj;
    var nextLine = ci >= 0 && ci + 1 < COURSES.length && runUnlocked(ci + 1) ? COURSES[ci + 1] : null;
    $('over-next-row').classList.toggle('hidden', !nextLine);
    if (nextLine) {
      $('over-next').setAttribute('data-run', nextLine.id);
      $('over-next-name').textContent = t('course.' + nextLine.id + '.name');
    }
    again.classList.toggle('btn-big', !nextLine);
    again.classList.toggle('btn-green', !nextLine);
    again.classList.toggle('btn-blue', !!nextLine);
    $('over-score').textContent = mRun ? res.dist + '\u00a0' + t('unit.m')
                                          : t('over.points', { n: res.score });
    var bits = [res.dist + '\u00a0' + t('unit.m'), t('unit.fish') + ': ' + res.fish];
    if (res.gold)  bits.push(t('unit.golden') + ': ' + res.gold);
    if (res.gates) bits.push(t('unit.gates') + ': ' + res.gates);
    if (res.saved) bits.push(t('unit.saves') + ': ' + res.saved);
    if (rideEv && !cd && !mRun) bits.push(t('unit.gifts') + ': ' + (res.gifts || 0));
    if (rideKoi && !mRun) bits.push(t('unit.koi') + ': ' + (res.kois || 0));
    if (koiFed && koiFed.dayDone) bits.push(t('egg.fed', { n: dragonState(save).fed, m: DRAGON.days }));
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
    if (quiet) return;                 // banked on the way to another run: no results
    if (beat) setTimeout(function () {
      celebrateBest($('over-score'), mRun ? res.dist : res.score, mRun ? t('unit.m') : null);
    }, 350);
    Game.pause();
    show('over');
    /* A high point, for the app to ask for a review (native.js). */
    if ((beat || threeNow) && PLAT.goodMoment) PLAT.goodMoment(save.runs);
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
    var box = $('over-finds'), n = save.finds || 0, prize = $('find-prize');
    if (reset) { prize.classList.add('hidden'); findBroken = false; }
    /* Opening the last find empties the stock, and the box used to go with
       it — on the very frame the prize was written into it, so the player
       saw the ice break and never learned what was inside. It stays while
       a prize is showing; only the count and the button go. */
    var showing = !prize.classList.contains('hidden');
    box.classList.toggle('hidden', n <= 0 && !showing);
    if (n <= 0 && !showing) return;
    $('find-count').classList.toggle('hidden', n <= 0);
    $('find-count').textContent = t('find.have', { n: n });
    var btn = box.querySelector('[data-action="open-find"]');
    btn.classList.toggle('hidden', n <= 0);
    btn.textContent = t(reset ? 'find.open' : 'find.again');
    /* openFind() disables the button for the length of the animation and
       nothing ever turned it back on, so with two or more finds the second
       could never be opened. */
    btn.disabled = opening;
    /* with none left, the broken one stays as it fell */
    /* and while one lies broken with its prize, the next waits off stage
       (1.3.4: drawn at once in its place, the prize seemed to come out of
       the next one); it drops in when it is asked for */
    if (n > 0 && Game.drawFindPreview && !findBroken) Game.drawFindPreview($('find-art'), 200);
  }

  var opening = false, findBroken = false;
  function openFind() {
    if ((save.finds || 0) <= 0 || opening) return;
    if (findBroken) {                                 // the next one drops into the place of the broken one first
      findBroken = false; opening = true;
      var art = $('find-art');
      $('find-prize').classList.add('hidden'); sellButton('find-sell');
      if (Game.drawFindPreview) Game.drawFindPreview(art, 200);
      art.classList.remove('find-drop'); void art.offsetWidth; art.classList.add('find-drop');
      Sfx.click();
      setTimeout(function () { opening = false; openFind(); }, 460);
      return;
    }
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
      /* A life you cannot carry is offered for sale (1.3.4, the owner) */
      if ((save.lives || 0) < LIFE_CAP) { save.lives = (save.lives || 0) + 1; msg = t('find.life'); }
      else { lifeSale = 'find'; msg = t('life.full', { m: LIFE_CAP }); }
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
      var fb = $('over-finds'); fb.classList.remove('find-shake'); void fb.offsetWidth; fb.classList.add('find-shake');
    }
    if (Game.playFindOpen) {
      Game.playFindOpen($('find-art'), 200, kind, function () { finish(); }, onBreak);
    } else { onBreak(); finish(); }

    function finish() {
      opening = false; findBroken = true;
      p.textContent = msg;
      p.classList.remove('hidden');
      sellButton('find-sell');
      /* restart the reveal even when the same prize comes up twice */
      p.style.animation = 'none'; void p.offsetWidth; p.style.animation = '';
      buildFinds(false);
      /* the prize is a line more than the panel was measured with */
      fitScreen();
      flyPrize(kind);
    }
  }

  /* -------------------------- actions ------------------------ */
  function act(name, el) {
    switch (name) {
      case 'play':
        /* "Give up and start over" from the pause screen starts over the
           thing you were riding. It always started Freeride, so giving up
           on First Light dropped you onto a different hill — and in the
           tutorial, with Freeride still shut, into the Known Lines list
           with the lesson left hanging behind it. */
        /* given up: the run is banked and its results shown, as an end
           (1.3.4: it used to be thrown away, the best with it) */
        if (currentScreen === 'pause') {
          var gu = Game.giveUp ? Game.giveUp() : null;
          if (gu && gu.course !== 'tutorial') { Sfx.click(); commitRun(gu); break; }
          if (lastCourse || lastMode) { Sfx.click(); ride(lastCourse, lastMode); break; }
        }
        if (!freeUnlocked()) { Sfx.click(); show('runs'); break; }
        Sfx.click(); ride(null); break;
      case 'use-life':   useLife(); break;
      case 'ad-life':    Sfx.click(); adLife(); break;
      case 'ad-double':  Sfx.click(); adDouble(); break;
      case 'board':
        Sfx.click();
        if (PLAT.boardTop) { shopBack = currentScreen; show('board'); }
        else if (PLAT.boardShow) PLAT.boardShow();
        break;
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
      case 'profile':    Sfx.click(); show('profile'); fitScreen(); break;
      case 'trophies':   Sfx.click(); shopBack = currentScreen; show('ach'); break;
      case 'runs':       Sfx.click(); shopBack = currentScreen; show('runs'); break;
      case 'modes':      Sfx.click(); show('modes'); break;
      case 'event':      Sfx.click(); show('event'); break;
      case 'dragon':     Sfx.click(); show('dragon'); break;
      case 'hatch':      hatchEgg(); break;
      case 'egg-ride':   Sfx.click(); save.equipped = 'dragon'; applyLook(); store(); ride(null); break;
      case 'egg-go':     Sfx.click(); ride('sakura'); break;
      case 'egg-story':  Sfx.click(); openComic('dragon', function () { show('dragon'); }); break;
      case 'retry':      Sfx.click(); ride(lastCourse, lastMode); break;
      case 'next-line':  Sfx.click(); ride($('over-next').getAttribute('data-run')); break;
      case 'close-sheet': Sfx.click(); closeSheet(); break;
      case 'gift':       openGift(); break;
      case 'sell-life':  if (el) sellLife(el); break;
      case 'lang':       Sfx.click(); buildLangs(); $('sheet-lang').classList.remove('hidden'); break;
      case 'back-title':
        Sfx.click();
        if (currentScreen === 'comic') { finishComic(); break; }   // the arrow and Esc leave a comic
        /* The back arrow and Esc close an open window before they leave
           the screen under it. */
        if (closeSheet()) break;
        if (currentScreen === 'event' || currentScreen === 'dragon') { show('modes'); break; }   // an event is opened from the modes
        /* Leaving the market puts you back where you opened it from, so
           browsing between runs does not throw away the end card. */
        if ((currentScreen === 'shop' || currentScreen === 'settings' ||
             currentScreen === 'ach' || currentScreen === 'runs' || currentScreen === 'board') &&
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
    if (t) act(t.getAttribute('data-action'), t);
  });
  $('btn-menu').addEventListener('click', function (e) {
    e.stopPropagation();
    if (!Game.isRunning() || Game.isPaused()) return;
    Sfx.click(); Game.pause(); show('pause');
  });

  /* ----------------------- audio toggles --------------------- */
  /* ---- graphics ----
     What the player chose for effects and sharpness is in the save, like
     the sound. What auto settled on is the device's own and stays on it,
     in localStorage outside the save (never inside Playables, where the SDK
     is the only store; there auto starts over each time): the tier the
     picture came down to on this device, and when. */
  var Q_KEY = 'icedash-quality', WEEK = 7 * 864e5;
  /* 0 high, 1 medium, 2 low, and for effects 3, Off */
  function gfxLvl(v, fx) { return v === 0 || v === 1 || v === 2 || (fx && v === 3) ? v : 'auto'; }
  /* Where nothing has been chosen yet: the Android app starts every phone at
     the lowest level (the owner's choice, 28 Oct 2026; native.js says so
     through PLAT.gfxDefault), the web and Playables at Auto. A level chosen
     in Settings is kept, and so is a save that already has one. Read
     straight from window: the save is built before PLAT is. */
  function gfxDefault() {
    var d = (window.ICEDASH_PLATFORM || {}).gfxDefault;
    return { fx: d ? gfxLvl(d.fx, true) : 'auto', res: d ? gfxLvl(d.res) : 'auto' };
  }
  function qKeep(tier) {
    if (IN_YT) return;
    try { localStorage.setItem(Q_KEY, JSON.stringify({ tier: tier, t: Date.now() })); } catch (e) {}
  }
  function qRecord() {
    if (IN_YT) return 0;
    try {
      var r = JSON.parse(localStorage.getItem(Q_KEY) || 'null');
      if (!r || typeof r.tier !== 'number') return 0;
      var tier = Math.max(0, r.tier | 0);
      /* A week on, one tier up again, to see: a phone that was only hot or
         busy that day is not held down for good. Too much still, and it
         comes back down in two seconds. */
      if (tier > 0 && !(Date.now() - (r.t || 0) < WEEK)) { tier--; qKeep(tier); }
      return tier;
    } catch (e) { return 0; }
  }
  /* The two lists show what is chosen; with Auto chosen, its line says the
     level Auto is using now, "Auto · Medium". */
  var Q_NAMES = ['q.high', 'q.mid', 'q.low', 'q.off'];
  function syncQuality() {
    var now = Game.qualityNow();
    Array.prototype.forEach.call(document.querySelectorAll('.q-sel'), function (sel) {
      var q = sel.getAttribute('data-q'), want = save.gfx[q];
      sel.value = String(want);
      var auto = sel.querySelector('option[value="auto"]');
      auto.textContent = want === 'auto' ? t('q.auto') + ' · ' + t(Q_NAMES[now[q]]) : t('q.auto');
    });
  }
  function applyGfx(tier) { Game.quality(save.gfx, tier); syncQuality(); }
  Game.onQualityStep(function (tier) { qKeep(tier); syncQuality(); });
  Array.prototype.forEach.call(document.querySelectorAll('.q-sel'), function (sel) {
    sel.addEventListener('change', function () {
      var v = sel.value;
      save.gfx[sel.getAttribute('data-q')] = v === 'auto' ? 'auto' : +v;
      store(); Sfx.click(); applyGfx();
    });
  });

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
  var BUZZ = { crash: [60, 40, 90], caught: [90, 50, 140], perfect: [12, 30, 18], /* no buzz on a golden fish (the owner, 22 Nov 2026) */ find: [20, 30, 20], rush: [30, 20, 30],
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
      el.setAttribute('aria-label', w[2] + ' ' + t('cur.' + w[1], { n: w[2] }));
    });
    purseSnow();
  }
  /* ---- the game's snow (the owner, 20 Nov 2026) ----
     First made for the Market's purse, then put on everything that wears
     snow: the coloured buttons, the purse and the event's table. Drawn for
     each thing as it is, in one piece: down each rounded corner it follows
     the rim, thin low down and thicker over the top; along the top a row of
     round lumps like small snowballs pressed together; under it a softer,
     packed layer, a little bluer, with a wavy seam; rounded scallops and a
     few drops on its lower edge and small icicles of clear ice; a quiet
     grain, glints and crystals; a soft shadow. Sized from the thing's
     height (a small button gets thinner snow), drawn once a size and kept,
     and drawn again when the thing changes size. */
  var snowPics = {};
  function snowPic(W, Hc, rad) {
    var k = Math.max(0.5, Math.min(1.15, Hc / 56)), r = Math.max(4, Math.min(rad, Hc / 2));
    var key = W + 'x' + Hc + 'x' + Math.round(r) + 'x' + k.toFixed(2);
    if (snowPics[key]) return snowPics[key];
    var T = Math.round(10 * k), ox = 4, VW = W + ox * 2, n = Math.max(60, Math.min(420, Math.round(W * 0.9)));
    var icMax = Math.min(7.5 * k, Hc * 0.13), VH = T + r + 4 + icMax;
    var arc = Math.PI * r * 0.36, flat = W - 2 * r, L = 2 * arc + flat, out = [], inn = [];
    function rim(d) {                           // a point on the top edge, d along it from the left end
      var a;
      if (d < arc) { a = Math.PI * (1.2 + 0.3 * d / arc); return [ox + r + Math.cos(a) * r, T + r + Math.sin(a) * r, a]; }
      if (d > arc + flat) { a = Math.PI * (1.5 + 0.3 * (d - arc - flat) / arc); return [ox + W - r + Math.cos(a) * r, T + r + Math.sin(a) * r, a]; }
      return [ox + r + (d - arc), T, Math.PI * 1.5];
    }
    var bumps = Math.max(5, Math.round(L / (9 * k))), sc = Math.max(6, Math.round(L / (6.5 * k)));
    for (var i = 0; i <= n; i++) {
      var u = i / n, d = u * L, p = rim(d), nx = Math.cos(p[2]), ny = Math.sin(p[2]);
      var edge = Math.min(1, Math.min(d, L - d) / (arc + 10 * k));            // thin at the ends
      var bf = u * bumps, bi = Math.floor(bf), fr = bf - bi;
      var bs = 0.75 + 0.5 * Math.abs(Math.sin(bi * 2.39 + 0.5));
      var lump = 2.6 * k * bs * Math.sqrt(Math.max(0, 1 - Math.pow(2 * fr - 1, 2)));
      var th = 1.5 * k + 5 * k * edge + lump * (0.45 + 0.55 * edge);
      out.push([p[0] + nx * th, p[1] + ny * th]);
      var sf = u * sc + 0.5, sfr = sf - Math.floor(sf);
      var scallop = 1.3 * k * Math.sqrt(Math.max(0, 1 - Math.pow(2 * sfr - 1, 2)));
      var drop = Math.pow(Math.max(0, Math.sin(d / k * 0.19 + 1.3)), 10) * 3.8 * k;
      var drip = edge * (0.8 * k + scallop + drop);
      inn.push([p[0] - nx * (1.2 * k + drip), p[1] - ny * (1.2 * k + drip)]);
    }
    function f1(v) { return v.toFixed(1); }
    function smooth(pts, move) {               // a smooth line through the points
      var dd = (move ? 'M' : 'L') + f1(pts[0][0]) + ' ' + f1(pts[0][1]);
      for (var j = 1; j < pts.length - 1; j++)
        dd += 'Q' + f1(pts[j][0]) + ' ' + f1(pts[j][1]) + ' ' + f1((pts[j][0] + pts[j + 1][0]) / 2) + ' ' + f1((pts[j][1] + pts[j + 1][1]) / 2);
      var q = pts[pts.length - 1]; return dd + 'L' + f1(q[0]) + ' ' + f1(q[1]);
    }
    var shape = smooth(out, true) + smooth(inn.slice().reverse(), false) + 'Z';
    var e0 = Math.round(n * 0.1), e1 = n - e0;
    var crest = smooth(out.slice(e0, e1).map(function (q) { return [q[0], q[1] + 1.6 * k]; }), true);
    var seed = 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var seam = out.map(function (q, m) {
      var r2 = inn[m], w2 = 0.5 + 0.06 * Math.sin(m / n * L / 20 + 0.8);
      return [q[0] + (r2[0] - q[0]) * w2, q[1] + (r2[1] - q[1]) * w2];
    });
    var s0 = Math.round(n * 0.06), s1 = n - s0;
    var tex = "<path d='" + smooth(seam, true) + smooth(inn.slice().reverse(), false) + "Z' fill='rgba(150,192,228,.24)'/>" +
      "<path d='" + smooth(seam.slice(s0, s1), true) + "' fill='none' stroke='rgba(120,165,205,.35)' stroke-width='" + f1(0.7 * k) + "'/>" +
      "<path d='" + smooth(seam.slice(s0, s1).map(function (q) { return [q[0], q[1] - 0.9 * k]; }), true) + "' fill='none' stroke='%23fff' stroke-width='" + f1(0.8 * k) + "' opacity='.85'/>";
    var step = Math.max(1, Math.round(n / bumps));
    for (var lk = 0; lk < n; lk += step) {
      var lq = out[lk], lr = inn[lk];
      tex += "<ellipse cx='" + f1((lq[0] + lr[0]) / 2 - k) + "' cy='" + f1(lq[1] + 2.4 * k) + "' rx='" + f1((2.6 + rnd() * 2) * k) +
             "' ry='" + f1(1.3 * k) + "' fill='%23fff' opacity='" + (0.45 + rnd() * 0.3).toFixed(2) + "'/>";
    }
    for (var gk = 0; gk < L / 3; gk++) {
      var gi = Math.min(n, Math.round(rnd() * n)), gt = 0.25 + rnd() * 0.6;
      var gx = out[gi][0] + (inn[gi][0] - out[gi][0]) * gt + (rnd() - 0.5) * 2, gy = out[gi][1] + (inn[gi][1] - out[gi][1]) * gt;
      tex += "<circle cx='" + f1(gx) + "' cy='" + f1(gy) + "' r='" + ((0.25 + rnd() * 0.45) * k).toFixed(2) + "' fill='" + (rnd() < 0.55 ? "rgba(120,165,205,.45)" : "%23fff") + "'/>";
    }
    var crys = Math.max(2, Math.round(L / 50));
    for (var ck = 0; ck < crys; ck++) {
      var cq = out[Math.round((0.1 + 0.8 * (ck + 0.3 + rnd() * 0.4) / crys) * n)], cx2 = cq[0], cy2 = cq[1] + 3 * k, cs = (1.3 + rnd() * 0.6) * k;
      tex += "<path d='M" + f1(cx2) + ' ' + f1(cy2 - cs) + 'Q' + f1(cx2) + ' ' + f1(cy2) + ' ' + f1(cx2 + cs) + ' ' + f1(cy2) + 'Q' + f1(cx2) + ' ' + f1(cy2) + ' ' + f1(cx2) + ' ' + f1(cy2 + cs) +
             'Q' + f1(cx2) + ' ' + f1(cy2) + ' ' + f1(cx2 - cs) + ' ' + f1(cy2) + 'Q' + f1(cx2) + ' ' + f1(cy2) + ' ' + f1(cx2) + ' ' + f1(cy2 - cs) + "Z' fill='%23fff' opacity='.9'/>";
    }
    var ice = '', ni = Math.max(2, Math.round(L / 34));
    for (var ik = 0; ik < ni; ik++) {
      var q = inn[Math.round((0.14 + 0.72 * (ik + 0.5) / ni + (rnd() - 0.5) * 0.04) * n)];
      var iw = (1.6 + (ik % 3) * 0.4) * k, ih = Math.min(icMax, (5.5 + ((ik * 7) % 5) * 1.1) * k);
      ice += "<path d='M" + f1(q[0] - iw) + ' ' + f1(q[1] - 0.6 * k) + 'Q' + f1(q[0]) + ' ' + f1(q[1] + ih * 0.5) + ' ' + f1(q[0]) + ' ' + f1(q[1] + ih) +
             'Q' + f1(q[0]) + ' ' + f1(q[1] + ih * 0.5) + ' ' + f1(q[0] + iw) + ' ' + f1(q[1] - 0.6 * k) + "Z' fill='url(%23ic)' stroke='rgba(90,140,185,.35)' stroke-width='" + f1(0.4 * k) + "'/>";
    }
    var glints = '';
    [0.3, 0.62, 0.81].forEach(function (g, m) { var q2 = out[Math.round(g * n)]; glints += "<circle cx='" + f1(q2[0] + 2 * k) + "' cy='" + f1(q2[1] + 3.2 * k) + "' r='" + f1((m ? 0.7 : 0.9) * k) + "' fill='%23d6ecfb'/>"; });
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 " + VW + ' ' + f1(VH) + "'>" +
      "<linearGradient id='g' x2='0' y2='1'><stop offset='0' stop-color='%23fff'/><stop offset='.55' stop-color='%23eef7fd'/><stop offset='1' stop-color='%23bcd6ea'/></linearGradient>" +
      "<linearGradient id='ic' x2='0' y2='1'><stop offset='0' stop-color='%23f4fbff'/><stop offset='1' stop-color='rgba(170,215,245,.55)'/></linearGradient>" +
      "<path d='" + shape + "' fill='rgba(0,40,90,.22)' transform='translate(0 " + f1(2.2 * k) + ")'/>" +
      "<path d='" + shape + "' fill='url(%23g)' stroke='rgba(70,110,150,.4)' stroke-width='" + f1(0.8 * k) + "' stroke-linejoin='round'/>" +
      "<clipPath id='c'><path d='" + shape + "'/></clipPath><g clip-path='url(%23c)'>" + tex + '</g>' + ice +
      "<path d='" + crest + "' fill='none' stroke='%23fff' stroke-width='" + f1(1.4 * k) + "' stroke-linecap='round' opacity='.95'/>" + glints + '</svg>';
    return (snowPics[key] = { url: 'url("data:image/svg+xml,' + svg.replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'") + '")',
                              w: VW, h: VH, x: ox, y: T });
  }
  function snowOn(el) {
    var W = Math.round(el.offsetWidth), Hc = Math.round(el.offsetHeight);
    if (!W || !Hc) return;
    var cs = getComputedStyle(el), rad = parseFloat(cs.borderTopLeftRadius) || 0;
    var P = snowPic(W, Hc, rad), bl = parseFloat(cs.borderLeftWidth) || 0, bt = parseFloat(cs.borderTopWidth) || 0;
    el.style.setProperty('--sc', P.url);
    el.style.setProperty('--sc-w', P.w + 'px');
    el.style.setProperty('--sc-h', P.h.toFixed(1) + 'px');
    el.style.setProperty('--sc-x', (-P.x - bl) + 'px');
    el.style.setProperty('--sc-y', (-P.y - bt) + 'px');
  }
  var SNOWY = '.btn, #screen-shop .wallet, .ev-frame, .pcard.hero';
  var snowRO = window.ResizeObserver ? new ResizeObserver(function (es) { es.forEach(function (e) { snowOn(e.target); }); }) : null;
  function snowWatch(el) {
    if (el.__snow) return;
    el.__snow = 1;
    if (snowRO) snowRO.observe(el); else snowOn(el);
  }
  function snowAll(root) {
    if (root.matches && root.matches(SNOWY)) snowWatch(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll(SNOWY), snowWatch);
  }
  snowAll(document);
  if (window.MutationObserver) new MutationObserver(function (ms) {
    ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (nd) { if (nd.nodeType === 1) snowAll(nd); }); });
  }).observe(document.body, { childList: true, subtree: true });
  function purseSnow() { var el = document.querySelector('#screen-shop .wallet'); if (el) snowOn(el); }

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
                           : t('shop.buy') + '  ' + LIFE_PRICE + '\u00a0' + t('cur.fish', { n: LIFE_PRICE });
    card.appendChild(buy);

    box.appendChild(card);
  }

  /* ================= looks and the profile (1.3.0) =================
     The Market has three tabs (asked for by the owner, 17 Nov 2026):
     the creatures as before, Looks (colours and things to wear, bought
     once and put on any creature, each creature keeping its own) and the
     Profile (a frame bought, a title won with a trophy). The catalogue and
     the card's code are in skins.js. */
  function altOf(id) { return save.alts.on[id] || ''; }
  function applyLook() { if (Game.setLook) Game.setLook(altOf(save.equipped)); }
  function ownsAlt(id) { return save.alts.own.indexOf(id) >= 0; }
  /* The face on the card: the avatar picked in My profile while its creature
     (and its skin) are still owned, otherwise the creature being ridden */
  function avatarOf() {
    var a = save.prof.av;
    if (a && SKIN_BY_ID[a.skin] && save.owned.indexOf(a.skin) >= 0)
      return { skin: a.skin, alt: a.alt && ALT_BY_ID[a.alt] && ALT_BY_ID[a.alt].of === a.skin && ownsAlt(a.alt) ? a.alt : '' };
    return { skin: save.equipped, alt: altOf(save.equipped) };
  }
  function myCard() {
    var av = avatarOf();
    return { skin: av.skin, alt: av.alt, frame: save.prof.frame,
             title: save.prof.title, trophies: achDone(),
             medals: (save.prof.medals || []).filter(function (id) { return save.ach.indexOf(id) >= 0; }) };
  }
  /* what native.js sends up with a best (a tag on Play Games, the context
     on Game Center) */
  PLAT.boardCard = function () { return profileCode(myCard()); };
  PLAT.boardSent = function (n) { if (n > (save.boardBest || 0)) { save.boardBest = n; store(); } };

  /* The Market is the creatures; the profile has a screen of its own, My
     profile, off the title (the owner, 18 Nov 2026) */
  var framePick = '';
  function buildShop() {
    wallet();
    buildCreatures();
    buildShopFrames();
    buildUps();
  }
  /* The upgrades (1.3.4): every pickup that lasts a while lasts 10% longer
     a level, up to ten, for golden fish. */
  function upSecs(n) {
    var s = (Math.round(n * 10) / 10).toFixed(1);
    return LANG === 'en' ? s : s.replace('.', ',');
  }
  function buildUps() {
    var box = $('shop-ups');
    if (!box) return;
    box.textContent = '';
    UPGRADES.forEach(function (U) {
      var lv = save.up[U.id] || 0, row = document.createElement('div');
      row.className = 'up-row' + (lv >= UP_MAX ? ' maxed' : '');
      var cv = document.createElement('canvas'); cv.className = 'up-ico'; cv.setAttribute('aria-hidden', 'true');
      if (Game.drawHint) Game.drawHint(cv, U.id, 46);
      row.appendChild(cv);
      var mid = document.createElement('div'); mid.className = 'up-mid';
      var nm = document.createElement('div'); nm.className = 'up-name'; nm.textContent = t('up.' + U.id);
      var sc = document.createElement('div'); sc.className = 'up-secs';
      sc.textContent = lv >= UP_MAX ? upSecs(U.base * 2) + '\u00a0' + t('up.s')
        : t('up.from', { a: upSecs(U.base * (1 + lv / 10)), b: upSecs(U.base * (1 + (lv + 1) / 10)) });
      var pips = document.createElement('div'); pips.className = 'up-pips';
      pips.setAttribute('aria-label', t('up.level', { n: lv, m: UP_MAX }));
      for (var i = 0; i < UP_MAX; i++) { var d = document.createElement('i'); if (i < lv) d.className = 'on'; pips.appendChild(d); }
      mid.appendChild(nm); mid.appendChild(sc); mid.appendChild(pips);
      row.appendChild(mid);
      if (lv >= UP_MAX) {
        var mx = document.createElement('span'); mx.className = 'up-max'; mx.textContent = t('up.max'); row.appendChild(mx);
      } else {
        var b = document.createElement('button'); b.setAttribute('data-up', U.id);
        buyButton(b, { currency: 'gold', price: UP_COST[lv] });
        b.removeChild(b.firstChild);                 // just the coin and the price: the row says what it buys
        b.classList.add('up-buy');
        b.setAttribute('aria-label', t('shop.buy') + ' ' + t('up.' + U.id) + ', ' + UP_COST[lv]);
        row.appendChild(b);
      }
      box.appendChild(row);
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('#shop-ups [data-up]') : null;
    if (!b || b.disabled) return;
    var id = b.getAttribute('data-up'), lv = save.up[id] || 0;
    if (lv >= UP_MAX || !pay({ currency: 'gold', price: UP_COST[lv] })) return;
    save.up[id] = lv + 1;
    if (Game.setBoosts) Game.setBoosts(save.up);
    Sfx.gold(); store(); wallet(); buildUps();
    var r0 = b.getBoundingClientRect();
    screenBurst('gold', r0.left + r0.width / 2, r0.top + r0.height / 2);
  });
  /* The frames for the card, in the Market (1.3.3): bought here, worn from
     My profile, which shows only what the player has. The event's frame is
     won, not bought, and is not here. */
  function buildShopFrames() {
    var fr = $('shop-frames');
    if (!fr) return;
    fr.textContent = '';
    FRAMES.forEach(function (F) {
      if (F.currency === 'event') return;
      var own = save.prof.own.indexOf(F.id) >= 0;
      var el = document.createElement('button');
      el.className = 'look-tile frame-tile' + (own ? ' owned' : '') + (framePick === F.id ? ' picked' : '');
      el.setAttribute('data-frame', F.id);
      var sw = document.createElement('span'); sw.className = 'pf-swatch pf-' + F.id; el.appendChild(sw);
      var nm = document.createElement('span'); nm.className = 'look-name'; nm.textContent = t('prof.f.' + F.id); el.appendChild(nm);
      if (own) { var w = document.createElement('span'); w.className = 'skin-tag tag-worn'; w.textContent = '✓'; el.appendChild(w); }
      else el.appendChild(priceTag(F, 'skin-tag tag-price'));
      fr.appendChild(el);
    });
    var bar = $('shop-frame-buy'), pick = framePick && save.prof.own.indexOf(framePick) < 0 ? framePick : '';
    bar.classList.toggle('hidden', !pick);
    if (pick) {
      $('shop-frame-name').textContent = t('prof.f.' + pick);
      buyButton($('shop-frame-btn'), FRAMES[idxOf(FRAMES, pick)]);
    }
  }

  /* a price: the currency's fish and the sum */
  function priceTag(item, cls) {
    var p = document.createElement('span');
    p.className = cls + (item.currency === 'gold' ? ' gold' : '') + (balance(item.currency) >= item.price ? ' can' : '');
    p.appendChild(coin(item.currency, 15));
    p.appendChild(document.createTextNode(num(item.price)));
    return p;
  }
  function buyButton(btn, item) {
    var afford = balance(item.currency) >= item.price;
    btn.textContent = '';
    btn.disabled = !afford;
    btn.className = 'btn ' + (afford ? 'btn-green' : 'btn-ghost');
    btn.appendChild(document.createTextNode(t('shop.buy') + '  '));
    btn.appendChild(coin(item.currency, 18));
    btn.appendChild(document.createTextNode(num(item.price)));
  }
  function pay(item) {
    if (balance(item.currency) < item.price) return false;
    if (item.currency === 'gold') save.gold -= item.price; else save.fish -= item.price;
    return true;
  }

  /* ---- a creature's skins, in its window: its own coat and its skin ----
     Shown for every creature; bought only once the creature is owned. A
     tap on the skin not bought tries it on in the big picture and offers
     it; on one owned, the creature is put in it. */
  var altPick = '';
  function buildAlts(id) {
    var A = ALT_OF[id], box = $('sheet-alts'), bar = $('sheet-alt-buy');
    if (!box) return;
    box.textContent = '';
    $('sheet-alts-wrap').classList.toggle('hidden', !A);
    if (!A) return;
    var own = owns(id), on = altOf(id);
    ['', A.id].forEach(function (aid) {
      var el = document.createElement('button');
      el.className = 'look-tile' + (on === aid ? ' on' : '') + (altPick === aid && aid ? ' picked' : '');
      el.setAttribute('data-alt', aid);
      /* a creature not yet bought: its skin cannot be tried or bought (the
         owner, 20 Nov 2026), the note under the tiles says why */
      if (aid && !own) { el.disabled = true; el.classList.add('locked'); }
      var cv = document.createElement('canvas');
      cv.className = 'look-pic';
      Game.drawSkinPreview(cv, id, 64, aid);
      cv.style.width = cv.style.height = '';
      el.appendChild(cv);
      var nm = document.createElement('span');
      nm.className = 'look-name'; nm.textContent = t(aid ? 'alt.' + aid : 'alt.classic');
      el.appendChild(nm);
      if (own && on === aid) { var w = document.createElement('span'); w.className = 'skin-tag tag-worn'; w.textContent = '✓'; el.appendChild(w); }
      else if (aid && !ownsAlt(aid)) el.appendChild(priceTag(A, 'skin-tag tag-price'));
      box.appendChild(el);
    });
    $('sheet-alt-note').classList.toggle('hidden', own);
    bar.classList.toggle('hidden', !(own && altPick && !ownsAlt(altPick)));
    if (own && altPick && !ownsAlt(altPick)) buyButton($('sheet-alt-btn'), A);
  }
  function altPicture() {
    if (!sheetSkin) return;
    Game.drawSkinPreview($('sheet-skin-pic'), sheetSkin, 140, altPick || altOf(sheetSkin));
  }
  $('sheet-alts').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-alt]') : null;
    if (!b || !sheetSkin || b.disabled) return;
    var aid = b.getAttribute('data-alt');
    Sfx.click();
    if (owns(sheetSkin) && (!aid || ownsAlt(aid))) {
      altPick = '';
      if (aid) save.alts.on[sheetSkin] = aid; else delete save.alts.on[sheetSkin];
      if (sheetSkin === save.equipped) applyLook();
      store();
      buildCreatures();
    } else altPick = altPick === aid ? '' : aid;     // tried on, with its price
    altPicture();
    buildAlts(sheetSkin);
  });
  $('sheet-alt-btn').addEventListener('click', function () {
    var A = ALT_BY_ID[altPick];
    if (!A || !owns(A.of) || ownsAlt(A.id) || !pay(A)) return;
    save.alts.own.push(A.id);
    save.alts.on[A.of] = A.id;
    altPick = '';
    if (A.of === save.equipped) applyLook();
    Sfx.gold(); buzz(28);
    var r = this.getBoundingClientRect();
    screenBurst('gold', r.left + r.width / 2, r.top + r.height / 2);
    store();
    wallet(); buildCreatures();
    altPicture(); buildAlts(A.of);
  });

  /* ---- Profile: the card the board shows ---- */
  function profileCard(p, o) {
    o = o || {};
    var el = document.createElement('div');
    /* hero: My profile's own card, big, in its frame's colours (1.3.3) */
    el.className = 'pcard' + (o.hero ? ' hero hero-' + (p.frame || 'ice') : '');
    var av = document.createElement('div');
    av.className = 'pcard-av pf-' + (p.frame || 'ice');
    /* its face: the creature's portrait (portraits.js), head and shoulders
       from the front, its skin's if it wears one */
    var cv = document.createElement('canvas');
    if (typeof drawPortrait === 'function') drawPortrait(cv, o.size || 92, p.skin, p.alt || '');
    else Game.drawSkinPreview(cv, p.skin, o.size || 92, p.alt || '');
    av.appendChild(cv);
    el.appendChild(av);
    var mid = document.createElement('div');
    mid.className = 'pcard-mid';
    var nm = document.createElement('div');
    nm.className = 'pcard-name'; nm.textContent = o.name || t('prof.you');
    mid.appendChild(nm);
    var ti = document.createElement('div');
    ti.className = 'pcard-title';
    /* its icon before the words (1.3.3) */
    var tic = document.createElement('canvas'); tic.className = 'pcard-tico';
    if (typeof drawTitleIcon === 'function') drawTitleIcon(tic, o.hero ? 16 : 18, p.title || 'rookie', o.hero ? '#fff' : false);
    ti.appendChild(tic);
    ti.appendChild(document.createTextNode(t('prof.t.' + (p.title || 'rookie'))));
    mid.appendChild(ti);
    /* the medals the player picked to show, none to three (1.3.3) */
    if (p.medals && p.medals.length && typeof drawMedal === 'function') {
      var md = document.createElement('div'); md.className = 'pcard-medals';
      p.medals.forEach(function (id) {
        var mc = document.createElement('canvas');
        mc.setAttribute('role', 'img'); mc.setAttribute('aria-label', t('ach.' + id + '.name'));
        mc.title = t('ach.' + id + '.name');
        drawMedal(mc, o.hero ? 40 : 34, id);
        md.appendChild(mc);
      });
      mid.appendChild(md);
    }
    var st = document.createElement('div');
    st.className = 'pcard-stats';
    function stat(label, val) {
      var sp = document.createElement('span');
      if (o.hero) { var b = document.createElement('b'); b.textContent = val; var sm = document.createElement('small'); sm.textContent = label; sp.appendChild(b); sp.appendChild(sm); }
      else sp.textContent = label + ' ' + val;
      st.appendChild(sp);
    }
    /* the hero card on the board (the owner, 20 Nov 2026: as in My
       profile): the place is a pill of its own, in place of the creatures,
       which the board does not know for anyone else */
    if (o.rank && !o.hero) { var rk = document.createElement('span'); rk.textContent = t('title.rank.num', { n: o.rank }); st.appendChild(rk); }
    if (o.rank && o.hero) stat(t('prof.place'), t('title.rank.num', { n: o.rank }));
    stat(t('prof.best'), num(o.best || 0));
    stat(t('prof.trophies'), o.hero && typeof ACHIEVEMENTS !== 'undefined' ? (p.trophies || 0) + '/' + ACHIEVEMENTS.length : String(p.trophies || 0));
    if (o.hero && o.mine) stat(t('prof.creatures'), save.owned.length + '/' + SKINS.length);
    mid.appendChild(st);
    el.appendChild(mid);
    return el;
  }
  function buildProfile() {
    var box = $('prof-preview');
    box.textContent = '';
    var shown = myCard();
    box.appendChild(profileCard(shown, { best: save.best, size: 118, hero: true, mine: true }));
    /* the avatars: every creature owned, and its skin if that is owned too */
    var ag = $('prof-avatars'), cur = avatarOf();
    ag.textContent = '';
    SKINS.forEach(function (S) {
      if (save.owned.indexOf(S.id) < 0) return;
      var alts = [''];
      if (ALT_OF[S.id] && ownsAlt(ALT_OF[S.id].id)) alts.push(ALT_OF[S.id].id);
      alts.forEach(function (alt) {
        var el = document.createElement('button');
        el.className = 'av-tile' + (cur.skin === S.id && cur.alt === alt ? ' on' : '');
        el.setAttribute('data-av', S.id + ':' + alt);
        el.setAttribute('aria-label', alt ? t('alt.' + alt, null, alt) : t('skin.' + S.id + '.name', null, S.name));
        var pc = document.createElement('canvas');
        if (typeof drawPortrait === 'function') drawPortrait(pc, 60, S.id, alt);
        el.appendChild(pc);
        ag.appendChild(el);
      });
    });
    var fr = $('prof-frames');
    fr.textContent = '';
    FRAMES.forEach(function (F) {
      var on = save.prof.frame === F.id, own = save.prof.own.indexOf(F.id) >= 0;
      if (!own) return;                    // only what the player has (the owner, 20 Nov 2026)
      var el = document.createElement('button');
      el.className = 'look-tile frame-tile' + (on ? ' on' : '');
      el.setAttribute('data-frame', F.id);
      var sw = document.createElement('span'); sw.className = 'pf-swatch pf-' + F.id; el.appendChild(sw);
      var nm = document.createElement('span'); nm.className = 'look-name'; nm.textContent = t('prof.f.' + F.id); el.appendChild(nm);
      if (on) { var w = document.createElement('span'); w.className = 'skin-tag tag-worn'; w.textContent = '✓'; el.appendChild(w); }
      fr.appendChild(el);
    });
    var tl = $('prof-titles');
    tl.textContent = '';
    TITLES.forEach(function (T) {
      var won = titleWon(save, T), on = save.prof.title === T.id;
      if (!won) return;                    // only what the player has
      var el = document.createElement('button');
      el.className = 'title-row' + (on ? ' on' : '');
      el.setAttribute('data-title', T.id);
      var ic = document.createElement('canvas'); ic.className = 'title-ico';
      if (typeof drawTitleIcon === 'function') drawTitleIcon(ic, 34, T.id);
      el.appendChild(ic);
      var nm = document.createElement('span'); nm.className = 'title-name'; nm.textContent = t('prof.t.' + T.id); el.appendChild(nm);
      var ds = document.createElement('span'); ds.className = 'title-need';
      if (on) ds.textContent = '✓';
      el.appendChild(ds);
      tl.appendChild(el);
    });
    /* the medals: every trophy earned, a tap puts it on the card or takes
       it off; none to three (the owner, 20 Nov 2026) */
    var mg = $('prof-medals'), mine = save.prof.medals;
    mg.textContent = '';
    $('prof-medal-note').textContent = t('prof.medalNote', { a: mine.length, b: MEDAL_MAX });
    ACHIEVEMENTS.forEach(function (A) {
      if (save.ach.indexOf(A.id) < 0) return;
      var on = mine.indexOf(A.id) >= 0;
      var el = document.createElement('button');
      el.className = 'medal-tile' + (on ? ' on' : '') + (!on && mine.length >= MEDAL_MAX ? ' full' : '');
      el.setAttribute('data-medal', A.id);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      var mc = document.createElement('canvas');
      if (typeof drawMedal === 'function') drawMedal(mc, 52, A.id);
      el.appendChild(mc);
      var nm = document.createElement('span'); nm.className = 'look-name'; nm.textContent = t('ach.' + A.id + '.name'); el.appendChild(nm);
      if (on) { var w = document.createElement('span'); w.className = 'medal-num'; w.textContent = String(mine.indexOf(A.id) + 1); el.appendChild(w); }
      mg.appendChild(el);
    });
    if (!mg.children.length) {
      var em = document.createElement('p'); em.className = 'shop-note'; em.textContent = t('prof.medalNone'); mg.appendChild(em);
    }
  }
  /* The title's My profile button: the player's avatar in the frame they
     wear, round, no words (the owner, 20 Nov 2026: minimal, no snow) */
  function profileBtn() {
    var b = $('btn-profile');
    if (!b) return;
    var c = myCard();
    b.className = 'prof-orb pf-' + (c.frame || 'ice');
    b.setAttribute('aria-label', t('btn.profile'));
    b.textContent = '';
    var cv = document.createElement('canvas');
    if (typeof drawPortrait === 'function') drawPortrait(cv, 36, c.skin, c.alt || '');
    b.appendChild(cv);
  }
  /* The free gift beside the Market (the owner, 20 Nov 2026): every
     twelve hours a little gift, the same ones as on the hill; a tap opens
     it (fish, a golden fish or a life), and it is gone until the next. */
  var GIFT_EVERY = 12 * 3600 * 1000;
  function giftReady() { return Date.now() - (save.gift || 0) >= GIFT_EVERY; }
  var giftLook = -1;
  function giftBtn() {
    var b = $('btn-gift');
    if (!b) return;
    var on = canSave && giftReady();
    b.classList.toggle('hidden', !on);
    if (on && giftLook < 0) {
      giftLook = Math.floor(Math.random() * 6);     // a colour, and which way it faces; always the box
      if (Game.drawGift) Game.drawGift(b.querySelector('canvas'), 52, giftLook % 3, giftLook >= 3, 0);
    }
  }
  /* it comes back while the title is up, too */
  setInterval(function () { if (currentScreen === 'title') giftBtn(); }, 30000);
  function giftRoll() {
    var r = Math.random();
    if (r < 0.15) return { kind: 'gold', n: 1 };
    if (r < 0.40) return { kind: 'life', n: 1 };     // with all five, offered for sale
    return { kind: 'fish', n: 50 + 10 * Math.floor(Math.random() * 8) };   // 50 to 120
  }
  function openGift() {
    if (!giftReady()) { giftBtn(); return; }
    var p = giftRoll(), msg;
    if (p.kind === 'gold') { save.gold += p.n; msg = t('find.gold', { n: p.n }); }
    else if (p.kind === 'life' && (save.lives || 0) < LIFE_CAP) { save.lives = (save.lives || 0) + 1; msg = t('find.life'); }
    else if (p.kind === 'life') { lifeSale = 'gift'; msg = t('life.full', { m: LIFE_CAP }); }
    else { save.fish += p.n; msg = t('find.fish', { n: p.n }); }
    save.gift = Date.now();
    store();
    var b = $('btn-gift');
    Sfx.click(); buzz(15);
    $('gift-prize').textContent = msg;
    $('gift-prize').className = 'gift-prize gp-' + p.kind;
    sellButton('gift-sell');
    b.classList.add('hidden');
    var sh = $('sheet-gift');
    sh.classList.remove('gift-done');
    sh.classList.remove('hidden');
    giftStage(p.kind, Math.max(0, giftLook));
    giftLook = -1;
  }
  /* The gift opened as a little scene (the owner, 20 Nov 2026: more to
     it): the box shakes harder and harder and sparkles, a flash, the lid
     flies off, and the prize jumps out over turning rays in its colour,
     with confetti; then the words and the button. Without motion, the end
     at once. */
  var GIFT_RAYS = { fish: ['#bfe8ff', '#4fb0ea'], gold: ['#fff1a8', '#f0b020'], life: ['#ffd0dc', '#ff5a8a'] };
  var giftRaf = null;
  function giftStage(kind, look) {
    var cv = $('gift-art'), S = 220;
    if (!cv.getContext) return;
    var k = Math.min(window.devicePixelRatio || 1, 2.5);
    cv.width = Math.round(S * k); cv.height = Math.round(S * k);
    cv.style.width = S + 'px'; cv.style.height = S + 'px';
    var c = cv.getContext('2d');
    /* the gift and the prize, painted once */
    var G = document.createElement('canvas'), GS = 150;
    var gi = Game.drawGift ? Game.drawGift(G, GS, look % 3, look >= 3, 0) : null;
    var P = document.createElement('canvas');
    if (Game.drawHint) Game.drawHint(P, kind === 'life' ? 'heart' : kind, 96);
    /* the golden fish's own glow runs to the icon's edges: faded out in a
       circle, so no square shows round it */
    if (P.width) {
      var pc = P.getContext('2d'), pw = P.width;
      pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = 'destination-in';
      var pm = pc.createRadialGradient(pw / 2, pw / 2, pw * 0.3, pw / 2, pw / 2, pw * 0.5);
      pm.addColorStop(0, '#000'); pm.addColorStop(1, 'rgba(0,0,0,0)');
      pc.fillStyle = pm; pc.fillRect(0, 0, pw, pw); pc.globalCompositeOperation = 'source-over';
    }
    /* where the lid ends, as the icon draws it: all above is the lid */
    var cut = GS * ((gi && gi.lidBottom) || 0.52);
    function lidPath(g) { g.beginPath(); g.rect(-5, -5, GS + 10, cut + 5); }
    var col = GIFT_RAYS[kind] || GIFT_RAYS.fish;
    var sparks = [], t0 = performance.now(), popped = false, still = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var OPEN = 1150;
    function spark(x, y, sp, life, big) {
      var a = Math.random() * 6.283;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - sp * 0.3, life: life, t: life, r: big ? 3 + Math.random() * 3 : 1.5 + Math.random() * 2,
                    col: Math.random() < 0.5 ? '#ffffff' : col[0] });
    }
    function star(x, y, r, a) {
      c.beginPath();
      for (var q = 0; q < 8; q++) { var rr = q % 2 ? r * 0.35 : r, an = a + q * Math.PI / 4; c.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); }
      c.closePath(); c.fill();
    }
    function ease(x) { return 1 - Math.pow(1 - x, 3); }
    function elastic(x) { return x >= 1 ? 1 : 1 - Math.pow(2, -9 * x) * Math.cos(x * 9.5); }
    if (giftRaf) cancelAnimationFrame(giftRaf);
    function frame(now) {
      var sh = $('sheet-gift');
      if (sh.classList.contains('hidden')) { giftRaf = null; return; }
      var tt = still ? OPEN + 2000 : now - t0, cx = S / 2, cy = S / 2;
      c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, S, S);
      /* behind: the rays, once open, turning */
      if (tt > OPEN) {
        var ra = Math.min(1, (tt - OPEN) / 350);
        c.save(); c.translate(cx, cy); c.rotate(tt * 0.0004);
        /* rays in the prize's own deeper colour, fading out to the edge */
        var gr = c.createRadialGradient(0, 0, 14, 0, 0, S * 0.47);
        gr.addColorStop(0, col[1]); gr.addColorStop(.55, col[0]); gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.globalAlpha = 0.55 * ra; c.fillStyle = gr;
        for (var q = 0; q < 12; q++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, S * 0.47, q * Math.PI / 6, q * Math.PI / 6 + Math.PI / 12); c.closePath(); c.fill(); }
        /* and a second, finer set turning the other way */
        c.rotate(-tt * 0.0009); c.globalAlpha = 0.3 * ra;
        for (var q2 = 0; q2 < 18; q2++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, S * 0.44, q2 * Math.PI / 9, q2 * Math.PI / 9 + Math.PI / 40); c.closePath(); c.fill(); }
        c.globalAlpha = ra;
        var gl = c.createRadialGradient(0, 0, 0, 0, 0, S * 0.3);
        gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(.5, col[0]); gl.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(0, 0, S * 0.3, 0, 7); c.fill();
        c.restore(); c.globalAlpha = 1;
      }
      if (tt < OPEN) {
        /* the shake: harder as it goes, with a hop near the end */
        var f = tt / OPEN, amp = 0.03 + 0.2 * f * f, ang = Math.sin(tt * (0.025 + f * 0.03)) * amp;
        var hop = f > 0.7 ? -Math.abs(Math.sin((f - 0.7) * 30)) * 8 * f : 0, sc = 1 + 0.06 * f + 0.03 * Math.sin(tt * 0.04);
        c.save(); c.translate(cx, cy + 30 + hop); c.rotate(ang); c.scale(sc, sc);
        c.drawImage(G, -GS / 2, -GS * 0.75, GS, GS);
        c.restore();
        if (Math.random() < 0.15 + f * 0.6) spark(cx + (Math.random() - 0.5) * 90, cy + 10 + (Math.random() - 0.5) * 60, 0.6 + f * 1.4, 500, false);
      } else {
        var o = tt - OPEN;
        if (!popped) {
          popped = true;
          for (var n = 0; n < 40; n++) spark(cx, cy + 10, 2 + Math.random() * 4, 900 + Math.random() * 500, true);
          var r = cv.getBoundingClientRect();
          if (!still) screenBurst(kind, r.left + r.width / 2, r.top + r.height / 2);
          if (Sfx.boom) Sfx.boom();
          Sfx.gold(); buzz(kind === 'fish' ? [40, 30, 60] : [60, 30, 100]);
          setTimeout(function () { sh.classList.add('gift-done'); }, still ? 0 : 450);
        }
        /* the box: drops a little and fades; the lid: flies up, turning */
        if (o < 650) {
          var fa = 1 - o / 650;
          c.save(); c.globalAlpha = fa;
          c.translate(cx, cy + 30 + ease(o / 650) * 22);
          c.save(); c.translate(-GS / 2, -GS * 0.75); c.beginPath(); c.rect(-5, -5, GS + 10, GS + 10); lidPath(c); c.clip('evenodd'); c.drawImage(G, 0, 0, GS, GS); c.restore();
          c.restore();
          c.save(); c.globalAlpha = fa;
          c.translate(cx - ease(o / 650) * 50, cy + 30 - ease(o / 650) * 110); c.rotate(-ease(o / 650) * 1.1);
          c.translate(-GS / 2, -GS * 0.75); lidPath(c); c.clip(); c.drawImage(G, 0, 0, GS, GS);
          c.restore();
        }
        /* the prize, out of the box and up into the middle, with a bounce */
        var pe = elastic(Math.min(1, o / 700)), py = cy + 26 - 26 * ease(Math.min(1, o / 500)), bob = Math.sin(o * 0.004) * 3;
        c.save(); c.translate(cx, py + bob); c.scale(pe * 1.75, pe * 1.75); c.rotate(Math.sin(o * 0.003) * 0.06);
        c.drawImage(P, -48, -48, 96, 96); c.restore();
        /* the flash */
        if (o < 380) { c.fillStyle = 'rgba(255,255,255,' + (0.9 * (1 - o / 380)) + ')'; c.beginPath(); c.arc(cx, cy, S * 0.5, 0, 7); c.fill(); }
        /* now and then a twinkle round the prize */
        if (Math.random() < 0.12) spark(cx + (Math.random() - 0.5) * 120, cy + (Math.random() - 0.5) * 110, 0.3, 700, false);
      }
      /* the sparks */
      var dt = 16;
      for (var i = sparks.length - 1; i >= 0; i--) {
        var p = sparks[i]; p.t -= dt;
        if (p.t <= 0) { sparks.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.vx *= 0.98;
        c.globalAlpha = Math.min(1, p.t / p.life * 1.6); c.fillStyle = p.col;
        star(p.x, p.y, p.r * 1.6, tt * 0.004 + i);
      }
      c.globalAlpha = 1;
      giftRaf = still ? null : requestAnimationFrame(frame);
    }
    giftRaf = requestAnimationFrame(frame);
  }
  /* The Market's two tabs: the creatures, and the frames for the card */
  function shopTabTo(id) {
    Array.prototype.forEach.call(document.querySelectorAll('#screen-shop [data-stab]'), function (b) {
      var on = b.getAttribute('data-stab') === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('#screen-shop .shop-pane'), function (p) {
      p.classList.toggle('hidden', p.getAttribute('data-spane') !== id);
    });
  }
  document.querySelector('#screen-shop .shop-tabs').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-stab]') : null;
    if (!b || b.classList.contains('on')) return;
    Sfx.click(); shopTabTo(b.getAttribute('data-stab'));
  });
  /* My profile's three tabs: Avatar, Frames, Titles (1.3.3) */
  var profTab = 'av';
  function profTabTo(id) {
    profTab = id;
    Array.prototype.forEach.call(document.querySelectorAll('#screen-profile .prof-tab'), function (b) {
      var on = b.getAttribute('data-ptab') === id; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Array.prototype.forEach.call(document.querySelectorAll('#screen-profile .prof-pane'), function (p) {
      p.classList.toggle('hidden', p.getAttribute('data-pane') !== id);
    });
  }
  document.querySelector('#screen-profile .prof-tabs').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-ptab]') : null;
    if (!b || b.getAttribute('data-ptab') === profTab) return;
    Sfx.click(); profTabTo(b.getAttribute('data-ptab'));
  });
  $('prof-avatars').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-av]') : null;
    if (!b) return;
    var v = b.getAttribute('data-av').split(':');
    Sfx.click();
    save.prof.av = { skin: v[0], alt: v[1] || '' };
    store();
    buildProfile();
  });
  $('prof-frames').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-frame]') : null;
    if (!b) return;
    var id = b.getAttribute('data-frame');
    if (save.prof.own.indexOf(id) < 0) return;
    Sfx.click();
    save.prof.frame = id; store();
    buildProfile();
  });
  /* the Market's frames: a tap on one not had offers it, Buy pays and puts it on */
  $('shop-frames').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-frame]') : null;
    if (!b) return;
    var id = b.getAttribute('data-frame');
    if (save.prof.own.indexOf(id) >= 0) return;
    Sfx.click();
    framePick = framePick === id ? '' : id;
    buildShopFrames();
  });
  $('shop-frame-btn').addEventListener('click', function () {
    var F = FRAMES[idxOf(FRAMES, framePick)];
    if (!F || save.prof.own.indexOf(F.id) >= 0 || !pay(F)) return;
    save.prof.own.push(F.id); save.prof.frame = F.id; framePick = '';
    Sfx.gold(); buzz(28);
    var r = this.getBoundingClientRect();
    screenBurst('gold', r.left + r.width / 2, r.top + r.height / 2);
    store();
    buildShop();
  });
  $('prof-medals').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-medal]') : null;
    if (!b) return;
    var id = b.getAttribute('data-medal'), m = save.prof.medals, i = m.indexOf(id);
    if (i >= 0) m.splice(i, 1);
    else if (m.length >= MEDAL_MAX || save.ach.indexOf(id) < 0) { Sfx.click(); buzz(12); return; }
    else m.push(id);
    Sfx.click(); store(); buildProfile();
  });
  $('prof-titles').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-title]') : null;
    if (!b) return;
    var T = TITLES[idxOf(TITLES, b.getAttribute('data-title'))];
    if (!T) return;
    if (titleWon(save, T)) { Sfx.click(); save.prof.title = T.id; store(); buildProfile(); return; }
    /* not won yet: to where its trophy is earned */
    var A = null;
    for (var i = 0; i < ACHIEVEMENTS.length; i++) if (ACHIEVEMENTS[i].id === T.ach) A = ACHIEVEMENTS[i];
    if (A) goEarn(A.go || 'free'); else { Sfx.click(); shopBack = currentScreen; show('ach'); }
  });

  function buildCreatures() {
    buildSupply();
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
    Game.drawSkinPreview(cv, sk.id, 80, altOf(sk.id));
    /* the drawing sets an inline 80px; the shelf's CSS sizes the tile
       instead, or three to a row overflow a narrow phone */
    cv.style.width = cv.style.height = '';
    if (save.equipped === sk.id) {
      var w = document.createElement('span');
      w.className = 'skin-tag tag-worn'; w.textContent = '✓';
      el.appendChild(w);
    } else if (!owns(sk.id) && sk.currency === 'event') {
      var ep = document.createElement('span');
      ep.className = 'skin-tag tag-trophy'; ep.textContent = t('egg.tag');
      el.appendChild(ep);
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
  /* thousands apart by a narrow space that does not break: with a thin space
     "4 200" could end one line and start the next */
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f'); }

  var sheetSkin = null;
  function openSheet(id) {
    var sk = SKIN_BY_ID[id];
    if (!sk) return;
    sheetSkin = id; altPick = '';
    var sh = $('sheet-skin');
    sh.classList.remove('hidden');
    Game.drawSkinPreview($('sheet-skin-pic'), sk.id, 140, altOf(sk.id));
    buildAlts(sk.id);
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
    } else if (sk.currency === 'event') {
      b.textContent = t('egg.name') + '  ›'; b.className += ' btn-blue'; b.setAttribute('data-go', 'dragon');
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
  /* The dragon's comic names the player who saved him: their name on the
     board (Play Games, Game Center), kept once known so it is there offline
     too; fetched once, quietly, if it is not known yet and the board can be
     asked. Without one, the captions speak to "you". */
  function heroName() { return save.boardName || ''; }
  function withHeroName(cb) {
    if (save.boardName || !PLAT.boardTop || (typeof navigator !== 'undefined' && navigator.onLine === false)) { cb(); return; }
    var fin = false, go = function () { if (!fin) { fin = true; cb(); } };
    setTimeout(go, 1500);
    try {
      PLAT.boardTop('all').then(function (r) { if (r && r.me && r.me.name) { save.boardName = String(r.me.name).slice(0, 24); store(); } go(); },
                               function () { go(); });
    } catch (e) { go(); }
  }
  function capText(p) {
    if (!p.who) return t(p.cap);
    var nm = heroName();
    return nm ? t(p.cap, { name: nm }) : t(p.cap + '.you');
  }
  function openComic(id, done) {
    if (id === 'dragon' && !openComic.named) { openComic.named = true; withHeroName(function () { openComic(id, done); openComic.named = false; }); return; }
    var pages = comicFor(id);
    if (!pages) { if (done) done(); return; }
    comic = { id: id, pages: pages, page: 0, shown: 0, done: done, raf: null, starts: [],
              deep: !!pages.deep, cam: [], mouse: null, turning: false, f: 0 };
    $('screen-comic').querySelector('.comic-page').classList.toggle('deep', comic.deep);
    show('comic');
    buildComicPage();
    /* and again once the display face is in, should it come late */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (comic) fitComic(); });
    (function tick() {
      if (!comic) return;
      drawComic();
      comic.raf = requestAnimationFrame(tick);
    })();
  }
  function buildComicPage() {
    var box = $('comic-panels');
    box.textContent = '';
    $('screen-comic').scrollTop = 0;      // a page begins at its top, wherever the last one was left
    comic.shown = 0; comic.starts = []; comic.cam = [];
    comic.pages[comic.page].forEach(function (p) {
      var cell = document.createElement('div');
      cell.className = 'comic-panel';
      var cv = document.createElement('canvas');
      cv.className = 'comic-art';
      cell.appendChild(cv);
      var cap = document.createElement('div');
      cap.className = 'comic-cap'; cap.textContent = capText(p);
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
    if (!n) return;
    /* not up yet (the screen comes in a moment after it is asked for): try
       again next frame. Measured with no height it was never sized, and on
       a 320-wide phone Next ran off the first page. */
    if (!scr.clientHeight) {
      if (!comic.fitWait) { comic.fitWait = true; requestAnimationFrame(function () { if (comic) { comic.fitWait = false; fitComic(); } }); }
      return;
    }
    var px = function (el, k) { return parseFloat(getComputedStyle(el)[k]) || 0; };
    var row = getComputedStyle(box).display === 'grid';
    var gap = px(box, 'rowGap') || 10;
    var availH = scr.clientHeight - px(scr, 'paddingTop') - px(scr, 'paddingBottom');
    var availW = scr.clientWidth - px(scr, 'paddingLeft') - px(scr, 'paddingRight');
    var padX = px(page, 'paddingLeft') + px(page, 'paddingRight') + px(page, 'borderLeftWidth') + px(page, 'borderRightWidth');
    var padY = px(page, 'paddingTop') + px(page, 'paddingBottom') + px(page, 'borderTopWidth') + px(page, 'borderBottomWidth');
    var foot = page.querySelector('.comic-foot');
    var pageMax = Math.min(row ? 1400 : 560, availW);
    var cellMax = (pageMax - padX - (row ? gap * 2 : 0)) / (row ? 3 : 1);
    function size() {
      var footH = foot.offsetHeight + px(foot, 'marginTop') + 12;      // and the panel's own drop shadow
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
      var pw = Math.min(availW, Math.max(300, (row ? w * 3 + gap * 2 : w) + padX));
      page.style.width = pw + 'px';
      return pw;
    }
    /* Skip, the count and Next share a row while they fit in it. The words
       are the language's, so whether they fit is measured, not assumed: if
       not, the count moves above the buttons and the page is sized again
       around the taller row. */
    foot.classList.remove('tight', 'stack');
    var pw = size(), cg = px(foot, 'columnGap');
    /* measured to the fraction of a pixel, with a little to spare: rounded
       widths that summed to exactly the row's said "fits", and the
       fractions then wrapped Next under Skip, flush left, into its snow */
    /* (taken back out of the screen's own scale: measured while it pops in,
       the buttons came out a fifth narrower than they are, the row seemed
       to fit, and Next ran off a 320-wide phone) */
    var popK = page.offsetWidth / (page.getBoundingClientRect().width || page.offsetWidth) || 1;
    var wOf = function (id) { return $(id).getBoundingClientRect().width * popK; }, SPARE_PX = 4;
    var skipW = wOf('comic-skip'), nextW = wOf('comic-next'), countW = wOf('comic-pageno');
    if (skipW + countW + nextW + cg * 2 + SPARE_PX > pw - padX) {
      foot.classList.add(skipW + nextW + cg + SPARE_PX > pw - padX ? 'stack' : 'tight');
      if (foot.classList.contains('stack')) foot.classList.add('tight');
      pw = size();
      /* the taller row leaves the panels less room, the page comes out
         narrower, and the two buttons may no longer sit side by side after
         all */
      if (!foot.classList.contains('stack') && wOf('comic-skip') + wOf('comic-next') + cg + SPARE_PX > pw - padX) {
        foot.classList.add('stack');
        size();
      }
    }
    foot.classList.toggle('over', scr.scrollHeight > scr.clientHeight + 1);
  }
  window.addEventListener('resize', function () { if (comic) fitComic(); });
  function revealPanel() {
    var cells = $('comic-panels').children;
    if (comic.shown < cells.length) {
      cells[comic.shown].classList.add('shown');
      if (comic.deep) (function (cell) { setTimeout(function () { cell.classList.add('settled'); }, 650); })(cells[comic.shown]);
      comic.starts[comic.shown] = 0;
      comic.shown++;
    }
    var last = comic.page === comic.pages.length - 1 && comic.shown === cells.length;
    $('comic-next').textContent = last ? t('comic.go') : t('comic.next') + '  \u203a';
    if (last) fitComic();
    /* on a phone too short for the whole page a panel opens under the
       buttons; the page scrolls it up above them */
    var cell = cells[comic.shown - 1], foot = $('screen-comic').querySelector('.comic-foot');
    if (cell && foot.classList.contains('over')) {
      var d = cell.getBoundingClientRect().bottom - foot.getBoundingClientRect().top + 6;
      if (d > 0) $('screen-comic').scrollBy({ top: d, behavior: 'smooth' });
    }
  }
  function nextComic() {
    if (!comic || comic.turning) return;
    Sfx.click();
    if (comic.shown < comic.pages[comic.page].length) { revealPanel(); return; }
    if (comic.page < comic.pages.length - 1) {
      /* a deep comic turns its page: the panels swing away on their left
         edges, one after another, and the next page's swing in */
      if (comic.deep && !stillMotion()) {
        var was = comic;
        comic.turning = true;
        $('comic-panels').classList.add('turn');
        setTimeout(function () {
          if (comic !== was) return;                 // skipped while it turned
          $('comic-panels').classList.remove('turn');
          comic.turning = false;
          comic.page++; buildComicPage();
        }, 430);
        return;
      }
      comic.page++; buildComicPage(); return;
    }
    finishComic();
  }
  function stillMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  /* where the mouse is over a deep comic, for its panels to lean toward;
     a finger is not followed (it only taps), the panels sway by themselves */
  $('screen-comic').addEventListener('pointermove', function (e) {
    if (comic && comic.deep && e.pointerType === 'mouse') comic.mouse = { x: e.clientX, y: e.clientY, at: comic.f };
  });
  $('screen-comic').addEventListener('pointerleave', function () { if (comic) comic.mouse = null; });
  function finishComic() {
    if (!comic) return;
    if (comic.raf != null) cancelAnimationFrame(comic.raf);
    save.comicSeen[comic.id] = true;
    store();
    var done = comic.done;
    comic = null;
    if (Game.comicForget) Game.comicForget();           // the pictures of its animals
    $('comic-panels').classList.remove('turn');
    if (done) done(); else show('title');
  }
  function drawComic() {
    var cells = $('comic-panels').children;
    var k = Math.min(window.devicePixelRatio || 1, 2.5);
    comic.f++;
    var still = comic.deep && stillMotion();
    /* low effects keep the planes and the sway but not the blur and the
       shadow, the two that cost */
    var soft = comic.deep && !(Game.qualityNow && Game.qualityNow().fx >= 2);
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
      var p = comic.pages[comic.page][i];
      if (comic.deep) {
        var cam = comicCam(i, cells[i], still);
        cmPaint(c, p, comic.starts[i]++, { px: k * w / COMIC_W, k: k, cam: cam, still: still, soft: soft });
      } else p.draw(c, comic.starts[i]++);
      c.restore();
    }
  }
  /* A deep panel's camera: toward the mouse while it moves over the page,
     otherwise a slow sway of its own (each panel out of step with the
     next), eased either way. The card leans with it, a few degrees. */
  function comicCam(i, cell, still) {
    var cam = comic.cam[i] || (comic.cam[i] = { x: 0, y: 0 });
    var tx = 0, ty = 0;
    if (!still) {
      var m = comic.mouse;
      if (m && comic.f - m.at < 240) {
        var r = cell.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (m.x - (r.left + r.width / 2)) / (r.width * 0.75)));
        ty = Math.max(-1, Math.min(1, (m.y - (r.top + r.height / 2)) / (r.height * 0.75)));
      } else {
        var s = comic.f / 60;
        tx = Math.sin(s * 0.55 + i * 1.9) * 0.55;
        ty = Math.cos(s * 0.41 + i * 1.3) * 0.4;
      }
    }
    cam.x += (tx - cam.x) * 0.06; cam.y += (ty - cam.y) * 0.06;
    cell.style.setProperty('--ry', (cam.x * 5).toFixed(2) + 'deg');
    cell.style.setProperty('--rx', (-cam.y * 4).toFixed(2) + 'deg');
    return cam;
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
    settleLifeSale();
    var open = false;
    Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (sh) {
      if (sh.classList.contains('upd-must') && !sh.classList.contains('hidden')) { open = true; return; }   // too old to play on: it stays
      if (!sh.classList.contains('hidden')) { open = true; sh.classList.add('hidden'); }
    });
    sheetSkin = null;
    return open;
  }

  /* A newer version in the store (the apps only, native.js; asked for by
     the owner, 20 Nov 2026). Asked once a start, a moment after it; shown
     on the title only, never over a run or another sheet, and once a
     version (Later puts it away until the next one). A version older than
     the store's "min" gets it every start, with no way to put it away. */
  var UPD_SEEN = 'icedash-update-seen', updInfo = null, updTries = 0;
  function updShow() {
    if (!updInfo) return;
    if (currentScreen !== 'title' || document.querySelector('.sheet:not(.hidden)') || Game.isRunning()) {
      if (++updTries < 60) setTimeout(updShow, 2000);   // wait for the title, for two minutes at most
      return;
    }
    var I = updInfo, sh = $('sheet-update');
    updInfo = null;
    sh.classList.toggle('upd-must', I.force);
    $('sheet-update-must').classList.toggle('hidden', !I.force);
    $('sheet-update-ver').textContent = t('upd.ver', { v: I.version });
    var lines = I.notes[getLang()] || I.notes.en || [], ul = $('sheet-update-notes');
    ul.textContent = '';
    (Array.isArray(lines) ? lines : [String(lines)]).slice(0, 8).forEach(function (l) {
      var li = document.createElement('li'); li.textContent = String(l).replace(/^[•\-\s]+/, ''); ul.appendChild(li);
    });
    ul.parentNode.querySelector('.upd-head').classList.toggle('hidden', !ul.children.length);
    sh.classList.remove('hidden');
    if (!I.force) { try { localStorage.setItem(UPD_SEEN, I.version); } catch (e) {} }
  }
  if (PLAT.updateCheck) {
    setTimeout(function () {
      PLAT.updateCheck().then(function (I) {
        if (!I) return;
        var seen = '';
        try { seen = localStorage.getItem(UPD_SEEN) || ''; } catch (e) {}
        if (!I.force && seen === I.version) return;
        updInfo = I; updShow();
      }, function () {});
    }, 2500);
    $('sheet-update-go').addEventListener('click', function () {
      Sfx.click();
      if (PLAT.updateGo) PLAT.updateGo();
    });
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
    if (this.getAttribute('data-go') === 'dragon') { closeSheet(); show('dragon'); return; }   // the dragon: from the egg
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
    applyLook();
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
    if (COURSES[i].event) return true;               // the Sakura Garden, open to all (1.3.4)
    return (save.courses[COURSES[i - 1].id] || 0) > 0;
  }

  /* Freeride is where the fish are, so it cannot be held back far: locking
     it behind all six lines would also lock a beginner out of the shop, and
     they clear the sixth roughly never. One line is enough — it is the run
     that teaches you what a tap does, and it is passed in a few attempts. */
  function freeUnlocked() { return !!PLAT.freeOpen || (save.courses[COURSES[0].id] || 0) > 0; }

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
    var evS = typeof eventShown === 'function' ? eventShown(save) : null, evOwed = evS ? eventOwed(save, evS).length : 0;
    if (more) more.textContent = (evS ? [t('ev.' + evS.name + '.short')] : []).concat([t('mode.daily'), t('mode.rush'), t('mode.av')]).join(' · ');
    /* the event, first in the list while it runs (or while a prize it gave waits) */
    var eb = $('btn-event');
    if (eb) {
      eb.classList.toggle('hidden', !evS);
      if (evS) {
        $('event-name').textContent = t('ev.' + evS.name + '.name');
        $('event-sub').textContent = (evOwed ? t('ev.claim') : t('ev.have', { n: num(eventState(save, evS).g) }) + ' / ' + num(evS.goal)) +
                                     ' · ' + evLeftText(evS);
        $('event-badge').classList.toggle('hidden', !evOwed);
        $('event-new').classList.toggle('hidden', !!eventState(save, evS).seen || !eventOn(evS));
      }
    }
    /* the dragon's egg, while it can be fed (or hatched) */
    /* shown to the event's end, hatched or not (hatched, it thanks the player) */
    var db = $('btn-dragon'), dShown = typeof dragonShown === 'function' && dragonShown(save);
    if (db) {
      db.classList.toggle('hidden', !dShown);
      if (dShown) {
        var DE = dragonState(save);
        $('dragon-sub').textContent = DE.hatched ? t('egg.done') : dragonReady(save) ? t('egg.ready')
          : t('egg.sub', { a: DE.fed, b: DRAGON.days, c: dragonToday(save), d: DRAGON.perDay }) + ' · ' + evLeftText(DRAGON);
        $('dragon-badge').classList.toggle('hidden', !dragonReady(save));
      }
    }
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
    /* the badge: something new inside, until the list has been opened today; or an event's prize waiting */
    if (mb) mb.classList.toggle('hidden', !(((inside || (evS && eventOn(evS) && !eventState(save, evS).seen)) && save.modesSeen !== today) || evOwed));
  }

  /* ---- the event (events.js) ----
     Its page: the picture, what to gather and by when, how many so far,
     and every step with its prize, claimed with its button once reached
     (the owner, 19 Nov 2026). The time left ticks while the page is open. */
  var evTimer = null;
  /* ---- the dragon's egg (1.3.4) ---- */
  var rideKoi = false, eggRaf = null;
  function eggPaint(k, wob) {
    var cv = $('egg-art'); if (!cv || !cv.getContext) return;
    var S = 200, d = Math.min(window.devicePixelRatio || 1, 2.5);
    if (cv.width !== Math.round(S * d)) { cv.width = Math.round(S * d); cv.height = Math.round(S * d); cv.style.width = S + 'px'; cv.style.height = S + 'px'; }
    var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, S, S);
    if (typeof cmDragonEgg !== 'function') return;
    cmEggNest(c, 100, 98, 78, false);
    cmDragonEgg(c, 100 + (wob || 0), 98, 78, k, 0);
    cmEggNest(c, 100, 98, 78, true);
  }
  function buildEgg() {
    var E = dragonState(save), ready = dragonReady(save), today = dragonToday(save);
    $('egg-left').textContent = evLeftText(DRAGON);
    if (E.hatched) {
      if (Game.drawSkinPreview) Game.drawSkinPreview($('egg-art'), 'dragon', 200);
      $('egg-day').textContent = t('egg.hatched');
    } else {
      eggPaint(Math.min(0.85, E.fed / DRAGON.days * 0.85), 0);
      $('egg-day').textContent = ready ? t('egg.ready') : t('egg.day', { n: E.fed, m: DRAGON.days });
    }
    var pips = $('egg-pips'); pips.textContent = '';
    for (var i = 0; i < DRAGON.days; i++) { var p = document.createElement('i'); if (i < E.fed) p.className = 'on'; pips.appendChild(p); }
    $('egg-today').textContent = E.hatched ? t('egg.thanks') : ready ? '' : today >= DRAGON.perDay ? t('egg.doneToday') : t('egg.today', { n: today, m: DRAGON.perDay });
    $('egg-how').classList.toggle('hidden', E.hatched || ready);
    $('egg-hatch').classList.toggle('hidden', !ready);
    $('egg-ride').classList.toggle('hidden', !E.hatched);
    $('egg-story').classList.toggle('hidden', !E.hatched);
    $('egg-play').classList.toggle('hidden', E.hatched || ready || !dragonOn());
  }
  /* ten days fed: the egg rocks, cracks wider and bursts, and the dragon is
     the player's, worn at once */
  function hatchEgg() {
    if (!dragonReady(save)) return;
    var E = dragonState(save);
    E.hatched = true;
    if (!owns('dragon')) save.owned.push('dragon');
    achCheck(save); store();
    $('egg-hatch').classList.add('hidden');
    var t0 = performance.now(), still = matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (Sfx.charge) Sfx.charge(); else Sfx.bubble();
    if (eggRaf) cancelAnimationFrame(eggRaf);
    function frame(now) {
      var f = still ? 1 : Math.min(1, (now - t0) / 1600);
      if (f < 1) {
        eggPaint(0.85 + 0.15 * f, Math.sin(now * 0.05) * 6 * f);
        eggRaf = requestAnimationFrame(frame); return;
      }
      eggRaf = null;
      if (Sfx.boom) Sfx.boom();
      Sfx.gold(); buzz([60, 40, 120]);
      var r = $('egg-art').getBoundingClientRect();
      screenBurst('best', r.left + r.width / 2, r.top + r.height / 2);
      buildEgg();
    }
    eggRaf = requestAnimationFrame(frame);
  }
  function evLeftText(ev) {
    if (!eventOn(ev)) return t('ev.over');
    var L = eventLeft(ev);
    return t('ev.left', { d: L.d, h: L.h });
  }
  function prizeOf(st) {
    var box = document.createElement('span');
    box.className = 'ev-prize';
    [['fish', st.fish], ['gold', st.gold]].forEach(function (c) {
      if (!c[1]) return;
      var it = document.createElement('span'); it.className = 'ev-prize-it';
      it.appendChild(coin(c[0], 16)); it.appendChild(document.createTextNode(num(c[1])));
      box.appendChild(it);
    });
    if (st.frame) {
      var fr = document.createElement('span'); fr.className = 'ev-prize-it';
      var sw = document.createElement('span'); sw.className = 'pf-swatch pf-mini pf-' + st.frame; fr.appendChild(sw);
      fr.appendChild(document.createTextNode(t('prof.f.' + st.frame)));
      box.appendChild(fr);
    }
    return box;
  }
  /* The painting covers the screen as it is really shown: its size and place
     worked out from the event screen's own box, at the painting's shape,
     held to the foot when upright (the board is low) and to the middle on
     its side (the board is central). From the box and not from vh: on an
     iPhone, Safari's bars come and go and vh is not what is seen (the
     owner, 19 Nov 2026, an iPhone 15). Again on every resize. */
  /* the iPhone's home bar, in px (env() is read by CSS only, so through a
     hidden element of the event screen's own) */
  var evSafeEl = null;
  function evSafeBottom() {
    if (!evSafeEl) {
      evSafeEl = document.createElement('div');
      evSafeEl.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;height:0;padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(evSafeEl);
    }
    return parseFloat(getComputedStyle(evSafeEl).paddingBottom) || 0;
  }
  function fitEvent() {
    var sc = $('screen-event'), el = sc && sc.querySelector('.ev-scene');
    if (!el || currentScreen !== 'event') return;
    var W = sc.clientWidth, H = sc.clientHeight; if (!W || !H) return;
    var up = H > W, ar = up ? 768 / 1376 : 1677 / 938, bw = up ? 0.74 : 0.31;
    var w = Math.max(W, H * ar), h = Math.max(H, W / ar);
    /* the board whole across, with a little room: on a very tall, narrow
       screen (9:32) the painting is drawn smaller than the screen is tall,
       the night sky carrying on above it */
    var maxW = (W - 16) / bw;
    if (w > maxW) { w = maxW; h = w / ar; }
    /* On a small screen the painting is brought closer round its board, so
       the table is not a slot to scroll through: the board at least 60% of
       the screen's height or 220 px, while it stays whole on the screen and
       the button still fits under it (the edges, and who stands there, go). */
    var bh = up ? 0.22 : 0.32, want = Math.min(H * 0.6, 220);
    if (h * bh < want) {
      var h2 = want / bh;
      h2 = Math.min(h2, maxW / ar);                                   // whole across
      h2 = up ? Math.min(h2, (H - 4) / 0.375)                          // its top on the screen (held to the foot)
              : Math.min(h2, (H / 2 - 4) / 0.19, (H / 2 - 62) / 0.13); // its top, and the button under it
      if (h2 > h) { h = h2; w = h * ar; }
    }
    var top = up ? H - h : (H - h) / 2;
    el.classList.toggle('ev-up', up);
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.left = ((W - w) / 2) + 'px';
    el.style.top = top + 'px';
    el.style.setProperty('--vis', (H - top) + 'px');   // where the screen ends, in the scene (the button stays above it)
    /* The table in its frame of snow, from the screen and not from the
       painting's board (the owner, 20 Nov 2026: bigger, higher): across
       the screen with a margin, its top a third of the way down (the
       painting's faces above it), down to the button, which goes right
       under it, clear of an iPhone's home bar. On its side, centred and
       half the screen across. At least 300 px tall where there is room. */
    var fr = $('ev-frame'), foot = el.querySelector('.ev-foot');
    if (fr && foot) {
      var pbh = $('ev-play') ? $('ev-play').offsetHeight : 0;          // big letters make the button taller
      var sb = evSafeBottom(), footH = Math.max(64, pbh + 12), gap = 22, snow = 16;
      var bottom = H - sb - footH - gap - 6, fw, fy;
      if (up) {
        fw = Math.min(W - 20, 520);
        fy = Math.max(snow, Math.round(H * 0.3));
        if (bottom - fy < 300) fy = Math.max(snow, bottom - 300);
      } else {
        fw = Math.max(Math.min(W * 0.5, 640), Math.min(360, W - 20));
        fy = Math.max(snow, Math.round(H * 0.07));
      }
      var fx = (W - fw) / 2, ox = (W - w) / 2;
      fr.style.left = (fx - ox) + 'px'; fr.style.top = (fy - top) + 'px';
      fr.style.width = fw + 'px'; fr.style.height = Math.max(100, bottom - fy) + 'px';
      foot.style.left = (fx - ox) + 'px'; foot.style.width = fw + 'px';
      foot.style.top = (Math.max(fy + 100, bottom) + gap - top) + 'px';
    }
    /* the way to Freeride never under Back (a small phone, upright) */
    var pb = $('ev-play'), bk = $('btn-back');
    if (foot && pb && bk) {
      foot.style.transform = ''; pb.classList.remove('ev-play-small');
      var hits = function () {
        var p = pb.getBoundingClientRect(), q = bk.getBoundingClientRect();
        return q.width && p.left < q.right + 8 && p.right > q.left && p.top < q.bottom && p.bottom > q.top ? [p, q] : null;
      };
      var hh = hits();
      if (hh) foot.style.transform = 'translateX(' + Math.max(0, Math.min(hh[1].right + 8 - hh[0].left, W - 4 - hh[0].right)) + 'px)';
      if (hits()) { pb.classList.add('ev-play-small'); hh = hits();      // big letters on a small phone
                    if (hh) foot.style.transform = 'translateX(' + Math.max(0, Math.min(hh[1].right + 8 - hh[0].left, W - 4 - hh[0].right)) + 'px)'; }
      if ((hh = hits())) foot.style.transform += ' translateY(' + (hh[1].top - 8 - hh[0].bottom) + 'px)';   // else above Back
    }
  }
  window.addEventListener('resize', fitEvent);
  window.addEventListener('orientationchange', function () { setTimeout(fitEvent, 250); });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitEvent);
  function buildEvent() {
    var ev = eventShown(save) || EVENTS[0], S = eventState(save, ev);
    if (!S.seen) { S.seen = true; store(); }   // NEW goes once the page has been seen
    fitEvent(); setTimeout(fitEvent, 60);
    $('ev-title').textContent = t('ev.' + ev.name + '.name');
    $('ev-text').textContent = t('ev.' + ev.name + '.text');
    $('ev-goal').textContent = t('ev.goal', { n: ev.goal }).replace(String(ev.goal), num(ev.goal));
    $('ev-left').textContent = evLeftText(ev);
    $('ev-count').textContent = t('ev.have', { n: num(Math.min(S.g, 99999)) }) + ' / ' + num(ev.goal);
    $('ev-fill').style.width = Math.min(100, S.g / ev.goal * 100) + '%';
    var ticks = $('ev-ticks'); ticks.textContent = '';
    ev.stages.forEach(function (st) {
      var k = document.createElement('i'); k.style.left = Math.min(100, st.n / ev.goal * 100) + '%';
      k.className = S.g >= st.n ? 'on' : ''; ticks.appendChild(k);
    });
    var list = $('ev-stages'); list.textContent = '';
    ev.stages.forEach(function (st, i) {
      var got = S.got.indexOf(i) >= 0, ready = !got && S.g >= st.n;
      var row = document.createElement('div');
      row.className = 'ev-stage st-' + (i % 4) + (got ? ' got' : ready ? ' ready' : '');
      var main = document.createElement('div'); main.className = 'ev-st-main';
      var n = document.createElement('span'); n.className = 'ev-st-n';
      n.textContent = t('ev.stage', { n: st.n }).replace(String(st.n), num(st.n));
      main.appendChild(n);
      main.appendChild(prizeOf(st));
      row.appendChild(main);
      if (ready) {
        var b = document.createElement('button');
        b.className = 'btn btn-sm btn-gold ev-claim'; b.setAttribute('data-claim', String(i));
        b.textContent = t('ev.claim'); row.appendChild(b);
      } else {
        var tg = document.createElement('span'); tg.className = 'ev-st-tag';
        tg.textContent = got ? '\u2713 ' + t('ev.claimed') : num(Math.min(S.g, st.n)) + ' / ' + num(st.n);
        row.appendChild(tg);
      }
      list.appendChild(row);
    });
    $('ev-play').classList.toggle('hidden', !eventOn(ev));
    /* A new player: Freeride is shut until the first Known Line is
       finished. The page says so, and its button rides that line; it used
       to drop him in the Known Lines list with no word why (the owner,
       19 Nov 2026). */
    var open = freeUnlocked(), first = t('course.' + COURSES[0].id + '.name'), play = $('ev-play');
    play.setAttribute('data-action', open ? 'play' : 'tut-first');
    play.textContent = open ? t('ev.play') : t('tut.done.go', { n: first });
    $('ev-lock').textContent = open ? '' : t('mode.free.locked', { n: first });
    if (evTimer) clearInterval(evTimer);
    evTimer = setInterval(function () { if (currentScreen === 'event') $('ev-left').textContent = evLeftText(ev); }, 30000);
  }
  $('ev-stages').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-claim]') : null;
    if (!b) return;
    var ev = eventShown(save) || EVENTS[0], i = parseInt(b.getAttribute('data-claim'), 10), st = ev.stages[i], S = eventState(save, ev);
    if (!st || S.g < st.n || S.got.indexOf(i) >= 0) return;
    S.got.push(i);
    if (st.fish) save.fish += st.fish;
    if (st.gold) save.gold += st.gold;
    /* the frame is put on at once: it is what the whole event was for */
    if (st.frame && save.prof.own.indexOf(st.frame) < 0) { save.prof.own.push(st.frame); save.prof.frame = st.frame; }
    Sfx.gold(); buzz(28);
    var r = b.getBoundingClientRect();
    screenBurst(st.gold && !st.fish ? 'gold' : 'best', r.left + r.width / 2, r.top + r.height / 2);
    store();
    buildEvent();
    refreshModes();
  });

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
    $('runs-count').textContent = t('runs.count', { a: total, b: COURSES.length * 3, n: COURSES.length * 3 });

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
      row.textContent = t('tasks.done', { s: taskText(tk) }) + '   +' + TASK_PAY + '\u00a0' + t('cur.fish', { n: TASK_PAY });
      box.appendChild(row);
    });
    if (tasks.length && save.tasks.done.length === 3) {
      var all = document.createElement('div');
      all.className = 'won-row won-task';
      all.textContent = t('tasks.all') + '   +' + TASK_BONUS + '\u00a0' + t('cur.fish', { n: TASK_BONUS });
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
      var got = done.indexOf(tk.id) >= 0;
      var row = document.createElement(got ? 'div' : 'button');
      row.className = 'task-row' + (got ? ' got' : ' go');
      if (!got) row.setAttribute('data-go', tk.go || 'free');
      var tick = document.createElement('span'); tick.className = 'task-tick'; tick.textContent = got ? '✓' : '';
      var tx = document.createElement('span'); tx.className = 'task-txt'; tx.textContent = taskText(tk);
      var pay = document.createElement('span'); pay.className = 'task-pay'; pay.textContent = '+' + TASK_PAY;
      row.appendChild(tick); row.appendChild(tx); row.appendChild(pay);
      if (!got) row.appendChild(goMark());
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
    /* the ones waiting to be paid come first, where they are seen; then the
       ones still to earn; the ones earned and paid go last (the owner,
       18 Nov 2026: what is left to do above what is done) */
    var order = owedAll.concat(
      ACHIEVEMENTS.filter(function (a) { return owedAll.indexOf(a) < 0 && save.ach.indexOf(a.id) < 0; }),
      ACHIEVEMENTS.filter(function (a) { return owedAll.indexOf(a) < 0 && save.ach.indexOf(a.id) >= 0; }));
    order.forEach(function (a) {
      var p = achProgress(a, save);
      var got = save.ach.indexOf(a.id) >= 0;

      /* one not yet earned is a button to where it is earned (a.go) */
      var row = document.createElement(got ? 'div' : 'button');
      row.className = 'ach-row' + (got ? ' got' : ' go');
      if (!got) row.setAttribute('data-go', a.go || 'free');

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
        rew.textContent = '+' + a.reward + '\u00a0' + t('cur.fish', { n: a.reward });
        right.appendChild(rew);
      }
      row.appendChild(right);
      if (!got) row.appendChild(goMark());

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
    var g = e.target.closest ? e.target.closest('[data-go]') : null;
    if (g) { goEarn(g.getAttribute('data-go')); return; }
    var b = e.target.closest ? e.target.closest('[data-claim]') : null;
    if (!b) return;
    claimFx(b, achClaim(save, b.getAttribute('data-claim')));
  });
  $('tasks-list').addEventListener('click', function (e) {
    var g = e.target.closest ? e.target.closest('[data-go]') : null;
    if (g) goEarn(g.getAttribute('data-go'));
  });

  /* A trophy or a task not yet earned, tapped: straight to where it is
     earned (asked for by the owner, 17 Nov 2026). Its `go` (see
     achievements.js) names the place. Freeride and the modes open only
     after First Light, so until then everything leads to the lines. */
  function goMark() {
    var m = document.createElement('span');
    m.className = 'go-mark';
    m.setAttribute('aria-hidden', 'true');
    m.textContent = '\u203a';
    return m;
  }
  function lineToRide(wantThree) {
    for (var i = 0; i < COURSES.length; i++) {
      if (!runUnlocked(i)) break;
      var st = save.courses[COURSES[i].id] || 0;
      if (wantThree ? st < 3 : st === 0) return COURSES[i].id;
    }
    return null;
  }
  function goEarn(where) {
    Sfx.click();
    if (where === 'shop') { shopBack = currentScreen; show('shop'); return; }
    if (where === 'lines' || where === 'stars' || !freeUnlocked()) {
      var id = lineToRide(where === 'stars');
      if (id) ride(id); else { shopBack = currentScreen; show('runs'); }
      return;
    }
    if (where === 'rush' || where === 'avalanche') { ride(null, where); return; }
    if (where === 'daily') { ride('daily'); return; }
    ride(null);
  }
  $('ach-prize').addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.prize-take') : null;
    var sk = trophySkin();
    if (!b || !sk || !trophyWaiting()) return;
    save.owned.push(sk.id);
    save.equipped = sk.id;          // taken, and put on straight away
    applyLook();
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
    syncQuality();
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
  var lastTap = -1e9;
  window.addEventListener('pointerdown', function (e) {
    if (currentScreen !== 'game' || Game.isPaused()) return;
    if (e.target && e.target.closest && e.target.closest('button, [data-action]')) return;
    /* Every finger that lands steers. A second finger down while the first
       was still on the glass used to pause, and playing fast, both thumbs
       or a quick double tap, paused the run (the owner, 18 Nov 2026). The
       button in the corner pauses. */
    var now = e.timeStamp || Date.now();
    if (now - lastTap < 45) return;
    lastTap = now;
    Game.tap();
  });
  document.addEventListener('contextmenu', function (e) {
    if (currentScreen === 'game') e.preventDefault();
  });
  /* and no selection starts anywhere, a held tap included (there are no
     fields to type in) */
  document.addEventListener('selectstart', function (e) { e.preventDefault(); });

  /* ------------------------- keyboard ------------------------ */
  /* Esc is never swallowed: Design req. 2 forbids preventDefault() on it. */
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (closeSheet()) { Sfx.click(); return; }
      /* the comic has its own Skip where the back arrow would sit */
      if (currentScreen === 'comic') { Sfx.click(); finishComic(); return; }
      if (BACKABLE[currentScreen]) { act('back-title'); }
      else if (currentScreen === 'pause') act('resume');
      /* Esc also leaves fullscreen; a platform that keeps it out of play
         (noEscPause) pauses only by P or the button. */
      else if (Game.isRunning() && !Game.isPaused() && !PLAT.noEscPause) { Game.pause(); show('pause'); }
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
  applyGfx(qRecord());
  show('title');
  /* the title was measured in the fallback font; measure it again in its own */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitScreen);

  requestAnimationFrame(function () {
    announce('firstFrameReady');
    loadSave().then(function () {
      canSave = true;
      settle(true);
      if (cloudKnown) store();      // the cloud's save kept here, or this one given to it
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
      announce('gameReady');
    });
  });
})();
