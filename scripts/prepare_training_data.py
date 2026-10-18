"""Data preparation script for RECALLMESH.

Loads raw openFDA dataset, enforces target-leakage safeguards, clusters connected events,
deduplicates identical narratives while preserving distinct SKU descriptions,
and generates chronological grouped train/val/test splits.
"""

import json
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.recallmesh.ml.data import (
    create_chronological_grouped_splits,
    create_unseen_firm_split,
    load_raw_openfda_dataset,
    prepare_dataset,
)

RAW_DATA_PATH = Path("data/raw/food-enforcement-0001-of-0001.json.zip")
OUTPUT_DIR = Path("data/prepared")


def run_data_preparation() -> dict:
    if not RAW_DATA_PATH.exists():
        print(f"ERROR: Raw dataset not found at {RAW_DATA_PATH}")
        print("Please run scripts/download_openfda_dataset.py first.")
        sys.exit(1)

    print(f"Loading raw openFDA dataset from {RAW_DATA_PATH}...")
    raw_records = load_raw_openfda_dataset(RAW_DATA_PATH)
    print(f"Loaded {len(raw_records):,} raw records.")

    print("\nAuditing and preparing dataset (leakage scrubbing, connected clustering, deduplication)...")
    prepared_records, audit_stats = prepare_dataset(raw_records)

    print("Audit Statistics:")
    for k, v in audit_stats.items():
        print(f"  {k}: {v:,}" if isinstance(v, int) else f"  {k}: {v}")

    print("\nConstructing chronological grouped splits (70% Train, 15% Val, 15% Test)...")
    train_recs, val_recs, test_recs, split_meta = create_chronological_grouped_splits(
        prepared_records, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15
    )

    print("\nSplit Summary:")
    print(f"  Training:   {len(train_recs):,} records ({len(train_recs)/len(prepared_records)*100:.2f}%), {split_meta['train_clusters']:,} clusters. Dates: {split_meta['train_date_range'][0]} to {split_meta['train_date_range'][1]}")
    print(f"  Validation: {len(val_recs):,} records ({len(val_recs)/len(prepared_records)*100:.2f}%), {split_meta['val_clusters']:,} clusters. Dates: {split_meta['val_date_range'][0]} to {split_meta['val_date_range'][1]}")
    print(f"  Test:       {len(test_recs):,} records ({len(test_recs)/len(prepared_records)*100:.2f}%), {split_meta['test_clusters']:,} clusters. Dates: {split_meta['test_date_range'][0]} to {split_meta['test_date_range'][1]}")

    print("\nConstructing disjoint unseen-firm split for generalization audit...")
    firm_train, firm_test, firm_meta = create_unseen_firm_split(prepared_records, test_firm_ratio=0.15)
    print(f"  Unseen-Firm Test Partition: {len(firm_test):,} records across {firm_meta['test_firms_count']:,} disjoint firms.")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "audit_stats": audit_stats,
        "split_metadata": split_meta,
        "train": train_recs,
        "val": val_recs,
        "test": test_recs,
        "firm_test": firm_test,
    }

    out_file = OUTPUT_DIR / "prepared_splits.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(payload, f)

    print(f"\nPrepared splits successfully saved to {out_file} ({out_file.stat().st_size:,} bytes)")
    return payload


if __name__ == "__main__":
    run_data_preparation()
