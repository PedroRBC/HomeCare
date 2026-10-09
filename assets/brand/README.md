# HomeCare blue branding

Source: the user's Figma design, `q4ur9BpxGAuZZlsnC6tFMh`, **HomeCare · Logo azul** (node `11:3895`).

- `homecare-mark.svg`: unchanged 48 × 48 export of the primary mark (`11:3899`).
- `homecare-mark-inverse.svg`: unchanged 50 × 50 inverse artwork from the app-icon composition (`11:3905`, parent `11:3904`).
- PNG files are raster derivatives of those original exports. AppLogo uses `contain` with an explicit square frame, without tinting or redrawing the artwork.

Run `node scripts/generate-brand-assets.mjs` from the project checkout to regenerate the local PNGs, launcher/adaptive/monochrome icons, favicon, and splash artwork. Requires `rsvg-convert` (librsvg) and `magick` (ImageMagick). The full app icon follows the Figma 50/96 mark-to-background ratio; Android adaptive art stays within its safe zone. The monochrome image preserves the heart as an alpha cutout.

The native splash uses the operating-system appearance before JavaScript starts. The saved White / Dark / Auto preference applies once app initialization finishes. Changes to launcher icons or native splash configuration require a rebuilt native application.
