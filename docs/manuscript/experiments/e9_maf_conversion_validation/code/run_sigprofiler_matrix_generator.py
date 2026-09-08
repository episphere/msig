from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import sys
from pathlib import Path

import pandas as pd
from SigProfilerMatrixGenerator.scripts.SigProfilerMatrixGeneratorFunc import (
    SigProfilerMatrixGeneratorFunc,
)
from SigProfilerMatrixGenerator.scripts.reference_genome_manager import (
    CHECKSUMS,
    ReferenceGenomeManager,
)


def dataframe_to_sample_context(value):
    if value is None:
        return None
    if isinstance(value, pd.DataFrame):
        return {
            str(column): {
                str(index): int(number)
                for index, number in value[column].items()
                if pd.notna(number)
            }
            for column in value.columns
        }
    if isinstance(value, dict):
        for preferred in ("78", "ID", "96", "1536"):
            if preferred in value and isinstance(value[preferred], pd.DataFrame):
                return dataframe_to_sample_context(value[preferred])
        for nested in value.values():
            converted = dataframe_to_sample_context(nested)
            if converted is not None:
                return converted
        return None
    return None


def script_sha256():
    return hashlib.sha256(Path(__file__).read_bytes()).hexdigest()


def package_sha256():
    root = Path(importlib.metadata.distribution("SigProfilerMatrixGenerator").locate_file("SigProfilerMatrixGenerator"))
    digest = hashlib.sha256()
    for file_path in sorted(path for path in root.rglob("*") if path.is_file()):
        digest.update(file_path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(file_path.read_bytes())
    return digest.hexdigest()


def load_written_matrix(path: Path):
    if not path.exists():
        return None
    frame = pd.read_csv(path, sep="\t")
    mutation_type = frame.columns[0]
    return {
        str(column): {
            str(row[mutation_type]): int(row[column])
            for _, row in frame.iterrows()
            if pd.notna(row[column])
        }
        for column in frame.columns[1:]
    }


def load_partial_matrices(output_dir: Path, project: str):
    paths = {
        "SBS96": output_dir / "SBS" / f"{project}.SBS96.all",
        "SBS1536": output_dir / "SBS" / f"{project}.SBS1536.all",
        "DBS78": output_dir / "DBS" / f"{project}.DBS78.all",
        "ID83": output_dir / "ID" / f"{project}.ID83.all",
    }
    matrices = {key: load_written_matrix(path) for key, path in paths.items()}
    if not any(value is not None for value in matrices.values()):
        raise RuntimeError("SigProfilerMatrixGenerator raised before writing any requested matrix")
    return matrices


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", required=True)
    parser.add_argument("--genome", required=True)
    parser.add_argument("--profile", choices=("SBS96", "SBS1536", "DBS78", "ID83"), required=True)
    parser.add_argument("--maf-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument("--volume", required=True)
    parser.add_argument("--requested-only", action="store_true")
    args = parser.parse_args()

    os.environ["SIGPROFILERMATRIXGENERATOR_VOLUME"] = str(Path(args.volume).resolve())
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    reference_manager = ReferenceGenomeManager(str(Path(args.volume).resolve()))
    reference_verified = reference_manager.is_genome_installed(args.genome)
    if not reference_verified:
        raise RuntimeError(f"Reference genome {args.genome} failed SigProfilerMatrixGenerator checksum verification")

    comparator_status = "completed"
    comparator_error = None
    try:
        matrices = SigProfilerMatrixGeneratorFunc(
            args.project,
            args.genome,
            str(Path(args.maf_dir).resolve()) + os.sep,
            plot=False,
            tsb_stat=False,
            seqInfo=False,
            output_directory=str(output_dir),
            volume=str(Path(args.volume).resolve()),
        )
    except ValueError as error:
        if "More than 30% of mutations were skipped" not in str(error):
            raise
        comparator_status = "completed_with_skips"
        comparator_error = str(error)
        matrices = None
    partial_matrices = load_partial_matrices(output_dir, args.project) if matrices is None else None

    matrix_payload = {
        "SBS96": (
            dataframe_to_sample_context(matrices.get("96"))
            if matrices is not None
            else partial_matrices["SBS96"]
        ),
        "SBS1536": (
            dataframe_to_sample_context(matrices.get("1536"))
            if matrices is not None
            else partial_matrices["SBS1536"]
        ),
        "DBS78": (
            dataframe_to_sample_context(matrices.get("DINUC"))
            if matrices is not None
            else partial_matrices["DBS78"]
        ),
        "ID83": (
            dataframe_to_sample_context(matrices.get("ID"))
            if matrices is not None
            else partial_matrices["ID83"]
        ),
    }
    if args.requested_only:
        matrix_payload = {
            key: value if key == args.profile else None
            for key, value in matrix_payload.items()
        }
    if matrix_payload[args.profile] is None and comparator_status == "completed":
        comparator_status = "completed_without_matrix"
    payload = {
        "schemaVersion": "msig.maf_conversion_validation_comparator.v0.2",
        "status": comparator_status,
        "error": comparator_error,
        "comparator": "SigProfilerMatrixGenerator",
        "comparatorVersion": importlib.metadata.version("SigProfilerMatrixGenerator"),
        "comparatorPackageSha256": package_sha256(),
        "python": sys.version,
        "pythonExecutable": sys.executable,
        "platform": platform.platform(),
        "command": [sys.executable, *sys.argv],
        "wrapperSha256": script_sha256(),
        "genome": args.genome,
        "referenceVolume": str(Path(args.volume).resolve()),
        "referenceVerified": reference_verified,
        "referenceExpectedMd5": CHECKSUMS[args.genome],
        "project": args.project,
        "profile": args.profile,
        "matrixAvailable": matrix_payload[args.profile] is not None,
        "matrices": matrix_payload,
    }
    Path(args.result).resolve().write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
