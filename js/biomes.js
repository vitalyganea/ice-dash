/* ===========================================================
   biomes.js — the stretches of hill you ride through
   -----------------------------------------------------------
   The run is endless; every BIOME_LEN metres the world changes
   look and, in two cases, how the penguin handles.
   =========================================================== */

var BIOME_LEN = 900;          // metres per stretch

var BIOMES = [
  {
    name: 'Pine Forest',
    sky:   ['#8fd4ff', '#d8f1ff'],
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
    snowA: '#fdf3e2', iceTop: '#c9e6f2', iceBot: '#a3cfe3', bankEdge: '#e8dcc4', bankShade: '#d3bf9c',
    far:   '#d8b489', edge: '#c09468',
    tree:  '#4f7a45', treeDark: '#365a30', trunk: '#6f4a2e',
    rock:  '#b09a80', rockDark: '#83705a',
    grip:  1,
    fog:   0,   fogRGB: ''
  },
  {
    name: 'Glacier',
    /* The one stretch where he handles differently, so it has to look
       unmistakably colder than the pine forest or the tell is lost. */
    sky:   ['#9fdcff', '#dff6ff'],
    snowA: '#e2f5ff', iceTop: '#63c2ec', iceBot: '#2f8cc4', bankEdge: '#a8d8ee', bankShade: '#6fb3d6',
    far:   '#7fbcd8', edge: '#4e96bd',
    tree:  '#2f8ea8', treeDark: '#1d6a80', trunk: '#54707e',
    rock:  '#8fb8cf', rockDark: '#5f8ba5',
    grip:  0.62,              // ice: the penguin swings much wider
    fog:   0,   fogRGB: ''
  },
  {
    name: 'Night Run',
    sky:   ['#231c52', '#4a3a86'],
    snowA: '#cdd6ef', iceTop: '#6a7fc0', iceBot: '#44548f', bankEdge: '#aab5d8', bankShade: '#7f8cba',
    far:   '#3a2f6b', edge: '#5b4c9c',
    tree:  '#2b4a52', treeDark: '#1d343a', trunk: '#3b3050',
    rock:  '#6a6a8a', rockDark: '#4b4b66',
    grip:  1,
    fog:   0.55,              // you see less of the hill ahead
    fogRGB: '31,25,74'
  }
];
