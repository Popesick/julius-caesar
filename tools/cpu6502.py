# minimal NMOS 6502 emulator (documented opcodes) + disassembler
class CPU:
    def __init__(s,mem): s.m=mem;s.a=s.x=s.y=0;s.sp=0xff;s.pc=0;s.c=s.z=s.i=s.d=s.b=s.v=s.n=0;s.cycles=0
    def rd(s,a): return s.m[a&0xffff]
    def wr(s,a,v): s.m[a&0xffff]=v&0xff
    def rd16(s,a): return s.rd(a)|s.rd(a+1)<<8
    def push(s,v): s.wr(0x100+s.sp,v);s.sp=(s.sp-1)&0xff
    def pull(s): s.sp=(s.sp+1)&0xff;return s.rd(0x100+s.sp)
    def sf(s,v): s.z=int((v&0xff)==0);s.n=(v>>7)&1
    def P(s): return s.c|s.z<<1|s.i<<2|s.d<<3|0x30|s.v<<6|s.n<<7
    def setP(s,p): s.c=p&1;s.z=p>>1&1;s.i=p>>2&1;s.d=p>>3&1;s.v=p>>6&1;s.n=p>>7&1
    def ea(s,mode):
        pc=s.pc
        if mode=='imm': s.pc+=1;return pc
        if mode=='zp': s.pc+=1;return s.rd(pc)
        if mode=='zpx': s.pc+=1;return (s.rd(pc)+s.x)&0xff
        if mode=='zpy': s.pc+=1;return (s.rd(pc)+s.y)&0xff
        if mode=='abs': s.pc+=2;return s.rd16(pc)
        if mode=='abx': s.pc+=2;return (s.rd16(pc)+s.x)&0xffff
        if mode=='aby': s.pc+=2;return (s.rd16(pc)+s.y)&0xffff
        if mode=='inx':
            s.pc+=1;z=(s.rd(pc)+s.x)&0xff;return s.rd(z)|s.rd((z+1)&0xff)<<8
        if mode=='iny':
            s.pc+=1;z=s.rd(pc);return ((s.rd(z)|s.rd((z+1)&0xff)<<8)+s.y)&0xffff
    def adc(s,v):
        if s.d:
            lo=(s.a&15)+(v&15)+s.c
            if lo>9: lo+=6
            hi=(s.a>>4)+(v>>4)+(lo>15);r=s.a+v+s.c
            s.z=int((r&0xff)==0)
            s.n=(hi>>3)&1;s.v=int((~(s.a^v)&(s.a^(hi<<4))&0x80)!=0)
            if hi>9: hi+=6
            s.c=int(hi>15);s.a=((hi<<4)|(lo&15))&0xff
        else:
            r=s.a+v+s.c;s.v=int((~(s.a^v)&(s.a^r)&0x80)!=0);s.c=int(r>255);s.a=r&0xff;s.sf(s.a)
    def sbc(s,v):
        if s.d:
            r=s.a-v-(1-s.c);s.v=int(((s.a^v)&(s.a^r)&0x80)!=0);s.z=int((r&0xff)==0);s.n=(r>>7)&1
            lo=(s.a&15)-(v&15)-(1-s.c);hi=(s.a>>4)-(v>>4)
            if lo<0: lo-=6;hi-=1
            if hi<0: hi-=6
            s.c=int(r>=0);s.a=((hi<<4)|(lo&15))&0xff
        else: s.adc(v^0xff)
    def cmp(s,r,v): t=r-v;s.c=int(t>=0);s.sf(t)
    def br(s,cond):
        o=s.rd(s.pc);s.pc+=1
        if cond: s.pc=(s.pc+(o-256 if o>127 else o))&0xffff
    def step(s):
        op=s.rd(s.pc);s.pc+=1
        M={'a':'imm'}
        hi=op>>5;lo=op&31;cc=op&3;bbb=(op>>2)&7
        # special / implied
        if op==0x00: s.pc+=1;s.push(s.pc>>8);s.push(s.pc&255);s.push(s.P());s.i=1;s.pc=s.rd16(0xfffe);return
        if op==0x20: t=s.rd16(s.pc);s.pc+=1;s.push(s.pc>>8);s.push(s.pc&255);s.pc=t;return
        if op==0x4c: s.pc=s.rd16(s.pc);return
        if op==0x6c: a=s.rd16(s.pc);s.pc=s.rd(a)|s.rd((a&0xff00)|((a+1)&0xff))<<8;return
        if op==0x60: l=s.pull();h=s.pull();s.pc=((h<<8|l)+1)&0xffff;return
        if op==0x40: s.setP(s.pull());l=s.pull();h=s.pull();s.pc=h<<8|l;return
        imp={0x08:lambda:s.push(s.P()),0x28:lambda:s.setP(s.pull()),0x48:lambda:s.push(s.a),0x68:lambda:(setattr(s,'a',s.pull()),s.sf(s.a)),
         0x18:lambda:setattr(s,'c',0),0x38:lambda:setattr(s,'c',1),0x58:lambda:setattr(s,'i',0),0x78:lambda:setattr(s,'i',1),
         0xb8:lambda:setattr(s,'v',0),0xd8:lambda:setattr(s,'d',0),0xf8:lambda:setattr(s,'d',1),
         0xaa:lambda:(setattr(s,'x',s.a),s.sf(s.x)),0x8a:lambda:(setattr(s,'a',s.x),s.sf(s.a)),
         0xa8:lambda:(setattr(s,'y',s.a),s.sf(s.y)),0x98:lambda:(setattr(s,'a',s.y),s.sf(s.a)),
         0xba:lambda:(setattr(s,'x',s.sp),s.sf(s.x)),0x9a:lambda:setattr(s,'sp',s.x),
         0xe8:lambda:(setattr(s,'x',(s.x+1)&255),s.sf(s.x)),0xca:lambda:(setattr(s,'x',(s.x-1)&255),s.sf(s.x)),
         0xc8:lambda:(setattr(s,'y',(s.y+1)&255),s.sf(s.y)),0x88:lambda:(setattr(s,'y',(s.y-1)&255),s.sf(s.y)),0xea:lambda:None}
        if op in imp: imp[op]();return
        if lo==0x10:
            cond=[not s.n,s.n,not s.v,s.v,not s.c,s.c,not s.z,s.z][hi];s.br(cond);return
        if cc==1:
            mode=['inx','zp','imm','abs','iny','zpx','aby','abx'][bbb]
            a=s.ea(mode)
            if hi==4:
                s.wr(a,s.a);return
            v=s.rd(a)
            if hi==0: s.a|=v;s.sf(s.a)
            elif hi==1: s.a&=v;s.sf(s.a)
            elif hi==2: s.a^=v;s.sf(s.a)
            elif hi==3: s.adc(v)
            elif hi==5: s.a=v;s.sf(v)
            elif hi==6: s.cmp(s.a,v)
            elif hi==7: s.sbc(v)
            return
        if cc==2:
            if bbb==2 and hi<4: # accumulator shifts
                s.a=s.shift(hi,s.a);return
            mode=['imm','zp','acc','abs','','zpx','','abx'][bbb]
            if hi in(4,5): mode={0:'imm',1:'zp',3:'abs',5:'zpy',7:'aby'}[bbb]
            a=s.ea(mode)
            if hi==4: s.wr(a,s.x);return
            if hi==5: s.x=s.rd(a);s.sf(s.x);return
            v=s.rd(a)
            if hi<4: s.wr(a,s.shift(hi,v));return
            if hi==6: v=(v-1)&255;s.wr(a,v);s.sf(v);return
            if hi==7: v=(v+1)&255;s.wr(a,v);s.sf(v);return
        if cc==0:
            mode=['imm','zp','','abs','','zpx','','abx'][bbb]
            if hi==1: # BIT
                a=s.ea(mode);v=s.rd(a);s.z=int((s.a&v)==0);s.n=v>>7;s.v=(v>>6)&1;return
            if hi==4: a=s.ea(mode if bbb!=7 else 'abx');s.wr(a,s.y);return
            if hi==5:
                a=s.ea(mode);s.y=s.rd(a);s.sf(s.y);return
            if hi in(6,7):
                a=s.ea(mode);v=s.rd(a)
                if hi==6: s.cmp(s.y,v)
                else: s.cmp(s.x,v)
                return
        raise Exception('bad opcode %02x at %04x'%(op,s.pc-1))
    def shift(s,k,v):
        if k==0: c=v>>7;v=(v<<1)&255
        elif k==1: c=v>>7;v=((v<<1)|s.c)&255
        elif k==2: c=v&1;v>>=1
        else: c=v&1;v=(v>>1)|(s.c<<7)
        s.c=c;s.sf(v);return v
