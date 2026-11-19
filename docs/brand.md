# CredWise 360 brand

The identity is a circular **C** with an integrated checkmark, set beside a geometric sans-serif wordmark whose "360" is picked out in green.

## Palette

| Name | Hex | Use |
| --- | --- | --- |
| Primary emerald | `#008638` | Logo and "360" on light backgrounds, PDF headings |
| Dark-mode green | `#00D64F` | Logo and "360" on dark backgrounds |
| Deep charcoal | `#111827` | Wordmark on light backgrounds, PDF header band |
| Warm white | `#FAF9F6` | Light background, application icon tile |

## Files

All assets are transparent, optimized SVGs in [`apps/web/public/brand`](../apps/web/public/brand). The light variants are for light backgrounds and the dark variants for dark ones.

| File | Contents |
| --- | --- |
| `icon-light.svg`, `icon-dark.svg` | Circular C with checkmark |
| `wordmark-light.svg`, `wordmark-dark.svg` | "CredWise 360" |
| `logo-light.svg`, `logo-dark.svg` | Icon and wordmark together (about 4.7 : 1) |
| `png/` | Transparent PNG exports for documentation, plus `social-preview.png` (1200 × 630) |
| `og-image.png` | Open Graph and Twitter preview image |

Favicons and app icons: `app/icon.svg` (switches green with the browser theme), `app/favicon.ico` (16, 32 and 48 px), `app/apple-icon.png` (180 px), `public/icons/icon-192.png`, `icon-512.png` and `icon-maskable-512.png`, listed in the web manifest.

## Using the logo

In the web app use the `Logo` component (`components/logo.tsx`) or `Brand` (`components/brand.tsx`, a home link that wraps it).

```tsx
<Logo variant="full" height={34} />   // 'icon' | 'wordmark' | 'full'
<Brand height={34} responsive />      // icon alone below 430 px
```

Both theme artworks are rendered with explicit dimensions and CSS shows the one matching `data-theme`, so switching themes never reloads an image or moves the layout. Use the icon alone in compact spaces, and the full logo wherever its width fits. Do not stretch, recolour, crop or rearrange the parts, and leave clear space around the mark of at least a quarter of the icon height.

PDF reports draw the same vector logo (dark variant, on the charcoal header) from `services/core/engines/pdf_brand.hpp`.

## Provenance

The SVGs were traced from the approved logo artwork, then optimized, so they reproduce its shapes, spacing and proportions rather than a redesign. Colours were set to the palette above.
