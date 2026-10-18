"""Machine learning pipeline definitions, persistence, and inference logic for RECALLMESH.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from src.recallmesh.ml.data import clean_text_narrative

RESEARCH_DISCLAIMER = (
    "NOTICE: Offline research classifier prediction only. "
    "This advisory output is not an authoritative recall determination, does not declare any product safe, "
    "and does not authorize quarantine, shipment hold, or regulatory notifications without human QA review."
)


def build_baseline_pipeline(
    max_features: int = 5000,
    random_state: int = 42,
    c_param: float = 1.0,
    min_df: int = 1,
) -> Pipeline:
    """Constructs the baseline TF-IDF + Multinomial Logistic Regression pipeline.
    
    Uses:
    - TF-IDF vectorizer: unigrams and bigrams, max_features <= 5000, sublinear_tf=True
    - Multinomial Logistic Regression: solver='lbfgs', class_weight='balanced', fixed random_state
    """
    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=max_features,
        sublinear_tf=True,
        min_df=min_df,
    )
    clf = LogisticRegression(
        solver="lbfgs",
        C=c_param,
        class_weight="balanced",
        max_iter=1000,
        random_state=random_state,
    )
    return Pipeline([
        ("tfidf", tfidf),
        ("clf", clf),
    ])


def build_svm_pipeline(
    max_features: int = 5000,
    random_state: int = 42,
    c_param: float = 1.0,
    calibrate: bool = True,
    min_df: int = 1,
) -> Pipeline:
    """Constructs a TF-IDF + Linear SVM pipeline.
    
    If calibrate=True, wraps LinearSVC in CalibratedClassifierCV(cv=3)
    to output genuine calibrated probability distributions across classes.
    """
    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=max_features,
        sublinear_tf=True,
        min_df=min_df,
    )
    base_svc = LinearSVC(
        C=c_param,
        class_weight="balanced",
        random_state=random_state,
        max_iter=2000,
    )
    if calibrate:
        clf = CalibratedClassifierCV(estimator=base_svc, cv=3)
    else:
        clf = base_svc

    return Pipeline([
        ("tfidf", tfidf),
        ("clf", clf),
    ])


def save_model_pipeline(
    pipeline: Pipeline,
    filepath: Path | str,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Saves the fitted pipeline and optional metadata to a joblib artifact file."""
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "pipeline": pipeline,
        "metadata": metadata or {},
    }
    joblib.dump(payload, path)


def load_model_pipeline(filepath: Path | str) -> Pipeline:
    """Loads a fitted pipeline artifact from a joblib file.
    
    Returns the Scikit-learn Pipeline instance.
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"Model artifact not found at {path}")
    loaded = joblib.load(path)
    if isinstance(loaded, dict) and "pipeline" in loaded:
        return loaded["pipeline"]
    return loaded


def predict_recall_risk(
    pipeline: Pipeline,
    product_description: str,
    reason_for_recall: str,
) -> Dict[str, Any]:
    """Runs inference on a single recall narrative and returns the advisory assessment.
    
    Returns structured results including predicted class, probabilities, confidence,
    and the mandatory research disclaimer.
    """
    clean_prod = clean_text_narrative(product_description)
    clean_reason = clean_text_narrative(reason_for_recall)

    if not clean_prod and not clean_reason:
        return {
            "predicted_class": "UNKNOWN",
            "confidence": 0.0,
            "class_probabilities": {},
            "top_explanatory_features": [],
            "status": "INSUFFICIENT_TEXT",
            "disclaimer": RESEARCH_DISCLAIMER,
        }

    input_text = f"{clean_reason} {clean_prod}".strip()
    predicted_class = pipeline.predict([input_text])[0]

    class_probs: Dict[str, float] = {}
    confidence: float = 0.0

    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba([input_text])[0]
        classes = pipeline.classes_
        for cls_name, p in zip(classes, probs):
            class_probs[str(cls_name)] = round(float(p), 4)
        confidence = round(float(max(probs)), 4)
    elif hasattr(pipeline, "decision_function"):
        scores = pipeline.decision_function([input_text])[0]
        confidence = round(float(max(scores)), 4)

    # Extract top matching n-gram terms for explainability
    tfidf = pipeline.named_steps.get("tfidf")
    if not tfidf and "features" in pipeline.named_steps:
        union_feats = pipeline.named_steps["features"]
        if hasattr(union_feats, "named_transformers"):
            tfidf = union_feats.named_transformers.get("tfidf")

    top_features: List[str] = []
    if tfidf:
        transformed = tfidf.transform([input_text])
        feature_names = tfidf.get_feature_names_out()
        nonzero_indices = transformed.nonzero()[1]
        sorted_indices = sorted(nonzero_indices, key=lambda idx: transformed[0, idx], reverse=True)
        top_features = [feature_names[idx] for idx in sorted_indices[:6]]

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "class_probabilities": class_probs,
        "top_explanatory_features": top_features,
        "status": "PREDICTED_ADVISORY",
        "disclaimer": RESEARCH_DISCLAIMER,
    }


def build_improved_three_class_pipeline(
    max_features: int = 5000,
    random_state: int = 42,
    c_param: float = 0.5,
    min_df: int = 1,
) -> Pipeline:
    """Constructs the improved 3-class pipeline with TF-IDF ngrams and transparent hazard indicators."""
    from src.recallmesh.ml.features import HazardFeatureExtractor
    from sklearn.pipeline import FeatureUnion

    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=max_features,
        sublinear_tf=True,
        min_df=min_df,
    )
    features = FeatureUnion([
        ("tfidf", tfidf),
        ("hazard", HazardFeatureExtractor()),
    ])
    clf = LogisticRegression(
        solver="lbfgs",
        C=c_param,
        class_weight="balanced",
        max_iter=1000,
        random_state=random_state,
    )
    return Pipeline([
        ("features", features),
        ("clf", clf),
    ])


def build_binary_classifier_pipeline(
    max_features: int = 5000,
    random_state: int = 42,
    c_param: float = 0.5,
    min_df: int = 1,
) -> Pipeline:
    """Constructs the separate binary classifier (Class I vs Non-Class I)."""
    from src.recallmesh.ml.features import HazardFeatureExtractor
    from sklearn.pipeline import FeatureUnion

    tfidf = TfidfVectorizer(
        ngram_range=(1, 2),
        max_features=max_features,
        sublinear_tf=True,
        min_df=min_df,
    )
    features = FeatureUnion([
        ("tfidf", tfidf),
        ("hazard", HazardFeatureExtractor()),
    ])
    clf = LogisticRegression(
        solver="lbfgs",
        C=c_param,
        class_weight="balanced",
        max_iter=1000,
        random_state=random_state,
    )
    return Pipeline([
        ("features", features),
        ("clf", clf),
    ])


def predict_binary_recall_risk(
    pipeline: Pipeline,
    product_description: str,
    reason_for_recall: str,
    threshold: float = 0.5,
) -> Dict[str, Any]:
    """Runs binary inference to classify whether an incident represents a high-severity Class I hazard.
    
    Returns structured results including binary label ('Class I' or 'Class II/III'),
    probability of Class I, applied decision threshold, and research disclaimer.
    """
    clean_prod = clean_text_narrative(product_description)
    clean_reason = clean_text_narrative(reason_for_recall)

    if not clean_prod and not clean_reason:
        return {
            "predicted_binary_label": "UNKNOWN",
            "is_class_i": False,
            "class_i_probability": 0.0,
            "threshold_applied": threshold,
            "status": "INSUFFICIENT_TEXT",
            "disclaimer": RESEARCH_DISCLAIMER,
        }

    input_text = f"{clean_reason} {clean_prod}".strip()
    class_i_prob = 0.0

    if hasattr(pipeline, "predict_proba"):
        probs = pipeline.predict_proba([input_text])[0]
        # Label 1 corresponds to Class I
        class_i_prob = round(float(probs[1]), 4) if len(probs) > 1 else round(float(probs[0]), 4)

    is_class_i = bool(class_i_prob >= threshold)
    predicted_label = "Class I (High Severity)" if is_class_i else "Class II / III (Moderate to Low)"

    return {
        "predicted_binary_label": predicted_label,
        "is_class_i": is_class_i,
        "class_i_probability": class_i_prob,
        "non_class_i_probability": round(1.0 - class_i_prob, 4),
        "threshold_applied": threshold,
        "status": "PREDICTED_ADVISORY",
        "disclaimer": RESEARCH_DISCLAIMER,
    }
