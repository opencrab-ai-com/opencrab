#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/public/branding/png"
WHITE_OUTPUT_DIR="$ROOT_DIR/public/branding/png-white"
CIRCLE_OUTPUT_DIR="$ROOT_DIR/public/branding/png-circle"
MARK_SOURCE="$ROOT_DIR/public/opencrab-mark.svg"
LOGO_SOURCE="$ROOT_DIR/public/opencrab-logo.svg"

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required to generate PNG assets on macOS." >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$WHITE_OUTPUT_DIR"
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

python3 - "$OUTPUT_DIR" "$WHITE_OUTPUT_DIR" "$CIRCLE_OUTPUT_DIR" <<'PY'
from pathlib import Path
import sys

from PIL import Image, ImageDraw

source_dir = Path(sys.argv[1])
target_dir = Path(sys.argv[2])
circle_dir = Path(sys.argv[3])
target_dir.mkdir(parents=True, exist_ok=True)
circle_dir.mkdir(parents=True, exist_ok=True)

for source_path in sorted(source_dir.glob("*.png")):
    image = Image.open(source_path).convert("RGBA")
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    composed = Image.alpha_composite(background, image).convert("RGB")
    composed.save(target_dir / source_path.name)

for source_path in sorted(source_dir.glob("opencrab-mark-*.png")):
    image = Image.open(source_path).convert("RGBA")
    width, height = image.size
    size = min(width, height)

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
    icon = image.resize((icon_target, icon_target), Image.Resampling.LANCZOS)
    icon_offset = ((size - icon_target) // 2, (size - icon_target) // 2)
    avatar.alpha_composite(icon, icon_offset)

    avatar.save(circle_dir / source_path.name)
PY

cat <<'EOF'
Generated PNG brand assets:
- square mark: 16, 32, 48, 64, 128, 180, 192, 256, 512, 1024
- horizontal logo: 384x128, 768x256, 1152x384, 1200x400, 1536x512
- white-background copies: public/branding/png-white/
- circular avatar copies: public/branding/png-circle/
EOF
