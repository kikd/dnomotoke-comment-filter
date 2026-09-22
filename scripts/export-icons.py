"""Export store/extension sizes from the approved, opaque-interior PNG (requires Pillow)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'assets/comment-filter-icon-v2.png'
image = Image.open(source).convert('RGBA')
assert image.width == image.height
icons = root / 'assets/icons'
icons.mkdir(parents=True, exist_ok=True)
for size in (16, 32, 48, 64, 96, 128):
    target = icons / f'icon-{size}.png'
    image.resize((size, size), Image.Resampling.LANCZOS).save(target)
store = root / 'store-assets'
store.mkdir(parents=True, exist_ok=True)
for size in (128, 300):
    image.resize((size, size), Image.Resampling.LANCZOS).save(store / f'icon-{size}.png')
print('Exported 6 extension icons and 2 store icons')
