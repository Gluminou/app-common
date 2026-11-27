# Draws home-screen icons in the house style: flat square background, one simple light shape.
# python3 icons.py <app> <outdir>   writes icon-512.png, icon-192.png, icon-180.png
import sys
from PIL import Image, ImageDraw

S = 2048  # drawn large, then scaled down for clean edges
def rr(d, box, r, fill=None, outline=None, width=0):
    d.rounded_rectangle([int(v) for v in box], radius=int(r), fill=fill, outline=outline, width=int(width))

def job_tracker(d):  # briefcase
    W = '#FFFFFF'
    rr(d, (760, 470, 1288, 760), 90, outline=W, width=110)
    rr(d, (420, 700, 1628, 1560), 150, fill=W)
    d.rectangle((420, 1010, 1628, 1080), fill='#2450C8')
    rr(d, (930, 940, 1118, 1150), 40, fill='#A9BDF2')
    return '#2450C8'

def carnet(d):  # cooking pot with steam
    W = '#FFFFFF'
    import math
    for x in (790, 1024, 1258):
        pts = [(x + 60 * math.sin((y - 330) / 400 * 2 * math.pi), y) for y in range(330, 760, 8)]
        d.line(pts, fill='#F6C9BC', width=70, joint='curve')
        for px, py in (pts[0], pts[-1]):
            d.ellipse((px - 35, py - 35, px + 35, py + 35), fill='#F6C9BC')
    rr(d, (380, 860, 1668, 960), 50, fill=W)
    d.rounded_rectangle((470, 930, 1578, 1640), radius=170, fill=W)
    rr(d, (250, 1040, 470, 1140), 50, fill=W)
    rr(d, (1578, 1040, 1798, 1140), 50, fill=W)
    return '#C23B1E'

def apartment(d):  # floor plan
    W = '#E3E8E9'
    rr(d, (1060, 1060, 1580, 1580), 30, fill='#EE7A61')
    w = 90
    rr(d, (420, 420, 1628, 1628), 60, outline=W, width=w)
    d.rectangle((1000, 420, 1000 + w, 900), fill=W)
    d.rectangle((420, 1000, 1150, 1000 + w), fill=W)
    d.rectangle((1350, 1000, 1628, 1000 + w), fill=W)
    d.rectangle((1000, 1250, 1000 + w, 1628), fill=W)
    return '#1E2629'

def piano(d):  # keyboard with an orange spine
    W = '#FFFFFF'
    rr(d, (300, 520, 1748, 640), 40, fill='#EA7E1C')
    x0, x1, y0, y1 = 300, 1748, 680, 1540
    n = 7; kw = (x1 - x0) / n
    for i in range(n):
        rr(d, (x0 + i * kw + 14, y0, x0 + (i + 1) * kw - 14, y1), 40, fill=W)
    for i in (1, 2, 4, 5, 6):
        cx = x0 + i * kw
        rr(d, (cx - 70, y0, cx + 70, 1180), 24, fill='#23263A')
    return '#23263A'

def bunbun(d):  # week calendar
    W = '#FFFFFF'
    rr(d, (380, 470, 1668, 1620), 140, fill=W)
    d.rectangle((380, 760, 1668, 790), fill='#D9D1F6')
    rr(d, (380, 470, 1668, 760), 140, fill='#C9BEF5')
    d.rectangle((380, 640, 1668, 760), fill='#C9BEF5')
    for x in (640, 1408):
        rr(d, (x - 45, 360, x + 45, 600), 45, fill=W)
    colors = ['#6a4fd8', '#F2A541', '#4FB3A9', '#E36A8C', '#6a4fd8', '#C9BEF5', '#C9BEF5']
    for i in range(7):
        r, c = divmod(i, 4)
        cx = 560 + c * 310; cy = 1010 + r * 330
        d.ellipse((cx - 95, cy - 95, cx + 95, cy + 95), fill=colors[i])
    return '#6a4fd8'

def devoirs(d):  # open exercise book with a yellow star
    W = '#FFFFFF'
    d.polygon([(1024, 760), (330, 600), (330, 1560), (1024, 1720)], fill=W)
    d.polygon([(1024, 760), (1718, 600), (1718, 1560), (1024, 1720)], fill='#E4ECFF')
    for k in range(4):
        y = 860 + k * 170
        d.line([(440, y), (930, y + 100)], fill='#A9C0F5', width=40)
        d.line([(1118, y + 100), (1608, y)], fill='#A9C0F5', width=40)
    import math
    cx, cy, R, r = 1024, 470, 260, 110
    pts = [(cx + (R if i % 2 == 0 else r) * math.sin(i * math.pi / 5), cy - (R if i % 2 == 0 else r) * math.cos(i * math.pi / 5)) for i in range(10)]
    d.polygon(pts, fill='#F2B705')
    return '#2B5CC8'

APPS = {'job-tracker': job_tracker, 'carnet-recettes': carnet, 'apartment-layout': apartment,
        'piano-steps': piano, 'bunbun-week': bunbun, 'devoirs': devoirs}

if __name__ == '__main__':
    app, out = sys.argv[1], sys.argv[2]
    im = Image.new('RGB', (S, S), 'white'); d = ImageDraw.Draw(im)
    bg = APPS[app](ImageDraw.Draw(Image.new('RGB', (1, 1))))  # get colour
    im = Image.new('RGB', (S, S), bg); d = ImageDraw.Draw(im); APPS[app](d)
    for n in (512, 192, 180):
        im.resize((n, n), Image.LANCZOS).save(f'{out}/icon-{n}.png', optimize=True)
