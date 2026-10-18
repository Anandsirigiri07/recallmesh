"""Automated unit test suite for RECALLMESH machine learning components (Milestone 2).

Tests:
- Missing and unsupported classification labels
- Duplicate-record handling and SKU preservation
- Target leakage prevention and token scrubbing
- Missing or empty text handling
- Connected event clustering (Union-Find)
- Chronological grouped splitting with zero cluster leakage
- Explicit failure on inadequate datasets
- Deterministic data preparation
- Synthetic training, pipeline serialization, and reload consistency
- Metrics and confusion matrix calculation correctness
- Inference output contract and advisory safety disclaimer
- Disjoint unseen-firm partitioning
"""

import json
from pathlib import Path
import pytest
from sklearn.pipeline import Pipeline

from src.recallmesh.ml.data import (
    clean_text_narrative,
    create_chronological_grouped_splits,
    create_unseen_firm_split,
    DisjointSet,
    prepare_dataset,
    sanitize_date,
    VALID_CLASSES,
)
from src.recallmesh.ml.evaluate import evaluate_classifier, verify_split_isolation
from src.recallmesh.ml.pipeline import (
    build_baseline_pipeline,
    load_model_pipeline,
    predict_recall_risk,
    save_model_pipeline,
    RESEARCH_DISCLAIMER,
)


@pytest.fixture
def synthetic_raw_records():
    """Generates synthetic openFDA-like enforcement records for hermetic unit testing."""
    return [
        {
            "event_id": "EVT-101",
            "recall_number": "REC-001",
            "recalling_firm": "Firm Alpha",
            "classification": "Class I",
            "product_description": "Organic Baby Spinach 8oz",
            "reason_for_recall": "Listeria monocytogenes contamination detected in retail samples.",
            "recall_initiation_date": "20200115",
            "report_date": "20200120",
        },
        {
            "event_id": "EVT-101",
            "recall_number": "REC-002",
            "recalling_firm": "Firm Alpha",
            "classification": "Class I",
            "product_description": "Organic Baby Spinach 16oz Family Pack",
            "reason_for_recall": "Listeria monocytogenes contamination detected in retail samples.",
            "recall_initiation_date": "20200115",
            "report_date": "20200120",
        },
        # Duplicate narrative in EVT-101 (identical description and reason)
        {
            "event_id": "EVT-101",
            "recall_number": "REC-003",
            "recalling_firm": "Firm Alpha",
            "classification": "Class I",
            "product_description": "Organic Baby Spinach 8oz",
            "reason_for_recall": "Listeria monocytogenes contamination detected in retail samples.",
            "recall_initiation_date": "20200115",
            "report_date": "20200120",
        },
        # Unsupported label
        {
            "event_id": "EVT-102",
            "recall_number": "REC-004",
            "recalling_firm": "Firm Beta",
            "classification": "Not Yet Classified",
            "product_description": "Almond milk 32oz",
            "reason_for_recall": "Under investigation.",
            "recall_initiation_date": "20200210",
            "report_date": "20200215",
        },
        # Class II record with label leakage text
        {
            "event_id": "EVT-103",
            "recall_number": "REC-005",
            "recalling_firm": "Firm Gamma",
            "classification": "Class II",
            "product_description": "Chocolate chip cookies 10oz",
            "reason_for_recall": "Firm initiating voluntary Class 2 recall due to undeclared wheat allergen.",
            "recall_initiation_date": "20210310",
            "report_date": "20210315",
        },
        # Class III record
        {
            "event_id": "EVT-104",
            "recall_number": "REC-006",
            "recalling_firm": "Firm Delta",
            "classification": "Class III",
            "product_description": "Spring Water 500ml",
            "reason_for_recall": "Minor labeling defect: net quantity volume omitted in metric units.",
            "recall_initiation_date": "20220401",
            "report_date": "20220405",
        },
    ]


def test_invalid_and_unsupported_classification_labels(synthetic_raw_records):
    """Verify that unclassified or unsupported classification records are filtered out."""
    prepared, audit = prepare_dataset(synthetic_raw_records)
    labels = {r["classification"] for r in prepared}

    assert "Not Yet Classified" not in labels
    assert labels.issubset(set(VALID_CLASSES))
    assert audit["invalid_or_missing_class_records"] == 1


def test_duplicate_record_handling_and_sku_preservation(synthetic_raw_records):
    """Verify identical narratives are deduplicated while distinct SKU descriptions are preserved."""
    prepared, audit = prepare_dataset(synthetic_raw_records)

    evt101_recs = [r for r in prepared if r["event_id"] == "EVT-101"]
    # We had 3 records for EVT-101: 2 identical (8oz), 1 distinct (16oz Family Pack)
    assert len(evt101_recs) == 2
    assert audit["exact_duplicates_dropped"] == 1

    descriptions = {r["product_description"] for r in evt101_recs}
    assert "organic baby spinach 8oz" in descriptions
    assert "organic baby spinach 16oz family pack" in descriptions


def test_target_leakage_safeguards():
    """Verify that direct label tokens (e.g. 'Class II', 'Class 2') are stripped from text."""
    leaky_text = "Firm is initiating a voluntary Class II recall for undeclared peanut protein."
    cleaned = clean_text_narrative(leaky_text)

    assert "class ii" not in cleaned
    assert "class 2" not in cleaned
    assert "undeclared peanut protein" in cleaned


def test_missing_or_empty_text_inference():
    """Verify that inference gracefully handles empty or whitespace text."""
    dummy_pipe = build_baseline_pipeline()
    # Fit dummy on minimal corpus
    dummy_pipe.fit(["pathogen listeria contamination", "undeclared allergen peanuts"], ["Class I", "Class II"])

    res = predict_recall_risk(dummy_pipe, "", "   ")
    assert res["status"] == "INSUFFICIENT_TEXT"
    assert res["predicted_class"] == "UNKNOWN"
    assert RESEARCH_DISCLAIMER in res["disclaimer"]


def test_disjoint_set_connected_clustering():
    """Verify Union-Find correctly joins overlapping recall numbers and event IDs."""
    uf = DisjointSet()
    uf.union("event:100", "recall:A")
    uf.union("recall:A", "recall:B")
    uf.union("recall:B", "event:101")

    assert uf.find("event:100") == uf.find("event:101")
    assert uf.find("recall:A") == uf.find("recall:B")


def test_chronological_grouped_splitting_and_zero_leakage():
    """Verify that grouped splitting produces disjoint clusters and chronological order."""
    # Build 15 synthetic clusters across different dates
    records = []
    for i in range(15):
        cid = f"cluster_{i:02d}"
        date = f"202{i//5:01d}0{1 + i%10:02d}01"
        cls = "Class I" if i % 3 == 0 else ("Class II" if i % 3 == 1 else "Class III")
        # 2 records per cluster
        records.append({
            "cluster_id": cid,
            "event_id": f"EVT-{i}",
            "recall_number": f"REC-{i}-A",
            "recalling_firm": f"Firm {i}",
            "classification": cls,
            "product_description": f"Product {i} A",
            "reason_for_recall": f"Hazard reason {i}",
            "text": f"Hazard reason {i} Product {i} A",
            "date": date,
            "report_date": date,
        })
        records.append({
            "cluster_id": cid,
            "event_id": f"EVT-{i}",
            "recall_number": f"REC-{i}-B",
            "recalling_firm": f"Firm {i}",
            "classification": cls,
            "product_description": f"Product {i} B",
            "reason_for_recall": f"Hazard reason {i}",
            "text": f"Hazard reason {i} Product {i} B",
            "date": date,
            "report_date": date,
        })

    train_recs, val_recs, test_recs, meta = create_chronological_grouped_splits(
        records, train_ratio=0.60, val_ratio=0.20, test_ratio=0.20
    )

    isolation = verify_split_isolation(train_recs, val_recs, test_recs)
    assert isolation["zero_cluster_leakage"] is True
    assert isolation["overlap_train_val_count"] == 0
    assert isolation["overlap_train_test_count"] == 0
    assert isolation["overlap_val_test_count"] == 0

    assert len(train_recs) > 0
    assert len(val_recs) > 0
    assert len(test_recs) > 0


def test_insufficient_data_rejection():
    """Verify ValueError is raised if records are insufficient for a defensible split."""
    tiny_records = [{"cluster_id": "c1", "date": "20200101"}]
    with pytest.raises(ValueError) as excinfo:
        create_chronological_grouped_splits(tiny_records)
    assert "Insufficient records" in str(excinfo.value)


def test_deterministic_preparation(synthetic_raw_records):
    """Verify running data preparation repeatedly on identical inputs yields identical output."""
    prep1, audit1 = prepare_dataset(synthetic_raw_records)
    prep2, audit2 = prepare_dataset(synthetic_raw_records)

    assert audit1 == audit2
    assert len(prep1) == len(prep2)
    for r1, r2 in zip(prep1, prep2):
        assert r1["cluster_id"] == r2["cluster_id"]
        assert r1["text"] == r2["text"]


def test_model_training_serialization_and_reload(tmp_path):
    """Verify that a pipeline fits, saves, reloads, and outputs identical predictions."""
    train_corpus = [
        "severe listeria monocytogenes in deli turkey breast",
        "deadly listeria monocytogenes pathogen in smoked salmon",
        "positive for listeria monocytogenes contamination",
        "undeclared wheat and gluten allergen in snack bars",
        "foreign plastic fragments in frozen waffles",
        "undeclared soy lecithin allergen in candy drops",
        "labeling discrepancy net weight grams omitted",
        "minor typographical error in distributor address",
        "aesthetic packaging seal defect without leak",
    ]
    train_labels = [
        "Class I", "Class I", "Class I",
        "Class II", "Class II", "Class II",
        "Class III", "Class III", "Class III",
    ]

    pipe = build_baseline_pipeline(max_features=100, random_state=42, min_df=1)
    pipe.fit(train_corpus, train_labels)

    test_query = "smoked turkey breast positive for listeria monocytogenes"
    pred_before = pipe.predict([test_query])[0]
    prob_before = pipe.predict_proba([test_query])[0]

    # Save to temp artifact
    artifact_path = tmp_path / "test_model.joblib"
    save_model_pipeline(pipe, artifact_path, {"test": True})
    assert artifact_path.exists()

    # Reload
    reloaded = load_model_pipeline(artifact_path)
    pred_after = reloaded.predict([test_query])[0]
    prob_after = reloaded.predict_proba([test_query])[0]

    assert pred_before == pred_after
    assert list(prob_before) == list(prob_after)

    # Test structured predict function
    res = predict_recall_risk(reloaded, "Smoked turkey breast", "Positive for listeria monocytogenes")
    assert res["predicted_class"] == "Class I"
    assert res["confidence"] > 0.4
    assert RESEARCH_DISCLAIMER in res["disclaimer"]


def test_metrics_calculation_and_confusion_matrix():
    """Verify evaluation metric calculations and confusion matrix formatting."""
    train_corpus = ["pathogen a", "pathogen b", "allergen c", "defect d"]
    train_labels = ["Class I", "Class I", "Class II", "Class III"]

    pipe = build_baseline_pipeline(max_features=50, random_state=42)
    pipe.fit(train_corpus, train_labels)

    eval_records = [
        {"text": "pathogen a", "classification": "Class I"},
        {"text": "allergen c", "classification": "Class II"},
        {"text": "defect d", "classification": "Class III"},
    ]

    metrics = evaluate_classifier(pipe, eval_records)

    assert "overall_accuracy" in metrics
    assert "macro_f1" in metrics
    assert "balanced_accuracy" in metrics
    assert "confusion_matrix" in metrics
    assert metrics["confusion_matrix"]["labels"] == ["Class I", "Class II", "Class III"]
    assert len(metrics["confusion_matrix"]["matrix"]) == 3
    assert "majority_class_baseline" in metrics


def test_unseen_firm_disjoint_split():
    """Verify unseen firm split contains 0 firm overlap with training data."""
    records = [
        {"recalling_firm": f"Firm_{i}", "text": f"text {i}", "classification": "Class I"}
        for i in range(20)
    ]
    train_recs, test_recs, meta = create_unseen_firm_split(records, test_firm_ratio=0.25)

    assert meta["disjoint_firms_verified"] is True
    train_firms = set(r["recalling_firm"] for r in train_recs)
    test_firms = set(r["recalling_firm"] for r in test_recs)
    assert len(train_firms & test_firms) == 0


def test_hazard_feature_extractor():
    """Verify that HazardFeatureExtractor identifies key pathogens, allergens, and defects."""
    from src.recallmesh.ml.features import HazardFeatureExtractor

    extractor = HazardFeatureExtractor()
    texts = [
        "Product positive for Listeria monocytogenes contamination.",
        "Contains undeclared peanut and milk allergens.",
        "Metal fragments detected in canned soup.",
        "Misbranded label claim net weight volume omitted.",
    ]
    feats = extractor.transform(texts).toarray()
    names = extractor.get_feature_names_out()

    # Listeria text
    listeria_idx = names.index("has_listeria")
    assert feats[0, listeria_idx] == 1.0

    # Peanut & milk text
    peanut_idx = names.index("has_peanut")
    milk_idx = names.index("has_milk")
    assert feats[1, peanut_idx] == 1.0
    assert feats[1, milk_idx] == 1.0

    # Metal text
    metal_idx = names.index("has_foreign_metal")
    assert feats[2, metal_idx] == 1.0

    # Labeling defect text
    label_idx = names.index("has_labeling_defect")
    assert feats[3, label_idx] == 1.0


def test_improved_three_class_pipeline_training_and_inference(tmp_path):
    """Verify that improved 3-class pipeline with hazard indicators fits, saves, and reloads."""
    from src.recallmesh.ml.pipeline import (
        build_improved_three_class_pipeline,
        load_model_pipeline,
        predict_recall_risk,
        save_model_pipeline,
    )

    corpus = [
        "severe listeria monocytogenes in smoked salmon fillets",
        "positive for salmonella enterica in peanut butter spread",
        "undeclared wheat and milk allergen in chocolate chip cookies",
        "foreign plastic and rubber fragments in frozen pancakes",
        "mislabeled net weight grams omitted label claim discrepancy",
        "minor typographical error in distributor street address",
    ]
    labels = ["Class I", "Class I", "Class II", "Class II", "Class III", "Class III"]

    pipe = build_improved_three_class_pipeline(max_features=100, random_state=42, c_param=0.5)
    pipe.fit(corpus, labels)

    save_path = tmp_path / "improved_test.joblib"
    save_model_pipeline(pipe, save_path)
    reloaded = load_model_pipeline(save_path)

    pred = predict_recall_risk(reloaded, "Smoked salmon", "Listeria monocytogenes confirmed")
    assert pred["predicted_class"] == "Class I"
    assert pred["confidence"] > 0.4
    assert "disclaimer" in pred


def test_binary_classifier_pipeline_and_thresholding(tmp_path):
    """Verify binary classifier training, threshold-based predictions, and binary evaluation."""
    from src.recallmesh.ml.pipeline import (
        build_binary_classifier_pipeline,
        load_model_pipeline,
        predict_binary_recall_risk,
        save_model_pipeline,
    )
    from src.recallmesh.ml.evaluate import evaluate_binary_classifier

    corpus = [
        "severe listeria monocytogenes outbreak in fresh sprouts",
        "lethal botulinum toxin in canned asparagus",
        "undeclared wheat allergen in granola bars",
        "minor labeling defect volume omitted without hazard",
    ]
    binary_labels = [1, 1, 0, 0]

    bin_pipe = build_binary_classifier_pipeline(max_features=100, random_state=42, c_param=0.5)
    bin_pipe.fit(corpus, binary_labels)

    save_path = tmp_path / "binary_test.joblib"
    save_model_pipeline(bin_pipe, save_path)
    reloaded = load_model_pipeline(save_path)

    # Test inference at default threshold
    res_high = predict_binary_recall_risk(reloaded, "Fresh sprouts", "Listeria monocytogenes detected", threshold=0.5)
    assert res_high["is_class_i"] is True
    assert "Class I" in res_high["predicted_binary_label"]
    assert res_high["class_i_probability"] > 0.5

    res_low = predict_binary_recall_risk(reloaded, "Canned beans", "Minor labeling typo on net weight", threshold=0.5)
    assert res_low["is_class_i"] is False
    assert "Class II / III" in res_low["predicted_binary_label"]

    # Test evaluation
    eval_records = [
        {"text": "listeria in sprouts", "classification": "Class I"},
        {"text": "label typo on beans", "classification": "Class II"},
    ]
    eval_res = evaluate_binary_classifier(reloaded, eval_records, threshold=0.45)
    assert "overall_accuracy" in eval_res
    assert "roc_auc" in eval_res
    assert "confusion_matrix" in eval_res
    assert eval_res["threshold_applied"] == 0.45
