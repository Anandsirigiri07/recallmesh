"""Typed JSON endpoint for Critical Tracking Events (CTEs)."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import CTERecord, CTERecordsResponse
from src.recallmesh.cte import fetch_cte_records

router = APIRouter(tags=["Critical Tracking Events"])


@router.get(
    "/api/cte/records",
    response_model=CTERecordsResponse,
    summary="Retrieve Critical Tracking Events (Receiving, Transformation, Shipping) from stored graph",
)
def get_cte_records(
    raw_lot_code: Optional[str] = Query(None, description="Optional raw lot filter"),
    graph: Graph = Depends(get_active_graph),
) -> CTERecordsResponse:
    """Returns actual Critical Tracking Events (CTEs) stored in FalkorDB as typed JSON.
    
    Derives genuine Receiving, Transformation, and Shipping records.
    Missing fields remain null/empty without fabricating phantom events.
    """
    records_data = fetch_cte_records(graph, raw_lot_code)
    records = [CTERecord(**r) for r in records_data]
    return CTERecordsResponse(records=records, total_records=len(records))
