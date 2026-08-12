#!/usr/bin/env python3
"""Elimina únicamente rutas legadas enumeradas; modo auditoría por defecto."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

PROTECTED = {"index.html", "styles.css", "app.js", "data/dashboard.json", "data/audit.json"}
ALLOWED = {"data.js", "Store_Master_Audit.csv", "README.txt", "manifest.json", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon.svg", "style.css", "data/engines/Base_Mix.csv"}


def candidates(root: Path, manifest: Path) -> list[tuple[str, Path]]:
    payload=json.loads((root/manifest).read_text(encoding="utf-8")); raw=payload.get("obsoleteFiles")
    if not isinstance(raw,list) or not raw or any(not isinstance(item,str) for item in raw): raise ValueError("Manifiesto inválido")
    if len(raw)!=len(set(raw)) or len(raw)>50: raise ValueError("Manifiesto duplicado o demasiado amplio")
    approved=[]
    for item in raw:
        relative=Path(item); normalized=relative.as_posix()
        if relative.is_absolute() or ".." in relative.parts or normalized in PROTECTED or normalized not in ALLOWED: raise ValueError(f"Ruta fuera de alcance: {item}")
        unresolved=root/relative
        if unresolved.is_symlink(): raise ValueError(f"No se permiten enlaces simbólicos: {item}")
        target=unresolved.resolve()
        if root not in target.parents: raise ValueError(f"Ruta fuera del proyecto: {item}")
        approved.append((normalized,target))
    return approved


def main() -> None:
    parser=argparse.ArgumentParser(); parser.add_argument("--root",type=Path,default=Path.cwd()); parser.add_argument("--manifest",type=Path,default=Path("scripts/obsolete-files.json")); parser.add_argument("--apply",action="store_true"); parser.add_argument("--check-clean",action="store_true"); parser.add_argument("--print-candidates",action="store_true")
    args=parser.parse_args(); root=args.root.resolve()
    try: approved=candidates(root,args.manifest)
    except (OSError,ValueError,json.JSONDecodeError) as error: raise SystemExit(f"Limpieza cancelada: {error}") from error
    if args.print_candidates: print("\n".join(item for item,_ in approved)); return
    removed=[]
    if args.apply:
        for item,target in approved:
            if target.is_file(): target.unlink(); removed.append(item)
    remaining=[item for item,target in approved if target.is_file()]
    print(json.dumps({"mode":"apply" if args.apply else "audit","removed":removed,"remaining":remaining},ensure_ascii=False))
    if args.check_clean and remaining: raise SystemExit(f"Persisten {len(remaining)} archivos obsoletos")


if __name__ == "__main__": main()
