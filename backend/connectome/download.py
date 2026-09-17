from __future__ import annotations
import argparse
import base64
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request
from .metadata import DEFAULT_DATA_DIR, load_manifest


def verify_file(path: Path, source: dict) -> dict:
    if not path.is_file():
        raise FileNotFoundError(f"Missing {path.name}; run python -m connectome.download")
    if path.stat().st_size != source["size_bytes"]:
        raise ValueError(f"Size mismatch for {path.name}; expected {source['size_bytes']} bytes")
    md5 = hashlib.md5(usedforsecurity=False)
    sha256 = hashlib.sha256()
    with path.open("rb") as stream:
        while chunk := stream.read(4 * 1024 * 1024):
            md5.update(chunk)
            sha256.update(chunk)
    if base64.b64encode(md5.digest()).decode() != source["md5_base64"]:
        raise ValueError(f"Checksum mismatch for {path.name}; refusing unverified data")
    return {**source, "sha256": sha256.hexdigest(), "verified": True}


def download_file(source: dict, directory: Path) -> dict:
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / source["filename"]
    if target.exists():
        return verify_file(target, source)
    url = source["url"] + "?generation=" + source["generation"]
    partial = target.with_name(target.name + ".part")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(url, timeout=120) as response, partial.open("wb") as out:
                downloaded = 0
                next_log = 64 * 1024 * 1024
                while chunk := response.read(4 * 1024 * 1024):
                    out.write(chunk)
                    downloaded += len(chunk)
                    if downloaded >= next_log:
                        print(f"{target.name}: {downloaded / 2**20:.0f} MiB", file=sys.stderr, flush=True)
                        next_log += 64 * 1024 * 1024
            receipt = verify_file(partial, source)
            partial.replace(target)
            return receipt
        except (OSError, ValueError):
            partial.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
    raise RuntimeError("Download failed")


def download_dataset(directory: Path = DEFAULT_DATA_DIR) -> list[dict]:
    manifest = load_manifest()
    receipts = []
    for source in manifest["files"]:
        print(f"Downloading/verifying {source['filename']}", file=sys.stderr, flush=True)
        receipts.append(download_file(source, directory))
    (directory / "download-receipts.json").write_text(json.dumps(receipts, indent=2) + "\n", encoding="utf-8")
    return receipts


def main() -> None:
    parser = argparse.ArgumentParser(description="Download generation-pinned official MaleCNS files and verify their checksums")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    args = parser.parse_args()
    download_dataset(args.data_dir)


if __name__ == "__main__":
    main()
