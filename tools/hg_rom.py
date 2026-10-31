"""Read the NitroFS and NARC containers from a user-supplied HeartGold image."""
import pathlib,struct,zipfile

def U16(b,o):return struct.unpack_from('<H',b,o)[0]
def U32(b,o):return struct.unpack_from('<I',b,o)[0]

class Rom:
 def __init__(self,path):
  path=pathlib.Path(path)
  if zipfile.is_zipfile(path):
   with zipfile.ZipFile(path) as z:
    entries=[i for i in z.infolist() if i.filename.lower().endswith('.nds')]
    if len(entries)!=1 or entries[0].file_size!=134217728:raise ValueError('Expected one 128 MiB HeartGold .nds image')
    self.data=z.read(entries[0])
  else:
   if path.stat().st_size!=134217728:raise ValueError('Expected a 128 MiB HeartGold .nds image')
   self.data=path.read_bytes()
  if self.data[12:16]!=b'IPKD':raise ValueError('Expected German HeartGold, game code IPKD')
  fnt,sz,fat,fsz=struct.unpack_from('<4I',self.data,0x40)
  if fnt+sz>len(self.data) or fat+fsz>len(self.data) or fsz%8:raise ValueError('Invalid NitroFS')
  self.fnt=self.data[fnt:fnt+sz];self.fat=[struct.unpack_from('<II',self.data,fat+i) for i in range(0,fsz,8)];self.files={};self.visited=set();self.walk(0xf000,'')
 def walk(self,idx,prefix):
  if idx in self.visited:raise ValueError('Cyclic NitroFS directory')
  self.visited.add(idx)
  off,fid,_=struct.unpack_from('<IHH',self.fnt,(idx-0xf000)*8)
  while self.fnt[off]:
   n=self.fnt[off];off+=1;name=self.fnt[off:off+(n&127)].decode();off+=n&127
   if n&128:self.walk(U16(self.fnt,off),prefix+name+'/');off+=2
   else:
    a,b=self.fat[fid]
    if not 0<=a<=b<=len(self.data):raise ValueError('Invalid NitroFS file bounds')
    self.files[prefix+name]=self.data[a:b];fid+=1
 def narc(self,path):return narc(self.files[path])

def narc(b):
 if b[:4]!=b'NARC':raise ValueError('Expected NARC')
 o=16;entries=None
 while o<len(b):
  tag=b[o:o+4];size=U32(b,o+4)
  if size<8 or o+size>len(b):raise ValueError('Invalid NARC chunk')
  if tag==b'BTAF':entries=[struct.unpack_from('<II',b,o+12+i*8) for i in range(U16(b,o+8))]
  if tag==b'GMIF':
   if entries is None or any(not 0<=a<=z<=size-8 for a,z in entries):raise ValueError('Invalid NARC entries')
   return [b[o+8+a:o+8+z] for a,z in entries]
  o+=size
 raise ValueError('Missing NARC file chunk')
