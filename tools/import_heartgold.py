#!/usr/bin/env python3
"""Create a private, offline Neuborkia asset pack from a German HeartGold ROM.
Usage: python tools/import_heartgold.py ROM.nds-or.zip OUTPUT.pwf.zip
Requires Python 3, Pillow, NumPy. Never commits or uploads game data.
"""
import argparse,gzip,hashlib,io,json,pathlib,struct,zipfile
import numpy as np
from PIL import Image
from hg_rom import Rom,U16,U32
from hg_nitro import Textures,model,i32

W=H=1152;OX=576;OY=640;SCALE=2

def png(pixels):
 out=io.BytesIO();Image.fromarray(pixels).save(out,format='PNG');return out.getvalue()

def project(v):return np.c_[OX+v[:,0]*SCALE,OY+(.8*v[:,2]-.6*v[:,1])*SCALE,.6*v[:,2]+.8*v[:,1]]

def render(parts):
 pixels=np.zeros((H,W,4),dtype=np.uint8);pixels[:]=[38,72,48,255];depth=np.full((H,W),-500.,dtype=np.float32)
 for mat,verts,tris,texture in parts:
  projected=project(verts[:,:3]);tm=mat['uv'];uv=verts[:,3:5]@np.array([[tm[0],tm[1]],[tm[2],tm[3]]])+tm[4:6]
  for tri in tris:
   a,b,c=projected[tri];lo=np.maximum(0,np.floor(np.minimum(np.minimum(a[:2],b[:2]),c[:2])).astype(int));hi=np.minimum([W-1,H-1],np.ceil(np.maximum(np.maximum(a[:2],b[:2]),c[:2])).astype(int))
   if np.any(lo>hi):continue
   den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
   if abs(den)<1e-6:continue
   yy,xx=np.mgrid[lo[1]:hi[1]+1,lo[0]:hi[0]+1];xx=xx+.5;yy=yy+.5
   wa=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den;wb=((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/den;wc=1-wa-wb
   z=wa*a[2]+wb*b[2]+wc*c[2];sub=depth[lo[1]:hi[1]+1,lo[0]:hi[0]+1];mask=(wa>=-1e-6)&(wb>=-1e-6)&(wc>=-1e-6)&(z>=sub-.001)
   if not mask.any():continue
   if texture is not None:
    u=wa*uv[tri[0],0]+wb*uv[tri[1],0]+wc*uv[tri[2],0];v=wa*uv[tri[0],1]+wb*uv[tri[1],1]+wc*uv[tri[2],1];th,tw=texture.shape[:2]
    coords=[]
    for value,size,repeat,flip in [(u,tw,16,18),(v,th,17,19)]:
     if mat['wrap']&(1<<repeat):
      if mat['wrap']&(1<<flip):value=1-np.abs((value%2)-1)
      else:value=value%1
     coords.append(np.clip(np.floor(value*size).astype(int),0,size-1))
    rgba=texture[coords[1],coords[0]].copy()
   else:
    rgba=np.full((*wa.shape,4),255,dtype=np.uint8)
   mask&=rgba[:,:,3]*mat['alpha']>100
   shade=wa[:,:,None]*verts[tri[0],5:8]+wb[:,:,None]*verts[tri[1],5:8]+wc[:,:,None]*verts[tri[2],5:8]
   rgba[:,:,:3]=np.clip(rgba[:,:,:3]*shade,0,255).astype(np.uint8)
   pixels[lo[1]:hi[1]+1,lo[0]:hi[0]+1][mask]=rgba[mask];sub[mask]=z[mask]
 return pixels,depth

def build(path,output):
 r=Rom(path)
 if r.data[12:16]!=b'IPKD':raise ValueError('This importer requires German HeartGold (IPKD).')
 land=r.narc('a/0/6/5')[0];terrain_size,props_size,model_size,_=struct.unpack_from('<4I',land)
 extra=U16(land,18);terrain_offset=20+extra;props_offset=terrain_offset+terrain_size;model_offset=props_offset+props_size
 textures=Textures(r.narc('a/0/4/4')[2]);parts=[];buildings=r.narc('a/0/4/0');stats={'props':0,'triangles':0}
 def add(b,translation):
  embedded=Textures(b[:]) if U16(b,14)>1 else None
  for mat,verts,tris in model(b):
   tex=None
   if mat['tex']:
    found=False
    for source in [textures,embedded]:
     if source and mat['tex'] in source.tex and (mat['pal'] is None or mat['pal'] in source.pal):
      tex=source.image(mat['tex'],mat['pal']);found=True;break
    if not found:raise ValueError(f"Texture not found: {mat['tex']}/{mat['pal']}")
   verts=verts.copy();verts[:,:3]+=translation;parts.append((mat,verts,tris,tex));stats['triangles']+=len(tris)
 add(land[model_offset:model_offset+model_size],np.zeros(3))
 for o in range(props_offset,model_offset,48):
  idx=U32(land,o);pos=np.array([i32(land,o+j)/4096 for j in (4,8,12)])
  # New Bark's map props use identity rotation/scale; reject unsupported transforms.
  rot=[i32(land,o+j) for j in (16,20,24)];scale=[i32(land,o+j)/4096 for j in (28,32,36)]
  if any(rot):raise ValueError(f'Rotated prop {idx} is not supported: {rot}')
  if any(v not in (0,1) for v in scale):raise ValueError(f'Scaled prop {idx} is not supported: {scale}')
  add(buildings[idx],pos);stats['props']+=1
 pixels,depth=render(parts)
 attrs=np.frombuffer(land[terrain_offset:terrain_offset+2048],dtype='<u2').reshape(32,32)
 # Bit 15 is the impassable flag; water/ledges are excluded for this walking-only prototype.
 blocked=((attrs&32768)!=0)|np.isin(attrs&255,[0x15,0x16,0x17,0x18,0x19,0x1a,0x1b,0x38,0x39,0x3a,0x3b])
 # Constrain play to this imported map. No loading into neighboring routes or interiors yet.
 blocked[[0,-1],:]=True;blocked[:,[0,-1]]=True
 spawn=[23,13]
 assert not blocked[spawn[1],spawn[0]],'Spawn is blocked'
 collision=[''.join('1' if cell else '0' for cell in row) for row in blocked]
 trainers=[];sheets={};mmodel=r.narc('a/0/8/1')
 for ident,name,role in [(69,'Klarin','HeartGold'),(70,'Lyra','HeartGold'),(58,'Silber','Rivale'),(49,'Camper','Trainer'),(50,'Picknickerin','Trainer'),(146,'Falk','Arenaleiter'),(147,'Kai','Arenaleiter'),(153,'Sandra','Arenaleiter')]:
  t=Textures(mmodel[ident]);frames={int(key.rsplit('.',1)[1]):t.image(key) for key in t.tex}
  if not all(i in frames for i in range(1,17)):raise ValueError(f'Incomplete walking frames: {name}')
  sheet=Image.new('RGBA',(128,128))
  # Down, up, left, right; four distinct animation frames in each row.
  for row,start in enumerate([5,1,9,13]):
   for frame in range(4):sheet.paste(Image.fromarray(frames[start+frame]),(frame*32,row*32))
  filename=f'trainer_{ident}.png';sheets[filename]=png(np.array(sheet));trainers.append(dict(id=ident,name=name,role=role,file=filename))
 manifest=dict(format='pwf-heartgold-town',version=1,gameCode='IPKD',romSha256=hashlib.sha256(r.data).hexdigest(),map='Neuborkia',mapId=60,landId=0,worldOrigin=[672,384],spawn=spawn,tileSize=16,groundY=16,imageWidth=W,imageHeight=H,origin=[OX,OY],pixelsPerUnit=SCALE,projection=[.8,.6],collision=collision,trainers=trainers,stats=stats)
 output=pathlib.Path(output);output.parent.mkdir(parents=True,exist_ok=True)
 with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False));z.writestr('neuborkia.png',png(pixels));z.writestr('depth.bin',np.clip(np.round(depth*64+32768),0,65535).astype('<u2').tobytes())
  for k,v in sheets.items():z.writestr(k,v)
 Image.fromarray(pixels).save(output.parent/'neuborkia-preview.png')
 print(json.dumps(dict(output=str(output),**stats,trainers=len(trainers),walkable=int((~blocked).sum()),spawn=spawn)))
if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('rom');p.add_argument('output');a=p.parse_args();build(a.rom,a.output)
