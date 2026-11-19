/* ===========================================================
   eventpage.js — the event's page at every screen
   -----------------------------------------------------------
   The page is one scene: the owner's painting over the whole screen and
   the table on the painting's own board (SYSTEMS row 184). At every shape
   from 9:32 to 32:9, phones, tablets and desktops, in the longest
   languages and with a phone's letters at 130%, in real Chrome:
     1. the painting covers the whole screen;
     2. the board is whole on the screen, and under the table there is the
        board's own empty ice (the table hidden, the pixels read back);
     3. nothing sticks out sideways: no text cut, no button out of its row;
     4. the letters are 12 px or more and stand out from what is under them;
     5. the way to Freeride is on the screen, off the board, clear of Back.
   Writes a contact sheet of every case to test/out/eventpage.png.

     node test/eventpage.js            every case
     node test/eventpage.js quick      a few
   Needs Chrome and python3 with PIL (as tools/media-lib.js).
   =========================================================== */
var fs = require('fs'), path = require('path'), cp = require('child_process');
var M = require('../tools/media-lib.js');
var ROOT = path.join(__dirname, '..'), OUT = M.mkdir(path.join(__dirname, 'out', 'eventpage'));
var fail = 0;
function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fail++; }

var SIZES = [
  /* phones upright */
  [320, 568, 2], [360, 640, 3], [360, 740, 3], [360, 800, 2], [375, 667, 2], [375, 812, 3], [390, 844, 3],
  [393, 873, 2.75], [412, 915, 2.625], [430, 932, 3],
  /* an iPhone 15 whole, and as Safari shows it with its bars up and down */
  [393, 852, 3], [393, 659, 3], [393, 759, 3], [430, 739, 3],
  /* phones on their side */
  [568, 320, 2], [640, 360, 3], [740, 360, 3], [800, 360, 2], [812, 375, 3], [844, 390, 3], [915, 412, 2.625], [932, 430, 3],
  /* tablets */
  [768, 1024, 2], [1024, 768, 2], [820, 1180, 2], [1180, 820, 2], [800, 1280, 1.5], [1280, 800, 1.5], [1024, 1366, 2], [1366, 1024, 2],
  /* desktops */
  [1280, 720, 1], [1366, 768, 1], [1440, 900, 1], [1536, 864, 1.25], [1920, 1080, 1], [1920, 1200, 1], [2560, 1440, 1],
  /* the far shapes the game must fill (9:32 to 32:9), and square */
  [360, 1280, 2], [1280, 360, 1], [400, 1200, 2], [1600, 450, 1], [2560, 720, 1], [800, 800, 1], [600, 600, 2]
];
var QUICK = process.argv[2] === 'quick';
if (QUICK) SIZES = [[393, 852, 3], [393, 659, 3], [320, 568, 2], [568, 320, 2], [640, 360, 3], [844, 390, 3], [1280, 800, 1.5], [360, 1280, 2], [1280, 360, 1]];

/* the states: a prize waiting and the longest words (German); a new player
   (Russian), told what opens Freeride; Romanian, every step claimed */
var BASE = { best: 18450, runs: 40, sfx: false, music: false, fish: 2380, gold: 5, owned: ['snowcap'], equipped: 'snowcap',
             lives: 2, tutDone: true, courses: { firstlight: 3 }, comicSeen: { snowcap: true } };
function save(o) { return Object.assign({}, BASE, o); }
var CASES = [];
SIZES.forEach(function (s) { CASES.push({ s: s, name: 'de', save: save({ lang: 'de', ev: { ny2027: { g: 620, got: [0], seen: true } } }) }); });
SIZES.filter(function (s, i) { return QUICK || i % 3 === 0; }).forEach(function (s) {
  CASES.push({ s: s, name: 'ru-new', save: save({ lang: 'ru', best: 0, runs: 1, courses: {}, ev: {} }) });
  CASES.push({ s: s, name: 'ro-all', save: save({ lang: 'ro', ev: { ny2027: { g: 1000, got: [0, 1, 2, 3], seen: true } } }) });
});
/* a phone's own letters at 130% (Android's font size), on the phones */
SIZES.filter(function (s) { return s[0] <= 932 && s[1] <= 932; }).forEach(function (s) {
  CASES.push({ s: s, name: 'de-130%', zoom: 1.3, save: save({ lang: 'de', ev: { ny2027: { g: 620, got: [0], seen: true } } }) });
});

/* in the page: open the event, grow the letters if asked, and measure */
function probe(zoom) {
  return "window.__probe=null;(async function(){var sl=function(ms){return new Promise(function(r){setTimeout(r,ms)})};" +
  "document.querySelector('[data-action=modes]').click();await sl(500);document.getElementById('btn-event').click();await sl(1100);" +
  (zoom ? "var els=[].slice.call(document.querySelectorAll('#screen-event *'));var fz=els.map(function(e){return parseFloat(getComputedStyle(e).fontSize)});" +
          "els.forEach(function(e,i){e.style.fontSize=(fz[i]*" + zoom + ")+'px'});window.dispatchEvent(new Event('resize'));await sl(300);" : "") +
  "var W=innerWidth,H=innerHeight,R=function(e){var r=e.getBoundingClientRect();return{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}};" +
  "var bd=document.getElementById('ev-board'),scene=R(document.querySelector('.ev-scene')),board=R(bd),play=R(document.getElementById('ev-play')),back=R(document.getElementById('btn-back'));" +
  "var bad=[];" +
  /* past any phone's shape (taller than 2.4:1, a 9:32 sliver) the painting is
     drawn so the board is whole, the night carrying on above it */
  "var sliver=H/W>2.4;" +
  "if(scene.l>0.5||scene.r<W-0.5||scene.b<H-0.5||(!sliver&&scene.t>0.5))bad.push('the painting does not cover the screen');" +
  "if(board.l<-0.5||board.t<-0.5||board.r>W+0.5||board.b>H+0.5)bad.push('the board is cut by the screen');" +
  "if(board.h<100||board.w<200)bad.push('the board is too small ('+Math.round(board.w)+'x'+Math.round(board.h)+')');" +
  "if(bd.scrollWidth>bd.clientWidth+1)bad.push('the table scrolls sideways');" +
  /* every visible thing on the board inside it across, and inside its row */
  "[].slice.call(bd.querySelectorAll('*')).forEach(function(e){var r=e.getBoundingClientRect();if(!r.width||!r.height||getComputedStyle(e).visibility==='hidden')return;" +
  "  if(r.left<board.l-1||r.right>board.r+1)bad.push('sticks out across: '+(e.id||e.className||e.tagName));" +
  "  var cs=getComputedStyle(e);if((cs.overflowX==='hidden'||cs.textOverflow==='ellipsis')&&e.scrollWidth>e.clientWidth+1)bad.push('cut: '+(e.id||e.className))});" +
  "[].slice.call(bd.querySelectorAll('.ev-stage')).forEach(function(row,i){var rr=row.getBoundingClientRect();[].slice.call(row.children).forEach(function(c){var r=c.getBoundingClientRect();" +
  "  if(r.left<rr.left-1||r.right>rr.right+1||r.top<rr.top-1||r.bottom>rr.bottom+1)bad.push('step '+i+': '+c.className+' out of its row')})});" +
  /* the letters: size, and how they stand out from what is under them */
  "function rgb(s){var m=s.match(/[\\d.]+/g);return m?m.slice(0,3).map(Number):null}" +
  "function lum(c){c=c.map(function(v){v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]}" +
  "function under(e){for(var a=e;a&&a!==bd.parentNode;a=a.parentElement){var cs=getComputedStyle(a);var bg=rgb(cs.backgroundColor);" +
  "  if(bg&&!/rgba\\(.*,\\s*0\\)$/.test(cs.backgroundColor)&&!(cs.backgroundColor.indexOf('rgba')===0&&parseFloat(cs.backgroundColor.split(',')[3])<0.5))return bg;" +
  "  var gi=cs.backgroundImage.match(/(#[0-9a-f]{6}|rgba?\\([^)]*\\))/gi);if(gi&&cs.backgroundImage.indexOf('gradient')>=0){var last=gi[gi.length-1];" +
  "    if(last[0]==='#')return[parseInt(last.substr(1,2),16),parseInt(last.substr(3,2),16),parseInt(last.substr(5,2),16)];var v=rgb(last);if(v)return v}}" +
  "  return[214,236,250]}" +   /* the board's own ice */
  "var minPx=99,minC=99,worst='';var walk=document.createTreeWalker(bd,NodeFilter.SHOW_TEXT);var n;" +
  "while((n=walk.nextNode())){if(!n.nodeValue.trim())continue;var p=n.parentElement,cs=getComputedStyle(p);if(!p.getBoundingClientRect().width)continue;" +
  "  var px=parseFloat(cs.fontSize);if(px<minPx)minPx=px;var fg=rgb(cs.color),bg=under(p),a=lum(fg),b=lum(bg),c=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);" +
  "  var bold=parseInt(cs.fontWeight,10)>=700,big=px>=24||(bold&&px>=18.6);var need=big?3:(bold?3:4.5);" +
  "  if(c<need&&c<minC){minC=c;worst=n.nodeValue.trim().slice(0,24)+' ('+c.toFixed(2)+')'}}" +
  "if(minPx<12)bad.push('letters of '+minPx.toFixed(1)+' px');" +
  "if(worst)bad.push('hard to read: '+worst);" +
  /* the way to Freeride */
  "if(play.l<0||play.t<0||play.r>W||play.b>H)bad.push('Go to Freeride is off the screen');" +
  "function hit(a,b){return a.l<b.r-2&&b.l<a.r-2&&a.t<b.b-2&&b.t<a.b-2}" +
  "if(hit(play,board))bad.push('Go to Freeride lies on the board');" +
  "if(hit(play,back))bad.push('Go to Freeride is under Back');" +
  "var bbHit=hit(back,{l:board.l,t:board.t,r:board.r,b:Math.min(board.b,board.t+bd.clientHeight)});" +
  "window.__probe=JSON.stringify({W:W,H:H,board:board,dpr:devicePixelRatio,bad:bad,backOnBoard:bbHit,fits:bd.scrollHeight<=bd.clientHeight+1,contentH:bd.scrollHeight,boardH:bd.clientHeight})})().catch(function(e){window.__probe=JSON.stringify({bad:['the probe failed: '+e],board:{l:0,t:0,r:1,b:1,w:1,h:1},dpr:1})});1";
}

/* the board's own ice under the table: what share of it is pale ice */
var PALE = "import sys\nfrom PIL import Image\nim=Image.open(sys.argv[1]).convert('RGB');x0,y0,x1,y1=[int(float(v)) for v in sys.argv[2:6]]\n" +
  "x0=max(0,x0);y0=max(0,y0);x1=min(im.size[0],x1);y1=min(im.size[1],y1)\nn=p=0\n" +
  "for y in range(y0,y1,max(1,(y1-y0)//60)):\n for x in range(x0,x1,max(1,(x1-x0)//60)):\n  r,g,b=im.getpixel((x,y));mx=max(r,g,b);mn=min(r,g,b);n+=1\n  if mx>150 and mx-mn<95 and b>=r-10:p+=1\n" +
  "print(p/max(1,n))";

(async function () {
  var B = await M.start(ROOT, 8861, 9361), shots = [];
  try {
    for (var i = 0; i < CASES.length; i++) {
      var C = CASES[i], s = C.s, label = s[0] + 'x' + s[1] + ' ' + C.name;
      var tab = await B.open({ width: s[0], height: s[1], deviceScaleFactor: s[2], mobile: s[0] < 1000 || s[1] < 600 }, C.save);
      await tab.ev(probe(C.zoom));
      var got = null;
      for (var w = 0; w < 80 && !got; w++) { await M.sleep(100); var rv = (await tab.ev('window.__probe')).result; got = rv && rv.value; }
      var r = JSON.parse(got || '{"bad":["no answer from the page"],"board":{"l":0,"t":0,"r":1,"b":1,"w":1,"h":1},"dpr":1}');
      var file = path.join(OUT, String(i).padStart(3, '0') + '.png');
      await B.shoot(tab, file);
      /* the table hidden: under it, the board's own ice */
      await tab.ev("document.getElementById('ev-board').style.visibility='hidden';document.querySelector('.ev-foot').style.visibility='hidden';1");
      await M.sleep(150);
      var bare = path.join(OUT, String(i).padStart(3, '0') + '-bare.png');
      await B.shoot(tab, bare);
      await B.close(tab);
      var k = r.dpr, bb = r.board;
      var pale = +cp.execFileSync('python3', ['-c', PALE, bare, bb.l * k + 6, bb.t * k + 6, bb.r * k - 6, bb.b * k - 6]).toString();
      if (pale < 0.8) r.bad.push('under the table is not the board (' + Math.round(pale * 100) + '% ice)');
      ok(!r.bad.length, label + (r.bad.length ? ': ' + r.bad.join('; ') : '') + '  [board ' + Math.round(bb.w) + 'x' + Math.round(bb.h) +
         (r.fits ? ', all on it' : ', scrolls ' + r.contentH + '/' + r.boardH) + (r.backOnBoard ? ', Back over its corner' : '') + ']');
      shots.push([file, label]);
    }
  } finally { await B.close && 0; B.stop && B.stop(); }
  /* the contact sheet */
  var list = path.join(OUT, 'list.txt');
  fs.writeFileSync(list, shots.map(function (x) { return x[0] + '\t' + x[1]; }).join('\n'));
  cp.execFileSync('python3', ['-c', "import sys\nfrom PIL import Image, ImageDraw\nrows=[l.split('\\t') for l in open(sys.argv[1]).read().split('\\n') if l]\n" +
    "T=200;ims=[]\nfor f,lab in rows:\n im=Image.open(f).convert('RGB');k=T/max(im.size);im=im.resize((max(1,int(im.size[0]*k)),max(1,int(im.size[1]*k))));ims.append((im,lab))\n" +
    "cols=8;cw=T+10;rh=T+26;H=((len(ims)+cols-1)//cols)*rh\nsheet=Image.new('RGB',(cols*cw,H),(28,28,34));d=ImageDraw.Draw(sheet)\n" +
    "for i,(im,lab) in enumerate(ims):\n x=(i%cols)*cw+5;y=(i//cols)*rh+4;sheet.paste(im,(x,y));d.text((x,y+T+4),lab,fill=(230,230,230))\n" +
    "sheet.save(sys.argv[2])", list, path.join(__dirname, 'out', 'eventpage.png')]);
  console.log('contact sheet: test/out/eventpage.png');
  console.log(fail ? fail + ' FAILURE(S)' : 'event page checks passed');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(2); });
