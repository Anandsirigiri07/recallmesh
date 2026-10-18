"""Persistent audit trail timeline routes."""

from fastapi import APIRouter, Depends, Query
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import AuditEvent, AuditTimelineResponse
from src.recallmesh.audit import get_audit_events

router = APIRouter(tags=["Audit Trail"])


@router.get(
    "/api/audit/timeline",
    response_model=AuditTimelineResponse,
    summary="Retrieve persistent audit event timeline",
)
def get_timeline(
    limit: int = Query(50, ge=1, le=200, description="Maximum events to return"),
    graph: Graph = Depends(get_active_graph),
) -> AuditTimelineResponse:
    """Returns chronologically ordered audit events recorded during real application operations."""
    events_data = get_audit_events(graph, limit)
    events = [AuditEvent(**e) for e in events_data]
    return AuditTimelineResponse(events=events, total_events=len(events))
