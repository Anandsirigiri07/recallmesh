"""RECALLMESH FastAPI API Layer package.

Provides REST endpoints wrapping the property graph engine and offline ML models.
"""

from src.recallmesh.api.app import app, create_app

__all__ = ["app", "create_app"]
