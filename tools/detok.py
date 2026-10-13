import sys
T="END FOR NEXT DATA INPUT# INPUT DIM READ LET GOTO RUN IF RESTORE GOSUB RETURN REM STOP ON WAIT LOAD SAVE VERIFY DEF POKE PRINT# PRINT CONT LIST CLR CMD SYS OPEN CLOSE GET NEW TAB( TO FN SPC( THEN NOT STEP + - * / ^ AND OR > = < SGN INT ABS USR FRE POS SQR RND LOG EXP COS SIN TAN ATN PEEK LEN STR$ VAL ASC CHR$ LEFT$ RIGHT$ MID$ GO".split()
d=open(sys.argv[1],'rb').read()[2:]
p=0
while True:
    nxt=d[p]|d[p+1]<<8
    if not nxt: break
    ln=d[p+2]|d[p+3]<<8
    i=p+4;s='';q=False
    while d[i]:
        c=d[i]
        if c==34:q=not q
        if c>=0x80 and not q:
            s+=(T[c-0x80] if c-0x80<len(T) else '{%02x}'%c)+(' ' if False else '')
        elif c>=0x80: s+='{%02x}'%c
        else: s+=chr(c) if c>=32 else '{%02x}'%c
        i+=1
    print(ln,s)
    p=i+1
