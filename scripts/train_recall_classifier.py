"""Model Training, Validation Comparison, Evaluation, and Serialization Script.

Trains:
1. Baseline: TF-IDF (1-2 ngrams, max 5000) + Multinomial Logistic Regression (balanced)
2. Alternative: TF-IDF (1-2 ngrams, max 5000) + Calibrated Linear SVM (balanced)

Compares validation metrics, selects the superior model, evaluates on the untouched
chronological test partition and unseen-firm partition, saves the artifact to
models/recall_classifier.joblib, and logs reports/model_metrics.json.
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.recallmesh.ml.data import sanitize_date
from src.recallmesh.ml.evaluate import (
    evaluate_classifier,
    extract_error_analysis,
    verify_split_isolation,
)
from src.recallmesh.ml.pipeline import (
    build_baseline_pipeline,
    build_svm_pipeline,
    load_model_pipeline,
    predict_recall_risk,
    save_model_pipeline,
)

PREPARED_DATA_PATH = Path("data/prepared/prepared_splits.json")
MANIFEST_PATH = Path("reports/openfda_dataset_manifest.json")
MODEL_OUT_PATH = Path("models/recall_classifier.joblib")
METRICS_OUT_PATH = Path("reports/model_metrics.json")


def run_training_and_evaluation() -> dict:
    if not PREPARED_DATA_PATH.exists():
        print(f"Prepared splits not found at {PREPARED_DATA_PATH}. Run scripts/prepare_training_data.py first.")
        sys.exit(1)

    print(f"Loading prepared splits from {PREPARED_DATA_PATH}...")
    with open(PREPARED_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    train_recs = data["train"]
    val_recs = data["val"]
    test_recs = data["test"]
    firm_test_recs = data.get("firm_test", [])
    audit_stats = data.get("audit_stats", {})
    split_meta = data.get("split_metadata", {})

    print(f"Train records: {len(train_recs):,}")
    print(f"Validation records: {len(val_recs):,}")
    print(f"Test records (untouched): {len(test_recs):,}")
    print(f"Unseen-Firm Test records: {len(firm_test_recs):,}")

    # Verify split isolation
    isolation_check = verify_split_isolation(train_recs, val_recs, test_recs)
    print("\nSplit Isolation Verification:")
    print(f"  Zero Cluster Leakage: {isolation_check['zero_cluster_leakage']}")
    print(f"  Train Date Range: {isolation_check['train_min_date']} to {isolation_check['train_max_date']}")
    print(f"  Val Date Range:   {isolation_check['val_min_date']} to {isolation_check['val_max_date']}")
    print(f"  Test Date Range:  {isolation_check['test_min_date']} to {isolation_check['test_max_date']}")

    if not isolation_check["zero_cluster_leakage"]:
        raise RuntimeError("FATAL: Leakage detected between evaluation partitions!")

    X_train = [r["text"] for r in train_recs]
    y_train = [r["classification"] for r in train_recs]

    # --- 1. Train Baseline: Logistic Regression ---
    print("\n========================================================")
    print("Training Model 1 (Baseline: TF-IDF + Logistic Regression)")
    print("========================================================")
    baseline_pipe = build_baseline_pipeline(max_features=5000, random_state=42)
    t0 = time.time()
    baseline_pipe.fit(X_train, y_train)
    t_train_baseline = time.time() - t0
    print(f"Baseline fit completed in {t_train_baseline:.2f} seconds.")

    print("\nEvaluating Baseline on Validation Set...")
    val_eval_baseline = evaluate_classifier(baseline_pipe, val_recs)
    print(f"  Val Accuracy:          {val_eval_baseline['overall_accuracy']:.4f} ({val_eval_baseline['overall_accuracy']*100:.2f}%)")
    print(f"  Val Macro F1:          {val_eval_baseline['macro_f1']:.4f}")
    print(f"  Val Weighted F1:       {val_eval_baseline['weighted_f1']:.4f}")
    print(f"  Val Balanced Accuracy: {val_eval_baseline['balanced_accuracy']:.4f}")
    print("  Per-Class Metrics (Val):")
    for cls_name, m in val_eval_baseline["per_class"].items():
        print(f"    {cls_name:10s} - Precision: {m['precision']:.4f}, Recall: {m['recall']:.4f}, F1: {m['f1_score']:.4f}, Support: {m['support']}")

    # --- 2. Train Model 2: Linear SVM (Calibrated) ---
    print("\n========================================================")
    print("Training Model 2 (Alternative: TF-IDF + Calibrated Linear SVM)")
    print("========================================================")
    svm_pipe = build_svm_pipeline(max_features=5000, random_state=42, calibrate=True)
    t0 = time.time()
    svm_pipe.fit(X_train, y_train)
    t_train_svm = time.time() - t0
    print(f"Linear SVM fit completed in {t_train_svm:.2f} seconds.")

    print("\nEvaluating Linear SVM on Validation Set...")
    val_eval_svm = evaluate_classifier(svm_pipe, val_recs)
    print(f"  Val Accuracy:          {val_eval_svm['overall_accuracy']:.4f} ({val_eval_svm['overall_accuracy']*100:.2f}%)")
    print(f"  Val Macro F1:          {val_eval_svm['macro_f1']:.4f}")
    print(f"  Val Weighted F1:       {val_eval_svm['weighted_f1']:.4f}")
    print(f"  Val Balanced Accuracy: {val_eval_svm['balanced_accuracy']:.4f}")
    print("  Per-Class Metrics (Val):")
    for cls_name, m in val_eval_svm["per_class"].items():
        print(f"    {cls_name:10s} - Precision: {m['precision']:.4f}, Recall: {m['recall']:.4f}, F1: {m['f1_score']:.4f}, Support: {m['support']}")

    # --- 3. Model Selection Decision ---
    print("\n========================================================")
    print("Model Selection on Validation Partition")
    print("========================================================")
    baseline_macro = val_eval_baseline["macro_f1"]
    svm_macro = val_eval_svm["macro_f1"]
    baseline_acc = val_eval_baseline["overall_accuracy"]
    svm_acc = val_eval_svm["overall_accuracy"]

    print(f"Baseline Validation: Macro F1={baseline_macro:.4f}, Accuracy={baseline_acc:.4f}")
    print(f"SVM Validation:      Macro F1={svm_macro:.4f}, Accuracy={svm_acc:.4f}")

    if svm_macro > baseline_macro:
        selected_model_name = "TF-IDF + Calibrated Linear SVM"
        selected_pipe = svm_pipe
        selected_val_eval = val_eval_svm
        selection_rationale = (
            f"Calibrated Linear SVM achieved higher validation Macro F1 ({svm_macro:.4f} vs {baseline_macro:.4f}) "
            f"and Accuracy ({svm_acc:.4f} vs {baseline_acc:.4f})."
        )
    else:
        selected_model_name = "TF-IDF + Multinomial Logistic Regression"
        selected_pipe = baseline_pipe
        selected_val_eval = val_eval_baseline
        selection_rationale = (
            f"Multinomial Logistic Regression achieved superior or equal validation Macro F1 ({baseline_macro:.4f} vs {svm_macro:.4f}) "
            "with calibrated log-odds interpretability."
        )

    print(f"Selected Model: {selected_model_name}")
    print(f"Rationale: {selection_rationale}")

    # --- 4. Final Evaluation on Untouched Chronological Test Set ---
    print("\n========================================================")
    print("Final Evaluation on Untouched Chronological Test Partition")
    print("========================================================")
    test_eval = evaluate_classifier(selected_pipe, test_recs)
    print(f"  Test Overall Accuracy:   {test_eval['overall_accuracy']:.4f} ({test_eval['overall_accuracy']*100:.2f}%)")
    print(f"  Test Macro F1:          {test_eval['macro_f1']:.4f}")
    print(f"  Test Weighted F1:       {test_eval['weighted_f1']:.4f}")
    print(f"  Test Balanced Accuracy: {test_eval['balanced_accuracy']:.4f}")
    print(f"  Majority Baseline Acc:  {test_eval['majority_class_baseline']['baseline_accuracy']:.4f} (Majority: {test_eval['majority_class_baseline']['majority_class']})")
    print(f"  Accuracy Lift over Base: {test_eval['majority_class_baseline']['accuracy_lift']:+.4f}")
    print(f"  Target (>= 90%) Met:    {test_eval['target_comparison']['target_achieved']} (Achieved: {test_eval['target_comparison']['achieved_accuracy']*100:.2f}%)")

    print("\nPer-Class Performance on Test Set:")
    for cls_name, m in test_eval["per_class"].items():
        print(f"  {cls_name:10s} | Precision: {m['precision']:.4f} | Recall: {m['recall']:.4f} | F1: {m['f1_score']:.4f} | Support: {m['support']} ({m['prevalence_pct']}%)")

    print("\nConfusion Matrix (Rows=True, Columns=Predicted):")
    print(f"  Labels: {test_eval['confusion_matrix']['labels']}")
    for row_idx, row in enumerate(test_eval['confusion_matrix']['matrix']):
        print(f"  {test_eval['confusion_matrix']['labels'][row_idx]:10s} {row}")

    # --- 5. Unseen-Firm Evaluation ---
    print("\n========================================================")
    print("Generalization Evaluation on Disjoint Unseen Firms")
    print("========================================================")
    firm_test_eval = evaluate_classifier(selected_pipe, firm_test_recs)
    print(f"  Unseen-Firm Accuracy:   {firm_test_eval['overall_accuracy']:.4f} ({firm_test_eval['overall_accuracy']*100:.2f}%)")
    print(f"  Unseen-Firm Macro F1:   {firm_test_eval['macro_f1']:.4f}")
    print(f"  Unseen-Firm Balanced:   {firm_test_eval['balanced_accuracy']:.4f}")

    # --- 6. Error Analysis ---
    print("\nExtracting Qualitative Error Analysis...")
    misclassified_samples = extract_error_analysis(selected_pipe, test_recs, max_errors=15)
    print(f"Extracted {len(misclassified_samples)} misclassified cases for diagnostic review.")

    # --- 7. Save Artifact and Metrics ---
    dataset_sha = None
    if MANIFEST_PATH.exists():
        with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
            manifest = json.load(f)
            dataset_sha = manifest.get("sha256_checksum")

    training_timestamp = datetime.now(timezone.utc).isoformat()
    metadata = {
        "model_name": selected_model_name,
        "trained_at_utc": training_timestamp,
        "dataset_sha256": dataset_sha,
        "vocabulary_size": len(selected_pipe.named_steps["tfidf"].vocabulary_),
        "classes": list(selected_pipe.classes_),
        "selection_rationale": selection_rationale,
        "test_accuracy": test_eval["overall_accuracy"],
        "test_macro_f1": test_eval["macro_f1"],
        "test_class_i_recall": test_eval["per_class"]["Class I"]["recall"],
    }

    print(f"\nSaving model pipeline to {MODEL_OUT_PATH}...")
    save_model_pipeline(selected_pipe, MODEL_OUT_PATH, metadata)
    print(f"Model saved ({MODEL_OUT_PATH.stat().st_size:,} bytes).")

    metrics_report = {
        "metadata": {
            "model_architecture": selected_model_name,
            "trained_at_utc": training_timestamp,
            "source_dataset_sha256": dataset_sha,
            "python_version": sys.version,
            "features_max": 5000,
            "feature_ngrams": [1, 2],
        },
        "audit_statistics": audit_stats,
        "split_definitions": split_meta,
        "split_isolation": isolation_check,
        "validation_comparison": {
            "baseline_logistic_regression": val_eval_baseline,
            "calibrated_linear_svm": val_eval_svm,
            "selected_model": selected_model_name,
            "selection_rationale": selection_rationale,
        },
        "test_evaluation": test_eval,
        "unseen_firm_evaluation": firm_test_eval,
        "error_analysis_samples": misclassified_samples,
    }

    METRICS_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(METRICS_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(metrics_report, f, indent=2)
    print(f"Metrics report written to {METRICS_OUT_PATH}")

    # --- 8. Reload & Verify Inference ---
    print("\nVerifying reload inference from saved artifact...")
    reloaded_pipe = load_model_pipeline(MODEL_OUT_PATH)

    sample_tests = [
        {
            "desc": "Fresh Atlantic Salmon Fillets",
            "reason": "Product is contaminated with Listeria monocytogenes.",
            "expected_hint": "Class I (life-threatening pathogen)",
        },
        {
            "desc": "Chocolate Chip Cookies 12oz package",
            "reason": "Contains undeclared milk allergen and wheat flour not declared on label.",
            "expected_hint": "Class II (reversible allergen)",
        },
        {
            "desc": "Canned Green Beans 14.5oz",
            "reason": "Labeling error: mislabeled net weight volume; no health hazard.",
            "expected_hint": "Class III (minor labeling defect)",
        },
    ]

    print("\nSample Reload Inference Tests:")
    for st in sample_tests:
        pred = predict_recall_risk(reloaded_pipe, st["desc"], st["reason"])
        print(f"\nCase: {st['desc']}")
        print(f"  Reason:      {st['reason']}")
        print(f"  Expected:    {st['expected_hint']}")
        print(f"  Predicted:   {pred['predicted_class']} (confidence: {pred['confidence']})")
        print(f"  Probs:       {pred['class_probabilities']}")
        print(f"  Top terms:   {pred['top_explanatory_features']}")

    return metrics_report


if __name__ == "__main__":
    run_training_and_evaluation()
