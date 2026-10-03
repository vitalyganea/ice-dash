/* ===========================================================
   biomes.js — the stretches of hill you ride through
   -----------------------------------------------------------
   The run is endless; every BIOME_LEN metres the world changes
   look and, in one case, how the penguin handles.

   `air` is whatever is falling through the frame — snow on most of the
   hill, ash and embers over the lava field. `rise` is subtracted from the
   fall, so a lit ember climbs against the run instead of dropping with it.
   `aurora` hangs a band of light in the sky. Everything here is weather
   and rock: there is nothing on this hill that anybody built.
   =========================================================== */

var BIOME_LEN = 520;          // metres per stretch (8 world units = 1 metre)

var BIOMES = [
  {
    name: 'Pine Forest',
    sky:   ['#8fd4ff', '#d8f1ff'],
    hazeRGB: '216,241,255',
    snowA: '#f2f8fc', iceTop: '#b6e2f7', iceBot: '#8ccbec', bankEdge: '#cfe6f4', bankShade: '#a8cfe6',
    far:   '#a9c9dd', edge: '#7fb4d8',
    tree:  '#2f7d4f', treeDark: '#215c3a', trunk: '#7a5236',
    rock:  '#9aa6b2', rockDark: '#6f7b88',
    grip:  1,                 // how sharply he answers a tap
    fog:   0,   fogRGB: ''
  },
  {
    name: 'Rocky Pass',
    sky:   ['#ffd39a', '#ffeccd'],
    hazeRGB: '255,236,205',
    snowA: '#fdf3e2', iceTop: '#c9e6f2', iceBot: '#a3cfe3', bankEdge: '#e8dcc4', bankShade: '#d3bf9c',
    far:   '#d8b489', edge: '#c09468',
    tree:  '#4f7a45', treeDark: '#365a30', trunk: '#6f4a2e',
    rock:  '#b09a80', rockDark: '#83705a',
    grip:  1,
    fog:   0,   fogRGB: ''
  },
  {
    /* Polar noon with the sun too low to warm anything: the hill, the sky
       and the haze are all within a few points of white, so the only thing
       you can read is the shadow an obstacle throws. */
    name: 'Arctic Shelf',
    sky:   ['#cfefff', '#ffffff'],
    hazeRGB: '244,252,255',
    snowA: '#ffffff', iceTop: '#d6f1ff', iceBot: '#aadcf4', bankEdge: '#ffffff', bankShade: '#c2dded',
    far:   '#d4e9f4', edge: '#a2c7de',
    tree:  '#7fb0c6', treeDark: '#5b8ea6', trunk: '#7d909c',
    rock:  '#8c9dad', rockDark: '#5e6f80',
    grip:  1,
    fog:   0.18, fogRGB: '238,251,255',
    air:   { rgb: '255,255,255', a: 0.6, r: 1.5, rise: 0, drift: 2.4, n: 0.8 }
  },
  {
    name: 'Glacier',
    /* The one stretch where he handles differently, so it has to look
       unmistakably colder than the pine forest or the tell is lost. */
    sky:   ['#9fdcff', '#dff6ff'],
    hazeRGB: '223,246,255',
    snowA: '#e2f5ff', iceTop: '#63c2ec', iceBot: '#2f8cc4', bankEdge: '#a8d8ee', bankShade: '#6fb3d6',
    far:   '#7fbcd8', edge: '#4e96bd',
    tree:  '#2f8ea8', treeDark: '#1d6a80', trunk: '#54707e',
    rock:  '#8fb8cf', rockDark: '#5f8ba5',
    grip:  0.62,              // ice: the penguin swings much wider
    fog:   0,   fogRGB: ''
  },
  {
    /* A glacier running over a live volcanic field. The snow is grey with
       fallen ash, the rock is basalt, and the sky is lit from below by
       something the hill is sitting on. */
    name: 'Ashfall',
    sky:   ['#2a1214', '#a8431f'],
    hazeRGB: '96,38,24',
    snowA: '#3a3430', iceTop: '#454252', iceBot: '#232029', bankEdge: '#4a423d', bankShade: '#241f1c',
    far:   '#1f0f0d', edge: '#6b2e19',
    tree:  '#382c24', treeDark: '#221b16', trunk: '#2c211b',
    rock:  '#635d70', rockDark: '#363240',
    cap:   '#d2cac4', capShade: 'rgba(40,30,26,.45)', shadow: 'rgba(0,0,0,.42)',
    lip:   '#6e625a', streak: 'rgba(255,138,64,.34)',
    vents: 1,                 // heat showing up through the ice
    grip:  1,
    fog:   0.34, fogRGB: '74,28,18',
    air:   { rgb: '255,146,54', a: 0.95, r: 2.2, rise: 2.1, drift: 0.9, hot: 1, n: 0.55 },
    ember: 1
  },
  {
    /* Deep midwinter at dusk: rose light on the snow, the conifers loaded
       past bending, fat slow flakes, and the aurora already out. Nothing
       hung on anything — the season does all of it by itself. */
    name: 'Midwinter',
    sky:   ['#2a3a6e', '#eebac6'],
    hazeRGB: '234,188,199',
    snowA: '#f0e2e8', iceTop: '#93a6d8', iceBot: '#5f73ad', bankEdge: '#e8d8e0', bankShade: '#b09fb6',
    far:   '#3f4480', edge: '#6a64a4',
    tree:  '#1f5c44', treeDark: '#12392c', trunk: '#4a3a2e',
    rock:  '#7a7d9c', rockDark: '#4e5170',
    lip:   '#fbeef2',
    grip:  1,
    fog:   0.24, fogRGB: '56,58,110',
    air:   { rgb: '255,255,255', a: 0.85, r: 3.1, rise: 0, drift: 1.4, n: 1 },
    aurora: '124,232,184',
    snowyTrees: 1
  },
  {
    name: 'Night Run',
    sky:   ['#231c52', '#4a3a86'],
    hazeRGB: '39,31,88',
    snowA: '#cdd6ef', iceTop: '#6a7fc0', iceBot: '#44548f', bankEdge: '#aab5d8', bankShade: '#7f8cba',
    far:   '#3a2f6b', edge: '#5b4c9c',
    tree:  '#2b4a52', treeDark: '#1d343a', trunk: '#3b3050',
    rock:  '#6a6a8a', rockDark: '#4b4b66',
    grip:  1,
    fog:   0.55,              // you see less of the hill ahead
    fogRGB: '31,25,74'
  },
  {
    /* Ashfall is a glacier with something under it. This is the mountain
       itself: black obsidian underfoot and open lava running either side
       of the line. The only safe ground is the strip you are on. */
    name: 'Emberflow',
    sky:   ['#1a0a0b', '#d05a1e'],
    hazeRGB: '132,40,14',
    snowA: '#2b221e', iceTop: '#3c3135', iceBot: '#1d1619', bankEdge: '#3a2c25', bankShade: '#150f0d',
    far:   '#170808', edge: '#7e3212',
    tree:  '#33261e', treeDark: '#1e1612', trunk: '#271c16',
    rock:  '#8d776a', rockDark: '#514238',
    cap:   '#c0b2a6', capShade: 'rgba(46,32,24,.5)', shadow: 'rgba(0,0,0,.5)',
    lip:   '#6a4a38', streak: 'rgba(255,120,40,.30)',
    grip:  1,
    fog:   0.30, fogRGB: '88,24,10',
    air:   { rgb: '255,168,72', a: 0.95, r: 2.4, rise: 2.6, drift: 1.1, hot: 1, n: 0.8 },
    ember: 0.7,
    lava:  1                  // open channels running either side of the line
  },
  {
    /* Midwinter at noon instead of dusk. Rowan holds its fruit all winter,
       so the red is the hill's own: berries in the snow against the darkest
       green on the mountain. Nothing here was hung on anything. */
    name: 'Hollyfrost',
    sky:   ['#bfe0ff', '#fff2dc'],
    hazeRGB: '255,241,216',
    snowA: '#fff4e2', iceTop: '#e2ecf4', iceBot: '#b4cadb', bankEdge: '#fffaf0', bankShade: '#c9b9a4',
    far:   '#dcd0bd', edge: '#b3a894',
    tree:  '#14512f', treeDark: '#0b3a21', trunk: '#54381f',
    rock:  '#96a4b4', rockDark: '#66768a',
    grip:  1,
    fog:   0.10, fogRGB: '255,246,228',
    air:   { rgb: '255,255,255', a: 0.8, r: 2.4, rise: 0, drift: 1.2, n: 0.8 },
    snowyTrees: 0.55,         // enough to read as laden, not enough to hide the green
    berries: 1.3              // rowan in the snow along the banks
  },
  {
    /* A winter that never gets to end: moonlight, no wind, and frost that
       has had years to grow. The forest is still standing in it, frozen
       silver rather than green. */
    name: 'Everwinter',
    sky:   ['#101c34', '#3f5a86'],
    hazeRGB: '38,54,88',
    snowA: '#eef4ff', iceTop: '#a6c0e2', iceBot: '#7591bd', bankEdge: '#ffffff', bankShade: '#9fb2cf',
    far:   '#2c3f63', edge: '#5f7aa6',
    tree:  '#6d8ca4', treeDark: '#46647c', trunk: '#46505f',
    rock:  '#7d8ea6', rockDark: '#4c5c74',
    snowyTrees: 0.8,
    cap:   '#eef6ff', capShade: 'rgba(120,150,190,.5)', shadow: 'rgba(24,36,62,.4)',
    grip:  1,
    fog:   0.26, fogRGB: '32,48,84',
    air:   { rgb: '226,240,255', a: 0.55, r: 1.3, rise: 0, drift: 0.5, n: 0.35 },
    sparkle: 1                // frost catching the moon
  },
  {
    /* A jungle the cold came for overnight. The great leaves are still
       green under a rim of frost, the air is wet and warm-looking, and the
       fruit is still on the branches. All of it grew there. */
    name: 'Frozen Jungle',
    mood:  'jungle',           // its own tune (audio.js)
    sky:   ['#7fe0c4', '#e4fff4'],
    hazeRGB: '214,250,236',
    snowA: '#eafff6', iceTop: '#a8ead8', iceBot: '#5fc7b0', bankEdge: '#d2f5e8', bankShade: '#8fd1bd',
    far:   '#6fb9a0', edge: '#3f9c80',
    tree:  '#1f9a5e', treeDark: '#0f6a40', trunk: '#5b4a2a',
    rock:  '#7f9c8a', rockDark: '#566f60',
    flora: 'leaf',            // broad leaves, not pine
    grip:  1,
    fog:   0.16, fogRGB: '206,250,232',
    air:   { rgb: '210,255,236', a: 0.7, r: 1.8, rise: 0, drift: 0.7, n: 0.6 },
    berries: 0.9              // the fruit, still on the branches
  },
  {
    /* Ice out past the sky: a frozen comet's tail, violet-black, with the
       stars showing up through it and a band of light overhead. */
    name: 'Cosmic Ice',
    mood:  'cosmic',           // its own tune (audio.js)
    sky:   ['#0b0620', '#3a1a6e'],
    hazeRGB: '44,24,96',
    snowA: '#dcd4ff', iceTop: '#7e6cd8', iceBot: '#3a2a8a', bankEdge: '#bdb2f2', bankShade: '#8f80d0',
    far:   '#24124e', edge: '#5a44b0',
    tree:  '#b9a8ff', treeDark: '#6f5ad6', trunk: '#3c2e7a',
    rock:  '#6c6290', rockDark: '#463e66',
    cap:   '#e8e2ff', capShade: 'rgba(60,40,140,.45)', shadow: 'rgba(10,4,40,.45)',
    flora: 'crystal',         // spires of ice, not trees
    grip:  1,
    fog:   0.32, fogRGB: '20,10,56',
    air:   { rgb: '255,255,255', a: 0.9, r: 1.2, rise: 0, drift: 0.15, n: 0.5 },
    aurora: '200,140,255',
    sparkle: 1.2              // stars caught in the ice
  },
  {
    /* Underground, where the ice grew crystal instead of snow: amethyst
       walls, rose-coloured floor and a drift of glowing motes in the dark. */
    name: 'Crystal Caves',
    mood:  'caves',           // its own tune (audio.js)
    sky:   ['#2a1038', '#7a3a8a'],
    hazeRGB: '120,60,140',
    snowA: '#f6e6ff', iceTop: '#e2b8f2', iceBot: '#b07ad6', bankEdge: '#ecd2fa', bankShade: '#c99ae0',
    far:   '#4a2058', edge: '#8a4aa4',
    tree:  '#d58cf0', treeDark: '#8e44b4', trunk: '#5a2a70',
    rock:  '#a986c9', rockDark: '#73559a',
    flora: 'crystal',
    grip:  1,
    fog:   0.22, fogRGB: '90,40,110',
    air:   { rgb: '255,236,170', a: 0.8, r: 2.0, rise: 0.6, drift: 1.2, hot: 0.4, n: 0.4 },
    sparkle: 0.8
  }
];
