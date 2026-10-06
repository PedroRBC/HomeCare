import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { satisfies } from "semver";

export interface PackageManifest {
  name: string;
  version: string;
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

export function readManifest(directory: string): PackageManifest {
  return JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));
}

// Resolve from the consumer, including nested packages, without executing package code
// or relying on package.json exports (which several libraries intentionally hide).
export function resolvePackageDirectory(directory: string, name: string): string | undefined {
  let current = directory;
  while (true) {
    const candidate = join(current, "node_modules", name);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function resolvePeer(directory: string, name: string): PackageManifest | undefined {
  const path = resolvePackageDirectory(directory, name);
  return path ? readManifest(path) : undefined;
}

export function actualNodeVersion(): string {
  // Bun reports its compatibility target, not the Node on PATH used by Expo/Metro.
  return execFileSync("node", ["-p", "process.versions.node"], { encoding: "utf8" }).trim();
}

export function checkManifest(
  manifest: PackageManifest,
  resolveDependency: (name: string) => PackageManifest | undefined,
  nodeVersion: string,
): string[] {
  const errors: string[] = [];
  const label = `${manifest.name}@${manifest.version}`;
  if (manifest.engines?.node && !satisfies(nodeVersion, manifest.engines.node)) {
    errors.push(`${label}: Node ${nodeVersion} does not satisfy ${manifest.engines.node}`);
  }
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const peer = resolveDependency(name);
    if (!peer && manifest.peerDependenciesMeta?.[name]?.optional) continue;
    if (!peer) {
      errors.push(`${label}: missing peer ${name}@${range}`);
    } else if (!satisfies(peer.version, range)) {
      // Strict prerelease matching: >= does not prove compatibility with an RC.
      errors.push(`${label}: peer ${name}@${peer.version} does not satisfy ${range}`);
    }
  }
  return errors;
}

export function installedPackages(
  root: string,
): { directory: string; manifest: PackageManifest }[] {
  const packages: { directory: string; manifest: PackageManifest }[] = [];
  const visited = new Set<string>();
  const visit = (modules: string) => {
    if (!existsSync(modules)) return;
    for (const entry of readdirSync(modules)) {
      if (entry.startsWith(".")) continue;
      const path = join(modules, entry);
      if (entry.startsWith("@")) {
        visit(path);
        continue;
      }
      if (!existsSync(join(path, "package.json"))) continue;
      const directory = realpathSync(path);
      if (visited.has(directory)) continue;
      visited.add(directory);
      packages.push({ directory, manifest: readManifest(directory) });
      visit(join(directory, "node_modules"));
    }
  };
  visit(join(root, "node_modules"));
  return packages;
}

export function checkInstallation(root: string, nodeVersion: string): string[] {
  const errors = checkManifest(readManifest(root), (name) => resolvePeer(root, name), nodeVersion);
  for (const { directory, manifest } of installedPackages(root)) {
    errors.push(...checkManifest(manifest, (name) => resolvePeer(directory, name), nodeVersion));
  }
  const rootManifest = readManifest(root);
  for (const [name, range] of Object.entries({
    ...rootManifest.dependencies,
    ...rootManifest.devDependencies,
  })) {
    const dependency = resolvePeer(root, name);
    if (!dependency || !satisfies(dependency.version, range)) {
      errors.push(
        `Root dependency ${name}@${dependency?.version ?? "missing"} does not satisfy ${range}`,
      );
    }
  }
  const metro = resolvePackageDirectory(root, "@expo/metro-config");
  if (!metro) {
    errors.push("Missing @expo/metro-config; install the frozen lock before validation");
  } else if (resolvePeer(metro, "lightningcss")?.version !== "1.30.1") {
    errors.push(
      "@expo/metro-config must resolve lightningcss 1.30.1; check the scoped override and Bun version",
    );
  }
  if (metro && !satisfies(resolvePeer(metro, "postcss")?.version ?? "0.0.0", ">=8.5.29 <9")) {
    errors.push(
      "@expo/metro-config must resolve patched PostCSS >=8.5.29 <9; reinstall the frozen lock",
    );
  }
  return errors;
}

// On-demand inventory: latest is a candidate, never a compatibility assertion.
// Includes every installed instance, including different nested versions.
export async function inventory(root: string) {
  const packages = installedPackages(root);
  const rootManifest = readManifest(root);
  const candidates = new Map<string, Promise<PackageManifest>>();
  const sorted = packages.sort((a, b) =>
    relative(root, a.directory).localeCompare(relative(root, b.directory)),
  );
  const inspectPackage = async ({ directory, manifest }: (typeof packages)[number]) => {
    let candidate = candidates.get(manifest.name);
    if (!candidate) {
      candidate = fetch(`https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/latest`, {
        signal: AbortSignal.timeout(30_000),
      }).then((response) => {
        if (!response.ok) throw new Error(`Registry ${manifest.name}: ${response.status}`);
        return response.json() as Promise<PackageManifest>;
      });
      candidates.set(manifest.name, candidate);
    }
    const latest = await candidate;
    return {
      path: relative(root, directory),
      name: manifest.name,
      resolved: manifest.version,
      directRange:
        rootManifest.dependencies?.[manifest.name] ?? rootManifest.devDependencies?.[manifest.name],
      engines: manifest.engines ?? {},
      peers: manifest.peerDependencies ?? {},
      candidate: {
        version: latest.version,
        engines: latest.engines ?? {},
        peers: latest.peerDependencies ?? {},
      },
      source: `https://registry.npmjs.org/${encodeURIComponent(manifest.name)}/${manifest.version}`,
    };
  };
  // Bound registry concurrency and cache duplicate package names.
  const result: Awaited<ReturnType<typeof inspectPackage>>[] = new Array(sorted.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (index < sorted.length) {
        const current = index++;
        result[current] = await inspectPackage(sorted[current]);
      }
    }),
  );
  return { node: actualNodeVersion(), packages: result };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.cwd();
  if (process.argv.includes("--inventory")) {
    console.log(JSON.stringify(await inventory(root), null, 2));
  } else {
    const nodeVersion = actualNodeVersion();
    const errors = checkInstallation(root, nodeVersion);
    if (errors.length) {
      console.error(errors.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(
        `Peers and Node ${nodeVersion} engines valid (${installedPackages(root).length} installed packages).`,
      );
    }
  }
}
