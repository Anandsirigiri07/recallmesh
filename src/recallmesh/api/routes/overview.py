"""Overview metrics endpoint for RECALLMESH dashboard."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import CaseSummary, OverviewMetricsResponse
from src.recallmesh.tracer import detect_traceability_gaps

router = APIRouter(tags=["Overview"])


@router.get(
    "/api/overview/metrics",
    response_model=OverviewMetricsResponse,
    summary="Dashboard metrics derived strictly from actual graph state",
)
def get_overview_metrics(
    dataset_id: Optional[str] = Query(None, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> OverviewMetricsResponse:
    """Computes real-time overview metrics directly from FalkorDB.
    
    Derives summary data from actual graph records and existing query functions.
    Does NOT fabricate counters or activities.
    """
    clean_ds = dataset_id.strip() if dataset_id else None

    # 1. Active recall cases
    case_query = """
    MATCH (c:RecallCase)
    WHERE ($clean_ds IS NULL OR c.dataset_id = $clean_ds OR (c.dataset_id IS NULL AND $clean_ds = 'demo'))
    RETURN count(c) AS cnt
    """
    case_res = graph.query(case_query, {"clean_ds": clean_ds})
    active_cases_count = case_res.result_set[0][0] if case_res.result_set else 0

    # 2. Detailed current case query
    curr_case_res = graph.query(
        """
        MATCH (c:RecallCase)
        WHERE ($clean_ds IS NULL OR c.dataset_id = $clean_ds OR (c.dataset_id IS NULL AND $clean_ds = 'demo'))
        OPTIONAL MATCH (c)-[:INVESTIGATES]->(r:RawLot)
        RETURN c.case_id AS case_id,
               c.opened_at AS opened_at,
               c.hazard_type AS hazard_type,
               c.pathogen_or_hazard AS pathogen_or_hazard,
               r.lot_code AS suspect_raw_lot,
               c.provisional_class AS provisional_class,
               c.lifecycle_status AS lifecycle_status
        LIMIT 1
        """,
        {"clean_ds": clean_ds},
    )
    current_case: Optional[CaseSummary] = None
    if curr_case_res.result_set:
        row = curr_case_res.result_set[0]
        current_case = CaseSummary(
            case_id=row[0] or "UNASSIGNED",
            opened_at=row[1],
            hazard_type=row[2],
            pathogen_or_hazard=row[3],
            suspect_raw_lot=row[4],
            provisional_class=row[5],
            lifecycle_status=row[6],
        )

    # 3. Shipments connected to affected or investigated finished lots
    shipments_res = graph.query(
        """
        MATCH (s:Shipment)
        WHERE s.shipping_disposition IN ['IN_TRANSIT', 'DELIVERED']
          AND ($clean_ds IS NULL OR s.dataset_id = $clean_ds OR (s.dataset_id IS NULL AND $clean_ds = 'demo'))
        RETURN count(s) AS cnt
        """,
        {"clean_ds": clean_ds},
    )
    shipments_traced_count = shipments_res.result_set[0][0] if shipments_res.result_set else 0

    # 4. Gaps detected using verified gap detection algorithm
    gaps_result = detect_traceability_gaps(graph, dataset_id=clean_ds)
    gaps_open_count = gaps_result.get("total_gaps_found", 0)

    # 5. Records needing review (e.g. status UNKNOWN or NEEDS_REVIEW)
    review_res = graph.query(
        """
        MATCH (n)
        WHERE n.traceability_status IN ['NEEDS_REVIEW', 'UNKNOWN', 'GAP_DETECTED']
          AND ($clean_ds IS NULL OR n.dataset_id = $clean_ds OR (n.dataset_id IS NULL AND $clean_ds = 'demo'))
        RETURN count(n) AS cnt
        """,
        {"clean_ds": clean_ds},
    )
    records_needing_review_count = review_res.result_set[0][0] if review_res.result_set else 0

    # 6. Finished lot disposition breakdown
    lots_res = graph.query(
        """
        MATCH (f:FinishedLot)
        WHERE ($clean_ds IS NULL OR f.dataset_id = $clean_ds OR (f.dataset_id IS NULL AND $clean_ds = 'demo'))
        RETURN count(f) AS total,
               sum(CASE WHEN f.disposition = 'QUARANTINED' THEN 1 ELSE 0 END) AS quarantined,
               sum(CASE WHEN f.disposition = 'AVAILABLE' THEN 1 ELSE 0 END) AS available
        """,
        {"clean_ds": clean_ds},
    )
    if lots_res.result_set:
        total_fl = lots_res.result_set[0][0]
        quarantined_fl = lots_res.result_set[0][1] or 0
        available_fl = lots_res.result_set[0][2] or 0
    else:
        total_fl, quarantined_fl, available_fl = 0, 0, 0

    # 7. Recent decisions logged
    dec_res = graph.query("MATCH (d:Decision) RETURN count(d) AS cnt")
    recent_decisions_count = dec_res.result_set[0][0] if dec_res.result_set else 0

    return OverviewMetricsResponse(
        active_cases_count=active_cases_count,
        shipments_traced_count=shipments_traced_count,
        records_needing_review_count=records_needing_review_count,
        gaps_open_count=gaps_open_count,
        finished_lots_count=total_fl,
        quarantined_finished_lots_count=quarantined_fl,
        available_finished_lots_count=available_fl,
        current_case=current_case,
        recent_decisions_count=recent_decisions_count,
    )
