"""RECALLMESH Machine Learning Module for Preliminary Food-Recall Risk Classification.

Note:
This module is strictly for offline research and exploratory triage.
Model predictions are non-authoritative advisory estimates and do not
replace formal food safety authority reviews, human verification,
or regulatory recall procedures.
"""

from src.recallmesh.ml.data import (
    clean_text_narrative,
    create_chronological_grouped_splits,
    create_unseen_firm_split,
    load_raw_openfda_dataset,
    prepare_dataset,
)
from src.recallmesh.ml.features import (
    HazardFeatureExtractor,
    HAZARD_CATEGORY_RULES,
)
from src.recallmesh.ml.evaluate import (
    evaluate_classifier,
    evaluate_binary_classifier,
    extract_error_analysis,
    verify_split_isolation,
)
from src.recallmesh.ml.pipeline import (
    build_baseline_pipeline,
    build_svm_pipeline,
    build_improved_three_class_pipeline,
    build_binary_classifier_pipeline,
    load_model_pipeline,
    predict_recall_risk,
    predict_binary_recall_risk,
    save_model_pipeline,
)

__all__ = [
    "clean_text_narrative",
    "create_chronological_grouped_splits",
    "create_unseen_firm_split",
    "load_raw_openfda_dataset",
    "prepare_dataset",
    "evaluate_classifier",
    "evaluate_binary_classifier",
    "extract_error_analysis",
    "verify_split_isolation",
    "build_baseline_pipeline",
    "build_svm_pipeline",
    "build_improved_three_class_pipeline",
    "build_binary_classifier_pipeline",
    "load_model_pipeline",
    "predict_recall_risk",
    "predict_binary_recall_risk",
    "save_model_pipeline",
    "HazardFeatureExtractor",
    "HAZARD_CATEGORY_RULES",
]
