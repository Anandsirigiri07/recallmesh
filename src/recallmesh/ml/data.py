"""Data loading, cleaning, leakage prevention, and grouped splitting for openFDA records.
"""

from collections import defaultdict
import json
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Set, Tuple
import zipfile


VALID_CLASSES = ("Class I", "Class II", "Class III")

# Patterns that explicitly leak the regulatory classification in text narratives
LEAKAGE_PATTERNS = [
    re.compile(r"\bclass\s*(?:i{1,3}|1|2|3)\b", re.IGNORECASE),
    re.compile(r"\bclassified\s+as\s+(?:class\s*)?(?:i{1,3}|1|2|3)\b", re.IGNORECASE),
    re.compile(r"\bvoluntary\s+class\s*(?:i{1,3}|1|2|3)\b", re.IGNORECASE),
]


def clean_text_narrative(text: Optional[str]) -> str:
    """Cleans narrative text and strips direct target-label leakage.
    
    Removes phrases like 'Class I', 'Class II', 'Class III', normalizes
    punctuation and whitespace, while preserving safety-critical hazard terminology.
    """
    if not text:
        return ""
    cleaned = str(text)
    for pattern in LEAKAGE_PATTERNS:
        cleaned = pattern.sub(" ", cleaned)
    
    # Replace non-alphanumeric (except hyphen) with space
    cleaned = re.sub(r"[^a-zA-Z0-9\s\-]", " ", cleaned.lower())
    # Normalize whitespace
    return " ".join(cleaned.split())


def sanitize_date(date_str: Optional[str], fallback_date_str: Optional[str] = None) -> str:
    """Sanitizes YYYYMMDD date strings, correcting or falling back if malformed."""
    d = (date_str or "").strip()
    if len(d) == 8 and d.isdigit() and (d.startswith("19") or d.startswith("20")):
        return d
    fb = (fallback_date_str or "").strip()
    if len(fb) == 8 and fb.isdigit() and (fb.startswith("19") or fb.startswith("20")):
        return fb
    return "20120101"


class DisjointSet:
    """Union-Find data structure for connected event clustering."""

    def __init__(self) -> None:
        self.parent: Dict[str, str] = {}

    def find(self, item: str) -> str:
        if item not in self.parent:
            self.parent[item] = item
            return item
        if self.parent[item] != item:
            self.parent[item] = self.find(self.parent[item])
        return self.parent[item]

    def union(self, a: str, b: str) -> None:
        root_a = self.find(a)
        root_b = self.find(b)
        if root_a != root_b:
            self.parent[root_b] = root_a


def load_raw_openfda_dataset(dataset_path: Path | str) -> List[Dict[str, Any]]:
    """Loads raw openFDA enforcement records from a JSON or ZIP archive.
    
    Raises:
        FileNotFoundError: If the specified file does not exist.
        ValueError: If archive does not contain valid openFDA JSON records.
    """
    path = Path(dataset_path)
    if not path.exists():
        raise FileNotFoundError(f"openFDA dataset not found at {path}")

    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path, "r") as zf:
            json_members = [m for m in zf.namelist() if m.endswith(".json")]
            if not json_members:
                raise ValueError(f"No JSON file found in {path}")
            with zf.open(json_members[0]) as jf:
                payload = json.load(jf)
                return payload.get("results", [])
    elif path.suffix.lower() == ".json":
        with open(path, "r", encoding="utf-8") as f:
            payload = json.load(f)
            return payload.get("results", []) if isinstance(payload, dict) else payload
    else:
        raise ValueError(f"Unsupported file format for openFDA dataset: {path.suffix}")


def prepare_dataset(
    raw_records: List[Dict[str, Any]],
    deduplicate_identical_event_narratives: bool = True,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Inspects, cleans, and structures raw openFDA records into prepared data.
    
    Performs:
    1. Validation of target label in ('Class I', 'Class II', 'Class III').
    2. Exclusion of rows with missing reason_for_recall or product_description.
    3. Removal of label-revealing tokens from predictors.
    4. Graph-connected event clustering over overlapping event_id and recall_number.
    5. Deduplication of identical narratives within the same event cluster,
       while retaining distinct SKU product descriptions.
    
    Returns:
        Tuple of (prepared_records, audit_stats)
    """
    total_raw = len(raw_records)
    invalid_class_count = 0
    missing_text_count = 0

    valid_initial_records = []
    for r in raw_records:
        cls = r.get("classification")
        if cls not in VALID_CLASSES:
            invalid_class_count += 1
            continue

        raw_prod = (r.get("product_description") or "").strip()
        raw_reason = (r.get("reason_for_recall") or "").strip()
        if not raw_prod and not raw_reason:
            missing_text_count += 1
            continue

        valid_initial_records.append(r)

    # Build connected event clusters using Union-Find
    # Each recall_number and event_id is unified
    uf = DisjointSet()
    for r in valid_initial_records:
        eid = f"event:{r.get('event_id', '').strip()}"
        rn = f"recall:{r.get('recall_number', '').strip()}"
        if r.get("event_id") and r.get("recall_number"):
            uf.union(eid, rn)
        elif r.get("event_id"):
            uf.find(eid)
        elif r.get("recall_number"):
            uf.find(rn)

    # Process records and deduplicate identical narratives within each cluster
    prepared_records = []
    seen_cluster_narratives: Set[Tuple[str, str, str]] = set()
    exact_duplicates_dropped = 0

    for r in valid_initial_records:
        eid = f"event:{r.get('event_id', '').strip()}"
        cluster_id = uf.find(eid) if r.get("event_id") else uf.find(f"recall:{r.get('recall_number', '').strip()}")

        raw_prod = (r.get("product_description") or "").strip()
        raw_reason = (r.get("reason_for_recall") or "").strip()

        clean_prod = clean_text_narrative(raw_prod)
        clean_reason = clean_text_narrative(raw_reason)

        if deduplicate_identical_event_narratives:
            narrative_key = (cluster_id, clean_prod, clean_reason)
            if narrative_key in seen_cluster_narratives:
                exact_duplicates_dropped += 1
                continue
            seen_cluster_narratives.add(narrative_key)

        clean_date = sanitize_date(r.get("recall_initiation_date"), r.get("report_date"))
        report_date = sanitize_date(r.get("report_date"), clean_date)

        # Combined predictor text: hazard reason first, followed by product context
        predictor_text = f"{clean_reason} {clean_prod}".strip()

        prepared_records.append({
            "cluster_id": cluster_id,
            "event_id": str(r.get("event_id", "")).strip(),
            "recall_number": str(r.get("recall_number", "")).strip(),
            "recalling_firm": str(r.get("recalling_firm", "")).strip(),
            "classification": r["classification"],
            "product_description": clean_prod,
            "reason_for_recall": clean_reason,
            "text": predictor_text,
            "date": clean_date,
            "report_date": report_date,
        })

    audit_stats = {
        "total_raw_records": total_raw,
        "invalid_or_missing_class_records": invalid_class_count,
        "missing_text_records": missing_text_count,
        "exact_duplicates_dropped": exact_duplicates_dropped,
        "retained_prepared_records": len(prepared_records),
        "unique_event_clusters": len(set(r["cluster_id"] for r in prepared_records)),
        "unique_firms": len(set(r["recalling_firm"] for r in prepared_records if r["recalling_firm"])),
    }
    return prepared_records, audit_stats


def create_chronological_grouped_splits(
    records: List[Dict[str, Any]],
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """Splits records into Train, Validation, and Test partitions chronologically
    while ensuring connected event clusters are atomically isolated.
    
    Guarantees:
    - Zero event/cluster leakage: no cluster_id appears in more than one partition.
    - Chronological ordering: earlier clusters in train, intermediate in val, latest in test.
    
    Raises:
        ValueError: If record set is inadequate for defensible splitting.
    """
    if len(records) < 10:
        raise ValueError(f"Insufficient records for defensible split (got {len(records)})")

    # Group records by cluster_id
    cluster_records = defaultdict(list)
    for r in records:
        cluster_records[r["cluster_id"]].append(r)

    # Calculate cluster date as the earliest date among all records in that cluster
    cluster_summaries = []
    for cid, recs in cluster_records.items():
        min_date = min(r["date"] for r in recs)
        cluster_summaries.append({
            "cluster_id": cid,
            "date": min_date,
            "record_count": len(recs),
            "records": recs,
        })

    # Sort clusters chronologically, with cluster_id tiebreaker for strict determinism
    cluster_summaries.sort(key=lambda c: (c["date"], c["cluster_id"]))

    total_records = len(records)
    target_train = int(total_records * train_ratio)
    target_val = int(total_records * val_ratio)

    train_clusters, val_clusters, test_clusters = [], [], []
    curr = 0

    for c in cluster_summaries:
        if curr + c["record_count"] <= target_train:
            train_clusters.append(c)
            curr += c["record_count"]
        elif curr + c["record_count"] <= (target_train + target_val):
            val_clusters.append(c)
            curr += c["record_count"]
        else:
            test_clusters.append(c)
            curr += c["record_count"]

    # If any partition ends up empty due to chunky clusters, adjust
    if not val_clusters and len(train_clusters) > 1:
        val_clusters.append(train_clusters.pop())
    if not test_clusters and len(val_clusters) > 1:
        test_clusters.append(val_clusters.pop())

    train_recs = [r for c in train_clusters for r in c["records"]]
    val_recs = [r for c in val_clusters for r in c["records"]]
    test_recs = [r for c in test_clusters for r in c["records"]]

    # Isolation assertion check
    train_cids = set(c["cluster_id"] for c in train_clusters)
    val_cids = set(c["cluster_id"] for c in val_clusters)
    test_cids = set(c["cluster_id"] for c in test_clusters)

    overlap_train_val = train_cids & val_cids
    overlap_train_test = train_cids & test_cids
    overlap_val_test = val_cids & test_cids

    if overlap_train_val or overlap_train_test or overlap_val_test:
        raise RuntimeError("Event cluster leakage detected across split partitions!")

    split_meta = {
        "train_count": len(train_recs),
        "val_count": len(val_recs),
        "test_count": len(test_recs),
        "train_clusters": len(train_clusters),
        "val_clusters": len(val_clusters),
        "test_clusters": len(test_clusters),
        "train_date_range": (train_clusters[0]["date"], train_clusters[-1]["date"]) if train_clusters else ("", ""),
        "val_date_range": (val_clusters[0]["date"], val_clusters[-1]["date"]) if val_clusters else ("", ""),
        "test_date_range": (test_clusters[0]["date"], test_clusters[-1]["date"]) if test_clusters else ("", ""),
    }

    return train_recs, val_recs, test_recs, split_meta


def create_unseen_firm_split(
    records: List[Dict[str, Any]],
    test_firm_ratio: float = 0.15,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], Dict[str, Any]]:
    """Creates a split where firms in the test set are completely disjoint
    from firms in the training set, to assess generalization to unseen firms.
    
    Returns:
        Tuple of (train_recs, unseen_firm_test_recs, meta)
    """
    firm_records = defaultdict(list)
    for r in records:
        firm = r.get("recalling_firm", "").strip() or "UNKNOWN_FIRM"
        firm_records[firm].append(r)

    # Sort firms deterministically by (record count, firm name)
    firm_items = sorted(firm_records.items(), key=lambda x: (len(x[1]), x[0]))

    total_records = len(records)
    target_test = int(total_records * test_firm_ratio)

    test_firms = set()
    test_recs = []
    train_recs = []

    # Select smaller/diverse firms for test up to target count
    curr_test = 0
    for firm, recs in firm_items:
        if curr_test + len(recs) <= target_test and firm != "UNKNOWN_FIRM":
            test_firms.add(firm)
            test_recs.extend(recs)
            curr_test += len(recs)
        else:
            train_recs.extend(recs)

    meta = {
        "train_count": len(train_recs),
        "test_count": len(test_recs),
        "total_firms": len(firm_records),
        "test_firms_count": len(test_firms),
        "disjoint_firms_verified": len(set(r.get("recalling_firm") for r in train_recs) & test_firms) == 0,
    }
    return train_recs, test_recs, meta
