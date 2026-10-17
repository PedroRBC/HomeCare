import { appendFileSync, chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function requiredPath(name, value) {
  if (!value || /[\r\n]/.test(value)) {
    throw new Error(`${name} must point to a GitHub Actions environment file`);
  }
  return value;
}

function materialize() {
  const content = process.env.GOOGLE_SERVICES_JSON_CONTENT;
  if (!content?.trim()) {
    throw new Error("GOOGLE_SERVICES_JSON_CONTENT is required");
  }
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected a JSON object");
    }
  } catch {
    throw new Error("GOOGLE_SERVICES_JSON_CONTENT must contain a valid JSON object");
  }

  const runnerTemp = resolve(process.env.RUNNER_TEMP || tmpdir());
  const environmentFile = requiredPath("GITHUB_ENV", process.env.GITHUB_ENV);
  const outputFile = requiredPath("GITHUB_OUTPUT", process.env.GITHUB_OUTPUT);
  let directory;
  try {
    directory = mkdtempSync(join(runnerTemp, "homecare-firebase-"));
    const file = join(directory, "google-services.json");
    writeFileSync(file, content, { encoding: "utf8", flag: "wx", mode: 0o600 });
    chmodSync(file, 0o600);
    appendFileSync(environmentFile, `GOOGLE_SERVICES_JSON=${file}\n`, "utf8");
    appendFileSync(outputFile, `directory=${directory}\n`, "utf8");
    return directory;
  } catch (error) {
    if (directory) rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

try {
  materialize();
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Could not materialize Firebase configuration",
  );
  process.exitCode = 1;
}
