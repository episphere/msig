from __future__ import annotations

import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path

from SigProfilerMatrixGenerator import install
from SigProfilerMatrixGenerator.scripts.reference_genome_manager import ReferenceGenomeManager


def write_progress(path: Path, stage: str, **extra):
    payload = {
        "schemaVersion": "msig.maf_conversion_validation_reference_progress.v0.1",
        "stage": stage,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "python": platform.python_version(),
        **extra,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--volume", required=True)
    parser.add_argument("--progress", required=True)
    args = parser.parse_args()

    volume = str(Path(args.volume).resolve())
    progress = Path(args.progress).resolve()
    manager = ReferenceGenomeManager(volume)
    write_progress(progress, "initialized", volume=volume, genomes=["GRCh37", "GRCh38"])

    for genome in ("GRCh37", "GRCh38"):
        if manager.is_genome_installed(genome):
            write_progress(progress, "already-installed", volume=volume, genome=genome)
            continue
        write_progress(progress, "install-started", volume=volume, genome=genome)
        install.install(genome, volume=volume)
        if not manager.is_genome_installed(genome):
            write_progress(progress, "install-failed", volume=volume, genome=genome)
            raise RuntimeError(f"{genome} installation completed without passing checksum verification")
        write_progress(progress, "install-finished", volume=volume, genome=genome)

    write_progress(progress, "completed", volume=volume, genomes=["GRCh37", "GRCh38"])


if __name__ == "__main__":
    main()
