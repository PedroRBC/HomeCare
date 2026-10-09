import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Requires librsvg (rsvg-convert) and ImageMagick. Sources are unchanged Figma exports.
const root = fileURLToPath(new URL("../", import.meta.url));
const assets = path.join(root, "assets");
const temporary = mkdtempSync(path.join(tmpdir(), "homecare-brand-"));
const run = (program, args) => execFileSync(program, args, { stdio: "inherit", cwd: root });
const render = (source, size, target) =>
  run("rsvg-convert", ["-w", String(size), "-h", String(size), "-o", target, source]);
const blue = path.join(assets, "brand/homecare-mark.svg");
const inverse = path.join(assets, "brand/homecare-mark-inverse.svg");

try {
  render(blue, 384, path.join(assets, "brand/homecare-mark.png"));
  render(inverse, 384, path.join(assets, "brand/homecare-mark-inverse.png"));

  // Figma's 96px app icon contains a centered 50px inverse mark. The OS masks corners.
  const iconMark = path.join(temporary, "icon-mark.png");
  render(inverse, 533, iconMark);
  run("magick", [
    "-size",
    "1024x1024",
    "xc:#2E5BDE",
    iconMark,
    "-gravity",
    "center",
    "-composite",
    "-depth",
    "8",
    path.join(assets, "icon.png"),
  ]);

  // Keep all foreground artwork inside Android's adaptive-icon safe zone.
  const adaptiveMark = path.join(temporary, "adaptive-mark.png");
  render(inverse, 512, adaptiveMark);
  run("magick", [
    "-size",
    "1024x1024",
    "xc:none",
    adaptiveMark,
    "-gravity",
    "center",
    "-composite",
    path.join(assets, "adaptive-icon.png"),
  ]);
  // Keep the original antialiased alpha silhouette, including the heart cutout.
  run("magick", [
    path.join(assets, "adaptive-icon.png"),
    "-fill",
    "black",
    "-colorize",
    "100",
    path.join(assets, "adaptive-icon-monochrome.png"),
  ]);
  render(blue, 432, path.join(assets, "splash-icon-light.png"));
  render(inverse, 432, path.join(assets, "splash-icon-dark.png"));
  run("magick", [
    path.join(assets, "icon.png"),
    "-resize",
    "64x64",
    path.join(assets, "favicon.png"),
  ]);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
