#!/usr/bin/env python3
"""Import the complete HeartGold map/table archives for the free-roam app.
Usage: python tools/import_world.py ROM.zip OUTPUT_DIRECTORY [--prepare-only]
The output contains private game assets; never commit it to a public repository.
"""
import argparse,collections,hashlib,json,math,pathlib,struct,zipfile,time,traceback
import numpy as np
from PIL import Image
from hg_rom import Rom,U16,U32
from hg_nitro import Textures,model,i32
from hg_data import INDEX,export_data,battle_image
from import_heartgold import render,png

def matrix(b):
 w,h,has_alt,has_header,n=b[:5];o=5+n;N=w*h
 first=list(struct.unpack_from(f'<{N}H',b,o));o+=N*2
 alt=list(b[o:o+N]) if has_alt else [0]*N
 if has_alt:o+=N
 lands=list(struct.unpack_from(f'<{N}H',b,o)) if has_header else first
 return dict(width=w,height=h,headers=first if has_header else None,lands=lands,alt=alt)

def events(b):
 o=0;bg=[];npc=[];warps=[]
 n=U32(b,o);o+=4
 for _ in range(n):bg.append(list(struct.unpack_from('<HHiiiH',b,o)));o+=20
 n=U32(b,o);o+=4
 for _ in range(n):npc.append(list(struct.unpack_from('<12H2Hi',b,o)));o+=32
 n=U32(b,o);o+=4
 for _ in range(n):warps.append(list(struct.unpack_from('<4HI',b,o)));o+=12
 return dict(warps=warps,npcs=npc,signs=bg)

def build(rompath,outpath,prepare_only=False):
 out=pathlib.Path(outpath);out.mkdir(parents=True,exist_ok=True)
 for p in ['maps','trainers','pokemon']:(out/p).mkdir(exist_ok=True)
 previous=json.loads((out/'world.json').read_text()).get('jobs',{}) if (out/'world.json').exists() else {}
 r=Rom(rompath);data,places=export_data(r)
 # Extra text and item metadata remain private with the source ROM data.
 msg=r.narc('a/0/2/7');from hg_data import messages
 data['descriptions']=messages(msg[803]);data['itemDescriptions']=messages(msg[221])
 items=r.narc('a/0/1/7')

 # Human overworld models with complete four-direction animations.
 trainer_names={69:'Klarin',70:'Lyra',58:'Silber',49:'Camper',50:'Picknickerin',146:'Falk',147:'Kai',148:'Bianka',149:'Jens',150:'Hartwig',151:'Jasmin',152:'Norbert',153:'Sandra',162:'Rocko',163:'Misty',164:'Major Bob',165:'Erika',166:'Janina',167:'Sabrina',168:'Pyro',169:'Blau',34:'Gentleman'}
 trainers=[]
 for ident,b in enumerate(r.narc('a/0/8/1')[:207]):
  try:
   t=Textures(b);keys=list(t.tex);name=keys[0].rsplit('.',1)[0]
   if any(s in name for s in ['cycle','swim','water','fishinghero','ladder','pokehero','savehero','banzai','tsure','rock','tree','monstar','statue','shake']):continue
   frames={int(k.rsplit('.',1)[1]):t.image(k) for k in keys}
   if not all(i in frames for i in range(1,17)) or any(frames[i].shape!=(32,32,4) for i in range(1,17)):continue
   sheet=Image.new('RGBA',(128,128))
   for row,start in enumerate([5,1,9,13]):
    for frame in range(4):sheet.paste(Image.fromarray(frames[start+frame]),(frame*32,row*32))
   sheet.save(out/f'trainers/{ident}.png');trainers.append(dict(id=ident,name=trainer_names.get(ident,name.replace('_',' ').title())))
  except (ValueError,AssertionError,IndexError):continue
 trainers.sort(key=lambda x:(x['id'] not in trainer_names,list(trainer_names).index(x['id']) if x['id'] in trainer_names else x['id']))
 pics=r.narc('a/0/0/4');other=r.narc('a/1/1/4')
 special={201:(8,160,False),351:(64,162,True),386:(0,158,False),412:(72,170,False),413:(78,176,False),421:(92,190,True),422:(84,182,True),423:(88,186,True),493:(96,194,False),492:(134,232,False),479:(138,236,False),487:(150,248,False),172:(154,252,False)}
 for sid in range(1,494):
  for side,offset in [('front',3),('back',1)]:
   path=out/f'pokemon/{sid}_{side}.png'
   if not path.exists():
    facing=2 if side=='front' else 0
    if sid in special:
     base,pal,direct=special[sid];delta=(facing*2 if sid==351 else facing) if direct else facing//2;nc=other[base+delta];pl=other[pal]
    else:
     nc=pics[sid*6+offset];pl=pics[sid*6+4]
     if len(nc)<48:nc=pics[sid*6+offset-1]
    Image.fromarray(battle_image(nc,pl)).save(path)
 data['avatars']=trainers;data['tmMoves']=INDEX['tmMoves']
 # Actual original leaders and teams; all 16 are available independently.
 gym_ids=[20,21,30,31,34,33,32,35,253,254,255,256,257,258,259,261]
 badges=['Flügelorden','Insektorden','Basisorden','Phantomorden','Faustorden','Stahlorden','Eisorden','Drachenorden','Felsorden','Quellorden','Donnerorden','Farborden','Sumpforden','Sumpforden (Sabrina)','Vulkanorden','Erdorden']
 # Sabrina's badge is the Marsh Badge; Janine awards the Soul Badge.
 badges[12]='Seelenorden';badges[13]='Sumpforden'
 towns=['VIOLET','AZALEA','GOLDENROD','ECRUTEAK','CIANWOOD','OLIVINE','MAHOGANY','BLACKTHORN','PEWTER','CERULEAN','VERMILION','CELADON','FUCHSIA','SAFFRON','SEAFOAM','VIRIDIAN']
 data['gyms']=[dict(id=i,trainer=tid,badge=badges[i],town=towns[i],region='Johto' if i<8 else 'Kanto') for i,tid in enumerate(gym_ids)]
 (out/'data.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
 ev=r.narc('a/0/3/2');areas=r.narc('a/0/4/2');matrices=r.narc('a/0/4/1');headers={h['id']:dict(h) for h in INDEX['headers']};world={};jobs={}
 for hid,h in headers.items():
  h.update(events(ev[h['eventsBank']]));area=h['mapsec'];h['name']=places[area] if isinstance(area,int) and area<len(places) else h['key'].replace('MAP_','').replace('_',' ').title()
  h['region']='Kanto' if h['regionNo']=='MAP_REGION_KANTO' else 'Johto';h['cells']=[]
 for hid,h in headers.items():
  mid=h['matrixId'];m=matrix(matrices[mid]);w=m['width']
  for j,land in enumerate(m['lands']):
   if land==65535:continue
   owner=m['headers'][j] if m['headers'] else hid
   if mid==0 and owner==0:continue
   owner=owner if owner in headers else hid;mh=headers[owner];key=f'{mid}_{j%w}_{j//w}'
   if key not in world:
    ar=areas[mh['areaDataBank']];tex=U16(ar,2);room=mh['mapType']=='MAP_TYPE_INTERIOR';asset=f'{land}_{tex}_{int(room)}'
    b=r.narc('a/0/6/5')[land] if False else None
    world[key]=dict(key=key,matrix=mid,x=j%w,y=j//w,header=owner,land=land,texture=tex,room=room,asset=asset,alt=m['alt'][j])
    jobs[asset]=dict(land=land,texture=tex,room=room)
   if owner==hid or not m['headers']:h['cells'].append(key)
 # Header aliases sharing a matrix still need destinations for warp anchors.
 for h in headers.values():
  if not h['cells'] and h['matrixId']!=0:h['cells']=[k for k,v in world.items() if v['matrix']==h['matrixId']]
 lands=r.narc('a/0/6/5')
 for asset,job in jobs.items():
  b=lands[job['land']];o=20+U16(b,18);a=np.frombuffer(b[o:o+2048],dtype='<u2').reshape(32,32)
  if asset in previous and 'heights' in previous[asset]:job['heights']=previous[asset]['heights']
  job['attributes']=a.tolist();job['collision']=[''.join('1' if v&32768 else '0' for v in row) for row in a]
 manifest=dict(format='pwf-heartgold-world',version=3,romSha256=hashlib.sha256(r.data).hexdigest(),headers=headers,cells=world,jobs=jobs,start=dict(map='0_21_12',x=23,y=13),imageSize=1152,origin=[576,640],freeRoam=True)
 (out/'world.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 print(json.dumps(dict(stage='prepared',cells=len(world),assets=len(jobs),headers=len(headers),avatars=len(trainers),species=493)),flush=True)
 if prepare_only:return
 textures=[Textures(b) for b in r.narc('a/0/4/4')];field=r.narc('a/0/4/0');rooms=r.narc('fielddata/build_model/bm_room.narc');failures={};cache={}
 def add_model(b,texture,translation,rot=None,scale=None):
  # Parsing is cached; all transforms are applied to copies.
  key=hashlib.sha1(b).digest()
  if key not in cache:cache[key]=(model(b),Textures(b) if U16(b,14)>1 else None)
  shapes,embedded=cache[key];parts=[]
  for mat,v,tris in shapes:
   image=None
   if mat['tex']:
    for source in [texture,embedded]+textures:
     if source and mat['tex'] in source.tex and (mat['pal'] is None or mat['pal'] in source.pal):image=source.image(mat['tex'],mat['pal']);break
    if image is None:raise ValueError(f"missing texture {mat['tex']}/{mat['pal']}")
   v=v.copy()
   if scale is not None:v[:,:3]*=scale
   if rot is not None:
    for axis,angle in enumerate(rot):
     if angle:
      c=math.cos(angle);s=math.sin(angle);a,b=[q for q in range(3) if q!=axis];R=np.eye(3);R[a,a]=R[b,b]=c;R[a,b]=-s;R[b,a]=s;v[:,:3]=v[:,:3]@R.T
   v[:,:3]+=translation;parts.append((mat,v,tris,image))
  return parts
 for i,(asset,job) in enumerate(jobs.items()):
  image_path=out/f'maps/{asset}.png';depth_path=out/f'maps/{asset}.depth'
  if image_path.exists() and depth_path.exists():continue
  try:
   b=lands[job['land']];terrain,props,msize,_=struct.unpack_from('<4I',b);po=20+U16(b,18)+terrain;mo=po+props;tex=textures[job['texture']]
   parts=add_model(b[mo:mo+msize],tex,np.zeros(3));ground=parts[:]
   for o in range(po,mo,48):
    idx=U32(b,o);pos=np.array([i32(b,o+j)/4096 for j in (4,8,12)]);rot=[i32(b,o+j)*math.pi/180/4096 for j in (16,20,24)];sc=np.array([i32(b,o+j)/4096 for j in (28,32,36)]);sc[sc==0]=1
    bank=rooms if job['room'] else field
    if idx>=len(bank):raise ValueError(f'model {idx} exceeds bank')
    parts+=add_model(bank[idx],tex,pos,rot,sc)
   pix,depth=render(parts);Image.fromarray(pix).save(image_path);depth_path.write_bytes(np.clip(np.round(depth*64+32768),0,65535).astype('<u2').tobytes())
   # Per-tile walking elevation from the map mesh, excluding buildings/props.
   heights=np.full((32,32),16.,dtype=np.float32)
   yy,xx=np.mgrid[0:32,0:32];wx=xx*16-248;wz=yy*16-248;best=np.full((32,32),1e9)
   for _,v,tris,_ in ground:
    for tri in tris:
     a,c,d=v[tri,:3];den=(c[0]-a[0])*(d[2]-a[2])-(c[2]-a[2])*(d[0]-a[0])
     if abs(den)<1e-5:continue
     ss=((wx-a[0])*(d[2]-a[2])-(wz-a[2])*(d[0]-a[0]))/den;tt=((c[0]-a[0])*(wz-a[2])-(c[2]-a[2])*(wx-a[0]))/den
     h=a[1]+ss*(c[1]-a[1])+tt*(d[1]-a[1]);dist=np.abs(h-16);valid=(ss>=-1e-5)&(tt>=-1e-5)&(ss+tt<=1.00001)&(dist<best)
     heights[valid]=h[valid];best[valid]=dist[valid]
   job['heights']=np.round(heights,2).tolist()
  except Exception as e:
   failures[asset]=str(e);job['error']=str(e)
  if i%10==0:print(json.dumps(dict(stage='rendering',done=i+1,total=len(jobs),errors=len(failures))),flush=True)
 (out/'world.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':')))
 (out/'import-report.json').write_text(json.dumps(dict(failures=failures,cells=len(world),rendered=len(jobs)-len(failures)),indent=2))
 archive=out.with_suffix('.pwf.zip')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
  for f in out.rglob('*'):
   if f.is_file():z.write(f,f.relative_to(out))
 print(json.dumps(dict(stage='complete',archive=str(archive),failures=failures)),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('rom');p.add_argument('output');p.add_argument('--prepare-only',action='store_true');a=p.parse_args();build(a.rom,a.output,a.prepare_only)
