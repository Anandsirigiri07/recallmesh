"""Machine learning inference and evaluation benchmark metadata endpoints."""

from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from src.recallmesh.api.dependencies import get_cached_model
from src.recallmesh.api.schemas import (
    PredictRiskRequest,
    PredictRiskResponse,
    PublishedMetricsBenchmark,
)
from src.recallmesh.ml.pipeline import (
    RESEARCH_DISCLAIMER,
    predict_binary_recall_risk,
    predict_recall_risk,
)

router = APIRouter(tags=["Machine Learning"])

# Documented benchmark metrics from locked evaluation reports
PUBLISHED_BENCHMARKS: Dict[str, PublishedMetricsBenchmark] = {
    "baseline_three_class": PublishedMetricsBenchmark(
        model_name="TF-IDF + Multinomial Logistic Regression (Baseline)",
        test_accuracy=0.6466,
        test_macro_f1=0.5600,
        test_class_i_recall=0.7488,
        note="Baseline evaluation score on locked chronological test set (Sep 2023 - Sep 2026).",
    ),
    "improved_three_class": PublishedMetricsBenchmark(
        model_name="TF-IDF (1,2 ngrams) + Hazard Indicators + Logistic Regression (Improved)",
        test_accuracy=0.6655,
        test_macro_f1=0.5818,
        test_class_i_recall=0.7975,
        note="Chronological test score with +4.87% Class I recall improvement; aspiration target of 90% was not reached.",
    ),
    "binary": PublishedMetricsBenchmark(
        model_name="Binary Class I Severity Classifier (TF-IDF + Hazard Indicators)",
        test_accuracy=0.7611,
        test_class_i_recall=0.8374,
        test_roc_auc=0.8241,
        note="Binary test accuracy at 0.43 threshold (or 77.08% at 0.50 threshold); documented test benchmark.",
    ),
}


@router.post(
    "/api/ml/predict-risk",
    response_model=PredictRiskResponse,
    summary="Advisory recall severity classification using offline Scikit-learn models",
)
def predict_risk(request: PredictRiskRequest) -> PredictRiskResponse:
    """Invokes the selected offline Scikit-learn model artifact to classify recall risk.
    
    Preserves the ML pipeline's research disclaimer verbatim.
    Keeps three-class predictions distinct from binary predictions.
    Clearly distinguishes model inference from published test-set evaluation metrics.
    """
    model_type = (request.model_type or "improved_three_class").lower()
    if model_type not in PUBLISHED_BENCHMARKS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown model_type '{request.model_type}'. "
                f"Supported options: {list(PUBLISHED_BENCHMARKS.keys())}"
            ),
        )

    try:
        pipeline = get_cached_model(model_type)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load model pipeline '{model_type}': {str(e)}",
        )

    benchmark = PUBLISHED_BENCHMARKS[model_type]

    if model_type == "binary":
        # Binary prediction (Class I vs Non-Class I)
        threshold = request.threshold if request.threshold is not None else 0.43
        res = predict_binary_recall_risk(
            pipeline=pipeline,
            product_description=request.product_description,
            reason_for_recall=request.reason_for_recall,
            threshold=threshold,
        )
        return PredictRiskResponse(
            model_type=model_type,
            task_type="binary_severity_classification",
            predicted_binary_label=res.get("predicted_binary_label"),
            is_class_i=res.get("is_class_i"),
            class_i_probability=res.get("class_i_probability"),
            non_class_i_probability=res.get("non_class_i_probability"),
            threshold_applied=res.get("threshold_applied"),
            status=res.get("status", "PREDICTED_ADVISORY"),
            disclaimer=res.get("disclaimer", RESEARCH_DISCLAIMER),
            published_benchmark_metrics=benchmark,
        )
    else:
        # Three-class prediction (Class I / Class II / Class III)
        res = predict_recall_risk(
            pipeline=pipeline,
            product_description=request.product_description,
            reason_for_recall=request.reason_for_recall,
        )
        return PredictRiskResponse(
            model_type=model_type,
            task_type="three_class_classification",
            predicted_class=res.get("predicted_class"),
            confidence=res.get("confidence"),
            class_probabilities=res.get("class_probabilities"),
            top_explanatory_features=res.get("top_explanatory_features"),
            status=res.get("status", "PREDICTED_ADVISORY"),
            disclaimer=res.get("disclaimer", RESEARCH_DISCLAIMER),
            published_benchmark_metrics=benchmark,
        )


@router.get(
    "/api/ml/benchmark-metrics",
    summary="Documented test evaluation metrics for all trained offline models",
)
def get_benchmark_metrics() -> Dict[str, Any]:
    """Returns official documented evaluation benchmarks from offline training reports.
    
    Clearly represents historical evaluation results on locked test datasets.
    """
    return {
        "evaluation_protocol": "Past-to-future chronological grouped split with zero cluster leakage",
        "models": {k: v.model_dump() for k, v in PUBLISHED_BENCHMARKS.items()},
        "aspiration_comparison": {
            "target_accuracy": "80-90%",
            "achieved_three_class_accuracy": "66.55%",
            "target_reached": False,
            "audit_conclusion": "Task difficulty and historical ambiguity limit accuracy without compromising safety.",
        },
    }
