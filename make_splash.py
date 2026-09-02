#!/usr/bin/env python3
"""Generate iOS PWA launch screens (splash/) plus the <link> tags to paste into index.html.

iOS only shows a launch screen if it finds an apple-touch-startup-image whose media
query matches the device exactly, so we emit one PNG per iPhone size per colour scheme.
Each image is a solid page background + the app mark + the app name, which compresses
to a few KB despite the pixel dimensions.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = "splash"
FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
TITLE = "電費追蹤"
SS = 4  # supersample factor: draw big, downscale for antialiasing

BLUE = (0x2a, 0x78, 0xd6)
SCHEMES = {
    #            page bg              title ink
    "light": ((0xf9, 0xf9, 0xf7), (0x0b, 0x0b, 0x0b)),
    "dark":  ((0x0d, 0x0d, 0x0d), (0xff, 0xff, 0xff)),
}

# Lightning bolt in unit coords (y down) — same shape as the app icon.
BOLT = [(0.60, 0.09), (0.29, 0.55), (0.47, 0.55), (0.39, 0.91), (0.71, 0.44), (0.53, 0.44)]

# (css_width, css_height, device_pixel_ratio) -> covers every current iPhone in portrait.
DEVICES = [
    (440, 956, 3),  # 16 Pro Max
    (402, 874, 3),  # 16 Pro
    (430, 932, 3),  # 15/16 Plus, 14 Pro Max
    (393, 852, 3),  # 14 Pro, 15, 16
    (428, 926, 3),  # 12/13/14 Plus & Max
    (390, 844, 3),  # 12/13/14
    (375, 812, 3),  # X/XS/11 Pro, 13 mini
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (375, 667, 2),  # SE2/SE3, 6/7/8
    (414, 736, 3),  # 8 Plus
    (320, 568, 2),  # SE 1st gen
]


def rounded_rect(draw, box, r, fill):
    """Pillow 8.0 has no rounded_rectangle, so compose one from rects + pieslices."""
    x0, y0, x1, y1 = box
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    for cx, cy, start in ((x0, y0, 180), (x1 - 2 * r, y0, 270),
                          (x0, y1 - 2 * r, 90), (x1 - 2 * r, y1 - 2 * r, 0)):
        draw.pieslice([cx, cy, cx + 2 * r, cy + 2 * r], start, start + 90, fill=fill)


def make_mark(size):
    """The app mark: blue rounded tile with a white bolt, rendered supersampled."""
    s = size * SS
    tile = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(tile)
    rounded_rect(d, (0, 0, s - 1, s - 1), int(s * 0.225), BLUE + (255,))
    d.polygon([(x * s, y * s) for x, y in BOLT], fill=(255, 255, 255, 255))
    return tile.resize((size, size), Image.LANCZOS)


def build(css_w, css_h, dpr, scheme):
    bg, ink = SCHEMES[scheme]
    W, H = css_w * dpr, css_h * dpr
    img = Image.new("RGB", (W, H), bg)

    mark = min(W, H) * 28 // 100
    tile = make_mark(mark)
    # Sit the group slightly above centre — dead-centre reads as low on a tall screen.
    top = (H - mark) // 2 - int(H * 0.06)
    img.paste(tile, ((W - mark) // 2, top), tile)

    size = max(14, mark // 7)
    font = ImageFont.truetype(FONT, size)
    try:                                   # Pillow >= 8: textbbox; older: textsize
        l, t, r, b = ImageDraw.Draw(img).textbbox((0, 0), TITLE, font=font)
        tw, th, off = r - l, b - t, t
    except AttributeError:
        tw, th, off = ImageDraw.Draw(img).textsize(TITLE, font=font) + (0,)
    ImageDraw.Draw(img).text(((W - tw) // 2, top + mark + int(mark * 0.22) - off),
                             TITLE, font=font, fill=ink)

    path = "%s/%dx%d-%s.png" % (OUT, W, H, scheme)
    # Only ~3 colours plus antialiasing, so a 128-entry palette is lossless to the eye
    # and roughly quarters the file size.
    img.convert("P", palette=Image.ADAPTIVE, colors=128).save(path, optimize=True)
    return path, W, H


os.makedirs(OUT, exist_ok=True)
tags, total = [], 0
for css_w, css_h, dpr in DEVICES:
    for scheme in ("light", "dark"):
        path, W, H = build(css_w, css_h, dpr, scheme)
        total += os.path.getsize(path)
        tags.append(
            '<link rel="apple-touch-startup-image" href="%s"\n'
            '  media="(device-width: %dpx) and (device-height: %dpx) and '
            '(-webkit-device-pixel-ratio: %d) and (orientation: portrait) and '
            '(prefers-color-scheme: %s)">' % (path, css_w, css_h, dpr, scheme))

print("\n".join(tags))
print("\n<!-- %d files, %.0f KB total -->" % (len(tags), total / 1024))
