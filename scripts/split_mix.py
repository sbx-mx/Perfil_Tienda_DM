#!/usr/bin/env python3
"""Divide Base_Mix.csv por mes en partes auditables menores a 25 MB."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import tempfile
import unicodedata
from collections import defaultdict
from pathlib import Path

MAX_BYTES = 24 * 1024 * 1024
MONTHS = {
    "ENE": 1, "ENERO": 1, "FEB": 2, "FEBRERO": 2, "MAR": 3, "MARZO": 3,
    "ABR": 4, "ABRIL": 4, "MAY": 5, "MAYO": 5, "JUN": 6, "JUNIO": 6,
    "JUL": 7, "JULIO": 7, "AGO": 8, "AGOSTO": 8, "SEP": 9, "SEPTIEMBRE": 9,
    "OCT": 10, "OCTUBRE": 10, "NOV": 11, "NOVIEMBRE": 11, "DIC": 12, "DICIEMBRE": 12,
}


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFD", str(value or "").strip().upper())
    return "".join(char for char in text if unicodedata.category(char) != "Mn")


def month_number(value: object) -> int | None:
    text = normalize(value)
    if text.isdigit():
        number = int(text[-2:]) if len(text) == 6 else int(text)
        return number if 1 <= number <= 12 else None
    return MONTHS.get(text)


def digest(path: Path) -> str:
    result = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def atomic_json(path: Path, value: object) -> None:
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(value, output, ensure_ascii=False, indent=2)
            output.write("\n")
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary_name, path)
    finally:
        Path(temporary_name).unlink(missing_ok=True)


def split(source: Path, output: Path) -> dict[str, object]:
    output.mkdir(parents=True, exist_ok=True)
    handles: dict[int, tuple[object, csv.DictWriter]] = {}
    rows = defaultdict(int)
    invalid = 0
    try:
        with source.open(encoding="utf-8-sig", newline="") as stream:
            reader = csv.DictReader(stream)
            required = {"Category", "DM", "Mes", "Tienda", "Tipo Orden", "Venta"}
            if reader.fieldnames is None or required.difference(reader.fieldnames):
                raise ValueError(f"Base_Mix.csv sin encabezados: {sorted(required.difference(reader.fieldnames or []))}")
            for row_number, row in enumerate(reader, start=2):
                month = month_number(row.get("Mes"))
                if month is None:
                    invalid += 1
                    continue
                if month not in handles:
                    destination = output / f"Base_Mix_{month:02d}.csv"
                    handle = destination.open("w", encoding="utf-8", newline="")
                    writer = csv.DictWriter(handle, fieldnames=reader.fieldnames, lineterminator="\n")
                    writer.writeheader()
                    handles[month] = (handle, writer)
                handles[month][1].writerow(row)
                rows[month] += 1
    finally:
        for handle, _ in handles.values():
            handle.close()

    parts = []
    for month in sorted(rows):
        path = output / f"Base_Mix_{month:02d}.csv"
        size = path.stat().st_size
        if size >= MAX_BYTES:
            raise ValueError(f"{path.name} excede 24 MB; divide ese mes en subpartes")
        parts.append({"file": path.name, "month": month, "rows": rows[month], "bytes": size, "sha256": digest(path)})
    manifest = {
        "schemaVersion": 1,
        "source": source.name,
        "sourceBytes": source.stat().st_size,
        "sourceSha256": digest(source),
        "rows": sum(rows.values()),
        "invalidRows": invalid,
        "parts": parts,
    }
    atomic_json(output / "manifest.json", manifest)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    manifest = split(args.source.resolve(), args.output.resolve())
    print(json.dumps({"status": "ready", "rows": manifest["rows"], "parts": len(manifest["parts"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
