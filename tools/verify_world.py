"""Validate a generated private world before packaging. No ROM test fixtures required."""
import argparse,json,pathlib,struct
from PIL import Image

def verify(directory):
 root=pathlib.Path(directory);w=json.loads((root/'world.json').read_text());d=json.loads((root/'data.json').read_text())
 assert w['format']=='pwf-heartgold-world' and w['version']==3
 assert len(d['species'])==494 and len(d['moves'])==468 and len(d['items'])==537
 assert len(d['gyms'])==16 and len(d['avatars'])>=100
 for s in d['species'][1:]:
  assert all(0<=n<=255 for n in s['stats']) and len(s['stats'])==6
  assert all(0<move<len(d['moves']) for _,move in s['learn'])
  assert all(0<target<494 for _,_,target in s['evolutions'])
  for side in ['front','back']:
   with Image.open(root/f"pokemon/{s['id']}_{side}.png") as im:assert im.size==(80,80) and im.mode=='RGBA'
 for avatar in d['avatars']:
  with Image.open(root/f"trainers/{avatar['id']}.png") as im:assert im.size==(128,128)
 for key,job in w['jobs'].items():
  assert not job.get('error'),(key,job.get('error'))
  assert len(job['collision'])==32 and all(len(r)==32 and set(r)<=set('01') for r in job['collision'])
  assert len(job['heights'])==32 and all(len(row)==32 for row in job['heights'])
  with Image.open(root/f'maps/{key}.png') as im:assert im.size==(1152,1152)
  assert (root/f'maps/{key}.depth').stat().st_size==1152*1152*2
 for cell in w['cells'].values():assert str(cell['header']) in w['headers'] and cell['asset'] in w['jobs']
 for gym in d['gyms']:
  t=d['trainers'][gym['trainer']];assert 1<=len(t['party'])<=6
  for p in t['party']:assert 1<=p['species']<=493 and 1<=p['level']<=100
 start=w['start'];cell=w['cells'][start['map']];assert w['jobs'][cell['asset']]['collision'][start['y']][start['x']]=='0'
 result=dict(cells=len(w['cells']),renderedAssets=len(w['jobs']),species=493,moves=467,itemEntries=537,avatars=len(d['avatars']),gyms=16,errors=0)
 print(json.dumps(result));return result
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('directory');a=p.parse_args();verify(a.directory)
