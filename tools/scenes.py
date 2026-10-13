#!/usr/bin/env python3
"""Fuehrt die Szenenroutinen der Maschinencode-Bibliothek ($C000-Bereich) im Emulator aus und
speichert die entstehenden Bilder (VIC-Bank 2: Bitmap $A000, Screen $8000, Farb-RAM)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cpu6502 import CPU
from pngwrite import write_png, PAL

class Mem:
    def __init__(s, data):
        s.ram = bytearray(data); s.col = bytearray(1024); s.io = {}
    def iovis(s): v = s.ram[1] & 7; return (v & 3) != 0 and (v & 4) != 0
    def __getitem__(s, a):
        if 0xd000 <= a < 0xe000 and s.iovis():
            return s.col[a - 0xd800] if 0xd800 <= a < 0xdc00 else 0
        return s.ram[a]
    def __setitem__(s, a, v):
        if 0xd000 <= a < 0xe000 and s.iovis():
            if 0xd800 <= a < 0xdc00: s.col[a - 0xd800] = v & 15
            else: s.io[a] = v
            return
        s.ram[a] = v

NOPS = {0xe544, 0xe518, 0xe50c, 0xab1e, 0xfda3, 0xfd15, 0xffd2, 0xe510, 0xe566}

def run_scene(base, entry, pre=None, limit=3_000_000):
    m = Mem(base); m.ram[1] = 0x37
    if pre: pre(m)
    c = CPU(m); c.sp = 0xf0; c.pc = entry
    c.push(0x12); c.push(0x33)
    n = 0
    while c.pc != 0x1234 and n < limit:
        if c.pc in NOPS:
            l = c.pull(); h = c.pull(); c.pc = ((h << 8 | l) + 1) & 0xffff; continue
        try: c.step()
        except Exception as e: return m, 'ERR %s' % e, n
        n += 1
    return m, ('ok' if c.pc == 0x1234 else 'timeout'), n

def render(m, rows=25, bm=0xa000, scr=0x8000, mc=False, border=None):
    out = []
    bg = PAL[(m.io.get(0xd021, 0)) & 15]
    for cy in range(rows):
        for line in range(8):
            r = bytearray()
            for cx in range(40):
                b = m.ram[bm + (cy * 40 + cx) * 8 + line]
                sc = m.ram[scr + cy * 40 + cx]
                fg = PAL[sc >> 4]; bgc = PAL[sc & 15]
                for bit in range(7, -1, -1): r += bytes(fg if (b >> bit) & 1 else bgc)
            out.append(bytes(r))
    return out

def render_text(m, split_raster, mc=False, charset_top=0xa000, charset_pic=0xa800, scr=0x8000):
    split_row = max(0, (split_raster - 0x33 + 4) // 8)
    bg = PAL[m.io.get(0xd021, 0) & 15]
    bg1 = PAL[m.io.get(0xd022, 11) & 15]; bg2 = PAL[m.io.get(0xd023, 12) & 15]
    out = []
    for cy in range(25):
        cs = charset_pic if cy >= split_row else charset_top
        for line in range(8):
            r = bytearray()
            for cx in range(40):
                ch = m.ram[scr + cy * 40 + cx]; b = m.ram[cs + ch * 8 + line]; col = m.col[cy * 40 + cx]
                if mc and col & 8:
                    fg = PAL[col & 7]
                    for p in range(3, -1, -1):
                        v = (b >> (p * 2)) & 3; c = (bg, bg1, bg2, fg)[v]; r += bytes(c) * 2
                else:
                    fg = PAL[col & 15]
                    for bit in range(7, -1, -1): r += bytes(fg if (b >> bit) & 1 else bg)
            out.append(bytes(r))
    return out, split_row

def scene_image(m, ncols=None):
    '''Liefert das Szenenbild (nur der belegte Spaltenbereich links) als Zeilenliste RGB.'''
    split = m.ram[0xc005]
    img, sr = render_text(m, split)
    cols = [cx for cy in range(25) for cx in range(40) if m.ram[0x8000 + cy * 40 + cx]]
    ncols = ncols or (max(cols) + 1)
    return [r[:ncols * 8 * 3] for r in img], ncols * 8

if __name__ == '__main__':
    base = open('../analysis/game_memory.bin', 'rb').read()
    os.makedirs('../analysis/gfx', exist_ok=True)
    for ent in [0xc15b, 0xc16d, 0xc17f, 0xc191, 0xc1d1, 0xc211, 0xc28a, 0xc359, 0xc578, 0xc755, 0xc7d9, 0xcc97, 0xcccA, 0xcdbc]:
        m, st, n = run_scene(base, ent)
        ch = sum(1 for a in range(0xa000, 0xbf40) if m.ram[a] != base[a])
        print('%04x %-8s steps=%-8d bitmap-changed=%d  d020=%s d021=%s' % (ent, st, n, ch, m.io.get(0xd020), m.io.get(0xd021)))
        split = m.ram[0xc005]
        img, sr = render_text(m, split)
        print('   split raster $%02x -> Zeile %d, d016=%s' % (split, sr, m.io.get(0xd016)))
        write_png('../analysis/gfx/scene_%04x.png' % ent, 320, 200, img)
