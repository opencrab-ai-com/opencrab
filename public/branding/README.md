# OpenCrab Brand Assets

Source files:

- `public/opencrab-mark.svg`: square crab mark for avatars, icons, and app badges
- `public/opencrab-logo.svg`: horizontal wordmark for listings, headers, and wider placements

Generated PNG files live in `public/branding/png/`.

White-background PNG files live in `public/branding/png-white/`.

White rounded-rectangle PNG files live in `public/branding/png-white-rounded/`.

Circular avatar PNG files live in `public/branding/png-circle/`.

Desktop app icon source files live in `public/branding/png-app/`.

Regenerate them with:

```bash
npm run brand:png
```

The generated PNGs keep the SVG transparency, so they work well on light and dark backgrounds.

The white-background PNGs are flattened onto a solid white canvas for platforms that do not handle transparency well.

The rounded white-background PNGs shrink the crab mark slightly and add more breathing room, which works better for badges, download cards, and app listings.

The circular avatar PNGs use a white circular badge with transparent outer corners, which works well for profile images and app listings that should read as round instead of square.

The desktop app icon source is generated separately with an even smaller mark ratio so the macOS Dock and Finder icon do not feel oversized next to other apps.
