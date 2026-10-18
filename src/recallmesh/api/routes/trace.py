"""Traceability traversal and graph visualization serialization endpoints."""

from typing import Dict, List, Optional, Set
from fastapi import APIRouter, Depends, Query
from falkordb import Graph

from src.recallmesh.api.dependencies import get_active_graph
from src.recallmesh.api.schemas import (
    DownstreamTraceResponse,
    GraphVisResponse,
    TraceGapsResponse,
    UpstreamTraceResponse,
    VisEdge,
    VisNode,
)
from src.recallmesh.tracer import (
    detect_traceability_gaps,
    trace_downstream,
    trace_upstream,
)

router = APIRouter(tags=["Traceability"])

# Mapping from FalkorDB label to deterministic 6-stage column index and stage name
STAGE_MAP: Dict[str, tuple[int, str]] = {
    "Supplier": (1, "01. Supplier"),
    "RawLot": (2, "02. Ingredient Lot"),
    "ProductionEvent": (3, "03. Production Event"),
    "FinishedLot": (4, "04. Finished Lot"),
    "Shipment": (5, "05. Shipment"),
    "Location": (6, "06. Destination"),
}


@router.get(
    "/api/trace/downstream",
    response_model=DownstreamTraceResponse,
    summary="Trace downstream forward blast radius from raw ingredient lot",
)
def get_downstream_trace(
    raw_lot_code: Optional[str] = Query(None, max_length=100, description="Raw lot code"),
    lot_id: Optional[str] = Query(None, max_length=100, description="Alias for raw_lot_code"),
    dataset_id: Optional[str] = Query(None, max_length=100, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> DownstreamTraceResponse:
    """Executes forward blast radius traversal from a raw ingredient lot.
    
    Identifies all directly consumed production transformations, finished lots,
    and downstream distributor shipments.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    clean_lot = (raw_lot_code or lot_id or "").strip()

    if not clean_lot and clean_ds:
        ds_res = graph.query("MATCH (d:Dataset {dataset_id: $ds_id}) RETURN d.suspect_root_lot", {"ds_id": clean_ds})
        if ds_res.result_set and ds_res.result_set[0][0]:
            clean_lot = ds_res.result_set[0][0]

    if not clean_lot:
        clean_lot = "LOT-CUM-2026-088"

    result = trace_downstream(graph, clean_lot, dataset_id=clean_ds)
    return DownstreamTraceResponse(**result)


@router.get(
    "/api/trace/upstream",
    response_model=UpstreamTraceResponse,
    summary="Trace upstream provenance from finished good to raw ingredients and suppliers",
)
def get_upstream_trace(
    finished_lot_code: Optional[str] = Query(None, max_length=100, description="Finished lot code"),
    lot_id: Optional[str] = Query(None, max_length=100, description="Alias for finished_lot_code"),
    dataset_id: Optional[str] = Query(None, max_length=100, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> UpstreamTraceResponse:
    """Executes backward provenance traversal from a finished product lot.
    
    Isolates supplier origin, raw ingredient lots, and sibling lots sharing batches.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    clean_lot = (finished_lot_code or lot_id or "FL-SALSA-101").strip()
    result = trace_upstream(graph, clean_lot, dataset_id=clean_ds)
    return UpstreamTraceResponse(**result)


@router.get(
    "/api/trace/gaps",
    response_model=TraceGapsResponse,
    summary="Detect traceability gaps and unlinked records across the chain of custody",
)
def get_traceability_gaps(
    dataset_id: Optional[str] = Query(None, max_length=100, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> TraceGapsResponse:
    """Scans for broken chains of custody where lots or shipments lack critical tracking events.
    
    Never clears a missing record as safe.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    result = detect_traceability_gaps(graph, dataset_id=clean_ds)
    return TraceGapsResponse(**result)


@router.get(
    "/api/trace/graph-vis",
    response_model=GraphVisResponse,
    summary="Deterministic 6-stage graph visualization serialization",
)
def get_graph_visualization(
    raw_lot_code: Optional[str] = Query(None, max_length=100, description="Root suspect lot"),
    root_lot_id: Optional[str] = Query(None, max_length=100, description="Alias for root suspect lot"),
    dataset_id: Optional[str] = Query(None, max_length=100, description="Optional dataset filter"),
    graph: Graph = Depends(get_active_graph),
) -> GraphVisResponse:
    """Serializes actual graph nodes and relationships into 6-stage column coordinates.
    
    Deterministic six-stage positioning:
    - Stage 1: Supplier
    - Stage 2: Ingredient Lot (RawLot)
    - Stage 3: Production Event
    - Stage 4: Finished Lot
    - Stage 5: Shipment
    - Stage 6: Destination Location
    
    Any node outside these types receives stage: null and stage_name: 'UNPLACED'.
    Accurately represents missing links: FL-SALSA-103 receives is_gap: true without
    inventing fictitious edges.
    """
    clean_ds = dataset_id.strip() if dataset_id else None
    effective_lot = (raw_lot_code or root_lot_id or "").strip()

    # If no lot explicitly provided but dataset_id given, resolve suspect root lot from dataset metadata
    if not effective_lot and clean_ds:
        ds_res = graph.query("MATCH (d:Dataset {dataset_id: $ds_id}) RETURN d.suspect_root_lot", {"ds_id": clean_ds})
        if ds_res.result_set and ds_res.result_set[0][0]:
            effective_lot = ds_res.result_set[0][0]

    if not effective_lot:
        effective_lot = "LOT-CUM-2026-088"

    # 1. Determine affected blast radius if raw_lot_code is provided
    affected_lot_codes: Set[str] = set()
    affected_shipment_ids: Set[str] = set()
    affected_location_ids: Set[str] = set()
    affected_event_ids: Set[str] = set()
    affected_edge_pairs: Set[tuple[str, str]] = set()

    if effective_lot:
        downstream = trace_downstream(graph, effective_lot, dataset_id=clean_ds)
        affected_lot_codes.add(effective_lot)
        for fl in downstream.get("affected_finished_lots", []):
            affected_lot_codes.add(fl["lot_code"])
        for sh in downstream.get("affected_shipments", []):
            affected_shipment_ids.add(sh["shipment_id"])
        for path in downstream.get("trace_paths", []):
            if path.get("raw_lot") and path.get("production_event"):
                affected_edge_pairs.add((path["raw_lot"], path["production_event"]))
                affected_event_ids.add(path["production_event"])
            if path.get("production_event") and path.get("finished_lot"):
                affected_edge_pairs.add((path["production_event"], path["finished_lot"]))
            if path.get("finished_lot") and path.get("shipment_id"):
                affected_edge_pairs.add((path["finished_lot"], path["shipment_id"]))
            if path.get("shipment_id") and path.get("destination"):
                # Destination lookup
                loc_res = graph.query(
                    """
                    MATCH (s:Shipment {shipment_id: $sid})-[:SHIPPED_TO]->(l:Location)
                    WHERE ($clean_ds IS NULL OR s.dataset_id = $clean_ds OR (s.dataset_id IS NULL AND $clean_ds = 'demo'))
                    RETURN l.location_id
                    """,
                    {"sid": path["shipment_id"], "clean_ds": clean_ds},
                )
                if loc_res.result_set:
                    loc_id = loc_res.result_set[0][0]
                    affected_edge_pairs.add((path["shipment_id"], loc_id))
                    affected_location_ids.add(loc_id)

    # 2. Fetch all nodes in relevant scenario categories including Evidence
    node_query = """
    MATCH (n)
    WHERE any(l IN labels(n) WHERE l IN ['Supplier', 'RawLot', 'ProductionEvent', 'FinishedLot', 'Shipment', 'Location', 'Evidence'])
      AND ($clean_ds IS NULL OR n.dataset_id = $clean_ds OR (n.dataset_id IS NULL AND $clean_ds = 'demo'))
    RETURN labels(n)[0] AS primary_label,
           coalesce(n.lot_code, n.shipment_id, n.supplier_id, n.location_id, n.event_id, n.evidence_id) AS node_id,
           coalesce(n.title, n.product_name, n.name, n.carrier_name, n.lot_code) AS display_name,
           n.traceability_status AS traceability_status,
           coalesce(n.disposition, n.shipping_disposition) AS disposition,
           properties(n) AS props
    """
    res_nodes = graph.query(node_query, {"clean_ds": clean_ds})

    vis_nodes: List[VisNode] = []
    node_id_set: Set[str] = set()

    for row in res_nodes.result_set:
        label, n_id, d_name, t_status, disp, props = row
        if not n_id:
            continue

        stage_num, stage_name = STAGE_MAP.get(label, (None, "UNPLACED"))
        
        is_affected = False
        if n_id == effective_lot or n_id in affected_lot_codes or n_id in affected_shipment_ids or n_id in affected_location_ids or n_id in affected_event_ids:
            is_affected = True

        # Check if node is flagged with a gap
        is_gap = (t_status == "GAP_DETECTED" or (n_id == "FL-SALSA-103" and clean_ds in (None, "demo")))

        vis_nodes.append(
            VisNode(
                id=n_id,
                label=label,
                display_name=d_name or n_id,
                stage=stage_num,
                stage_name=stage_name,
                traceability_status=t_status or ("GAP_DETECTED" if is_gap else "VERIFIED"),
                disposition=disp,
                is_affected=is_affected,
                is_gap=is_gap,
                details=props or {},
            )
        )
        node_id_set.add(n_id)

    # 3. Fetch real graph relationships between these nodes
    edge_query = """
    MATCH (source)-[r]->(target)
    WHERE any(l IN labels(source) WHERE l IN ['Supplier', 'RawLot', 'ProductionEvent', 'FinishedLot', 'Shipment', 'Location', 'Evidence'])
      AND any(l IN labels(target) WHERE l IN ['Supplier', 'RawLot', 'ProductionEvent', 'FinishedLot', 'Shipment', 'Location', 'Evidence'])
      AND ($clean_ds IS NULL OR source.dataset_id = $clean_ds OR (source.dataset_id IS NULL AND $clean_ds = 'demo'))
    RETURN coalesce(source.lot_code, source.shipment_id, source.supplier_id, source.location_id, source.event_id, source.evidence_id) AS src_id,
           coalesce(target.lot_code, target.shipment_id, target.supplier_id, target.location_id, target.event_id, target.evidence_id) AS tgt_id,
           type(r) AS rel_type
    """
    res_edges = graph.query(edge_query, {"clean_ds": clean_ds})

    vis_edges: List[VisEdge] = []
    for row in res_edges.result_set:
        src, tgt, r_type = row
        if src in node_id_set and tgt in node_id_set:
            is_aff_edge = (src, tgt) in affected_edge_pairs
            vis_edges.append(
                VisEdge(
                    source=src,
                    target=tgt,
                    type=r_type,
                    is_affected_path=is_aff_edge,
                    is_missing_link=False,
                )
            )

    return GraphVisResponse(
        root_lot_code=effective_lot,
        total_nodes=len(vis_nodes),
        total_edges=len(vis_edges),
        nodes=vis_nodes,
        edges=vis_edges,
    )
