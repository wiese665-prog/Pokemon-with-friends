"""Copyright-free synthetic pack for the Android host integration test."""
import io,json,pathlib,zipfile
from PIL import Image
out=pathlib.Path('app/src/androidTest/assets/synthetic.pwf.zip');out.parent.mkdir(parents=True,exist_ok=True)
def png(size,color):
 b=io.BytesIO();Image.new('RGBA',size,color).save(b,format='PNG');return b.getvalue()
sp=[None]+[dict(id=i,name='Testmon '+str(i),stats=[45,49,49,45,65,65],types=[12,12],catch=255,yieldExp=60,evs=[0]*6,growth=0,abilities=[0,0],learn=[[1,1]],evolutions=[],tm=[]) for i in range(1,494)]
moves=[None,dict(id=1,name='Testattacke',effect='HIT',category=0,power=35,type=0,accuracy=100,pp=20,chance=0,priority=0)]
items=[dict(id=i,name='Testitem '+str(i),price=200,flags=[0]*6,heal=0,pp=0) for i in range(538)]
data=dict(species=sp,moves=moves,items=items,growth=[[i**3 for i in range(101)]],typeChart=[],encounters=[],trainers=[],gyms=[],avatars=[dict(id=69,name='Testtrainer')],descriptions=['']*494,abilities=['Testfähigkeit'])
header=dict(id=60,name='Teststadt',key='MAP_TEST',mapType='MAP_TYPE_CITY_TOWN',region='Johto',matrixId=0,cells=['0_21_12'],warps=[],npcs=[],wildEncounterBank=255)
world=dict(format='pwf-heartgold-world',version=3,headers={'60':header},cells={'0_21_12':dict(matrix=0,x=21,y=12,header=60,asset='test')},jobs={'test':dict(collision=['0'*32]*32,attributes=[[0]*32 for _ in range(32)],heights=[[16]*32 for _ in range(32)])},start=dict(map='0_21_12',x=23,y=13))
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('world.json',json.dumps(world));z.writestr('data.json',json.dumps(data));z.writestr('maps/test.png',png((1152,1152),(80,130,80,255)));z.writestr('maps/test.depth',b'\0'*1152*1152*2);z.writestr('trainers/69.png',png((128,128),(220,190,80,255)))
 for side in ['front','back']:z.writestr('pokemon/152_'+side+'.png',png((80,80),(140,180,90,255)))
print(out)
