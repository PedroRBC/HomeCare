import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./materialize-google-services.mjs", import.meta.url));

function run(t, content) {
  const root = mkdtempSync(join(tmpdir(), "homecare-firebase-materializer-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const envFile = join(root, "github-env");
  const outputFile = join(root, "github-output");
  writeFileSync(envFile, "");
  writeFileSync(outputFile, "");
  const result = spawnSync("node", [script], {
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter(([name]) => name !== "GOOGLE_SERVICES_JSON_CONTENT"),
      ),
      GOOGLE_SERVICES_JSON_CONTENT: content,
      RUNNER_TEMP: root,
      GITHUB_ENV: envFile,
      GITHUB_OUTPUT: outputFile,
    },
    encoding: "utf8",
  });
  return { ...result, root, envFile, outputFile };
}

test("materializes valid JSON with owner-only permissions and exports only its path", (t) => {
  const secret = JSON.stringify({ project_info: { project_id: "private-test-value" } });
  const result = run(t, secret);
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, /private-test-value/);

  const path = readFileSync(result.envFile, "utf8")
    .trim()
    .replace(/^GOOGLE_SERVICES_JSON=/, "");
  assert.ok(path.startsWith(join(result.root, "homecare-firebase-")));
  assert.equal(readFileSync(path, "utf8"), secret);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(path)).mode & 0o777, 0o700);
  assert.match(readFileSync(result.outputFile, "utf8"), /^directory=.+\n$/);
  assert.doesNotMatch(readFileSync(result.outputFile, "utf8"), /private-test-value/);
});

test("rejects absent and malformed JSON without creating a secret file", (t) => {
  for (const content of ["", "not-json"]) {
    const result = run(t, content);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout + result.stderr, /not-json/);
    assert.equal(readFileSync(result.envFile, "utf8"), "");
    assert.equal(readFileSync(result.outputFile, "utf8"), "");
  }
});
