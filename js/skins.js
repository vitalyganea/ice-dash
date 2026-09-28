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
    id: 'compass', name: 'Compass', price: 850, currency: 'fish',
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
    id: 'bubbles', name: 'Bubbles', price: 300, currency: 'fish',
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
    id: 'seal', name: 'Seal', price: 1500, currency: 'fish',
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
    id: 'walrus', name: 'Walrus', price: 2600, currency: 'fish',
    blurb: 'Goes through things, not round them.',
    perkText: 'Barges the flag gates for triple the catch.',
    perk: { gateBonus: 3 },
    shape: 'walrus',
    body: ['#b07e66', '#824f3d', '#512f23'],
    flipper: ['#9c6a52', '#6e4433', '#452720'],
    mark: '#d8ad93', nose: '#3a2019', outline: 'rgba(52,28,20,.45)',
    trim: '#a9765f', trimEdge: 'rgba(70,40,30,.4)',
    accent: null, accessory: null
  },
  {
    id: 'fox', name: 'Arctic Fox', price: 4200, currency: 'fish',
    blurb: 'Never once lost her footing.',
    perkText: 'Sure-footed — the glacier cannot swing her wide.',
    perk: { grip: 1.45 },
    shape: 'fox',
    body: ['#ffffff', '#e4edf5', '#c3d3e1'],
    flipper: ['#f3f8fc', '#d9e5ef', '#bdccda'],
    mark: '#fbfdff', nose: '#2f3742', outline: 'rgba(96,126,152,.75)',
    trim: '#e8f1f8', trimEdge: 'rgba(120,140,160,.35)',
    accent: null, accessory: null
  },
  {
    id: 'bear', name: 'Polar Bear', price: 8, currency: 'gold',
    blurb: 'The one everything else gets out of the way of.',
    perkText: 'Hits a ramp so hard he clears half the hill — and starts shielded.',
    perk: { rampBoost: 1.8, startShield: 1 },
    shape: 'bear',
    body: ['#fffdf6', '#eceade', '#cdcec1'],
    flipper: ['#f8f6ed', '#dedcce', '#c0bfb0'],
    mark: '#f3f0e4', nose: '#2b2b2b', outline: 'rgba(130,128,106,.7)',
    trim: '#f0eee2', trimEdge: 'rgba(130,130,115,.35)',
    accent: null, accessory: null
  }
];

var SKIN_BY_ID = {};
for (var _s = 0; _s < SKINS.length; _s++) SKIN_BY_ID[SKINS[_s].id] = SKINS[_s];

function skinById(id) { return SKIN_BY_ID[id] || SKINS[0]; }

/* What a run's catch is worth in the shop. */
function coinsFor(fishCount) {
  var doubled = Math.min(fishCount, FIRST_CATCH);
  return doubled * 2 + Math.max(0, fishCount - FIRST_CATCH);
}
