import zlib,struct
def write_png(fn,w,h,rows):  # rows: list of bytes of RGB
    raw=b''.join(b'\x00'+r for r in rows)
    def ch(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(fn,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b''))
PAL=[(0,0,0),(255,255,255),(136,57,50),(103,182,189),(139,63,150),(85,160,73),(64,49,141),(191,206,114),(139,84,41),(87,66,0),(184,105,98),(80,80,80),(120,120,120),(148,224,137),(120,105,196),(159,159,159)]
def hires(mem,bm,w_cells=40,h_cells=25,scr=None,mono=True):
    rows=[]
    for cy in range(h_cells):
        for line in range(8):
            r=bytearray()
            for cx in range(w_cells):
                b=mem[bm+(cy*w_cells+cx)*8+line]
                if scr is not None:
                    s=mem[scr+cy*w_cells+cx];fg=PAL[s>>4];bg=PAL[s&15]
                else: fg=(255,255,255);bg=(0,0,0)
                for bit in range(7,-1,-1):
                    r+=bytes(fg if (b>>bit)&1 else bg)
            rows.append(bytes(r))
    return rows
