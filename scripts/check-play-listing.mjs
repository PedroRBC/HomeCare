import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../docs/google-play");
const listing = JSON.parse(readFileSync(resolve(root, "listing.pt-BR.json"), "utf8"));
for (const [key, limit] of [
  ["title", 30],
  ["shortDescription", 80],
  ["fullDescription", 4000],
]) {
  assert.equal(typeof listing[key], "string", `${key} must be text`);
  const length = Array.from(listing[key]).length;
  assert(length > 0 && length <= limit, `${key}: ${length}/${limit} characters`);
  console.log(`${key}: ${length}/${limit} characters`);
}
assert.equal(listing.language, "pt-BR");

function inspectPng(name, expected, maxBytes) {
  const path = resolve(root, "assets", name);
  const bytes = readFileSync(path);
  assert(bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")), name);
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert(expected(width, height), `${name}: invalid size ${width}x${height}`);
  assert(statSync(path).size <= maxBytes, `${name}: file too large`);
  console.log(`${name}: ${width}x${height}, ${bytes.length} bytes`);
}

inspectPng("icon-512.png", (w, h) => w === 512 && h === 512, 1024 * 1024);
inspectPng("feature-graphic-1024x500.png", (w, h) => w === 1024 && h === 500, 15 * 1024 * 1024);
const screenshots = readdirSync(resolve(root, "assets")).filter((name) =>
  /^phone-\d+[-\w]*\.png$/.test(name),
);
if (screenshots.length < 2 || screenshots.length > 8) {
  throw new Error(`Expected 2–8 real Android phone screenshots; found ${screenshots.length}`);
}
for (const name of screenshots) {
  inspectPng(
    name,
    (w, h) =>
      Math.min(w, h) >= 320 && Math.max(w, h) <= 3840 && (w * 16 === h * 9 || w * 9 === h * 16),
    8 * 1024 * 1024,
  );
}
console.log("Store listing files meet the checked text and image constraints.");
console.log("This does not verify screenshot authenticity, Console state or release readiness.");
