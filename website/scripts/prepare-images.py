"""Create responsive WebP and JPEG assets. Requires Pillow with WebP support."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
output = root / 'public/images'
output.mkdir(parents=True, exist_ok=True)
for source in sorted((root / 'media-source').glob('*.png')):
    original = Image.open(source).convert('RGB')
    for size in (480, 960, 1600):
        width = min(size, original.width)
        height = round(original.height * width / original.width)
        image = original.resize((width, height), Image.Resampling.LANCZOS)
        image.save(output / f'{source.stem}-{size}.webp', 'WEBP', quality=80, method=6)
        image.save(output / f'{source.stem}-{size}.jpg', 'JPEG', quality=80, optimize=True, progressive=True)
    print(f'{source.stem}: prepared responsive images')
