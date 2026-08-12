#!/usr/bin/env python3
"""Impide publicar archivos que GitHub Web no admite (<25 MB)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LIMIT = 25_000_000
IGNORED = {".git", "dist", "__pycache__"}

oversized = [
    (path.relative_to(ROOT), path.stat().st_size)
    for path in ROOT.rglob("*")
    if path.is_file() and not IGNORED.intersection(path.relative_to(ROOT).parts) and path.stat().st_size >= LIMIT
]
if oversized:
    detail = ", ".join(f"{path} ({size:,} bytes)" for path, size in oversized)
    raise SystemExit(f"Archivos de 25 MB o más: {detail}")
print("OK: todos los archivos del proyecto son menores a 25 MB")
