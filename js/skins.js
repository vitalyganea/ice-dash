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
    accent: null, accessory: null
  },
  {
    id: 'mitten', name: 'Mitten', price: 120, currency: 'fish',
    blurb: 'Someone knitted him a scarf.',
    perkText: 'Hoovers up fish from much further away.',
    perk: { reach: 1.8 },
    body: ['#4d4654', '#2d2732', '#17131a'],
    flipper: ['#5b5364', '#322b39', '#1a1620'],
    trim: '#ffb13d', trimEdge: 'rgba(190,100,10,.45)',
    accent: '#e0483c', accessory: 'scarf'
  },
  {
    id: 'compass', name: 'Compass', price: 350, currency: 'fish',
    blurb: 'Knows where the shoals are.',
    perkText: 'Finds bigger shoals, far more often.',
    perk: { shoal: 2 },
    body: ['#415d76', '#24384a', '#111f29'],
    flipper: ['#4d6b85', '#284057', '#13222c'],
    trim: '#ffc247', trimEdge: 'rgba(185,120,20,.45)',
    accent: '#f0b429', accessory: 'cap'
  },
  {
    id: 'bubbles', name: 'Bubbles', price: 700, currency: 'fish',
    blurb: 'Never leaves home unwrapped.',
    perkText: 'Starts every run already inside a bubble.',
    perk: { startShield: 1 },
    body: ['#4d7183', '#274751', '#13262d'],
    flipper: ['#587e91', '#2c4f5a', '#152a32'],
    trim: '#ffd08a', trimEdge: 'rgba(180,120,50,.45)',
    accent: '#9fe8ff', accessory: 'glow'
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
