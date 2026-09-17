from __future__ import annotations
import json
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
DEFAULT_DATA_DIR = PACKAGE_DIR.parent / "data"


def load_manifest(path: Path | None = None) -> dict:
    manifest = json.loads((path or PACKAGE_DIR / "sources.json").read_text(encoding="utf-8-sig"))
    roles = [item["role"] for item in manifest["files"]]
    required = {"annotations", "neurotransmitters", "edges", "body_stats", "metadata"}
    if set(roles) != required or len(roles) != len(required):
        raise ValueError("Manifest must contain exactly the five required source roles")
    for item in manifest["files"]:
        if Path(item["filename"]).name != item["filename"] or "\\" in item["filename"]:
            raise ValueError("Source filename must not contain a directory")
    return manifest


def source_paths(data_dir: Path, manifest: dict) -> dict[str, Path]:
    return {item["role"]: data_dir / item["filename"] for item in manifest["files"]}


def load_metadata(path: Path, manifest: dict) -> dict:
    metadata = json.loads(path.read_text(encoding="utf-8"))
    if metadata.get("dataset") != "male-cns" or metadata.get("tag") != manifest["version"]:
        raise ValueError("Downloaded metadata dataset/version does not match the pinned release")
    return metadata
