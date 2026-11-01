# Lists the graphics adapters with the LUID that Chromium's --use-adapter-luid=<high>,<low> expects.
#   python -I tools/gpus.py
import ctypes
from ctypes import c_void_p, c_ulong, c_ushort, c_ubyte, c_uint, c_long, c_size_t, c_wchar, POINTER, byref, cast, Structure, WINFUNCTYPE, HRESULT
class GUID(Structure): _fields_ = [('d1', c_ulong), ('d2', c_ushort), ('d3', c_ushort), ('d4', c_ubyte * 8)]
class LUID(Structure): _fields_ = [('LowPart', c_ulong), ('HighPart', c_long)]
class DESC1(Structure): _fields_ = [('Description', c_wchar * 128), ('VendorId', c_uint), ('DeviceId', c_uint), ('SubSysId', c_uint), ('Revision', c_uint), ('DedicatedVideoMemory', c_size_t), ('DedicatedSystemMemory', c_size_t), ('SharedSystemMemory', c_size_t), ('AdapterLuid', LUID), ('Flags', c_uint)]
iid = GUID(0x770aae78, 0xf26f, 0x4dba, (c_ubyte * 8)(0xa8, 0x29, 0x25, 0x3c, 0x83, 0xd1, 0xb3, 0x87))
factory = c_void_p()
hr = ctypes.windll.dxgi.CreateDXGIFactory1(byref(iid), byref(factory)); assert hr == 0, hex(hr & 0xffffffff)
def method(obj, idx, *argtypes):
    vtbl = cast(obj, POINTER(c_void_p))[0]
    return WINFUNCTYPE(ctypes.c_long, c_void_p, *argtypes)(cast(vtbl, POINTER(c_void_p))[idx])
enum = method(factory, 12, c_uint, POINTER(c_void_p))   # IDXGIFactory1::EnumAdapters1
i = 0
while True:
    ad = c_void_p()
    if enum(factory, i, byref(ad)) != 0: break   # DXGI_ERROR_NOT_FOUND ends the list
    d = DESC1(); method(ad, 10, POINTER(DESC1))(ad, byref(d))   # IDXGIAdapter1::GetDesc1
    print(f"{d.Description:34} luid {d.AdapterLuid.HighPart},{d.AdapterLuid.LowPart}   dedicated {d.DedicatedVideoMemory // 2**20} MB{'   (software)' if d.Flags & 2 else ''}")
    i += 1
