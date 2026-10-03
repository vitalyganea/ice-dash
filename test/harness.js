const fs = require('fs');
/* Relative to this file, so the suite travels with the repo instead of
   depending on where the project happens to sit on one machine. */
const DIR = require('path').join(__dirname, '..', 'js') + require('path').sep;
function fakeCtx(){ const g={addColorStop(){}};
  const t={canvas:{width:960,height:540},createLinearGradient:()=>g,createRadialGradient:()=>g,
           measureText:()=>({width:24}),setTransform(){}};
  const NOOP=()=>{};
  return new Proxy(t,{get:(o,k)=>(k in o)?o[k]:NOOP,set:(o,k,v)=>{o[k]=v;return true;}}); }
const byId={};
function el(id){ const e={id,style:{},_cls:new Set(),_l:{},children:[]};
  e.classList={add:c=>e._cls.add(c),remove:c=>e._cls.delete(c),contains:c=>e._cls.has(c),
    toggle:(c,on)=>{const v=on===undefined?!e._cls.has(c):!!on;v?e._cls.add(c):e._cls.delete(c);return v;}};
  e.addEventListener=(t,f)=>{(e._l[t]=e._l[t]||[]).push(f);};
  e.fire=(t,ev)=>(e._l[t]||[]).forEach(f=>f(ev||{preventDefault(){}}));
  e.getContext=fakeCtx; e.getBoundingClientRect=()=>({left:0,top:0,width:960,height:540});
  e.setAttribute=()=>{}; e.getAttribute=()=>null; e.appendChild=c=>c;
  e.querySelector=()=>el(''); e.querySelectorAll=()=>[]; e.closest=()=>null;
  byId[id]=e; return e; }
['game','stage','hud','btn-menu','title-best','new-best','over-score','over-detail',
 't-sfx','t-sfx2','t-music','t-music2','screen-title','screen-help','screen-pause','screen-over'].forEach(el);
global.document={getElementById:id=>byId[id]||el(id),createElement:()=>el(''),addEventListener(){},querySelectorAll:()=>[]};
let seq=0; const raf=new Map();
global.window={innerWidth:960,innerHeight:540,devicePixelRatio:1,addEventListener(){},removeEventListener(){},
  requestAnimationFrame:f=>{const i=++seq;raf.set(i,f);return i;},cancelAnimationFrame:i=>raf.delete(i)};
global.requestAnimationFrame=window.requestAnimationFrame;
global.cancelAnimationFrame=window.cancelAnimationFrame;
global.navigator={maxTouchPoints:0};
global.localStorage={getItem:()=>null,setItem(){}};
global.Sfx=new Proxy({},{get:()=>()=>{}});
let seed=20260928;
global.Math.random=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff;};
eval(fs.readFileSync(DIR+'biomes.js','utf8')); global.BIOMES=BIOMES; global.BIOME_LEN=BIOME_LEN;
eval(fs.readFileSync(DIR+'skins.js','utf8'));
global.SKINS=SKINS; global.SKIN_BY_ID=SKIN_BY_ID;
global.skinById=skinById; global.coinsFor=coinsFor; global.FIRST_CATCH=FIRST_CATCH;
eval(fs.readFileSync(DIR+'courses.js','utf8'));
global.COURSES=COURSES; global.parseCourse=parseCourse;
global.courseById=courseById; global.courseStars=courseStars; global.TUTORIAL=TUTORIAL;
global.dailyKey=dailyKey; global.dailyCourse=dailyCourse; global.dailyPrevKey=dailyPrevKey;
eval(fs.readFileSync(DIR+'game.js','utf8'));   global.Game=Game;
let T=0;
module.exports={ setSeed:s=>{seed=s;}, byId,
  frames(n){for(let i=0;i<n;i++){T+=1000/60;const b=[...raf.values()];raf.clear();b.forEach(f=>f(T));}} };
