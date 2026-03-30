#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/public/branding/png"
WHITE_OUTPUT_DIR="$ROOT_DIR/public/branding/png-white"
WHITE_ROUNDED_OUTPUT_DIR="$ROOT_DIR/public/branding/png-white-rounded"
CIRCLE_OUTPUT_DIR="$ROOT_DIR/public/branding/png-circle"
MARK_SOURCE="$ROOT_DIR/public/opencrab-mark.svg"
LOGO_SOURCE="$ROOT_DIR/public/opencrab-logo.svg"

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required to generate PNG assets on macOS." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$WHITE_OUTPUT_DIR"
mkdir -p "$WHITE_ROUNDED_OUTPUT_DIR"
mkdir -p "$CIRCLE_OUTPUT_DIR"

mark_sizes=(16 32 48 64 128 180 192 256 512 1024)
logo_sizes=(
  "384 128"
  "768 256"
  "1152 384"
  "1200 400"
  "1536 512"
)

for size in "${mark_sizes[@]}"; do
  sips -s format png -z "$size" "$size" "$MARK_SOURCE" \
    --out "$OUTPUT_DIR/opencrab-mark-${size}.png" >/dev/null
done

for pair in "${logo_sizes[@]}"; do
  width="${pair%% *}"
  height="${pair##* }"
  sips -s format png -z "$height" "$width" "$LOGO_SOURCE" \
    --out "$OUTPUT_DIR/opencrab-logo-${width}x${height}.png" >/dev/null
done

python3 - "$OUTPUT_DIR" "$WHITE_OUTPUT_DIR" "$WHITE_ROUNDED_OUTPUT_DIR" "$CIRCLE_OUTPUT_DIR" <<'PY'
from pathlib import Path
import sys

from PIL import Image, ImageDraw

source_dir = Path(sys.argv[1])
target_dir = Path(sys.argv[2])
rounded_dir = Path(sys.argv[3])
circle_dir = Path(sys.argv[4])
target_dir.mkdir(parents=True, exist_ok=True)
rounded_dir.mkdir(parents=True, exist_ok=True)
circle_dir.mkdir(parents=True, exist_ok=True)


def visible_content(image: Image.Image) -> Image.Image:
    alpha_bbox = image.getchannel("A").getbbox()
    if not alpha_bbox:
        return image
    return image.crop(alpha_bbox)

for source_path in sorted(source_dir.glob("*.png")):
    image = Image.open(source_path).convert("RGBA")
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    composed = Image.alpha_composite(background, image).convert("RGB")
    composed.save(target_dir / source_path.name)

    width, height = image.size
    min_side = min(width, height)
    inset = max(1, round(min_side * 0.03))
    radius = max(2, round(min_side * 0.18))

    rounded = Image.new("RGBA", image.size, (0, 0, 0, 0))
    card = Image.new("RGBA", image.size, (0, 0, 0, 0))
    card_draw = ImageDraw.Draw(card)
    card_draw.rounded_rectangle(
        (inset, inset, width - inset, height - inset),
        radius=radius,
        fill=(255, 255, 255, 255),
    )
    rounded = Image.alpha_composite(rounded, card)
    content = visible_content(image)
    content_offset = ((width - content.width) // 2, (height - content.height) // 2)
    rounded.alpha_composite(content, content_offset)
    rounded.save(rounded_dir / source_path.name)

for source_path in sorted(source_dir.glob("opencrab-mark-*.png")):
    image = Image.open(source_path).convert("RGBA")
    width, height = image.size
    size = min(width, height)
    content = visible_content(image)

    avatar = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Oversample the badge mask for smoother circular edges at smaller sizes.
    oversample = 4
    mask = Image.new("L", (size * oversample, size * oversample), 0)
    draw = ImageDraw.Draw(mask)
    inset = int(size * oversample * 0.06)
    draw.ellipse(
        (inset, inset, size * oversample - inset, size * oversample - inset),
        fill=255,
    )
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)

    circle = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    avatar.paste(circle, (0, 0), mask)

    icon_target = max(1, int(size * 0.74))
    scale = min(icon_target / content.width, icon_target / content.height)
    scaled_width = max(1, round(content.width * scale))
    scaled_height = max(1, round(content.height * scale))
    icon = content.resize((scaled_width, scaled_height), Image.Resampling.LANCZOS)
    icon_offset = ((size - scaled_width) // 2, (size - scaled_height) // 2)
    avatar.alpha_composite(icon, icon_offset)

    avatar.save(circle_dir / source_path.name)
PY

cat <<'EOF'
Generated PNG brand assets:
- square mark: 16, 32, 48, 64, 128, 180, 192, 256, 512, 1024
- horizontal logo: 384x128, 768x256, 1152x384, 1200x400, 1536x512
- white-background copies: public/branding/png-white/
- white rounded-rectangle copies: public/branding/png-white-rounded/
- circular avatar copies: public/branding/png-circle/
EOF
