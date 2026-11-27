"""Annotate Sentinel-2 frames: crop, upscale, box candidate hulls, add scale bar + caption strip."""
import math
from PIL import Image, ImageDraw, ImageFont

F = "C:/Windows/Fonts/"
def font(sz, bold=False):
    try:
        return ImageFont.truetype(F + ("segoeuib.ttf" if bold else "segoeui.ttf"), sz)
    except OSError:
        return ImageFont.load_default()

ACC = (247, 165, 147)
RED = (255, 84, 84)

def mpp(lat, z):
    return 156543.03392 * math.cos(math.radians(lat)) / (2 ** z)

def make(src, out, crop, lat, z, boxes, title, caption, scale_m, k=2):
    im = Image.open(src).convert("RGB").crop(crop)
    im = im.resize((im.width * k, im.height * k), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    res = mpp(lat, z) / k  # metres per output pixel
    for b in boxes:
        x0, y0, x1, y1 = [(v - o) * k for v, o in zip(b["xy"], (crop[0], crop[1], crop[0], crop[1]))]
        col = b.get("color", ACC)
        pad = 8
        d.rectangle((x0 - pad, y0 - pad, x1 + pad, y1 + pad), outline=col, width=4)
        label = b["label"]
        f = font(22, True)
        tw = d.textlength(label, font=f)
        lx = x0 - pad + b.get("dx", 0)
        ly = y0 - pad - 36 + b.get("dy", 0)
        lx = max(6, min(lx, im.width - tw - 22))
        d.rounded_rectangle((lx, ly, lx + tw + 22, ly + 32), radius=16, fill=col)
        d.text((lx + 11, ly + 2), label, fill=(22, 22, 22), font=f)
    # scale bar
    px = scale_m / res
    bx, by = 28, im.height - 40
    d.rectangle((bx - 10, by - 34, bx + max(px, d.textlength(f"{scale_m} m", font=font(20, True))) + 14, by + 16), fill=(18, 24, 38))
    d.rectangle((bx, by, bx + px, by + 6), fill=(255, 255, 255))
    d.text((bx, by - 30), f"{scale_m} m", fill="white", font=font(20, True))
    # north arrow
    nx, ny = im.width - 46, 34
    d.polygon([(nx, ny - 18), (nx - 12, ny + 14), (nx, ny + 6), (nx + 12, ny + 14)], fill="white", outline=(18, 24, 38))
    d.text((nx - 7, ny + 16), "N", fill="white", font=font(20, True))
    # caption strip
    strip = 92
    canvas = Image.new("RGB", (im.width, im.height + strip), (243, 244, 242))
    canvas.paste(im, (0, 0))
    c = ImageDraw.Draw(canvas)
    c.text((22, im.height + 12), title, fill=(22, 22, 22), font=font(24, True))
    c.text((22, im.height + 50), caption, fill=(91, 95, 102), font=font(19))
    canvas.save(out, optimize=True)
    print(out, canvas.size, f"{res:.2f} m/px")

if __name__ == "__main__":
    S = "sat/"
    # UNIVERSAL — Ust-Luga liquid-bulk berths, 22 Oct 2026 (z14, 4.82 m/px native)
    make(S + "ustluga/2026-10-22.png", "shots/img_ustluga.png", (620, 120, 1460, 640), 59.70, 14, [
        {"xy": (1103, 260, 1117, 311), "label": "A  ~245 m tanker at berth", "dx": -300},
        {"xy": (1103, 324, 1117, 377), "label": "B  ~255 m tanker at berth", "dx": -300, "dy": 120},
        {"xy": (455, 505, 500, 530), "label": "C  vessels at outer anchorage"},
    ] if False else [
        {"xy": (1103, 260, 1117, 311), "label": "A  ~245 m hull at berth", "dx": -330, "dy": 30},
        {"xy": (1103, 324, 1117, 377), "label": "B  ~255 m hull at berth", "dx": -330, "dy": 95},
        {"xy": (1105, 463, 1117, 494), "label": "C  ~150 m hull", "color": (168, 197, 240), "dx": -230, "dy": 40},
    ], "Ust-Luga liquid-bulk berths, Gulf of Finland  |  Sentinel-2 L2A true colour, 22 Oct 2026",
        "59.70 N, 28.40 E  |  10 m bands, ~2.4 m per pixel after 2x upsampling  |  UNIVERSAL LOA 183 m: no berthed hull matches; vessel not present", 200)

    # THALIA III — Jose terminal approaches, 8 Jan 2026 (z13, 18.5 m/px native)
    make(S + "jose/2026-01-08.png", "shots/img_jose.png", (560, 62, 1440, 640), 10.105, 13, [
        {"xy": (890, 370, 935, 408), "label": "A  hull underway, wake to SW", "dx": -120, "dy": 110},
        {"xy": (972, 284, 996, 330), "label": "B  vessel/SPM cluster offshore José", "dx": -60},
        {"xy": (1180, 80, 1330, 112), "label": "C  ships in outer roads", "color": (168, 197, 240), "dy": -4},
    ], "José (Puerto José) crude terminal approaches, Anzoátegui, Venezuela  |  Sentinel-2 L2A, 8 Jan 2026",
        "10.10 N, 64.86 W  |  hulls are 10-15 px long at 18.5 m/px: large-tanker size class, identity not resolvable", 1000)

    # FENGHUANG — Pengerang terminals jetties, 22 Aug 2026 (z14, 9.55 m/px native)
    make(S + "pengerang/2026-08-22.png", "shots/img_pengerang.png", (740, 600, 1540, 1000), 1.365, 14, [
        {"xy": (1090, 981, 1118, 990), "label": "A  ~250 m hull at jetty", "dx": -60, "dy": -40},
        {"xy": (1214, 982, 1242, 991), "label": "B  ~240 m hull", "dx": 0, "dy": -100},
        {"xy": (1022, 971, 1041, 978), "label": "C  ~155 m", "color": (168, 197, 240), "dx": -80, "dy": -20},
    ], "Pengerang terminal jetties, Johor, Malaysia  |  Sentinel-2 L2A true colour, 22 Aug 2026",
        "1.36 N, 104.14 E  |  FENGHUANG LOA 248 m: hull A and B fall in the same size class  |  size match only, no identification", 200)
