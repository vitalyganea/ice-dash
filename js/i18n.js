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
  'title.best':    { en: 'Best {n} points', ru: 'Рекорд: {n}' },

  'btn.ride':      { en: '▶ Ride',          ru: '▶ Поехали' },
  'btn.market':    { en: 'Market',          ru: 'Рынок' },
  'btn.help':      { en: 'How to play',     ru: 'Как играть' },
  'btn.settings':  { en: 'Settings',        ru: 'Настройки' },
  'btn.back':      { en: 'Back',         ru: 'Назад' },
  'btn.gotit':     { en: 'Got it!',         ru: 'Понятно!' },
  'btn.keepgoing': { en: 'Keep going',    ru: '▶ Продолжить' },
  'btn.newrun':    { en: 'New run',       ru: 'Новый заезд' },
  'btn.startover': { en: 'Give up and start over', ru: 'Сдаться и начать заново' },
  'over.lives':    { en: '{n} spare in hand', ru: 'в запасе: {n}' },
  'pause.kept':    { en: 'Your run is waiting for you in the menu.',
                     ru: 'Заезд подождёт тебя в меню.' },
  'btn.menu':      { en: 'Menu',            ru: 'Меню' },
  'btn.again':     { en: 'Ride again',    ru: 'Ещё раз' },

  'help.title': { en: 'How to play', ru: 'Как играть' },
  'help.hero':     { en: '<b>Tap anywhere</b> to slide the other way<br><span class="help-key">or press <b class="keycap">Space</b></span>',
                     ru: '<b>Нажми в любом месте</b>, чтобы сменить сторону<br><span class="help-key">или нажми <b class="keycap">Пробел</b></span>' },
  'help.hero.sub': { en: 'That is the whole control. Time your taps to weave between the pines and rocks.',
                     ru: 'Это всё управление. Рассчитывай касания, чтобы пройти между соснами и камнями.' },
  'help.h.hill':   { en: 'On the hill',       ru: 'На склоне' },
  'help.h.grab':   { en: 'Worth picking up',  ru: 'Стоит подобрать' },
  'help.h.rest':   { en: 'Off the hill',      ru: 'Вне склона' },
  'help.1': { en: 'Your animal slides on its belly, and always drifts to one side',
              ru: 'Зверь скользит на животе и всё время сносит в одну сторону' },
  'help.4': { en: 'Swallow fish as you pass — 25 points each',
              ru: 'Глотай рыбу на ходу — по 25 очков' },
  'help.5': { en: 'A <b>golden fish</b> is worth 150, but it never sits on the easy line',
              ru: '<b>Золотая рыбка</b> стоит 150, но никогда не лежит на удобной линии' },
  'help.6': { en: 'A <b>snow bubble</b> takes one crash for you — grab it when you can',
              ru: '<b>Снежный пузырь</b> примет один удар на себя — хватай, если получится' },
  'help.7': { en: 'Slide through a <b>ring of ice crystals</b> for a bonus — it never sits on the safe line',
              ru: 'Проскользи сквозь <b>кольцо ледяных кристаллов</b> — это бонус, и стоит оно всегда в стороне от безопасной линии' },
  /* The ramp lost its painted chevrons when it became plain ice; the text
     still told players to aim at them. */
  'help.8': { en: 'A crevasse splits the whole run. The ice ramp in the opening is the way over — hit it square and you fly',
              ru: 'Трещина рассекает всю трассу. Перебраться можно по ледяному трамплину в проёме — заходи на него прямо, и ты в воздухе' },
  'help.9': { en: 'Fish are money. Spend them at the <b>Market</b> on a new animal, and each one changes how you earn',
              ru: 'Рыба — это валюта. Трать её на <b>Рынке</b> на нового зверя: каждый меняет то, как ты зарабатываешь' },
  'help.10': { en: 'On the glacier he turns lazily — tap earlier',
               ru: 'На леднике поворот вялый — нажимай заранее' },
  'help.11': { en: 'At night you see less of the hill ahead',
               ru: 'Ночью склон впереди виден хуже' },
  'help.rush': { en: 'A <b>ball of packed powder</b> sets him rolling: for six seconds nothing on the hill can stop him',
                 ru: '<b>Ком снега</b> разгоняет его: шесть секунд его ничто не остановит' },
  'help.find': { en: 'A <b>nodule of clear ice</b> has something frozen inside. Crack it open after the run',
                 ru: 'В <b>куске прозрачного льда</b> что-то вморожено. Расколи его после заезда' },
  'help.snow': { en: 'A patch of <b>deep snow</b> never hurts you — it only bogs you down, and your speed is your score',
                 ru: '<b>Глубокий снег</b> не убивает — он только вязнет под тобой, а скорость это и есть очки' },
  'help.geyser': { en: 'Meltwater breaks through the ice in bursts. It stands clear of the middle of an opening, so there is always a way round',
                   ru: 'Талая вода пробивает лёд толчками. Она никогда не стоит посреди проёма — обойти можно всегда' },
  /* the first-run tutorial */
  'tut.start':    { en: 'Welcome to Ice Dash! <b>Tap anywhere</b> to start sliding',
                    ru: 'Добро пожаловать в Ice Dash! <b>Коснись экрана</b>, чтобы поехать' },
  'tut.left':     { en: '<b>Tap once</b> — you slide to the <b>left</b>, through the gap',
                    ru: '<b>Коснись один раз</b> — и ты скользишь <b>влево</b>, в проход' },
  'tut.right':    { en: '<b>Tap again</b> — now you slide to the <b>right</b>',
                    ru: '<b>Коснись ещё раз</b> — теперь ты скользишь <b>вправо</b>' },
  'tut.going':    { en: 'You are already sliding the right way — keep going!',
                    ru: 'Ты уже скользишь куда надо — так держать!' },
  'tut.nice':     { en: 'Nice!', ru: 'Отлично!' },
  'tut.weave':    { en: 'That is the whole control: <b>every tap switches sides</b>. Weave through the gaps',
                    ru: 'Вот и всё управление: <b>каждое касание меняет сторону</b>. Петляй между деревьями' },
  'tut.fish':     { en: 'Swallow the <b>fish</b> — they are your money in the Market',
                    ru: 'Глотай <b>рыбу</b> — это твои деньги на Рынке' },
  'tut.gold':     { en: 'A <b>golden fish</b> is worth far more. Lean out for it',
                    ru: '<b>Золотая рыбка</b> стоит намного больше. Потянись за ней' },
  'tut.bubble':   { en: 'A <b>snow bubble</b> saves you from one crash',
                    ru: '<b>Снежный пузырь</b> спасает от одного столкновения' },
  'tut.gate':     { en: 'Slide through the <b>crystal ring</b> for a bonus — it turns gold',
                    ru: 'Проскользи сквозь <b>кольцо кристаллов</b> — получишь бонус, и оно станет золотым' },
  'tut.bridge':   { en: 'A <b>snow bridge</b> — just slide straight under it',
                    ru: '<b>Снежный мост</b> — просто проскользни под ним' },
  'tut.crevasse': { en: 'A <b>crevasse</b>! Hit the <b>ramp</b> in the gap and you fly over',
                    ru: '<b>Трещина</b>! Попади на <b>трамплин</b> в проходе — и перелетишь' },
  'tut.finish':   { en: 'That is everything. <b>Reach the finish!</b>',
                    ru: 'Вот и всё. <b>Доберись до финиша!</b>' },
  'tut.oops':     { en: 'Oops! No harm done — try again',
                    ru: 'Ой! Ничего страшного — попробуй ещё' },
  'tut.skip':     { en: 'Skip tutorial', ru: 'Пропустить обучение' },
  'tut.done.title': { en: 'You are ready!', ru: 'Ты готов!' },
  'tut.done.text':  { en: 'That is the whole game. Now ride your first real line down the mountain.',
                      ru: 'Это вся игра. Теперь проедь свою первую настоящую трассу.' },
  'tut.done.go':    { en: 'Ride {n}', ru: 'Ехать: {n}' },
  'help.replay':    { en: 'Play the tutorial', ru: 'Пройти обучение' },
  'help.bridge': { en: 'A <b>snow bridge</b> arches over the run. Slide straight under it — nothing waits beneath, and the way on is clear when you come out',
                   ru: '<b>Снежный мост</b> нависает над трассой. Просто скользи под ним — внутри ничего нет, а на выходе путь свободен' },
  'help.fork': { en: 'Where bare rock splits the run, both ways past are open. The tighter one is the one with the gold down it',
                 ru: 'Там, где голая скала делит трассу, открыты оба пути. Золото лежит на том, что поуже' },
  'help.chill': { en: 'A <b>cold draught</b> runs the whole hill slow for three seconds',
                  ru: '<b>Холодный поток</b> на три секунды замедляет весь склон' },
  'help.sight': { en: 'A <b>clear lens of ice</b> lights up the next openings before you reach them',
                  ru: '<b>Линза чистого льда</b> подсвечивает следующие проёмы заранее' },
  'help.call': { en: 'A <b>ring of fish</b> sets every fish on the hill drifting towards you for five seconds',
                 ru: '<b>Кольцо рыб</b> на пять секунд тянет к тебе всю рыбу на склоне' },
  'help.12': { en: 'Two fingers at once, or the button in the corner, pauses the run',
               ru: 'Пауза — двумя пальцами одновременно или кнопкой в углу' },
  'help.13': { en: 'One crash ends the run — unless you have a spare life in hand',
               ru: 'Один удар — и заезд окончен. Если только у тебя нет запасной жизни' },

  'pause.title': { en: 'Paused', ru: 'Пауза' },

  'over.title':   { en: 'Ouch!',          ru: 'Ой!' },
  'over.newbest': { en: 'New best!',      ru: 'Новый рекорд!' },
  'over.points':  { en: '{n} points',     ru: 'Очки: {n}' },

  'shop.title':    { en: 'Fish Market', ru: 'Рыбный рынок' },
  'shop.note':     { en: 'Wear one at a time. Every catch you make pays for the next one.',
                     ru: 'Носить можно только одного. Каждый улов приближает следующего.' },
  'shop.wear':     { en: 'Wear',      ru: 'Надеть' },
  'shop.wearing':  { en: '✓ Wearing', ru: '✓ Надет' },
  'shop.needmore': { en: 'Catch {n} more', ru: 'Не хватает: {n}' },

  'set.title':    { en: 'Settings', ru: 'Настройки' },
  'set.sound':    { en: 'Sound',    ru: 'Звук' },
  'set.sounds':   { en: 'Sounds', ru: 'Звуки' },
  'set.music':    { en: 'Music',  ru: 'Музыка' },
  'set.language': { en: 'Language', ru: 'Язык' },

  'unit.m':      { en: 'm',       ru: 'м' },
  'unit.fish':   { en: 'fish',    ru: 'рыба' },
  'unit.golden': { en: 'golden',  ru: 'золотые' },
  'unit.gates':  { en: 'crystal rings', ru: 'кольца' },
  'unit.saves':  { en: 'bubble saves', ru: 'спасения пузырём' },

  'hud.score':  { en: 'SCORE',  ru: 'ОЧКИ' },
  'hud.metres': { en: 'METRES', ru: 'МЕТРЫ' },
  'hud.best':   { en: 'BEST',   ru: 'РЕКОРД' },

  'hud.m':    { en: 'M', ru: 'М' },
  'hud.s':    { en: 's', ru: 'с' },
  'btn.pause': { en: 'Pause', ru: 'Пауза' },
  'btn.continue': { en: 'Continue your run', ru: 'Продолжить заезд' },
  'cur.fish':  { en: 'fish', ru: 'рыбы' },
  'revive.title': { en: 'That was close',  ru: 'Чуть не упал' },
  'revive.sub':   { en: 'Use a spare life and carry on from where you fell?',
                    ru: 'Потратить запасную жизнь и продолжить с того же места?' },
  'revive.left':  { en: 'Spare lives: {n}', ru: 'Запасных жизней: {n}' },
  'revive.use':   { en: 'Use a life',       ru: 'Потратить жизнь' },
  'revive.skip':  { en: 'End the run',      ru: 'Закончить заезд' },
  'revive.go':    { en: 'Go!',              ru: 'Вперёд!' },
  'shop.life':      { en: 'Spare life',     ru: 'Запасная жизнь' },
  'shop.life.desc': { en: 'Carry on from where you fell, once per crash.',
                      ru: 'Продолжить с места падения — один раз за падение.' },
  'shop.life.have': { en: 'In hand: {n} of {m}', ru: 'В запасе: {n} из {m}' },
  'shop.life.full': { en: 'Full',           ru: 'Больше не влезет' },
  'shop.buy':       { en: 'Buy',            ru: 'Купить' },
  'find.have':   { en: 'Frozen finds: {n}', ru: 'Ледяных находок: {n}' },
  'find.open':   { en: 'Crack it open',     ru: 'Расколоть' },
  'find.again':  { en: 'Open another',      ru: 'Расколоть ещё' },
  'find.fish':   { en: 'Inside: {n} fish',  ru: 'Внутри: рыбы — {n}' },
  'find.gold':   { en: 'Inside: {n} golden fish', ru: 'Внутри: золотых рыбок — {n}' },
  'find.life':   { en: 'Inside: a spare life', ru: 'Внутри: запасная жизнь' },
  'find.lifefull': { en: 'A spare life — but you are carrying all you can, so {n} fish instead',
                     ru: 'Запасная жизнь — но больше не унести, поэтому {n} рыбы взамен' },
  'find.hint':   { en: 'A nodule of clear ice with something caught in it. Rare, and never on the easy line.',
                   ru: 'Кусок прозрачного льда с чем-то внутри. Редкость, и никогда не на удобной линии.' },
  'cur.gold':  { en: 'gold', ru: 'золота' },
  'biome.0': { en: 'Pine Forest',  ru: 'Сосновый лес' },
  'biome.1': { en: 'Rocky Pass',   ru: 'Скалистый перевал' },
  'biome.2': { en: 'Arctic Shelf', ru: 'Арктический шельф' },
  'biome.3': { en: 'Glacier',      ru: 'Ледник' },
  'biome.4': { en: 'Ashfall',      ru: 'Пепелище' },
  'biome.5': { en: 'Midwinter',    ru: 'Солнцеворот' },
  'biome.6': { en: 'Night Run',    ru: 'Ночной спуск' },
  'biome.7': { en: 'Emberflow',    ru: 'Огненная река' },
  'biome.8': { en: 'Hollyfrost',   ru: 'Рябина в снегу' },
  'biome.9': { en: 'Everwinter',   ru: 'Вечная зима' },


  'btn.trophies': { en: 'Trophies',      ru: 'Награды' },
  'ach.title':    { en: 'Trophies',      ru: 'Награды' },
  'ach.note':     { en: 'Every one of them pays out in fish.',
                    ru: 'За каждую награду платят рыбой.' },
  'ach.count':    { en: '{a} of {b} earned', ru: 'Получено: {a} из {b}' },
  'ach.earned':   { en: 'Earned', ru: 'Получено' },
  'over.unlocked':{ en: 'Trophy!', ru: 'Награда!' },

  'ach.find1.name':    { en: 'Something Inside', ru: 'Что-то внутри' },
  'ach.find1.desc':    { en: 'Crack open a frozen find', ru: 'Расколоть ледяную находку' },
  'ach.find10.name':   { en: 'Prospector',   ru: 'Старатель' },
  'ach.find10.desc':   { en: 'Crack open ten of them', ru: 'Расколоть десять находок' },
  'ach.forks10.name':  { en: 'Round the Rock', ru: 'Вокруг скалы' },
  'ach.forks10.desc':  { en: 'Get past ten nunataks', ru: 'Обойти десять скал' },
  'ach.rush5.name':    { en: 'Snowball',     ru: 'Снежный ком' },
  'ach.rush5.desc':    { en: 'Take five snow rushes', ru: 'Взять пять снежных комьев' },
  'ach.smash50.name':  { en: 'Right Through', ru: 'Напролом' },
  'ach.smash50.desc':  { en: 'Plough through fifty obstacles',
                         ru: 'Снести пятьдесят препятствий' },
  'ach.revive1.name':  { en: 'Second Wind',  ru: 'Второе дыхание' },
  'ach.revive1.desc':  { en: 'Carry on after spending a life',
                         ru: 'Продолжить, потратив жизнь' },
  'ach.lines1.name':   { en: 'Line Learnt',  ru: 'Линия выучена' },
  'ach.lines1.desc':   { en: 'Finish a marked run', ru: 'Пройти знакомую линию' },
  'ach.linesAll.name': { en: 'Every Line',   ru: 'Все линии' },
  'ach.linesAll.desc': { en: 'Finish all six of them', ru: 'Пройти все шесть' },
  'ach.stars18.name':  { en: 'Nothing Left to Learn', ru: 'Больше нечему учиться' },
  'ach.stars18.desc':  { en: 'Three stars on every marked run',
                         ru: 'По три звезды на каждой линии' },
  'ach.first.name':    { en: 'Off the Top',  ru: 'Первый спуск' },
  'ach.first.desc':    { en: 'Finish a run', ru: 'Завершить заезд' },
  'ach.dist500.name':  { en: 'Warmed Up',    ru: 'Разогрелся' },
  'ach.dist500.desc':  { en: 'Reach 500 m in one run',  ru: 'Проехать 500 м за заезд' },
  'ach.dist2000.name': { en: 'Long Haul',    ru: 'Долгий путь' },
  'ach.dist2000.desc': { en: 'Reach 2000 m in one run', ru: 'Проехать 2000 м за заезд' },
  'ach.dist5000.name': { en: 'Down the Whole Mountain', ru: 'Вся гора целиком' },
  'ach.dist5000.desc': { en: 'Reach 5000 m in one run', ru: 'Проехать 5000 м за заезд' },
  'ach.runfish30.name':{ en: 'Good Haul',    ru: 'Богатый улов' },
  'ach.runfish30.desc':{ en: 'Swallow 30 fish in one run', ru: 'Съесть 30 рыб за заезд' },
  'ach.fish500.name':  { en: 'Well Fed',     ru: 'Сытый' },
  'ach.fish500.desc':  { en: 'Swallow 500 fish altogether', ru: 'Съесть 500 рыб всего' },
  'ach.fish3000.name': { en: 'Emptied the Sea', ru: 'Опустошил море' },
  'ach.fish3000.desc': { en: 'Swallow 3000 fish altogether', ru: 'Съесть 3000 рыб всего' },
  'ach.gold1.name':    { en: 'Something Shiny', ru: 'Что-то блестящее' },
  'ach.gold1.desc':    { en: 'Catch a golden fish', ru: 'Поймать золотую рыбку' },
  'ach.gold25.name':   { en: 'Gold Rush',    ru: 'Золотая лихорадка' },
  'ach.gold25.desc':   { en: 'Catch 25 golden fish', ru: 'Поймать 25 золотых рыбок' },
  'ach.gates100.name': { en: 'Ice Reader',   ru: 'Читает лёд' },
  'ach.gates100.desc': { en: 'Slide through 100 crystal rings', ru: 'Проскользить сквозь 100 ледяных колец' },
  'ach.jump1.name':    { en: 'Air Time',     ru: 'В воздухе' },
  'ach.jump1.desc':    { en: 'Clear a crevasse', ru: 'Перелететь трещину' },
  'ach.jump50.name':   { en: 'Never Touches Down', ru: 'Почти не касается земли' },
  'ach.jump50.desc':   { en: 'Clear 50 crevasses', ru: 'Перелететь 50 трещин' },
  'ach.saves10.name':  { en: 'Wrapped Up',   ru: 'В пузыре' },
  'ach.saves10.desc':  { en: 'Let a bubble take 10 crashes', ru: 'Пузырь принял 10 ударов' },
  'ach.wear3.name':    { en: 'A Wardrobe',   ru: 'Гардероб' },
  'ach.wear3.desc':    { en: 'Own three creatures', ru: 'Иметь трёх зверей' },
  'ach.wearAll.name':  { en: 'The Whole Menagerie', ru: 'Весь зверинец' },
  'ach.wearAll.desc':  { en: 'Own every creature the fish will buy',
                         ru: 'Купить всех зверей, что продаются за рыбу' },


  'mode.free':      { en: 'Freeride',      ru: 'Фрирайд' },
  'mode.free.sub':  { en: 'The mountain never ends. Go as far as you can.',
                      ru: 'Гора не кончается. Уедь как можно дальше.' },
  'mode.runs':      { en: 'Known Lines',   ru: 'Знакомые линии' },
  'mode.runs.sub':  { en: 'Six lines down the mountain, the same every time.',
                      ru: 'Шесть линий по горе, каждый раз одинаковых.' },
  'runs.title':     { en: 'Known Lines',   ru: 'Знакомые линии' },
  'runs.note':      { en: 'Nothing here is shuffled — learn a line and it stays learnt.',
                      ru: 'Здесь ничего не перемешивается: выучил линию — она такой и останется.' },
  'runs.locked':    { en: 'Finish the one before', ru: 'Пройди предыдущую' },
  'runs.shut':      { en: 'Locked',                ru: 'Закрыто' },
  'mode.free.locked': { en: 'Finish {n} to open this up',
                        ru: 'Пройди «{n}», чтобы открыть' },
  'runs.count':     { en: '{a} of {b} stars', ru: 'Звёзд: {a} из {b}' },
  'runs.len':       { en: '{n} m', ru: '{n} м' },
  'over.finish':    { en: 'Made it!',      ru: 'Есть!' },
  'over.stars':     { en: '{a} of 3 stars', ru: 'Звёзд: {a} из 3' },
  'btn.retry':      { en: 'Run it again', ru: 'Ещё раз' },
  'btn.runs':       { en: 'Lines',          ru: 'Линии' },

  'course.firstlight.name': { en: 'First Light',  ru: 'Первый свет' },
  'course.narrows.name':    { en: 'The Narrows',  ru: 'Теснина' },
  'course.gapteeth.name':   { en: 'Gap Teeth',    ru: 'Щербина' },
  'course.glassrun.name':   { en: 'Glass Run',    ru: 'Стеклянный спуск' },
  'course.nightfall.name':  { en: 'Nightfall',    ru: 'Сумерки' },
  'course.cornice.name':    { en: 'The Cornice',  ru: 'Карниз' },

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
  'skin.hare.name':    { en: 'Arctic Hare', ru: 'Полярный заяц' },
  'skin.hare.perk':    { en: 'The run speeds up far more gently.',
                         ru: 'Склон разгоняется куда мягче.' },
  'skin.owl.name':     { en: 'Snowy Owl', ru: 'Полярная сова' },
  'skin.owl.perk':     { en: 'Always knows where the next opening is.',
                         ru: 'Всегда знает, где следующий проём.' },
  'skin.narwhal.name': { en: 'Narwhal', ru: 'Нарвал' },
  'skin.narwhal.perk': { en: 'The ramp over a crevasse runs much wider for him.',
                         ru: 'Трамплин через трещину для него заметно шире.' },
  'skin.walrus.name':  { en: 'Walrus', ru: 'Морж' },
  'skin.walrus.perk':  { en: 'Reads the crystal rings — they open wider for him, and pay triple.',
                         ru: 'Чует ледяные кольца — они шире для него и платят втрое.' },
  'skin.reindeer.name': { en: 'Reindeer', ru: 'Северный олень' },
  'skin.reindeer.perk': { en: 'Sure-footed — the glacier cannot swing him wide.',
                          ru: 'Твёрдое копыто — ледник его уже не заносит.' },
  'skin.orca.name':     { en: 'Orca', ru: 'Косатка' },
  'skin.orca.perk':     { en: 'Hits a ramp so hard she clears half the hill — and starts shielded.',
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
