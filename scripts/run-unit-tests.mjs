import { fileURLToPath } from "node:url";
import { runUnitTests } from "./unit-test-helpers.mjs";

const cwd = fileURLToPath(new URL("../", import.meta.url));

try {
  runUnitTests({
    cwd,
    bunExecutable: process.versions.bun ? process.execPath : "bun",
  });
} catch (error) {
  console.error(`[unit-tests] ${error.message}`);
  process.exitCode = 1;
}
