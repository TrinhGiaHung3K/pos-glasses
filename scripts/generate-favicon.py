"""Build browser and social metadata imagery for POS GLASSES."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "frontend" / "assets" / "images" / "pos-glasses-favicon.png"
LOCKUP = ROOT / "frontend" / "assets" / "images" / "pos-glasses-optic-bridge-logo.png"
IMAGES = SOURCE.parent
FAVICON = ROOT / "frontend" / "favicon.ico"


def centered_icon(mark, size, *, background=(0, 0, 0, 0), coverage=1.0):
    canvas = Image.new("RGBA", (size, size), background)
    limit = max(1, round(size * coverage))
    fitted = ImageOps.contain(mark, (limit, limit), Image.Resampling.LANCZOS)
    canvas.alpha_composite(fitted, ((size - fitted.width) // 2, (size - fitted.height) // 2))
    return canvas


with Image.open(SOURCE) as source:
    mark = source.convert("RGBA")
    mark.thumbnail((512, 512), Image.Resampling.LANCZOS)

    canvas = centered_icon(mark, 512)
    canvas.save(SOURCE, optimize=True)
    centered_icon(canvas, 32).save(IMAGES / "favicon-32x32.png", optimize=True)
    centered_icon(canvas, 192).save(IMAGES / "favicon-192x192.png", optimize=True)
    centered_icon(canvas, 512).save(IMAGES / "favicon-512x512.png", optimize=True)
    centered_icon(canvas, 180, background=(245, 247, 246, 255), coverage=0.76).convert("RGB").save(
        IMAGES / "apple-touch-icon.png", optimize=True
    )
    centered_icon(canvas, 150, background=(245, 247, 246, 255), coverage=0.74).convert("RGB").save(
        IMAGES / "mstile-150x150.png", optimize=True
    )
    centered_icon(canvas, 512, background=(245, 247, 246, 255), coverage=0.62).convert("RGB").save(
        IMAGES / "favicon-maskable-512x512.png", optimize=True
    )
    canvas.save(
        FAVICON,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )

with Image.open(LOCKUP) as source:
    lockup = source.convert("RGBA")
    alpha_box = lockup.getchannel("A").getbbox()
    if alpha_box:
        lockup = lockup.crop(alpha_box)
    lockup = ImageOps.contain(lockup, (880, 260), Image.Resampling.LANCZOS)

    social = Image.new("RGBA", (1200, 630), (245, 247, 246, 255))
    draw = ImageDraw.Draw(social)
    draw.rectangle((0, 0, 1200, 18), fill=(15, 118, 110, 255))
    draw.rounded_rectangle((72, 72, 1128, 558), radius=40, fill=(255, 255, 255, 255))
    social.alpha_composite(lockup, ((1200 - lockup.width) // 2, (630 - lockup.height) // 2))
    social.convert("RGB").save(IMAGES / "pos-glasses-social-card.png", optimize=True)

print(f"Generated favicon, install icons, and social card from {SOURCE}")
