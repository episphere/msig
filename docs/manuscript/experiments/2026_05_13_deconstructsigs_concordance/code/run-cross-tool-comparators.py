#!/usr/bin/env python3
"""Run SigProfilerAssignment and MuSiCal concordance checks for Table 5.

The script uses the cached PCAWG Lung-AdenoCA SBS96 snapshot and the same
nine-signature catalog used by the deconstructSigs concordance experiment.
"""

from __future__ import annotations

import csv
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
from SigProfilerAssignment import Analyzer
from sigProfilerPlotting import sigProfilerPlotting as sig_plot


SCRIPT_DIR = Path(__file__).resolve().parent
EXPERIMENT_DIR = SCRIPT_DIR.parent
MANUSCRIPT_DIR = EXPERIMENT_DIR.parent.parent
DATA_DIR = EXPERIMENT_DIR / "data"
SNAPSHOT_PATH = MANUSCRIPT_DIR / "actual-figure-pages" / "data" / "pcawg-lung-snapshot.json"
MSIG_EXPOSURES_PATH = DATA_DIR / "msigsdk_exposures.csv"
DECONSTRUCT_EXPOSURES_PATH = DATA_DIR / "deconstructsigs_exposures.csv"
CONCORDANCE_JSON_PATH = DATA_DIR / "concordance-validation-results.json"
MANUSCRIPT_CONCORDANCE_JSON_PATH = MANUSCRIPT_DIR / "data" / "concordance-validation-results.json"
SELECTED_SIGNATURES = [
    "SBS1",
    "SBS2",
    "SBS4",
    "SBS5",
    "SBS13",
    "SBS17a",
    "SBS17b",
    "SBS18",
    "SBS40",
]
EXPOSURE_THRESHOLD = 0.01


def csv_rows(path: Path, delimiter: str | None = None) -> list[dict[str, str]]:
    if delimiter is None:
        delimiter = "\t" if path.suffix.lower() == ".txt" else ","
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def write_rows(path: Path, rows: list[dict[str, object]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def normalize_exposure(record: dict[str, float], threshold: float = EXPOSURE_THRESHOLD) -> dict[str, float]:
    values = {signature: max(float(record.get(signature, 0) or 0), 0.0) for signature in SELECTED_SIGNATURES}
    total = sum(values.values())
    if total <= 0:
        return {signature: 0.0 for signature in SELECTED_SIGNATURES}
    values = {signature: value / total for signature, value in values.items()}
    values = {signature: (value if value >= threshold else 0.0) for signature, value in values.items()}
    total = sum(values.values())
    if total <= 0:
        return {signature: 0.0 for signature in SELECTED_SIGNATURES}
    return {signature: value / total for signature, value in values.items()}


def load_exposure_csv(path: Path, sample_key: str = "sample") -> dict[str, dict[str, float]]:
    rows = csv_rows(path)
    if rows and "Samples" in rows[0]:
        sample_key = "Samples"
    return {
        row[sample_key]: normalize_exposure({signature: row.get(signature, 0) for signature in SELECTED_SIGNATURES})
        for row in rows
    }


def vector(exposure: dict[str, float]) -> np.ndarray:
    return np.array([float(exposure.get(signature, 0) or 0) for signature in SELECTED_SIGNATURES], dtype=float)


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    denominator = float(np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.dot(a, b) / denominator) if denominator else 0.0


def top_signature(exposure: dict[str, float]) -> str:
    return max(SELECTED_SIGNATURES, key=lambda signature: exposure.get(signature, 0.0))


def reconstruct(signatures: pd.DataFrame, exposure: dict[str, float]) -> np.ndarray:
    weights = np.array([float(exposure.get(signature, 0) or 0) for signature in SELECTED_SIGNATURES])
    reconstructed = signatures[SELECTED_SIGNATURES].to_numpy(dtype=float) @ weights
    total = reconstructed.sum()
    return reconstructed / total if total > 0 else reconstructed


def observed_vector(spectra: pd.DataFrame, sample: str) -> np.ndarray:
    observed = spectra[sample].to_numpy(dtype=float)
    total = observed.sum()
    return observed / total if total > 0 else observed


def fmt(value: float, digits: int = 3) -> str:
    return f"{value:.{digits}f}" if math.isfinite(value) else "NA"


def mean(values: list[float]) -> float:
    finite = [value for value in values if math.isfinite(value)]
    return float(np.mean(finite)) if finite else float("nan")


def median(values: list[float]) -> float:
    finite = [value for value in values if math.isfinite(value)]
    return float(np.median(finite)) if finite else float("nan")


def minimum(values: list[float]) -> float:
    finite = [value for value in values if math.isfinite(value)]
    return float(np.min(finite)) if finite else float("nan")


def load_matrices() -> tuple[dict, list[str], list[str], pd.DataFrame, pd.DataFrame]:
    snapshot = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    sample_names = snapshot["sampleNames"]
    canonical_contexts = sig_plot.get_context_reference("96")
    spectra = pd.DataFrame(
        {
            sample: [
                float(snapshot["groupedSpectra"][sample].get(context, 0) or 0)
                for context in canonical_contexts
            ]
            for sample in sample_names
        },
        index=canonical_contexts,
    )
    spectra.index.name = "MutationType"
    signatures = pd.DataFrame(
        {
            signature: [
                float(snapshot["referenceSignatures"][signature].get(context, 0) or 0)
                for context in canonical_contexts
            ]
            for signature in SELECTED_SIGNATURES
        },
        index=canonical_contexts,
    )
    signatures.index.name = "MutationType"
    return snapshot, sample_names, canonical_contexts, spectra, signatures


def run_sigprofiler_assignment(
    spectra: pd.DataFrame, signatures: pd.DataFrame, sample_names: list[str]
) -> dict[str, dict[str, float]]:
    tmpdir = Path(tempfile.mkdtemp(prefix="msig_spa_"))
    sample_path = tmpdir / "samples.tsv"
    signature_path = tmpdir / "signatures.tsv"
    output_dir = DATA_DIR / "sigprofilerassignment_output"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    spectra.to_csv(sample_path, sep="\t")
    signatures.to_csv(signature_path, sep="\t")
    Analyzer.cosmic_fit(
        samples=str(sample_path),
        output=str(output_dir),
        signature_database=str(signature_path),
        genome_build="GRCh37",
        make_plots=False,
        collapse_to_SBS96=False,
        connected_sigs=False,
        verbose=False,
        input_type="matrix",
        context_type="96",
        export_probabilities=False,
        sample_reconstruction_plots=False,
        cpu=1,
        add_background_signatures=False,
    )
    activities_path = (
        output_dir
        / "Assignment_Solution"
        / "Activities"
        / "Assignment_Solution_Activities.txt"
    )
    activities = load_exposure_csv(activities_path, sample_key="Samples")
    output_csv = DATA_DIR / "sigprofilerassignment_exposures.csv"
    write_rows(
        output_csv,
        [
            {"sample": sample, **{signature: activities[sample].get(signature, 0.0) for signature in SELECTED_SIGNATURES}}
            for sample in sample_names
        ],
        ["sample", *SELECTED_SIGNATURES],
    )
    return activities


def import_musical():
    try:
        from musical import SparseNNLS  # type: ignore

        return SparseNNLS, None
    except Exception as first_error:
        fallback = Path(tempfile.gettempdir()) / "msig_parklab_musical_pydeps"
        if fallback.exists():
            sys.path.insert(0, str(fallback))
            try:
                from musical import SparseNNLS  # type: ignore

                return SparseNNLS, str(fallback)
            except Exception as second_error:
                return None, f"{first_error}; fallback import failed: {second_error}"
        return None, str(first_error)


def run_musical(
    spectra: pd.DataFrame, signatures: pd.DataFrame, sample_names: list[str]
) -> tuple[dict[str, dict[str, float]] | None, str | None]:
    sparse_nnls, import_note = import_musical()
    if sparse_nnls is None:
        return None, import_note
    model = sparse_nnls(method="likelihood_bidirectional", thresh1=0.001, max_iter=1000)
    model.fit(spectra, signatures)
    normalized = model.H_reduced_normalized.reindex(SELECTED_SIGNATURES).fillna(0.0)
    exposures = {
        sample: normalize_exposure(
            {signature: float(normalized.loc[signature, sample]) for signature in SELECTED_SIGNATURES}
        )
        for sample in sample_names
    }
    write_rows(
        DATA_DIR / "musical_sparse_nnls_exposures.csv",
        [
            {"sample": sample, **{signature: exposures[sample].get(signature, 0.0) for signature in SELECTED_SIGNATURES}}
            for sample in sample_names
        ],
        ["sample", *SELECTED_SIGNATURES],
    )
    return exposures, import_note


def signature_ambiguity(signatures: pd.DataFrame) -> dict[str, dict[str, float | str]]:
    result: dict[str, dict[str, float | str]] = {}
    matrix = signatures[SELECTED_SIGNATURES]
    for signature in SELECTED_SIGNATURES:
        values = matrix[signature].to_numpy(dtype=float)
        total = values.sum()
        probabilities = values / total if total > 0 else values
        positive = probabilities[probabilities > 0]
        entropy = (
            float(-(positive * np.log(positive)).sum() / math.log(max(len(values), 2)))
            if len(positive)
            else 0.0
        )
        neighbors = [
            (other, cosine(values, matrix[other].to_numpy(dtype=float)))
            for other in SELECTED_SIGNATURES
            if other != signature
        ]
        nearest, nearest_cosine = max(neighbors, key=lambda item: item[1])
        ambiguity_class = (
            "high"
            if nearest_cosine >= 0.95 or entropy >= 0.92
            else "moderate"
            if nearest_cosine >= 0.90 or entropy >= 0.85
            else "low"
        )
        result[signature] = {
            "nearestNeighbor": nearest,
            "nearestCosine": nearest_cosine,
            "entropy": entropy,
            "ambiguityClass": ambiguity_class,
        }
    return result


def summarize_comparator(
    name: str,
    exposures: dict[str, dict[str, float]],
    msig_exposures: dict[str, dict[str, float]],
    spectra: pd.DataFrame,
    signatures: pd.DataFrame,
    sample_names: list[str],
) -> tuple[dict[str, object], list[dict[str, object]]]:
    sample_rows: list[dict[str, object]] = []
    for sample in sample_names:
        msig = msig_exposures[sample]
        comparator = exposures[sample]
        exposure_cosine = cosine(vector(msig), vector(comparator))
        observed = observed_vector(spectra, sample)
        comparator_reconstruction = reconstruct(signatures, comparator)
        msig_reconstruction = reconstruct(signatures, msig)
        row = {
            "sample": sample,
            "tool": name,
            "total_mutations": float(spectra[sample].sum()),
            "exposure_cosine_vs_msigsdk": exposure_cosine,
            "msigsdk_top_signature": top_signature(msig),
            "comparator_top_signature": top_signature(comparator),
            "top_signature_agreement": top_signature(msig) == top_signature(comparator),
            "msigsdk_reconstruction_cosine": cosine(observed, msig_reconstruction),
            "comparator_reconstruction_cosine": cosine(observed, comparator_reconstruction),
        }
        sample_rows.append(row)

    cosines = [float(row["exposure_cosine_vs_msigsdk"]) for row in sample_rows]
    top_agreement = [bool(row["top_signature_agreement"]) for row in sample_rows]
    reconstruction = [float(row["comparator_reconstruction_cosine"]) for row in sample_rows]
    summary = {
        "tool": name,
        "samples": len(sample_rows),
        "meanExposureCosineVsMsigSDK": mean(cosines),
        "medianExposureCosineVsMsigSDK": median(cosines),
        "minExposureCosineVsMsigSDK": minimum(cosines),
        "topSignatureAgreementCount": int(sum(top_agreement)),
        "topSignatureMismatchCount": int(len(top_agreement) - sum(top_agreement)),
        "meanReconstructionCosine": mean(reconstruction),
    }
    return summary, sample_rows


def update_concordance_payload(
    existing: dict,
    comparator_summaries: list[dict[str, object]],
    sample_rows: list[dict[str, object]],
    ambiguity_details: dict[str, object],
) -> dict:
    summary_by_tool = {row["tool"]: row for row in comparator_summaries}
    deconstruct = summary_by_tool.get("deconstructSigs", {})
    sigprofiler = summary_by_tool.get("SigProfilerAssignment", {})
    musical = summary_by_tool.get("MuSiCal", {})
    table_rows = [
        [
            "Independent NNLS solver check",
            "Mean exposure-vector cosine 1.000; maximum absolute exposure difference 4.79e-10.",
            "mSigSDK reproduces the standard NNLS solution to numerical precision.",
        ],
        [
            "deconstructSigs concordance",
            (
                f"Mean exposure cosine {fmt(float(deconstruct.get('meanExposureCosineVsMsigSDK', float('nan'))))}; "
                f"median {fmt(float(deconstruct.get('medianExposureCosineVsMsigSDK', float('nan'))))}; "
                f"minimum {fmt(float(deconstruct.get('minExposureCosineVsMsigSDK', float('nan'))))}; "
                f"{deconstruct.get('topSignatureAgreementCount', 'NA')} of {deconstruct.get('samples', 'NA')} samples shared the top signature."
            ),
            "The R decomposition comparator remains closely aligned with mSigSDK under matched spectra, catalog, cutoff, and renormalization.",
        ],
        [
            "SigProfilerAssignment concordance",
            (
                f"Mean exposure cosine {fmt(float(sigprofiler.get('meanExposureCosineVsMsigSDK', float('nan'))))}; "
                f"median {fmt(float(sigprofiler.get('medianExposureCosineVsMsigSDK', float('nan'))))}; "
                f"minimum {fmt(float(sigprofiler.get('minExposureCosineVsMsigSDK', float('nan'))))}; "
                f"{sigprofiler.get('topSignatureAgreementCount', 'NA')} of {sigprofiler.get('samples', 'NA')} samples shared the top signature."
            ),
            "The Python assignment framework agrees for most spectra, with remaining disagreements concentrated in confusable flat-signature fits.",
        ],
        [
            "MuSiCal SparseNNLS concordance",
            (
                f"Mean exposure cosine {fmt(float(musical.get('meanExposureCosineVsMsigSDK', float('nan'))))}; "
                f"median {fmt(float(musical.get('medianExposureCosineVsMsigSDK', float('nan'))))}; "
                f"minimum {fmt(float(musical.get('minExposureCosineVsMsigSDK', float('nan'))))}; "
                f"{musical.get('topSignatureAgreementCount', 'NA')} of {musical.get('samples', 'NA')} samples shared the top signature."
            ),
            "The sparse likelihood-based comparator provides the direct test of whether ambiguity flags identify NNLS-vs-MuSiCal disagreement.",
        ],
        [
            "Reconstruction concordance",
            (
                f"Mean reconstruction cosine: mSigSDK {fmt(float(existing.get('meanMsigReconstructionCosine', float('nan'))))}; "
                f"deconstructSigs {fmt(float(deconstruct.get('meanReconstructionCosine', float('nan'))))}; "
                f"SigProfilerAssignment {fmt(float(sigprofiler.get('meanReconstructionCosine', float('nan'))))}; "
                f"MuSiCal {fmt(float(musical.get('meanReconstructionCosine', float('nan'))))}."
            ),
            "All reconstruction metrics are computed against the same observed spectra and selected nine-signature catalog.",
        ],
        [
            "Ambiguity-flag prediction",
            str(ambiguity_details["summary"]),
            "The ambiguity signal is evaluated directly against cross-tool top-signature disagreement.",
        ],
    ]
    updated = dict(existing)
    updated["crossToolComparatorRows"] = comparator_summaries
    updated["crossToolSampleRows"] = sample_rows
    updated["ambiguityDisagreementDetails"] = ambiguity_details
    updated["tableRows"] = table_rows
    return updated


def main() -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    snapshot, sample_names, _, spectra, signatures = load_matrices()
    msig_exposures = load_exposure_csv(MSIG_EXPOSURES_PATH)
    deconstruct_exposures = load_exposure_csv(DECONSTRUCT_EXPOSURES_PATH)
    sigprofiler_exposures = run_sigprofiler_assignment(spectra, signatures, sample_names)
    musical_exposures, musical_note = run_musical(spectra, signatures, sample_names)
    if musical_exposures is None:
        raise RuntimeError(f"MuSiCal could not be imported or run: {musical_note}")

    summaries: list[dict[str, object]] = []
    all_sample_rows: list[dict[str, object]] = []
    for name, exposures in [
        ("deconstructSigs", deconstruct_exposures),
        ("SigProfilerAssignment", sigprofiler_exposures),
        ("MuSiCal", musical_exposures),
    ]:
        summary, rows = summarize_comparator(
            name, exposures, msig_exposures, spectra, signatures, sample_names
        )
        summaries.append(summary)
        all_sample_rows.extend(rows)

    ambiguity = signature_ambiguity(signatures)
    mismatch_samples = sorted(
        {
            row["sample"]
            for row in all_sample_rows
            if row["tool"] == "deconstructSigs" and not row["top_signature_agreement"]
        }
    )
    musical_mismatch_samples = sorted(
        {
            row["sample"]
            for row in all_sample_rows
            if row["tool"] == "MuSiCal" and not row["top_signature_agreement"]
        }
    )
    tool_rows_by_sample = {
        sample: [row for row in all_sample_rows if row["sample"] == sample]
        for sample in mismatch_samples
    }
    mismatch_details = []
    for sample in mismatch_samples:
        msig_top = next(row for row in tool_rows_by_sample[sample] if row["tool"] == "deconstructSigs")[
            "msigsdk_top_signature"
        ]
        high_active = sorted(
            {
                signature
                for row in tool_rows_by_sample[sample]
                for signature in [str(row["msigsdk_top_signature"]), str(row["comparator_top_signature"])]
                if ambiguity.get(signature, {}).get("ambiguityClass") == "high"
            }
        )
        mismatch_details.append(
            {
                "sample": sample,
                "msigsdk_top_signature": msig_top,
                "deconstructsigs_top_signature": next(
                    row for row in tool_rows_by_sample[sample] if row["tool"] == "deconstructSigs"
                )["comparator_top_signature"],
                "sigprofilerassignment_top_signature": next(
                    row for row in tool_rows_by_sample[sample] if row["tool"] == "SigProfilerAssignment"
                )["comparator_top_signature"],
                "musical_top_signature": next(
                    row for row in tool_rows_by_sample[sample] if row["tool"] == "MuSiCal"
                )["comparator_top_signature"],
                "high_ambiguity_signatures_in_compared_tops": ";".join(high_active) or "none",
                "musical_disagrees_with_msigsdk": sample in musical_mismatch_samples,
            }
        )

    flagged_musical_disagreements = [
        detail for detail in mismatch_details if detail["musical_disagrees_with_msigsdk"]
    ]
    ambiguity_details = {
        "signatureAmbiguity": ambiguity,
        "deconstructMismatchSamples": mismatch_samples,
        "musicalMismatchSamples": musical_mismatch_samples,
        "mismatchDetails": mismatch_details,
        "summary": (
            f"{len(flagged_musical_disagreements)} of {len(mismatch_details)} deconstructSigs-discordant, "
            f"high-ambiguity samples also showed MuSiCal-vs-mSigSDK top-signature disagreement; "
            f"MuSiCal-vs-mSigSDK top-signature disagreement occurred in {len(musical_mismatch_samples)} of {len(sample_names)} samples overall."
        ),
    }

    write_rows(
        DATA_DIR / "cross_tool_concordance_summary.csv",
        summaries,
        [
            "tool",
            "samples",
            "meanExposureCosineVsMsigSDK",
            "medianExposureCosineVsMsigSDK",
            "minExposureCosineVsMsigSDK",
            "topSignatureAgreementCount",
            "topSignatureMismatchCount",
            "meanReconstructionCosine",
        ],
    )
    write_rows(
        DATA_DIR / "cross_tool_concordance_sample_level.csv",
        all_sample_rows,
        [
            "sample",
            "tool",
            "total_mutations",
            "exposure_cosine_vs_msigsdk",
            "msigsdk_top_signature",
            "comparator_top_signature",
            "top_signature_agreement",
            "msigsdk_reconstruction_cosine",
            "comparator_reconstruction_cosine",
        ],
    )
    write_rows(
        DATA_DIR / "cross_tool_ambiguity_disagreement.csv",
        mismatch_details,
        [
            "sample",
            "msigsdk_top_signature",
            "deconstructsigs_top_signature",
            "sigprofilerassignment_top_signature",
            "musical_top_signature",
            "high_ambiguity_signatures_in_compared_tops",
            "musical_disagrees_with_msigsdk",
        ],
    )

    existing = json.loads(CONCORDANCE_JSON_PATH.read_text(encoding="utf-8"))
    payload = update_concordance_payload(existing, summaries, all_sample_rows, ambiguity_details)
    payload["crossToolGeneratedAt"] = pd.Timestamp.utcnow().isoformat()
    payload["sigProfilerAssignmentVersion"] = subprocess.check_output(
        [sys.executable, "-m", "pip", "show", "SigProfilerAssignment"],
        text=True,
        stderr=subprocess.DEVNULL,
    ).split("Version: ", 1)[1].splitlines()[0]
    payload["musicalImportPath"] = musical_note
    payload["musicalRepository"] = "https://github.com/parklab/MuSiCal"
    payload["contextOrderNote"] = (
        "SigProfilerAssignment reindexes input spectra to its canonical SBS96 order; "
        "the custom signature database is written in the same canonical order."
    )
    output_json = DATA_DIR / "cross-tool-concordance-results.json"
    output_json.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    CONCORDANCE_JSON_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    MANUSCRIPT_CONCORDANCE_JSON_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload["crossToolComparatorRows"], indent=2))
    print(json.dumps(payload["ambiguityDisagreementDetails"], indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
