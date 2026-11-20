#!/usr/bin/env python3
"""The winter night behind the update banner (css/style.css, #sheet-update).

A night sky with an aurora in green, violet and pink and the moon, hills of
snow in three rows with snow-laden pines, the moon's side of each tier lit
and the other in shade. Drawn wide (800x600) and laid on the screen from its
foot, so a phone held upright sees its middle: the moon and some pines stand
there on purpose. The owner, 20 Nov 2026. Seeded, so it comes out the same.

    python3 tools/snowscene.py --write    puts it into css/style.css
"""
import math, random, re, os, sys

rnd = random.Random(11)
W, H = 800, 600


def f(v):
    s = ('%.1f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


def hill(base, amp, freq, phase):
    pts = []
    for i in range(81):
        x = W * i / 80
        y = base - amp * math.sin(i / 80 * math.pi * freq + phase) - amp * 0.4 * math.sin(i / 80 * math.pi * freq * 2.3 + phase * 1.7)
        pts.append((x, y))
    d = 'M0 %s ' % f(H) + ' '.join('L%s %s' % (f(x), f(y)) for x, y in pts) + ' L%s %s Z' % (f(W), f(H))
    return d, pts


def at(pts, x):
    return [q for q in pts if q[0] >= x][0][1]


def tree(x, y, h):
    """a pine: five tiers of needled branches, lit on the moon's side,
    each tier carrying snow with a drip or two, a trunk, a snowy tip"""
    w = h * 0.4
    s = "<ellipse cx='%s' cy='%s' rx='%s' ry='%s' fill='rgba(60,100,150,.28)'/>" % (f(x + h * 0.14), f(y + 1), f(w * 1.05), f(h * 0.05))
    s += "<path d='M%s %s L%s %s L%s %s L%s %s Z' fill='#3a2a22'/>" % (
        f(x - h * 0.035), f(y - h * 0.13), f(x + h * 0.035), f(y - h * 0.13), f(x + h * 0.045), f(y), f(x - h * 0.045), f(y))
    tiers = 5
    for k in range(tiers):
        t0 = k / tiers * 0.82
        top = y - h + h * t0
        bot = y - h + h * (t0 + 0.3) - h * 0.1
        ww = w * (0.35 + 0.65 * (k + 1) / tiers)
        # needled lower edge: a zigzag from the left tip to the right
        teeth = 4 + k
        edge = []
        for i in range(teeth * 2 + 1):
            u = i / (teeth * 2)
            ex = x - ww + 2 * ww * u
            ey = bot - (h * 0.035 if i % 2 else 0) - abs(u - 0.5) * h * 0.06
            edge.append((ex, ey))
        pts = [(x, top)] + edge
        d = 'M' + ' L'.join('%s %s' % (f(px), f(py)) for px, py in pts) + 'Z'
        s += "<path d='%s' fill='#123552'/>" % d
        # the moon's side (the right) lit, a narrower lit wedge
        lit = [(x, top)] + [(px, py) for px, py in edge if px >= x - ww * 0.05]
        s += "<path d='%s' fill='#1e4f78' opacity='.85'/>" % ('M' + ' L'.join('%s %s' % (f(px), f(py)) for px, py in lit) + 'Z')
        # the dark inside under the tier above
        s += "<path d='M%s %s L%s %s L%s %s Z' fill='rgba(5,20,40,.35)'/>" % (
            f(x), f(top + h * 0.05), f(x - ww * 0.35), f(top + h * 0.16), f(x + ww * 0.1), f(top + h * 0.16))
        # snow lying on the tier, heavier on its upper side, with drips
        sy = bot - h * 0.06
        snow = "M%s %s Q%s %s %s %s Q%s %s %s %s" % (
            f(x - ww * 0.9), f(sy + h * 0.02), f(x - ww * 0.45), f(sy - h * 0.07), f(x), f(sy - h * 0.045),
            f(x + ww * 0.45), f(sy - h * 0.08), f(x + ww * 0.92), f(sy + h * 0.015))
        drips = ''
        for dx in (-0.55, 0.15, 0.62):
            if rnd.random() < 0.7:
                px = x + ww * dx
                drips += "L%s %s Q%s %s %s %s Q%s %s %s %s " % (
                    f(px + ww * 0.05), f(sy - h * 0.01), f(px), f(sy + h * 0.035), f(px - ww * 0.05), f(sy - h * 0.01),
                    f(px - ww * 0.05), f(sy - h * 0.01), f(px - ww * 0.05), f(sy - h * 0.01))
        s += "<path d='%s L%s %s Q%s %s %s %sZ' fill='#eef6fc'/>" % (
            snow, f(x + ww * 0.6), f(sy + h * 0.025), f(x), f(sy + h * 0.005), f(x - ww * 0.6), f(sy + h * 0.03))
        s += "<path d='M%s %s Q%s %s %s %s' fill='none' stroke='#ffffff' stroke-width='%s' stroke-linecap='round' opacity='.9'/>" % (
            f(x + ww * 0.05), f(sy - h * 0.05), f(x + ww * 0.45), f(sy - h * 0.085), f(x + ww * 0.85), f(sy - h * 0.005), f(max(0.6, h * 0.018)))
        for dx in (-0.55, 0.15, 0.62):
            if rnd.random() < 0.6:
                px = x + ww * dx
                s += "<path d='M%s %s Q%s %s %s %s Z' fill='#e2eef8'/>" % (
                    f(px - ww * 0.06), f(sy + h * 0.015), f(px), f(sy + h * 0.06), f(px + ww * 0.06), f(sy + h * 0.015))
    # the tip, capped
    s += "<path d='M%s %s Q%s %s %s %s Q%s %s %s %s Z' fill='#f6fbff'/>" % (
        f(x - w * 0.16), f(y - h + h * 0.1), f(x - w * 0.05), f(y - h - h * 0.02), f(x), f(y - h - h * 0.03),
        f(x + w * 0.08), f(y - h - h * 0.01), f(x + w * 0.17), f(y - h + h * 0.09))
    for _ in range(3):
        gx, gy = x + rnd.uniform(-w * 0.6, w * 0.6), y - rnd.uniform(h * 0.15, h * 0.8)
        s += "<circle cx='%s' cy='%s' r='%s' fill='#ffffff' opacity='.8'/>" % (f(gx), f(gy), f(max(0.5, h * 0.012)))
    return s


sky = ("<linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='#071a33'/><stop offset='.55' stop-color='#0d3a5c'/><stop offset='1' stop-color='#2a6a96'/></linearGradient>"
       "<radialGradient id='a' cx='.35' cy='.12' r='.6'><stop offset='0' stop-color='rgba(90,230,190,.28)'/><stop offset='1' stop-color='rgba(90,230,190,0)'/></radialGradient>"
       "<radialGradient id='a2' cx='.65' cy='.08' r='.5'><stop offset='0' stop-color='rgba(170,110,255,.34)'/><stop offset='1' stop-color='rgba(170,110,255,0)'/></radialGradient>"
       "<radialGradient id='m'><stop offset='0' stop-color='rgba(255,255,240,.9)'/><stop offset='.25' stop-color='rgba(255,255,235,.5)'/><stop offset='1' stop-color='rgba(255,255,235,0)'/></radialGradient>"
       "<linearGradient id='h1' x2='0' y2='1'><stop offset='0' stop-color='#cfe3f2'/><stop offset='1' stop-color='#9dbfdc'/></linearGradient>"
       "<linearGradient id='h2' x2='0' y2='1'><stop offset='0' stop-color='#e6f2fb'/><stop offset='1' stop-color='#b9d4ea'/></linearGradient>"
       "<linearGradient id='h3' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='#d6e8f6'/></linearGradient>")
body = "<rect width='800' height='600' fill='url(#s)'/><rect width='800' height='600' fill='url(#a)'/><rect width='800' height='600' fill='url(#a2)'/>"
body += "<path d='M-20 70 Q200 10 420 60 T860 30' fill='none' stroke='rgba(110,240,200,.2)' stroke-width='34' stroke-linecap='round'/>"
body += "<path d='M-20 110 Q240 50 460 95 T860 70' fill='none' stroke='rgba(170,120,255,.3)' stroke-width='26' stroke-linecap='round'/>"
body += "<path d='M-20 62 Q260 4 470 46 T860 22' fill='none' stroke='rgba(255,120,200,.26)' stroke-width='18' stroke-linecap='round'/>"
body += "<path d='M-20 92 Q220 40 440 80 T860 52' fill='none' stroke='rgba(210,140,255,.16)' stroke-width='14' stroke-linecap='round'/>"
body += "<circle cx='505' cy='48' r='60' fill='url(#m)'/><circle cx='505' cy='48' r='11' fill='#fffdf0'/>"
for i in range(80):
    body += "<circle cx='%s' cy='%s' r='%s' fill='#fff' opacity='%s'/>" % (f(rnd.uniform(0, W)), f(rnd.uniform(0, 300)), f(rnd.uniform(.4, 1.3)), f(rnd.uniform(.3, .9)))
d, p1 = hill(440, 26, 2.2, 0.4); body += "<path d='%s' fill='url(#h1)'/>" % d
for x in (60, 120, 690, 745, 560, 250):
    body += tree(x, at(p1, x) + 4, rnd.uniform(46, 64))
d, p2 = hill(500, 22, 1.6, 1.9); body += "<path d='%s' fill='url(#h2)'/>" % d
for x in (25, 190, 640, 775):
    body += tree(x, at(p2, x) + 6, rnd.uniform(70, 92))
d, p3 = hill(560, 16, 1.2, 0.9); body += "<path d='%s' fill='url(#h3)'/>" % d
body += "<path d='%s' fill='none' stroke='rgba(255,255,255,.9)' stroke-width='2'/>" % ('M' + ' L'.join('%s %s' % (f(x), f(y)) for x, y in p3))
for x, h in ((292, 40), (318, 30), (486, 44), (512, 32), (110, 52), (700, 56)):
    body += tree(x, at(p3, x) + 5, h)
for i in range(40):
    body += "<circle cx='%s' cy='%s' r='.9' fill='%s'/>" % (f(rnd.uniform(0, W)), f(rnd.uniform(560, 600)), '#fff' if i % 2 else 'rgba(150,190,225,.6)')
scene = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600' preserveAspectRatio='xMidYMax slice'>" + sky + body + "</svg>"
url = "url(\"data:image/svg+xml," + scene.replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace('"', "'") + "\")"

if __name__ == '__main__' and '--write' in sys.argv:
    p = os.path.join(os.path.dirname(__file__), '..', 'css', 'style.css')
    css = open(p).read()
    i = css.index("#sheet-update{\n  background:url(")
    j = css.index("50% 100% / cover no-repeat, #0d3a5c;", i)
    k = css.rindex(", url(", i, j)
    css = css[:k] + ", " + url + " " + css[j:]
    open(p, 'w').write(css)
    print('css/style.css: the update banner\'s night, %d bytes' % len(url))
