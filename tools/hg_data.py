"""Decode game tables and pictures from the supplied ROM, not online assets.
Message and scanned-image formats follow pret/pokeheartgold's msgdata.c,
pokepic.c and the MIT-licensed nitrogfx tool (see THIRD_PARTY_NOTICES).
"""
import json,pathlib,struct
import numpy as np
from hg_rom import U16,U32
from hg_nitro import rgb
INDEX=json.loads(pathlib.Path(__file__).with_name('hg_index.json').read_text())

def messages(b):
 count,key=struct.unpack_from('<HH',b);result=[]
 for i in range(count):
  k=(key*765*(i+1))&65535;k|=k<<16;off=U32(b,4+i*8)^k;n=U32(b,8+i*8)^k
  seed=((i+1)*596947)&65535;chars=[]
  for p in range(n):chars.append(U16(b,off+p*2)^seed);seed=(seed+18749)&65535
  if chars and chars[0]==0xf100:
   bits=0;nb=0;unpacked=[]
   for v in chars[1:]:
    bits|=v<<nb;nb+=15
    while nb>=9:
     c=bits&511;bits>>=9;nb-=9
     if c==511:break
     unpacked.append(c)
    else:continue
    break
   chars=unpacked
  result.append(''.join(INDEX['chars'].get(str(v),' ' if v in (0xe000,0xfffe) else '') for v in chars if v!=65535).strip())
 return result

def battle_image(ncgr,nclr):
 data=bytearray(ncgr[48:48+6400]);seed=U16(data,0)
 for o in range(0,len(data),2):
  value=U16(data,o)^seed;struct.pack_into('<H',data,o,value&65535);seed=(seed*1103515245+24691)&0xffffffff
 colors=np.array([(*rgb(U16(nclr,40+i*2)),0 if i==0 else 255) for i in range(16)],dtype=np.uint8)
 v=np.frombuffer(data,dtype=np.uint8);indices=np.empty(12800,dtype=np.uint8);indices[0::2]=v&15;indices[1::2]=v>>4
 return colors[indices.reshape(80,160)[:,:80]]

def export_data(r):
 msg=r.narc('a/0/2/7');names=messages(msg[237]);moves_names=messages(msg[750]);items_names=messages(msg[222]);places=messages(msg[279]);ability_names=messages(msg[720])
 personal=r.narc('a/0/0/2');learn=r.narc('a/0/3/3');evo=r.narc('a/0/3/4');moves=r.narc('a/0/1/1');items=r.narc('a/0/1/7')
 species=[None]
 for i in range(1,494):
  p=personal[i];ls=[]
  for o in range(0,len(learn[i])-1,2):
   v=U16(learn[i],o)
   if v==65535:break
   ls.append([v>>9,v&511])
  evolution=[list(struct.unpack_from('<3H',evo[i],j*6)) for j in range(7) if U16(evo[i],j*6)]
  species.append(dict(id=i,name=names[i],stats=list(p[:6]),types=list(p[6:8]),catch=p[8],yieldExp=p[9],evs=[(U16(p,10)>>(2*j))&3 for j in range(6)],gender=p[16],growth=p[19],abilities=list(p[22:24]),learn=ls,evolutions=evolution,tm=[j for j in range(100) if (p[28+j//8]>>(j%8))&1]))
 move_data=[]
 for i,b in enumerate(moves[:len(moves_names)]):move_data.append(dict(id=i,name=moves_names[i],effect=INDEX['effects'].get(str(U16(b,0)),'HIT'),category=b[2],power=b[3],type=b[4],accuracy=b[5],pp=b[6],chance=b[7],target=U16(b,8),priority=struct.unpack_from('<b',b,10)[0]))
 item_data=[]
 for i in range(len(items_names)):
  file=INDEX['itemFiles'].get(str(i),i if i<len(items) else 0);b=items[file]
  item_data.append(dict(id=i,name=items_names[i],price=U16(b,0),hold=b[2],holdParam=b[3],pocket=(U16(b,8)>>7)&15,flags=list(b[14:20]),heal=b[27] if len(b)>27 else 0,pp=b[28] if len(b)>28 else 0))
 # Levels 0..100, all six growth curves are preserved.
 growth=[list(struct.unpack_from('<101I',b)) for b in r.narc('a/0/0/3')]
 encounters=[]
 for b in r.narc('a/0/3/7'):
  encounters.append(dict(rate=b[0],levels=list(b[8:20]),morning=list(struct.unpack_from('<12H',b,20)),day=list(struct.unpack_from('<12H',b,44)),night=list(struct.unpack_from('<12H',b,68)),surf=[list(struct.unpack_from('<BBH',b,100+i*4)) for i in range(5)],fish=[list(struct.unpack_from('<BBH',b,168+i*4)) for i in range(5)]))
 trainers=[];trdata=r.narc('a/0/5/5');trpoke=r.narc('a/0/5/6');trnames=messages(msg[729])
 for i,b in enumerate(trdata):
  party=[];o=0;t=b[0]
  for _ in range(b[3]):
   p=trpoke[i];level=U16(p,o+2);sid=U16(p,o+4)&1023;o+=6;item=0;ms=[]
   if t&2:item=U16(p,o);o+=2
   if t&1:ms=list(struct.unpack_from('<4H',p,o));o+=8
   o+=2
   if 1<=sid<=493:party.append(dict(species=sid,level=level,item=item,moves=[x for x in ms if x]))
  trainers.append(dict(id=i,name=trnames[i] if i<len(trnames) else f'Trainer {i}',party=party))
 return dict(species=species,moves=move_data,items=item_data,growth=growth,encounters=encounters,trainers=trainers,typeChart=INDEX['chart'],abilities=ability_names),places
