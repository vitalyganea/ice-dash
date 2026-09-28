/* ===========================================================
   i18n.js — English and Russian
   -----------------------------------------------------------
   English is the fallback for every key, because Playables requires
   the game to work in English whatever else it offers.

   Russian declines its nouns after a number (1 рыба, 2 рыбы, 5 рыб),
   so the readouts are written as labels — "рыба: 37" — rather than as
   counted phrases. That is ordinary Russian for a scoreboard and it
   sidesteps the whole problem instead of half-solving it.
   =========================================================== */

var LANGS = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' }
];

var STRINGS = {
  'title.tagline': {
    en: 'One tap sends you the other way. Mind the trees!',
    ru: 'Одно касание — и ты летишь в другую сторону. Берегись деревьев!' },
  'title.best':    { en: '🏔️ Best {n} points', ru: '🏔️ Рекорд: {n}' },

  'btn.ride':      { en: '▶ Ride',          ru: '▶ Поехали' },
  'btn.market':    { en: '🐟 Market',       ru: '🐟 Рынок' },
  'btn.help':      { en: '❓ How to play',  ru: '❓ Как играть' },
  'btn.settings':  { en: '⚙️ Settings',     ru: '⚙️ Настройки' },
  'btn.back':      { en: '⟵ Back',         ru: '⟵ Назад' },
  'btn.gotit':     { en: 'Got it!',         ru: 'Понятно!' },
  'btn.keepgoing': { en: '▶ Keep going',    ru: '▶ Продолжить' },
  'btn.newrun':    { en: '↻ New run',       ru: '↻ Новый заезд' },
  'btn.menu':      { en: '🏠 Menu',         ru: '🏠 Меню' },
  'btn.again':     { en: '↻ Ride again',    ru: '↻ Ещё раз' },

  'help.title': { en: 'How to play', ru: 'Как играть' },
  'help.1': { en: 'Your animal slides on its belly, and always drifts to one side',
              ru: 'Зверь скользит на животе и всё время сносит в одну сторону' },
  'help.2': { en: '<b>Tap anywhere</b> (or press <b class="keycap">Space</b>) to slide the other way',
              ru: '<b>Нажми в любом месте</b> (или <b class="keycap">Пробел</b>), чтобы сменить сторону' },
  'help.3': { en: 'That is the only control. Time your taps to weave between the pines and rocks',
              ru: 'Это всё управление. Рассчитывай касания, чтобы пройти между соснами и камнями' },
  'help.4': { en: '🐟 Swallow fish as you pass — 25 points each',
              ru: '🐟 Глотай рыбу на ходу — по 25 очков' },
  'help.5': { en: '✨ A <b>golden fish</b> is worth 150, but it never sits on the easy line',
              ru: '✨ <b>Золотая рыбка</b> стоит 150, но никогда не лежит на удобной линии' },
  'help.6': { en: '🫧 A <b>snow bubble</b> takes one crash for you — grab it when you can',
              ru: '🫧 <b>Снежный пузырь</b> примет один удар на себя — хватай, если получится' },
  'help.7': { en: '🚩 Slip between the flag gates for a bonus',
              ru: '🚩 Проскочи между флажками — это бонус' },
  'help.8': { en: '🕳️ A crevasse splits the whole run. The snow ramp sitting in the gap is the way over — aim at the chevrons and you fly',
              ru: '🕳️ Трещина рассекает всю трассу. Перебраться можно только по снежному трамплину в проёме — целься в стрелки, и ты в воздухе' },
  'help.9': { en: '🛒 Fish are money. Spend them at the <b>Market</b> on a new animal, and each one changes how you earn',
              ru: '🛒 Рыба — это валюта. Трать её на <b>Рынке</b> на нового зверя: каждый меняет то, как ты зарабатываешь' },
  'help.10': { en: '🧊 On the glacier he turns lazily — tap earlier',
               ru: '🧊 На леднике поворот вялый — нажимай заранее' },
  'help.11': { en: '🌙 At night you see less of the hill ahead',
               ru: '🌙 Ночью склон впереди виден хуже' },
  'help.12': { en: 'One crash ends the run. How far can you get?',
               ru: 'Один удар — и заезд окончен. Как далеко ты уедешь?' },

  'pause.title': { en: 'Paused', ru: 'Пауза' },

  'over.title':   { en: 'Ouch!',          ru: 'Ой!' },
  'over.newbest': { en: '🏆 New best!',   ru: '🏆 Новый рекорд!' },
  'over.points':  { en: '{n} points',     ru: 'Очки: {n}' },

  'shop.title':    { en: 'Fish Market', ru: 'Рыбный рынок' },
  'shop.note':     { en: 'Wear one at a time. Every catch you make pays for the next one.',
                     ru: 'Носить можно только одного. Каждый улов приближает следующего.' },
  'shop.wear':     { en: 'Wear',      ru: 'Надеть' },
  'shop.wearing':  { en: '✓ Wearing', ru: '✓ Надет' },
  'shop.needmore': { en: 'Catch {n} more', ru: 'Не хватает: {n}' },

  'set.title':    { en: 'Settings', ru: 'Настройки' },
  'set.sound':    { en: 'Sound',    ru: 'Звук' },
  'set.sounds':   { en: '🔊 Sounds', ru: '🔊 Звуки' },
  'set.music':    { en: '🎵 Music',  ru: '🎵 Музыка' },
  'set.language': { en: 'Language', ru: 'Язык' },

  'unit.m':      { en: 'm',       ru: 'м' },
  'unit.fish':   { en: 'fish',    ru: 'рыба' },
  'unit.golden': { en: 'golden',  ru: 'золотые' },
  'unit.gates':  { en: 'gates',   ru: 'ворота' },
  'unit.saves':  { en: 'bubble saves', ru: 'спасения пузырём' },

  'hud.score':  { en: 'SCORE',  ru: 'ОЧКИ' },
  'hud.metres': { en: 'METRES', ru: 'МЕТРЫ' },
  'hud.best':   { en: 'BEST',   ru: 'РЕКОРД' },

  'biome.0': { en: 'Pine Forest', ru: 'Сосновый лес' },
  'biome.1': { en: 'Rocky Pass',  ru: 'Скалистый перевал' },
  'biome.2': { en: 'Glacier',     ru: 'Ледник' },
  'biome.3': { en: 'Night Run',   ru: 'Ночной спуск' },

  'skin.snowcap.name': { en: 'Snowcap', ru: 'Снежок' },
  'skin.snowcap.perk': { en: 'No bonus — the honest baseline.',
                         ru: 'Без бонуса — честная точка отсчёта.' },
  'skin.mitten.name':  { en: 'Mitten', ru: 'Варежка' },
  'skin.mitten.perk':  { en: 'Hoovers up fish from much further away.',
                         ru: 'Собирает рыбу с гораздо большего расстояния.' },
  'skin.bubbles.name': { en: 'Bubbles', ru: 'Пузырь' },
  'skin.bubbles.perk': { en: 'Starts every run already inside a bubble.',
                         ru: 'Начинает каждый заезд уже в пузыре.' },
  'skin.compass.name': { en: 'Compass', ru: 'Компас' },
  'skin.compass.perk': { en: 'Finds far more shoals, and bigger ones.',
                         ru: 'Находит куда больше косяков, и покрупнее.' },
  'skin.seal.name':    { en: 'Seal', ru: 'Тюлень' },
  'skin.seal.perk':    { en: 'Sniffs out the golden fish, far more of them.',
                         ru: 'Вынюхивает золотых рыбок — их становится намного больше.' },
  'skin.walrus.name':  { en: 'Walrus', ru: 'Морж' },
  'skin.walrus.perk':  { en: 'Barges the flag gates for triple the catch.',
                         ru: 'Проламывает флажковые ворота — тройной улов.' },
  'skin.fox.name':     { en: 'Arctic Fox', ru: 'Песец' },
  'skin.fox.perk':     { en: 'Sure-footed — the glacier cannot swing her wide.',
                         ru: 'Твёрдая лапа — ледник её уже не заносит.' },
  'skin.bear.name':    { en: 'Polar Bear', ru: 'Белый медведь' },
  'skin.bear.perk':    { en: 'Hits a ramp so hard he clears half the hill — and starts shielded.',
                         ru: 'Бьёт по трамплину так, что пролетает полсклона — и стартует под щитом.' }
};

var LANG = 'en';

function langKnown(id) {
  for (var i = 0; i < LANGS.length; i++) if (LANGS[i].id === id) return true;
  return false;
}

/* Whatever the device asks for, if we do not have it we speak English. */
function detectLang() {
  var want = [];
  try {
    if (navigator.languages) want = want.concat(navigator.languages);
    if (navigator.language) want.push(navigator.language);
  } catch (e) {}
  for (var i = 0; i < want.length; i++) {
    var id = String(want[i]).toLowerCase().split('-')[0];
    if (langKnown(id)) return id;
  }
  return 'en';
}

function setLang(id) { LANG = langKnown(id) ? id : 'en'; }
function getLang() { return LANG; }

/* `vars` fills {placeholders}. A missing key returns the fallback, and
   failing that the key itself, so a gap shows up rather than going blank. */
function t(key, vars, fallback) {
  var e = STRINGS[key];
  var s = e ? (e[LANG] || e.en) : (fallback != null ? fallback : key);
  if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}

/* Elements carry their key in data-i18n. The -html variant is for the few
   lines with <b> in them; every one of those strings is in this file, so
   nothing from outside ever reaches innerHTML. */
function applyI18n(root) {
  root = root || document;
  var i, els = root.querySelectorAll('[data-i18n]');
  for (i = 0; i < els.length; i++) els[i].textContent = t(els[i].getAttribute('data-i18n'));
  els = root.querySelectorAll('[data-i18n-html]');
  for (i = 0; i < els.length; i++) els[i].innerHTML = t(els[i].getAttribute('data-i18n-html'));
  els = root.querySelectorAll('[data-i18n-aria]');
  for (i = 0; i < els.length; i++)
    els[i].setAttribute('aria-label', t(els[i].getAttribute('data-i18n-aria')));
  try { document.documentElement.setAttribute('lang', LANG); } catch (e) {}
}
