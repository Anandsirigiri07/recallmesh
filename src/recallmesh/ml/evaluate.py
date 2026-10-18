"""Rigorous evaluation, baseline comparison, metrics computation, and error analysis.
"""

from collections import Counter
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.pipeline import Pipeline

STANDARD_CLASS_ORDER = ["Class I", "Class II", "Class III"]


def evaluate_classifier(
    pipeline: Pipeline,
    records: List[Dict[str, Any]],
    class_order: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Computes rigorous classification metrics on an evaluation record partition.
    
    Returns:
    - Overall accuracy
    - Macro F1, Weighted F1
    - Balanced accuracy
    - Per-class precision, recall, and F1
    - Formatted confusion matrix with explicit class order
    - Majority class baseline comparison
    - Class counts and percentages
    """
    if not records:
        raise ValueError("Cannot evaluate model on empty records list.")

    classes = class_order or STANDARD_CLASS_ORDER
    X = [r["text"] for r in records]
    y_true = [r["classification"] for r in records]

    y_pred = pipeline.predict(X)

    acc = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    bal_acc = float(balanced_accuracy_score(y_true, y_pred))

    # Per-class metrics
    per_class_prec = precision_score(y_true, y_pred, labels=classes, average=None, zero_division=0)
    per_class_rec = recall_score(y_true, y_pred, labels=classes, average=None, zero_division=0)
    per_class_f1 = f1_score(y_true, y_pred, labels=classes, average=None, zero_division=0)

    class_counts = Counter(y_true)
    total_samples = len(y_true)

    per_class_metrics = {}
    for idx, cls_name in enumerate(classes):
        cnt = class_counts.get(cls_name, 0)
        per_class_metrics[cls_name] = {
            "precision": round(float(per_class_prec[idx]), 4),
            "recall": round(float(per_class_rec[idx]), 4),
            "f1_score": round(float(per_class_f1[idx]), 4),
            "support": int(cnt),
            "prevalence_pct": round((cnt / total_samples) * 100, 2),
        }

    # Confusion matrix with fixed class order
    cm = confusion_matrix(y_true, y_pred, labels=classes)
    formatted_cm = {
        "labels": classes,
        "matrix": [[int(cell) for cell in row] for row in cm],
    }

    # Majority class baseline
    most_common_class, most_common_count = class_counts.most_common(1)[0]
    majority_baseline_acc = float(most_common_count / total_samples)
    acc_delta_vs_baseline = acc - majority_baseline_acc

    # Target comparison (90% target)
    meets_90_target = acc >= 0.90

    return {
        "sample_count": total_samples,
        "overall_accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "per_class": per_class_metrics,
        "confusion_matrix": formatted_cm,
        "majority_class_baseline": {
            "majority_class": most_common_class,
            "baseline_accuracy": round(majority_baseline_acc, 4),
            "accuracy_lift": round(acc_delta_vs_baseline, 4),
        },
        "target_comparison": {
            "aspiration_accuracy": 0.90,
            "achieved_accuracy": round(acc, 4),
            "target_achieved": meets_90_target,
            "gap_to_target": round(0.90 - acc, 4) if not meets_90_target else 0.0,
        },
    }


def extract_error_analysis(
    pipeline: Pipeline,
    records: List[Dict[str, Any]],
    max_errors: int = 15,
) -> List[Dict[str, Any]]:
    """Extracts misclassified examples with explanatory detail for qualitative error analysis."""
    X = [r["text"] for r in records]
    y_true = [r["classification"] for r in records]
    y_pred = pipeline.predict(X)

    probs = None
    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba(X)

    misclassified = []
    for idx, (true_label, pred_label) in enumerate(zip(y_true, y_pred)):
        if true_label != pred_label:
            confidence = float(max(probs[idx])) if probs is not None else 0.0
            r = records[idx]
            misclassified.append({
                "event_id": r.get("event_id"),
                "recall_number": r.get("recall_number"),
                "recalling_firm": r.get("recalling_firm"),
                "true_class": true_label,
                "predicted_class": pred_label,
                "confidence": round(confidence, 4),
                "reason_for_recall": r.get("reason_for_recall", "")[:180],
                "product_description": r.get("product_description", "")[:120],
            })
            if len(misclassified) >= max_errors:
                break

    return misclassified


def verify_split_isolation(
    train_records: List[Dict[str, Any]],
    val_records: List[Dict[str, Any]],
    test_records: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Verifies that no cluster_id or connected event overlaps between partitions."""
    train_clusters = set(r["cluster_id"] for r in train_records)
    val_clusters = set(r["cluster_id"] for r in val_records)
    test_clusters = set(r["cluster_id"] for r in test_records)

    overlap_train_val = train_clusters & val_clusters
    overlap_train_test = train_clusters & test_clusters
    overlap_val_test = val_clusters & test_clusters

    has_leakage = bool(overlap_train_val or overlap_train_test or overlap_val_test)

    train_dates = sorted(r["date"] for r in train_records)
    val_dates = sorted(r["date"] for r in val_records)
    test_dates = sorted(r["date"] for r in test_records)

    return {
        "zero_cluster_leakage": not has_leakage,
        "overlap_train_val_count": len(overlap_train_val),
        "overlap_train_test_count": len(overlap_train_test),
        "overlap_val_test_count": len(overlap_val_test),
        "train_min_date": train_dates[0] if train_dates else None,
        "train_max_date": train_dates[-1] if train_dates else None,
        "val_min_date": val_dates[0] if val_dates else None,
        "val_max_date": val_dates[-1] if val_dates else None,
        "test_min_date": test_dates[0] if test_dates else None,
        "test_max_date": test_dates[-1] if test_dates else None,
    }


def evaluate_binary_classifier(
    pipeline: Pipeline,
    records: List[Dict[str, Any]],
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Evaluates a binary classifier for Class I (label=1) vs Non-Class I (label=0).
    
    Computes accuracy, balanced accuracy, macro F1, Class I precision & recall,
    ROC AUC, PR AUC, 2x2 confusion matrix, and majority class baseline comparison.
    """
    from sklearn.metrics import (
        average_precision_score,
        roc_auc_score,
    )

    if not records:
        raise ValueError("Cannot evaluate binary model on empty records list.")

    X = [r["text"] for r in records]
    y_true = np.array([1 if r["classification"] == "Class I" else 0 for r in records])

    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba(X)
        y_prob = probs[:, 1] if probs.shape[1] > 1 else probs[:, 0]
    elif hasattr(pipeline, "decision_function"):
        scores = pipeline.decision_function(X)
        y_prob = 1.0 / (1.0 + np.exp(-scores))
    else:
        y_prob = np.array(pipeline.predict(X), dtype=float)

    y_pred = (y_prob >= threshold).astype(int)

    acc = float(accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    weighted_f1 = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    bal_acc = float(balanced_accuracy_score(y_true, y_pred))

    c1_prec = float(precision_score(y_true, y_pred, pos_label=1, zero_division=0))
    c1_rec = float(recall_score(y_true, y_pred, pos_label=1, zero_division=0))
    c1_f1 = float(f1_score(y_true, y_pred, pos_label=1, zero_division=0))

    non_c1_prec = float(precision_score(y_true, y_pred, pos_label=0, zero_division=0))
    non_c1_rec = float(recall_score(y_true, y_pred, pos_label=0, zero_division=0))
    non_c1_f1 = float(f1_score(y_true, y_pred, pos_label=0, zero_division=0))

    roc_auc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0
    pr_auc = float(average_precision_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0

    total_samples = len(y_true)
    class_i_count = int(np.sum(y_true))
    non_class_i_count = total_samples - class_i_count

    # 2x2 confusion matrix (fixed order: [[TN, FP], [FN, TP]])
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    cm_formatted = {
        "labels": ["Non-Class I (Class II/III)", "Class I"],
        "matrix": [[int(cell) for cell in row] for row in cm],
    }

    # Majority baseline
    majority_count = max(class_i_count, non_class_i_count)
    majority_class_name = "Non-Class I" if non_class_i_count >= class_i_count else "Class I"
    majority_baseline_acc = float(majority_count / total_samples)

    return {
        "sample_count": total_samples,
        "class_i_count": class_i_count,
        "non_class_i_count": non_class_i_count,
        "threshold_applied": threshold,
        "overall_accuracy": round(acc, 4),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "balanced_accuracy": round(bal_acc, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "class_i_metrics": {
            "precision": round(c1_prec, 4),
            "recall": round(c1_rec, 4),
            "f1_score": round(c1_f1, 4),
            "support": class_i_count,
            "prevalence_pct": round((class_i_count / total_samples) * 100, 2),
        },
        "non_class_i_metrics": {
            "precision": round(non_c1_prec, 4),
            "recall": round(non_c1_rec, 4),
            "f1_score": round(non_c1_f1, 4),
            "support": non_class_i_count,
            "prevalence_pct": round((non_class_i_count / total_samples) * 100, 2),
        },
        "confusion_matrix": cm_formatted,
        "majority_class_baseline": {
            "majority_class": majority_class_name,
            "baseline_accuracy": round(majority_baseline_acc, 4),
            "accuracy_lift": round(acc - majority_baseline_acc, 4),
        },
    }
