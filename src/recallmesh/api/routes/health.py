"""Health check route for RECALLMESH API."""

from datetime import datetime, timezone
from fastapi import APIRouter, Response, status

from src.recallmesh.api.config import (
    API_VERSION,
    FALKORDB_GRAPH_NAME,
    FALKORDB_HOST,
    FALKORDB_PASSWORD,
    FALKORDB_PORT,
    FALKORDB_SSL,
    FALKORDB_USERNAME,
)
from src.recallmesh.api.schemas import HealthResponse
from src.recallmesh.connection import ping_falkordb

router = APIRouter(tags=["Health"])


@router.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Health check reporting API and FalkorDB connectivity accurately",
)
def get_health(response: Response) -> HealthResponse:
    """Accurately checks and reports the status of the local or cloud FalkorDB service.
    
    Returns HTTP 503 Service Unavailable if FalkorDB is unreachable.
    Does NOT report FalkorDB as healthy when the connection fails.
    """
    is_db_up = ping_falkordb(
        host=FALKORDB_HOST,
        port=FALKORDB_PORT,
        password=FALKORDB_PASSWORD,
        username=FALKORDB_USERNAME,
        ssl=FALKORDB_SSL,
    )
    now_iso = datetime.now(timezone.utc).isoformat()

    if not is_db_up:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return HealthResponse(
            status="degraded",
            falkordb_connected=False,
            graph_name=FALKORDB_GRAPH_NAME,
            version=API_VERSION,
            timestamp_utc=now_iso,
            note=f"FalkorDB service unreachable at {FALKORDB_HOST}:{FALKORDB_PORT}",
        )

    return HealthResponse(
        status="healthy",
        falkordb_connected=True,
        graph_name=FALKORDB_GRAPH_NAME,
        version=API_VERSION,
        timestamp_utc=now_iso,
        note=None,
    )
