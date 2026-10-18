"""Main FastAPI application factory and routing assembly for RECALLMESH.

Combines graph traversal routes, ML inference routes, governance gates,
narrowly configured CORS middleware, and safe global exception handling.
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.recallmesh.api.config import (
    API_DESCRIPTION,
    API_TITLE,
    API_VERSION,
    CORS_ORIGINS,
)
from src.recallmesh.api.routes import (
    actions,
    audit,
    cases,
    cte,
    datasets,
    evidence,
    export,
    health,
    memory,
    ml,
    nodes,
    overview,
    search,
    trace,
)
from src.recallmesh.tracer import GovernanceException


def create_app() -> FastAPI:
    """Creates and configures a production-quality local RECALLMESH FastAPI application."""
    app = FastAPI(
        title=API_TITLE,
        version=API_VERSION,
        description=API_DESCRIPTION,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # 1. Narrow local CORS configuration for frontend Vite development
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    # 2. Global Exception Handlers
    @app.exception_handler(GovernanceException)
    async def governance_exception_handler(request: Request, exc: GovernanceException):
        """Catches domain governance rejections and serializes as clean HTTP 403."""
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"detail": str(exc), "error_type": "GovernanceException"},
        )

    # 3. Root informational route
    @app.get("/", tags=["Root"])
    def root_info():
        return {
            "name": API_TITLE,
            "version": API_VERSION,
            "docs": "/docs",
            "health": "/api/health",
            "environment": "local",
        }

    # 4. Include all API routers
    app.include_router(health.router)
    app.include_router(overview.router)
    app.include_router(trace.router)
    app.include_router(nodes.router)
    app.include_router(ml.router)
    app.include_router(actions.router)
    app.include_router(memory.router)
    app.include_router(search.router)
    app.include_router(export.router)
    app.include_router(cte.router)
    app.include_router(audit.router)
    app.include_router(evidence.router)
    app.include_router(cases.router)
    app.include_router(datasets.router)

    return app


# Module-level app instance for uvicorn entrypoint (e.g. uvicorn src.recallmesh.api.app:app)
app = create_app()
