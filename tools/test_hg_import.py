"""Meaningful format regressions without any copyrighted test fixtures."""
import struct,unittest
import numpy as np
from hg_rom import narc
from hg_nitro import gx

class NitroTests(unittest.TestCase):
 def test_narc_offsets_and_truncation(self):
  fat=b'BTAF'+struct.pack('<IHH4I',28,2,0,0,3,4,8)
  data=b'GMIF'+struct.pack('<I',16)+b'abc\0WXYZ'
  archive=b'NARC'+b'\0'*12+fat+data
  self.assertEqual(narc(archive),[b'abc',b'WXYZ'])
  with self.assertRaises(ValueError):narc(archive[:-1])
 def test_signed_vertex_and_position_scale(self):
  # BEGIN triangles, VTX16 (-1,0,0), VTX16 (0,1,0), VTX16 (0,0,1), END.
  commands=bytes([0x40,0x23,0x23,0x23])+struct.pack('<I',0)
  for v in [(-4096,0,0),(0,4096,0),(0,0,4096)]:commands+=struct.pack('<hhhH',*v,0)
  commands+=bytes([0x41,0,0,0])
  vertices,triangles=gx(commands,16)
  np.testing.assert_allclose(vertices[:,:3],[[-16,0,0],[0,16,0],[0,0,16]])
  np.testing.assert_equal(triangles,[[0,1,2]])
 def test_reject_unknown_geometry(self):
  with self.assertRaises(ValueError):gx(bytes([0xff,0,0,0]),1)
if __name__=='__main__':unittest.main()
