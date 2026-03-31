# OpenCrab Brand Assets

Source files:

- `public/opencrab-mark.svg`: square crab mark for avatars, icons, and app badges
- `public/opencrab-logo.svg`: horizontal wordmark for listings, headers, and wider placements

Generated PNG files live in `public/branding/png/`.

White-background PNG files live in `public/branding/png-white/`.

Circular avatar PNG files live in `public/branding/png-circle/`.

Regenerate them with:

```bash
npm run brand:png
```

The generated PNGs keep the SVG transparency, so they work well on light and dark backgrounds.

The white-background PNGs are flattened onto a solid white canvas for platforms that do not handle transparency well.

The circular avatar PNGs use a white circular badge with transparent outer corners, which works well for profile images and app listings that should read as round instead of square.
