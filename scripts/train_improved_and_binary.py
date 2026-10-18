"""RECALLMESH Milestone 2.1: Model Improvement and Binary Task Execution Script.

Preserves the original baseline model artifact (models/recall_classifier.joblib).
Trains and evaluates:
1. Improved Three-Class Model (models/recall_classifier_improved.joblib)
2. Separate Binary High-Severity Model (models/recall_classifier_binary.joblib)

Outputs:
- reports/model_optimization_metrics.json
- docs/model-optimization-report.md
"""

from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import time
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.recallmesh.ml.evaluate import (
    evaluate_classifier,
    evaluate_binary_classifier,
    extract_error_analysis,
    verify_split_isolation,
)
from src.recallmesh.ml.pipeline import (
    build_improved_three_class_pipeline,
    build_binary_classifier_pipeline,
    load_model_pipeline,
    predict_recall_risk,
    predict_binary_recall_risk,
    save_model_pipeline,
)

PREPARED_DATA_PATH = Path("data/prepared/prepared_splits.json")
BASELINE_MODEL_PATH = Path("models/recall_classifier.joblib")
BASELINE_METRICS_PATH = Path("reports/model_metrics.json")

IMPROVED_MODEL_OUT_PATH = Path("models/recall_classifier_improved.joblib")
BINARY_MODEL_OUT_PATH = Path("models/recall_classifier_binary.joblib")
OPTIMIZATION_METRICS_OUT_PATH = Path("reports/model_optimization_metrics.json")


def run_model_optimization():
    print("===================================================================")
    print("RECALLMESH MILESTONE 2.1: MODEL IMPROVEMENT & BINARY EXPERIMENTATION")
    print("===================================================================")

    if not PREPARED_DATA_PATH.exists():
        print(f"Error: {PREPARED_DATA_PATH} not found. Run prepare_training_data.py first.")
        sys.exit(1)

    print(f"Loading prepared splits from {PREPARED_DATA_PATH}...")
    with open(PREPARED_DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    train_recs = data["train"]
    val_recs = data["val"]
    test_recs = data["test"]
    audit_stats = data.get("audit_stats", {})
    split_meta = data.get("split_metadata", {})

    print(f"Train records: {len(train_recs):,}")
    print(f"Validation records: {len(val_recs):,}")
    print(f"Locked Test records: {len(test_recs):,}")

    # Isolation check
    isolation = verify_split_isolation(train_recs, val_recs, test_recs)
    assert isolation["zero_cluster_leakage"] is True, "Fatal: cluster leakage detected!"
    print(f"Split Isolation Verified: Zero Cluster Leakage = {isolation['zero_cluster_leakage']}")

    # Load baseline metrics for comparison
    with open(BASELINE_METRICS_PATH, "r", encoding="utf-8") as f:
        baseline_report = json.load(f)
    baseline_test_eval = baseline_report["test_evaluation"]

    print("\nOriginal Milestone 2 Baseline Test Metrics (Locked Baseline):")
    print(f"  Test Accuracy:     {baseline_test_eval['overall_accuracy']*100:.2f}%")
    print(f"  Test Macro F1:     {baseline_test_eval['macro_f1']:.4f}")
    print(f"  Test Bal Acc:      {baseline_test_eval['balanced_accuracy']:.4f}")
    print(f"  Class I Recall:    {baseline_test_eval['per_class']['Class I']['recall']*100:.2f}%")

    X_train = [r["text"] for r in train_recs]
    y_train = [r["classification"] for r in train_recs]

    # --- 1. EXPERIMENT A: TRAIN IMPROVED THREE-CLASS PIPELINE ---
    print("\n-------------------------------------------------------------------")
    print("EXPERIMENT A: IMPROVED THREE-CLASS CLASSIFIER")
    print("Features: TF-IDF (1,2 ngrams, 5000) + Transparent Hazard Indicators")
    print("Estimator: Tuned Logistic Regression (C=0.5, class_weight='balanced')")
    print("-------------------------------------------------------------------")

    improved_pipe = build_improved_three_class_pipeline(max_features=5000, random_state=42, c_param=0.5)
    t0 = time.time()
    improved_pipe.fit(X_train, y_train)
    t_fit_improved = time.time() - t0
    print(f"Fit completed in {t_fit_improved:.2f} seconds.")

    # Validation evaluation
    val_eval_improved = evaluate_classifier(improved_pipe, val_recs)
    print("\nValidation Performance (Improved 3-Class):")
    print(f"  Val Accuracy:          {val_eval_improved['overall_accuracy']*100:.2f}%")
    print(f"  Val Macro F1:          {val_eval_improved['macro_f1']:.4f}")
    print(f"  Val Balanced Accuracy: {val_eval_improved['balanced_accuracy']:.4f}")
    for cls_name, m in val_eval_improved["per_class"].items():
        print(f"    {cls_name:10s} - Precision: {m['precision']:.4f}, Recall: {m['recall']:.4f}, F1: {m['f1_score']:.4f}")

    # Evaluate on Locked Test Partition once
    print("\nEvaluating Frozen Improved Candidate on Locked Chronological Test Set...")
    test_eval_improved = evaluate_classifier(improved_pipe, test_recs)
    print(f"  Test Accuracy:         {test_eval_improved['overall_accuracy']*100:.2f}% (Baseline: {baseline_test_eval['overall_accuracy']*100:.2f}%)")
    print(f"  Test Macro F1:         {test_eval_improved['macro_f1']:.4f} (Baseline: {baseline_test_eval['macro_f1']:.4f})")
    print(f"  Test Balanced Accuracy:{test_eval_improved['balanced_accuracy']:.4f} (Baseline: {baseline_test_eval['balanced_accuracy']:.4f})")
    print("  Per-Class Test Performance (Improved):")
    for cls_name, m in test_eval_improved["per_class"].items():
        print(f"    {cls_name:10s} | Precision: {m['precision']:.4f} | Recall: {m['recall']:.4f} | F1: {m['f1_score']:.4f} | Support: {m['support']}")

    # Save improved artifact without touching baseline
    print(f"\nSaving improved 3-class artifact to {IMPROVED_MODEL_OUT_PATH}...")
    save_model_pipeline(improved_pipe, IMPROVED_MODEL_OUT_PATH, {
        "model_type": "TF-IDF + Hazard Indicators + Logistic Regression C=0.5",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "task": "3-class (Class I / Class II / Class III)",
        "test_accuracy": test_eval_improved["overall_accuracy"],
    })
    print(f"Saved ({IMPROVED_MODEL_OUT_PATH.stat().st_size:,} bytes). Baseline preserved intact.")

    # --- 2. EXPERIMENT C: SEPARATE BINARY HIGH-SEVERITY TASK ---
    print("\n-------------------------------------------------------------------")
    print("EXPERIMENT C: SEPARATE BINARY CLASSIFIER (CLASS I vs NON-CLASS I)")
    print("Safety Focus: Isolating High-Severity / Fatal Recalls from Lower Severity")
    print("-------------------------------------------------------------------")

    y_train_binary = np.array([1 if c == "Class I" else 0 for c in y_train])

    bin_pipe = build_binary_classifier_pipeline(max_features=5000, random_state=42, c_param=0.5)
    t0 = time.time()
    bin_pipe.fit(X_train, y_train_binary)
    t_fit_bin = time.time() - t0
    print(f"Binary model fit completed in {t_fit_bin:.2f} seconds.")

    # Tune threshold strictly on validation partition
    X_val = [r["text"] for r in val_recs]
    y_val_bin = np.array([1 if r["classification"] == "Class I" else 0 for r in val_recs])
    val_probs = bin_pipe.predict_proba(X_val)[:, 1]

    best_thresh = 0.5
    best_val_bal = 0.0
    for cand_t in np.arange(0.35, 0.65, 0.02):
        cand_preds = (val_probs >= cand_t).astype(int)
        cand_bal = (
            np.mean(cand_preds[y_val_bin == 1] == 1) + np.mean(cand_preds[y_val_bin == 0] == 0)
        ) / 2.0
        if cand_bal > best_val_bal:
            best_val_bal = cand_bal
            best_thresh = float(round(cand_t, 2))

    print(f"Selected Validation-Tuned Decision Threshold: {best_thresh:.2f} (Val Balanced Acc: {best_val_bal:.4f})")

    val_eval_bin_default = evaluate_binary_classifier(bin_pipe, val_recs, threshold=0.5)
    val_eval_bin_tuned = evaluate_binary_classifier(bin_pipe, val_recs, threshold=best_thresh)

    print("\nValidation Binary Performance:")
    print(f"  At Default Threshold 0.50 -> Acc: {val_eval_bin_default['overall_accuracy']*100:.2f}%, Bal Acc: {val_eval_bin_default['balanced_accuracy']:.4f}, Class I Recall: {val_eval_bin_default['class_i_metrics']['recall']*100:.1f}%")
    print(f"  At Tuned Threshold {best_thresh:.2f}   -> Acc: {val_eval_bin_tuned['overall_accuracy']*100:.2f}%, Bal Acc: {val_eval_bin_tuned['balanced_accuracy']:.4f}, Class I Recall: {val_eval_bin_tuned['class_i_metrics']['recall']*100:.1f}%")
    print(f"  Val ROC AUC: {val_eval_bin_tuned['roc_auc']:.4f} | Val PR AUC: {val_eval_bin_tuned['pr_auc']:.4f}")

    # Evaluate frozen binary pipeline on Locked Test Partition once
    print("\nEvaluating Frozen Binary Pipeline on Locked Chronological Test Partition...")
    test_eval_bin_default = evaluate_binary_classifier(bin_pipe, test_recs, threshold=0.5)
    test_eval_bin_tuned = evaluate_binary_classifier(bin_pipe, test_recs, threshold=best_thresh)

    print(f"  Locked Test Accuracy (thresh=0.50): {test_eval_bin_default['overall_accuracy']*100:.2f}% (Majority Baseline: {test_eval_bin_default['majority_class_baseline']['baseline_accuracy']*100:.2f}%)")
    print(f"  Locked Test Accuracy (tuned={best_thresh:.2f}): {test_eval_bin_tuned['overall_accuracy']*100:.2f}% (Majority Baseline: {test_eval_bin_tuned['majority_class_baseline']['baseline_accuracy']*100:.2f}%)")
    print(f"  Locked Test ROC AUC:                {test_eval_bin_tuned['roc_auc']:.4f}")
    print(f"  Locked Test PR AUC:                 {test_eval_bin_tuned['pr_auc']:.4f}")
    print(f"  Locked Test Balanced Accuracy:      {test_eval_bin_tuned['balanced_accuracy']:.4f}")
    print(f"  Locked Test Macro F1:               {test_eval_bin_tuned['macro_f1']:.4f}")
    print(f"  Safety-Critical Class I Recall:     {test_eval_bin_tuned['class_i_metrics']['recall']*100:.2f}%")
    print(f"  Class I Precision:                  {test_eval_bin_tuned['class_i_metrics']['precision']:.4f}")

    print("\nBinary Test Confusion Matrix (tuned threshold):")
    print(f"  Labels: {test_eval_bin_tuned['confusion_matrix']['labels']}")
    for row_idx, row in enumerate(test_eval_bin_tuned['confusion_matrix']['matrix']):
        print(f"  {test_eval_bin_tuned['confusion_matrix']['labels'][row_idx]:30s} {row}")

    # Save binary artifact
    print(f"\nSaving binary classifier artifact to {BINARY_MODEL_OUT_PATH}...")
    save_model_pipeline(bin_pipe, BINARY_MODEL_OUT_PATH, {
        "model_type": "TF-IDF + Hazard Indicators + Binary Logistic Regression C=0.5",
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "task": "binary (Class I vs Non-Class I)",
        "tuned_threshold": best_thresh,
        "test_accuracy": test_eval_bin_tuned["overall_accuracy"],
        "test_roc_auc": test_eval_bin_tuned["roc_auc"],
        "test_class_i_recall": test_eval_bin_tuned["class_i_metrics"]["recall"],
    })
    print(f"Saved ({BINARY_MODEL_OUT_PATH.stat().st_size:,} bytes).")

    # --- 3. METRICS JSON EXPORT ---
    optimization_metrics = {
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "evaluation_protocol_audit": {
            "chronological_test_split": "Past-to-future evaluation (Sep 2023 - Sep 2026), 0 event/cluster overlap, natural commercial firm recurrence (13.8% firm overlap).",
            "unseen_firm_split": "Firm-disjoint cross-firm evaluation across whole timeline (2008 - 2026). NOT chronological. Cannot be directly compared with future forecasting.",
            "retrospective_task_limitation": "openFDA dataset records finalized post-incident enforcement summaries. It reflects retrospective classification, not minute-0 prospective factory floor triage."
        },
        "baseline_reproduction": {
            "model": "TF-IDF + Multinomial Logistic Regression (C=1.0)",
            "test_accuracy": baseline_test_eval["overall_accuracy"],
            "test_macro_f1": baseline_test_eval["macro_f1"],
            "test_balanced_accuracy": baseline_test_eval["balanced_accuracy"],
            "test_class_i_recall": baseline_test_eval["per_class"]["Class I"]["recall"],
        },
        "experiment_a_three_class_improved": {
            "model": "TF-IDF (1,2 ngrams) + Transparent Hazard Indicators + Logistic Regression (C=0.5, balanced)",
            "validation_eval": val_eval_improved,
            "locked_test_eval": test_eval_improved,
            "delta_vs_baseline_acc": round(test_eval_improved["overall_accuracy"] - baseline_test_eval["overall_accuracy"], 4),
            "delta_vs_baseline_macro_f1": round(test_eval_improved["macro_f1"] - baseline_test_eval["macro_f1"], 4),
            "delta_vs_baseline_c1_recall": round(test_eval_improved["per_class"]["Class I"]["recall"] - baseline_test_eval["per_class"]["Class I"]["recall"], 4),
        },
        "experiment_c_binary_high_severity": {
            "model": "TF-IDF (1,2 ngrams) + Transparent Hazard Indicators + Binary Logistic Regression (C=0.5, balanced)",
            "tuned_validation_threshold": best_thresh,
            "validation_eval_default_thresh": val_eval_bin_default,
            "validation_eval_tuned_thresh": val_eval_bin_tuned,
            "locked_test_eval_default_thresh": test_eval_bin_default,
            "locked_test_eval_tuned_thresh": test_eval_bin_tuned,
            "target_comparison": {
                "achieved_test_accuracy": test_eval_bin_tuned["overall_accuracy"],
                "achieved_roc_auc": test_eval_bin_tuned["roc_auc"],
                "achieved_pr_auc": test_eval_bin_tuned["pr_auc"],
                "class_i_recall": test_eval_bin_tuned["class_i_metrics"]["recall"],
                "majority_baseline_acc": test_eval_bin_tuned["majority_class_baseline"]["baseline_accuracy"],
                "lift_over_majority": test_eval_bin_tuned["majority_class_baseline"]["accuracy_lift"],
            }
        }
    }

    OPTIMIZATION_METRICS_OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OPTIMIZATION_METRICS_OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(optimization_metrics, f, indent=2)
    print(f"\nOptimization metrics written to {OPTIMIZATION_METRICS_OUT_PATH}")

    # --- 4. VERIFY RELOAD & SAMPLE INFERENCE ---
    print("\nVerifying Artifact Reload & Sample Predictions...")
    rel_improved = load_model_pipeline(IMPROVED_MODEL_OUT_PATH)
    rel_binary = load_model_pipeline(BINARY_MODEL_OUT_PATH)

    samples = [
        ("Fresh Atlantic Salmon", "Positive for Listeria monocytogenes in production environment."),
        ("Chocolate chip cookies", "Contains undeclared peanut protein allergen."),
        ("Canned Corn 15oz", "Net weight quantity label mislabeled; metric volume omitted; no health hazard."),
    ]

    for prod, reason in samples:
        p3 = predict_recall_risk(rel_improved, prod, reason)
        pb = predict_binary_recall_risk(rel_binary, prod, reason, threshold=best_thresh)
        print(f"\nProduct: {prod}")
        print(f"  Reason:     {reason}")
        print(f"  3-Class:    {p3['predicted_class']} (confidence: {p3['confidence']})")
        print(f"  Binary:     {pb['predicted_binary_label']} (Class I prob: {pb['class_i_probability']})")

    print("\nMilestone 2.1 Optimization Execution Successfully Completed.")


if __name__ == "__main__":
    run_model_optimization()
