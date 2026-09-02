#!/usr/bin/env python3
"""Generate the app icons (blue square + white bolt) as real PNGs, no dependencies."""
import struct, zlib

BG = (0x2a, 0x78, 0xd6)
FG = (0xff, 0xff, 0xff)
SS = 4  # supersampling factor for antialiasing

# Lightning bolt in unit coords (y grows downward).
BOLT = [(0.60, 0.09), (0.29, 0.55), (0.47, 0.55), (0.39, 0.91),
        (0.71, 0.44), (0.53, 0.44)]


def inside(px, py, poly):
    hit = False
    n = len(poly)
    for i in range(n):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % n]
        if (y0 > py) != (y1 > py):
            if px < (x1 - x0) * (py - y0) / (y1 - y0) + x0:
                hit = not hit
    return hit


def render(size):
    rows = bytearray()
    for y in range(size):
        rows.append(0)  # PNG filter type: none
        for x in range(size):
            cov = 0
            for sy in range(SS):
                py = (y + (sy + 0.5) / SS) / size
                for sx in range(SS):
                    px = (x + (sx + 0.5) / SS) / size
                    if inside(px, py, BOLT):
                        cov += 1
            a = cov / (SS * SS)
            for c in range(3):
                rows.append(round(BG[c] * (1 - a) + FG[c] * a))
    return bytes(rows)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff))


def write_png(path, size):
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit truecolour
    png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", zlib.compress(render(size), 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)
    print(path, size, len(png), "bytes")


for s in (180, 192, 512):
    write_png("icon-%d.png" % s, s)
