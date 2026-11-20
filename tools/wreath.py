#!/usr/bin/env python3
"""The New Year wreath frame (css/style.css, .pf-wreath::before) as one SVG.

A ring of pine round a 100x100 box, lying over the rim of a portrait:
three layers of sprigs (dark under, light on top, sunlit tips), holly,
clusters of berries, pine cones, dried orange, a dusting of snow on the
upper half and a red bow at the top, every piece with a soft shadow under
it. Asked for by the owner, 20 Nov 2026 ("more detailed, more shadows,
more little leaves"). Seeded, so it comes out the same every time.

    python3 tools/wreath.py            prints the CSS url(...)
    python3 tools/wreath.py --write    puts it into css/style.css
    python3 tools/wreath.py --svg F    writes the bare SVG to F
"""
import math, random, sys, urllib.parse, re, os

R0 = 44.5            # the ring's centre line
rnd = random.Random(2027)

def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def pol(a, r):
    return 50 + math.cos(a) * r, 50 + math.sin(a) * r

out = []
def add(s): out.append(s)

# ---------------------------------------------------------------- defs
add('<defs>'
    '<filter id="s" x="-20%" y="-20%" width="140%" height="140%">'
    '<feDropShadow dx=".5" dy=".9" stdDeviation=".7" flood-color="#06200f" flood-opacity=".6"/></filter>'
    '<filter id="t" x="-20%" y="-20%" width="140%" height="140%">'
    '<feDropShadow dx=".3" dy=".6" stdDeviation=".4" flood-color="#3a0006" flood-opacity=".55"/></filter>'
    '<radialGradient id="b" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#ff7a7e"/>'
    '<stop offset=".45" stop-color="#d81e26"/><stop offset="1" stop-color="#7a0a10"/></radialGradient>'
    '<radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffe0a0"/>'
    '<stop offset=".7" stop-color="#ffb347"/><stop offset="1" stop-color="#f08a1c"/></radialGradient>'
    '<linearGradient id="r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0444b"/>'
    '<stop offset=".6" stop-color="#c4161c"/><stop offset="1" stop-color="#8e0d15"/></linearGradient>'
    '</defs>')

# ---------------------------------------------------------------- the base
add('<circle cx="50.6" cy="51.2" r="%s" fill="none" stroke="#06200f" stroke-opacity=".45" stroke-width="12"/>' % f(R0))
add('<circle cx="50" cy="50" r="%s" fill="none" stroke="#123d22" stroke-width="11"/>' % f(R0))

# ---------------------------------------------------------------- the pine
def sprigs(n, jit, length, needles, nlen, phase):
    """one path: twigs laid round the ring, needles fanned off them"""
    d = []
    for i in range(n):
        a = (i + phase + rnd.uniform(-.3, .3)) / n * 2 * math.pi
        rr = R0 + rnd.uniform(-jit, jit)
        x, y = pol(a, rr)
        # a twig runs mostly along the ring, leaning in or out
        tang = a + math.pi / 2 * (1 if i % 2 else -1) * rnd.uniform(.55, .95)
        tang += rnd.uniform(-.35, .35)
        L = length * rnd.uniform(.8, 1.15)
        dx, dy = math.cos(tang), math.sin(tang)
        d.append('M%s %sl%s %s' % (f(x), f(y), f(dx * L), f(dy * L)))
        for k in range(needles):
            u = (k + 1) / (needles + 1)
            px, py = x + dx * L * u, y + dy * L * u
            for side in (-1, 1):
                na = tang + side * rnd.uniform(.55, .9)
                nl = nlen * rnd.uniform(.75, 1.1) * (1 - u * .35)
                d.append('M%s %sl%s %s' % (f(px), f(py), f(math.cos(na) * nl), f(math.sin(na) * nl)))
    return ''.join(d)

for n, jit, L, nd, nl, col, w, ph in [
        (64, 5.2, 7.0, 5, 3.4, '#0e341c', 1.5, 0.0),     # under, darkest
        (64, 4.6, 6.4, 5, 3.0, '#1d6334', 1.25, 0.5),    # middle
        (40, 3.8, 5.6, 4, 2.6, '#2f8448', 1.05, 0.25),   # on top
        (28, 3.4, 4.0, 3, 2.0, '#5fb56b', .8, 0.75)]:    # sunlit tips
    add('<path d="%s" stroke="%s" stroke-width="%s" stroke-linecap="round" fill="none"%s/>'
        % (sprigs(n, jit, L, nd, nl, ph), col, f(w), ' filter="url(#s)"' if col == '#1d6334' else ''))

# ---------------------------------------------------------------- holly
def holly(cx, cy, ang, size):
    pts = []
    for k in range(7):                       # a leaf of seven points a side
        u = k / 6
        wdt = math.sin(u * math.pi) * size * .38 * (1.15 if k % 2 else .8)
        pts.append((u * size, wdt))
    top = ' '.join('L%s %s' % (f(x), f(-y)) for x, y in pts[1:])
    bot = ' '.join('L%s %s' % (f(x), f(y)) for x, y in reversed(pts[:-1]))
    g = '<g transform="translate(%s %s) rotate(%s)">' % (f(cx), f(cy), f(math.degrees(ang)))
    g += '<path d="M0 0 %s %s Z" fill="#23803a" stroke="#0f4a1f" stroke-width=".35"/>' % (top, bot)
    g += '<path d="M.6 0L%s 0" stroke="#7cc489" stroke-width=".3"/>' % f(size * .92)
    return g + '</g>'

for i in range(9):
    a = (i + .5) / 9 * 2 * math.pi + .2
    x, y = pol(a, R0 + rnd.uniform(-1.5, 1.5))
    add('<g filter="url(#s)">' + holly(x, y, a + 2.3, 5.4) + holly(x, y, a - .8, 5) + '</g>')

# ---------------------------------------------------------------- pine cones
for a in (3.55, 0.35, 1.68, 5.1):
    x, y = pol(a, R0 + .5)
    g = '<g filter="url(#s)" transform="translate(%s %s) rotate(%s)">' % (f(x), f(y), f(math.degrees(a) + 90))
    g += '<ellipse rx="2.9" ry="4.1" fill="#5b3518"/>'
    for row in range(4):
        yy = -2.9 + row * 1.9
        for col in (-1, 0, 1):
            g += '<ellipse cx="%s" cy="%s" rx="1.05" ry=".7" fill="%s"/>' % (
                f(col * 1.15 * (1 - abs(yy) / 6)), f(yy), '#9a6630' if row % 2 == col % 2 else '#7d4f24')
    g += '<ellipse cx="-.9" cy="-1.6" rx=".6" ry="1.4" fill="#c8945a" opacity=".55"/>'
    add(g + '</g>')

# ---------------------------------------------------------------- dried orange
for a in (2.62, 0.52, 4.2, 5.75):
    x, y = pol(a, R0 - .3)
    g = '<g filter="url(#s)" transform="translate(%s %s)">' % (f(x), f(y))
    g += '<circle r="4.3" fill="#c8620f"/><circle r="3.7" fill="#fff1d0"/><circle r="3.3" fill="url(#o)"/>'
    seg = ''.join('M0 0L%s %s' % (f(math.cos(k * math.pi / 5) * 3.2), f(math.sin(k * math.pi / 5) * 3.2)) for k in range(10))
    g += '<path d="%s" stroke="#fff4d6" stroke-width=".45"/>' % seg
    g += '<circle r=".7" fill="#fff4d6"/><path d="M-2.3 -2.6A3.5 3.5 0 0 1 1.6 -3.1" stroke="#fff" stroke-width=".5" opacity=".7" fill="none"/>'
    add(g + '</g>')

# ---------------------------------------------------------------- berries
for i in range(12):
    a = (i + .1) / 12 * 2 * math.pi + .1
    if abs(((a - 4.712 + math.pi) % (2 * math.pi)) - math.pi) < .25:   # not under the bow
        continue
    x, y = pol(a, R0 + rnd.uniform(-2.5, 2.5))
    g = '<g filter="url(#t)">'
    for k in range(3 + i % 2):
        bx, by = x + math.cos(k * 2.2 + i) * 1.9, y + math.sin(k * 2.2 + i) * 1.9
        g += '<circle cx="%s" cy="%s" r="1.75" fill="url(#b)"/>' % (f(bx), f(by))
        g += '<circle cx="%s" cy="%s" r=".5" fill="#fff" opacity=".85"/>' % (f(bx - .6), f(by - .6))
    add(g + '</g>')

# ---------------------------------------------------------------- snow on the top half
d = []
for i in range(46):
    a = math.pi + rnd.uniform(.05, .95) * math.pi          # the upper half (y < 50)
    x, y = pol(a, R0 + rnd.uniform(-4.5, 4.5))
    s = rnd.uniform(.5, 1.25)
    d.append('M%s %sh%s' % (f(x - s / 2), f(y), f(s)))
add('<path d="%s" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".85"/>' % ''.join(d))

# ---------------------------------------------------------------- the bow, at the top
add('<g filter="url(#t)">'
    # tails, notched
    '<path d="M48.3 9.5L43 21.5L46.2 20.2L47.4 23L50.4 10Z" fill="#9e1018"/>'
    '<path d="M51.7 9.5L57 21.5L53.8 20.2L52.6 23L49.6 10Z" fill="url(#r)"/>'
    # loops, with a fold of shade inside each
    '<path d="M50 7.6C42 -.8 32.5 2.6 36.2 9.4C38.6 13.6 45.6 11.6 50 8.6Z" fill="url(#r)"/>'
    '<path d="M50 7.6C58 -.8 67.5 2.6 63.8 9.4C61.4 13.6 54.4 11.6 50 8.6Z" fill="url(#r)"/>'
    '<path d="M49 8C44.6 4.6 40.2 5 40.4 8C40.6 9.8 45 10 49 8.6Z" fill="#7d0a11" opacity=".75"/>'
    '<path d="M51 8C55.4 4.6 59.8 5 59.6 8C59.4 9.8 55 10 51 8.6Z" fill="#7d0a11" opacity=".75"/>'
    '<path d="M37.8 6.4C39.4 3.6 43.6 3.2 46.4 5.4" stroke="#ff9a9a" stroke-width=".7" fill="none" stroke-linecap="round"/>'
    '<path d="M62.2 6.4C60.6 3.6 56.4 3.2 53.6 5.4" stroke="#ff9a9a" stroke-width=".7" fill="none" stroke-linecap="round"/>'
    # the knot
    '<rect x="46.9" y="5.2" width="6.2" height="5.4" rx="1.9" fill="#a5101a"/>'
    '<rect x="47.6" y="5.7" width="4.8" height="2.2" rx="1.1" fill="#e0262e"/>'
    '<ellipse cx="48.9" cy="6.4" rx="1.1" ry=".5" fill="#ffb3b3" opacity=".9"/>'
    '</g>')

# The box reaches 8 past the ring's 100 on every side, so the outer sprigs
# and leaves are not cut off; the CSS lays it 18.4% out past the portrait
# (9% for the ring, and the 8 more each way: 1.18 * 116 / 100).
svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 116 116">' + ''.join(out) + '</svg>'

def css_url(s):
    return 'url("data:image/svg+xml,' + urllib.parse.quote(s, safe=" =:/,.-()'") .replace('"', '%22') + '")'

if __name__ == '__main__':
    if '--svg' in sys.argv:
        open(sys.argv[sys.argv.index('--svg') + 1], 'w').write(svg)
    elif '--write' in sys.argv:
        p = os.path.join(os.path.dirname(__file__), '..', 'css', 'style.css')
        css = open(p).read()
        i = css.index('.pf-wreath::before{')
        m = re.compile(r'background:url\("data:image/svg\+xml,.*?"\)').search(css, i)
        css = css[:m.start()] + 'background:' + css_url(svg) + css[m.end():]
        css = re.sub(r'(\.pf-wreath::before\{ content:\'\'; position:absolute; inset:)-?[\d.]+%', r'\g<1>-18.4%', css)
        open(p, 'w').write(css)
        print('css/style.css: the wreath, %d bytes' % len(css_url(svg)))
    else:
        print(css_url(svg))
