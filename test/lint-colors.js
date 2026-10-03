/* Every '#...' string literal in the renderer must be a hex colour that
   CanvasGradient.addColorStop will accept. An invalid stop throws, which
   leaves ctx.save() unbalanced and makes the whole scene drift. */
var fs = require('fs');
var bad = 0, seen = 0;
['game.js', 'biomes.js', 'ui.js', 'skins.js'].forEach(function (f) {
  var p = require('path').join(__dirname, '..', 'js', f);
  if (!fs.existsSync(p)) return;
  var src = fs.readFileSync(p, 'utf8');
  var re = /(['"])(#[^'"\n]*)\1/g, m;
  while ((m = re.exec(src))) {
    seen++;
    var c = m[2];
    /* A CSS selector also starts with '#'. Only things that could plausibly
       be a colour are worth complaining about. */
    if (/[\s.,\[\]>:()#]/.test(c.slice(1))) { seen--; continue; }
    if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(c)) {
      bad++;
      console.log('  INVALID ' + f + ': ' + JSON.stringify(c) +
        ' at line ' + (src.slice(0, m.index).split('\n').length));
    }
  }
  // a concatenation or method call that builds a colour is equally suspect
  var re2 = /(['"])#[^'"\n]*\1\s*(\+|\.\s*(replace|concat|slice|substr))/g;
  while ((m = re2.exec(src))) {
    bad++;
    console.log('  BUILT-UP COLOUR ' + f + ' at line ' +
      (src.slice(0, m.index).split('\n').length) + ': ' + m[0]);
  }
});
console.log('  checked ' + seen + ' literals, ' + bad + ' problem(s)');
process.exit(bad ? 1 : 0);
