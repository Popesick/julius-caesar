import sys
names={}
def tbl():
    t={}
    G={0:'ORA AND EOR ADC STA LDA CMP SBC'.split()}
    m1=['(zp,x)','zp','#','abs','(zp),y','zp,x','abs,y','abs,x']
    for i,n in enumerate(G[0]):
        for b,md in enumerate(m1):
            op=i<<5|b<<2|1
            if n=='STA' and md=='#': continue
            t[op]=(n,md)
    m2=['#','zp','A','abs','','zp,x','','abs,x']
    for i,n in enumerate('ASL ROL LSR ROR STX LDX DEC INC'.split()):
        for b,md in enumerate(m2):
            if not md: continue
            op=i<<5|b<<2|2
            if n in('STX','LDX'):
                if md=='zp,x': md='zp,y'
                if md=='abs,x': md='abs,y'
            if n=='STX' and md in('#','A','abs,y'): continue
            if n in('DEC','INC','ASL','ROL','LSR','ROR') and md=='#': continue
            if n in('DEC','INC') and md=='A': continue
            if n=='LDX' and md=='A': continue
            t[op]=(n,md)
    m0=['#','zp','','abs','','zp,x','','abs,x']
    for i,n in enumerate(['','BIT','','','STY','LDY','CPY','CPX']):
        if not n: continue
        for b,md in enumerate(m0):
            if not md: continue
            op=i<<5|b<<2
            if n=='BIT' and md in('#','zp,x','abs,x'): continue
            if n=='STY' and md in('#','abs,x'): continue
            if n=='LDY' and False: pass
            if n in('CPY','CPX') and md in('zp,x','abs,x'): continue
            t[op]=(n,md)
    for i,n in enumerate('BPL BMI BVC BVS BCC BCS BNE BEQ'.split()): t[i<<5|0x10]=(n,'rel')
    for op,n in {0x00:'BRK',0x08:'PHP',0x28:'PLP',0x48:'PHA',0x68:'PLA',0x18:'CLC',0x38:'SEC',0x58:'CLI',0x78:'SEI',0xb8:'CLV',0xd8:'CLD',0xf8:'SED',0xaa:'TAX',0x8a:'TXA',0xa8:'TAY',0x98:'TYA',0xba:'TSX',0x9a:'TXS',0xe8:'INX',0xca:'DEX',0xc8:'INY',0x88:'DEY',0xea:'NOP',0x60:'RTS',0x40:'RTI'}.items(): t[op]=(n,'')
    t[0x20]=('JSR','abs');t[0x4c]=('JMP','abs');t[0x6c]=('JMP','(abs)')
    return t
T=tbl()
def dis(m,a,end,lab=None):
    out=[]
    while a<end:
        op=m[a]
        if op not in T: out.append('%04X  %02X        .byte $%02X'%(a,op,op));a+=1;continue
        n,md=T[op]
        L={'':1,'A':1,'#':2,'zp':2,'zp,x':2,'zp,y':2,'(zp,x)':2,'(zp),y':2,'rel':2}.get(md,3)
        b=m[a:a+L]
        if md=='rel': o=b[1]-256 if b[1]>127 else b[1];arg='$%04X'%(a+2+o)
        elif md=='': arg=''
        elif md=='A': arg='A'
        elif L==2: v='$%02X'%b[1];arg={'#':'#'+v,'zp':v,'zp,x':v+',x','zp,y':v+',y','(zp,x)':'('+v+',x)','(zp),y':'('+v+'),y'}[md]
        else:
            w=b[1]|b[2]<<8;v=('$%04X'%w)
            if lab and w in lab: v=lab[w]
            arg={'abs':v,'abs,x':v+',x','abs,y':v+',y','(abs)':'('+v+')'}[md]
        out.append('%04X  %-8s  %s %s'%(a,' '.join('%02X'%x for x in b),n,arg))
        a+=L
    return out
if __name__=='__main__':
    m=open(sys.argv[1],'rb').read()
    s=int(sys.argv[2],16);e=int(sys.argv[3],16)
    print('\n'.join(dis(m,s,e)))
