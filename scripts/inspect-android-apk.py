#!/usr/bin/env python3
"""Inspect/stage a universal APK; --build-tools also verifies its signature and manifest."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
import zlib

ABIS = ("arm64-v8a", "x86_64")
# RN 0.81 merges its Android runtime into libreactnative.so.
RUNTIME_LIBRARIES = ("libreactnative.so",)
PACKAGE_NAME = "com.pedrorbc.HomeCare"
BUNDLE = "assets/index.android.bundle"


def inspect(apk):
    with zipfile.ZipFile(apk) as archive:
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(names) != len(set(names)):
            raise ValueError("APK contains duplicate ZIP entries")
        files = {entry.filename: entry for entry in entries if not entry.is_dir()}
        if BUNDLE not in files or files[BUNDLE].file_size == 0:
            raise ValueError(f"APK requires a nonempty {BUNDLE}")
        libraries = {}
        for abi in ABIS:
            prefix = f"lib/{abi}/"
            libraries[abi] = sorted(
                name for name, entry in files.items()
                if name.startswith(prefix) and name.endswith(".so")
                and "/" not in name[len(prefix):] and entry.file_size > 0
            )
            if not libraries[abi]:
                raise ValueError(f"APK requires nonempty native libraries for {abi}")
            for library in RUNTIME_LIBRARIES:
                if prefix + library not in libraries[abi]:
                    raise ValueError(f"APK requires nonempty {prefix}{library}")
        # Stream every entry to check decompression/CRC, without loading the APK in memory.
        corrupt_entry = archive.testzip()
        if corrupt_entry:
            raise ValueError(f"APK contains a corrupt ZIP entry: {corrupt_entry}")
        return {
            "abis": list(ABIS),
            "bundle": {"path": BUNDLE, "size_bytes": files[BUNDLE].file_size},
            "native_libraries": libraries,
        }


def verify_android(apk, build_tools):
    signing = subprocess.run(
        [str(build_tools / "apksigner"), "verify", "--print-certs", str(apk)],
        check=True, capture_output=True, text=True, timeout=120,
    ).stdout
    manifest = subprocess.run(
        [str(build_tools / "aapt"), "dump", "badging", str(apk)],
        check=True, capture_output=True, text=True, timeout=120,
    ).stdout
    package = re.search(
        r"^package: name='([^']+)' versionCode='([0-9]+)' versionName='([^']+)'",
        manifest, re.MULTILINE,
    )
    if not package or package[1] != PACKAGE_NAME or int(package[2]) <= 0:
        raise ValueError(f"APK manifest must identify {PACKAGE_NAME} with a positive version code")
    certificates = {}
    for algorithm, digits in (("SHA-1", 40), ("SHA-256", 64)):
        matches = re.findall(
            rf"^Signer #1 certificate {algorithm} digest: ([0-9a-fA-F]{{{digits}}})$",
            signing, re.MULTILINE,
        )
        if len(matches) != 1:
            raise ValueError(f"apksigner must report exactly one {algorithm} certificate digest")
        certificates[algorithm.lower().replace("-", "")] = matches[0].lower()
    if "Signer #2 certificate" in signing:
        raise ValueError("Preview APK must have a single signer")
    return {
        "package_name": package[1], "version_code": int(package[2]),
        "version_name": package[3], "certificate": certificates,
        "tools": "Android SDK apksigner verify --print-certs and aapt dump badging",
    }, signing, manifest


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("apk", type=Path)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--build-tools", type=Path, help="SDK Build Tools directory for signature/manifest verification")
    for name, environment in (
        ("package-name", "APK_PACKAGE_NAME"),
        ("version-name", "APK_VERSION_NAME"),
        ("version-code", "APK_VERSION_CODE"),
        ("signer-sha256", "APK_SIGNER_SHA256"),
        ("commit", "GITHUB_SHA"),
        ("repository", "GITHUB_REPOSITORY"),
        ("run-id", "GITHUB_RUN_ID"),
        ("run-attempt", "GITHUB_RUN_ATTEMPT"),
        ("build-profile", "APK_BUILD_PROFILE"),
        ("pr-number", "APK_PR_NUMBER"),
        ("head-sha", "APK_HEAD_SHA"),
        ("run-url", "APK_RUN_URL"),
    ):
        parser.add_argument(
            f"--{name}", default=os.environ.get(environment) or None,
            help=f"Workflow-supplied metadata (default: {environment})",
        )
    return parser.parse_args()


def main():
    args = arguments()
    workflow = {
        key: value for key, value in vars(args).items()
        if key not in ("apk", "output_dir", "build_tools") and value is not None
    }
    if args.package_name is not None and args.package_name != PACKAGE_NAME:
        raise ValueError(f"Workflow package name must be {PACKAGE_NAME}")
    if args.version_code is not None:
        if not re.fullmatch(r"[0-9]+", args.version_code) or int(args.version_code) <= 0:
            raise ValueError("Workflow version code must be a positive integer")
        workflow["version_code"] = int(args.version_code)
    if args.signer_sha256 is not None:
        digest = args.signer_sha256.replace(":", "").lower()
        if not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Workflow signer SHA-256 must contain 64 hex digits")
        workflow["signer_sha256"] = digest

    args.output_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".apk-inspection-", dir=args.output_dir) as temporary:
        stage = Path(temporary) / "app-release.apk"
        shutil.copyfile(args.apk, stage)
        inspection = inspect(stage)
        verification_files = []
        if args.build_tools is not None:
            verification, signing, badging = verify_android(stage.resolve(), args.build_tools.resolve())
            inspection["android_verification"] = verification
            for filename, content in (("signature.txt", signing), ("manifest.txt", badging)):
                report = Path(temporary) / filename
                report.write_text(content, encoding="utf-8")
                verification_files.append(report)
        digest = hashlib.sha256()
        with stage.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        sha256 = digest.hexdigest()
        metadata = {
            "schema_version": 1,
            "apk": {
                "filename": stage.name,
                "size_bytes": stage.stat().st_size,
                "sha256": sha256,
                **inspection,
            },
            # These are supplied by CI after apksigner/aapt; ZIP inspection cannot verify them.
            "workflow_inputs": workflow,
        }
        checksum = Path(temporary) / "app-release.apk.sha256"
        checksum.write_text(f"{sha256}  {stage.name}\n", encoding="utf-8")
        manifest = Path(temporary) / "metadata.json"
        manifest.write_text(json.dumps(metadata, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        for file in (stage, checksum, manifest, *verification_files):
            file.replace(args.output_dir / file.name)
    print(f"Staged app-release.apk: sha256={sha256}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError, NotImplementedError,
            EOFError, zlib.error, subprocess.SubprocessError) as error:
        print(f"APK inspection failed: {error}", file=sys.stderr)
        sys.exit(1)
