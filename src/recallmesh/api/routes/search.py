"""Parameterized graph search endpoint across lots, shipments, facilities, and suppliers."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import SearchMatch, SearchResponse

router = APIRouter(tags=["Search"])


@router.get(
    "/api/search",
    response_model=SearchResponse,
    summary="Safely parameterized search across lots, shipments, facilities, and suppliers",
)
def search_graph(
    q: str = Query(..., min_length=1, max_length=100, description="Search term"),
    dataset_id: Optional[str] = Query(None, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> SearchResponse:
    """Provides parameterized, injection-safe graph search across supply chain records.
    
    Rejects malformed, blank, or excessively long queries with HTTP 400.
    Returns an explicit empty result when nothing matches.
    """
    clean_term = q.strip()
    if not clean_term:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query cannot be empty or whitespace.",
        )

    clean_ds = dataset_id.strip() if dataset_id else None

    # Parameterized Cypher query with $term (case-insensitive)
    lower_term = clean_term.lower()
    search_query = """
    MATCH (n)
    WHERE ((n:RawLot AND toLower(n.lot_code) CONTAINS $lower_term)
       OR (n:FinishedLot AND (toLower(n.lot_code) CONTAINS $lower_term OR toLower(n.product_name) CONTAINS $lower_term))
       OR (n:Shipment AND (toLower(n.shipment_id) CONTAINS $lower_term OR toLower(n.carrier_name) CONTAINS $lower_term))
       OR (n:Supplier AND (toLower(n.supplier_id) CONTAINS $lower_term OR toLower(n.name) CONTAINS $lower_term))
       OR (n:Location AND (toLower(n.location_id) CONTAINS $lower_term OR toLower(n.name) CONTAINS $lower_term))
       OR (n:ProductionEvent AND (toLower(n.event_id) CONTAINS $lower_term OR toLower(n.facility_id) CONTAINS $lower_term)))
      AND ($clean_ds IS NULL OR n.dataset_id = $clean_ds OR (n.dataset_id IS NULL AND $clean_ds = 'demo'))
    RETURN labels(n)[0] AS entity_type,
           coalesce(n.lot_code, n.shipment_id, n.supplier_id, n.location_id, n.event_id) AS entity_id,
           coalesce(n.product_name, n.name, n.carrier_name, n.title, n.lot_code, n.event_id) AS display_name,
           n.traceability_status AS traceability_status,
           coalesce(n.disposition, n.shipping_disposition) AS disposition
    LIMIT 50
    """
    res = graph.query(search_query, {"lower_term": lower_term, "clean_ds": clean_ds})

    matches: List[SearchMatch] = []
    for row in res.result_set:
        e_type, e_id, d_name, t_status, disp = row
        if e_id:
            matches.append(
                SearchMatch(
                    entity_type=e_type or "Unknown",
                    entity_id=e_id,
                    display_name=d_name or e_id,
                    traceability_status=t_status,
                    disposition=disp,
                )
            )

    return SearchResponse(
        query=clean_term,
        total_matches=len(matches),
        matches=matches,
    )
