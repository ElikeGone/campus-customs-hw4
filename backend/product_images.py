"""Web-ready product photos.

Most catalogue photos were transparent PNGs flattened onto a black background. For the storefront,
the black background is flood-filled to white from the corners, and a thin ring around it is also
whitened to remove the dark edge left by the flattening. Cleaned copies are cached in
backend/.image_cache/. The originals in data/products are never modified. If Pillow isn't
installed, the original photo is served unchanged.
"""

import logging
import re
from pathlib import Path

logger = logging.getLogger("campus_customs.images")

SOURCE_DIR = Path(__file__).resolve().parent.parent / "data" / "products"
CACHE_DIR = Path(__file__).resolve().parent / ".image_cache"
SAFE_NAME = re.compile(r"^[a-z0-9][a-z0-9-]*\.jpg$")

DARK_CORNER = 30  # a corner this dark (max channel) means a flattened black background
FILL_THRESHOLD = 40
FRINGE_PX = 5  # MaxFilter size used to whiten the dark edge ring
MARK = (255, 0, 255)  # temporary fill color, used to find exactly what the flood fill covered


def source_path(filename: str) -> Path | None:
    """The original photo for a request filename, or None for anything unsafe or missing."""
    if not SAFE_NAME.match(filename):
        return None
    path = SOURCE_DIR / filename
    return path if path.is_file() else None


def _clean(source: Path, target: Path) -> None:
    from PIL import Image, ImageChops, ImageDraw, ImageFilter

    im = Image.open(source).convert("RGB")
    w, h = im.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    if not any(max(im.getpixel(xy)) < DARK_CORNER for xy in corners):
        im.save(target, quality=90)  # already on a light background
        return
    for xy in corners:
        if max(im.getpixel(xy)) < DARK_CORNER:
            ImageDraw.floodfill(im, xy, MARK, thresh=FILL_THRESHOLD)
    r, g, b = im.split()
    filled = ImageChops.multiply(
        ImageChops.multiply(r.point(lambda v: 255 if v == 255 else 0), g.point(lambda v: 255 if v == 0 else 0)),
        b.point(lambda v: 255 if v == 255 else 0),
    )
    im.paste((255, 255, 255), mask=filled.filter(ImageFilter.MaxFilter(FRINGE_PX)))
    im.save(target, quality=90)


def warm_cache() -> None:
    """Prepare every cleaned photo ahead of time (run in a background thread at startup), so the
    first shopper to open the Shop page isn't waiting on image processing."""
    for source in sorted(SOURCE_DIR.glob("*.jpg")):
        web_image(source)


def web_image(source: Path) -> Path:
    """Path of the cleaned copy (created on first request), or the original if cleaning fails."""
    target = CACHE_DIR / source.name
    try:
        if not target.exists() or target.stat().st_mtime < source.stat().st_mtime:
            CACHE_DIR.mkdir(exist_ok=True)
            _clean(source, target)
        return target
    except ImportError:
        return source
    except Exception:
        logger.exception("Couldn't clean product image %s", source.name)
        return source
