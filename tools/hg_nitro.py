"""Small Nitro model/texture decoder for the HeartGold town importer.

Format implementation adapted from noclip.website (MIT); see THIRD_PARTY_NOTICES.md.
Only rigid models and the GX commands actually used by this town are accepted.
Unsupported commands fail rather than silently corrupting geometry.
"""
import struct
import numpy as np
from PIL import Image
from hg_rom import U16,U32

def i16(b,o):return struct.unpack_from('<h',b,o)[0]
def i32(b,o):return struct.unpack_from('<i',b,o)[0]
def sign(n,b):return n-(1<<b) if n&(1<<(b-1)) else n

def dictionary(b,o,kind='offset'):
 assert b[o]==0
 count=b[o+1]; e=o+U16(b,o+6);unit=U16(b,e);names=e+U16(b,e+2)
 result=[]
 for j in range(count):
  name=b[names+j*16:names+(j+1)*16].split(b'\0')[0].decode();p=e+4+j*unit
  result.append((name,U32(b,p) if kind=='offset' else b[p:p+unit]))
 return result

def rgb(n):return tuple(((n>>s)&31)*255//31 for s in (0,5,10))
class Textures:
 def __init__(self,b):
  b=b[U32(b,20 if b[:4]==b'BMD0' else 16):];assert b[:4]==b'TEX0';self.b=b
  self.tex=dict(dictionary(b,U16(b,14),'raw'))
  self.pal={name:b[U32(b,56)+U16(v,0)*8:] for name,v in dictionary(b,U16(b,52),'raw')}
 def image(self,name,palette=None):
  b=self.b;w0=U32(self.tex[name],0);fmt=(w0>>26)&7;w=8<<((w0>>20)&7);h=8<<((w0>>23)&7)
  start=(w0&65535)*8;data=b[U32(b,36 if fmt==5 else 20)+start:];idxdata=b[U32(b,40)+start//2:]
  pal=self.pal.get(palette,next(iter(self.pal.values()),b''));pix=np.zeros((h,w,4),dtype=np.uint8)
  if fmt==5:
   k=0
   for y in range(0,h,4):
    for x in range(0,w,4):
     indices=U32(data,k*4);p=U16(idxdata,k*2);k+=1;mode=p>>14;off=(p&16383)*4
     colors=[(*rgb(U16(pal,off+t*2)),255) for t in range(2)]
     if mode==0:colors.extend([(*rgb(U16(pal,off+4)),255),(0,0,0,0)])
     elif mode==1:colors.extend([tuple((a+b)//2 for a,b in zip(*colors)),(0,0,0,0)])
     elif mode==2:colors.extend([(*rgb(U16(pal,off+t*2)),255) for t in (2,3)])
     else:
      a,c=colors;colors.extend([tuple((a[i]*5+c[i]*3)//8 for i in range(4)),tuple((a[i]*3+c[i]*5)//8 for i in range(4))])
     for yy in range(4):
      for xx in range(4):pix[y+yy,x+xx]=colors[indices&3];indices>>=2
  else:
   for k in range(w*h):
    if fmt in (2,3,4):
     bits={2:2,3:4,4:8}[fmt];p=(data[k*bits//8]>>(k*bits%8))&((1<<bits)-1);alpha=0 if p==0 and w0&(1<<29) else 255
    elif fmt in (1,6):
     bits=5 if fmt==1 else 3;p=data[k]&((1<<bits)-1);alpha=(data[k]>>bits)*255//((1<<(8-bits))-1)
    elif fmt==7:
     c=U16(data,k*2);pix[k//w,k%w]=(*rgb(c),255 if c&32768 else 0);continue
    else:raise ValueError(f'Unsupported texture {fmt}')
    pix[k//w,k%w]=(*rgb(U16(pal,p*2)),alpha)
  return pix

def joint(b):
 flags=U16(b,0);m=np.eye(4);o=4
 if not flags&1:m[:3,3]=[i32(b,o+j*4)/4096 for j in range(3)];o+=12
 if not flags&2:
  if flags&8:
   pivot=(flags>>4)&15;A=i16(b,o)/4096;B=i16(b,o+2)/4096;C=-B if flags&512 else B;D=-A if flags&1024 else A
   flat=np.zeros(9);flat[pivot]=-1 if flags&256 else 1
   inds=[i for i in range(9) if i//3!=pivot//3 and i%3!=pivot%3]
   flat[inds]=[A,B,C,D];m[:3,:3]=flat.reshape(3,3).T;o+=4
  else:m[:3,:3]=np.array([i16(b,2)/4096]+[i16(b,o+j*2)/4096 for j in range(8)]).reshape(3,3).T;o+=16
 if not flags&4:
  scale=np.array([i32(b,o+j*4)/4096 for j in range(3)]);m[:3,:3]*=scale
 return m

def gx(data,scale):
 o=0;pos=np.zeros(3);uv=(0,0);color=(1,1,1);verts=[];tris=[];prim=[];mode=0
 params={0:0,0x14:1,0x20:1,0x21:1,0x22:1,0x23:2,0x24:1,0x25:1,0x26:1,0x27:1,0x28:1,0x30:1,0x40:1,0x41:0}
 while o<len(data):
  cmds=data[o:o+4];o+=4
  for cmd in cmds:
   if cmd not in params:raise ValueError(f'Unsupported GX command {cmd:02x}')
   n=params[cmd];p=U32(data,o) if n else 0;o+=4*n
   if cmd==0x20:color=tuple(c/255 for c in rgb(p))
   elif cmd==0x21:
    normal=np.array([sign((p>>s)&1023,10)/512 for s in (0,10,20)])
    # Diffuse daylight; keep original palette colors readable.
    light=np.array([-.25,.9,.35]);shade=.68+.32*max(0,float(normal@light));color=(shade,)*3
   elif cmd==0x22:uv=(sign(p&65535,16)/16,sign(p>>16,16)/16)
   elif cmd==0x40:mode=p&3;prim=[]
   elif cmd in range(0x23,0x29):
    if cmd==0x23:pos=np.array([sign(p&65535,16),sign(p>>16,16),sign(U32(data,o-4)&65535,16)])/4096
    elif cmd==0x24:pos=np.array([sign((p>>s)&1023,10) for s in (0,10,20)])/64
    elif cmd==0x28:pos+=np.array([sign((p>>s)&1023,10) for s in (0,10,20)])/4096
    else:
     a,c={0x25:(0,1),0x26:(0,2),0x27:(1,2)}[cmd];pos[a]=sign(p&65535,16)/4096;pos[c]=sign(p>>16,16)/4096
    prim.append(len(verts));verts.append([*(pos*scale),*uv,*color])
    n=len(prim)
    if mode==0 and n%3==0:tris.append(prim[-3:])
    elif mode==1 and n%4==0:
     a,b,c,d=prim[-4:];tris.extend([[a,b,c],[a,c,d]])
    elif mode==2 and n>=3:tris.append(prim[-3:])
    elif mode==3 and n>=4 and n%2==0:
     a,b,c,d=prim[-4:];tris.extend([[a,b,c],[b,d,c]])
 return np.array(verts,dtype=float),np.array(tris,dtype=int)

def model(b):
 assert b[:4]==b'BMD0';s=U32(b,16);entries=dictionary(b,s+8);assert len(entries)==1
 b=b[s+entries[0][1]:];sbc,mat,shp=struct.unpack_from('<3I',b,4);scale=i32(b,28)/4096
 nodes=[joint(b[64+v:]) for _,v in dictionary(b,64)]
 materials=[]
 for name,v in dictionary(b,mat+4):
  p=mat+v;flags=U16(b,p+30);w,h=max(1,U16(b,p+32)),max(1,U16(b,p+34));o=p+44;sx=sy=1.;sin=0.;cos=1.;tx=ty=0.
  if not flags&2:sx=i32(b,o)/4096;sy=i32(b,o+4)/4096;o+=8
  if not flags&4:sin=i16(b,o)/4096;cos=i16(b,o+2)/4096;o+=4
  if not flags&8:tx=i32(b,o)/4096;ty=i32(b,o+4)/4096;o+=8
  materials.append(dict(name=name,tex=None,pal=None,wrap=U32(b,p+20),alpha=((U32(b,p+12)>>16)&31)/31,
   uv=[sx*cos/w,-sy*sin/w,sx*sin/h,sy*cos/h,sx*((-.5*cos)-(.5*sin-.5)-tx),sy*((-.5*cos)+(.5*sin-.5)+ty)+1]))
 for k,off in [('tex',U16(b,mat)),('pal',U16(b,mat+2))]:
  for name,v in dictionary(b,mat+off,'raw'):
   start=mat+U16(v,0)
   for idx in b[start:start+v[2]]:materials[idx][k]=name
 shapes=[]
 for _,v in dictionary(b,shp):
  p=shp+v;start=p+U32(b,p+8);shapes.append(gx(b[start:start+U32(b,p+12)],scale))
 out=[];o=sbc;node=0;material=0
 while o<mat:
  cmd=b[o];o+=1;op=cmd&31;opt=cmd>>5
  if op==0:pass
  elif op==1:break
  elif op==2:node=b[o];o+=2
  elif op==3:o+=1
  elif op==4:material=b[o];o+=1
  elif op==5:
   idx=b[o];o+=1;verts,tri=shapes[idx];verts=verts.copy();verts[:,:3]=(np.c_[verts[:,:3],np.ones(len(verts))]@nodes[node].T)[:,:3];out.append((materials[material],verts,tri))
  elif op==6:o+=3+bool(opt&1)+bool(opt&2)
  elif op in (7,8):o+=1+bool(opt&1)+bool(opt&2)
  elif op==11:pass
  else:raise ValueError(f'Unsupported SBC {op}')
 return out
