import { execFileSync } from "node:child_process";
import { readFileSync, lstatSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const privatePatterns = [
  ["private-key", /-----BEGIN (?:(?:RSA|EC|DSA|OPENSSH|ENCRYPTED) )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{60,})\b/],
  ["google-oauth-secret", /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
];

export function isForbiddenPath(path) {
  const name = basename(path);
  return (
    ((name === ".env" || name.startsWith(".env.")) && name !== ".env.example") ||
    path.split("/").includes(".secrets") ||
    ["google-services.json", "GoogleService-Info.plist", "credentials.json"].includes(name) ||
    /^service-account.*\.json$/i.test(name) ||
    /-service-account\.json$/i.test(name) ||
    /\.(?:jks|keystore|p8|p12|key|pem|pfx|mobileprovision)$/i.test(name)
  );
}

export function inspectEntry(path, content) {
  const findings = [];
  if (isForbiddenPath(path)) findings.push("forbidden-file");
  for (const [category, pattern] of privatePatterns) {
    if (pattern.test(content)) findings.push(category);
  }
  if (/"type"\s*:\s*"service_account"/.test(content) && /"private_key"\s*:/.test(content)) {
    findings.push("service-account");
  }
  return [...new Set(findings)];
}

export function checkTrackedFiles(root) {
  const paths = execFileSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split("\0")
    .filter(Boolean);
  const findings = [];
  for (const path of paths) {
    const fullPath = resolve(root, path);
    let content = "";
    // Do not follow tracked symlinks to credentials outside this checkout.
    if (!lstatSync(fullPath).isSymbolicLink()) content = readFileSync(fullPath, "utf8");
    for (const category of inspectEntry(path, content)) findings.push({ path, category });
  }
  return { files: paths.length, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    const result = checkTrackedFiles(root);
    for (const finding of result.findings) {
      // Only filenames/categories, never matching lines, values or file contents.
      console.error(`${finding.category}: ${JSON.stringify(finding.path)}`);
    }
    if (result.findings.length) process.exitCode = 1;
    else console.log(`Secret-file check passed (${result.files} tracked files).`);
    console.log(
      "Checks known filenames and selected credential patterns; not a complete secret audit.",
    );
  } catch {
    console.error("Unable to check tracked files. No credential contents were printed.");
    process.exitCode = 1;
  }
}
