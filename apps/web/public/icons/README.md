# PWA Icons

This directory should contain the following icon files for PWA support:

## Required Icons

### Standard Icons (PNG)
- `icon-72x72.png` - 72x72 pixels
- `icon-96x96.png` - 96x96 pixels
- `icon-128x128.png` - 128x128 pixels
- `icon-144x144.png` - 144x144 pixels
- `icon-152x152.png` - 152x152 pixels
- `icon-167x167.png` - 167x167 pixels (iPad Pro)
- `icon-180x180.png` - 180x180 pixels (iPhone)
- `icon-192x192.png` - 192x192 pixels
- `icon-384x384.png` - 384x384 pixels
- `icon-512x512.png` - 512x512 pixels

### Maskable Icons
- `icon-maskable-192x192.png` - 192x192 pixels with safe zone
- `icon-maskable-512x512.png` - 512x512 pixels with safe zone

### Favicons
- `favicon-16x16.png` - 16x16 pixels
- `favicon-32x32.png` - 32x32 pixels

### Safari
- `safari-pinned-tab.svg` - SVG for Safari pinned tab

### Microsoft Tiles
- `mstile-70x70.png` - 70x70 pixels
- `mstile-150x150.png` - 150x150 pixels
- `mstile-310x150.png` - 310x150 pixels (wide)
- `mstile-310x310.png` - 310x310 pixels

### Shortcuts
- `shortcut-merge.png` - 96x96 pixels
- `shortcut-split.png` - 96x96 pixels
- `shortcut-compress.png` - 96x96 pixels

### Badge
- `badge-72x72.png` - 72x72 pixels (for notifications)

## Icon Design Guidelines

1. **Main Icon**: Red heart with PDF document
2. **Background**: White or transparent
3. **Primary Color**: #dc2626 (red-600)
4. **Safe Zone**: For maskable icons, keep content within 80% of center

## Generation Tools

You can generate all sizes from a single high-resolution source using:
- [PWA Asset Generator](https://github.com/nicekeyboard/pwa-asset-generator)
- [RealFaviconGenerator](https://realfavicongenerator.net/)
- [Maskable.app](https://maskable.app/) for testing maskable icons
