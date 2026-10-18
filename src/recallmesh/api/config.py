"""Configuration settings for RECALLMESH FastAPI backend service.

Provides environment-based configuration for local Docker development
and secure FalkorDB Cloud environments.
"""

import os
from pathlib import Path
from typing import List, Optional
from src.recallmesh.connection import get_connection_config

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"

# Active FalkorDB connection settings resolved via centralized connection module
_DB_CONFIG = get_connection_config()
FALKORDB_HOST: str = _DB_CONFIG.host
FALKORDB_PORT: int = _DB_CONFIG.port
FALKORDB_USERNAME: Optional[str] = _DB_CONFIG.username
FALKORDB_PASSWORD: Optional[str] = _DB_CONFIG.password
FALKORDB_SSL: bool = _DB_CONFIG.ssl
FALKORDB_GRAPH_NAME: str = _DB_CONFIG.graph_name

# Model artifact paths
MODEL_PATH_IMPROVED = MODELS_DIR / "recall_classifier_improved.joblib"
MODEL_PATH_BASELINE = MODELS_DIR / "recall_classifier.joblib"
MODEL_PATH_BINARY = MODELS_DIR / "recall_classifier_binary.joblib"

# Configurable CORS origins allowed (local development + deployed production origins)
CORS_ORIGINS: List[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Read optional comma-separated CORS_ALLOWED_ORIGINS from environment (e.g., https://recallmesh.vercel.app)
_env_origins = os.getenv("CORS_ALLOWED_ORIGINS")
if _env_origins:
    for origin in _env_origins.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned and cleaned not in CORS_ORIGINS:
            CORS_ORIGINS.append(cleaned)


# API metadata
API_TITLE = "RECALLMESH Traceability & Recall Intelligence API"
API_VERSION = "1.0.0"
API_DESCRIPTION = (
    "Production-quality REST API service for RECALLMESH food safety graph platform. "
    "Wraps FalkorDB property graph traversal, governance-gated action planning, "
    "and offline Scikit-learn recall risk classification."
)
