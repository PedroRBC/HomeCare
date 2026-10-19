import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { validateBuildConfig } from "./verify-build-config.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);

if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
  console.log("Usage: bun run build:aab [GRADLE_ARG...]");
  console.log("Builds the current checkout locally with the configured upload key.");
  console.log("Output: reports/android-release/app-release.aab (with SHA-256 checksum).");
} else {
  try {
    validateBuildConfig({ mode: "release", cwd: root });
    const result = spawnSync(
      "bash",
      ["scripts/android-release.sh", "--aab-only", "reports/android-release", ...args],
      {
        cwd: root,
        // Node already loaded .env; Expo must use the same validated environment.
        env: { ...process.env, EXPO_NO_DOTENV: "1" },
        stdio: "inherit",
      },
    );
    if (result.error) throw new Error("Unable to start the local Android build. Check Bash.");
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Local Android build failed.");
    process.exitCode = 1;
  }
}
