/* ===========================================================
   skins.js — the penguins you can wear, and what each one does
   -----------------------------------------------------------
   ONE rule governs every perk: it may only ever make the hill more
   generous, never harsher. Before it places a row, the spawner proves
   the opening is reachable using the biome's own grip and the top
   speed of the run. A perk that made turning worse — a "slippery"
   penguin, say — would quietly turn some of those rows into openings
   nobody can make. Perks that widen pickup range, add fish, or hand
   out a shield are all safe: they cannot invalidate that proof.

   Currency: one fish is one coin, except the first FIRST_CATCH of a
   run which are worth two. That is there for the player who dies
   early — a strong run collects about eighteen times as many fish as
   a first attempt, and without it the first skin is out of reach for
   the people who most want one.
   =========================================================== */

var FIRST_CATCH = 20;         // fish this early in a run pay double

var SKINS = [
  {
    id: 'snowcap', name: 'Snowcap', price: 0, currency: 'fish',
    blurb: 'The one you turned up in.',
    perkText: 'No bonus — the honest baseline.',
    perk: {},
    body: ['#48536e', '#262d3c', '#131820'],
    flipper: ['#54617d', '#2b3444', '#161c26'],
    trim: '#ff9f2e', trimEdge: 'rgba(180,90,10,.45)',
    shape: 'penguin', accent: null, accessory: null
  },
  {
    id: 'mitten', name: 'Mitten', price: 100, currency: 'fish',
    blurb: 'Someone knitted him a scarf.',
    perkText: 'Hoovers up fish from much further away.',
    perk: { reach: 2.1 },
    body: ['#4d4654', '#2d2732', '#17131a'],
    flipper: ['#5b5364', '#322b39', '#1a1620'],
    trim: '#ffb13d', trimEdge: 'rgba(190,100,10,.45)',
    shape: 'penguin',
    accent: '#e0483c', accessory: 'scarf'
  },
  {
    /* Black back, white face, a beak far too big for him: the one sea bird
       that reads from straight above at this size. */
    id: 'puffin', name: 'Puffin', price: 400, currency: 'fish',
    blurb: 'All beak, and in no hurry to explain it.',
    perkText: 'Shrugs off one missed fish without losing the run of catches.',
    perk: { comboKeep: 1 },
    body: ['#3a3f4c', '#1d212a', '#0c0e13'],
    flipper: ['#434956', '#22262f', '#101318'],
    trim: '#ff6a24', trimEdge: 'rgba(170,60,10,.5)',
    shape: 'penguin', accent: '#ff5a1f', accessory: 'puffin'
  },
  {
    id: 'seal', name: 'Seal', price: 450, currency: 'fish',
    blurb: 'Spent her whole life under this ice.',
    perkText: 'Sniffs out the golden fish, far more of them.',
    perk: { goldRate: 2.4 },
    shape: 'seal',
    body: ['#95a3b1', '#647282', '#3d4a58'],
    flipper: ['#84929f', '#54616f', '#36414d'],
    mark: '#c9d4dd', nose: '#2a3138', outline: 'rgba(40,52,64,.45)',
    trim: '#8a98a6', trimEdge: 'rgba(60,70,80,.4)',
    accent: null, accessory: null
  },
  {
    /* Small and orange-brown with a dark stripe down the back: the summer
       coat, for the same reason as the hare's. */
    id: 'lemming', name: 'Lemming', price: 500, currency: 'fish',
    blurb: 'Comes back every single day, whatever the hill does.',
    perkText: 'Every star on the Daily Line pays 25 fish more.',
    perk: { dailyStar: 25 },
    shape: 'hare', cat: true, stub: true,
    body: ['#e8a868', '#b8702f', '#7a4318'],
    flipper: ['#d9975a', '#a5602c', '#6e3b18'],
    stripe: '#4a2a14',
    mark: '#f4dcc0', nose: '#2a1a10', outline: 'rgba(70,40,20,.45)',
    trim: '#e8a868', trimEdge: 'rgba(90,50,20,.4)',
    accent: null, accessory: null
  },
  {
    /* Dark shaggy brown with pale horns, built low and wide: deep snow is
       where a musk ox lives, not something it wades through. */
    id: 'muskox', name: 'Musk Ox', price: 600, currency: 'fish',
    blurb: 'Deep snow is just the floor to him.',
    perkText: 'Deep snow does not slow him down at all.',
    perk: { bogImmune: 1 },
    shape: 'reindeer', horns: true,
    bodyTop: '#6e5440',
    body: ['#5b4130', '#3a291e', '#22170f'],
    flipper: ['#4d3727', '#30221a', '#1d140e'],
    mark: '#cbb79a', nose: '#1a120c', outline: 'rgba(30,20,12,.85)',
    paw: '#2c2018', pawDark: '#1d150f', claw: '#140e0a',
    antler: '#efe4cc',
    trim: '#5b4130', trimEdge: 'rgba(30,20,12,.45)',
    accent: null, accessory: null
  },
  {
    id: 'bubbles', name: 'Bubbles', price: 700, currency: 'fish',
    blurb: 'Never leaves home unwrapped.',
    perkText: 'Starts every run already inside a bubble.',
    perk: { startShield: 1 },
    body: ['#4d7183', '#274751', '#13262d'],
    flipper: ['#587e91', '#2c4f5a', '#152a32'],
    trim: '#ffd08a', trimEdge: 'rgba(180,120,50,.45)',
    shape: 'penguin',
    accent: '#9fe8ff', accessory: 'glow'
  },
  {
    /* Warm brown with a pale face, flat on her back on the water usually;
       on the ice she simply never wastes a moment. */
    id: 'otter', name: 'Sea Otter', price: 800, currency: 'fish',
    blurb: 'Always knows exactly how long she has left.',
    perkText: 'Time bubbles give her four seconds instead of three.',
    perk: { clockGain: 1.34 },
    shape: 'seal',
    body: ['#a8764e', '#76492b', '#4a2b17'],
    flipper: ['#966443', '#663e25', '#3f2615'],
    mark: '#e8d6bc', nose: '#20140c', outline: 'rgba(50,30,16,.5)',
    trim: '#9a6a46', trimEdge: 'rgba(60,36,20,.4)',
    accent: null, accessory: null
  },
  {
    /* A perk nobody else has: it changes the SHAPE of a run rather than one
       interaction in it. The gentler the ramp, the longer the hill stays
       readable — which is exactly what a beginner is short of. */
    id: 'hare', name: 'Arctic Hare', price: 900, currency: 'fish',
    blurb: 'Paces herself. The hill never gets away from her.',
    perkText: 'The run speeds up far more gently.',
    perk: { slowRamp: 0.72 },
    shape: 'hare',
    /* Her summer coat, not her winter one. A white hare on pale ice is the
       mistake this game already made once with an arctic fox and a polar
       bear: no amount of drawing rescued them. Taupe reads from the top of
       the screen, and the white muzzle and black ear tips do the rest. */
    body: ['#f0e9df', '#c0b1a0', '#8f8070'],
    flipper: ['#e6ded3', '#c2b4a4', '#8d7e6e'],
    mark: '#f7f2ea', nose: '#2b3139', outline: 'rgba(72,62,52,.45)',
    trim: '#e8f1f9', trimEdge: 'rgba(90,110,130,.35)',
    accent: null, accessory: null
  },
  {
    /* Grey, not white, with dark rosettes and a tail as long as she is:
       the pale cat on pale ice would have been the fox all over again. */
    id: 'leopard', name: 'Snow Leopard', price: 1100, currency: 'fish',
    blurb: 'Lives on the edge of things, and likes it there.',
    perkText: 'Close calls pay double, and count from further away.',
    perk: { closeBonus: 2, closeWide: 1.6 },
    shape: 'hare', cat: true,
    body: ['#c4c8cf', '#8f969f', '#5f6670'],
    flipper: ['#b4b9c1', '#858c96', '#59606a'],
    spot: '#2c3038',
    mark: '#e6e8ec', nose: '#3a2e2e', outline: 'rgba(40,44,52,.55)',
    trim: '#c4c8cf', trimEdge: 'rgba(60,66,76,.4)',
    accent: null, accessory: null
  },
  {
    id: 'compass', name: 'Compass', price: 1300, currency: 'fish',
    blurb: 'Knows where the shoals are.',
    perkText: 'Finds far more shoals, and bigger ones.',
    perk: { shoal: 1.6 },
    body: ['#415d76', '#24384a', '#111f29'],
    flipper: ['#4d6b85', '#284057', '#13222c'],
    trim: '#ffc247', trimEdge: 'rgba(185,120,20,.45)',
    shape: 'penguin',
    accent: '#f0b429', accessory: 'cap'
  },
  {
    id: 'owl', name: 'Snowy Owl', price: 1700, currency: 'fish',
    blurb: 'Sees the line before the line is there.',
    perkText: 'Always knows where the next opening is.',
    perk: { foresight: 1 },
    shape: 'owl',
    /* He stays white, which is what a snowy owl is — so the barring has to
       do the reading for him. Pale grey bars on a pale body left a blank
       oval on the ice; slate ones break the silhouette up, and the wings
       are a clear step darker than the back. */
    body: ['#f7fbff', '#dde7f1', '#aabbcd'],
    flipper: ['#c7d4e1', '#9fb1c4', '#73879b'],
    mark: '#54657a', nose: '#39414b', outline: 'rgba(52,66,82,.55)',
    trim: '#eaf2fa', trimEdge: 'rgba(90,110,130,.35)',
    accent: '#f2b733', accessory: null
  },
  {
    id: 'walrus', name: 'Walrus', price: 2000, currency: 'fish',
    blurb: 'Goes through things, not round them.',
    perkText: 'Reads the crystal rings — they open wider for him, and pay triple.',
    perk: { gateBonus: 3, gateWide: 1.55 },
    shape: 'walrus',
    body: ['#b07e66', '#824f3d', '#512f23'],
    flipper: ['#9c6a52', '#6e4433', '#452720'],
    mark: '#d8ad93', nose: '#3a2019', outline: 'rgba(52,28,20,.45)',
    trim: '#a9765f', trimEdge: 'rgba(70,40,30,.4)',
    accent: null, accessory: null
  },
  {
    /* Same lesson the walrus taught: make the risky thing less risky, not
       just better paid. The ramp over a crevasse is simply wider for him. */
    id: 'narwhal', name: 'Narwhal', price: 2500, currency: 'fish',
    blurb: 'Knows every hole in this ice, and how to clear it.',
    perkText: 'The ramp over a crevasse runs much wider for him.',
    perk: { rampWide: 1.6 },
    shape: 'orca',
    body: ['#e4ecf5', '#b6c6d8', '#8396ab'],
    flipper: ['#d4dfeb', '#a7b8cb', '#7a8ca2'],
    mark: '#e8f0f8', nose: '#2f3842', outline: 'rgba(45,58,72,.45)',
    trim: '#aebfd2', trimEdge: 'rgba(70,88,106,.4)',
    accent: '#f0e6d2', accessory: 'tusk'
  },
  {
    id: 'reindeer', name: 'Reindeer', price: 2800, currency: 'fish',
    blurb: 'Knows every inch of this hill.',
    perkText: 'Sure-footed — tucks in tight, and the glacier cannot swing him wide.',
    /* The grip alone was worth nothing, and measurably so: the spawner
       already sizes every row against the grip of the stretch it sits on,
       so a glacier row is reachable at 0.62 and turning faster buys no
       ground (-0.8 standard errors over 70 runs held on the glacier).
       `slim` is the part that pays — it is the dearest skin on the fish
       ladder and it has to be worth the climb. */
    perk: { grip: 1.45, slim: 0.78 },
    shape: 'reindeer',
    body: ['#a07a57', '#6d4e36', '#432f20'],
    flipper: ['#8d6a4a', '#5a402c', '#382718'],
    mark: '#e0cfb6', nose: '#2c221a', outline: 'rgba(56,40,28,.85)',
    paw: '#4a3526', pawDark: '#33241a', claw: '#2a1e15',
    antler: '#cbb694',
    trim: '#a07a57', trimEdge: 'rgba(60,42,28,.45)',
    accent: null, accessory: null
  },
  {
    /* The largest penguin there is, black with a blaze of gold at the neck.
       Gold-priced, like the orca: something for the golden fish to buy. */
    id: 'emperor', name: 'Emperor Penguin', price: 6, currency: 'gold',
    blurb: 'Starts every run as if he had already been at it a while.',
    perkText: 'Every run starts with the combo already at x2.',
    perk: { comboStart: 10 },
    body: ['#3c4558', '#1e2430', '#0d1017'],
    flipper: ['#465065', '#242b38', '#11151d'],
    trim: '#f5a524', trimEdge: 'rgba(170,100,10,.5)',
    shape: 'penguin', accent: '#f5b82e', accessory: 'collar'
  },
  {
    id: 'orca', name: 'Orca', price: 8, currency: 'gold',
    blurb: 'Should not be up here at all, and does not care.',
    perkText: 'Hits a ramp so hard she clears half the hill — and starts shielded.',
    perk: { rampBoost: 1.8, startShield: 1 },
    shape: 'orca',
    body: ['#2b3340', '#161b23', '#080b10'],
    flipper: ['#242b36', '#12161d', '#070a0e'],
    mark: '#f2f7fb', nose: '#05070a', outline: 'rgba(6,9,14,.9)',
    paw: '#12161d', pawDark: '#080b10',
    trim: '#1b212a', trimEdge: 'rgba(4,6,10,.5)',
    accent: null, accessory: null
  }
];

var SKIN_BY_ID = {};
for (var _s = 0; _s < SKINS.length; _s++) SKIN_BY_ID[SKINS[_s].id] = SKINS[_s];

function skinById(id) { return SKIN_BY_ID[id] || SKINS[0]; }

/* The lemming's perk, here rather than in the UI so a test can read it:
   fish paid on top for each star of a finished Daily Line. */
function dailyStarPay(skinId, stars, finished) {
  var per = (skinById(skinId).perk || {}).dailyStar || 0;
  return finished ? per * (stars || 0) : 0;
}

/* What a run's catch is worth in the shop. */
function coinsFor(fishCount) {
  var doubled = Math.min(fishCount, FIRST_CATCH);
  return doubled * 2 + Math.max(0, fishCount - FIRST_CATCH);
}
