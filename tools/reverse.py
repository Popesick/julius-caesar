#!/usr/bin/env python3
"""Reproduziert die Analyse von Julius Caesar (C64, Kingsoft 1989) aus dem D64-Image.

Aufruf:  python3 reverse.py JULIUS-D.D64 ../analysis

Stufen:
  1. D64 -> PRG-Dateien (Verzeichnis lesen, Sektorketten folgen)
  2. Hauptprogramm: drei geschachtelte Schichten entpacken (im 6502-Emulator)
       a) Stage-1-Relocator + "Bytepress"-Cruncher
       b) Freezer-artiger Block-Mover ($033C) -> zweiter Bytepress-Container
       c) Bytepress erneut -> Originalprogramm, Start $4000
  3. Overlay-Dateien 1.*..4.* mit dem Fastloader-Dekompressor ($9824) entpacken
  4. HP (BASIC) detokenisieren, Stammesdaten als JSON exportieren
"""
import sys, os, re, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cpu6502 import CPU

# ---------- 1. D64 ----------
def spt(t): return 21 if t <= 17 else 19 if t <= 24 else 18 if t <= 30 else 17
def off(t, s): return (sum(spt(i) for i in range(1, t)) + s) * 256

def read_d64(path):
    d = open(path, 'rb').read()
    files = {}
    t, s, seen = 18, 1, set()
    while t and (t, s) not in seen:
        seen.add((t, s)); b = d[off(t, s):off(t, s) + 256]
        for i in range(8):
            e = b[i * 32:(i + 1) * 32]
            if e[2] & 7 == 2:  # PRG
                name = e[5:21].rstrip(b'\xa0 ').decode('latin1')
                data = b''; ft, fs = e[3], e[4]
                while ft:
                    blk = d[off(ft, fs):off(ft, fs) + 256]
                    if blk[0]: data += blk[2:]; ft, fs = blk[0], blk[1]
                    else: data += blk[2:blk[1] + 1]; ft = 0
                files[name] = data
        t, s = b[0], b[1]
    return files

# ---------- 2. Entpacken ----------
def run_until(m, pc, stop, sp=0xf0, limit=60_000_000):
    c = CPU(m); c.pc = pc; c.sp = sp; n = 0
    while c.pc != stop and n < limit: c.step(); n += 1
    return c, n

def bytepress(m):
    """Fuehrt den Bytepress-Entpacker ab $0822 aus bis zum Exit-JMP ausserhalb $0400-$05FF."""
    c = CPU(m); c.pc = 0x822; c.sp = 0xf0; n = 0
    while n < 80_000_000:
        pc = c.pc; op = m[pc]
        if op == 0x4c:
            tgt = m[pc + 1] | m[pc + 2] << 8
            if not (0x400 <= tgt <= 0x5ff) and pc > 0x500: return tgt
        c.step(); n += 1
    raise RuntimeError('Bytepress endete nicht')

def unpack_main(prg):
    m = bytearray(65536)
    m[0x801:0x801 + len(prg) - 2] = prg[2:]
    # Schicht 0: Loader-Stub kopiert 0x48 Bytes von $084B nach $03E0, schiebt Daten
    # von $0893 nach $0803 und springt nach $080B -> $0100-Decruncher.
    for x in range(0x48): m[0x3e0 + x] = m[0x84b + x]
    c = CPU(m); c.pc = 0x3e0; c.sp = 0xff
    while c.pc != 0x100: c.step()
    while c.pc != 0xe3bf: c.step()          # Bytepress fertig, ruft BASIC-Init
    # Schicht 1: Bytepress-Stub bei $0822 (Exit -> $033C: JSR $FF81 / JMP $2A80)
    assert bytepress(m) == 0x33c
    # Schicht 2: der Freezer-Wrapper $2AE6 kopiert das Abbild ab $4030 nach $0801
    m[0x33c:0x33c + 0x90] = m[0x2ae6:0x2ae6 + 0x90]
    c, _ = run_until(m, 0x33c, 0xa659, limit=5_000_000)
    # Schicht 3: derselbe Bytepress-Container nochmals -> Originalprogramm
    assert bytepress(m) == 0x33c
    assert m[0x33f] == 0x4c and (m[0x340] | m[0x341] << 8) == 0x4000
    return m

def fast_load(m, data):
    """Fastloader-Dekompressor ab $9824; ACPTR ($EE13) wird aus 'data' bedient."""
    pos = [0]; c = CPU(m); c.sp = 0xf0; c.pc = 0x9824
    c.push(0x12); c.push(0x33)
    while c.pc != 0x1234:
        if c.pc == 0xee13:
            if pos[0] >= len(data): break
            c.a = data[pos[0]]; pos[0] += 1
            m[0x90] = 0x40 if pos[0] >= len(data) else 0
            l = c.pull(); h = c.pull(); c.pc = ((h << 8 | l) + 1) & 0xffff; continue
        c.step()

def build_game_memory(m, files):
    byprefix = {k[0]: v for k, v in files.items() if k[0] in '1234' and k[1] == '.'}
    fast_load(m, byprefix['1'])
    for i in range(0x80):                    # $41B6: $A000.. -> $D000.. (96-Byte-Zeilen)
        for y in range(0x60): m[0xd000 + i * 0x60 + y] = m[0xa000 + i * 0x60 + y]
    fast_load(m, byprefix['4'])
    fast_load(m, byprefix['2'])
    for y in range(256): m[0xa800 + y] = m[0xa000 + y]; m[0xa900 + y] = m[0xa100 + y]
    fast_load(m, byprefix['3'])
    return m

# ---------- 4. BASIC ----------
TOK = ("END FOR NEXT DATA INPUT# INPUT DIM READ LET GOTO RUN IF RESTORE GOSUB RETURN REM STOP ON WAIT LOAD SAVE "
       "VERIFY DEF POKE PRINT# PRINT CONT LIST CLR CMD SYS OPEN CLOSE GET NEW TAB( TO FN SPC( THEN NOT STEP + - * / ^ "
       "AND OR > = < SGN INT ABS USR FRE POS SQR RND LOG EXP COS SIN TAN ATN PEEK LEN STR$ VAL ASC CHR$ LEFT$ "
       "RIGHT$ MID$ GO").split()

def detokenize(prg):
    d = prg[2:]; p = 0; out = []
    while d[p] | d[p + 1] << 8:
        ln = d[p + 2] | d[p + 3] << 8; i = p + 4; s = ''; q = False
        while d[i]:
            c = d[i]
            if c == 34: q = not q
            if c >= 0x80 and not q: s += TOK[c - 0x80] if c - 0x80 < len(TOK) else '{%02x}' % c
            elif c >= 0x80: s += '{%02x}' % c
            else: s += chr(c) if c >= 32 else '{%02x}' % c
            i += 1
        out.append('%d %s' % (ln, s)); p = i + 1
    return out

def main(d64, outdir):
    os.makedirs(outdir, exist_ok=True)
    files = read_d64(d64)
    for n, v in files.items():
        print('%-18s %6d Bytes  Ladeadresse $%04X' % (n, len(v), v[0] | v[1] << 8))
    m = unpack_main(files['JULIUS CAESAR'])
    open(os.path.join(outdir, 'stage_original_4000.bin'), 'wb').write(bytes(m))
    g = build_game_memory(bytearray(m), files)
    open(os.path.join(outdir, 'game_memory.bin'), 'wb').write(bytes(g))
    bas = detokenize(files['HP'])
    open(os.path.join(outdir, 'hp_basic_listing.txt'), 'w').write('\n'.join(bas) + '\n')
    # Stammesdaten
    tribes = []
    for l in bas:
        mm = re.match(r'\d+ DATA(\w+),(\d+),(\d+),(\d+),(\d+)', l)
        if mm: tribes.append(dict(name=mm[1], gruppe=int(mm[2]), bevoelkerung=int(mm[3]),
                                  haltung=int(mm[4]), kartenindex=int(mm[5])))
    xs = g[0x9743:0x9743 + 31]; ys = g[0x9761:0x9761 + 31]
    byslot = {t['kartenindex']: t for t in tribes}
    # AL(AX): Kartenslot AX -> Stamm Nr. (alphabetisch) ; Koordinaten stehen je Kartenslot
    out = []
    for ax in range(1, 31):
        idx = tribes[ax - 1]['kartenindex']      # AL(ax) = fuenftes DATA-Element der ax-ten Zeile
        t = dict(tribes[idx - 1]); t['id'] = idx; t['slot'] = ax; t['x'] = xs[ax]; t['y'] = ys[ax]
        out.append(t)
    out.sort(key=lambda t: t['id'])
    json.dump(dict(gruppen=['Belger', 'Gallier', 'Aquitaner', 'Volcer'], stamm=out,
                   legionen_start=dict(x=g[0x9700], y=g[0x9704])),
              open(os.path.join(outdir, 'tribes.json'), 'w'), indent=1, ensure_ascii=False)
    print('fertig ->', outdir)

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
