import { strict as assert } from "node:assert";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkManifest, checkInstallation, type PackageManifest } from "./dependencyCompatibility";

test("rejects the NativeWind RC with the preview CSS engine", () => {
  const errors = checkManifest(
    {
      name: "nativewind",
      version: "5.0.0-rc.0",
      peerDependencies: { "react-native-css": "3.1.0-rc.0" },
    },
    () => ({ name: "react-native-css", version: "3.0.6" }),
    "22.23.3",
  );
  assert.match(errors[0], /does not satisfy 3.1.0-rc.0/);
});

test("accepts an exact compatible prerelease pair without treating other prereleases as compatible", () => {
  const manifest = {
    name: "nativewind",
    version: "5.0.0-rc.0",
    peerDependencies: { "react-native-css": "3.1.0-rc.0" },
  };
  assert.deepEqual(
    checkManifest(manifest, () => ({ name: "react-native-css", version: "3.1.0-rc.0" }), "22.23.3"),
    [],
  );
  assert.equal(
    checkManifest(manifest, () => ({ name: "react-native-css", version: "3.1.0-rc.1" }), "22.23.3")
      .length,
    1,
  );
});

test("optional absent peers pass; installed incompatible optional peers and engines fail", () => {
  const manifest: PackageManifest = {
    name: "fixture",
    version: "1.0.0",
    engines: { node: ">=22.13" },
    peerDependencies: { react: "^19.2.0" },
    peerDependenciesMeta: { react: { optional: true } },
  };
  assert.deepEqual(
    checkManifest(manifest, () => undefined, "22.23.3"),
    [],
  );
  assert.equal(
    checkManifest(manifest, () => ({ name: "react", version: "19.1.0" }), "20.19.0").length,
    2,
  );
  assert.equal(
    checkManifest({ ...manifest, peerDependenciesMeta: {} }, () => undefined, "22.23.3").length,
    1,
  );
});

test("checks nested consumer resolution, scoped packages and root dependencies", () => {
  const root = mkdtempSync(join(tmpdir(), "homecare-peers-"));
  const put = (path: string, manifest: PackageManifest) => {
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
  };
  try {
    put(root, { name: "app", version: "1.0.0", dependencies: { react: "19.1.0", missing: "^1" } });
    put(join(root, "node_modules/react"), { name: "react", version: "19.1.0" });
    put(join(root, "node_modules/@expo/metro-config"), {
      name: "@expo/metro-config",
      version: "54.0.17",
    });
    put(join(root, "node_modules/lightningcss"), { name: "lightningcss", version: "1.30.1" });
    put(join(root, "node_modules/postcss"), { name: "postcss", version: "8.5.29" });
    put(join(root, "node_modules/@navigation/tabs"), {
      name: "@navigation/tabs",
      version: "7.20.0",
      peerDependencies: { react: "^19.2.0" },
    });
    put(join(root, "node_modules/@navigation/tabs/node_modules/react"), {
      name: "react",
      version: "19.2.0",
    });
    put(join(root, "node_modules/other"), {
      name: "other",
      version: "1.0.0",
      peerDependencies: { react: "^19.2.0" },
    });
    const errors = checkInstallation(root, "22.23.3");
    assert.equal(errors.length, 2);
    assert.ok(errors.some((error) => error.includes("other@1.0.0")));
    assert.ok(errors.some((error) => error.includes("missing@missing")));
    put(join(root, "node_modules/@expo/metro-config/node_modules/postcss"), {
      name: "postcss",
      version: "8.4.49",
    });
    assert.ok(
      checkInstallation(root, "22.23.3").some((error) => error.includes("patched PostCSS")),
    );
    rmSync(join(root, "node_modules/@expo/metro-config"), { recursive: true });
    assert.ok(
      checkInstallation(root, "22.23.3").some((error) =>
        error.includes("Missing @expo/metro-config"),
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
