"""FastAPI dependencies for RECALLMESH API.

Provides clean dependency injection for the FalkorDB Graph instance
and Scikit-learn offline model pipelines with in-memory caching.
"""

import logging
from typing import Dict
from falkordb import Graph
from sklearn.pipeline import Pipeline

from src.recallmesh.api.config import (
    FALKORDB_GRAPH_NAME,
    FALKORDB_HOST,
    FALKORDB_PASSWORD,
    FALKORDB_PORT,
    FALKORDB_SSL,
    FALKORDB_USERNAME,
    MODEL_PATH_BASELINE,
    MODEL_PATH_BINARY,
    MODEL_PATH_IMPROVED,
)
from src.recallmesh.connection import get_graph
from src.recallmesh.ml.pipeline import load_model_pipeline

logger = logging.getLogger(__name__)

# Global model cache to avoid reloading heavy joblib pipelines on every request
_MODEL_CACHE: Dict[str, Pipeline] = {}


def get_active_graph() -> Graph:
    """Dependency provider for the active FalkorDB Graph instance.
    
    Can be overridden in tests via app.dependency_overrides[get_active_graph]
    to target a dedicated test graph.
    """
    return get_graph(
        graph_name=FALKORDB_GRAPH_NAME,
        host=FALKORDB_HOST,
        port=FALKORDB_PORT,
        password=FALKORDB_PASSWORD,
        username=FALKORDB_USERNAME,
        ssl=FALKORDB_SSL,
    )


def get_cached_model(model_type: str = "improved_three_class") -> Pipeline:
    """Retrieves or loads the requested model artifact into memory.
    
    Supported types:
    - 'improved_three_class': models/recall_classifier_improved.joblib
    - 'baseline_three_class': models/recall_classifier.joblib
    - 'binary': models/recall_classifier_binary.joblib
    """
    if model_type in _MODEL_CACHE:
        return _MODEL_CACHE[model_type]

    if model_type == "improved_three_class":
        path = MODEL_PATH_IMPROVED
    elif model_type == "baseline_three_class":
        path = MODEL_PATH_BASELINE
    elif model_type == "binary":
        path = MODEL_PATH_BINARY
    else:
        raise ValueError(
            f"Unsupported model_type '{model_type}'. "
            "Supported options: 'improved_three_class', 'baseline_three_class', 'binary'."
        )

    logger.info(f"Loading model artifact from {path}...")
    pipeline = load_model_pipeline(path)
    _MODEL_CACHE[model_type] = pipeline
    return pipeline
